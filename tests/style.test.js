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
import { fixtureSet, sampleSetup, sampleOutline, longChapter } from './fixtures.js';

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
