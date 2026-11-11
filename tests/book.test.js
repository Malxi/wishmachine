import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject, loadProject, projectStatus, projectState, auditProject, refreshProject, writeArtifact, readSection } from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import { drawIdeas } from '../scripts/ideas.js';
import { listWorkflows, readWorkflow, listReferences, readReference } from '../scripts/guides.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wishmachine-test-'));
}

const setup = {
  project_name: '测试小说',
  genres: ['科幻'],
  premise: '一艘船在虫潮中寻找逃生路线，必须在封锁前决定谁上船。',
  theme: '生存与选择',
  rules: ['跃迁会烧毁记忆'],
  target_audience: '成人',
  tone: '冷峻',
  tense: 'past',
  pov_style: 'third_person_limited',
  core_cast: [{ id: 'cast_lead', name: '孟启明', role: 'protagonist', importance: 10, story_function: '决定谁上船', entry_phase: 'opening' }],
  storylines: [{ name: '逃生', description: '逃离虫潮', type: 'main', importance: 10 }],
};

const outline = {
  parts: [{
    id: 'P1', title: '第一部', summary: '封锁与逃生',
    volumes: [
      {
        id: 'P1-V1', title: '第一卷', summary: '出港',
        chapters: [
          { id: 'P1-V1-C1', title: '封锁令', summary: '孟启明发现名单异常', characters: ['孟启明'], location: '砚港', events: [{ type: 'item', characters: ['孟启明'], subject: '名单', change: 'discover' }], conflict: '名单与虫潮时间矛盾', pacing: 'fast' },
          { id: 'P1-V1-C2', title: '登船', summary: '孟启明争取舱位', characters: ['孟启明'], location: '码头', events: [{ type: 'relationship', characters: ['孟启明'], subject: '舱位', change: 'get' }], conflict: '舱位不足', pacing: 'medium' },
        ],
      },
      {
        id: 'P1-V2', title: '第二卷', summary: '跃迁',
        chapters: [
          { id: 'P1-V2-C1', title: '第一次跃迁', summary: '跃迁失败', characters: ['孟启明'], location: '舰桥', events: [{ type: 'status', characters: ['孟启明'], subject: '伤势', change: 'lost' }], conflict: '虫族预判', pacing: 'fast' },
          { id: 'P1-V2-C2', title: '关闭引擎', summary: '决定停航', characters: ['孟启明'], location: '机库', events: [{ type: 'goal', characters: ['孟启明'], subject: '路线', change: 'changed' }], conflict: '路线选择', pacing: 'slow' },
        ],
      },
    ],
  }],
};

test('init, status, write setup/outline and check', () => {
  const dir = tempDir();
  initProject({ name: '测试小说', dir, parts: 1, volumes: 2, chapter: 2, genre: '科幻' });
  assert.ok(fs.existsSync(path.join(dir, 'novel.json')));
  let project = loadProject(dir);
  assert.equal(projectStatus(project).setup, false);

  const setupResult = writeArtifact(project, { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(setup) });
  assert.equal(setupResult.applied, true);
  project = loadProject(dir);
  assert.equal(projectStatus(project).setup, true);

  const outlineResult = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(outline) });
  assert.equal(outlineResult.applied, true);
  project = loadProject(dir);
  const status = projectStatus(project);
  assert.equal(status.outline.volumes, 2);
  assert.equal(status.outline.chapters, 4);
  assert.equal(status.next.stage, 'write');
  const state = projectState(project);
  assert.equal(state.state.chapter_count, 4);
  assert.equal(state.state.setup.cast[0].name, '孟启明');
  const audit = auditProject(project);
  assert.ok(audit.targets.some((target) => target.target === 'setup'));
  assert.ok(audit.targets.some((target) => target.target === 'outline'));

  const check = checkProject(project, { profile: 'all', target: 'outline' });
  assert.equal(check.blocking, false);
  assert.equal(check.summary.high, 0);
});

test('chapter write and read', () => {
  const dir = tempDir();
  initProject({ name: '章节测试', dir, parts: 1, volumes: 1, chapter: 1 });
  let project = loadProject(dir);
  const result = writeArtifact(project, { section: 'chapter', mode: 'replace', apply: true, id: 'P1-V1-C1', content: '# 第一章\n\n这是一段足够长的正文。'.repeat(20) });
  assert.equal(result.applied, true);
  project = loadProject(dir);
  const content = readSection(project, 'chapter', { id: 'P1-V1-C1' });
  assert.ok(content.content.includes('第一章'));
});

test('craft and recap schema checks', () => {
  const dir = tempDir();
  initProject({ name: 'craft test', dir, parts: 1, volumes: 1, chapter: 1 });
  let project = loadProject(dir);
  const craft = {
    name: '孟启明',
    appearance: '瘦削，手指有旧伤。',
    personality: ['冷静', '固执'],
    background: '在第一次救援失败后，把所有遇难者姓名写进私人日志。',
    motivation: '把下一次伤亡数字压到最低。',
    role_in_story: 'protagonist',
  };
  const craftResult = writeArtifact(project, { section: 'craft', target: 'character', mode: 'replace', apply: true, content: JSON.stringify(craft) });
  assert.equal(craftResult.applied, true);
  project = loadProject(dir);
  assert.equal(checkProject(project, { profile: 'all', target: 'craft', id: 'character' }).ok, true);

  const recap = {
    chapter_id: 'P1-V1-C1', title: '封锁令', location: '砚港', time: '封锁前夜',
    present: ['孟启明'], plot_beats: ['发现名单时间戳异常'], decisions: ['决定登船'],
    reveals: ['名单早于虫潮预警'], unresolved: ['谁改了名单'], promises: [],
    items: ['名单副本'], status: ['警觉'], last_line: '他把名单折进内袋。', cliffhanger: '',
  };
  const recapResult = writeArtifact(project, { section: 'recap', id: 'P1-V1-C1', mode: 'replace', apply: true, content: JSON.stringify(recap) });
  assert.equal(recapResult.applied, true);
  assert.equal(checkProject(loadProject(dir), { profile: 'all', target: 'recap', id: 'P1-V1-C1' }).ok, true);
});

test('item usage before acquisition is blocking', () => {
  const dir = tempDir();
  initProject({ name: 'item test', dir, parts: 1, volumes: 1, chapter: 2 });
  const project = loadProject(dir);
  const badOutline = JSON.parse(JSON.stringify(outline));
  badOutline.parts[0].volumes = [badOutline.parts[0].volumes[0]];
  badOutline.parts[0].volumes[0].chapters[0].events = [{
    type: 'item', characters: ['孟启明'], subject: '救援绳', change: 'use',
    actor: '孟启明', action: 'use', target: '救援绳', target_type: 'item',
  }];
  badOutline.parts[0].volumes[0].chapters[1].events = [{
    type: 'item', characters: ['孟启明'], subject: '救援绳', change: 'get',
    actor: '孟启明', action: 'acquire', target: '救援绳', target_type: 'item',
  }];
  const result = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(badOutline) });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.outline.item_usage'));
});

test('resource ledger arithmetic is checked', () => {
  const dir = tempDir();
  initProject({ name: 'ledger test', dir, parts: 1, volumes: 1, chapter: 2 });
  const project = loadProject(dir);
  const badOutline = JSON.parse(JSON.stringify(outline));
  badOutline.parts[0].volumes = [badOutline.parts[0].volumes[0]];
  badOutline.parts[0].volumes[0].chapters[1].resource_ledger = [{ item: '氧气', start: 10, delta: -3, end: 9, reason: '泄漏' }];
  const result = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(badOutline) });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.outline.resource_ledger' && item.severity === 'high'));
});

test('recap chapter id mismatch is blocking', () => {
  const dir = tempDir();
  initProject({ name: 'recap test', dir, parts: 1, volumes: 1, chapter: 2 });
  let project = loadProject(dir);
  writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(outline) });
  project = loadProject(dir);
  const recap = {
    chapter_id: 'P1-V1-C2', title: '封锁令', location: '砚港', time: '封锁前夜',
    present: ['孟启明'], plot_beats: ['发现名单时间戳异常'], decisions: [], reveals: [],
    unresolved: [], promises: [], items: [], status: [], last_line: '他把名单折进内袋。',
  };
  const result = writeArtifact(project, { section: 'recap', id: 'P1-V1-C1', mode: 'replace', apply: true, content: JSON.stringify(recap) });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.recap.chapter_id' && item.severity === 'high'));
});

test('a character who died cannot appear later without revival', () => {
  const dir = tempDir();
  initProject({ name: 'death test', dir, parts: 1, volumes: 1, chapter: 2 });
  const project = loadProject(dir);
  const deathOutline = JSON.parse(JSON.stringify(outline));
  deathOutline.parts[0].volumes = [deathOutline.parts[0].volumes[0]];
  deathOutline.parts[0].volumes[0].chapters[0].events = [{
    type: 'character', characters: ['孟启明', '沈观衡'], subject: '沈观衡', change: 'death',
    actor: '孟启明', action: 'kill', target: '沈观衡', target_type: 'character',
  }];
  deathOutline.parts[0].volumes[0].chapters[1].characters = ['孟启明', '沈观衡'];
  deathOutline.parts[0].volumes[0].chapters[1].events = [{
    type: 'status', characters: ['孟启明'], subject: '航线', change: 'changed',
    actor: '孟启明', action: 'set', target: '航线', target_type: 'status',
  }];
  const result = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(deathOutline) });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.outline.dead_character_present' && item.severity === 'high'));
});

test('worldpack bundles premise, resources and scenarios', () => {
  const pack = drawIdeas({ type: 'worldpack', genre: '科幻', count: 1, seed: 42 });
  assert.equal(pack.count, 1);
  assert.ok(pack.results[0].premise.title);
  assert.ok(pack.results[0].resources.length >= 1);
  assert.ok(pack.results[0].scenarios.length >= 1);
  assert.ok(pack.results[0].cast.length >= 1);
});

test('state anchor spirit stones must match the previous ledger end', () => {
  const dir = tempDir();
  initProject({ name: 'anchor test', dir, parts: 1, volumes: 1, chapter: 2 });
  const project = loadProject(dir);
  const anchorOutline = JSON.parse(JSON.stringify(outline));
  anchorOutline.parts[0].volumes = [anchorOutline.parts[0].volumes[0]];
  anchorOutline.parts[0].volumes[0].chapters[0].resource_ledger = [{ item: '灵石', start: 10, delta: -5, end: 5 }];
  anchorOutline.parts[0].volumes[0].chapters[1].state_anchor = { spirit_stones: 9, allies: ['孟启明'] };
  const result = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(anchorOutline) });
  assert.equal(result.applied, true);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.outline.anchor_continuity'));
});

test('outline chapter patch updates one chapter', () => {
  const dir = tempDir();
  initProject({ name: 'patch test', dir, parts: 1, volumes: 1, chapter: 2 });
  let project = loadProject(dir);
  writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(outline) });
  project = loadProject(dir);
  const result = writeArtifact(project, {
    section: 'outline', mode: 'patch', target: 'chapter', id: 'P1-V1-C1', apply: true,
    content: JSON.stringify({ summary: '修订后的第一章摘要' }),
  });
  assert.equal(result.applied, true);
  const saved = readSection(loadProject(dir), 'outline', { id: 'P1-V1-C1' }).chapter;
  assert.equal(saved.summary, '修订后的第一章摘要');
});

test('a character who left cannot appear later without a return', () => {
  const dir = tempDir();
  initProject({ name: 'absence test', dir, parts: 1, volumes: 1, chapter: 2 });
  const project = loadProject(dir);
  const absenceOutline = JSON.parse(JSON.stringify(outline));
  absenceOutline.parts[0].volumes = [absenceOutline.parts[0].volumes[0]];
  absenceOutline.parts[0].volumes[0].chapters[0].events = [{
    type: 'character', characters: ['孟启明', '沈观衡'], subject: '沈观衡', change: 'leave',
    actor: '沈观衡', action: 'leave', target: '沈观衡', target_type: 'character',
  }];
  absenceOutline.parts[0].volumes[0].chapters[1].characters = ['孟启明', '沈观衡'];
  absenceOutline.parts[0].volumes[0].chapters[1].events = [{
    type: 'status', characters: ['孟启明'], subject: '航线', change: 'changed',
    actor: '孟启明', action: 'set', target: '航线', target_type: 'status',
  }];
  const result = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(absenceOutline) });
  assert.equal(result.applied, true);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.outline.character_absent_return'));
});

test('provocation, law and event draws are available', () => {
  for (const type of ['provocation', 'law', 'event']) {
    const draw = drawIdeas({ type, count: 2, seed: 9 });
    assert.equal(draw.count, 2);
    assert.ok(draw.results.every((item) => item.title));
  }
});

test('legacy novel.json structure fields are normalized', () => {
  const dir = tempDir();
  initProject({ name: 'legacy test', dir, parts: 1, volumes: 2, chapter: 3 });
  const configFile = path.join(dir, 'novel.json');
  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  delete config.structure;
  config.target_parts = 1;
  config.target_volumes = 2;
  config.target_chapters = 4;
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
  const project = loadProject(dir);
  assert.deepEqual(project.config.structure, { target_parts: 1, target_volumes: 2, target_chapters: 4 });
  assert.equal(projectStatus(project).structure.target_chapters, 4);
});

test('refresh rebuilds markdown companions', () => {
  const dir = tempDir();
  initProject({ name: 'refresh test', dir, parts: 1, volumes: 2, chapter: 2 });
  const project = loadProject(dir);
  writeArtifact(project, { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(setup) });
  writeArtifact(loadProject(dir), { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(outline) });
  fs.rmSync(path.join(dir, 'story', 'setup', 'story_setup.md'));
  fs.rmSync(path.join(dir, 'story', 'compose', 'outline.md'));
  const result = refreshProject(loadProject(dir));
  assert.ok(result.refreshed.includes('story/setup/story_setup.md'));
  assert.ok(result.refreshed.includes('story/compose/outline.md'));
  assert.ok(fs.existsSync(path.join(dir, 'story', 'setup', 'story_setup.md')));
  assert.ok(fs.existsSync(path.join(dir, 'story', 'compose', 'outline.md')));
});

test('event order must not go backwards', () => {
  const dir = tempDir();
  initProject({ name: 'event order', dir, parts: 1, volumes: 1, chapter: 2 });
  const project = loadProject(dir);
  const ordered = JSON.parse(JSON.stringify(outline));
  ordered.parts[0].volumes = [ordered.parts[0].volumes[0]];
  ordered.parts[0].volumes[0].chapters[0].events = [
    { type: 'status', order: 2, characters: ['孟启明'], subject: '警报', change: 'started', actor: '孟启明', action: 'set', target: '警报', target_type: 'status' },
    { type: 'status', order: 1, characters: ['孟启明'], subject: '名单', change: 'found', actor: '孟启明', action: 'set', target: '名单', target_type: 'status' },
  ];
  const result = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(ordered) });
  assert.equal(result.applied, true);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.outline.event_order'));
});

test('builtin custom rules are loaded', () => {
  const dir = tempDir();
  initProject({ name: 'rule test', dir, parts: 1, volumes: 1, chapter: 1 });
  const project = loadProject(dir);
  const text = `他突然醒来，发现一切都是梦。${'他把这个念头按下去，继续检查氧气。'.repeat(20)}`;
  writeArtifact(project, { section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true, content: text });
  const check = checkProject(loadProject(dir), { profile: 'custom', target: 'chapter', id: 'P1-V1-C1' });
  assert.ok(check.findings.some((item) => item.rule_id === 'builtin.no-deus-ex'));
});

test('ideas are deterministic', () => {
  const a = drawIdeas({ type: 'namecard', genre: '科幻', count: 5, seed: 42 });
  const b = drawIdeas({ type: 'namecard', genre: '科幻', count: 5, seed: 42 });
  assert.deepEqual(a.results.map((r) => r.name), b.results.map((r) => r.name));
  assert.equal(a.count, 5);
  assert.equal(a.meta.seed, 42);
});

test('guides expose schemas and workflows', () => {
  assert.ok(listWorkflows().some((w) => w.name === 'outline'));
  assert.ok(readWorkflow('outline').includes('#'));
  assert.ok(listReferences().some((r) => r.name === 'setup-schema'));
  assert.ok(readReference('setup-schema').includes('premises'));
});
