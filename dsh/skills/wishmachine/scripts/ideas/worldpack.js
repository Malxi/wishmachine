// worldpack assembly: card resolution, entity graph and prompt pack.
import { DEFAULT_DECK, MOTIFS } from '../decks/index.js';
import { clampNumber, findCard, truncatePrompt } from './shared.js';

function resolveWorldpackCards(def, sources) {
  return {
    premise: findCard(sources.premises, 'title', def.premise),
    engine: findCard(sources.engines, 'title', def.engine),
    resources: (def.resources || []).map((name) => findCard(sources.resources, 'name', name)).filter(Boolean),
    scenarios: (def.scenarios || []).map((title) => findCard(sources.scenarios, 'title', title)).filter(Boolean),
    storylines: (def.storylines || []).map((title) => findCard(sources.storylines, 'title', title)).filter(Boolean),
    location: findCard(sources.locations, 'name', def.location),
    faction: findCard(sources.factions, 'name', def.faction),
    equipment: findCard(sources.equipment, 'name', def.equipment),
    motif: def.motif ? findCard(MOTIFS, 'title', def.motif) : null,
  };
}

function addWorldpackEntities(addEntity, cast, cards) {
  const premiseId = cards.premise ? addEntity('premise', 'premise', cards.premise.title) : '';
  const engineId = cards.engine ? addEntity('engine', 'engine', cards.engine.title) : '';
  const locationId = cards.location ? addEntity('location', 'location', cards.location.name) : '';
  const factionId = cards.faction ? addEntity('faction', 'faction', cards.faction.name) : '';
  const equipmentId = cards.equipment ? addEntity('equipment', 'equipment', cards.equipment.name) : '';
  const motifId = cards.motif ? addEntity('motif', 'motif', cards.motif.title) : '';
  const resourceIds = cards.resources.map((item, index) => addEntity('resource', `resource-${index + 1}`, item.name));
  const scenarioIds = cards.scenarios.map((item, index) => addEntity('scenario', `scenario-${index + 1}`, item.title));
  const storylineIds = cards.storylines.map((item, index) => addEntity('storyline', `storyline-${index + 1}`, item.title));
  const castIds = cast.map((character, index) => addEntity('character', `character-${index + 1}`, character.name, {
    role: character.role_tags?.[0] || 'support',
    archetype: character.archetype,
    prompt: character.prompt,
    prompt_meta: character.prompt_meta,
    negative_prompt: character.negative_prompt,
    want: character.want,
  }));
  return { premiseId, engineId, locationId, factionId, equipmentId, motifId, resourceIds, scenarioIds, storylineIds, castIds };
}

function addWorldpackRelations(relate, ids) {
  if (ids.premiseId && ids.engineId) relate(ids.engineId, ids.premiseId, 'governs');
  if (ids.factionId && ids.engineId) relate(ids.factionId, ids.engineId, 'issues');
  if (ids.locationId && ids.engineId) relate(ids.locationId, ids.engineId, 'hosts');
  if (ids.equipmentId && ids.premiseId) relate(ids.equipmentId, ids.premiseId, 'enables');
  if (ids.motifId && ids.premiseId) relate(ids.premiseId, ids.motifId, 'inspired_by');
  for (const id of ids.resourceIds) if (ids.premiseId) relate(id, ids.premiseId, 'constrains');
  for (const id of ids.scenarioIds) if (ids.premiseId) relate(id, ids.premiseId, 'tests');
  for (const id of ids.storylineIds) if (ids.premiseId) relate(id, ids.premiseId, 'dramatizes');
}

function linkCastRelations(relate, cast, ids, relationTypes) {
  const castRelations = [];
  const castRelate = (from, to, type, stake) => {
    if (!from || !to) return;
    const relation = { from, to, type: relationTypes[type] || type, stake, semantic: type };
    castRelations.push(relation);
    relate(from, to, relation.type);
  };
  const leadIndex = Math.max(0, cast.findIndex((character) => (character.role_tags?.[0] || 'support') === 'protagonist'));
  const leadId = ids.castIds[leadIndex] || ids.castIds[0];
  if (leadId && ids.premiseId) relate(leadId, ids.premiseId, 'pursues');
  if (leadId && ids.factionId) relate(leadId, ids.factionId, 'belongs_to');
  if (leadId && ids.locationId) relate(leadId, ids.locationId, 'starts_at');
  if (leadId && ids.equipmentId) relate(leadId, ids.equipmentId, 'uses');
  const idsByRole = (role) => cast
    .map((character, index) => ({ character, id: ids.castIds[index] }))
    .filter((entry) => (entry.character.role_tags?.[0] || 'support') === role)
    .map((entry) => entry.id);
  const protagonistIds = idsByRole('protagonist');
  const antagonistIds = idsByRole('antagonist');
  const supportIds = idsByRole('support');
  for (const allyId of protagonistIds.slice(1)) {
    castRelate(allyId, leadId, 'allies_with', '两名主角对同一目标有不同做法');
  }
  for (const villainId of antagonistIds) {
    castRelate(villainId, leadId, 'opposes', '谁来决定谁被留下');
    castRelate(villainId, ids.factionId, 'controls', '反派掌握势力资源');
  }
  for (const supportId of supportIds) {
    castRelate(supportId, leadId, 'supports', '主角的目标需要这名支持者的技能');
    castRelate(supportId, ids.locationId, 'guards', '支持者守着关键地点');
  }
  if (supportIds[0]) castRelate(supportIds[0], ids.factionId, 'works_for', '支持者嵌在势力内部，能拿到外部拿不到的东西');
  if (leadId) castRelate(leadId, ids.storylineIds[0], 'drives', '主角的选择推动第一条剧情线');
  if (antagonistIds[0] && ids.storylineIds[0]) {
    castRelate(antagonistIds[0], ids.storylineIds[0], 'blocks', '反派让第一条剧情线无法顺利完成');
  }
  return castRelations;
}

function buildWorldpackGraph(packId, cast, cards, sources) {
  const entities = [];
  const relations = [];
  const addEntity = (type, key, label, extra = {}) => {
    const id = `${packId}:${key}`;
    entities.push({ id, type, label, ...extra });
    return id;
  };
  const relate = (from, to, type) => relations.push({ from, to, type });
  const ids = addWorldpackEntities(addEntity, cast, cards);
  addWorldpackRelations(relate, ids);
  const castRelations = linkCastRelations(relate, cast, ids, sources.relationTypes || DEFAULT_DECK.relationTypes);
  return { entities, relations, castRelations };
}

function buildWorldpackPrompt({ def, cards, cast, castRelations, sources, options }) {
  const keywords = [...new Set([
    def.theme,
    cards.premise?.title,
    cards.motif?.title,
    cards.engine?.artifact,
    cards.location?.name,
    cards.faction?.name,
    cards.equipment?.name,
    ...cast.map((character) => character.name),
    ...new Set(castRelations.map((relation) => relation.type)),
  ].filter(Boolean))];
  const style = sources.promptStyle || DEFAULT_DECK.promptStyle;
  const negative = sources.promptNegative || DEFAULT_DECK.promptNegative;
  const rawPrompt = [
    style,
    `${def.theme} 主题`,
    cards.premise?.title,
    cards.motif?.title,
    cards.engine?.artifact,
    cards.location?.name,
    cards.faction?.name,
    cards.equipment?.name,
    [...new Set(castRelations.map((relation) => relation.type))].join(' / '),
  ].filter(Boolean).join('，');
  const promptChars = clampNumber(options.promptChars, 80, 2000, 800);
  const rawPromptLength = rawPrompt.length;
  const prompt = truncatePrompt(rawPrompt, promptChars);
  return {
    keywords,
    promptPack: {
      positive: prompt,
      negative,
      style,
      keywords,
      max_chars: promptChars,
      raw_chars: rawPromptLength,
      truncated: rawPromptLength > promptChars,
    },
  };
}

function buildWorldpack({ def, packIndex, seed, cast, sources, options = {} }) {
  const cards = resolveWorldpackCards(def, sources);
  const packId = `worldpack-${seed}-${String(packIndex + 1).padStart(2, '0')}`;
  const graph = buildWorldpackGraph(packId, cast, cards, sources);
  const { keywords, promptPack } = buildWorldpackPrompt({
    def, cards, cast, castRelations: graph.castRelations, sources, options,
  });
  return {
    id: packId,
    theme: def.theme,
    prompt_pack: promptPack,
    keywords,
    premise: cards.premise ? {
      title: cards.premise.title,
      statement: cards.premise.statement,
      surface_rule: cards.premise.surface_rule,
      hidden_truth: cards.premise.hidden_truth,
      scarcity: cards.premise.scarcity,
      central_conflict: cards.premise.conflict,
    } : null,
    resources: cards.resources.map((item, index) => ({ id: `${packId}-resource-${index + 1}`, ...item })),
    scenarios: cards.scenarios.map((item, index) => ({ id: `${packId}-scenario-${index + 1}`, ...item })),
    storylines: cards.storylines.map((item, index) => ({ id: `${packId}-storyline-${index + 1}`, ...item })),
    engine: cards.engine ? { id: `${packId}-engine`, ...cards.engine } : null,
    location: cards.location ? { id: `${packId}-location`, ...cards.location } : null,
    faction: cards.faction ? { id: `${packId}-faction`, ...cards.faction } : null,
    equipment: cards.equipment ? { id: `${packId}-equipment`, ...cards.equipment } : null,
    motif: cards.motif ? { id: `${packId}-motif`, ...cards.motif } : null,
    cast_relations: graph.castRelations,
    graph: { entities: graph.entities, relations: graph.relations },
    cast,
  };
}

export { buildWorldpack };
