// Artifact shape contracts: the single source of field names, enums, id formats and
// category maps shared by the rule engine (scripts/rules/**) and the generators
// (scripts/ideas/**, scripts/registry.js, scripts/decks/index.js).
//
// Layer L1 leaf: this module must not import any local module so every producer and
// consumer can depend on it without creating cycles. Facts that only one side needs
// stay in that side; anything both the checker and the generator must agree on lives
// here. Field lists are frozen arrays of strings (or small objects) so callers can
// iterate them exactly as they used to iterate hand-written literals.

// --- setup artifact ---------------------------------------------------------

// Setup arrays the checker validates as "optional array of objects" and the setup
// draft generator emits. Keep the order stable for deterministic findings.
const SETUP_ARRAY_FIELDS = Object.freeze([
  'core_cast', 'storylines', 'premises', 'world_timeline', 'world_resources',
]);

// Required non-empty strings in setup, with the severity of a missing value.
const SETUP_REQUIRED_STRING_FIELDS = Object.freeze([
  { key: 'project_name', severity: 'high' },
  { key: 'premise', severity: 'high' },
  { key: 'theme', severity: 'medium' },
]);

// Optional setup fields that must be arrays of strings.
const SETUP_STRING_ARRAY_FIELDS = Object.freeze([
  { key: 'genres', severity: 'high' },
  { key: 'rules', severity: 'medium' },
]);

// Optional setup fields that must be plain objects (the message is bespoke because
// writing_style historically had to be distinguished from the string form).
const SETUP_OBJECT_FIELDS = Object.freeze(['writing_style']);

// --- thread / mystery registries -------------------------------------------

const THREAD_REGISTRY_FIELD = 'thread_registry';
const MYSTERY_REGISTRY_FIELD = 'mystery_registry';
const ABANDONED_THREADS_FIELD = 'abandoned_threads';

// Thread lifecycle. Order is the vocabulary order used in messages.
const THREAD_STATUSES = Object.freeze(['active', 'resolved', 'abandoned']);

// Thread registry fields validated as arrays (the element checks are per artifact).
const THREAD_REGISTRY_ARRAY_FIELDS = Object.freeze(['resolved_chapters']);
const THREAD_REGISTRY_BOOLEAN_FIELDS = Object.freeze(['abandoned_history']);
const THREAD_REGISTRY_OBJECT_ARRAY_FIELDS = Object.freeze(['resolved_mysteries', 'abandoned_mysteries']);

// Mystery lifecycle. The priority decides which copy of a mystery id wins when the
// chapter/scene lists disagree; registry derivation and the checker must agree.
const MYSTERY_STATUSES = Object.freeze(['open', 'dropped', 'resolved']);
const MYSTERY_STATUS_PRIORITY = Object.freeze({ open: 0, dropped: 1, resolved: 2 });

// Chapter-level mystery buckets, and the scene-level subset that chapter-level
// collection promotes from (see ideas/outline-volume.js).
const MYSTERY_LIST_KEYS = Object.freeze(['carried', 'planted', 'resolved', 'dropped']);
const SCENE_MYSTERY_LIST_KEYS = Object.freeze(['planted', 'resolved']);

// Beat functions that may legally resolve a thread at chapter level.
const CLIMAX_BEAT_FUNCTIONS = Object.freeze(['climax', 'resolution']);

// Registry ordering keys: mystery entries sort by chapter then id; thread links
// sort by chapter then id as well.
const MYSTERY_ORDER_FIELDS = Object.freeze(['chapter_id', 'id']);

// --- outline artifact ------------------------------------------------------

// Part/volume/chapter required non-empty strings.
const OUTLINE_PART_REQUIRED_FIELDS = Object.freeze(['id', 'title', 'summary']);
const OUTLINE_VOLUME_REQUIRED_FIELDS = Object.freeze(['id', 'title', 'summary']);
const OUTLINE_CHAPTER_REQUIRED_FIELDS = Object.freeze(['id', 'title', 'summary', 'conflict', 'pacing']);

// Canonical outline id forms: P1, P1-V1, P1-V1-C1. Generators build ids in this
// shape and the quality rules flag chapters that drift from it.
const PART_ID_PATTERN = /^P\d+$/;
const VOLUME_ID_PATTERN = /^P\d+-V\d+$/;
const CHAPTER_ID_PATTERN = /^P\d+-V\d+-C\d+$/;
// Ids that become filesystem segments must never contain a separator or be dot-paths.
const UNSAFE_ID_PATTERN = /[\\/]|^\.\.?$/;

// --- resources -------------------------------------------------------------

// Setup resource categories. Deck resourceCategories maps genre categories onto
// exactly these; anything else falls back to DEFAULT_RESOURCE_CATEGORY.
const RESOURCE_CATEGORIES = Object.freeze(['能源', '消耗品', '材料', '货币']);
const SETUP_RESOURCE_CATEGORIES = new Set(RESOURCE_CATEGORIES);
const DEFAULT_RESOURCE_CATEGORY = '材料';

export {
  ABANDONED_THREADS_FIELD,
  CHAPTER_ID_PATTERN,
  CLIMAX_BEAT_FUNCTIONS,
  DEFAULT_RESOURCE_CATEGORY,
  MYSTERY_LIST_KEYS,
  MYSTERY_ORDER_FIELDS,
  MYSTERY_REGISTRY_FIELD,
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
  THREAD_REGISTRY_FIELD,
  THREAD_REGISTRY_OBJECT_ARRAY_FIELDS,
  THREAD_STATUSES,
  UNSAFE_ID_PATTERN,
  VOLUME_ID_PATTERN,
};
