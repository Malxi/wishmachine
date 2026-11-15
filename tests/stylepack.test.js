// Stylepack (narrative voice) draws: deterministic like name cards, never two voices from the
// same family in one draw, and a genre deck without its own voices falls back to the default deck.
import test from 'node:test';
import assert from 'node:assert/strict';
import { drawIdeas } from '../scripts/ideas.js';
import { VOICES } from '../scripts/decks/voices.js';

function draw(extra = {}) {
  return drawIdeas({ type: 'stylepack', count: 2, seed: 7319, genre: '悬疑', ...extra });
}

test('stylepack draw is deterministic per seed', () => {
  const a = draw();
  const b = draw();
  assert.equal(a.results.length, 2);
  assert.deepEqual(a.results.map((card) => card.style_id), b.results.map((card) => card.style_id));
});

test('stylepack never returns two voices of the same family', () => {
  for (const seed of [1, 42, 7319, 99999]) {
    const { results } = draw({ count: 4, seed });
    const families = results.map((card) => card.family);
    assert.equal(new Set(families).size, families.length, `duplicate family in seed ${seed}: ${families.join(',')}`);
  }
});

test('every stylepack card carries the full register plus public-domain samples', () => {
  const { results } = draw({ count: 3 });
  for (const card of results) {
    for (const key of ['label', 'family']) {
      assert.ok(String(card[key] || '').length > 0, `${card.style_id} is missing ${key}`);
    }
    for (const key of ['voice', 'register', 'rhythm', 'imagery', 'advance']) {
      assert.ok(String(card[key] || '').length > 4, `${card.style_id} is missing ${key}`);
    }
    assert.ok(Array.isArray(card.sample_ids) && card.sample_ids.length > 0, `${card.style_id} must carry sample ids`);
  }
  assert.ok(VOICES.length >= 6, 'the deck needs enough voices for variety');
});

test('a genre deck without voices still draws from the default deck', () => {
  const { results } = draw({ genre: '悬疑' });
  assert.ok(results.length > 0, 'suspense deck has no voices; draw must fall back, not return nothing');
  assert.ok(results.every((card) => VOICES.some((voice) => voice.id === card.style_id)));
});
