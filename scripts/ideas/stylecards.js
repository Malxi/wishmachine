// Stylecard (voice) draws: deterministic book-level prose voices, with family/genre guards so a
// single book never mixes two clashing registers. Mirrors namecards: pooled cards, de-dup sets,
// seeded rng, and a reduced-count warning instead of a silent short list.
import { DECKS, DEFAULT_DECK } from '../decks/index.js';
import { pick } from '../util.js';
import { addWarning, resultId } from './shared.js';

function fitsGenre(card, genre) {
  if (!genre) return true;
  const fits = Array.isArray(card.fits) ? card.fits : [];
  if (fits.length === 0) return true;
  return fits.some((tag) => genre.includes(tag) || tag.includes(genre));
}

function stylecards({
  rng, seed, count, genre = '', deckName = 'default', warnings = null,
}) {
  const deck = DECKS[deckName] || DEFAULT_DECK;
  // Voices are about prose register, not about genre: a genre deck without its own voices falls
  // back to the default deck instead of returning nothing.
  const deckVoices = Array.isArray(deck.voices) && deck.voices.length > 0
    ? deck.voices
    : (Array.isArray(DEFAULT_DECK.voices) ? DEFAULT_DECK.voices : []);
  const pool = deckVoices;
  if (pool.length === 0) {
    addWarning(warnings, {
      code: 'stylepack.empty',
      severity: 'info',
      message: `deck ${deck.name} has no voice cards; nothing drawn`,
    });
    return [];
  }
  const usedIds = new Set();
  const usedFamilies = new Set();
  const results = [];
  for (let i = 0; i < count; i += 1) {
    const byGenre = pool.filter((card) => fitsGenre(card, genre));
    const base = byGenre.length > 0 ? byGenre : pool;
    const freshFamily = base.filter((card) => !usedIds.has(card.id) && !usedFamilies.has(card.family));
    const freshId = base.filter((card) => !usedIds.has(card.id));
    const candidates = freshFamily.length > 0 ? freshFamily : (freshId.length > 0 ? freshId : base);
    const card = pick(rng, candidates);
    usedIds.add(card.id);
    usedFamilies.add(card.family);
    results.push({
      id: resultId('stylepack', seed, i),
      style_id: card.id,
      label: card.label,
      family: card.family,
      voice: card.voice,
      register: card.register,
      rhythm: card.rhythm,
      imagery: card.imagery,
      advance: card.advance,
      fits_genres: card.fits || [],
      sample_ids: card.samples || [],
      rhythm_target: card.rhythm_target || null,
      imagery_lexicon: card.imagery_lexicon || null,
    });
  }
  if (results.length < count) {
    addWarning(warnings, {
      code: 'count.reduced',
      severity: 'info',
      message: `count ${count} exceeded the available ${deck.name} voice cards; returning ${results.length}`,
    });
  }
  return results;
}

export { stylecards };
