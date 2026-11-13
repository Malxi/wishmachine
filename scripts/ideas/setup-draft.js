// setup_draft builder used by outlinepacks (--from-idea setup).
import { SETUP_RESOURCE_CATEGORIES } from './shared.js';

function buildSetupCast(plot, storylineList) {
  return (plot.cast || []).map((character, index) => {
    const role = character.role_tags?.[0] || (index === 0 ? 'protagonist' : 'support');
    return {
      id: `cast_${index + 1}`,
      name: character.name,
      role,
      importance: role === 'protagonist' ? 10 : role === 'antagonist' ? 8 : 5,
      story_function: character.archetype || 'story character',
      relationship_to_lead: role === 'protagonist' ? 'self' : role === 'antagonist' ? 'opposes the lead' : 'supports the lead',
      relationship_arc: `${character.contradiction || 'is changed by the plot'} -> ${character.want || 'gets a choice'}`,
      entry_phase: 'opening',
      payoff: character.want || 'their want is tested',
      storyline_refs: storylineList.map((item, index2) => item.id || `thread-${index2 + 1}`).filter(Boolean),
    };
  });
}

function buildSetupStorylines(plot, storylineList) {
  return storylineList.map((item, index) => ({
    thread_id: item.id || `thread-${index + 1}`,
    name: item.title || `storyline ${index + 1}`,
    description: item.promise || item.title || '主角试图改变现状',
    type: index === 0 ? 'main' : 'subplot',
    importance: index === 0 ? 10 : 6,
    scope: index === 0 ? 'book' : 'volume',
    payoff_style: 'staged_reveal',
    setup_role: index === 0 ? plot.premise?.surface_rule || 'establish the rule' : item.promise || 'add pressure',
    repeatable_pressure: item.escalation || 'the rule keeps extracting a price',
    payoff_cadence: index === 0 ? 'per volume' : 'per act',
    mutation: item.midpoint || 'the rule is not what it seems',
    failure_mode: item.cost || 'the cost cannot be undone',
    desire: item.promise || 'change the current order',
    opposition: plot.premise?.central_conflict || 'the rule resists',
    stakes: item.cost || 'someone is left behind',
    turn: item.midpoint || 'the rule turns against the lead',
    payoff: item.payoff || 'the lead changes the rule',
    open_question: item.cost || 'what remains after the change?',
    pressure_points: [plot.premise?.scarcity, plot.premise?.central_conflict].filter(Boolean),
    appeal_engine: {
      appeal: item.promise || 'a rule that can be bent',
      surface_limit: plot.premise?.surface_rule || 'the rule seems absolute',
      exploit: plot.premise?.leverage || 'find the exception',
      signature_win: item.payoff || 'a visible win',
      upgrade_path: item.escalation || 'the stakes rise',
      opponent_misread: plot.premise?.hidden_truth || 'the opponent misreads the cost',
      reward_type: 'consequence',
    },
  }));
}

function buildSetupPremises(plot, storyline) {
  return [{
    name: plot.premise?.title || '核心前提',
    description: plot.premise?.statement || '核心前提',
    category: 'core',
    progression: [
      { level: 1, name: '建立规则', description: plot.premise?.surface_rule || '读者先看见规则', requirements: '主角进入规则覆盖的范围' },
      { level: 2, name: '发现代价', description: storyline.escalation || '规则开始向主角收费', requirements: '主角第一次利用规则' },
      { level: 3, name: '规则反噬', description: storyline.midpoint || '规则背后还有一层规则', requirements: '主角付出无法撤回的代价' },
      { level: 4, name: '改写规则', description: storyline.payoff || '主角找到例外', requirements: '主角承担改写后的后果' },
    ],
    appeal_engine: {
      appeal: plot.premise?.statement || 'the premise',
      surface_limit: plot.premise?.surface_rule || 'the rule',
      exploit: plot.premise?.leverage || 'the loophole',
      signature_win: storyline.payoff || 'the win',
    },
  }];
}

function buildSetupTimeline(plot, storyline) {
  return [
    {
      year: 'before',
      event: plot.premise?.surface_rule || '旧规则建立',
      impact: plot.premise?.scarcity || '资源与资格被重新分配',
      related_mystery: plot.premise?.hidden_truth || '规则真正保护的是什么',
    },
    {
      year: 'now',
      event: storyline.promise || '主角进入规则',
      impact: '主角开始付出代价',
      related_mystery: storyline.midpoint || '规则的隐藏层',
    },
  ];
}

function buildSetupResources(plot, categoryMap) {
  return (plot.resources || []).map((resource) => ({
    name: resource.name,
    category: SETUP_RESOURCE_CATEGORIES.has(resource.category)
      ? resource.category
      : (categoryMap[resource.category] || '材料'),
    scarcity: '稀有',
    description: resource.meaning || resource.category || 'world resource',
  }));
}

function buildSetupLongFormPlan(outline, storyline) {
  return {
    target_chapters: outline.chapter_config.chapters,
    target_volumes: outline.chapter_config.volumes,
    main_loop: storyline.promise || '主角在规则压力下做出选择',
    escalation_ladder: [storyline.promise, storyline.escalation, storyline.midpoint, storyline.payoff].filter(Boolean),
    reader_promises: [storyline.promise, storyline.payoff].filter(Boolean),
    payoff_cadence: '每卷一次阶段性回收，每章留下一个具体钩子',
    volume_pattern: ['建立规则', '规则反噬', '改写规则'],
    midpoint_mutation: storyline.midpoint || '主角发现规则背后还有一层规则',
    endgame_promise: storyline.payoff || '主角改写规则并付出代价',
  };
}

function buildSetupDraft(plot, outline, deck) {
  const storylineList = (plot.storylines || [plot.storyline]).filter(Boolean);
  const storyline = storylineList[0] || {};
  const categoryMap = deck?.resourceCategories || {};
  return {
    project_name: plot.premise?.title || '未命名故事',
    genres: [plot.genre || '未分类'],
    premise: [plot.premise?.statement, plot.premise?.surface_rule].filter(Boolean).join(' '),
    theme: plot.premise?.hidden_truth || storyline.promise || '规则与选择',
    rules: [plot.premise?.surface_rule, plot.premise?.scarcity, plot.premise?.central_conflict].filter(Boolean),
    target_audience: 'general',
    tone: plot.prompt_pack?.style || '克制、具体',
    tense: 'past',
    pov_style: 'third_person_limited',
    long_form_plan: buildSetupLongFormPlan(outline, storyline),
    core_cast: buildSetupCast(plot, storylineList),
    storylines: buildSetupStorylines(plot, storylineList),
    premises: buildSetupPremises(plot, storyline),
    world_timeline: buildSetupTimeline(plot, storyline),
    world_resources: buildSetupResources(plot, categoryMap),
  };
}

export { buildSetupDraft };
