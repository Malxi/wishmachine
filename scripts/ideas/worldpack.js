// worldpack / plotpack assembly and namecard (cast) generation.
import { DEFAULT_DECK, DECKS, MOTIFS, ROLE_NAMES } from '../decks/index.js';
import { pick, pickMany } from '../util.js';
import {
  addWarning,
  buildCastPromptMeta,
  clampNumber,
  findCard,
  resultId,
  truncatePrompt,
} from './shared.js';

// ---------------------------------------------------------------------------
// worldpack
// ---------------------------------------------------------------------------

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

function buildWorldpackPrompt(def, cards, cast, castRelations, sources, options) {
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

function buildWorldpack(def, packIndex, seed, cast, sources, options = {}) {
  const cards = resolveWorldpackCards(def, sources);
  const packId = `worldpack-${seed}-${String(packIndex + 1).padStart(2, '0')}`;
  const graph = buildWorldpackGraph(packId, cast, cards, sources);
  const { keywords, promptPack } = buildWorldpackPrompt(def, cards, cast, graph.castRelations, sources, options);
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

// ---------------------------------------------------------------------------
// plotpack
// ---------------------------------------------------------------------------

function resolvePlotpackRefs(pack) {
  const storyline = pack.storylines?.[0] || null;
  return {
    premise: pack.premise,
    storyline,
    scenarioA: pack.scenarios?.[0] || null,
    scenarioB: pack.scenarios?.[1] || null,
    blocking: (pack.cast_relations || []).find((relation) => relation.semantic === 'blocks' || relation.type === 'blocks') || null,
    support: (pack.cast_relations || []).find((relation) => relation.semantic === 'supports' || relation.type === 'supports') || null,
    storylineRef: storyline?.id || storyline?.title || '',
  };
}

function buildPlotBeats(pack, refs) {
  const { premise, storyline, scenarioA, scenarioB, blocking, storylineRef } = refs;
  const beats = [
    {
      act: 'Act I',
      chapter: 1,
      function: 'setup',
      beat: premise ? `${premise.title}：先让读者看见${premise.surface_rule}` : '先展示世界规则与主角的日常。',
      source: 'premise',
      source_id: pack.id,
    },
    {
      act: 'Act I',
      chapter: 2,
      function: 'inciting',
      beat: scenarioA ? scenarioA.pressure : '一个事件打破日常，主角被迫做出第一次选择。',
      source: 'scenario',
      source_id: scenarioA?.id || '',
    },
    {
      act: 'Act II',
      chapter: 3,
      function: 'midpoint',
      beat: scenarioB ? scenarioB.twist : storyline?.midpoint || '主角发现规则背后还有一层规则。',
      source: 'scenario',
      source_id: scenarioB?.id || '',
    },
    {
      act: 'Act II',
      chapter: 4,
      function: 'crisis',
      beat: blocking
        ? `${blocking.stake}；反派让主角第一次付出无法回收的代价。`
        : storyline?.payoff || '主角必须在两个都不想要的答案之间选择。',
      source: 'cast_relation',
      source_id: blocking ? `${blocking.from}->${blocking.to}` : '',
    },
    {
      act: 'Act III',
      chapter: 5,
      function: 'climax',
      beat: storyline ? storyline.payoff : '主角用自己的方式改写规则。',
      source: 'storyline',
      source_id: storylineRef,
    },
    {
      act: 'Act III',
      chapter: 6,
      function: 'resolution',
      beat: storyline ? `代价落地：${storyline.cost}` : '胜利留下一个无法撤销的代价。',
      source: 'storyline',
      source_id: storylineRef,
    },
  ];
  if (refs.support) {
    beats[3].support = refs.support.stake;
  }
  return beats;
}

function buildPlotGraph(pack, id, premise, beats) {
  return {
    entities: [
      ...(pack.graph?.entities || []),
      { id: `${id}:plot`, type: 'plot', label: `${premise?.title || 'plot'} 剧情包` },
      ...beats.map((beat) => ({
        id: `${id}:beat-${beat.chapter}`,
        type: 'beat',
        label: `${beat.act} · ${beat.function}`,
      })),
    ],
    relations: [
      ...(pack.graph?.relations || []),
      { from: `${id}:plot`, to: `${id}:beat-1`, type: 'starts_with' },
      { from: `${id}:plot`, to: `${id}:beat-6`, type: 'ends_with' },
    ],
  };
}

function buildPlotpack(pack, seed, index) {
  const refs = resolvePlotpackRefs(pack);
  const beats = buildPlotBeats(pack, refs);
  const id = `plotpack-${seed}-${String(index + 1).padStart(2, '0')}`;
  return {
    id,
    worldpack_id: pack.id,
    genre: pack.genre || '',
    theme: pack.theme,
    premise: refs.premise,
    location: pack.location,
    faction: pack.faction,
    equipment: pack.equipment,
    engine: pack.engine,
    cast: pack.cast,
    cast_relations: pack.cast_relations,
    resources: pack.resources,
    scenarios: pack.scenarios,
    storyline: refs.storyline,
    storylines: pack.storylines,
    beats,
    keywords: pack.keywords,
    motif: pack.motif,
    prompt_pack: pack.prompt_pack,
    graph: buildPlotGraph(pack, id, refs.premise, beats),
  };
}

// ---------------------------------------------------------------------------
// namecard
// ---------------------------------------------------------------------------

function archetypesForRole(deck, role) {
  const pool = deck.archetypes || [];
  const named = deck.roleArchetypes?.[role];
  if (Array.isArray(named) && named.length > 0) {
    const resolved = named.map((name) => findCard(pool, 'name', name)).filter(Boolean);
    if (resolved.length > 0) return resolved;
  }
  return pool.filter((item) => (item.roles || []).includes(role));
}

function namecards(rng, seed, count, roles = [], deckName = 'default', promptChars = 160, warnings = null) {
  const deck = DECKS[deckName] || DEFAULT_DECK;
  const pool = deck.archetypes || [];
  const surnames = pickMany(rng, DEFAULT_DECK.surnames || [], Math.min(count, 20));
  const given = pickMany(rng, DEFAULT_DECK.givenNames || [], Math.min(count, 20));
  const used = new Set();
  const usedArchetypes = new Set();
  const results = [];
  for (let i = 0; i < count; i += 1) {
    let surname = surnames[i % (surnames.length || 1)] || '孟';
    let givenName = given[i % (given.length || 1)] || '启明';
    let name = `${surname}${givenName}`;
    let attempt = 0;
    while (used.has(name) && attempt < 40) {
      surname = pick(rng, DEFAULT_DECK.surnames || ['孟']);
      givenName = pick(rng, DEFAULT_DECK.givenNames || ['启明']);
      name = `${surname}${givenName}`;
      attempt += 1;
    }
    used.add(name);
    const role = roles[i] || ROLE_NAMES[i % ROLE_NAMES.length];
    const roleArchetypes = archetypesForRole(deck, role);
    const availableForRole = roleArchetypes.filter((item) => !usedArchetypes.has(item.name));
    let archetype = availableForRole.length > 0 ? pick(rng, availableForRole) : null;
    if (!archetype) {
      const available = pool.filter((item) => !usedArchetypes.has(item.name));
      const fallback = available.length > 0 ? available : pool;
      archetype = pick(rng, fallback.length > 0 ? fallback : [{
        name: '无名者', personality: [], contradiction: '尚未确定。', want: '尚未确定。', fear: '尚未确定。',
        mask: '尚未确定。', speech: '尚未确定。', body: '尚未确定。', backstory: '尚未确定。',
      }]);
      if (warnings) {
        addWarning(warnings, {
          code: 'cast.role_archetype_mismatch',
          severity: 'warning',
          message: `no unused ${role} archetype left in the ${deck.name} deck; ${archetype.name} is cast as ${role}`,
          requested_role: role,
          archetype: archetype.name,
        });
      }
    }
    usedArchetypes.add(archetype.name);
    const id = resultId('name', seed, i);
    const rawCharacterPrompt = [
      deck.portraitStyle || DEFAULT_DECK.portraitStyle || '',
      name,
      archetype.name,
      ...(archetype.personality || []),
      archetype.body,
      archetype.want,
    ].filter(Boolean).join('，');
    results.push({
      id,
      name,
      surname,
      given_name: givenName,
      naming_style: pick(rng, ['hard', 'literary', 'plain']),
      role_tags: [role],
      archetype: archetype.name,
      prompt: truncatePrompt(rawCharacterPrompt, promptChars),
      prompt_meta: buildCastPromptMeta(rawCharacterPrompt, promptChars),
      negative_prompt: deck.portraitNegative || DEFAULT_DECK.portraitNegative || '',
      personality: archetype.personality,
      contradiction: archetype.contradiction,
      want: archetype.want,
      fear: archetype.fear,
      social_mask: archetype.mask,
      speech_style: archetype.speech,
      body_language: archetype.body,
      backstory_hook: archetype.backstory,
      naming_logic: `先定原型“${archetype.name}”，再选音感；姓氏“${surname}”与名字“${givenName}”组合为“${name}”。`,
      derivation: ['archetype', 'personality', 'contradiction', 'naming_style', 'surname', 'given_name'],
    });
  }
  return results;
}

export { buildPlotpack, buildWorldpack, namecards };
