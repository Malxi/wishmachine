// Style ("AI smell") rules: statistical metrics, advisory findings and the
// book-level style audit. Findings are low/medium only and never blocking.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, readText } from '../../util.js';
import { chapterFile, setupFile } from '../../paths.js';
import { finding, SEVERITY_RANK } from '../finding.js';
import { chapterMetrics, setupMetrics } from './metrics.js';

const DEFAULT_THRESHOLDS = {
  chapter: {
    compressedPredicatePer1k: { warn: 2.0, risk: 3.5 },
    negatedCompressedShare: { warn: 0.5, risk: 0.7 },
    compressedDistinctRatio: { warn: 0.85, risk: 0.7, direction: 'low' },
    sentenceOpeningReuse: { warn: 0.3, risk: 0.45 },
    subjectOpeningShare: { warn: 0.08, risk: 0.15 },
    templateConnectorsPer1k: { warn: 0.8, risk: 1.5 },
    similePer1k: { warn: 2.5, risk: 4 },
    upliftPer1k: { warn: 0.3, risk: 0.6 },
    dialogueRatio: { min: 0.08, max: 0.35, riskMin: 0.05, riskMax: 0.5 },
    sentenceCv: { min: 0.45, riskMin: 0.3 },
    paragraphCv: { min: 0.5, riskMin: 0.35 },
    shortClauseRatio: { warn: 0.2, risk: 0.35 },
    fragmentSentenceRatio: { warn: 0.04, risk: 0.08 },
    enumerationPer1k: { warn: 15, risk: 22 },
    countingPer1k: { warn: 2, risk: 3 },
    recountPer1k: { warn: 0.5, risk: 1.5 },
    paddingRatio: { warn: 1.1, risk: 1.25 },
    motifMaxPer1k: { warn: 3, risk: 6 },
  },
  setup: {
    genreCount: { warn: 3, risk: 5 },
    abstractPer1k: { warn: 8, risk: 15 },
    themeAphorism: { risk: 1 },
    concreteRulesRatio: { min: 0.5, riskMin: 0.3 },
    nameSurnameConcentration: { warn: 0.4, risk: 0.6 },
    nameDescriptorRatio: { warn: 0.2, risk: 0.4 },
    nameSingleCharGivenRatio: { warn: 0.5, risk: 0.75 },
    nameSourceCoverage: { min: 0.6, riskMin: 0.3 },
    nameStyleDiversity: { min: 0.5, riskMin: 0.25 },
    nameDuplicateCount: { warn: 0, risk: 1 },
  },
};

const CHAPTER_RULES = [
  ['compressedPredicatePer1k', 'style.chapter.compressed_predicate', '单字谓语收尾', '压缩成“会躁/没争/不响”式单字谓语', '把其中一部分展开成具体动作、表情或口语；保留少量作为节奏即可。', 'compressedExamples'],
  ['negatedCompressedShare', 'style.chapter.negated_predicate', '否定式单字谓语', '单字谓语里“不/没/未/别”占比过高', '把否定句改成正面动作或直接写结果，例如“没答”改成“他把碗放下，没接话”。'],
  ['compressedDistinctRatio', 'style.chapter.predicate_variety', '单字谓语重复', '单字谓语类型过于集中', '换动词或改句式，避免“不响/没答/不动”反复出现。'],
  ['sentenceOpeningReuse', 'style.chapter.opening_reuse', '句首复用', '过多句子用同一个两字开头', '合并、倒装或从句中切入，减少“沈穗把/她把”式开头。', 'openingExamples'],
  ['subjectOpeningShare', 'style.chapter.subject_openers', '主语开头过多', '大量句子以人物名开头', '用动作、环境、对话或他人视角开头，让句子入口有变化。'],
  ['templateConnectorsPer1k', 'style.chapter.template_connectors', '模板连接句', '“不是…而是/不仅…还/首先其次最后”等模板句偏多', '直接说结论，删掉对比铺垫；一次对比只保留真正纠正读者预期的那次。'],
  ['similePer1k', 'style.chapter.simile_density', '比喻密度', '比喻标记（像/仿佛/似乎/宛如）偏多', '删掉一半比喻，把意象换成人物职业/环境里独有的具体物。'],
  ['upliftPer1k', 'style.chapter.paragraph_uplift', '段尾升华', '段落结尾频繁用抽象词总结、拔高', '让段落停在动作、对话或未解释的细节上；主题让读者自己得出。', 'upliftExamples'],
  ['dialogueRatio', 'style.chapter.dialogue_balance', '对话比例', '对话占比过低或过高', '低则把部分叙述改成对话/动作；高则补动作与场景。'],
  ['sentenceCv', 'style.chapter.sentence_rhythm', '句长节奏', '句子长度过于均匀，缺少长短变化', '插入短句、长句或口语停顿，朗读一遍再改。'],
  ['paragraphCv', 'style.chapter.paragraph_rhythm', '段长节奏', '段落长度过于整齐', '允许一段只写一句，也允许一段写长。'],
  ['shortClauseRatio', 'style.chapter.short_clauses', '短句过多', '小句过短、句子被逗号切碎', '合并小句，减少“主语+单字谓语+句号”的连击。'],
  ['fragmentSentenceRatio', 'style.chapter.fragments', '电报句/碎片句', '“没响。”式超短叙述句过多', '把碎片句并入上一句或补成完整动作；一句话一段只在真正需要停顿处用。', 'fragmentExamples'],
  ['enumerationPer1k', 'style.chapter.enumeration', '清单式罗列', '“九把，两把，一捆”式数量清单密度过高', '只保留会改变判断的数量；其余改成动作或删掉。', 'enumerationExamples'],
  ['countingPer1k', 'style.chapter.counting_tic', '数数/核对口头禅', '数、点、核对、清点等动词密度过高', '数数只在信息变化或付出代价时出现；否则换成别的动作。', 'countingExamples'],
  ['recountPer1k', 'style.chapter.recount_tic', '重复点数', '“点过一遍，又点一遍”式重复动作', '第二次点数必须多数出/少数出东西；否则删掉第一次。', 'recountExamples'],
  ['paddingRatio', 'style.chapter.padding', '章节注水', '章节长度明显超过 target，且容易靠细节填充', '删掉不改变状态、不新增信息的段落，回到 target 附近；把笔墨留给转折。'],
  ['motifMaxPer1k', 'style.chapter.motif_overuse', '母题过密', '配置的母题词在单章里出现密度过高', '同一母题每次出现都要改变代价或认知；删掉纯仪式性的重复。', 'motifCounts'],
];

const BOOK_RULES = CHAPTER_RULES.filter(([metric]) => metric !== 'paddingRatio');

const SETUP_RULES = [
  ['genreCount', 'style.setup.genre_salad', '题材堆叠', '题材数量偏多，容易变成元素沙拉', '选一个主类型，其余作为代价机制或氛围，不要并列卖点。'],
  ['abstractPer1k', 'style.setup.abstract_terms', '抽象词密度', 'premise/theme/rules 里抽象大词偏多', '换成可操作、可观察、有代价的具体规则与细节。'],
  ['themeAphorism', 'style.setup.theme_aphorism', '格言式主题', 'theme 写成了格言/总结句', '把主题写成人物每天必须执行的规矩或账目，让读者自己得出。'],
  ['concreteRulesRatio', 'style.setup.rules_concrete', '规则不可操作', '规则缺少数量、上限、代价或后果', '每条规则写清“能做什么、不能做什么、违反后付什么代价”。'],
  ['nameSurnameConcentration', 'style.setup.name_surname', '姓氏集中', '同一姓氏占比过高', '换姓或使用抽卡名字；主角团不要全是一个姓。', 'nameExamples'],
  ['nameDescriptorRatio', 'style.setup.name_descriptor', '描述式名字', '老X/阿X/收成人/XX那位式名字偏多', '给角色正常姓名，绰号只作为补充；抽卡里优先选 plain 风格。', 'nameExamples'],
  ['nameSingleCharGivenRatio', 'style.setup.name_single_char', '单字名过多', '双字姓名里的单字名占比过高', '抽 1–2 个双字名或日常名，避免所有主角都是单字雅名。', 'nameExamples'],
  ['nameSourceCoverage', 'style.setup.name_source', '名字来源缺失', 'core_cast 缺少 namecard_id/name_source 记录', '先跑 ideas draw --type namecard --genre <实际题材>，把选中的 namecard_id、naming_style、naming_logic 写进 setup。', 'nameExamples'],
  ['nameStyleDiversity', 'style.setup.name_style', '命名风格单一', 'naming_style 只有一种或缺失', '抽卡时混用 plain/literary/rustic/hard，并保留每张卡的 naming_style。'],
  ['nameDuplicateCount', 'style.setup.name_duplicate', '重名', 'core_cast 里有重复姓名', '改名或合并角色。', 'nameExamples'],
];

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function mergeThresholds(base, override) {
  const merged = { ...base };
  if (!override || typeof override !== 'object') return merged;
  for (const [key, value] of Object.entries(override)) {
    if (!merged[key] || !value || typeof value !== 'object') continue;
    const next = { ...merged[key] };
    for (const [field, number] of Object.entries(value)) {
      if (numeric(number)) next[field] = number;
    }
    merged[key] = next;
  }
  return merged;
}

function resolveThresholds(config) {
  const style = config?.style;
  return {
    chapter: mergeThresholds(DEFAULT_THRESHOLDS.chapter, style?.chapter),
    setup: mergeThresholds(DEFAULT_THRESHOLDS.setup, style?.setup),
  };
}

function resolveMotifs(config) {
  const motifs = config?.style?.motifs;
  return Array.isArray(motifs) ? motifs.filter((term) => typeof term === 'string' && term.trim()) : [];
}

function bandFor(value, threshold) {
  if (threshold.direction === 'low') {
    if (value < threshold.risk) return 'risk';
    if (value < threshold.warn) return 'warn';
    return 'ok';
  }
  if (numeric(threshold.min) || numeric(threshold.max)) {
    if (numeric(threshold.riskMin) && value < threshold.riskMin) return 'risk';
    if (numeric(threshold.min) && value < threshold.min) return 'warn';
    if (numeric(threshold.riskMax) && value > threshold.riskMax) return 'risk';
    if (numeric(threshold.max) && value > threshold.max) return 'warn';
    return 'ok';
  }
  if (value > threshold.risk) return 'risk';
  if (value > threshold.warn) return 'warn';
  return 'ok';
}

function describeThreshold(threshold) {
  if (threshold.direction === 'low') return `healthy >= ${threshold.warn}, risk < ${threshold.risk}`;
  if (numeric(threshold.min) || numeric(threshold.max)) {
    return `healthy ${threshold.min ?? '-'}..${threshold.max ?? '-'}, risk outside ${threshold.riskMin ?? '-'}..${threshold.riskMax ?? '-'}`;
  }
  return `healthy <= ${threshold.warn}, risk > ${threshold.risk}`;
}

function styleFinding(rule, severity, label, options) {
  const { metric, value, threshold, band, suggestion, targetId, evidence } = options;
  const item = finding(
    rule,
    severity,
    `${label}: ${value} (${describeThreshold(threshold)})`,
    targetId,
    suggestion,
  );
  item.metrics = { name: metric, value, band, threshold };
  if (Array.isArray(evidence) && evidence.length) item.evidence = evidence;
  return item;
}

function findingsFor(metrics, rules, thresholds, targetId) {
  const findings = [];
  for (const [metric, rule, label, issue, suggestion, evidenceKey] of rules) {
    const threshold = thresholds[metric];
    if (!threshold) continue;
    const value = metrics[metric];
    const band = bandFor(value, threshold);
    if (band === 'ok') continue;
    const evidence = evidenceKey ? metrics[evidenceKey] : undefined;
    const item = styleFinding(rule, band === 'risk' ? 'medium' : 'low', label, {
      metric, value, threshold, band, suggestion, targetId, evidence,
    });
    item.issue = `${item.issue}; ${issue}`;
    findings.push(item);
  }
  return findings;
}

function setupNames(setup) {
  return (setup?.core_cast || []).map((character) => character.name).filter(Boolean);
}

function readOptionalJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function styleFindings(project, target, id, override = {}) {
  const thresholds = resolveThresholds(project.config);
  if (target === 'setup') {
    const setup = override.setup !== undefined ? override.setup : readOptionalJson(setupFile(project.dir));
    if (!setup) return [];
    return findingsFor(setupMetrics(setup), SETUP_RULES, thresholds.setup, 'setup');
  }
  if (target === 'chapter') {
    if (!id) throw new Error('chapter style check requires --id');
    let text = override.chapterText;
    if (text === undefined) {
      const file = chapterFile(project.dir, id);
      if (!fs.existsSync(file)) throw new Error(`chapter not found: ${id}`);
      text = readText(file);
    }
    const setup = override.setup !== undefined ? override.setup : readOptionalJson(setupFile(project.dir));
    const metrics = chapterMetrics(text, {
      names: setupNames(setup),
      targetChars: project.config.chapter_config?.target_chars,
      motifs: resolveMotifs(project.config),
    });
    return findingsFor(metrics, CHAPTER_RULES, thresholds.chapter, id);
  }
  throw new Error(`style profile supports setup or chapter targets, got ${target}`);
}

function chapterFiles(project) {
  const dir = path.join(project.dir, 'chapters');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => ({ id: name.slice(0, -3), text: readText(path.join(dir, name)) }));
}

function applyStyleFilters(findings, options = {}) {
  const ignoredRules = new Set(options.ignoreRules || []);
  const active = [];
  const ignoredRuleCounts = {};
  for (const item of findings) {
    if (ignoredRules.has(item.rule_id)) {
      ignoredRuleCounts[item.rule_id] = (ignoredRuleCounts[item.rule_id] || 0) + 1;
      continue;
    }
    if (options.minSeverity && SEVERITY_RANK[item.severity] > SEVERITY_RANK[options.minSeverity]) continue;
    active.push(item);
  }
  const limited = options.maxFindings > 0 ? active.slice(0, options.maxFindings) : active;
  return { active: limited, ignoredFindings: findings.length - active.length, ignoredRuleCounts };
}

function summarizeStyle(findings, extra = {}) {
  const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0, ...extra };
  for (const item of findings) summary[item.severity] += 1;
  return summary;
}

function crossChapterMotifs(chapters, names) {
  const map = new Map();
  for (const { id, text } of chapters) {
    const clean = text.replace(/[^\u3400-\u9fff]/g, '');
    const seen = new Set();
    for (let size = 4; size <= 6; size += 1) {
      for (let index = 0; index + size <= clean.length; index += 1) {
        const phrase = clean.slice(index, index + size);
        if (seen.has(phrase)) continue;
        if (names.some((name) => phrase.includes(name))) continue;
        seen.add(phrase);
        if (!map.has(phrase)) map.set(phrase, new Set());
        map.get(phrase).add(id);
      }
    }
  }
  const minimum = Math.max(3, Math.ceil(chapters.length * 0.4));
  return [...map.entries()]
    .filter(([, ids]) => ids.size >= minimum)
    .sort((left, right) => right[1].size - left[1].size || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([phrase, ids]) => ({ phrase, chapters: ids.size, examples: [...ids].slice(0, 6) }));
}

function styleAudit(project, options = {}) {
  const thresholds = resolveThresholds(project.config);
  const motifsConfig = resolveMotifs(project.config);
  const targetChars = project.config.chapter_config?.target_chars;
  const setup = readOptionalJson(setupFile(project.dir));
  const names = setupNames(setup);
  const chapters = chapterFiles(project);
  const findings = [];
  if (setup) findings.push(...findingsFor(setupMetrics(setup), SETUP_RULES, thresholds.setup, 'setup'));
  const chapterResults = chapters.map(({ id, text }) => {
    const metrics = chapterMetrics(text, { names, targetChars, motifs: motifsConfig });
    const chapterFindings = findingsFor(metrics, CHAPTER_RULES, thresholds.chapter, id);
    findings.push(...chapterFindings);
    return { id, metrics, findings: chapterFindings };
  });
  const pooled = chapters.length
    ? chapterMetrics(chapters.map((chapter) => chapter.text).join('\n\n'), { names, targetChars, motifs: motifsConfig })
    : null;
  const bookFindings = pooled ? findingsFor(pooled, BOOK_RULES, thresholds.chapter, 'book') : [];
  const motifs = crossChapterMotifs(chapters, names);
  if (motifs.length) {
    const item = finding(
      'style.book.repeated_motif',
      'medium',
      `重复出现的描写/动作短语：${motifs.slice(0, 3).map((entry) => entry.phrase).join('、')}`,
      'book',
      '同一动作/意象每次出现都要升级代价或认知；否则删掉重复，换成新信息。',
    );
    item.metrics = { name: 'crossChapterMotifChapters', value: motifs[0].chapters, totalChapters: chapters.length };
    item.evidence = motifs.slice(0, 5);
    bookFindings.push(item);
  }
  findings.push(...bookFindings);
  const filtered = applyStyleFilters(findings, options);
  const view = options.view || 'brief';
  const result = {
    ok: true,
    blocking: false,
    profile: 'style',
    view,
    root: project.dir,
    name: project.config.name,
    thresholds,
    metrics: pooled,
    motifs,
    chapters: chapterResults.map((chapter) => ({
      id: chapter.id,
      metrics: chapter.metrics,
      findings: view === 'summary' ? undefined : applyStyleFilters(chapter.findings, options).active,
    })),
    findings: view === 'summary' ? [] : filtered.active,
    summary: summarizeStyle(filtered.active, {
      ignored_findings: filtered.ignoredFindings,
      ignored_rules: filtered.ignoredRuleCounts,
    }),
  };
  return result;
}

export { DEFAULT_THRESHOLDS, resolveThresholds, styleAudit, styleFindings };
