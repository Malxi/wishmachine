// Card-pool engine: JSON card packs under data/cards, deterministic combination
// draw, filtering by genre/tags, scoring and ranking. The engine is pure: no
// project/state imports and no network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashSeed, mulberry32, pick } from '../util.js';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'cards');
const PACK_NAMES = ['archetypes', 'engines', 'settings', 'twists', 'costs', 'motifs', 'genres'];
const COMBO_PACKS = ['archetypes', 'engines', 'settings', 'twists', 'costs', 'motifs'];
const REQUIRED_FIELDS = ['id', 'name', 'summary'];
const STRATEGIES = ['balanced', 'focused', 'diverse', 'wild', 'safe'];
const STRATEGY_WEIGHTS = {
  balanced: { genre: 0.25, contradiction: 0.2, specificity: 0.15, novelty: 0.2, cohesion: 0.2 },
  focused: { genre: 0.45, contradiction: 0.1, specificity: 0.15, novelty: 0.1, cohesion: 0.2 },
  diverse: { genre: 0.2, contradiction: 0.15, specificity: 0.1, novelty: 0.35, cohesion: 0.2 },
  wild: { genre: 0.1, contradiction: 0.3, specificity: 0.15, novelty: 0.3, cohesion: 0.15 },
  safe: { genre: 0.35, contradiction: 0.1, specificity: 0.25, novelty: 0.05, cohesion: 0.25 },
};
const cache = new Map();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function packPath(root, name) {
  return path.join(root, `${name}.json`);
}

function loadPack(root, name) {
  const file = packPath(root, name);
  if (!fs.existsSync(file)) throw new Error(`card pack not found: ${name}.json under ${root}`);
  const doc = readJson(file);
  const errors = validatePack(name, doc);
  if (errors.length) throw new Error(`card pack ${name}.json is invalid: ${errors.join('; ')}`);
  return doc.cards;
}

function validatePack(name, doc) {
  const errors = [];
  if (!isObject(doc)) return [`${name}: pack must be an object`];
  if (!Array.isArray(doc.cards) || doc.cards.length === 0) errors.push(`${name}: cards must be a non-empty array`);
  const ids = new Set();
  for (const [index, card] of asArray(doc.cards).entries()) {
    if (!isObject(card)) {
      errors.push(`${name}[${index}] must be an object`);
      continue;
    }
    for (const field of REQUIRED_FIELDS) {
      if (typeof card[field] !== 'string' || !card[field].trim()) errors.push(`${name}[${index}].${field} must be a non-empty string`);
    }
    if (card.id && ids.has(card.id)) errors.push(`${name}: duplicate card id ${card.id}`);
    ids.add(card.id);
    if (card.tags !== undefined && (!Array.isArray(card.tags) || card.tags.some((tag) => typeof tag !== 'string'))) {
      errors.push(`${name}[${index}].tags must be an array of strings`);
    }
    if (card.genres !== undefined && (!Array.isArray(card.genres) || card.genres.some((genre) => typeof genre !== 'string'))) {
      errors.push(`${name}[${index}].genres must be an array of strings`);
    }
  }
  return errors;
}

export function loadCardPool(root = DEFAULT_ROOT) {
  if (cache.has(root)) return cache.get(root);
  if (!fs.existsSync(root)) throw new Error(`card pool directory not found: ${root}`);
  const packs = {};
  for (const name of PACK_NAMES) packs[name] = loadPack(root, name);
  const manifest = fs.existsSync(path.join(root, 'manifest.json')) ? readJson(path.join(root, 'manifest.json')) : null;
  const pool = { root, manifest, packs };
  cache.set(root, pool);
  return pool;
}

export function clearCardPoolCache() {
  cache.clear();
}

export function validateCardPool(root = DEFAULT_ROOT) {
  try {
    const pool = loadCardPool(root);
    const ids = new Set();
    for (const cards of Object.values(pool.packs)) {
      for (const card of cards) {
        if (ids.has(card.id)) return { ok: false, errors: [`duplicate id across packs: ${card.id}`] };
        ids.add(card.id);
      }
    }
    return { ok: true, packs: Object.fromEntries(Object.entries(pool.packs).map(([name, cards]) => [name, cards.length])), cards: ids.size };
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }
}

function genresOf(card) {
  return asArray(card.genres).map((genre) => String(genre).trim()).filter(Boolean);
}

function tagsOf(card) {
  return asArray(card.tags).map((tag) => String(tag).trim()).filter(Boolean);
}

function resolveGenreTargets(pool, query) {
  const text = String(query || '').trim();
  if (!text) return [];
  const targets = new Set([text]);
  for (const genre of pool.packs.genres || []) {
    const names = [genre.name, ...asArray(genre.aliases)].filter(Boolean);
    if (names.some((name) => name.toLowerCase() === text.toLowerCase())) {
      for (const name of names) targets.add(String(name));
    }
  }
  return [...targets];
}

function matchesGenre(card, targets) {
  if (!targets.length) return true;
  const genres = genresOf(card);
  return genres.some((genre) => targets.some((target) => genre.toLowerCase() === target.toLowerCase()));
}

function tagFrequency(cards) {
  const frequency = new Map();
  for (const card of cards) for (const tag of tagsOf(card)) frequency.set(tag, (frequency.get(tag) || 0) + 1);
  return frequency;
}

function rarityScore(cards, frequency) {
  const tags = [...new Set(cards.flatMap(tagsOf))];
  if (!tags.length) return 0.5;
  return tags.reduce((sum, tag) => sum + 1 / (frequency.get(tag) || 1), 0) / tags.length;
}

function cohesionScore(cards) {
  const tagSets = cards.map((card) => new Set(tagsOf(card)));
  const union = new Set(tagSets.flatMap((set) => [...set]));
  if (!union.size) return 0;
  const shared = [...union].filter((tag) => tagSets.filter((set) => set.has(tag)).length >= 2).length;
  return shared / union.size;
}

function genreFitScore(cards, targets) {
  if (!targets.length) return 0.6;
  let hits = 0;
  let possible = 0;
  for (const card of cards) {
    const genres = genresOf(card);
    if (!genres.length) continue;
    possible += 1;
    if (genres.some((genre) => targets.some((target) => genre.toLowerCase() === target.toLowerCase()))) hits += 1;
  }
  return possible ? hits / possible : 0.5;
}

function scoreCombination(parts, context) {
  const { strategy, targets, frequency } = context;
  const cards = COMBO_PACKS.map((name) => parts[name]).filter(Boolean);
  const genre = genreFitScore(cards, targets);
  const contradiction = parts.archetypes?.contradiction ? 1 : 0.4;
  const specificity = cards.reduce((sum, card) => sum + (Number(card.specificity) || 1), 0) / (cards.length * 3);
  const novelty = rarityScore(cards, frequency);
  const cohesion = cohesionScore(cards);
  const weights = STRATEGY_WEIGHTS[strategy] || STRATEGY_WEIGHTS.balanced;
  const score = genre * weights.genre + contradiction * weights.contradiction
    + specificity * weights.specificity + novelty * weights.novelty + cohesion * weights.cohesion;
  return {
    score: round(score),
    why: [
      `genre ${round(genre)}`,
      `contradiction ${round(contradiction)}`,
      `specificity ${round(specificity)}`,
      `novelty ${round(novelty)}`,
      `cohesion ${round(cohesion)}`,
    ],
  };
}

function avoidHit(card, avoid) {
  if (!avoid.size) return false;
  if (avoid.has(card.id) || avoid.has(card.name)) return true;
  return tagsOf(card).some((tag) => avoid.has(tag));
}

function pickPart(pack, rng, targets, avoid) {
  const filtered = pack.filter((card) => matchesGenre(card, targets) && !avoidHit(card, avoid));
  const pool = filtered.length ? filtered : pack.filter((card) => !avoidHit(card, avoid));
  return pool.length ? pick(rng, pool) : null;
}

function buildLogline(parts) {
  const archetype = parts.archetypes;
  const engine = parts.engines;
  const setting = parts.settings;
  const twist = parts.twists;
  const cost = parts.costs;
  const motif = parts.motifs;
  return `${archetype.name}在${setting.name}里，被「${engine.name}」推着走：${engine.stakes}。中途转向「${twist.name}」，代价落在「${cost.name}」，母题是「${motif.name}」。`;
}

function buildCombination(parts, context) {
  const scored = scoreCombination(parts, context);
  const components = Object.fromEntries(COMBO_PACKS.map((name) => [name, parts[name]]));
  const tags = [...new Set(Object.values(components).flatMap(tagsOf))].slice(0, 12);
  const sources = [...new Set(Object.values(components).map((card) => card.source).filter(Boolean))];
  const licenses = [...new Set(Object.values(components).map((card) => card.license).filter(Boolean))];
  return {
    id: `combo-${context.seed}-${context.index + 1}`,
    title: `${parts.archetypes.name}·${parts.engines.name}`,
    logline: buildLogline(parts),
    score: scored.score,
    why: scored.why,
    tags,
    components,
    sources,
    licenses,
  };
}

export function drawCombos(options = {}) {
  const pool = loadCardPool(options.root || DEFAULT_ROOT);
  const seed = Number.isFinite(Number(options.seed)) ? Math.trunc(Number(options.seed)) : 1;
  const count = Math.max(1, Math.min(10, Number(options.count) || 3));
  const strategy = STRATEGIES.includes(options.strategy) ? options.strategy : 'balanced';
  const targets = resolveGenreTargets(pool, options.genre);
  const avoid = new Set(asArray(options.avoid).flatMap((item) => String(item).split(',')).map((item) => item.trim()).filter(Boolean));
  const frequency = tagFrequency(Object.values(pool.packs).flat());
  const rng = mulberry32(hashSeed(`${seed}:combo:${strategy}:${targets.join('|')}:${[...avoid].sort().join('|')}`));
  const context = { seed, strategy, targets, frequency };
  const wanted = Math.max(count, Math.min(40, Number(options.candidates) || count * 4));
  const combinations = [];
  const seen = new Set();
  for (let attempt = 0; attempt < wanted * 12 && combinations.length < wanted; attempt += 1) {
    const parts = Object.fromEntries(COMBO_PACKS.map((name) => [name, pickPart(pool.packs[name], rng, targets, avoid)]));
    if (Object.values(parts).some((card) => !card)) continue;
    const key = COMBO_PACKS.map((name) => parts[name].id).join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    combinations.push(buildCombination(parts, { ...context, index: combinations.length }));
  }
  combinations.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return combinations.slice(0, count).map((combo, index) => ({ ...combo, rank: index + 1 }));
}

export function cardStats(root = DEFAULT_ROOT) {
  const pool = loadCardPool(root);
  const all = Object.values(pool.packs).flat();
  const tags = tagFrequency(all);
  const missing = all.filter((card) => !card.source || !card.license).map((card) => card.id);
  const byLicense = {};
  for (const card of all) byLicense[card.license || 'missing'] = (byLicense[card.license || 'missing'] || 0) + 1;
  return {
    root: pool.root,
    packs: Object.fromEntries(Object.entries(pool.packs).map(([name, cards]) => [name, cards.length])),
    cards: all.length,
    tags: tags.size,
    top_tags: [...tags.entries()].sort((left, right) => right[1] - left[1]).slice(0, 12).map(([tag, count]) => ({ tag, count })),
    missing_source_or_license: missing,
    licenses: byLicense,
    sources: pool.manifest?.sources?.map((source) => source.name) || [],
  };
}

export { COMBO_PACKS, DEFAULT_ROOT, PACK_NAMES, STRATEGIES, validatePack };
