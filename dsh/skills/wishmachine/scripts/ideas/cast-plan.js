// Cast planning for worldpack draws: role resolution, auto-cast ordering, pool
// warnings. Kept separate from draw.js so the dispatch/envelope file stays small
// and cast rules can be edited without touching type routing.
import { GENRE_ARCHETYPE_POOLS, ROLE_NAMES } from '../decks/index.js';
import { ALLOWED_CAST_ROLES, addWarning } from './shared.js';

function autoCastRoles(deck) {
  const genrePool = GENRE_ARCHETYPE_POOLS[deck.name] || null;
  const roleBuckets = genrePool
    ? ROLE_NAMES.map((role) => genrePool.filter((item) => (item.roles || []).includes(role)).map(() => role))
    : ROLE_NAMES.map((role) => ((deck.roleArchetypes || {})[role] || []).map(() => role));
  const ordered = [];
  const longest = Math.max(0, ...roleBuckets.map((bucket) => bucket.length));
  for (let index = 0; index < longest; index += 1) {
    for (const bucket of roleBuckets) {
      if (index < bucket.length) ordered.push(bucket[index]);
    }
  }
  return ordered;
}

function resolveCastPlan(deck, options, warningSink) {
  const explicitRoles = (Array.isArray(options.castRoles) ? options.castRoles : String(options.castRoles || '').split(','))
    .map((role) => String(role || '').trim())
    .filter((role) => ALLOWED_CAST_ROLES.has(role));
  const rawCastCount = options.castCount;
  const autoRequested = rawCastCount === 'auto' || rawCastCount === 0 || rawCastCount === '0';
  const autoCast = explicitRoles.length === 0 && autoRequested;
  const genrePool = GENRE_ARCHETYPE_POOLS[deck.name] || null;
  const poolSize = genrePool ? genrePool.length : (deck.archetypes || []).length;
  const autoRoles = autoCastRoles(deck);
  const requestedCount = Number(rawCastCount);
  const fallbackCount = Number.isFinite(requestedCount) && requestedCount > 0 ? requestedCount : 4;
  const castCount = autoCast
    ? Math.max(1, Math.min(12, autoRoles.length || poolSize || 4))
    : Math.max(1, Math.min(12, explicitRoles.length || fallbackCount));
  const castRoles = autoCast
    ? autoRoles.slice(0, castCount)
    : explicitRoles.length
      ? explicitRoles.slice(0, castCount)
      : Array.from({ length: castCount }, (_, index) => (index === 0 ? 'protagonist' : index === 1 ? 'antagonist' : 'support'));
  if (!castRoles.includes('protagonist')) {
    castRoles[0] = 'protagonist';
    addWarning(warningSink, {
      code: 'cast.protagonist_autofix',
      severity: 'warning',
      message: 'cast-roles had no protagonist; the first role was changed to protagonist',
    });
  }
  if (!autoCast && castCount > poolSize) {
    addWarning(warningSink, {
      code: 'cast.pool_exhausted',
      severity: 'info',
      message: `cast count ${castCount} exceeds the ${deck.name} archetype pool (${poolSize}); some archetypes will repeat`,
      cast_count: castCount,
      pool_size: poolSize,
      recommended_cast_count: poolSize,
    });
  }
  return {
    autoCast,
    castCount,
    poolSize,
    castRoles,
    roleCounts: castRoles.reduce((counts, role) => {
      counts[role] = (counts[role] || 0) + 1;
      return counts;
    }, {}),
  };
}

export { resolveCastPlan };
