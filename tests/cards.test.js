// JSON card pool + combo engine: schema stats, deterministic draw, genre filter,
// strategy ranking, avoid lists and CLI exposure.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cardStats, drawCombos, drawIdeas, ideasTypes, loadCardPool, validateCardPool } from '../scripts/ideas.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'scripts', 'wishmachine.js');

test('card pool validates and reports sources and licenses', () => {
  const validation = validateCardPool();
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  assert.ok(validation.cards >= 80);
  assert.ok(validation.packs.archetypes >= 20);
  const stats = cardStats();
  assert.ok(stats.cards >= 80);
  assert.ok(stats.tags > 40);
  assert.ok(stats.missing_source_or_license.length === 0);
  assert.ok(stats.sources.includes('CMU Movie Summary Corpus'));
  assert.ok(stats.sources.includes('Project Gutenberg'));
  const pool = loadCardPool();
  assert.ok(pool.packs.engines.length >= 12);
});

test('combo draw is deterministic and ranked by score', () => {
  const first = drawCombos({ genre: '科幻', seed: 88, count: 3, strategy: 'diverse' });
  const second = drawCombos({ genre: '科幻', seed: 88, count: 3, strategy: 'diverse' });
  assert.equal(first.length, 3);
  assert.deepEqual(first.map((item) => item.id), second.map((item) => item.id));
  assert.ok(first.every((item) => item.logline.length > 0));
  assert.ok(first.every((item) => item.components.archetypes && item.components.engines && item.components.costs));
  assert.ok(first.every((item) => item.rank >= 1));
  assert.ok(first[0].score >= first[1].score);
  assert.ok(first.every((item) => item.sources.length > 0 && item.licenses.length > 0));
});

test('combo draw filters candidates by genre and avoids requested ids', () => {
  const combos = drawCombos({ genre: '科幻', seed: 7, count: 3 });
  assert.ok(combos.every((item) => Object.values(item.components).some((card) => (card.genres || []).includes('科幻'))));
  const avoidId = combos[0].components.archetypes.id;
  const avoided = drawCombos({ genre: '科幻', seed: 7, count: 3, avoid: [avoidId] });
  assert.ok(avoided.every((item) => item.components.archetypes.id !== avoidId));
});

test('combo type is exposed through drawIdeas without a genre fallback warning', () => {
  const types = ideasTypes().map((item) => item.name);
  assert.ok(types.includes('combo'));
  const draw = drawIdeas({ type: 'combo', genre: '科幻', seed: 88, count: 2 });
  assert.equal(draw.query.type, 'combo');
  assert.equal(draw.count, 2);
  assert.ok(!draw.meta.warnings.some((warning) => warning.includes('unknown genre')));
  assert.ok(draw.results.every((item) => item.components && item.score > 0));
});

test('ideas cards and ideas draw --type combo work from the CLI', () => {
  const cards = spawnSync(process.execPath, [cli, 'ideas', 'cards'], { cwd: root, encoding: 'utf8' });
  assert.equal(cards.status, 0, cards.stderr);
  const stats = JSON.parse(cards.stdout);
  assert.ok(stats.cards >= 80);
  const draw = spawnSync(process.execPath, [
    cli, 'ideas', 'draw', '--type', 'combo', '--genre', '科幻', '--count', '2', '--seed', '88',
  ], { cwd: root, encoding: 'utf8' });
  assert.equal(draw.status, 0, draw.stderr);
  const result = JSON.parse(draw.stdout);
  assert.equal(result.results.length, 2);
  assert.equal(result.query.type, 'combo');
});
