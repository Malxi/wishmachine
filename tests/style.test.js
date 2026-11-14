// Style / de-AI checks: statistical metrics, advisory findings, voice card and
// the book-level style audit.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  loadProject, writeArtifact, readSection, auditProject, initProject,
} from '../scripts/project.js';
import { checkProject, validateSetup } from '../scripts/schema.js';
import { chapterMetrics, setupMetrics } from '../scripts/rules/style/metrics.js';
import { validateVoiceCard, validateWritingStyle } from '../scripts/style-card.js';
import { fixtureSet, sampleSetup, sampleOutline, longChapter, outlinepack } from './fixtures.js';

const { tempProject, tempDir } = fixtureSet('wishmachine-style-');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
  const write = writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(setup) });
  assert.equal(write.applied, false);
  const rules = new Set(write.check.findings.map((item) => item.rule_id));
  assert.ok(rules.has('schema.setup.core_cast.name_source'), JSON.stringify([...rules]));
  assert.ok(rules.has('schema.setup.core_cast.naming_style'), JSON.stringify([...rules]));
});

test('human namecard ids do not count as drawn-name coverage', () => {
  const setup = sampleSetup();
  setup.core_cast = [
    { name: '周辙', role: 'protagonist', name_source: 'human', namecard_id: 'human-01' },
    { name: '罗绍安', role: 'mentor', name_source: 'draw', namecard_id: 'name-88-04', naming_style: 'plain' },
    { name: '丁小满', role: 'support', name_source: 'human', namecard_id: 'human-02' },
    { name: '程启明', role: 'support', name_source: 'draw', namecard_id: 'name-88-11', naming_style: 'hard' },
  ];
  const metrics = setupMetrics(setup);
  assert.equal(metrics.nameSourceCoverage, 0.5);
});

test('chapter style flags fragments, enumeration and counting tics', (t) => {
  const { dir } = tempProject(t, { name: 'language tics', init: { chapter: 1 } });
  writeChapter(dir, 'P1-V1-C1', '# 第一章\n\n没响。没动。没亮。\n\n他把扳手数了一遍，九把。又数一遍，还是九把。点过一遍，又点一遍。\n\n他站着。');
  const result = checkProject(loadProject(dir), { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  const rules = new Set(result.findings.map((item) => item.rule_id));
  assert.ok(rules.has('style.chapter.fragments'), JSON.stringify([...rules]));
  assert.ok(rules.has('style.chapter.enumeration'), JSON.stringify([...rules]));
  assert.ok(rules.has('style.chapter.counting_tic'), JSON.stringify([...rules]));
  assert.ok(rules.has('style.chapter.recount_tic'), JSON.stringify([...rules]));
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

test('writing-style lives in story/style and rejects AI or recipe sources', (t) => {
  const dir = tempDir(t);
  initProject({ name: 'writing style', dir });
  const sample = JSON.parse(fs.readFileSync(path.join(root, 'data/style/human-samples.json'), 'utf8')).entries
    .find((entry) => entry.id === 'zh-luxun-kongyiji-01');
  const style = {
    version: 1,
    name: '贴近人物视角',
    description: '只写人物能看见和摸到的东西，句子长短不匀。',
    principles: ['只写人物能感知的具体物', '对话短、答非所问'],
    avoid: ['段尾升华'],
    references: [{
      source: 'public-domain',
      sample_id: sample.id,
      author: sample.author,
      work: sample.work,
      url: sample.url,
      text: sample.text,
    }],
  };
  const dry = writeArtifact(loadProject(dir), { section: 'writing-style', mode: 'replace', content: JSON.stringify(style) });
  assert.equal(dry.applied, false);
  assert.equal(dry.writing_style.present, true);
  const applied = writeArtifact(loadProject(dir), { section: 'writing-style', mode: 'replace', apply: true, content: JSON.stringify(style) });
  assert.equal(applied.applied, true);
  assert.ok(fs.existsSync(path.join(dir, 'story', 'style', 'writing-style.json')));
  assert.equal(readSection(loadProject(dir), 'writing-style').present, true);
  assert.throws(() => writeArtifact(loadProject(dir), {
    section: 'writing-style', mode: 'replace', content: JSON.stringify({ ...style, references: [{ source: 'ai', text: sample.text }] }),
  }), /AI-generated samples are not accepted/);
  assert.throws(() => writeArtifact(loadProject(dir), {
    section: 'writing-style', mode: 'replace', content: JSON.stringify({ ...style, principles: ['每章一次报数，数字要对上'] }),
  }), /not chapter recipes/);
  assert.throws(() => writeArtifact(loadProject(dir), {
    section: 'writing-style', mode: 'append', content: JSON.stringify(style),
  }), /mode must be replace/);
});

test('style check flags legacy setup writing_style and AI voice samples', (t) => {
  const { dir } = tempProject(t, { name: 'style provenance', init: { chapter: 1 } });
  const setup = sampleSetup();
  setup.writing_style = { name: '旧位置', description: '应该移走', principles: [], avoid: [] };
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(setup) });
  const card = {
    version: 1,
    voice: { description: '测试', principles: [], avoid: [] },
    samples: [{ label: 'AI 自产', text: '这是一段没有人类来源的示例文本，用来验证检查器的行为。' }],
  };
  fs.mkdirSync(path.join(dir, 'story', 'style'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'story', 'style', 'voice.json'), JSON.stringify(card));
  const result = checkProject(loadProject(dir), { profile: 'style', target: 'setup' });
  const rules = new Set(result.findings.map((item) => item.rule_id));
  assert.ok(rules.has('style.setup.writing_style_deprecated'), JSON.stringify([...rules]));
  assert.ok(rules.has('style.writing_style.missing'), JSON.stringify([...rules]));
  assert.ok(rules.has('style.voice.sample_source'), JSON.stringify([...rules]));
});

test('style references require verbatim sample ids or explicit user confirmation', () => {
  const sample = JSON.parse(fs.readFileSync(path.join(root, 'data/style/human-samples.json'), 'utf8')).entries
    .find((entry) => entry.id === 'zh-luxun-kongyiji-01');
  const base = {
    version: 1,
    name: '样本来源',
    description: '只测校验，不涉及正文。',
    principles: [],
    avoid: [],
    references: [{ source: 'public-domain', text: sample.text }],
  };
  assert.throws(() => validateWritingStyle(base), /needs sample_id/);
  assert.throws(() => validateWritingStyle({
    ...base,
    references: [{ source: 'public-domain', sample_id: sample.id, text: `${sample.text.slice(0, 80)}改` }],
  }), /verbatim/);
  assert.throws(() => validateWritingStyle({
    ...base,
    references: [{ source: 'human', text: '用户提供的样本'.repeat(20) }],
  }), /needs author/);
  assert.throws(() => validateWritingStyle({
    ...base,
    references: [{ source: 'human', author: '用户', license: '授权', text: '用户提供的样本'.repeat(20) }],
  }), /user_confirmed/);
  assert.doesNotThrow(() => validateVoiceCard({
    version: 1,
    samples: [{ source: 'human', author: '用户', license: '授权', user_confirmed: true, text: '用户提供的样本'.repeat(20) }],
    negative_samples: [{ source: 'ai', text: '一段 AI 反面样本。' }],
  }));
});

test('draw name_source without namecard_id is reported', () => {
  const setup = sampleSetup();
  setup.core_cast[0].name_source = 'draw';
  const findings = validateSetup(setup);
  assert.ok(findings.some((item) => item.rule_id === 'schema.setup.core_cast.namecard_id'));
});

test('built-in human samples are public-domain or authorized excerpts', () => {
  const file = path.join(root, 'data/style/human-samples.json');
  const entries = JSON.parse(fs.readFileSync(file, 'utf8')).entries;
  assert.ok(entries.length > 2);
  assert.ok(entries.some((entry) => entry.source === 'public-domain' && entry.author === '鲁迅'));
  assert.ok(entries.some((entry) => entry.source === 'public-domain' && entry.author === '朱自清'));
  assert.ok(entries.some((entry) => entry.source === 'human'));
  assert.ok(entries.every((entry) => entry.url || entry.license));
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
  const sample = JSON.parse(fs.readFileSync(path.join(root, 'data/style/human-samples.json'), 'utf8')).entries
    .find((entry) => entry.id === 'zh-luxun-kongyiji-01');
  const card = {
    version: 1,
    narrative: { pov: 'third_person_limited', tense: 'past' },
    voice: { description: '冷峻具体', principles: ['用账目写情绪'], avoid: ['段尾升华'] },
    samples: [{
      label: '开篇',
      source: 'public-domain',
      sample_id: sample.id,
      author: sample.author,
      work: sample.work,
      url: sample.url,
      text: sample.text,
    }],
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
  assert.throws(() => writeArtifact(loadProject(dir), {
    section: 'style', mode: 'append', content: JSON.stringify(card),
  }), /mode must be replace/);
});

test('longChapter still passes structural checks while style stays advisory', (t) => {
  const { dir } = tempProject(t, { name: 'style compat', init: { chapter: 1 } });
  writeArtifact(loadProject(dir), { section: 'chapter', mode: 'replace', apply: true, id: 'P1-V1-C1', content: longChapter() });
  const all = checkProject(loadProject(dir), { profile: 'all', target: 'chapter', id: 'P1-V1-C1' });
  assert.equal(all.ok, true);
  const style = checkProject(loadProject(dir), { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  assert.equal(style.ok, true);
});
