// outlinepack assembly: single-volume chapters, thread registry and multi-volume packs.
import { DEFAULT_DECK } from '../decks/index.js';
import { chapterResolvedMysteries, collectMysteryRegistry, sortMysteryLinks } from '../registry.js';
import { PACE_BY_FUNCTION, clampNumber } from './shared.js';
import { buildChapterEvents, buildScenes, collectCastInfo, makeMystery, pickBeat, plantChapterMystery } from './scenes.js';
import { buildSetupDraft } from './setup-draft.js';

function resolveOutlinePackConfig(plot, options) {
  const chapters = clampNumber(options.chapters, 3, 60, 10);
  const scenesPerChapter = clampNumber(options.scenes, 1, 5, 3);
  const targetChars = clampNumber(options.targetChars, 500, 10000, 3000);
  return {
    chapters,
    scenesPerChapter,
    targetChars,
    beats: plot.beats || [],
    castInfo: collectCastInfo(plot),
    threadId: plot.storyline?.id || plot.storyline?.title || '',
    scenarioA: plot.scenarios?.[0] || null,
    scenarioB: plot.scenarios?.[1] || null,
    blocking: (plot.cast_relations || []).find((relation) => relation.semantic === 'blocks' || relation.type === 'blocks') || null,
    volumeId: options.volumeId || 'P1-V1',
    chapterOffset: Number(options.chapterOffset) || 0,
    totalChapters: Number(options.totalChapters) || chapters,
  };
}

function planChapterObstacle(plot, beat, config, entryFromPrevious, entrySummary) {
  const obstacleByFunction = {
    setup: config.scenarioA?.pressure,
    inciting: config.scenarioA?.twist,
    midpoint: config.scenarioB?.twist,
    crisis: config.blocking?.stake,
    climax: plot.storyline?.cost,
    resolution: plot.storyline?.cost,
  };
  const baseObstacle = obstacleByFunction[beat.function] || plot.premise?.central_conflict || '规则阻止主角推进';
  return entryFromPrevious ? `上一章后果未解：${entrySummary}；${baseObstacle}` : baseObstacle;
}

function createChapterMysteries(pendingMysteries) {
  return {
    carried: pendingMysteries.slice(0, 3).map((item) => ({ ...item, status: 'open' })),
    planted: [],
    resolved: [],
    dropped: [],
  };
}

function plantChapterMysteries(plot, config, beat, chapterId, mysteries, pendingMysteries) {
  const { castInfo, threadId, scenarioB } = config;
  if (beat.function === 'setup' && plot.premise?.hidden_truth) {
    const question = plot.premise.hidden_truth;
    plantChapterMystery(mysteries, pendingMysteries, makeMystery({
      id: `${chapterId}-mystery-1`,
      question,
      answer: plot.storyline?.payoff || '',
      payoff: plot.storyline?.cost || '',
      importance: 10,
      thread: plot.storyline?.title || 'premise',
      thread_id: threadId || 'premise',
      thread_type: 'premise',
      related_cast: castInfo.leadCast,
      related_cast_ids: castInfo.leadCastIds,
      planted_in: chapterId,
    }), chapterId);
  }
  if (beat.function === 'midpoint' && scenarioB?.twist) {
    plantChapterMystery(mysteries, pendingMysteries, makeMystery({
      id: `${chapterId}-mystery-1`,
      question: scenarioB.twist,
      answer: plot.storyline?.payoff || '',
      payoff: plot.storyline?.cost || '',
      importance: 8,
      thread: plot.storyline?.title || 'storyline',
      thread_id: threadId || 'storyline',
      thread_type: 'storyline',
      related_cast: castInfo.leadCast,
      related_cast_ids: castInfo.leadCastIds,
      planted_in: chapterId,
    }), chapterId);
  }
  if (beat.function === 'climax' || beat.function === 'resolution') {
    // Plant the core mystery in this very chapter before resolving it: the
    // validator requires every resolved mystery to be planted first.
    const core = makeMystery({
      id: `${chapterId}-mystery-core`,
      question: plot.storyline?.midpoint || plot.premise?.hidden_truth || '核心谜题',
      answer: plot.storyline?.payoff || '答案浮出水面。',
      payoff: plot.storyline?.cost || '',
      importance: 10,
      thread: plot.storyline?.title || 'climax',
      thread_id: threadId || 'climax',
      thread_type: 'climax',
      related_cast: castInfo.names,
      related_cast_ids: castInfo.ids,
      planted_in: chapterId,
    });
    plantChapterMystery(mysteries, pendingMysteries, core, chapterId);
    for (const item of pendingMysteries) {
      mysteries.resolved.push({
        ...item,
        answer: item.answer || plot.storyline?.payoff || '答案浮出水面。',
        status: 'resolved',
        resolved_in: chapterId,
      });
    }
    return [];
  }
  return pendingMysteries;
}

function promoteSceneMysteries(scenes, mysteries, pendingMysteries, chapterId) {
  // Promote the scene-2 mystery to the chapter level so a later chapter may
  // legally resolve it (resolved mysteries must be planted first).
  for (const scene of scenes) {
    if (scene.order !== 2) continue;
    for (const item of scene.mysteries.planted) {
      if (pendingMysteries.some((pending) => pending.id === item.id) || mysteries.planted.some((planted) => planted.id === item.id)) continue;
      mysteries.planted.push({ ...item, status: 'open' });
      pendingMysteries.push({ ...item, from: chapterId, source_scene: `${chapterId}-S${scene.order}`, status: 'open' });
    }
  }
}

function buildChapterRecord(plot, config, context) {
  const { index, chapterId, globalIndex, beat, entryFromPrevious, entrySummary, chapterObstacle, scenes, events, mysteries } = context;
  return {
    id: chapterId,
    thread_id: config.threadId,
    title: `第${index + 1}章 · ${beat.function}`,
    summary: beat.beat,
    characters: config.castInfo.names,
    location: plot.location?.name || '关键地点',
    obstacle: chapterObstacle,
    entry_from_previous: entryFromPrevious,
    exit_consequence: scenes[scenes.length - 1]?.consequence || '',
    mysteries,
    events,
    conflict: entryFromPrevious
      ? `承接上一章后果：${entrySummary}；本章冲突：${plot.premise?.central_conflict || plot.premise?.conflict || '主角必须做出选择。'}`
      : (plot.premise?.central_conflict || plot.premise?.conflict || '主角必须做出选择。'),
    pacing: PACE_BY_FUNCTION[beat.function] || 'rising',
    beat_function: beat.function,
    act: beat.act,
    target_chars: config.targetChars,
    scenes,
    scene_chain: scenes.map((scene) => ({
      scene: scene.order,
      turn: scene.turn_event,
      consequence: scene.consequence,
    })),
    chapter_payoff: {
      desire: plot.storyline?.promise || '主角想改变现状。',
      pressure: entryFromPrevious
        ? `上一章留下的后果：${entrySummary}`
        : (plot.premise?.central_conflict || '规则不允许。'),
      clever_move: beat.beat,
      payoff_moment: plot.storyline?.payoff || '主角完成一次反击。',
      reward: plot.storyline?.cost || '代价被看见。',
      social_proof: '见证者承认主角做到了。',
      hook: globalIndex === config.totalChapters - 1
        ? '故事结束，代价留下。'
        : `下一章要处理：${scenes[scenes.length - 1]?.consequence || '新的压力'}`,
    },
  };
}

function carryPendingMysteries(pendingMysteries, mysteries, droppedMysteries, chapterId) {
  pendingMysteries.sort((left, right) => (right.importance || 0) - (left.importance || 0));
  const keptMysteries = pendingMysteries.slice(0, 5);
  for (const dropped of pendingMysteries.slice(5)) {
    const record = {
      ...dropped,
      status: 'dropped',
      dropped_in: chapterId,
      reason: 'pending_capacity',
      abandoned_thread: {
        thread_id: dropped.thread_id,
        thread: dropped.thread,
        question: dropped.question,
        importance: dropped.importance,
        reason: 'pending_capacity',
      },
    };
    mysteries.dropped.push(record);
    droppedMysteries.push(record);
  }
  return keptMysteries;
}

function buildOutlineVolume(plot, chapterList, volumeId) {
  return {
    id: volumeId || 'P1-V1',
    title: '第一卷',
    summary: plot.storyline?.promise || plot.premise?.title || '故事的第一卷。',
    chapters: chapterList,
    beat_map: chapterList.map((chapter) => ({
      chapter: chapter.id,
      function: chapter.beat_function,
      act: chapter.act,
    })),
  };
}

function buildOutlineDraftOutline(plot, volume) {
  return {
    parts: [{
      id: 'P1',
      title: plot.premise?.title || '未命名故事',
      summary: plot.premise?.statement || '未填写故事前提。',
      volumes: [volume],
    }],
  };
}

function buildOutlinePack(plot, seed, options = {}) {
  const config = resolveOutlinePackConfig(plot, options);
  const { chapters, scenesPerChapter, targetChars, beats, castInfo, threadId, volumeId } = config;
  const chapterList = [];
  const droppedMysteries = [];
  let previousChapterConsequence = options.previousConsequence || '';
  let pendingMysteries = Array.isArray(options.carriedMysteries) ? options.carriedMysteries.slice() : [];
  for (let index = 0; index < chapters; index += 1) {
    const globalIndex = config.chapterOffset + index;
    const entryFromPrevious = previousChapterConsequence;
    const entrySummary = entryFromPrevious.length > 120 ? `${entryFromPrevious.slice(0, 120)}…` : entryFromPrevious;
    const beat = pickBeat(beats, globalIndex, config.totalChapters);
    const chapterId = `${volumeId}-C${index + 1}`;
    const chapterObstacle = planChapterObstacle(plot, beat, config, entryFromPrevious, entrySummary);
    const mysteries = createChapterMysteries(pendingMysteries);
    pendingMysteries = plantChapterMysteries(plot, config, beat, chapterId, mysteries, pendingMysteries);
    const scenes = buildScenes(plot, chapterId, beat, castInfo, chapterObstacle, entrySummary, targetChars, scenesPerChapter, threadId);
    promoteSceneMysteries(scenes, mysteries, pendingMysteries, chapterId);
    const events = buildChapterEvents(plot, chapterId, scenes, castInfo, globalIndex, config.totalChapters);
    const chapter = buildChapterRecord(plot, config, {
      index,
      chapterId,
      globalIndex,
      beat,
      entryFromPrevious,
      entrySummary,
      chapterObstacle,
      scenes,
      events,
      mysteries,
    });
    chapterList.push(chapter);
    previousChapterConsequence = chapter.exit_consequence;
    pendingMysteries = carryPendingMysteries(pendingMysteries, mysteries, droppedMysteries, chapterId);
  }
  const volume = buildOutlineVolume(plot, chapterList, volumeId);
  const id = `outlinepack-${seed}-${String(options.index + 1 || 1).padStart(2, '0')}`;
  const threadRegistry = buildThreadRegistry((plot.storylines || [plot.storyline]).filter(Boolean), chapterList, droppedMysteries);
  const mysteryRegistry = collectMysteryRegistry(chapterList);
  return {
    id,
    plotpack_id: plot.id,
    worldpack_id: plot.worldpack_id,
    genre: plot.genre || '',
    premise: plot.premise,
    cast: plot.cast,
    cast_relations: plot.cast_relations,
    chapters: chapterList,
    mystery_registry: mysteryRegistry,
    thread_registry: threadRegistry,
    draft_outline: buildOutlineDraftOutline(plot, volume),
    chapter_config: {
      target_chars: targetChars,
      min_chars: Math.floor(targetChars * 0.6),
      chapters,
      scenes_per_chapter: scenesPerChapter,
    },
    prompt_pack: plot.prompt_pack,
    motif: plot.motif,
    graph: plot.graph || { entities: [], relations: [] },
    pending_mysteries: pendingMysteries,
    dropped_mysteries: droppedMysteries,
    abandoned_threads: droppedMysteries.map((item) => item.abandoned_thread).filter(Boolean),
  };
}

function buildThreadRegistry(storylines, chapters, droppedMysteries) {
  const abandonedIds = new Set(droppedMysteries.map((item) => item.thread_id).filter(Boolean));
  return storylines.map((item, index) => {
    const id = item.id || `thread-${index + 1}`;
    const threadChapters = chapters.filter((chapter) => chapter.thread_id === id);
    const resolvedChapters = chapters
      .filter((chapter) => chapterResolvedMysteries(chapter).some((mystery) => mystery.thread_id === id))
      .map((chapter) => chapter.id);
    const lastChapter = threadChapters[threadChapters.length - 1];
    const resolvedIn = resolvedChapters[resolvedChapters.length - 1]
      || (lastChapter && ['climax', 'resolution'].includes(lastChapter.beat_function) ? lastChapter.id : null);
    const abandonedHistory = abandonedIds.has(id);
    const resolvedMysteries = chapters.flatMap((chapter) => (
      chapterResolvedMysteries(chapter)
        .filter((mystery) => mystery.thread_id === id)
        .map((mystery) => ({ id: mystery.id, chapter_id: chapter.id }))
    ));
    const abandonedMysteries = droppedMysteries
      .filter((mystery) => mystery.thread_id === id)
      .map((mystery) => ({ id: mystery.id, chapter_id: mystery.dropped_in, question: mystery.question }));
    return {
      id,
      name: item.title || `storyline ${index + 1}`,
      type: index === 0 ? 'main' : 'subplot',
      importance: index === 0 ? 10 : 6,
      status: resolvedIn ? 'resolved' : abandonedHistory ? 'abandoned' : 'active',
      resolved_in: resolvedIn,
      resolved_chapters: resolvedChapters,
      resolved_mysteries: sortMysteryLinks(resolvedMysteries),
      abandoned_history: abandonedHistory,
      abandoned_mysteries: sortMysteryLinks(abandonedMysteries),
    };
  });
}

function resolveVolumePlan(plot, options) {
  const volumes = clampNumber(options.volumes, 1, 10, 1);
  const rawChaptersPerVolume = Number(options.chaptersPerVolume);
  const chaptersPerVolume = Number.isFinite(rawChaptersPerVolume) && rawChaptersPerVolume > 0
    ? clampNumber(rawChaptersPerVolume, 3, 60, 10)
    : clampNumber(options.chapters, 3, 60, 10);
  return { volumes, chaptersPerVolume, storylines: (plot.storylines || [plot.storyline]).filter(Boolean) };
}

function applyVolumeMetadata(volume, volumePlot, plot, volumeIndex, volumes) {
  volume.id = `P1-V${volumeIndex + 1}`;
  volume.title = `第${volumeIndex + 1}卷`;
  volume.chapters.forEach((chapter, chapterIndex) => {
    chapter.id = `${volume.id}-C${chapterIndex + 1}`;
  });
  volume.payoff_contract = {
    volume_question: volumePlot.storyline?.promise || '主角能否改变现状？',
    power_promise: volumePlot.storyline?.escalation || '主角获得一次改变规则的能力。',
    main_opponent_misread: plot.premise?.hidden_truth || '对手误读了主角真正的筹码。',
    big_win: volumePlot.storyline?.payoff || '主角完成一次无法撤回的胜利。',
    visible_reward: volumePlot.storyline?.cost || '胜利留下一个可见的代价。',
    reputation_shift: '主角从被规则支配的人变成能改写规则的人。',
    next_bigger_game: volumeIndex === volumes - 1 ? '故事收束，代价留下。' : '更大的对手进入视野。',
  };
  volume.opening_beat = `第${volumeIndex + 1}卷开场：${volumePlot.storyline?.promise || '旧规则仍在运转'}`;
  volume.closing_beat = `第${volumeIndex + 1}卷收束：${volumePlot.storyline?.payoff || '主角付出代价'}`;
  volume.mysteries = {
    planted: [volumePlot.storyline?.midpoint, plot.premise?.hidden_truth].filter(Boolean),
    resolved: [volumePlot.storyline?.cost].filter(Boolean),
  };
  volume.timeline = {
    start: volumeIndex === 0 ? 'before the first rule' : `after volume ${volumeIndex}`,
    end: `end of volume ${volumeIndex + 1}`,
    anchor: volumePlot.storyline?.title || plot.premise?.title || '',
  };
}

function assembleMultiVolumePack(context) {
  const { plot, seed, options, volumeList, bases, storylines, carriedMysteries, chaptersPerVolume, volumes } = context;
  const chapters = volumeList.flatMap((volume) => volume.chapters);
  const mysteryRegistry = collectMysteryRegistry(chapters);
  const id = `outlinepack-${seed}-${String((options.index || 0) + 1).padStart(2, '0')}`;
  const targetChars = clampNumber(options.targetChars, 500, 10000, 3000);
  const chapterConfig = {
    target_chars: targetChars,
    min_chars: Math.floor(targetChars * 0.6),
    volumes,
    chapters_per_volume: chaptersPerVolume,
    chapters: chapters.length,
    scenes_per_chapter: clampNumber(options.scenes, 1, 5, 3),
  };
  const setupDraft = buildSetupDraft({ ...plot, storylines }, { chapter_config: chapterConfig }, options.deck || DEFAULT_DECK);
  const allDropped = bases.flatMap((base) => base.dropped_mysteries || []);
  const abandonedThreads = allDropped.map((item) => item.abandoned_thread).filter(Boolean);
  setupDraft.abandoned_threads = abandonedThreads;
  setupDraft.dropped_mysteries = allDropped;
  setupDraft.mystery_registry = mysteryRegistry;
  const threadRegistry = buildThreadRegistry(storylines, chapters, allDropped);
  setupDraft.thread_registry = threadRegistry;
  return {
    ...bases[0],
    id,
    volumes: volumeList,
    chapters,
    setup_draft: setupDraft,
    mystery_registry: mysteryRegistry,
    thread_registry: threadRegistry,
    draft_outline: {
      thread_registry: threadRegistry,
        abandoned_threads: abandonedThreads,
      dropped_mysteries: allDropped,
      mystery_registry: mysteryRegistry,
        parts: [{
        id: 'P1',
        title: plot.premise?.title || '未命名故事',
        summary: plot.premise?.statement || '未填写故事前提。',
        volumes: volumeList,
      }],
    },
    chapter_config: chapterConfig,
    pending_mysteries: carriedMysteries,
    dropped_mysteries: allDropped,
    abandoned_threads: abandonedThreads,
  };
}

function buildMultiVolumeOutlinePack(plot, seed, options = {}) {
  const { volumes, chaptersPerVolume, storylines } = resolveVolumePlan(plot, options);
  const bases = [];
  let previousVolumeConsequence = '';
  let carriedMysteries = [];
  for (let volumeIndex = 0; volumeIndex < volumes; volumeIndex += 1) {
    const volumePlot = {
      ...plot,
      storyline: storylines[volumeIndex % storylines.length] || plot.storyline,
    };
    const base = buildOutlinePack(volumePlot, seed, {
      ...options,
      chapters: chaptersPerVolume,
      index: volumeIndex,
      chapterOffset: volumeIndex * chaptersPerVolume,
      totalChapters: volumes * chaptersPerVolume,
      volumeId: `P1-V${volumeIndex + 1}`,
      previousConsequence: previousVolumeConsequence,
      carriedMysteries,
    });
    const volume = base.draft_outline.parts[0].volumes[0];
    applyVolumeMetadata(volume, volumePlot, plot, volumeIndex, volumes);
    previousVolumeConsequence = volume.chapters[volume.chapters.length - 1]?.exit_consequence || previousVolumeConsequence;
    carriedMysteries = base.pending_mysteries || [];
    bases.push(base);
  }
  return assembleMultiVolumePack({
    plot,
    seed,
    options,
    volumeList: bases.map((base) => base.draft_outline.parts[0].volumes[0]),
    bases,
    storylines,
    carriedMysteries,
    chaptersPerVolume,
    volumes,
  });
}

export { buildMultiVolumeOutlinePack, buildOutlinePack, buildThreadRegistry };
