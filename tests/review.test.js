import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { initProject, loadProject } from '../scripts/project.js';
import { chapterFile } from '../scripts/paths.js';
import { CATEGORIES, buildReviewPacket, reviewPrompt, validateReviewReport } from '../scripts/review.js';

const CHAPTER = [
  '# 第1章 · 封存柜',
  '',
  '凌晨三点四十七分，停尸房的排风扇停了。',
  '',
  '他拉开二号柜，露出新送来的那具尸体。',
  '',
  '“名字不死，活人就得死。”',
  '',
  '挂钟的走针声压过了排风扇。',
].join('\n');

function makeProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wm-review-'));
  initProject({ name: '审稿测试', dir, parts: 1, volumes: 1, chapter: 3, chapterChars: 1500, minChars: 1200 });
  const project = loadProject(dir);
  fs.writeFileSync(chapterFile(dir, 'P1-V1-C1'), CHAPTER, 'utf8');
  return project;
}

test('review packet 带六类问题、字数和确定性线索', () => {
  const project = makeProject();
  const packet = buildReviewPacket(project, { chapterId: 'P1-V1-C1' });
  assert.equal(packet.ok, true);
  assert.equal(packet.chapter, 'P1-V1-C1');
  assert.equal(packet.categories.length, 6);
  assert.deepEqual(packet.categories.map((item) => item.id), CATEGORIES.map((item) => item.id));
  assert.ok(packet.counts.cjk > 30, `cjk=${packet.counts.cjk}`);
  assert.ok(packet.counts.paragraphs >= 4);
  assert.ok(Array.isArray(packet.leads.paragraph_ends));
  assert.ok(packet.leads.paragraph_ends.length >= 4);
  assert.ok(packet.contract.rules.some((rule) => rule.includes('逐字出现')));
});

test('packet 的线索里带 style findings 与可数候选', () => {
  const project = makeProject();
  const packet = buildReviewPacket(project, { chapterId: 'P1-V1-C1' });
  assert.ok(Array.isArray(packet.leads.style_findings));
  const countables = packet.leads.countables;
  assert.ok(countables.some((item) => item.word === '二号'), JSON.stringify(countables));
});

test('审稿报告：编造引文被拒（quote 必须逐字出现在正文）', () => {
  const project = makeProject();
  const packet = buildReviewPacket(project, { chapterId: 'P1-V1-C1' });
  const result = validateReviewReport(packet, {
    chapter: 'P1-V1-C1',
    findings: [
      { category: 'collocation', verdict: 'confirmed', paragraph: 3, quote: '名字不死', problem: '抽象名词当生命主体' },
      { category: 'countable', verdict: 'suspicious', paragraph: 4, quote: '他把钥匙塞进证物袋', problem: '编的' },
    ],
    empty_categories: ['space', 'time'],
  });
  assert.equal(result.ok, false);
  assert.equal(result.problems.length, 1);
  assert.match(result.problems[0], /疑似编造/);
  assert.deepEqual(result.uncovered_categories, ['consistency', 'presence']);
});

test('审稿报告：真实引文 + 全类覆盖 → 通过并按定级计数', () => {
  const project = makeProject();
  const packet = buildReviewPacket(project, { chapterId: 'P1-V1-C1' });
  const result = validateReviewReport(packet, {
    chapter: 'P1-V1-C1',
    findings: [
      { category: 'collocation', verdict: 'confirmed', paragraph: 3, quote: '名字不死', problem: '搭配错' },
      { category: 'consistency', verdict: 'confirmed', paragraph: 4, quote: '挂钟的走针声压过了排风扇', problem: '排风扇已停' },
      { category: 'space', verdict: 'suspicious', paragraph: 2, quote: '拉开二号柜', problem: '空间?' },
    ],
    empty_categories: ['time', 'presence', 'countable'],
  });
  assert.equal(result.ok, true, JSON.stringify(result.problems));
  assert.deepEqual(result.counts, { total: 3, confirmed: 2, suspicious: 1 });
  assert.deepEqual(result.uncovered_categories, []);
});

test('审稿报告：非法类别或定级被报出来', () => {
  const project = makeProject();
  const packet = buildReviewPacket(project, { chapterId: 'P1-V1-C1' });
  const result = validateReviewReport(packet, {
    chapter: 'P1-V1-C1',
    findings: [{ category: 'vibes', verdict: 'maybe', paragraph: 1, quote: '停尸房的排风扇停了' }],
    empty_categories: CATEGORIES.map((item) => item.id),
  });
  assert.equal(result.ok, false);
  assert.ok(result.problems.some((item) => item.includes('category 非法')));
  assert.ok(result.problems.some((item) => item.includes('verdict 非法')));
});

test('不存在的章节 → usage.error 带可执行提示', () => {
  const project = makeProject();
  assert.throws(() => buildReviewPacket(project, { chapterId: 'P9-V9-C9' }), (error) => {
    assert.equal(error.code, 'usage.error');
    assert.match(error.message, /chapter not found/);
    assert.match(error.message, /state --dir/);
    return true;
  });
});

test('投喂文本带包路径、报告路径与逐字引文规则', () => {
  const text = reviewPrompt({
    packetFile: '/tmp/p.json',
    reportFile: '/tmp/r.json',
    chapterId: 'P1-V1-C1',
  });
  assert.match(text, /\/tmp\/p\.json/);
  assert.match(text, /\/tmp\/r\.json/);
  assert.match(text, /P1-V1-C1/);
  assert.match(text, /逐字一致/);
  assert.match(text, /不许为凑数编问题/);
  assert.match(text, /不要修改/);
});

test('collocation_flags 由规则直接报出抽象名词配生命动词', () => {
  const project = makeProject();
  const packet = buildReviewPacket(project, { chapterId: 'P1-V1-C1' });
  const flags = packet.leads.collocation_flags;
  assert.ok(flags.some((item) => item.pair === '名字不死'), JSON.stringify(flags));
  assert.ok(flags.every((item) => item.paragraph >= 1));
});

test('collocation_flags 不误伤正常搭配', () => {
  const project = makeProject();
  const packet = buildReviewPacket(project, { chapterId: 'P1-V1-C1' });
  // 正文里的「活人」「死者」这类名词复合不应被当成搭配错误
  assert.equal(packet.leads.collocation_flags.length, 1, JSON.stringify(packet.leads.collocation_flags));
});
