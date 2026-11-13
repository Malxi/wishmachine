// Deck registry: every genre's card data lives in its own module so ideas.js
// stays logic-only and adding a genre means adding exactly one deck object.
import { defaultDeck } from './default.js';
import { xianxia } from './xianxia.js';
import { suspense } from './suspense.js';
import { urban } from './urban.js';
import { history } from './history.js';
import { romance } from './romance.js';
import { MOTIFS } from './motifs.js';

export { MOTIFS };

export const DECKS = Object.freeze({
  default: defaultDeck,
  xianxia,
  suspense,
  urban,
  history,
  romance,
});
export const DEFAULT_DECK = defaultDeck;
export const DECK_NAMES = Object.keys(DECKS);
export const ROLE_NAMES = ['protagonist', 'antagonist', 'support'];

// Genre decks carry role-tagged archetypes; the default deck points roles at
// named archetypes through roleArchetypes.
export const GENRE_ARCHETYPE_POOLS = Object.freeze(Object.fromEntries(
  DECK_NAMES
    .filter((name) => name !== 'default')
    .map((name) => [name, DECKS[name].archetypes]),
));
export const GENRE_ARCHETYPE_COUNTS = Object.freeze(Object.fromEntries(
  Object.entries(GENRE_ARCHETYPE_POOLS).map(([name, pool]) => [name, pool.length]),
));
export const ROLE_ARCHETYPES = DEFAULT_DECK.roleArchetypes;

// Relation types that are structural (graph plumbing), not genre flavour.
const STRUCTURAL_RELATION_TYPES = [
  'governs', 'issues', 'hosts', 'enables', 'inspired_by', 'constrains', 'tests',
  'dramatizes', 'pursues', 'belongs_to', 'starts_at', 'uses', 'counters',
];

export const KNOWN_RELATION_TYPES = new Set([
  ...STRUCTURAL_RELATION_TYPES,
  ...Object.values(DECKS).flatMap((deck) => Object.values(deck.relationTypes || {})),
]);

// Compound genre names must win over their component words: 现代言情 is romance,
// not urban, and 古代言情 is romance, not history.
const GENRE_MATCHERS = [
  ['xianxia', /仙|修|玄幻|古风|武侠|fantasy|xian/i],
  ['romance', /言情|爱情|婚恋|古言|现言|古装|romance/i],
  ['suspense', /悬疑|推理|侦探|犯罪|恐怖|thriller|mystery/i],
  ['urban', /都市|现代|职场|娱乐|校园|urban/i],
  ['history', /历史|古代|朝代|民国|战争|history/i],
];

export function selectDeck(genre) {
  const value = String(genre || '');
  for (const [name, matcher] of GENRE_MATCHERS) {
    if (matcher.test(value)) return DECKS[name];
  }
  return null;
}

const REQUIRED_LIST_FIELDS = [
  'premises', 'resources', 'scenarios', 'storylines', 'engines',
  'locations', 'factions', 'equipment', 'packs', 'archetypes',
];
const REQUIRED_TEXT_FIELDS = [
  'promptStyle', 'promptNegative', 'portraitStyle', 'portraitNegative',
];

function referenceErrors(deck, motifs) {
  const errors = [];
  const has = (list, key, value) => (list || []).some((item) => item[key] === value);
  for (const field of REQUIRED_LIST_FIELDS) {
    if (!Array.isArray(deck[field]) || deck[field].length === 0) {
      errors.push(`${deck.name}.${field} must be a non-empty array`);
    }
  }
  for (const field of REQUIRED_TEXT_FIELDS) {
    if (typeof deck[field] !== 'string' || !deck[field].trim()) {
      errors.push(`${deck.name}.${field} must be a non-empty string`);
    }
  }
  if (!deck.relationTypes || typeof deck.relationTypes !== 'object') {
    errors.push(`${deck.name}.relationTypes must be an object`);
  }
  if (!deck.resourceCategories || typeof deck.resourceCategories !== 'object') {
    errors.push(`${deck.name}.resourceCategories must be an object`);
  }
  const allowedCategories = new Set(['能源', '消耗品', '材料', '货币']);
  for (const resource of deck.resources || []) {
    if (!resource?.name || !resource?.category) {
      errors.push(`${deck.name}.resources entry needs name and category`);
      continue;
    }
    const mapped = deck.resourceCategories?.[resource.category];
    if (!mapped) {
      errors.push(`${deck.name}.resourceCategories is missing category ${resource.category} (used by ${resource.name})`);
    } else if (!allowedCategories.has(mapped)) {
      errors.push(`${deck.name}.resourceCategories maps ${resource.category} to unsupported setup category ${mapped}`);
    }
  }
  const archetypeNames = new Set();
  for (const archetype of deck.archetypes || []) {
    if (!archetype?.name) {
      errors.push(`${deck.name}.archetypes entry needs a name`);
      continue;
    }
    if (archetypeNames.has(archetype.name)) {
      errors.push(`${deck.name}.archetypes has duplicate ${archetype.name}`);
    }
    archetypeNames.add(archetype.name);
    if (deck.name !== 'default') {
      if (!Array.isArray(archetype.roles) || archetype.roles.length === 0) {
        errors.push(`${deck.name}.archetypes ${archetype.name} needs roles`);
      } else {
        for (const role of archetype.roles) {
          if (!ROLE_NAMES.includes(role)) errors.push(`${deck.name}.archetypes ${archetype.name} has unknown role ${role}`);
        }
      }
    }
  }
  if (deck.name === 'default') {
    for (const [role, names] of Object.entries(deck.roleArchetypes || {})) {
      if (!ROLE_NAMES.includes(role)) errors.push(`default.roleArchetypes has unknown role ${role}`);
      for (const name of names) {
        if (!archetypeNames.has(name)) errors.push(`default.roleArchetypes.${role} references unknown archetype ${name}`);
      }
    }
  }
  for (const pack of deck.packs || []) {
    const check = (list, key, value, label) => {
      if (!has(list, key, value)) errors.push(`${deck.name}.packs.${pack.theme} references unknown ${label} ${value}`);
    };
    if (!pack?.theme) {
      errors.push(`${deck.name}.packs entry needs a theme`);
      continue;
    }
    check(deck.premises, 'title', pack.premise, 'premise');
    if (pack.engine) check(deck.engines, 'title', pack.engine, 'engine');
    for (const name of pack.resources || []) check(deck.resources, 'name', name, 'resource');
    for (const title of pack.scenarios || []) check(deck.scenarios, 'title', title, 'scenario');
    for (const title of pack.storylines || []) check(deck.storylines, 'title', title, 'storyline');
    if (pack.location) check(deck.locations, 'name', pack.location, 'location');
    if (pack.faction) check(deck.factions, 'name', pack.faction, 'faction');
    if (pack.equipment) check(deck.equipment, 'name', pack.equipment, 'equipment');
    if (pack.motif && !has(motifs, 'title', pack.motif)) {
      errors.push(`${deck.name}.packs.${pack.theme} references unknown motif ${pack.motif}`);
    }
  }
  return errors;
}

// Validate every pack reference at load time so a typo in deck data fails fast
// instead of silently dropping resources/locations from generated packs.
export function deckReferenceErrors(decks = DECKS, motifs = MOTIFS) {
  return Object.values(decks).flatMap((deck) => referenceErrors(deck, motifs));
}

export const DECK_REFERENCE_ERRORS = deckReferenceErrors();
if (DECK_REFERENCE_ERRORS.length > 0) {
  throw new Error(`deck reference errors:\n${DECK_REFERENCE_ERRORS.join('\n')}`);
}
