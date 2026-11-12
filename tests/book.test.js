import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { initProject, loadProject, projectStatus, projectState, auditProject, refreshProject, exportManuscript, doctorProject, saveIdeaDraw, saveImportedIdeas, saveResearchReport, ingestSource, discoverSources, searchSources, buildProjectGraph, projectRegistryStatus, registryOperations, cleanRegistry, abandonMystery, undoRegistryOperation, registryBackups, writeArtifact, readSection } from '../scripts/project.js';
import { checkProject, validateOutline, validateSetup } from '../scripts/schema.js';
import { drawIdeas, validateIdeaDraw } from '../scripts/ideas.js';
import { listWorkflows, readWorkflow, listReferences, readReference } from '../scripts/guides.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wishmachine-test-'));
}

function longChapter(title = '第一章') {
  return `# ${title}\n\n${'宋夜航在灯下抄册，墨迹未干。'.repeat(150)}`;
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
  writeArtifact(project, { section: 'chapter', mode: 'replace', apply: true, id: 'P1-V1-C1', content: longChapter() });
  project = loadProject(dir);
  const result = writeArtifact(project, { section: 'chapter', mode: 'replace', apply: true, id: 'P1-V1-C1', content: longChapter() });
  assert.equal(result.applied, true);
  project = loadProject(dir);
  const content = readSection(project, 'chapter', { id: 'P1-V1-C1' });
  assert.ok(content.content.includes('第一章'));
  const checkpointDir = path.join(dir, 'chapters', 'checkpoints');
  assert.ok(fs.readdirSync(checkpointDir).some((name) => name.endsWith('.md')));
  assert.ok(projectStatus(project).orphan_chapters.includes('P1-V1-C1'));
  assert.ok(projectState(project).state.orphan_chapters.includes('P1-V1-C1'));
  const audit = auditProject(project);
  assert.ok(audit.targets.some((target) => target.target === 'chapter' && target.id === 'P1-V1-C1'));
  const exported = exportManuscript(project);
  assert.equal(exported.format, 'book');
  assert.equal(exported.chapters, 1);
  const manuscript = fs.readFileSync(exported.output, 'utf8');
  assert.ok(manuscript.includes('第一章'));
  assert.ok(manuscript.includes('# 章节测试'));
  const append = writeArtifact(loadProject(dir), {
    section: 'chapter', id: 'P1-V1-C1', mode: 'append', apply: true,
    content: '附录内容。',
  });
  assert.equal(append.applied, true);
  assert.ok(readSection(loadProject(dir), 'chapter', { id: 'P1-V1-C1' }).content.includes('附录内容'));
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
  assert.ok(projectStatus(loadProject(dir)).orphan_recaps.includes('P1-V1-C1'));
  assert.ok(projectState(loadProject(dir)).state.orphan_recaps.includes('P1-V1-C1'));
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
  assert.ok(pack.results[0].storylines.length >= 1);
  assert.ok(pack.results[0].engine.artifact);
  assert.ok(pack.results[0].location.name);
  assert.ok(pack.results[0].faction.name);
  assert.ok(pack.results[0].equipment.name);
  assert.equal(pack.results[0].cast[0].role_tags[0], 'protagonist');
  assert.equal(pack.results[0].cast[1].role_tags[0], 'antagonist');
  assert.equal(pack.results[0].cast[2].role_tags[0], 'support');
  assert.equal(pack.results[0].cast[3].role_tags[0], 'support');
  assert.ok(pack.results[0].cast_relations.length >= 4);
  assert.ok(pack.results[0].cast_relations.some((relation) => relation.type === 'drives'));
  assert.ok(pack.results[0].cast_relations.some((relation) => relation.type === 'blocks'));
  assert.ok(pack.results[0].cast_relations.some((relation) => relation.type === 'supports'));
  assert.ok(pack.results[0].cast_relations.every((relation) => relation.stake));
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

test('project graph merges saved cards and rejects dangling relations', () => {
  const dir = tempDir();
  initProject({ name: 'graph test', dir, parts: 1, volumes: 1, chapter: 1 });
  const project = loadProject(dir);
  saveIdeaDraw(project, drawIdeas({ type: 'worldpack', genre: '修仙', count: 1, seed: 42 }));
  saveImportedIdeas(project, { results: [{ title: '外部来源', source: 'web', keywords: ['外源'] }] }, { type: 'source' });
  const graph = buildProjectGraph(project);
  assert.ok(graph.counts.entities > 0);
  assert.ok(graph.counts.relations > 0);
  assert.ok(graph.prompt.length > 0);
  assert.equal(graph.blocking, false);
  assert.ok(readSection(project, 'graph').graph.counts.entities > 0);
  assert.throws(() => saveImportedIdeas(project, {
    results: [{
      title: '坏图',
      graph: { entities: [{ id: 'a', type: 'x', label: 'A' }], relations: [{ from: 'a', to: 'missing', type: 'x' }] },
    }],
  }), /missing entity/);
});

test('source search maps Gutenberg results into source cards', async () => {
  const dir = tempDir();
  initProject({ name: 'search test', dir, parts: 1, volumes: 1, chapter: 1 });
  const project = loadProject(dir);
  const original = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      results: [{
        id: 84,
        title: 'Frankenstein',
        authors: [{ name: 'Mary Shelley' }],
        subjects: ['Gothic', 'Science'],
        formats: { 'text/html': 'https://www.gutenberg.org/ebooks/84.html' },
      }],
    }),
  });
  try {
    const result = await searchSources(project, { provider: 'gutenberg', query: 'Frankenstein', limit: 1 });
    assert.equal(result.count, 1);
    assert.equal(result.results[0].title, 'Frankenstein');
    assert.equal(result.results[0].source_url, 'https://www.gutenberg.org/ebooks/84.html');
    assert.ok(result.results[0].graph.entities.length >= 2);
    assert.ok(result.results[0].graph.relations.length >= 1);
    assert.ok(result.saved[0].id);
  } finally {
    global.fetch = original;
  }
});

test('web source ingestion creates a saved source card', async () => {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><title>测试史料</title><meta name="description" content="一段可核查的史料"><meta name="keywords" content="海船,失踪,日志"></head><body><h1>海船失踪</h1><p>船只被发现时货物完好。</p><a href="/related">相关档案</a></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const dir = tempDir();
    initProject({ name: 'ingest test', dir, parts: 1, volumes: 1, chapter: 1 });
    const project = loadProject(dir);
    const result = await ingestSource(project, `http://127.0.0.1:${address.port}/source`);
    assert.equal(result.results[0].title, '测试史料');
    assert.equal(result.results[0].source_url, `http://127.0.0.1:${address.port}/source`);
    assert.ok(result.results[0].keywords.includes('海船'));
    assert.ok(result.results[0].links.some((link) => link.label === '相关档案'));
    assert.ok(result.results[0].graph.relations.some((relation) => relation.type === 'links_to'));
    assert.ok(result.saved.id);
    const catalogPath = path.join(dir, 'catalog.json');
    fs.writeFileSync(catalogPath, JSON.stringify([{
      id: 'local', title: '本地史料', url: `http://127.0.0.1:${address.port}/local`, topics: ['history'], type: 'history',
    }]));
    const discovered = await discoverSources(project, { catalogPath, topic: 'history' });
    assert.equal(discovered.count, 1);
    assert.equal(discovered.results[0].id, 'local');
    assert.ok(discovered.results[0].ok);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('imported cards and research reports are persisted', () => {
  const dir = tempDir();
  initProject({ name: 'import test', dir, parts: 1, volumes: 1, chapter: 1 });
  const project = loadProject(dir);
  const imported = saveImportedIdeas(project, {
    results: [{ title: '敦煌藏经洞的封门', type: '历史事件', source: '测试来源' }],
  }, { type: 'motif', source: 'web' });
  assert.ok(imported.saved.id);
  assert.equal(imported.results[0].source, '测试来源');
  const loaded = readSection(project, 'idea', { id: imported.saved.id });
  assert.equal(loaded.draw.results[0].title, '敦煌藏经洞的封门');
  const report = saveResearchReport(project, imported.saved.id, {
    pack_id: imported.saved.id,
    entities: [{ id: 'e1', status: 'verified', source: '测试来源' }],
    relations: [],
  });
  assert.ok(report.path);
  const research = readSection(project, 'research', { id: imported.saved.id });
  assert.equal(research.report.entities[0].status, 'verified');
  assert.ok(projectState(project).state.research.some((item) => item.name === imported.saved.id));
});

test('outlinepack expands plot beats into chapters and a draft outline', () => {
  const draw = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10, scenes: 3, targetChars: 2000 });
  const outline = draw.results[0];
  assert.equal(outline.chapters.length, 10);
  assert.equal(outline.chapters[0].scenes.length, 3);
  assert.equal(outline.chapters[0].target_chars, 2000);
  const chapter10Index = outline.mystery_registry.findIndex((mystery) => mystery.chapter_id === 'P1-V1-C10');
  const chapter2Index = outline.mystery_registry.findIndex((mystery) => mystery.chapter_id === 'P1-V1-C2');
  assert.ok(chapter10Index > chapter2Index);
  assert.deepEqual(outline.chapters.map((chapter) => chapter.id), Array.from({ length: 10 }, (_, index) => `P1-V1-C${index + 1}`));
  assert.equal(outline.draft_outline.parts[0].volumes[0].chapters.length, 10);
  assert.ok(outline.draft_outline.parts[0].volumes[0].chapters[0].events.length > 0);
  assert.ok(outline.chapters[0].chapter_payoff.desire);
  assert.deepEqual(validateOutline(outline.draft_outline, { structure: {} }), []);
});

test('outlinepack expands into multiple volumes', () => {
  const draw = drawIdeas({
    type: 'outlinepack', genre: '修仙', count: 1, seed: 42,
    volumes: 3, chaptersPerVolume: 4, scenes: 3, targetChars: 2000,
  });
  const outline = draw.results[0];
  assert.equal(outline.volumes.length, 3);
  assert.equal(outline.chapters.length, 12);
  assert.equal(outline.chapter_config.volumes, 3);
  assert.equal(outline.chapter_config.chapters_per_volume, 4);
  assert.equal(outline.chapters[0].id, 'P1-V1-C1');
  assert.equal(outline.chapters[11].id, 'P1-V3-C4');
  assert.equal(outline.volumes[2].payoff_contract.big_win.length > 0, true);
  assert.ok(new Set(outline.volumes.map((volume) => volume.payoff_contract.big_win)).size > 1);
  assert.ok(outline.volumes[0].chapters.every((chapter) => chapter.beat_function !== 'resolution'));
  assert.ok(outline.volumes[2].chapters.some((chapter) => chapter.beat_function === 'resolution'));
  assert.ok(outline.volumes[0].opening_beat);
  assert.ok(outline.volumes[0].closing_beat);
  assert.ok(outline.volumes[0].mysteries.planted.length > 0);
  assert.ok(outline.volumes[0].timeline.anchor);
  assert.ok(outline.volumes[0].beat_map.length > 0);
  assert.ok(outline.chapters[0].obstacle);
  assert.ok(outline.chapters[0].mysteries.planted.length > 0);
  assert.ok(outline.chapters[11].mysteries.resolved.length > 0);
  assert.ok(outline.chapters[0].scenes[0].obstacle);
  assert.equal(outline.chapters[0].scenes[0].turn, 'choice');
  assert.equal(outline.chapters[0].scenes[2].turn, 'reversal');
  assert.ok(outline.chapters[0].scenes[0].stakes);
  assert.ok(outline.chapters[0].scenes[0].turn_event);
  assert.ok(outline.chapters[0].scenes[0].mysteries.planted.length > 0);
  assert.ok(outline.chapters[0].scenes[0].mysteries.planted[0].question);
  assert.ok(outline.chapters[0].scenes[2].mysteries.resolved.length > 0);
  assert.ok(outline.chapters[0].scenes[2].mysteries.resolved[0].answer);
  assert.ok(new Set(outline.chapters[0].scenes.map((scene) => scene.obstacle)).size > 1);
  assert.ok(new Set(outline.chapters[0].scenes.map((scene) => scene.goal)).size > 1);
  assert.ok(outline.chapters[0].scenes.every((scene) => scene.consequence));
  assert.ok(outline.chapters[0].scenes.every((scene) => scene.result === scene.consequence));
  assert.ok(outline.chapters[0].scenes[1].goal.includes('承接'));
  assert.ok(outline.chapters[0].scenes[1].mysteries.planted.length > 0);
  assert.equal(outline.chapters[0].scene_chain.length, 3);
  assert.equal(outline.chapters[0].scene_chain[1].turn, outline.chapters[0].scenes[1].turn_event);
  assert.equal(outline.chapters[1].entry_from_previous, outline.chapters[0].exit_consequence);
  assert.ok(outline.chapters[1].scenes[0].goal.includes('承接上一章'));
  assert.ok(outline.chapters[1].conflict.includes('承接上一章后果'));
  assert.ok(outline.chapters[1].obstacle.includes('上一章后果未解'));
  assert.ok(outline.chapters[1].mysteries.carried.length > 0);
  assert.ok(outline.chapters[1].mysteries.carried[0].id);
  assert.ok(outline.chapters[1].mysteries.carried[0].question);
  assert.ok(outline.chapters[1].mysteries.carried[0].importance);
  assert.ok(outline.chapters[1].mysteries.carried[0].thread);
  assert.ok(outline.chapters[1].mysteries.carried[0].related_cast.length > 0);
  assert.ok(outline.chapters[1].mysteries.carried.some((mystery) => mystery.thread_type === 'scene'));
  assert.ok(outline.chapters[1].mysteries.carried[0].thread.length > 0);
  assert.ok(outline.chapters[1].mysteries.carried[0].thread_id);
  assert.ok(outline.chapters[1].mysteries.carried[0].related_cast_ids.length > 0);
  assert.ok(outline.chapters[11].mysteries.resolved.length > 0);
  assert.ok(outline.chapters[11].mysteries.resolved[0].answer);
  assert.ok(outline.volumes[1].chapters[0].mysteries.carried.length > 0);
  assert.ok(outline.pending_mysteries.length <= 5);
  assert.ok(outline.chapters[1].scenes[0].obstacle.includes('上一章后果未解'));
  assert.ok(outline.chapters[1].chapter_payoff.pressure.includes('上一章留下的后果'));
  assert.ok(outline.chapters[0].chapter_payoff.hook.includes('下一章要处理'));
  assert.equal(outline.volumes[1].chapters[0].entry_from_previous, outline.volumes[0].chapters[3].exit_consequence);
  assert.ok(outline.setup_draft.storylines.length >= 2);
  assert.ok(outline.setup_draft.storylines.some((storyline) => storyline.type === 'subplot'));
  assert.ok(outline.setup_draft.storylines[0].thread_id);
  assert.ok(outline.thread_registry.length >= 2);
  assert.ok(outline.thread_registry.some((thread) => thread.id === outline.setup_draft.storylines[0].thread_id));
  assert.ok(outline.thread_registry.every((thread) => ['active', 'abandoned', 'resolved'].includes(thread.status)));
  assert.ok(outline.thread_registry.every((thread) => thread.status !== 'resolved' || thread.resolved_in));
  assert.ok(outline.chapters.every((chapter) => chapter.thread_id));
  assert.ok(outline.thread_registry.some((thread) => thread.status === 'resolved'));
  const resolvedThread = outline.thread_registry.find((thread) => thread.status === 'resolved');
  assert.ok(resolvedThread.resolved_mysteries.length > 0);
  assert.ok(resolvedThread.resolved_mysteries.every((mystery) => mystery.id && mystery.chapter_id));
  assert.ok(outline.mystery_registry.length > 0);
  assert.equal(outline.mystery_registry_version, 2);
  assert.equal(outline.thread_registry_version, 2);
  assert.equal(outline.setup_draft.mystery_registry_version, 2);
  const sortedRegistry = [...outline.mystery_registry].sort((a, b) => (
    String(a.chapter_id || '').localeCompare(String(b.chapter_id || ''), undefined, { numeric: true })
    || String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true })
  ));
  assert.deepEqual(outline.mystery_registry.map((mystery) => mystery.id), sortedRegistry.map((mystery) => mystery.id));
  assert.ok(outline.mystery_registry.some((mystery) => mystery.status === 'resolved'));
  assert.ok(outline.setup_draft.mystery_registry.length > 0);
  assert.equal(outline.draft_outline.mystery_registry.length, outline.mystery_registry.length);
  assert.ok(outline.setup_draft.core_cast[0].storyline_refs.includes(outline.setup_draft.storylines[0].thread_id));
  assert.equal(validateIdeaDraw({ results: [outline] }).ok, true);
  assert.equal(outline.setup_draft.premises[0].progression.length, 4);
  assert.ok(outline.setup_draft.world_timeline.length >= 2);
  assert.ok(outline.setup_draft.world_resources.every((resource) => ['能源', '消耗品', '材料', '货币'].includes(resource.category)));
  assert.ok(outline.setup_draft.project_name);
  assert.ok(outline.setup_draft.thread_registry.length >= 2);
  assert.equal(outline.draft_outline.thread_registry.length, outline.thread_registry.length);
  assert.deepEqual(validateSetup(outline.setup_draft), []);
  assert.deepEqual(validateOutline(outline.draft_outline, { structure: {} }), []);
  const badOutline = JSON.parse(JSON.stringify(outline.draft_outline));
  badOutline.parts[0].volumes[0].chapters[0].thread_id = 'missing-thread';
  assert.ok(validateOutline(badOutline, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.unknown_thread'));
});

test('long outlinepack records dropped mysteries', () => {
  const draw = drawIdeas({ type: 'outlinepack', genre: '修仙', count: 1, seed: 42, chapters: 30, scenes: 3 });
  const outline = draw.results[0];
  assert.ok(outline.dropped_mysteries.length > 0);
  assert.ok(outline.dropped_mysteries.every((mystery) => mystery.status === 'dropped'));
  assert.ok(outline.dropped_mysteries.every((mystery) => mystery.dropped_in));
  assert.ok(outline.dropped_mysteries.every((mystery) => mystery.abandoned_thread?.thread_id));
  assert.ok(outline.abandoned_threads.length > 0);
  assert.ok(outline.chapters.some((chapter) => chapter.mysteries.dropped.length > 0));
  const abandonedThread = outline.thread_registry.find((thread) => thread.abandoned_mysteries.length > 0);
  assert.ok(abandonedThread);
  const unlinked = JSON.parse(JSON.stringify(outline.draft_outline));
  unlinked.thread_registry.find((thread) => thread.id === abandonedThread.id).abandoned_mysteries = [];
  assert.ok(validateOutline(unlinked, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.abandonment_not_linked'));
});

test('idea validation rejects unknown thread ids', () => {
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  outline.chapters[0].mysteries.planted[0].thread_id = 'missing-thread';
  const result = validateIdeaDraw({ results: [outline] });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) => finding.rule_id === 'idea.thread.unknown_mystery_thread'));
});

test('outline validation checks thread resolution and abandoned threads', () => {
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  const bad = JSON.parse(JSON.stringify(outline.draft_outline));
  const resolved = bad.thread_registry.find((thread) => thread.status === 'resolved');
  assert.ok(resolved);
  const resolvedChapter = bad.parts[0].volumes[0].chapters.find((chapter) => chapter.id === resolved.resolved_in);
  resolvedChapter.mysteries.resolved = [];
  assert.ok(validateOutline(bad, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread_resolution_missing'));
  const abandoned = JSON.parse(JSON.stringify(outline.draft_outline));
  abandoned.thread_registry[0].status = 'abandoned';
  abandoned.abandoned_threads = [];
  assert.ok(validateOutline(abandoned, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.abandoned_thread_missing'));
  const unknownMystery = JSON.parse(JSON.stringify(outline.draft_outline));
  const resolvedThread = unknownMystery.thread_registry.find((thread) => thread.status === 'resolved');
  resolvedThread.resolved_mysteries[0].id = 'missing-mystery';
  assert.ok(validateOutline(unknownMystery, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.resolved_mystery_missing'));
  const missingRegistry = JSON.parse(JSON.stringify(outline.draft_outline));
  missingRegistry.mystery_registry = [];
  assert.ok(validateOutline(missingRegistry, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.mystery_not_in_registry'));
  const unsorted = JSON.parse(JSON.stringify(outline.draft_outline));
  unsorted.mystery_registry.reverse();
  assert.ok(validateOutline(unsorted, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.mystery.registry_order'));
  const unsortedThreads = JSON.parse(JSON.stringify(outline.draft_outline));
  unsortedThreads.thread_registry.reverse();
  assert.ok(validateOutline(unsortedThreads, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.registry_order'));
  const unsortedSetup = JSON.parse(JSON.stringify(outline.setup_draft));
  unsortedSetup.mystery_registry.reverse();
  assert.ok(validateSetup(unsortedSetup).some((finding) => finding.rule_id === 'quality.setup.mystery_registry.order'));
  const statusMismatch = JSON.parse(JSON.stringify(outline.draft_outline));
  const resolvedMystery = statusMismatch.mystery_registry.find((mystery) => mystery.status === 'resolved' && mystery.id.endsWith('-mystery-core'));
  resolvedMystery.status = 'open';
  assert.ok(validateOutline(statusMismatch, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.mystery.status_mismatch'));
  const stale = JSON.parse(JSON.stringify(outline.draft_outline));
  stale.mystery_registry.push({ id: 'stale-mystery', status: 'open' });
  assert.ok(validateOutline(stale, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.mystery.stale_registry'));
  const unlinked = JSON.parse(JSON.stringify(outline.draft_outline));
  const unlinkedThread = unlinked.thread_registry.find((thread) => thread.status === 'resolved');
  unlinkedThread.resolved_mysteries = [];
  assert.ok(validateOutline(unlinked, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.resolution_not_linked'));
  const unsortedLinks = JSON.parse(JSON.stringify(outline.draft_outline));
  const linkThread = unsortedLinks.thread_registry.find((thread) => thread.resolved_mysteries.length > 1);
  if (linkThread) {
    linkThread.resolved_mysteries.reverse();
    assert.ok(validateOutline(unsortedLinks, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.mystery_link_order'));
  }
  const duplicateLinks = JSON.parse(JSON.stringify(outline.draft_outline));
  const duplicateThread = duplicateLinks.thread_registry.find((thread) => thread.resolved_mysteries.length > 0);
  duplicateThread.resolved_mysteries.push(duplicateThread.resolved_mysteries[0]);
  assert.ok(validateOutline(duplicateLinks, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.mystery_link_duplicate'));
});

test('idea validation checks thread status consistency', () => {
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  const bad = JSON.parse(JSON.stringify(outline));
  bad.thread_registry[0].status = 'active';
  bad.thread_registry[0].resolved_in = 'P1-V1-C1';
  const active = validateIdeaDraw({ results: [bad] });
  assert.ok(active.findings.some((finding) => finding.rule_id === 'idea.thread.active_with_resolution'));
  const missing = JSON.parse(JSON.stringify(outline));
  missing.thread_registry[0].status = 'resolved';
  missing.thread_registry[0].resolved_in = 'missing-chapter';
  const resolved = validateIdeaDraw({ results: [missing] });
  assert.ok(resolved.findings.some((finding) => finding.rule_id === 'idea.thread.unknown_resolved_chapter'));
  const invalid = JSON.parse(JSON.stringify(outline));
  invalid.thread_registry[0].status = 'paused';
  assert.ok(validateIdeaDraw({ results: [invalid] }).findings.some((finding) => finding.rule_id === 'idea.thread.invalid_status'));
});

test('plotpack combines worldpack, cast relations and chapter beats', () => {
  const draw = drawIdeas({ type: 'plotpack', genre: '悬疑', count: 1, seed: 42 });
  assert.equal(draw.meta.deck, 'suspense');
  const plot = draw.results[0];
  assert.ok(plot.worldpack_id);
  assert.equal(plot.beats.length, 6);
  assert.deepEqual(plot.beats.map((beat) => beat.function), ['setup', 'inciting', 'midpoint', 'crisis', 'climax', 'resolution']);
  assert.ok(plot.cast.length >= 4);
  assert.ok(plot.cast_relations.length >= 4);
  assert.ok(plot.storyline.payoff);
  assert.ok(plot.prompt_pack.positive);
  assert.ok(plot.events.length === 6);
});

test('worldpack cast uses genre-aware archetypes', () => {
  const expected = {
    修仙: ['抄册执事', '剑冢散修', '掌册长老', '香火祠祝', '洗墨人', '巡册使'],
    悬疑: ['现场刑警', '记忆鉴定师', '承办检察官', '职业证人', '档案员', '辩护律师'],
    都市: ['被合同锁住的主播', '被竞业协议困住的员工', '平台经理', '家族委员会主席', '租客互助会组织者', '财经记者'],
    历史: ['边镇书吏', '海商', '户部主事', '边军主将', '官匠', '史官'],
  };
  for (const [genre, names] of Object.entries(expected)) {
    const pack = drawIdeas({ type: 'worldpack', genre, count: 1, seed: 42 });
    assert.ok(pack.results[0].cast.every((character) => names.includes(character.archetype)));
  }
});

test('worldpacks include motifs and positive/negative prompt packs', () => {
  const pack = drawIdeas({ type: 'worldpack', genre: '修仙', count: 4, seed: 42 });
  const paper = pack.results.find((item) => item.theme === 'paper');
  assert.ok(paper);
  assert.equal(paper.motif.title, '画皮：借来的脸');
  assert.ok(paper.prompt_pack.positive.includes('画皮'));
  assert.ok(paper.prompt_pack.negative.includes('spaceships'));
  assert.ok(paper.prompt_pack.style.includes('东方玄幻'));
  assert.ok(paper.entities.some((entity) => entity.type === 'motif'));
  assert.ok(paper.relations.some((relation) => relation.type === 'inspired_by'));
});

test('genre decks cover suspense, urban and history', () => {
  for (const [genre, deck] of [['悬疑', 'suspense'], ['都市', 'urban'], ['历史', 'history']]) {
    const premise = drawIdeas({ type: 'premise', genre, count: 1, seed: 42 });
    assert.equal(premise.meta.deck, deck);
    assert.ok(premise.results[0].title);
    const pack = drawIdeas({ type: 'worldpack', genre, count: 1, seed: 42 });
    assert.equal(pack.meta.deck, deck);
    assert.ok(pack.results[0].engine);
    assert.ok(pack.results[0].location);
  }
});

test('checkProject reports setup/outline thread registry drift', () => {
  const dir = tempDir();
  initProject({ name: 'registry drift', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const clean = checkProject(project, { profile: 'schema', target: 'outline' });
  assert.equal(clean.findings.length, 0);
  const setupFile = path.join(dir, 'story', 'setup', 'story_setup.json');
  const setup = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
  setup.thread_registry.pop();
  fs.writeFileSync(setupFile, JSON.stringify(setup, null, 2));
  const drifted = checkProject(project, { profile: 'schema', target: 'outline' });
  assert.ok(drifted.findings.some((finding) => finding.rule_id === 'quality.thread.registry_missing_setup'));
});

test('doctor --fix migrates old projects to thread_registry', () => {
  const dir = tempDir();
  initProject({ name: 'old project', dir, parts: 1, volumes: 1, chapter: 3 });
  const project = loadProject(dir);
  const setup = {
    project_name: 'old project',
    genres: ['悬疑'],
    premise: '旧项目前提',
    theme: '旧项目主题',
    storylines: [{ name: '主线' }, { name: '副线' }],
  };
  const outline = {
    parts: [{
      id: 'P1', title: '旧卷', summary: '旧卷摘要',
      volumes: [{
        id: 'P1-V1', title: '第一卷', summary: '第一卷摘要',
        chapters: [1, 2, 3].map((number) => ({
          id: `P1-V1-C${number}`,
          title: `第${number}章`,
          summary: number === 2 ? '副线章节' : '章节摘要',
          characters: [],
          location: '地点',
          events: [],
          conflict: '冲突',
          pacing: 'rising',
        })),
      }],
    }],
  };
  fs.writeFileSync(path.join(dir, 'story', 'setup', 'story_setup.json'), JSON.stringify(setup, null, 2));
  fs.writeFileSync(path.join(dir, 'story', 'compose', 'outline.json'), JSON.stringify(outline, null, 2));
  const report = doctorProject(project, { fix: true });
  assert.equal(report.fixed, true);
  const migratedSetup = JSON.parse(fs.readFileSync(path.join(dir, 'story', 'setup', 'story_setup.json'), 'utf8'));
  const migratedOutline = JSON.parse(fs.readFileSync(path.join(dir, 'story', 'compose', 'outline.json'), 'utf8'));
  assert.equal(migratedSetup.thread_registry.length, 2);
  assert.equal(migratedSetup.thread_registry_version, 2);
  assert.equal(migratedSetup.mystery_registry_version, 2);
  assert.equal(migratedSetup.storylines[0].thread_id, 'thread-1');
  assert.equal(migratedOutline.thread_registry.length, 2);
  assert.equal(migratedOutline.parts[0].volumes[0].chapters[0].thread_id, 'thread-1');
  assert.equal(migratedOutline.parts[0].volumes[0].chapters[1].thread_id, 'thread-2');
});

test('doctor --fix repairs setup/outline registry drift', () => {
  const dir = tempDir();
  initProject({ name: 'registry repair', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const outlineFile = path.join(dir, 'story', 'compose', 'outline.json');
  const tampered = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  tampered.thread_registry.pop();
  fs.writeFileSync(outlineFile, JSON.stringify(tampered, null, 2));
  const report = doctorProject(project, { fix: true });
  assert.equal(report.fixed, true);
  const setup = JSON.parse(fs.readFileSync(path.join(dir, 'story', 'setup', 'story_setup.json'), 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  assert.equal(JSON.stringify(setup.thread_registry), JSON.stringify(repaired.thread_registry));
});

test('doctor --fix repairs thread status from resolved mysteries', () => {
  const dir = tempDir();
  initProject({ name: 'thread status repair', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const setupFile = path.join(dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(dir, 'story', 'compose', 'outline.json');
  for (const file of [setupFile, outlineFile]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.thread_registry[0].status = 'active';
    doc.thread_registry[0].resolved_in = null;
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  const report = doctorProject(project, { fix: true });
  assert.equal(report.fixed, true);
  const repairedSetup = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
  const repairedOutline = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  assert.equal(repairedSetup.thread_registry[0].status, 'resolved');
  assert.equal(repairedOutline.thread_registry[0].status, 'resolved');
  assert.ok(repairedSetup.thread_registry[0].resolved_in);
});

test('doctor --fix downgrades resolved threads without a resolved mystery', () => {
  const dir = tempDir();
  initProject({ name: 'thread downgrade', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const setupFile = path.join(dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(dir, 'story', 'compose', 'outline.json');
  const doc = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  const thread = doc.thread_registry.find((item) => item.status === 'resolved');
  for (const chapter of doc.parts[0].volumes[0].chapters) {
    chapter.mysteries.resolved = (chapter.mysteries.resolved || []).filter((item) => item.thread_id !== thread.id);
    for (const scene of chapter.scenes || []) {
      scene.mysteries.resolved = (scene.mysteries.resolved || []).filter((item) => item.thread_id !== thread.id);
    }
  }
  fs.writeFileSync(outlineFile, JSON.stringify(doc, null, 2));
  const setup = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
  setup.thread_registry.find((item) => item.id === thread.id).status = 'resolved';
  setup.thread_registry.find((item) => item.id === thread.id).abandoned_history = false;
  fs.writeFileSync(setupFile, JSON.stringify(setup, null, 2));
  const outlineDoc = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  outlineDoc.thread_registry.find((item) => item.id === thread.id).abandoned_history = false;
  fs.writeFileSync(outlineFile, JSON.stringify(outlineDoc, null, 2));
  doctorProject(project, { fix: true });
  const repaired = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  assert.equal(repaired.thread_registry.find((item) => item.id === thread.id).status, 'active');
});

test('doctor --fix fills missing mystery registry', () => {
  const dir = tempDir();
  initProject({ name: 'mystery migration', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const setupFile = path.join(dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(dir, 'story', 'compose', 'outline.json');
  for (const file of [setupFile, outlineFile]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete doc.mystery_registry;
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  doctorProject(project, { fix: true });
  const setup = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  assert.ok(setup.mystery_registry.length > 0);
  assert.ok(repaired.mystery_registry.length > 0);
  assert.equal(setup.mystery_registry.length, repaired.mystery_registry.length);
});

test('doctor --fix removes stale mystery registry entries', () => {
  const dir = tempDir();
  initProject({ name: 'stale mystery', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const setupFile = path.join(dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(dir, 'story', 'compose', 'outline.json');
  for (const file of [setupFile, outlineFile]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.mystery_registry.push({ id: 'stale-mystery', status: 'open' });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  doctorProject(project, { fix: true });
  const setup = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  assert.ok(!setup.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
  assert.ok(!repaired.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
});

test('doctor --fix sorts registry arrays', () => {
  const dir = tempDir();
  initProject({ name: 'registry order', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const setupFile = path.join(dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(dir, 'story', 'compose', 'outline.json');
  for (const file of [setupFile, outlineFile]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.thread_registry.reverse();
    doc.mystery_registry.reverse();
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  doctorProject(project, { fix: true });
  const setup = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  assert.equal(setup.thread_registry[0].type, 'main');
  assert.ok(setup.mystery_registry.every((mystery, index, list) => index === 0 || String(list[index - 1].chapter_id).localeCompare(String(mystery.chapter_id), undefined, { numeric: true }) <= 0));
  assert.deepEqual(setup.thread_registry.map((thread) => thread.id), repaired.thread_registry.map((thread) => thread.id));
});

test('project registry status summarizes setup and outline registries', () => {
  const dir = tempDir();
  initProject({ name: 'registry status', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const status = projectRegistryStatus(project);
  assert.equal(status.ok, true);
  assert.equal(status.setup.thread_registry_version, 2);
  assert.equal(status.outline.thread_registry_version, 2);
  assert.ok(status.setup.thread_count > 0);
  assert.ok(status.outline.mystery_count > 0);
});

test('book registry clean removes stale registry entries', () => {
  const dir = tempDir();
  initProject({ name: 'registry clean', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const setupFile = path.join(dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(dir, 'story', 'compose', 'outline.json');
  for (const file of [setupFile, outlineFile]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.mystery_registry.push({ id: 'stale-mystery', status: 'open' });
    doc.thread_registry[0].resolved_mysteries.push({ id: 'stale-mystery', chapter_id: 'P1-V1-C1' });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  const dryRun = cleanRegistry(project, { dryRun: true });
  assert.equal(dryRun.dryRun, true);
  assert.ok(dryRun.removed.includes('stale-mystery'));
  assert.ok(dryRun.removedLinks > 0);
  const before = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  assert.ok(before.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
  const result = cleanRegistry(project);
  assert.equal(result.ok, true);
  assert.ok(result.removed.includes('stale-mystery'));
  assert.ok(result.removedLinks > 0);
  const setup = JSON.parse(fs.readFileSync(setupFile, 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  assert.ok(!setup.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
  assert.ok(!repaired.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
  assert.equal(setup.mystery_registry_version, 2);
});

test('book registry abandon marks a mystery as manually dropped', () => {
  const dir = tempDir();
  initProject({ name: 'manual abandon', dir, parts: 1, volumes: 1, chapter: 10 });
  const project = loadProject(dir);
  const outline = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 10 }).results[0];
  writeArtifact(project, { section: 'setup', content: JSON.stringify(outline.setup_draft), apply: true });
  writeArtifact(project, { section: 'outline', content: JSON.stringify(outline.draft_outline), apply: true });
  const outlineFile = path.join(dir, 'story', 'compose', 'outline.json');
  const before = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  const target = before.mystery_registry.find((mystery) => mystery.status === 'resolved');
  assert.ok(target);
  const dryRun = abandonMystery(project, target.id, '作者决定放弃', { dryRun: true });
  assert.equal(dryRun.dryRun, true);
  assert.equal(JSON.parse(fs.readFileSync(outlineFile, 'utf8')).mystery_registry.find((mystery) => mystery.id === target.id).status, 'resolved');
  const result = abandonMystery(project, target.id, '作者决定放弃');
  assert.equal(result.ok, true);
  assert.equal(result.reason, '作者决定放弃');
  const after = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  const dropped = after.mystery_registry.find((mystery) => mystery.id === target.id);
  assert.equal(dropped.status, 'dropped');
  assert.equal(dropped.reason, '作者决定放弃');
  assert.ok(after.parts[0].volumes[0].chapters.some((chapter) => chapter.mysteries.dropped.some((mystery) => mystery.id === target.id)));
  assert.ok(projectRegistryStatus(project).operations.some((operation) => operation.action === 'abandon' && operation.id === target.id));
  assert.ok(registryBackups(project).count > 0);
  const pruned = registryBackups(project, { keep: 1, prune: true });
  assert.ok(pruned.count <= 1);
  assert.ok(registryOperations(project, { limit: 20 }).operations.some((operation) => operation.action === 'abandon'));
  assert.ok(registryOperations(project, { action: 'abandon' }).operations.every((operation) => operation.action === 'abandon'));
  assert.ok(!registryOperations(project, { action: 'clean' }).operations.some((operation) => operation.action === 'abandon'));
  const undo = undoRegistryOperation(project, {
    operationId: registryOperations(project, { action: 'abandon' }).operations.at(-1).id,
  });
  assert.equal(undo.action, 'undo');
  const restored = JSON.parse(fs.readFileSync(outlineFile, 'utf8'));
  assert.equal(restored.mystery_registry.find((mystery) => mystery.id === target.id).status, 'resolved');
});

test('saved idea draws are readable from the project', () => {
  const dir = tempDir();
  initProject({ name: 'idea store', dir, parts: 1, volumes: 1, chapter: 1 });
  const project = loadProject(dir);
  const draw = drawIdeas({ type: 'worldpack', genre: '修仙', count: 1, seed: 42 });
  assert.ok(draw.results[0].graph.entities.length > 0);
  assert.ok(draw.results[0].graph.relations.length > 0);
  assert.ok(draw.results[0].keywords.length > 0);
  assert.ok(draw.results[0].prompt.length > 0);
  const saved = saveIdeaDraw(project, draw);
  assert.ok(saved.saved.id);
  assert.ok(fs.existsSync(path.join(dir, 'story', 'ideas', `${saved.saved.id}.json`)));
  const listed = readSection(project, 'ideas');
  assert.ok(listed.results.some((item) => item.id === saved.saved.id));
  const loaded = readSection(project, 'idea', { id: saved.saved.id });
  assert.equal(loaded.draw.query.seed, 42);
  assert.ok(projectState(project).state.ideas.some((item) => item.name === saved.saved.id));
});

test('genre-aware ideas use the xianxia deck', () => {
  const xianxia = drawIdeas({ type: 'premise', genre: '修仙', count: 2, seed: 42 });
  assert.equal(xianxia.meta.deck, 'xianxia');
  assert.ok(xianxia.results.some((item) => /命册|剑冢|香火|清册|渡劫|纸人/.test(item.title)));
  const scifi = drawIdeas({ type: 'premise', genre: '科幻', count: 2, seed: 42 });
  assert.equal(scifi.meta.deck, 'default');
});

test('short chapters are rejected by the minimum length contract', () => {
  const dir = tempDir();
  initProject({ name: 'length test', dir, parts: 1, volumes: 1, chapter: 1 });
  const project = loadProject(dir);
  const result = writeArtifact(project, {
    section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true,
    content: '# 第一章\n\n太短了。',
  });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.chapter.length' && item.severity === 'high'));
  assert.equal(fs.existsSync(path.join(dir, 'chapters', 'P1-V1-C1.md')), false);
});

test('recaps copied from outline events are flagged', () => {
  const dir = tempDir();
  initProject({ name: 'recap copy test', dir, parts: 1, volumes: 1, chapter: 2 });
  const project = loadProject(dir);
  const copyOutline = JSON.parse(JSON.stringify(outline));
  copyOutline.parts[0].volumes = [copyOutline.parts[0].volumes[0]];
  copyOutline.parts[0].volumes[0].chapters[0].events = [{
    actor: '孟启明', action: 'discover', target: '名单', target_type: 'item', details: '发现名单',
  }];
  writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(copyOutline) });
  const recap = {
    chapter_id: 'P1-V1-C1', title: '封锁令', location: '砚港', time: '封锁前夜',
    present: ['孟启明'], plot_beats: ['孟启明：发现名单'], decisions: [], reveals: [],
    unresolved: [], promises: [], items: [], status: [], last_line: '他把名单折进内袋。',
  };
  const result = writeArtifact(loadProject(dir), {
    section: 'recap', id: 'P1-V1-C1', mode: 'replace', apply: true, content: JSON.stringify(recap),
  });
  assert.equal(result.applied, true);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.recap.outline_copy'));
});

test('provocation, law, event, engine, storyline, location, faction, equipment and motif draws are available', () => {
  for (const type of ['provocation', 'law', 'event', 'engine', 'storyline', 'location', 'faction', 'equipment', 'motif']) {
    const draw = drawIdeas({ type, count: 2, seed: 9 });
    assert.equal(draw.count, 2);
    assert.ok(draw.results.every((item) => item.title || item.name));
  }
  assert.ok(drawIdeas({ type: 'engine', count: 1, seed: 9 }).results[0].artifact);
  assert.ok(drawIdeas({ type: 'motif', count: 1, seed: 9 }).results[0].source);
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

test('end-to-end project flow', () => {
  const dir = tempDir();
  initProject({ name: 'E2E', dir, parts: 1, volumes: 1, chapter: 2 });
  let project = loadProject(dir);
  writeArtifact(project, { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(setup) });
  project = loadProject(dir);
  writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(outline) });
  project = loadProject(dir);
  const chapterText = `# 封锁令\n\n${'孟启明在砚港逐页核对撤离名单，发现每一页的时间戳都比虫潮预警早三天。'.repeat(100)}\n\n他把名单折进内袋，决定先去找调度处。`;
  writeArtifact(project, { section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true, content: chapterText });
  project = loadProject(dir);
  const recap = {
    chapter_id: 'P1-V1-C1', title: '封锁令', location: '砚港', time: '封锁前夜',
    present: ['孟启明'], plot_beats: ['孟启明发现名单时间戳异常'], decisions: ['去找调度处'],
    reveals: ['名单早于预警'], unresolved: ['谁改了名单'], promises: [], items: ['名单'],
    status: ['警觉'], last_line: '他把名单折进内袋，决定先去找调度处。', cliffhanger: '',
  };
  writeArtifact(project, { section: 'recap', id: 'P1-V1-C1', mode: 'replace', apply: true, content: JSON.stringify(recap) });
  project = loadProject(dir);
  const check = checkProject(project, { profile: 'all', target: 'chapter', id: 'P1-V1-C1' });
  assert.equal(check.blocking, false);
  const exported = exportManuscript(project);
  assert.equal(exported.chapters, 1);
  const bookText = fs.readFileSync(exported.output, 'utf8');
  assert.ok(bookText.includes('## 目录'));
  assert.ok(bookText.includes('## 第一卷'));
  assert.ok(bookText.includes('孟启明'));
  const audit = auditProject(project);
  assert.equal(audit.blocking, false);
  assert.ok(projectState(project).state.orphan_recaps.length === 0);
});

test('doctor reports invalid JSON without throwing', () => {
  const dir = tempDir();
  initProject({ name: 'doctor invalid', dir, parts: 1, volumes: 1, chapter: 1 });
  fs.writeFileSync(path.join(dir, 'story', 'compose', 'outline.json'), '{not json');
  fs.writeFileSync(path.join(dir, 'story', 'craft', 'character.json'), '{also bad');
  const result = doctorProject(loadProject(dir));
  assert.equal(result.blocking, true);
  assert.ok(result.issues.some((issue) => issue.code === 'artifact.invalid_json'));
  assert.ok(result.issues.some((issue) => String(issue.message).includes('character.json')));
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
  const text = `他突然醒来，发现一切都是梦。${'他把这个念头按下去，继续检查氧气，记录时辰。'.repeat(120)}`;
  writeArtifact(project, { section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true, content: text });
  const check = checkProject(loadProject(dir), { profile: 'custom', target: 'chapter', id: 'P1-V1-C1' });
  assert.ok(check.findings.some((item) => item.rule_id === 'builtin.no-deus-ex'));
});

test('project custom rule blocks candidate write', () => {
  const dir = tempDir();
  initProject({ name: 'custom rule write', dir, parts: 1, volumes: 1, chapter: 1 });
  const ruleDir = path.join(dir, '.wishmachine', 'rules');
  fs.mkdirSync(ruleDir, { recursive: true });
  fs.writeFileSync(path.join(ruleDir, 'forbidden.json'), JSON.stringify({
    id: 'project.forbidden', target: 'chapter', severity: 'high', kind: 'contains', pattern: '禁忌', message: 'forbidden word',
  }));
  const project = loadProject(dir);
  const result = writeArtifact(project, {
    section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true,
    content: `这里出现了禁忌。${'正常的正文继续推进。'.repeat(20)}`,
  });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'project.forbidden'));
  assert.equal(fs.existsSync(path.join(dir, 'chapters', 'P1-V1-C1.md')), false);
});

test('placeholder custom rule applies to setup', () => {
  const dir = tempDir();
  initProject({ name: 'placeholder test', dir, parts: 1, volumes: 1, chapter: 1 });
  const project = loadProject(dir);
  const placeholder = { ...setup, premise: '待填写' };
  const result = writeArtifact(project, { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(placeholder) });
  assert.equal(result.applied, true);
  const check = checkProject(loadProject(dir), { profile: 'custom', target: 'setup' });
  assert.ok(check.findings.some((item) => item.rule_id === 'builtin.no-placeholder'));
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
