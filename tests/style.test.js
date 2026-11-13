// Style / de-AI checks: statistical metrics, advisory findings, voice card and
// the book-level style audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadProject, writeArtifact, readSection, auditProject, initProject,
} from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import { chapterMetrics, setupMetrics } from '../scripts/rules/style/metrics.js';
import { fixtureSet, sampleSetup, sampleOutline, longChapter, outlinepack } from './fixtures.js';

const { tempProject, tempDir } = fixtureSet('wishmachine-style-');

function writeChapter(dir, id, text) {
  const file = path.join(dir, 'chapters', `${id}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

test('chapter metrics expose compressed predicates and opening reuse', () => {
  const text = `# 测试\n\n${'她不响。他没答。灯不亮。风不动。'.repeat(40)}`;
  const metrics = chapterMetrics(text);
  assert.ok(metrics.compressedPredicatePer1k > 3.5, JSON.stringify(metrics));
  assert.ok(metrics.negatedCompressedShare > 0.9);
  assert.ok(metrics.compressedPredicateSentenceRatio > 0.5);
  assert.ok(metrics.compressedExamples.length > 0);
  assert.ok(metrics.sentenceOpeningReuse > 0.4);
  const healthy = `# 正常\n\n沈穗把旧尺按在垄沟里，从沟口量到该下种的地方，一尺七寸。她量完又量一遍，两遍都对得上，才用指头在土上按了个坑。云压得很低，风从灰雾带那边过来，带着湿冷的土腥味，吹得垄背上的枯草一直响。`;
  const normal = chapterMetrics(healthy);
  assert.equal(normal.compressedPredicate, 0, JSON.stringify(normal));
  assert.ok(normal.sentenceCv > 0.1);
});

test('setup metrics flag genre salad, aphoristic theme and abstract terms', () => {
  const setup = sampleSetup();
  setup.genres = ['科幻', '奇幻', '悬疑', '言情', '历史'];
  setup.theme = '真正重要的不是胜负，而是人性在绝境中的选择';
  setup.premise = '命运、文明、时间与记忆交织，人类在黑暗中寻找意义与救赎。';
  setup.rules = ['要真实', '要克制'];
  const metrics = setupMetrics(setup);
  assert.equal(metrics.genreCount, 5);
  assert.equal(metrics.themeAphorism, 1);
  assert.ok(metrics.abstractPer1k > 15, JSON.stringify(metrics));
  assert.ok(metrics.concreteRulesRatio < 0.3);
});

test('setup metrics flag name provenance and naming style problems', (t) => {
  const setup = sampleSetup();
  setup.core_cast = [
    { name: '沈穗', role: 'protagonist' },
    { name: '沈砚', role: 'support' },
    { name: '老井', role: 'support' },
    { name: '阿箬', role: 'support' },
    { name: '收成人', role: 'antagonist' },
  ];
  const metrics = setupMetrics(setup);
  assert.equal(metrics.nameSurnameConcentration, 0.4);
  assert.equal(metrics.nameDescriptorRatio, 0.6);
  assert.equal(metrics.nameSingleCharGivenRatio, 0.8);
  assert.equal(metrics.nameSourceCoverage, 0);
  assert.equal(metrics.nameStyleDiversity, 0);
  const { dir } = tempProject(t, { name: 'name metrics', init: { chapter: 1 } });
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(setup) });
  const result = checkProject(loadProject(dir), { profile: 'style', target: 'setup' });
  assert.ok(result.findings.some((item) => item.rule_id === 'style.setup.name_source'));
});

test('namecard provenance is carried into generated setup drafts', () => {
  const pack = outlinepack({ chapters: 3 });
  const cast = pack.setup_draft.core_cast || [];
  assert.ok(cast.length > 0);
  assert.ok(cast.some((character) => character.namecard_id), JSON.stringify(cast));
  assert.ok(cast.some((character) => character.name_source === 'draw'));
});

test('setup schema validates name_source and naming_style values', (t) => {
  const { dir } = tempProject(t, { name: 'name schema', init: { chapter: 1 } });
  const setup = sampleSetup();
  setup.core_cast[0].name_source = 'invented';
  setup.core_cast[0].naming_style = 'unknown';
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(setup) });
  const result = checkProject(loadProject(dir), { profile: 'schema', target: 'setup' });
  assert.ok(result.findings.some((item) => item.rule_id === 'schema.setup.core_cast.name_source'));
  assert.ok(result.findings.some((item) => item.rule_id === 'schema.setup.core_cast.naming_style'));
});

test('authored namecard ids do not count as drawn-name coverage', () => {
  const setup = sampleSetup();
  setup.core_cast = [
    { name: '周辙', role: 'protagonist', name_source: 'authored', namecard_id: 'authored-01' },
    { name: '罗绍安', role: 'mentor', name_source: 'draw', namecard_id: 'name-88-04', naming_style: 'plain' },
    { name: '丁小满', role: 'support', name_source: 'authored', namecard_id: 'authored-02' },
    { name: '程启明', role: 'support', name_source: 'draw', namecard_id: 'name-88-11', naming_style: 'hard' },
  ];
  const metrics = setupMetrics(setup);
  assert.equal(metrics.nameSourceCoverage, 0.5);
});

test('chapter style flags padding and configured motif overuse', (t) => {
  const { dir } = tempProject(t, { name: 'padding motif', init: { chapter: 1 } });
  writeChapter(dir, 'P1-V1-C1', `# 第一章\n\n${'她数了一遍。'.repeat(700)}`);
  const project = loadProject(dir);
  project.config.style = { motifs: ['数'], chapter: { motifMaxPer1k: { warn: 1, risk: 2 } } };
  const result = checkProject(project, { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  assert.ok(result.findings.some((item) => item.rule_id === 'style.chapter.padding'));
  const motif = result.findings.find((item) => item.rule_id === 'style.chapter.motif_overuse');
  assert.ok(motif, JSON.stringify(result.findings));
  assert.ok(motif.evidence.some((item) => item.term === '数'));
});

test('book style audit detects phrases repeated across chapters', (t) => {
  const { dir } = tempProject(t, { name: 'book motifs', init: { chapter: 3 } });
  for (const id of ['P1-V1-C1', 'P1-V1-C2', 'P1-V1-C3']) {
    writeChapter(dir, id, `# ${id}\n\n${'她把纸边抹了一遍，又把账合上。'.repeat(20)}`);
  }
  const result = auditProject(loadProject(dir), { profile: 'style', view: 'full' });
  assert.ok(result.motifs.length > 0, JSON.stringify(result.motifs));
  assert.ok(result.findings.some((item) => item.rule_id === 'style.book.repeated_motif'));
});

test('style check is advisory: findings are low/medium and never blocking', (t) => {
  const { dir } = tempProject(t, { name: 'style check', init: { chapter: 1 } });
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(sampleSetup()) });
  writeArtifact(loadProject(dir), { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(sampleOutline()) });
  writeChapter(dir, 'P1-V1-C1', `# 第一章\n\n${'她不响。他没答。灯不亮。风不动。'.repeat(60)}`);
  const result = checkProject(loadProject(dir), { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  assert.equal(result.blocking, false);
  assert.equal(result.ok, true);
  assert.ok(result.findings.length > 0);
  assert.ok(result.findings.every((item) => item.severity === 'low' || item.severity === 'medium'));
  const compressed = result.findings.find((item) => item.rule_id === 'style.chapter.compressed_predicate');
  assert.ok(compressed);
  assert.equal(compressed.severity, 'medium');
  assert.equal(compressed.metrics.band, 'risk');
  assert.ok(compressed.evidence.length > 0);
});

test('style profile supports setup and rejects unsupported targets', (t) => {
  const { dir } = tempProject(t, { name: 'style setup', init: { chapter: 1 } });
  const setup = sampleSetup();
  setup.genres = ['科幻', '奇幻', '悬疑', '言情', '历史'];
  setup.theme = '真正重要的不是胜负，而是人性在绝境中的选择';
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(setup) });
  const result = checkProject(loadProject(dir), { profile: 'style', target: 'setup' });
  assert.equal(result.blocking, false);
  assert.ok(result.findings.some((item) => item.rule_id === 'style.setup.genre_salad'));
  assert.throws(() => checkProject(loadProject(dir), { profile: 'style', target: 'outline' }), /setup or chapter/);
});

test('style thresholds can be overridden per project', (t) => {
  const { dir } = tempProject(t, { name: 'style config', init: { chapter: 1 } });
  writeChapter(dir, 'P1-V1-C1', '# 第一章\n\n她不响。\n');
  const project = loadProject(dir);
  project.config.style = { chapter: { compressedPredicatePer1k: { warn: 0.1, risk: 0.2 } } };
  const result = checkProject(project, { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  const finding = result.findings.find((item) => item.rule_id === 'style.chapter.compressed_predicate');
  assert.ok(finding);
  assert.equal(finding.severity, 'medium');
});

test('book-level style audit aggregates metrics and per-chapter findings', (t) => {
  const { dir } = tempProject(t, { name: 'style audit', init: { chapter: 2 } });
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(sampleSetup()) });
  writeArtifact(loadProject(dir), { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(sampleOutline()) });
  writeChapter(dir, 'P1-V1-C1', `# 第一章\n\n${'她不响。他没答。灯不亮。风不动。'.repeat(30)}`);
  const result = auditProject(loadProject(dir), { profile: 'style', view: 'summary' });
  assert.equal(result.profile, 'style');
  assert.equal(result.blocking, false);
  assert.ok(result.metrics.compressedPredicatePer1k > 0);
  assert.equal(result.chapters.length, 1);
  assert.equal(result.findings.length, 0);
  assert.ok(result.summary.total > 0);
  const full = auditProject(loadProject(dir), { profile: 'style', view: 'full' });
  assert.ok(full.findings.length > 0);
});

test('voice card writes, reads and validates', (t) => {
  const dir = tempDir(t);
  initProject({ name: 'voice', dir });
  const card = {
    version: 1,
    narrative: { pov: 'third_person_limited', tense: 'past' },
    voice: { description: '冷峻具体', principles: ['用账目写情绪'], avoid: ['段尾升华'] },
    samples: [{ label: '开篇', text: '车在田埂尽头停下。' }],
  };
  const dry = writeArtifact(loadProject(dir), { section: 'style', mode: 'replace', content: JSON.stringify(card) });
  assert.equal(dry.applied, false);
  assert.equal(dry.voice.present, true);
  const applied = writeArtifact(loadProject(dir), { section: 'style', mode: 'replace', apply: true, content: JSON.stringify(card) });
  assert.equal(applied.applied, true);
  assert.ok(fs.existsSync(path.join(dir, 'story', 'style', 'voice.json')));
  const read = readSection(loadProject(dir), 'style');
  assert.equal(read.present, true);
  assert.equal(read.summary.samples, 1);
  const context = readSection(loadProject(dir), 'context');
  assert.equal(context.style.present, true);
  assert.throws(() => writeArtifact(loadProject(dir), {
    section: 'style', mode: 'replace', apply: true, content: JSON.stringify({ version: 2 }),
  }), /version must be 1/);
});

test('longChapter still passes structural checks while style stays advisory', (t) => {
  const { dir } = tempProject(t, { name: 'style compat', init: { chapter: 1 } });
  writeArtifact(loadProject(dir), { section: 'chapter', mode: 'replace', apply: true, id: 'P1-V1-C1', content: longChapter() });
  const all = checkProject(loadProject(dir), { profile: 'all', target: 'chapter', id: 'P1-V1-C1' });
  assert.equal(all.ok, true);
  const style = checkProject(loadProject(dir), { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  assert.equal(style.ok, true);
});
