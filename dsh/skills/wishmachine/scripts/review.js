// Review packet + report validation. The tool never calls a model: it assembles everything a
// reviewer needs (chapter text, the six-question checklist, deterministic leads) and then checks
// whatever report comes back. The `quote` of every finding must exist verbatim in the chapter,
// which is what stops a reviewer from inventing problems.
import fs from 'node:fs';
import path from 'node:path';
import { chapterFile } from './paths.js';
import { readJson, readText, safeSegment } from './util.js';
import { checkProject } from './schema.js';

const CATEGORIES = [
  { id: 'collocation', label: '搭配', question: '这个动词能配这个名词吗？把句子改说成一个事实（谁做了什么、谁会怎样）还成立吗？' },
  { id: 'consistency', label: '前后一致', question: '前文立下的状态后文还记得吗？停下的东西又动了吗？拿走的又出现了吗？' },
  { id: 'space', label: '空间', question: '这个房间有窗吗？人在哪一层？够得着吗？走得过去吗？' },
  { id: 'time', label: '时间', question: '把全章钟点排一遍：能接上吗？时距合理吗？报时是不是太密？' },
  { id: 'presence', label: '在场与知情', question: '这件事发生时他在场吗？他这句话是从哪儿知道的？' },
  { id: 'countable', label: '可数', question: '凡是"三样/第几个/两个人"，读者会去数的，都对得上吗？' },
];

const VERDICTS = ['confirmed', 'suspicious'];

function countCjk(text) {
  return (String(text).match(/[\u4e00-\u9fff]/g) || []).length;
}

function splitParagraphs(text) {
  const body = String(text).split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');
  return body.split(/\n\s*\n/).map((para) => para.trim()).filter((para) => /[\u4e00-\u9fff]/.test(para));
}

function countablesOf(paragraphs) {
  const pattern = /(第[一二三四五六七八九十0-9]+|[一二三四五六七八九十两0-9]+(?:样|个|件|张|具|把|支|处|扇|号|排|层))/;
  const out = [];
  paragraphs.forEach((para, index) => {
    for (const sentence of para.split(/(?<=[。！？])/)) {
      const hit = sentence.match(pattern);
      if (hit) out.push({ paragraph: index + 1, word: hit[0], sentence: sentence.trim() });
    }
  });
  return out.slice(0, 20);
}

function buildReviewPacket(project, options = {}) {
  const id = safeSegment(options.chapterId || options.id || '', 'chapter id');
  const file = chapterFile(project.dir, id);
  if (!fs.existsSync(file)) {
    const error = new Error(`chapter not found: ${id}; list ids with "wishmachine state --dir ${project.dir} --view brief"`);
    error.code = 'usage.error';
    throw error;
  }
  const text = readText(file);
  const paragraphs = splitParagraphs(text);
  const style = checkProject(project, { profile: 'style', target: 'chapter', id });
  return {
    ok: true,
    action: 'review',
    schema_version: 1,
    chapter: id,
    chapter_file: path.relative(project.dir, file),
    project_dir: project.dir,
    counts: {
      cjk: countCjk(text),
      paragraphs: paragraphs.length,
      sentences: paragraphs.reduce((total, para) => total + (para.match(/[。！？]/g) || []).length, 0),
    },
    categories: CATEGORIES,
    leads: {
      style_findings: (style.findings || []).map((item) => ({
        rule_id: item.rule_id,
        severity: item.severity,
        evidence: item.evidence || [],
      })),
      paragraph_ends: paragraphs.map((para, index) => ({
        paragraph: index + 1,
        last_sentence: (para.split(/(?<=[。！？])/).filter(Boolean).pop() || '').trim(),
      })).slice(0, 40),
      countables: countablesOf(paragraphs),
    },
    contract: {
      file: 'JSON',
      shape: {
        chapter: '<chapter id>',
        findings: [
          {
            category: CATEGORIES.map((item) => item.id),
            verdict: VERDICTS,
            paragraph: '<1-based paragraph index>',
            quote: '<原文片段，必须与章节正文逐字一致>',
            problem: '<为什么有问题>',
            fix: '<改法，或留空表示待作者定>',
          },
        ],
        empty_categories: '<列出确实没有问题的类别 id>',
      },
      rules: [
        'quote 必须逐字出现在章节正文里，否则视为编造，校验失败',
        '不确定用 suspicious，只有确认矛盾才用 confirmed',
        '每一类都要过一遍；没有问题的类别写进 empty_categories，不许为凑数编问题',
      ],
    },
  };
}

function validateReviewReport(packet, report) {
  const findings = Array.isArray(report?.findings) ? report.findings : [];
  const text = readText(path.resolve(packet.project_dir || '', packet.chapter_file));
  const problems = [];
  const confirmed = [];
  const suspicious = [];
  const categoryIds = new Set(CATEGORIES.map((item) => item.id));
  for (const [index, finding] of findings.entries()) {
    const where = `findings[${index}]`;
    if (!categoryIds.has(finding.category)) problems.push(`${where}.category 非法：${finding.category}`);
    if (!VERDICTS.includes(finding.verdict)) problems.push(`${where}.verdict 非法：${finding.verdict}`);
    if (!finding.quote || !text.includes(finding.quote)) {
      problems.push(`${where}.quote 未在正文逐字出现（疑似编造）：${String(finding.quote || '').slice(0, 30)}`);
      continue;
    }
    if (finding.verdict === 'confirmed') confirmed.push(finding);
    else suspicious.push(finding);
  }
  const empty = Array.isArray(report?.empty_categories) ? report.empty_categories : [];
  const covered = new Set([...findings.map((item) => item.category), ...empty]);
  const uncovered = [...categoryIds].filter((id) => !covered.has(id));
  return {
    ok: problems.length === 0 && uncovered.length === 0,
    chapter: packet.chapter,
    counts: { total: findings.length, confirmed: confirmed.length, suspicious: suspicious.length },
    confirmed,
    suspicious,
    uncovered_categories: uncovered,
    problems,
  };
}

function readReviewReport(file) {
  try {
    return readJson(file);
  } catch (error) {
    const wrapped = new Error(`review report is not valid JSON: ${file} (${error.message})`);
    wrapped.code = 'usage.error';
    throw wrapped;
  }
}

// 冷读审稿的投喂文本：写完一章的 agent 应当自己起一个新上下文（子 agent / 新进程）跑这段，
// 冷眼来自上下文隔离，不来自换模型。
function reviewPrompt({ packetFile, reportFile, chapterId }) {
  return [
    `你在做冷读审稿，只读不改。审稿包：${packetFile}`,
    '',
    '1) 读包里 categories（六类问题的可执行问句）、chapter_file 指向的正文、leads（style 命中句与段末句、可数候选）。',
    '2) 逐类过一遍：搭配 / 前后一致 / 空间 / 时间 / 在场与知情 / 可数。',
    `3) 按包内 contract 的 JSON 形状写报告到 ${reportFile}，chapter 填 "${chapterId}"。`,
    '4) quote 必须与正文逐字一致（校验会拒掉编造的引文）；不确定的用 suspicious；',
    '   没有问题的类别写进 empty_categories；每一类都要真过一遍，不许为凑数编问题。',
    '5) 不要修改 chapters/ 下任何文件，不要重写正文。',
  ].join('\n');
}

export { CATEGORIES, VERDICTS, buildReviewPacket, reviewPrompt, validateReviewReport, readReviewReport };
