// drawIdeas dispatch + ideasTypes: type resolution, seeding, warnings and replay command.
import { DEFAULT_DECK, MOTIFS, selectDeck } from '../decks/index.js';
import { hashSeed, mulberry32, pickMany } from '../util.js';
import {
  COMPOSITE_IDEA_TYPES,
  TYPES,
  addWarning,
  clampNumber,
  resultId,
} from './shared.js';
import { resolveCastPlan } from './cast-plan.js';
import { buildMultiVolumeOutlinePack } from './outlinepack.js';
import { buildPlotpack } from './plotpack.js';
import { buildWorldpack } from './worldpack.js';
import { namecards } from './namecards.js';

export function ideasTypes() {
  return TYPES.map((name) => ({ name }));
}

// ---------------------------------------------------------------------------
// draw
// ---------------------------------------------------------------------------

function quoteArg(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text}"` : text;
}

// The replay command must be runnable as-is from a shell inside the repo.
function buildReplayCommand(type, options, seed, count) {
  const parts = ['node scripts/wishmachine.js ideas draw', `--type ${type}`];
  const add = (flag, value) => parts.push(`--${flag} ${quoteArg(value)}`);
  if (options.genre) add('genre', options.genre);
  if (options.source) add('source', options.source);
  add('seed', seed);
  add('count', count);
  const numeric = (flag, key) => {
    if (options[key] === undefined || options[key] === null || options[key] === '') return;
    const value = Number(options[key]);
    if (Number.isFinite(value)) add(flag, value);
  };
  numeric('chapters', 'chapters');
  numeric('scenes', 'scenes');
  numeric('target-chars', 'targetChars');
  numeric('volumes', 'volumes');
  numeric('chapters-per-volume', 'chaptersPerVolume');
  if (options.castCount === 'auto' || options.castCount === 0 || options.castCount === '0') {
    add('cast-count', 'auto');
  } else {
    numeric('cast-count', 'castCount');
  }
  if (Array.isArray(options.castRoles)) {
    if (options.castRoles.length > 0) add('cast-roles', options.castRoles.join(','));
  } else if (String(options.castRoles || '').trim()) {
    add('cast-roles', String(options.castRoles).trim());
  }
  numeric('prompt-chars', 'promptChars');
  numeric('character-prompt-chars', 'characterPromptChars');
  return parts.join(' ');
}

function resolveSeed(options) {
  const raw = options.seed;
  const numeric = raw === undefined || raw === null || raw === '' ? NaN : Number(raw);
  if (Number.isFinite(numeric)) return Math.trunc(numeric);
  return Math.floor(Math.random() * 2147483646) + 1;
}

function resolveCount(type, requested) {
  const composite = COMPOSITE_IDEA_TYPES.has(type);
  const defaultCount = composite ? 1 : 5;
  const maxCount = composite ? 10 : 50;
  const raw = requested === undefined || requested === null || requested === ''
    ? defaultCount
    : Number(requested);
  const requestedCount = Number.isFinite(raw) ? Math.floor(raw) : defaultCount;
  const count = Math.max(1, Math.min(maxCount, requestedCount));
  return { count, requestedCount, maxCount, defaultCount };
}

function drawWorldpackResults(context) {
  const { options, count, seed, rng, deck, warningSink } = context;
  const plan = resolveCastPlan(deck, options, warningSink);
  const castMeta = {
    auto: plan.autoCast,
    count: plan.castCount,
    pool_size: plan.poolSize,
    role_counts: plan.roleCounts,
  };
  const selected = pickMany(rng, deck.packs, Math.min(count, deck.packs.length));
  const characterPromptChars = clampNumber(options.characterPromptChars, 40, 500, 160);
  const results = selected.map((def, packIndex) => {
    const cast = namecards({
      rng,
      seed: seed + packIndex,
      count: plan.castCount,
      roles: plan.castRoles,
      deckName: deck.name,
      promptChars: characterPromptChars,
      warnings: warningSink,
    });
    return buildWorldpack({ def, packIndex, seed, cast, sources: deck, options });
  });
  castMeta.archetypes = [...new Set(results.flatMap((item) => item.cast.map((character) => character.archetype)))];
  castMeta.archetype_roles = results[0]?.cast.reduce((roles, character) => {
    roles[character.archetype] = character.role_tags?.[0] || 'support';
    return roles;
  }, {}) || {};
  return { results, castMeta };
}

function drawPlotpackResults(context) {
  const { options, count, seed } = context;
  const plots = [];
  for (let index = 0; index < count; index += 1) {
    const world = drawIdeas({ ...options, type: 'worldpack', count: 1, seed: seed + index });
    const plot = buildPlotpack(world.results[0], seed + index, index);
    plot.genre = String(options.genre || '');
    plots.push(plot);
  }
  return { results: plots, castMeta: null };
}

function drawOutlinepackResults(context) {
  const { options, count, seed, deck } = context;
  const outlines = [];
  for (let index = 0; index < count; index += 1) {
    const plot = drawIdeas({ ...options, type: 'plotpack', count: 1, seed: seed + index });
    outlines.push(buildMultiVolumeOutlinePack(plot.results[0], seed + index, { ...options, index, deck }));
  }
  return { results: outlines, castMeta: null };
}

function buildSimpleCardFactories(context) {
  const { options, count, seed, rng, deck } = context;
  const listCards = (prefix, list, decorate) => pickMany(rng, list, Math.min(count, list.length))
    .map((item, index) => ({ id: resultId(prefix, seed, index), ...item, ...(decorate ? decorate(item) : {}) }));
  const premiseCards = (prefix) => pickMany(rng, deck.premises, Math.min(count, deck.premises.length))
    .map((item, index) => ({
      id: resultId(prefix, seed, index),
      title: item.title,
      statement: item.statement,
      surface_rule: item.surface_rule,
      hidden_truth: item.hidden_truth,
      scarcity: item.scarcity,
      central_conflict: item.conflict,
      protagonist_leverage: item.leverage,
      counter_expectation: item.counter,
    }));
  return {
    engine: () => listCards('engine', deck.engines, () => ({ reference_id: options.source || 'wishmachine' })),
    location: () => listCards('location', deck.locations),
    faction: () => listCards('faction', deck.factions),
    equipment: () => listCards('equipment', deck.equipment),
    resource: () => listCards('resource', deck.resources),
    itemcard: () => listCards('itemcard', deck.resources),
    provocation: () => listCards('provocation', deck.provocations || DEFAULT_DECK.provocations),
    law: () => listCards('law', deck.laws || DEFAULT_DECK.laws),
    event: () => listCards('event', deck.events || DEFAULT_DECK.events),
    storyline: () => listCards('storyline', deck.storylines),
    motif: () => listCards('motif', MOTIFS),
    scenario: () => listCards('scenario', deck.scenarios),
    reference: () => listCards('reference', deck.scenarios),
    premise: () => premiseCards('premise').map((item) => ({ ...item, reference_id: options.source || 'wishmachine' })),
    axiom: () => premiseCards('axiom'),
  };
}

function drawSimpleCardResults(type, context) {
  const factory = buildSimpleCardFactories(context)[type];
  if (!factory) throw new Error(`unsupported ideas type: ${type}; use one of ${TYPES.join(', ')}`);
  return { results: factory(), castMeta: null };
}

function drawByType(type, context) {
  if (type === 'worldpack') return drawWorldpackResults(context);
  if (type === 'plotpack') return drawPlotpackResults(context);
  if (type === 'outlinepack') return drawOutlinepackResults(context);
  if (type === 'namecard' || type === 'name' || type === 'cast') {
    const { rng, seed, count, deck, warningSink } = context;
    return {
      results: namecards({ rng, seed, count, deckName: deck.name, warnings: warningSink }),
      castMeta: null,
    };
  }
  return drawSimpleCardResults(type, context);
}

function buildDrawResult(type, context, drawn) {
  const { options, seed, deck, warningSink, count } = context;
  const { results, castMeta } = drawn;
  if (results.length < count) {
    addWarning(warningSink, {
      code: 'count.reduced',
      severity: 'info',
      message: `count ${count} exceeded the available ${deck.name} ${type} cards; returning ${results.length}`,
      requested: count,
      applied: results.length,
    });
  }
  return {
    ok: true,
    section: 'ideas',
    query: {
      type,
      genre: options.genre || '',
      deck: deck.name,
      count: results.length,
      seed,
      source: options.source || '',
      chapters: Number(options.chapters) || null,
      scenes: Number(options.scenes) || null,
      target_chars: Number(options.targetChars) || null,
      volumes: Number(options.volumes) || null,
      chapters_per_volume: Number(options.chaptersPerVolume) || null,
    },
    count: results.length,
    results,
    meta: {
      genre: options.genre || '',
      deck: deck.name,
      mode: type,
      seed,
      warnings: warningSink.warnings,
      warning_details: warningSink.warningDetails,
      cast: castMeta,
      replay_command: buildReplayCommand(type, options, seed, results.length),
      usage: [
        'Use names and traits as reference, not as fixed canon.',
        'Keep the seed to reproduce the draw.',
        'Do not write draw results into novel.json directly; turn them into setup/outline artifacts.',
      ],
    },
  };
}

export function drawIdeas(options = {}) {
  const type = String(options.type || 'namecard').toLowerCase();
  const warningSink = { warnings: [], warningDetails: [] };
  const { count, requestedCount, maxCount } = resolveCount(type, options.count);
  if (count !== requestedCount) {
    addWarning(warningSink, {
      code: 'count.clamped',
      severity: 'info',
      message: `count ${requestedCount} was clamped to ${count} (allowed 1..${maxCount} for ${type})`,
      requested: requestedCount,
      applied: count,
    });
  }
  const seed = resolveSeed(options);
  const rng = mulberry32(hashSeed(`${seed}:${type}:${options.genre || ''}`));
  const requestedGenre = String(options.genre || '').trim();
  const matchedDeck = selectDeck(requestedGenre);
  if (requestedGenre && !matchedDeck) {
    addWarning(warningSink, {
      code: 'genre.fallback',
      severity: 'warning',
      message: `unknown genre "${requestedGenre}"; using the default sci-fi deck (known genres: 科幻/修仙/悬疑/都市/历史/言情)`,
    });
  }
  const deck = matchedDeck || DEFAULT_DECK;
  const context = { options, count, seed, rng, deck, warningSink };
  return buildDrawResult(type, context, drawByType(type, context));
}
