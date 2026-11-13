// plotpack assembly: beat sheet and plot graph built on top of a worldpack.
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

export { buildPlotpack };
