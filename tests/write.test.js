// Artifact write path: every section (setup/outline/chapter/craft/recap), the
// blocking rules that refuse a write, checkpoints, and post-write warnings.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadProject, writeArtifact, readSection, projectStatus, projectState, auditProject,
  exportManuscript,
} from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import {
  fixtureSet, longChapter, outlinepack, sampleSetup, sampleOutline, sampleRecap,
} from './fixtures.js';

const { tempProject } = fixtureSet('wishmachine-write-');

test('chapter write and read', (t) => {
  const { dir } = tempProject(t, { name: '章节测试', init: { chapter: 1 } });
  writeArtifact(loadProject(dir), { section: 'chapter', mode: 'replace', apply: true, id: 'P1-V1-C1', content: longChapter() });
  const result = writeArtifact(loadProject(dir), { section: 'chapter', mode: 'replace', apply: true, id: 'P1-V1-C1', content: longChapter() });
  assert.equal(result.applied, true);
  const project = loadProject(dir);
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

test('craft and recap schema checks', (t) => {
  const { dir } = tempProject(t, { name: 'craft test', init: { chapter: 1 } });
  const craft = {
    name: '孟启明',
    appearance: '瘦削，手指有旧伤。',
    personality: ['冷静', '固执'],
    background: '在第一次救援失败后，把所有遇难者姓名写进私人日志。',
    motivation: '把下一次伤亡数字压到最低。',
    role_in_story: 'protagonist',
  };
  const craftResult = writeArtifact(loadProject(dir), { section: 'craft', target: 'character', mode: 'replace', apply: true, content: JSON.stringify(craft) });
  assert.equal(craftResult.applied, true);
  assert.equal(checkProject(loadProject(dir), { profile: 'all', target: 'craft', id: 'character' }).ok, true);

  const recapResult = writeArtifact(loadProject(dir), { section: 'recap', id: 'P1-V1-C1', mode: 'replace', apply: true, content: JSON.stringify(sampleRecap()) });
  assert.equal(recapResult.applied, true);
  assert.equal(checkProject(loadProject(dir), { profile: 'all', target: 'recap', id: 'P1-V1-C1' }).ok, true);
  assert.ok(projectStatus(loadProject(dir)).orphan_recaps.includes('P1-V1-C1'));
  assert.ok(projectState(loadProject(dir)).state.orphan_recaps.includes('P1-V1-C1'));
});

test('item usage before acquisition is blocking', (t) => {
  const { project } = tempProject(t, { name: 'item test' });
  const badOutline = sampleOutline();
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

test('resource ledger arithmetic is checked', (t) => {
  const { project } = tempProject(t, { name: 'ledger test' });
  const badOutline = sampleOutline();
  badOutline.parts[0].volumes = [badOutline.parts[0].volumes[0]];
  badOutline.parts[0].volumes[0].chapters[1].resource_ledger = [{ item: '氧气', start: 10, delta: -3, end: 9, reason: '泄漏' }];
  const result = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(badOutline) });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.outline.resource_ledger' && item.severity === 'high'));
});

test('recap chapter id mismatch is blocking', (t) => {
  const { dir, project } = tempProject(t, { name: 'recap test' });
  writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(sampleOutline()) });
  const result = writeArtifact(loadProject(dir), {
    section: 'recap', id: 'P1-V1-C1', mode: 'replace', apply: true,
    content: JSON.stringify(sampleRecap({ chapter_id: 'P1-V1-C2' })),
  });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.recap.chapter_id' && item.severity === 'high'));
});

test('a character who died cannot appear later without revival', (t) => {
  const { project } = tempProject(t, { name: 'death test' });
  const deathOutline = sampleOutline();
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

test('state anchor spirit stones must match the previous ledger end', (t) => {
  const { project } = tempProject(t, { name: 'anchor test' });
  const anchorOutline = sampleOutline();
  anchorOutline.parts[0].volumes = [anchorOutline.parts[0].volumes[0]];
  anchorOutline.parts[0].volumes[0].chapters[0].resource_ledger = [{ item: '灵石', start: 10, delta: -5, end: 5 }];
  anchorOutline.parts[0].volumes[0].chapters[1].state_anchor = { spirit_stones: 9, allies: ['孟启明'] };
  const result = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(anchorOutline) });
  assert.equal(result.applied, true);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.outline.anchor_continuity'));
});

test('outline chapter patch updates one chapter', (t) => {
  const { dir, project } = tempProject(t, { name: 'patch test' });
  writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(sampleOutline()) });
  const result = writeArtifact(loadProject(dir), {
    section: 'outline', mode: 'patch', target: 'chapter', id: 'P1-V1-C1', apply: true,
    content: JSON.stringify({ summary: '修订后的第一章摘要' }),
  });
  assert.equal(result.applied, true);
  const saved = readSection(loadProject(dir), 'outline', { id: 'P1-V1-C1' }).chapter;
  assert.equal(saved.summary, '修订后的第一章摘要');
});

test('a character who left cannot appear later without a return', (t) => {
  const { project } = tempProject(t, { name: 'absence test' });
  const absenceOutline = sampleOutline();
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

test('short chapters are rejected by the minimum length contract', (t) => {
  const { dir, project } = tempProject(t, { name: 'length test', init: { chapter: 1 } });
  const result = writeArtifact(project, {
    section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true,
    content: '# 第一章\n\n太短了。',
  });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.chapter.length' && item.severity === 'high'));
  assert.equal(fs.existsSync(path.join(dir, 'chapters', 'P1-V1-C1.md')), false);
});

test('recaps copied from outline events are flagged', (t) => {
  const { dir, project } = tempProject(t, { name: 'recap copy test' });
  const copyOutline = sampleOutline();
  copyOutline.parts[0].volumes = [copyOutline.parts[0].volumes[0]];
  copyOutline.parts[0].volumes[0].chapters[0].events = [{
    actor: '孟启明', action: 'discover', target: '名单', target_type: 'item', details: '发现名单',
  }];
  writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(copyOutline) });
  const result = writeArtifact(loadProject(dir), {
    section: 'recap', id: 'P1-V1-C1', mode: 'replace', apply: true,
    content: JSON.stringify(sampleRecap({ plot_beats: ['孟启明：发现名单'] })),
  });
  assert.equal(result.applied, true);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.recap.outline_copy'));
});

test('event order must not go backwards', (t) => {
  const { project } = tempProject(t, { name: 'event order' });
  const ordered = sampleOutline();
  ordered.parts[0].volumes = [ordered.parts[0].volumes[0]];
  ordered.parts[0].volumes[0].chapters[0].events = [
    { type: 'status', order: 2, characters: ['孟启明'], subject: '警报', change: 'started', actor: '孟启明', action: 'set', target: '警报', target_type: 'status' },
    { type: 'status', order: 1, characters: ['孟启明'], subject: '名单', change: 'found', actor: '孟启明', action: 'set', target: '名单', target_type: 'status' },
  ];
  const result = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(ordered) });
  assert.equal(result.applied, true);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'quality.outline.event_order'));
});

test('checkpoint history keeps only the last ten writes per section', async (t) => {
  const { dir } = tempProject(t, { name: 'checkpoints', init: { chapter: 1 } });
  const checkpointDir = path.join(dir, 'chapters', 'checkpoints');
  for (let index = 1; index <= 12; index += 1) {
    const result = writeArtifact(loadProject(dir), {
      section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true, content: longChapter(`第${index}版`),
    });
    assert.equal(result.applied, true, JSON.stringify(result.check?.findings));
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  const checkpoints = fs.readdirSync(checkpointDir).filter((name) => name.startsWith('chapter_') && name.endsWith('.md'));
  assert.ok(checkpoints.length <= 10, `checkpoint history should be bounded, found ${checkpoints.length}`);
  assert.ok(checkpoints.length >= 9, `recent checkpoints should be retained, found ${checkpoints.length}`);
  assert.ok(fs.readFileSync(path.join(dir, 'chapters', 'P1-V1-C1.md'), 'utf8').includes('第12版'));
  const sorted = [...checkpoints].sort();
  assert.deepEqual(sorted, checkpoints.sort());
});

test('setup write auto-repairs derived registries instead of warning', (t) => {
  const { dir } = tempProject(t, { name: 'post-write', init: { chapter: 10 } });
  const pack = outlinepack();
  const outlineWrite = writeArtifact(loadProject(dir), {
    section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(pack.draft_outline),
  });
  assert.equal(outlineWrite.applied, true, JSON.stringify(outlineWrite.check?.findings));
  assert.equal(outlineWrite.ok, true);
  const setupWrite = writeArtifact(loadProject(dir), {
    section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(sampleSetup()),
  });
  assert.equal(setupWrite.applied, true);
  assert.equal(setupWrite.ok, true);
  assert.equal(setupWrite.warning, undefined);
  assert.equal(setupWrite.registry_repair.repaired, true);
  assert.ok(setupWrite.registry_repair.reasons.length > 0);
  const setup = JSON.parse(fs.readFileSync(path.join(dir, 'story', 'setup', 'story_setup.json'), 'utf8'));
  const outline = JSON.parse(fs.readFileSync(path.join(dir, 'story', 'compose', 'outline.json'), 'utf8'));
  assert.deepEqual(setup.thread_registry, outline.thread_registry);
  assert.deepEqual(setup.mystery_registry, outline.mystery_registry);
  assert.ok(setup.thread_registry.length > 0);
  assert.ok(setup.mystery_registry.length > 0);
  assert.ok(!setupWrite.check.findings.some((item) => item.rule_id === 'quality.thread.registry_missing_setup'));
});

test('outline write reports and repairs derived registries', (t) => {
  const { dir } = tempProject(t, { name: 'registry write', init: { chapter: 10 } });
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(sampleSetup()) });
  const pack = outlinepack();
  const draft = structuredClone(pack.draft_outline);
  delete draft.thread_registry;
  delete draft.mystery_registry;
  const dry = writeArtifact(loadProject(dir), { section: 'outline', mode: 'replace', apply: false, content: JSON.stringify(draft) });
  assert.equal(dry.applied, false);
  assert.ok(dry.registry_repair.needed.length > 0);
  assert.ok(dry.check.findings.some((item) => item.rule_id === 'quality.registry.drift'));
  const applied = writeArtifact(loadProject(dir), { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(draft) });
  assert.equal(applied.applied, true);
  assert.equal(applied.registry_repair.repaired, true);
  const setup = JSON.parse(fs.readFileSync(path.join(dir, 'story', 'setup', 'story_setup.json'), 'utf8'));
  const outline = JSON.parse(fs.readFileSync(path.join(dir, 'story', 'compose', 'outline.json'), 'utf8'));
  assert.deepEqual(setup.thread_registry, outline.thread_registry);
  assert.deepEqual(setup.mystery_registry, outline.mystery_registry);
  assert.ok(setup.mystery_registry.length > 0);
});

test('chapter dry-run returns stats and omits the recap advisory', (t) => {
  const { dir } = tempProject(t, { name: 'chapter stats' });
  const dry = writeArtifact(loadProject(dir), {
    section: 'chapter', mode: 'replace', apply: false, id: 'P1-V1-C1', content: longChapter(),
  });
  assert.equal(dry.applied, false);
  assert.ok(dry.stats.cjk > 0);
  assert.ok(dry.stats.paragraphs > 0);
  assert.ok(!dry.check.findings.some((item) => item.rule_id === 'quality.chapter.no_recap'));
});

test('chapters far above target get an informational over-target finding', (t) => {
  const { dir } = tempProject(t, { name: 'over target' });
  const dry = writeArtifact(loadProject(dir), {
    section: 'chapter', mode: 'replace', apply: false, id: 'P1-V1-C1', content: `# 第一章\n\n${'字'.repeat(4000)}`,
  });
  assert.ok(dry.check.findings.some((item) => item.rule_id === 'quality.chapter.length_over_target'));
  assert.equal(dry.check.blocking, false);
});

test('write modes and targets are validated per section', (t) => {
  const { project } = tempProject(t, { name: 'modes' });
  assert.throws(() => writeArtifact(project, { section: 'setup', mode: 'append', content: '{}' }), /setup mode must be replace or patch/);
  assert.throws(() => writeArtifact(project, { section: 'unknown', mode: 'replace', content: '{}' }), /unsupported write section/);
  assert.throws(() => writeArtifact(project, {
    section: 'outline', mode: 'replace', target: 'chapter', id: 'P1-V1-C1', content: '{}',
  }), /only valid with --mode patch/);
  assert.throws(() => writeArtifact(project, { section: 'craft', mode: 'replace', target: 'weapon', content: '{}' }), /unsupported write target for craft/);
  assert.throws(() => writeArtifact(project, { section: 'setup', mode: 'replace', content: 'not json' }), /is not valid JSON/);
  assert.throws(() => writeArtifact(project, { section: 'chapter', mode: 'replace', apply: true, content: '   ' }), /chapter write requires --id/);
});
