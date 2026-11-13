// Project lifecycle: init/load/status/state, audit, refresh, doctor, guides and
// the artifact readers that do not write. Write paths live in write.test.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  initProject, loadProject, projectStatus, projectState, auditProject, refreshProject,
  doctorProject, saveIdeaDraw, saveImportedIdeas, saveResearchReport, readSection, writeArtifact,
  exportManuscript,
} from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import { listWorkflows, readWorkflow, listReferences, readReference } from '../scripts/guides.js';
import {
  fixtureSet, longChapter, drawCached, sampleSetup, sampleOutline, sampleRecap,
} from './fixtures.js';

const { tempDir, tempProject } = fixtureSet('wishmachine-core-');

test('init, status, write setup/outline and check', (t) => {
  const { dir, project } = tempProject(t, { init: { volumes: 2, chapter: 2, genre: '科幻' } });
  assert.ok(fs.existsSync(path.join(dir, 'novel.json')));
  assert.equal(projectStatus(project).setup, false);

  const setupResult = writeArtifact(project, { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(sampleSetup()) });
  assert.equal(setupResult.applied, true);
  const afterSetup = loadProject(dir);
  assert.equal(projectStatus(afterSetup).setup, true);

  const outlineResult = writeArtifact(afterSetup, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(sampleOutline()) });
  assert.equal(outlineResult.applied, true);
  const loaded = loadProject(dir);
  const status = projectStatus(loaded);
  assert.equal(status.outline.volumes, 2);
  assert.equal(status.outline.chapters, 4);
  assert.equal(status.next.stage, 'write');
  const state = projectState(loaded);
  assert.equal(state.state.chapter_count, 4);
  assert.equal(state.state.setup.cast[0].name, '孟启明');
  const audit = auditProject(loaded);
  assert.ok(audit.targets.some((target) => target.target === 'setup'));
  assert.ok(audit.targets.some((target) => target.target === 'outline'));

  const check = checkProject(loaded, { profile: 'all', target: 'outline' });
  assert.equal(check.blocking, false);
  assert.equal(check.summary.high, 0);
});

test('book init accepts a comma/、-separated genre list', (t) => {
  const dir = tempDir(t);
  const { config } = initProject({ name: 'genres', dir, genre: '科幻, 奇幻、悬疑/都市' });
  assert.deepEqual(config.genres, ['科幻', '奇幻', '悬疑', '都市']);
});

test('audit summary view returns totals and failing targets only', (t) => {
  const { dir } = tempProject(t, { name: 'audit summary' });
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(sampleSetup()) });
  const summary = auditProject(loadProject(dir), { view: 'summary' });
  assert.equal(summary.view, 'summary');
  assert.equal(summary.targets, undefined);
  assert.equal(summary.top_findings, undefined);
  assert.ok(Array.isArray(summary.failing_targets));
  assert.ok(summary.summary);
  const full = auditProject(loadProject(dir), { view: 'full' });
  assert.ok(Array.isArray(full.targets));
});

test('book init creates the full layout and rejects invalid structure flags', (t) => {
  const dir = tempDir(t);
  initProject({ name: 'layout', dir, parts: 1, volumes: 1, chapter: 2 });
  for (const sub of ['story/setup', 'story/compose', 'story/craft', 'story/recaps', 'chapters', 'drafts', 'logs']) {
    assert.ok(fs.existsSync(path.join(dir, sub)), `book init should create ${sub}`);
  }
  const report = doctorProject(loadProject(dir));
  assert.ok(!report.issues.some((issue) => issue.code === 'layout.missing_dir'), JSON.stringify(report.issues));
  assert.throws(() => initProject({ name: 'bad', dir: tempDir(t), parts: 'abc' }), /--parts must be a positive integer/);
  assert.throws(() => initProject({ name: 'bad', dir: tempDir(t), chapter: 0 }), /--chapter must be a positive integer/);
  assert.throws(() => initProject({ name: 'dup', dir }), /already exists/);
});

test('end-to-end project flow', (t) => {
  const { dir, project } = tempProject(t, { name: 'E2E' });
  writeArtifact(project, { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(sampleSetup()) });
  writeArtifact(loadProject(dir), { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(sampleOutline()) });
  const chapterText = `# 封锁令\n\n${'孟启明在砚港逐页核对撤离名单，发现每一页的时间戳都比虫潮预警早三天。'.repeat(100)}\n\n他把名单折进内袋，决定先去找调度处。`;
  writeArtifact(loadProject(dir), { section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true, content: chapterText });
  writeArtifact(loadProject(dir), {
    section: 'recap', id: 'P1-V1-C1', mode: 'replace', apply: true,
    content: JSON.stringify(sampleRecap({ decisions: ['去找调度处'], last_line: '他把名单折进内袋，决定先去找调度处。' })),
  });
  const loaded = loadProject(dir);
  const check = checkProject(loaded, { profile: 'all', target: 'chapter', id: 'P1-V1-C1' });
  assert.equal(check.blocking, false);
  const exported = exportManuscript(loaded);
  assert.equal(exported.chapters, 1);
  const bookText = fs.readFileSync(exported.output, 'utf8');
  assert.ok(bookText.includes('## 目录'));
  assert.ok(bookText.includes('## 第一卷'));
  assert.ok(bookText.includes('孟启明'));
  const audit = auditProject(loaded);
  assert.equal(audit.blocking, false);
  assert.ok(projectState(loaded).state.orphan_recaps.length === 0);
  assert.equal(readSection(loaded, 'context').status.orphan_recaps.length, 0);
});

test('doctor reports invalid JSON without throwing', (t) => {
  const { dir } = tempProject(t, { name: 'doctor invalid' });
  fs.writeFileSync(path.join(dir, 'story', 'compose', 'outline.json'), '{not json');
  fs.writeFileSync(path.join(dir, 'story', 'craft', 'character.json'), '{also bad');
  const result = doctorProject(loadProject(dir));
  assert.equal(result.blocking, true);
  assert.ok(result.issues.some((issue) => issue.code === 'artifact.invalid_json'));
  assert.ok(result.issues.some((issue) => String(issue.message).includes('character.json')));
});

test('refresh rebuilds markdown companions', (t) => {
  const { dir } = tempProject(t, { name: 'refresh test', init: { volumes: 2, chapter: 2 } });
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(sampleSetup()) });
  writeArtifact(loadProject(dir), { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(sampleOutline()) });
  fs.rmSync(path.join(dir, 'story', 'setup', 'story_setup.md'));
  fs.rmSync(path.join(dir, 'story', 'compose', 'outline.md'));
  const result = refreshProject(loadProject(dir));
  assert.ok(result.refreshed.includes('story/setup/story_setup.md'));
  assert.ok(result.refreshed.includes('story/compose/outline.md'));
  assert.ok(fs.existsSync(path.join(dir, 'story', 'setup', 'story_setup.md')));
  assert.ok(fs.existsSync(path.join(dir, 'story', 'compose', 'outline.md')));
});

test('saved idea draws are readable from the project', (t) => {
  const { dir, project } = tempProject(t, { name: 'idea store', init: { chapter: 1 } });
  const draw = drawCached({ type: 'worldpack', genre: '修仙', count: 1, seed: 42 });
  assert.ok(draw.results[0].graph.entities.length > 0);
  assert.ok(draw.results[0].graph.relations.length > 0);
  assert.ok(draw.results[0].keywords.length > 0);
  assert.ok(draw.results[0].prompt_pack.positive.length > 0);
  const saved = saveIdeaDraw(project, draw);
  assert.ok(saved.saved.id);
  assert.ok(fs.existsSync(path.join(dir, 'story', 'ideas', `${saved.saved.id}.json`)));
  const listed = readSection(project, 'ideas');
  assert.ok(listed.results.some((item) => item.id === saved.saved.id));
  const loaded = readSection(project, 'idea', { id: saved.saved.id });
  assert.equal(loaded.draw.query.seed, 42);
  assert.ok(projectState(project).state.ideas.some((item) => item.name === saved.saved.id));
});

test('imported cards and research reports are persisted', (t) => {
  const { project } = tempProject(t, { name: 'import test', init: { chapter: 1 } });
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

test('guides expose schemas and workflows', () => {
  assert.ok(listWorkflows().some((workflow) => workflow.name === 'outline'));
  assert.ok(readWorkflow('outline').includes('#'));
  assert.ok(listReferences().some((reference) => reference.name === 'setup-schema'));
  assert.ok(readReference('setup-schema').includes('premises'));
});

test('chapter read returns file content and rejects unknown ids', (t) => {
  const { dir, project } = tempProject(t, { name: 'chapter read', init: { chapter: 1 } });
  writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify({ parts: [{ id: 'P1', title: '第', volumes: [{ id: 'P1-V1', title: '卷', chapters: [{ id: 'P1-V1-C1', title: '章', summary: 's' }] }] }] }) });
  writeArtifact(loadProject(dir), { section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true, content: longChapter() });
  const chapter = readSection(loadProject(dir), 'chapter', { id: 'P1-V1-C1' });
  assert.ok(chapter.content.includes('第一章'));
  assert.throws(() => readSection(loadProject(dir), 'chapter', { id: 'missing' }), /chapter not found/);
});
