// Artifact data contracts: scripts/contracts.js is the single source of the setup
// and outline shape facts that rules and generators must agree on. These tests keep
// the tables honest, prove generated artifacts satisfy them, prove the rule engine
// derives its findings from them, and lock the compact saved-idea payload format.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CHAPTER_ID_PATTERN,
  CLIMAX_BEAT_FUNCTIONS,
  DEFAULT_RESOURCE_CATEGORY,
  MYSTERY_LIST_KEYS,
  MYSTERY_STATUSES,
  MYSTERY_STATUS_PRIORITY,
  OUTLINE_CHAPTER_REQUIRED_FIELDS,
  OUTLINE_PART_REQUIRED_FIELDS,
  OUTLINE_VOLUME_REQUIRED_FIELDS,
  PART_ID_PATTERN,
  RESOURCE_CATEGORIES,
  SCENE_MYSTERY_LIST_KEYS,
  SETUP_ARRAY_FIELDS,
  SETUP_OBJECT_FIELDS,
  SETUP_REQUIRED_STRING_FIELDS,
  SETUP_RESOURCE_CATEGORIES,
  SETUP_STRING_ARRAY_FIELDS,
  THREAD_REGISTRY_ARRAY_FIELDS,
  THREAD_REGISTRY_BOOLEAN_FIELDS,
  THREAD_REGISTRY_OBJECT_ARRAY_FIELDS,
  THREAD_STATUSES,
  UNSAFE_ID_PATTERN,
  VOLUME_ID_PATTERN,
} from '../scripts/contracts.js';
import { validateIdeaDraw } from '../scripts/ideas.js';
import { loadProject, readSection, saveIdeaDraw } from '../scripts/project.js';
import { validateOutline, validateSetup } from '../scripts/schema.js';
import { collectMysteryRegistry } from '../scripts/registry.js';
import { DECKS } from '../scripts/decks/index.js';
import { drawCached, fixtureSet, sampleSetup } from './fixtures.js';

const { tempProject } = fixtureSet('wishmachine-contracts-');

const SCRIPTS = fileURLToPath(new URL('../scripts', import.meta.url));

function listScriptFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listScriptFiles(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

test('contract tables are frozen and internally consistent', () => {
  const frozenTables = [
    SETUP_ARRAY_FIELDS,
    SETUP_REQUIRED_STRING_FIELDS,
    SETUP_STRING_ARRAY_FIELDS,
    SETUP_OBJECT_FIELDS,
    THREAD_STATUSES,
    THREAD_REGISTRY_ARRAY_FIELDS,
    THREAD_REGISTRY_BOOLEAN_FIELDS,
    THREAD_REGISTRY_OBJECT_ARRAY_FIELDS,
    MYSTERY_STATUSES,
    MYSTERY_LIST_KEYS,
    SCENE_MYSTERY_LIST_KEYS,
    CLIMAX_BEAT_FUNCTIONS,
    OUTLINE_PART_REQUIRED_FIELDS,
    OUTLINE_VOLUME_REQUIRED_FIELDS,
    OUTLINE_CHAPTER_REQUIRED_FIELDS,
    RESOURCE_CATEGORIES,
  ];
  for (const table of frozenTables) assert.ok(Object.isFrozen(table), 'contract table must be frozen');
  assert.ok(Object.isFrozen(MYSTERY_STATUS_PRIORITY));
  for (const table of frozenTables) {
    assert.equal(new Set(table).size, table.length, 'contract tables must not contain duplicates');
  }
  assert.deepEqual(
    [...MYSTERY_STATUSES].sort(),
    Object.keys(MYSTERY_STATUS_PRIORITY).sort(),
    'mystery status vocabulary and priority map must agree',
  );
  assert.deepEqual([...RESOURCE_CATEGORIES], [...SETUP_RESOURCE_CATEGORIES]);
  assert.ok(SETUP_RESOURCE_CATEGORIES.has(DEFAULT_RESOURCE_CATEGORY));
  assert.equal(THREAD_STATUSES[0], 'active');
  assert.equal(MYSTERY_STATUS_PRIORITY.resolved > MYSTERY_STATUS_PRIORITY.open, true);
  for (const fields of [OUTLINE_PART_REQUIRED_FIELDS, OUTLINE_VOLUME_REQUIRED_FIELDS, OUTLINE_CHAPTER_REQUIRED_FIELDS]) {
    assert.equal(fields[0], 'id', 'required field tables start with id');
  }
  assert.equal(CHAPTER_ID_PATTERN.test('P1-V1-C1'), true);
  assert.equal(CHAPTER_ID_PATTERN.test('P1-V1'), false);
  assert.equal(PART_ID_PATTERN.test('P1'), true);
  assert.equal(VOLUME_ID_PATTERN.test('P1-V1'), true);
  assert.equal(UNSAFE_ID_PATTERN.test('../escape'), true);
  assert.equal(UNSAFE_ID_PATTERN.test('chapters/one'), true);
  assert.equal(UNSAFE_ID_PATTERN.test('P1-V1-C1'), false);
});

test('shape facts that rules and generators share are only defined in contracts.js', () => {
  const files = listScriptFiles(SCRIPTS).filter((file) => path.basename(file) !== 'contracts.js');
  const source = (file) => fs.readFileSync(file, 'utf8');
  const violations = [];
  for (const file of files) {
    const text = source(file);
    const rel = path.relative(SCRIPTS, file).replace(/\\/g, '/');
    if (/'能源',\s*'消耗品',\s*'材料',\s*'货币'/.test(text)) violations.push(`${rel}: resource category literal`);
    if (/\{\s*open:\s*0,\s*dropped:\s*1,\s*resolved:\s*2\s*\}/.test(text)) violations.push(`${rel}: mystery priority literal`);
    if (/\[\s*'carried',\s*'planted',\s*'resolved',\s*'dropped'\s*\]/.test(text)) violations.push(`${rel}: mystery bucket literal`);
    if (/\[\s*'core_cast',\s*'storylines',\s*'premises',\s*'world_timeline',\s*'world_resources'\s*\]/.test(text)) violations.push(`${rel}: setup array literal`);
  }
  assert.deepEqual(violations, [], violations.join('\n'));
  for (const rel of ['rules/shape.js', 'ideas/setup-draft.js', 'rules/outline-structure.js', 'rules/outline-registries.js', 'rules/outline-chapters.js', 'ideas/validate.js', 'ideas/registry-build.js']) {
    assert.match(source(path.join(SCRIPTS, rel)), /from '[^']*contracts\.js'/, `${rel} must import the contract`);
  }
});

test('generated outlinepacks and setup drafts satisfy the contracts', () => {
  const pack = drawCached({ type: 'outlinepack', genre: '悬疑', seed: 42, count: 1, chapters: 10 }).results[0];
  for (const volume of pack.volumes) {
    assert.equal(VOLUME_ID_PATTERN.test(volume.id), true, volume.id);
    assert.equal(OUTLINE_VOLUME_REQUIRED_FIELDS.every((field) => typeof volume[field] === 'string' && volume[field].trim()), true);
    for (const chapter of volume.chapters) {
      assert.equal(CHAPTER_ID_PATTERN.test(chapter.id), true, chapter.id);
      for (const field of OUTLINE_CHAPTER_REQUIRED_FIELDS) {
        assert.equal(typeof chapter[field] === 'string' && chapter[field].trim().length > 0, true, `${chapter.id}.${field}`);
      }
      assert.deepEqual(Object.keys(chapter.mysteries).sort(), [...MYSTERY_LIST_KEYS].sort());
      for (const scene of chapter.scenes) {
        assert.deepEqual(Object.keys(scene.mysteries).sort(), [...SCENE_MYSTERY_LIST_KEYS].sort());
      }
    }
  }
  for (const part of pack.draft_outline.parts) {
    assert.equal(PART_ID_PATTERN.test(part.id), true, part.id);
    for (const field of OUTLINE_PART_REQUIRED_FIELDS) assert.ok(typeof part[field] === 'string' && part[field].trim());
  }
  assert.ok(pack.thread_registry.every((thread) => THREAD_STATUSES.includes(thread.status)));
  assert.ok(pack.thread_registry.every((thread) => (thread.status === 'resolved' ? Boolean(thread.resolved_in) : true)));
  assert.ok(pack.mystery_registry.every((mystery) => MYSTERY_STATUSES.includes(mystery.status)));
  const setup = pack.setup_draft;
  for (const field of SETUP_ARRAY_FIELDS) {
    assert.ok(Array.isArray(setup[field]), `setup_draft.${field} must be an array`);
    assert.ok(setup[field].every((item) => item && typeof item === 'object' && !Array.isArray(item)), `setup_draft.${field} items must be objects`);
  }
  assert.ok(setup.world_resources.every((resource) => RESOURCE_CATEGORIES.includes(resource.category)));
  assert.deepEqual(validateSetup(setup), []);
  assert.deepEqual(validateOutline(pack.draft_outline, { structure: {} }), []);
  for (const deck of Object.values(DECKS)) {
    for (const mapped of Object.values(deck.resourceCategories || {})) {
      assert.ok(RESOURCE_CATEGORIES.includes(mapped), `${deck.name} maps to unknown setup category ${mapped}`);
    }
  }
});

test('setup shape findings are derived from the contract tables', () => {
  const expectRule = (setup, ruleId, severity) => {
    const finding = validateSetup(setup).find((item) => item.rule_id === ruleId);
    assert.ok(finding, `expected ${ruleId} in ${JSON.stringify(validateSetup(setup).map((item) => item.rule_id))}`);
    if (severity) assert.equal(finding.severity, severity);
  };
  for (const { key, severity } of SETUP_REQUIRED_STRING_FIELDS) {
    const setup = sampleSetup();
    delete setup[key];
    expectRule(setup, `schema.setup.${key}`, severity);
  }
  for (const { key, severity } of SETUP_STRING_ARRAY_FIELDS) {
    const setup = sampleSetup();
    setup[key] = 5;
    expectRule(setup, `schema.setup.${key}`, severity);
  }
  for (const key of SETUP_OBJECT_FIELDS) {
    const setup = sampleSetup();
    setup[key] = 'plain string';
    expectRule(setup, `schema.setup.${key}`, 'high');
  }
  for (const key of SETUP_ARRAY_FIELDS) {
    const setup = sampleSetup();
    setup[key] = 'oops';
    expectRule(setup, `schema.setup.${key}`, 'high');
    const itemSetup = sampleSetup();
    itemSetup[key] = ['not-an-object'];
    expectRule(itemSetup, `schema.setup.${key}`, 'high');
  }
});

test('outline structure findings are derived from the contract field tables', () => {
  const pack = drawCached({ type: 'outlinepack', genre: '悬疑', seed: 42, count: 1, chapters: 10 }).results[0];
  const base = structuredClone(pack.draft_outline);
  const rulesFor = (mutate) => {
    const outline = structuredClone(base);
    mutate(outline);
    return validateOutline(outline, { structure: {} }).map((finding) => finding.rule_id);
  };
  for (const field of OUTLINE_PART_REQUIRED_FIELDS) {
    const rules = rulesFor((outline) => { outline.parts[0][field] = ''; });
    assert.ok(rules.includes(`schema.outline.part.${field}`), `part.${field}: ${rules.join(',')}`);
  }
  for (const field of OUTLINE_VOLUME_REQUIRED_FIELDS) {
    const rules = rulesFor((outline) => { outline.parts[0].volumes[0][field] = ''; });
    assert.ok(rules.includes(`schema.outline.volume.${field}`), `volume.${field}: ${rules.join(',')}`);
  }
  for (const field of OUTLINE_CHAPTER_REQUIRED_FIELDS) {
    const rules = rulesFor((outline) => { outline.parts[0].volumes[0].chapters[0][field] = ''; });
    assert.ok(rules.includes(`schema.outline.chapter.${field}`), `chapter.${field}: ${rules.join(',')}`);
  }
  const unsafe = rulesFor((outline) => { outline.parts[0].volumes[0].chapters[0].id = '../escape'; });
  assert.ok(unsafe.includes('schema.outline.chapter.id_format'));
});

test('thread status vocabulary drives idea validation and suggestions', () => {
  const pack = drawCached({ type: 'outlinepack', genre: '悬疑', seed: 42, count: 1, chapters: 10 }).results[0];
  for (const status of THREAD_STATUSES) {
    const draw = structuredClone(pack);
    draw.thread_registry[0] = { ...draw.thread_registry[0], status };
    if (status !== 'active') delete draw.thread_registry[0].resolved_in;
    const result = validateIdeaDraw({ results: [draw] });
    assert.ok(!result.findings.some((finding) => finding.rule_id === 'idea.thread.invalid_status'), status);
  }
  const invalid = structuredClone(pack);
  invalid.thread_registry[0].status = 'paused';
  const finding = validateIdeaDraw({ results: [invalid] }).findings.find((item) => item.rule_id === 'idea.thread.invalid_status');
  assert.ok(finding);
  assert.equal(finding.suggestion, `Use ${THREAD_STATUSES.join(', ')}.`);
});

test('mystery status priority drives registry merging', () => {
  MYSTERY_STATUSES.forEach((status, index) => {
    if (index === 0) return;
    assert.ok(
      MYSTERY_STATUS_PRIORITY[status] > MYSTERY_STATUS_PRIORITY[MYSTERY_STATUSES[index - 1]],
      `${status} must outrank ${MYSTERY_STATUSES[index - 1]}`,
    );
  });
  const chapters = [{
    id: 'P1-V1-C1',
    mysteries: {
      open: [], dropped: [], resolved: [], carried: [{ id: 'm1', status: 'open', question: 'q1' }],
    },
    scenes: [{ order: 1, mysteries: { planted: [], resolved: [{ id: 'm1', status: 'resolved', question: 'q1' }] } }],
  }];
  const merged = collectMysteryRegistry(chapters).find((mystery) => mystery.id === 'm1');
  assert.equal(merged.status, 'resolved', 'the later resolved copy must win over the carried open copy');
});

test('saved idea draws use compact JSON and stay semantically readable', (t) => {
  const { dir } = tempProject(t, { name: 'compact save', init: { chapter: 10 } });
  const project = loadProject(dir);
  const draw = drawCached({ type: 'outlinepack', genre: '悬疑', seed: 42, count: 1, chapters: 10 });
  const saved = saveIdeaDraw(project, draw);
  const file = path.join(dir, saved.saved.path);
  const raw = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(raw);
  assert.equal(raw, JSON.stringify(parsed), 'saved draw must be compact JSON without indentation');
  assert.equal(raw.includes('\n    '), false, 'saved draw must not be pretty-printed');
  assert.equal(saved.saved.bytes, fs.statSync(file).size);
  const prettyBytes = Buffer.byteLength(`${JSON.stringify(draw, null, 2)}\n`);
  assert.ok(prettyBytes / saved.saved.bytes >= 1.5, `compact payload ${saved.saved.bytes}B should be well under pretty ${prettyBytes}B`);
  assert.equal(JSON.stringify(parsed), JSON.stringify(draw), 'compact JSON must preserve every public field');
  const full = readSection(project, 'idea', { id: saved.saved.id, view: 'full' });
  assert.equal(JSON.stringify(full.draw), JSON.stringify(draw));
  assert.deepEqual(full.draw.results.map((result) => result.id), draw.results.map((result) => result.id));
  const summary = readSection(project, 'idea', { id: saved.saved.id, view: 'summary' });
  assert.equal(summary.summary.bytes, saved.saved.bytes);
  assert.deepEqual(summary.summary.result_ids, draw.results.map((result) => result.id).filter(Boolean));
});
