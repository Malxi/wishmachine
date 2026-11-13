// Shared constants and small pure helpers for the idea-card generators.
// Card data itself lives in scripts/decks/*.
import { ROLE_NAMES } from '../decks/index.js';

const TYPES = [
  'provocation', 'axiom', 'event', 'law', 'scenario', 'engine',
  'worldpack', 'plotpack', 'outlinepack', 'premise', 'storyline', 'cast', 'namecard',
  'resource', 'equipment', 'itemcard', 'location', 'faction', 'motif', 'reference', 'name',
];

const COMPOSITE_IDEA_TYPES = new Set(['worldpack', 'plotpack', 'outlinepack']);
const ALLOWED_CAST_ROLES = new Set(ROLE_NAMES);
const SETUP_RESOURCE_CATEGORIES = new Set(['能源', '消耗品', '材料', '货币']);

// Narrative event-type palette: varied enough that a volume never repeats one
// event type more than three times (quality.outline.event_repetition).
const EVENT_TYPE_PALETTE = [
  'plot', 'choice', 'complication', 'reversal', 'consequence', 'reveal',
  'pressure', 'turn', 'decision', 'cost', 'discovery', 'confrontation',
  'sacrifice', 'negotiation', 'escape', 'betrayal', 'rescue', 'ritual',
  'chase', 'standoff',
];

const PACE_BY_FUNCTION = {
  setup: 'slow build',
  inciting: 'rising',
  midpoint: 'turn',
  crisis: 'high pressure',
  climax: 'climax',
  resolution: 'falling',
};

function truncatePrompt(rawPrompt, maxChars) {
  if (rawPrompt.length <= maxChars) return rawPrompt;
  const head = rawPrompt.slice(0, maxChars - 1);
  const breakAt = Math.max(head.lastIndexOf('，'), head.lastIndexOf(','), head.lastIndexOf(' / '));
  return `${(breakAt > maxChars * 0.5 ? head.slice(0, breakAt) : head).trimEnd()}…`;
}

function resultId(prefix, seed, index) {
  return `${prefix}-${seed}-${String(index + 1).padStart(2, '0')}`;
}

function findCard(list, key, value) {
  return (list || []).find((item) => item[key] === value);
}

function addWarning(sink, detail) {
  sink.warnings.push(detail.message);
  sink.warningDetails.push(detail);
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  // Treat 0 like a missing option: callers use 0 as "auto" (e.g. --chapters-per-volume 0).
  if (!Number.isFinite(number) || number === 0) return fallback;
  return Math.max(min, Math.min(max, number));
}

function buildCastPromptMeta(rawPrompt, maxChars) {
  return {
    max_chars: maxChars,
    raw_chars: rawPrompt.length,
    truncated: rawPrompt.length > maxChars,
  };
}

export {
  ALLOWED_CAST_ROLES,
  COMPOSITE_IDEA_TYPES,
  EVENT_TYPE_PALETTE,
  PACE_BY_FUNCTION,
  SETUP_RESOURCE_CATEGORIES,
  TYPES,
  addWarning,
  buildCastPromptMeta,
  clampNumber,
  findCard,
  resultId,
  truncatePrompt,
};
