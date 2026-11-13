import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { drawIdeas, validateIdeaDraw, ideasTypes } from '../scripts/ideas.js';
import {
  DECKS,
  DEFAULT_DECK,
  DECK_NAMES,
  DECK_REFERENCE_ERRORS,
  KNOWN_RELATION_TYPES,
  MOTIFS,
  deckReferenceErrors,
  selectDeck,
} from '../scripts/decks/index.js';
import { initProject, loadProject, saveIdeaDraw, writeArtifact } from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import { drawCached, fixtureSet } from './fixtures.js';

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { tempDir } = fixtureSet('wishmachine-regression-');

function findingsFor(draw) {
  return validateIdeaDraw(draw).findings;
}

test('deck registry externalises card data and validates pack references at load time', () => {
  assert.deepEqual(DECK_NAMES, ['default', 'xianxia', 'suspense', 'urban', 'history', 'romance']);
  assert.deepEqual(DECK_REFERENCE_ERRORS, []);
  for (const name of DECK_NAMES) {
    const deck = DECKS[name];
    assert.equal(deck.name, name);
    for (const field of ['premises', 'resources', 'scenarios', 'storylines', 'engines', 'locations', 'factions', 'equipment', 'packs', 'archetypes']) {
      assert.ok(Array.isArray(deck[field]) && deck[field].length > 0, `${name}.${field} should be a non-empty array`);
    }
    for (const field of ['promptStyle', 'promptNegative', 'portraitStyle', 'portraitNegative']) {
      assert.ok(typeof deck[field] === 'string' && deck[field].trim(), `${name}.${field} should be a string`);
    }
    assert.ok(Object.keys(deck.relationTypes).length >= 5);
    assert.ok(Object.keys(deck.resourceCategories).length > 0);
  }
  assert.ok(MOTIFS.length >= 8);
  // A tampered deck must produce actionable load-time errors instead of dropping cards silently.
  const broken = deckReferenceErrors({
    broken: {
      ...DEFAULT_DECK,
      name: 'broken',
      packs: [{ theme: 'broken-pack', premise: '不存在的前提', engine: '不存在的引擎', resources: ['不存在的资源'], location: '不存在的地点' }],
    },
  });
  assert.ok(broken.some((error) => error.includes('unknown premise 不存在的前提')));
  assert.ok(broken.some((error) => error.includes('unknown resource 不存在的资源')));
  assert.ok(broken.some((error) => error.includes('unknown location 不存在的地点')));
});

test('every deck generates valid worldpacks and history keeps the memorializes relation', () => {
  assert.ok(KNOWN_RELATION_TYPES.has('memorializes'));
  const genreByDeck = { default: '科幻', xianxia: '修仙', suspense: '悬疑', urban: '都市', history: '历史', romance: '言情' };
  for (const [name, genre] of Object.entries(genreByDeck)) {
    const deck = DECKS[name];
    const draw = drawIdeas({ type: 'worldpack', genre, count: deck.packs.length, seed: 42 });
    assert.equal(draw.count, deck.packs.length);
    for (const pack of draw.results) {
      const def = deck.packs.find((item) => item.theme === pack.theme);
      assert.ok(def, `pack ${pack.theme} should come from the ${name} deck`);
      assert.equal(pack.resources.length, (def.resources || []).length, `${pack.theme} should resolve every resource`);
      assert.equal(pack.scenarios.length, (def.scenarios || []).length, `${pack.theme} should resolve every scenario`);
      assert.equal(pack.storylines.length, (def.storylines || []).length, `${pack.theme} should resolve every storyline`);
      assert.ok(pack.location, `${pack.theme} needs a location`);
      assert.ok(pack.faction, `${pack.theme} needs a faction`);
      assert.ok(pack.equipment, `${pack.theme} needs equipment`);
      if (def.motif) assert.ok(pack.motif, `${pack.theme} needs its motif`);
    }
    const validation = validateIdeaDraw(draw);
    assert.equal(validation.ok, true, `${name} worldpacks should validate: ${JSON.stringify(validation.findings)}`);
  }
  const history = drawIdeas({ type: 'worldpack', genre: '历史', count: 1, seed: 42 });
  assert.ok(history.results[0].cast_relations.some((relation) => relation.type === 'memorializes'));
  const xianxia = drawIdeas({ type: 'worldpack', genre: '修仙', count: 4, seed: 42 });
  const incense = xianxia.results.find((pack) => pack.theme === 'incense');
  assert.ok(incense);
  assert.equal(incense.location.name, '香火祠');
});

test('romance prompt packs use the romance style instead of the sci-fi default', () => {
  const worldpack = drawIdeas({ type: 'worldpack', genre: '言情', count: 1, seed: 42 }).results[0];
  assert.ok(worldpack.prompt_pack.style.includes('爱情'), worldpack.prompt_pack.style);
  assert.ok(!worldpack.prompt_pack.style.includes('近未来'), worldpack.prompt_pack.style);
  assert.ok(!worldpack.prompt_pack.style.includes('科幻'), worldpack.prompt_pack.style);
  assert.ok(worldpack.prompt_pack.negative.includes('spaceships'));
  assert.ok(worldpack.prompt_pack.negative.includes('genre mismatch'));
  const plotpack = drawIdeas({ type: 'plotpack', genre: '言情', count: 1, seed: 42 }).results[0];
  assert.equal(plotpack.prompt_pack.style, worldpack.prompt_pack.style);
  assert.ok(!plotpack.cast.some((character) => /科幻/.test(character.prompt)));
});

test('validateIdeaDraw checks plotpack and outlinepack cast relations through graph', () => {
  const worldpack = drawIdeas({ type: 'worldpack', genre: '悬疑', count: 1, seed: 42 }).results[0];
  assert.equal(findingsFor({ results: [worldpack] }).length, 0);
  const plotpack = drawIdeas({ type: 'plotpack', genre: '悬疑', count: 1, seed: 42 }).results[0];
  assert.equal(findingsFor({ results: [plotpack] }).length, 0);
  const outlinepack = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 42, chapters: 3 }).results[0];
  assert.equal(findingsFor({ results: [outlinepack] }).length, 0);
  assert.ok(outlinepack.graph.entities.length > 0);

  for (const result of [plotpack, outlinepack]) {
    const broken = JSON.parse(JSON.stringify(result));
    broken.cast_relations[0].from = 'missing-entity';
    broken.cast_relations[0].type = 'nonsense_relation';
    const findings = findingsFor({ results: [broken] });
    assert.ok(findings.some((finding) => finding.rule_id === 'idea.cast_relation.unknown_entity'));
    assert.ok(findings.some((finding) => finding.rule_id === 'idea.cast_relation.unknown_type'));
  }
});

test('replay_command reproduces the draw from node scripts/wishmachine.js', () => {
  const draw = drawIdeas({
    type: 'outlinepack', genre: '悬疑', count: 1, seed: 7,
    chapters: 4, scenes: 2, targetChars: 2200, volumes: 1,
  });
  const replay = draw.meta.replay_command;
  assert.match(replay, /^node scripts\/wishmachine\.js ideas draw --type outlinepack/);
  assert.match(replay, /--genre 悬疑/);
  assert.match(replay, /--seed 7/);
  assert.match(replay, /--chapters 4/);
  assert.match(replay, /--scenes 2/);
  assert.match(replay, /--target-chars 2200/);
  const tokens = replay.split(/\s+/);
  assert.equal(tokens[0], 'node');
  assert.equal(tokens[1], 'scripts/wishmachine.js');
  const run = spawnSync(process.execPath, [tokens[1], ...tokens.slice(2)], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  assert.equal(run.status, 0, run.stderr);
  const replayed = JSON.parse(run.stdout);
  assert.equal(replayed.ok, true);
  assert.equal(replayed.query.seed, 7);
  assert.equal(replayed.count, 1);
  assert.equal(replayed.results[0].id, draw.results[0].id);
  assert.equal(replayed.results[0].chapters.length, 4);

  const pack = drawIdeas({ type: 'worldpack', genre: '修仙', seed: 3, castCount: 0 });
  assert.match(pack.meta.replay_command, /--cast-count auto/);
  const packTokens = pack.meta.replay_command.split(/\s+/);
  const packRun = spawnSync(process.execPath, [packTokens[1], ...packTokens.slice(2)], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(packRun.status, 0, packRun.stderr);
  const replayedPack = JSON.parse(packRun.stdout);
  assert.equal(replayedPack.meta.cast.auto, true);
  assert.deepEqual(replayedPack.meta.cast.role_counts, pack.meta.cast.role_counts);

  const weighted = drawIdeas({
    type: 'worldpack', genre: '悬疑', seed: 5,
    castRoles: 'protagonist,antagonist,support', promptChars: 120, characterPromptChars: 60,
  });
  const weightedReplay = weighted.meta.replay_command;
  assert.match(weightedReplay, /--cast-roles protagonist,antagonist,support/);
  assert.match(weightedReplay, /--prompt-chars 120/);
  assert.match(weightedReplay, /--character-prompt-chars 60/);
  const weightedTokens = weightedReplay.split(/\s+/);
  const weightedRun = spawnSync(process.execPath, [weightedTokens[1], ...weightedTokens.slice(2)], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(weightedRun.status, 0, weightedRun.stderr);
  const replayedWeighted = JSON.parse(weightedRun.stdout);
  assert.equal(replayedWeighted.results[0].prompt_pack.positive, weighted.results[0].prompt_pack.positive);
  assert.deepEqual(
    replayedWeighted.results[0].cast.map((character) => character.role_tags[0]),
    weighted.results[0].cast.map((character) => character.role_tags[0]),
  );
});

test('query.count always matches the returned results and reductions warn', () => {
  const romance = drawIdeas({ type: 'worldpack', genre: '言情', count: 10, seed: 42 });
  assert.equal(romance.query.count, romance.results.length);
  assert.equal(romance.count, romance.results.length);
  const reduced = romance.meta.warning_details.find((detail) => detail.code === 'count.reduced');
  assert.ok(reduced, JSON.stringify(romance.meta.warning_details));
  assert.equal(reduced.applied, romance.results.length);
  assert.ok(romance.meta.warnings.some((warning) => warning.includes('count.reduced') || warning.includes('returning')));

  const events = drawIdeas({ type: 'event', count: 50, seed: 42 });
  assert.equal(events.query.count, events.results.length);
  assert.ok(events.results.length < 50);
  assert.ok(events.meta.warning_details.some((detail) => detail.code === 'count.reduced'));

  const clamped = drawIdeas({ type: 'namecard', count: 999, seed: 42 });
  assert.equal(clamped.results.length, 50);
  assert.equal(clamped.query.count, 50);
  assert.ok(clamped.meta.warning_details.some((detail) => detail.code === 'count.clamped'));
});

test('scene POV follows the protagonist role instead of the first cast entry', () => {
  const outline = drawIdeas({
    type: 'outlinepack', genre: '科幻', count: 1, seed: 11,
    chapters: 3, scenes: 2, volumes: 1,
    castRoles: 'support,antagonist,protagonist',
  }).results[0];
  const protagonist = outline.cast.find((character) => character.role_tags?.[0] === 'protagonist');
  assert.ok(protagonist);
  assert.notEqual(outline.cast[0].name, protagonist.name);
  for (const chapter of outline.chapters) {
    for (const scene of chapter.scenes) {
      assert.equal(scene.pov, protagonist.name);
    }
  }
  const setupLead = outline.setup_draft.core_cast.find((character) => character.role === 'protagonist');
  assert.equal(setupLead.name, protagonist.name);
  assert.equal(setupLead.importance, 10);
});

test('exhausted role pools warn while keeping the requested role assignment', () => {
  const draw = drawIdeas({
    type: 'worldpack', genre: '悬疑', count: 1, seed: 42,
    castRoles: 'protagonist,antagonist,antagonist,antagonist',
  });
  const cast = draw.results[0].cast;
  assert.deepEqual(cast.map((character) => character.role_tags[0]), ['protagonist', 'antagonist', 'antagonist', 'antagonist']);
  assert.equal(new Set(cast.map((character) => character.archetype)).size, cast.length);
  const mismatch = draw.meta.warning_details.find((detail) => detail.code === 'cast.role_archetype_mismatch');
  assert.ok(mismatch, JSON.stringify(draw.meta.warning_details));
  assert.equal(mismatch.requested_role, 'antagonist');
  assert.ok(mismatch.message.includes('antagonist'));
  assert.ok(draw.meta.warnings.some((warning) => warning.includes('antagonist')));
});

test('default deck auto cast yields protagonist, antagonist and supports', () => {
  const draw = drawIdeas({ type: 'worldpack', genre: '科幻', count: 1, seed: 42, castCount: 0 });
  const cast = draw.results[0].cast;
  const roles = cast.map((character) => character.role_tags[0]);
  assert.equal(draw.meta.cast.auto, true);
  assert.ok(cast.length >= 3);
  assert.ok(cast.length <= 12);
  assert.ok(roles.includes('protagonist'));
  assert.ok(roles.includes('antagonist'));
  assert.ok(roles.includes('support'));
  assert.equal(roles[0], 'protagonist');
  assert.ok(!draw.meta.warning_details.some((detail) => detail.code === 'cast.pool_exhausted'));
  const relationTypes = draw.results[0].cast_relations.map((relation) => relation.type);
  assert.ok(relationTypes.includes('counters'));
  assert.ok(relationTypes.includes('supports'));
});

test('selectDeck prefers compound romance genres over urban and history', () => {
  assert.equal(selectDeck('现代言情')?.name, 'romance');
  assert.equal(selectDeck('古代言情')?.name, 'romance');
  assert.equal(selectDeck('古言')?.name, 'romance');
  assert.equal(selectDeck('现代')?.name, 'urban');
  assert.equal(selectDeck('古代')?.name, 'history');
  assert.equal(drawIdeas({ type: 'premise', genre: '现代言情', count: 1, seed: 42 }).meta.deck, 'romance');
  assert.equal(drawIdeas({ type: 'premise', genre: '古代言情', count: 1, seed: 42 }).meta.deck, 'romance');
  assert.equal(drawIdeas({ type: 'premise', genre: '现代', count: 1, seed: 42 }).meta.deck, 'urban');
  assert.equal(drawIdeas({ type: 'premise', genre: '古代', count: 1, seed: 42 }).meta.deck, 'history');
});

test('seed 0 is a reproducible explicit seed', () => {
  const first = drawIdeas({ type: 'namecard', genre: '科幻', count: 3, seed: 0 });
  const second = drawIdeas({ type: 'namecard', genre: '科幻', count: 3, seed: 0 });
  assert.equal(first.query.seed, 0);
  assert.equal(first.meta.seed, 0);
  assert.deepEqual(first.results.map((item) => item.name), second.results.map((item) => item.name));
  const outlineFirst = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 0, chapters: 3 });
  const outlineSecond = drawIdeas({ type: 'outlinepack', genre: '悬疑', count: 1, seed: 0, chapters: 3 });
  assert.equal(outlineFirst.query.seed, 0);
  assert.deepEqual(outlineFirst.results[0].chapters.map((chapter) => chapter.id), outlineSecond.results[0].chapters.map((chapter) => chapter.id));
});

test('setup resource categories come from the deck-provided map', () => {
  const allowed = ['能源', '消耗品', '材料', '货币'];
  assert.equal(DECKS.xianxia.resourceCategories.神力资源, '能源');
  assert.equal(DECKS.xianxia.resourceCategories.消耗品, '消耗品');
  assert.ok(Object.values(DECKS.xianxia.resourceCategories).every((category) => allowed.includes(category)));
  assert.ok(Object.values(DECKS.romance.resourceCategories).every((category) => allowed.includes(category)));
  const xianxia = drawIdeas({ type: 'outlinepack', genre: '修仙', count: 8, seed: 42, chapters: 3, volumes: 1 });
  const categories = xianxia.results.flatMap((result) => result.setup_draft.world_resources.map((resource) => resource.category));
  assert.ok(categories.length > 0);
  assert.ok(categories.every((category) => allowed.includes(category)), categories.join(','));
  assert.ok(new Set(categories).size > 1, `categories should not all collapse to 材料: ${categories.join(',')}`);
  assert.ok(categories.includes('能源') || categories.includes('消耗品'), categories.join(','));
  const romance = drawIdeas({ type: 'outlinepack', genre: '言情', count: 4, seed: 42, chapters: 3, volumes: 1 });
  const romanceCategories = romance.results.flatMap((result) => result.setup_draft.world_resources.map((resource) => resource.category));
  assert.ok(romanceCategories.length > 0);
  assert.ok(romanceCategories.every((category) => allowed.includes(category)));
});

test('plotpack beat source ids reference ids instead of titles', () => {
  const plot = drawIdeas({ type: 'plotpack', genre: '悬疑', count: 1, seed: 42 }).results[0];
  const storyline = plot.storyline;
  const scenarioA = plot.scenarios[0];
  const scenarioB = plot.scenarios[1];
  assert.ok(plot.beats.every((beat) => beat.source_id));
  assert.equal(plot.beats[0].source_id, plot.worldpack_id);
  assert.equal(plot.beats[1].source_id, scenarioA.id);
  assert.equal(plot.beats[2].source_id, scenarioB.id);
  for (const beat of plot.beats.filter((item) => item.source === 'storyline')) {
    assert.equal(beat.source_id, storyline.id);
    assert.notEqual(beat.source_id, storyline.title);
  }
});

test('every resolved chapter mystery was planted first and event types stay varied', () => {
  const outline = drawCached({
    type: 'outlinepack', genre: '悬疑', count: 1, seed: 42,
    chapters: 10, scenes: 3, targetChars: 2000, volumes: 1,
  }).results[0];
  const planted = new Set();
  for (const chapter of outline.chapters) {
    for (const mystery of chapter.mysteries.planted) planted.add(mystery.id);
    for (const mystery of chapter.mysteries.resolved) {
      assert.ok(planted.has(mystery.id), `${chapter.id} resolves ${mystery.id} before it is planted`);
    }
  }
  const typeCounts = {};
  for (const chapter of outline.chapters) {
    for (const event of chapter.events) typeCounts[event.type] = (typeCounts[event.type] || 0) + 1;
  }
  const repeated = Object.entries(typeCounts).filter(([, count]) => count > 3);
  assert.deepEqual(repeated, [], JSON.stringify(typeCounts));
  assert.ok(outline.chapters.every((chapter) => chapter.events.length > 0));
});

test('saved outlinepack can be written through writeArtifact and passes checkProject', (t) => {
  const dir = tempDir(t);
  initProject({ name: 'alignment', dir, parts: 1, volumes: 1, chapter: 10 });
  const draw = drawCached({
    type: 'outlinepack', genre: '悬疑', count: 1, seed: 42,
    chapters: 10, scenes: 3, targetChars: 2000, volumes: 1,
  });
  const result = draw.results[0];
  const saved = saveIdeaDraw(loadProject(dir), draw);
  assert.ok(saved.saved.id);
  const setupWrite = writeArtifact(loadProject(dir), {
    section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(result.setup_draft),
  });
  assert.equal(setupWrite.applied, true, JSON.stringify(setupWrite.check?.findings || setupWrite.error));
  const outlineWrite = writeArtifact(loadProject(dir), {
    section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(result.draft_outline),
  });
  assert.equal(outlineWrite.applied, true, JSON.stringify(outlineWrite.check?.findings || outlineWrite.error));
  const check = checkProject(loadProject(dir), { profile: 'all' });
  const blocking = (check.findings || []).filter((finding) => ['medium', 'high', 'critical'].includes(finding.severity));
  assert.deepEqual(blocking, [], `generator/validator disagreement: ${JSON.stringify(blocking)}`);
});

test('compatibility duplicate fields are gone and graph is the single source of truth', () => {
  const worldpack = drawIdeas({ type: 'worldpack', genre: '修仙', count: 1, seed: 42 }).results[0];
  for (const field of ['prompt', 'negative_prompt', 'pack_id', 'entities', 'relations']) {
    assert.equal(field in worldpack, false, `worldpack should not expose ${field}`);
  }
  assert.ok(worldpack.prompt_pack.positive);
  assert.ok(worldpack.prompt_pack.negative);
  assert.ok(worldpack.graph.entities.length > 0);
  assert.ok(worldpack.graph.relations.length > 0);

  const plot = drawIdeas({ type: 'plotpack', genre: '修仙', count: 1, seed: 42 }).results[0];
  assert.equal('plot_id' in plot, false);
  assert.equal('events' in plot, false);
  assert.ok(plot.graph.entities.length > 0);

  const outlineDraw = drawIdeas({ type: 'outlinepack', genre: '修仙', count: 1, seed: 42, chapters: 3 });
  const outline = outlineDraw.results[0];
  assert.equal('outline_id' in outline, false);
  assert.ok(outline.graph.entities.length > 0);
  assert.equal('result' in outline.chapters[0].scenes[0], false);
  assert.equal('mystery' in outline.chapters[0].mysteries.planted[0], false);
  for (const field of ['category', 'level', 'mode']) {
    assert.equal(field in outlineDraw.query, false, `query should not expose ${field}`);
  }
  assert.ok(ideasTypes().some((entry) => entry.name === 'outlinepack'));
});
