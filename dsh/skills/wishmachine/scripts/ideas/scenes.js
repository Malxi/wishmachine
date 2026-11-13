// Per-chapter scene, mystery and event construction for outlinepacks.
import { EVENT_TYPE_PALETTE } from './shared.js';

// ---------------------------------------------------------------------------
// outlinepack
// ---------------------------------------------------------------------------

function collectCastInfo(plot) {
  const cast = plot.cast || [];
  const lead = cast.find((character) => character.role_tags?.[0] === 'protagonist') || cast[0] || null;
  const byRole = (role) => cast.filter((character) => character.role_tags?.[0] === role);
  return {
    names: cast.map((character) => character.name),
    ids: cast.map((character) => character.id),
    lead,
    leadName: lead?.name || '主角',
    leadId: lead?.id || '',
    leadCast: cast
      .filter((character) => ['protagonist', 'antagonist'].includes(character.role_tags?.[0]))
      .map((character) => character.name),
    leadCastIds: cast
      .filter((character) => ['protagonist', 'antagonist'].includes(character.role_tags?.[0]))
      .map((character) => character.id),
    supportCast: byRole('support').map((character) => character.name),
    supportCastIds: byRole('support').map((character) => character.id),
  };
}

function makeMystery(fields) {
  return {
    id: fields.id,
    question: fields.question,
    answer: fields.answer || '',
    payoff: fields.payoff || '',
    importance: fields.importance,
    thread: fields.thread,
    thread_id: fields.thread_id,
    thread_type: fields.thread_type,
    related_cast: fields.related_cast || [],
    related_cast_ids: fields.related_cast_ids || [],
    ...(fields.planted_in ? { planted_in: fields.planted_in } : {}),
    ...(fields.resolved_in ? { resolved_in: fields.resolved_in } : {}),
    status: fields.status || 'open',
  };
}

function pendingFromPlanted(mystery, chapterId) {
  return { ...mystery, from: chapterId, status: 'open' };
}

function plantChapterMystery(mysteries, pendingMysteries, mystery, chapterId) {
  mysteries.planted.push(mystery);
  pendingMysteries.push(pendingFromPlanted(mystery, chapterId));
}

// Scene mysteries stay local to their scene: they are planted and resolved
// inside the chapter and never leak into the chapter-level pending queue.
function buildSceneMysteries({
  plot, chapterId, sceneIndex, scenesPerChapter, sceneObstacle, castInfo, threadId,
}) {
  const lastScene = sceneIndex === scenesPerChapter - 1;
  const sceneId = `${chapterId}-scene-${sceneIndex + 1}-mystery`;
  const common = {
    answer: plot.storyline?.payoff || '',
    payoff: plot.storyline?.cost || '',
    thread: plot.storyline?.title || 'scene',
    thread_id: threadId || 'scene',
    thread_type: 'scene',
    related_cast: [castInfo.leadName, ...castInfo.supportCast].filter(Boolean).slice(0, 2),
    related_cast_ids: [castInfo.leadId, ...castInfo.supportCastIds].filter(Boolean).slice(0, 2),
  };
  const planted = [];
  if (sceneIndex === 0 && plot.premise?.hidden_truth) {
    planted.push(makeMystery({ ...common, id: sceneId, question: plot.premise.hidden_truth, importance: 4 }));
  } else if (sceneIndex === 1) {
    planted.push(makeMystery({ ...common, id: sceneId, question: `局部问题：${sceneObstacle}`, importance: 4 }));
  }
  const resolved = lastScene
    ? [makeMystery({
      ...common,
      id: sceneId,
      question: plot.storyline?.midpoint || plot.premise?.hidden_truth || '本章疑问',
      answer: plot.storyline?.payoff || '答案在场景末出现',
      importance: 6,
      status: 'resolved',
    })]
    : [];
  return { planted, resolved };
}

function buildScenes({
  plot, chapterId, beat, castInfo, chapterObstacle, entrySummary, targetChars, scenesPerChapter, threadId,
}) {
  const scenarioA = plot.scenarios?.[0] || null;
  const scenarioB = plot.scenarios?.[1] || null;
  const blocking = (plot.cast_relations || []).find((relation) => relation.semantic === 'blocks' || relation.type === 'blocks') || null;
  const scenes = [];
  let previousConsequence = '';
  for (let sceneIndex = 0; sceneIndex < scenesPerChapter; sceneIndex += 1) {
    const lastScene = sceneIndex === scenesPerChapter - 1;
    const sceneObstacle = sceneIndex === 0
      ? chapterObstacle
      : lastScene
        ? (plot.storyline?.cost || chapterObstacle)
        : (scenarioB?.twist || blocking?.stake || plot.premise?.hidden_truth || chapterObstacle);
    const sceneTurn = sceneIndex === 0 ? 'choice' : lastScene ? 'reversal' : 'complication';
    const turnEvent = sceneIndex === 0
      ? `主角选择进入：${beat.beat}`
      : lastScene
        ? `反转：${plot.storyline?.midpoint || scenarioB?.twist || '原本的理解被推翻'}`
        : `复杂化：${scenarioB?.twist || blocking?.stake || '新的阻力出现'}`;
    const sceneGoal = sceneIndex === 0
      ? (entrySummary ? `承接上一章“${entrySummary}”，进入：${beat.beat}` : beat.beat)
      : lastScene
        ? `处理上一场后果，并承受：${chapterObstacle}`
        : `承接“${previousConsequence}”，验证：${scenarioB?.twist || blocking?.stake || chapterObstacle}`;
    const consequence = lastScene
      ? (plot.storyline?.cost || '本章代价落地，主角带着不可撤回的结果进入下一章。')
      : `因为“${turnEvent}”，${scenarioA?.pressure || '局面被推进，但新的问题被留下。'}`;
    scenes.push({
      order: sceneIndex + 1,
      pov: castInfo.leadName,
      goal: sceneGoal,
      obstacle: sceneObstacle,
      turn: sceneTurn,
      turn_event: turnEvent,
      consequence,
      stakes: plot.storyline?.cost || '这一章必须付出代价',
      location: plot.location?.name || '关键地点',
      characters: castInfo.names.slice(0, Math.min(3, castInfo.names.length)),
      words: Math.ceil(targetChars / scenesPerChapter),
      tone: beat.act,
      mysteries: buildSceneMysteries({
        plot, chapterId, sceneIndex, scenesPerChapter, sceneObstacle, castInfo, threadId,
      }),
      beats: [beat.function, lastScene ? 'turn' : 'pressure'],
    });
    previousConsequence = consequence;
  }
  return scenes;
}

function buildChapterEvents({ chapterId, scenes, castInfo, globalIndex, totalChapters }) {
  const eventsPerChapter = totalChapters <= 20 ? Math.min(2, scenes.length) : 1;
  return Array.from({ length: eventsPerChapter }, (_, eventIndex) => {
    const scene = scenes[eventIndex === 0 ? 0 : scenes.length - 1];
    return {
      type: EVENT_TYPE_PALETTE[(globalIndex * eventsPerChapter + eventIndex) % EVENT_TYPE_PALETTE.length],
      characters: scene.characters,
      actor: castInfo.leadName,
      action: 'advance',
      target: scene.goal,
      target_type: 'scene',
      details: scene.goal,
      order: eventIndex + 1,
    };
  });
}

function pickBeat(beats, globalIndex, totalChapters) {
  if (!beats.length) return { act: 'Act I', function: 'setup', beat: '主角进入故事。' };
  const index = Math.min(beats.length - 1, Math.floor((globalIndex * beats.length) / totalChapters));
  return beats[index] || beats[0];
}

export { buildChapterEvents, buildScenes, collectCastInfo, makeMystery, pickBeat, plantChapterMystery };
