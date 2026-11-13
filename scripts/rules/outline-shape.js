// Outline shape: registries, ordering and per-part/volume/chapter structure.
// Cross-chapter mystery/thread semantics live in ./outline-semantics.js.
import { sortMysteryArray, sortThreadArray } from '../registry.js';
import { finding } from './finding.js';
import { validateMysterySemantics, validateOutlineCounts, validateThreadSemantics } from './outline-semantics.js';

function validateOutline(outline, config) {
  if (!outline || typeof outline !== 'object' || Array.isArray(outline)) {
    return [finding('schema.outline.object', 'critical', 'outline must be a JSON object')];
  }
  if (!Array.isArray(outline.parts) || outline.parts.length === 0) {
    return [finding('schema.outline.parts', 'critical', 'outline.parts must be a non-empty array')];
  }
  const ctx = createOutlineContext(outline, config);
  validateOutlineRegistries(ctx);
  validateRegistryOrder(ctx);
  collectOutlineStructure(ctx);
  validateMysterySemantics(ctx);
  validateThreadSemantics(ctx);
  validateOutlineCounts(ctx);
  return ctx.findings;
}

function createOutlineContext(outline, config) {
  return {
    outline,
    config,
    findings: [],
    ids: new Set(),
    threadIds: new Set(),
    threadMap: new Map(),
    mysteryRegistryIds: new Set(),
    hasMysteryRegistry: outline.mystery_registry !== undefined,
    chapterIds: [],
    chaptersById: new Map(),
    mysteryChapter: new Map(),
    mysteryFinalStatus: new Map(),
    volumeCount: 0,
    chapterCount: 0,
  };
}

function validateOutlineRegistries(ctx) {
  const { outline, findings } = ctx;
  if (outline.mystery_registry !== undefined) {
    if (!Array.isArray(outline.mystery_registry)) {
      findings.push(finding('schema.outline.mystery_registry', 'high', 'mystery_registry must be an array'));
    } else {
      for (const mystery of outline.mystery_registry) {
        if (!mystery?.id) {
          findings.push(finding('schema.outline.mystery_registry.id', 'high', 'mystery registry entry needs an id'));
          continue;
        }
        if (ctx.mysteryRegistryIds.has(mystery.id)) {
          findings.push(finding('quality.outline.mystery_registry.duplicate', 'high', `duplicate mystery id ${mystery.id}`, mystery.id));
        }
        ctx.mysteryRegistryIds.add(mystery.id);
      }
    }
  }
  if (outline.thread_registry === undefined) return;
  if (!Array.isArray(outline.thread_registry)) {
    findings.push(finding('schema.outline.thread_registry', 'high', 'thread_registry must be an array'));
    return;
  }
  for (const thread of outline.thread_registry) {
    if (!thread?.id) {
      findings.push(finding('schema.outline.thread_registry.id', 'high', 'thread registry entry needs an id'));
      continue;
    }
    if (ctx.threadIds.has(thread.id)) {
      findings.push(finding('quality.outline.thread_registry.duplicate', 'high', `duplicate thread id ${thread.id}`, thread.id));
    }
    ctx.threadIds.add(thread.id);
    ctx.threadMap.set(thread.id, thread);
    validateOutlineThreadShape(thread, findings);
  }
  validateOutlineAbandonedThreads(ctx);
}

function validateOutlineThreadShape(thread, findings) {
  if (thread.resolved_chapters !== undefined && (!Array.isArray(thread.resolved_chapters) || thread.resolved_chapters.some((id) => typeof id !== 'string'))) {
    findings.push(finding('schema.outline.thread_registry.resolved_chapters', 'medium', `${thread.id}.resolved_chapters must be an array of chapter ids`, thread.id));
  }
  if (thread.resolved_in && Array.isArray(thread.resolved_chapters) && !thread.resolved_chapters.includes(thread.resolved_in)) {
    findings.push(finding('quality.outline.thread.resolved_chapters_mismatch', 'medium', `${thread.id}.resolved_in is not listed in resolved_chapters`, thread.id));
  }
  if (thread.abandoned_history !== undefined && typeof thread.abandoned_history !== 'boolean') {
    findings.push(finding('schema.outline.thread_registry.abandoned_history', 'medium', `${thread.id}.abandoned_history must be boolean`, thread.id));
  }
  for (const key of ['resolved_mysteries', 'abandoned_mysteries']) {
    if (thread[key] !== undefined && (!Array.isArray(thread[key]) || thread[key].some((item) => typeof item !== 'object' || Array.isArray(item)))) {
      findings.push(finding(`schema.outline.thread_registry.${key}`, 'medium', `${thread.id}.${key} must be an array of objects`, thread.id));
    }
  }
}

function validateOutlineAbandonedThreads(ctx) {
  const { outline, findings } = ctx;
  if (outline.abandoned_threads === undefined) return;
  if (!Array.isArray(outline.abandoned_threads)) {
    findings.push(finding('schema.outline.abandoned_threads', 'high', 'abandoned_threads must be an array'));
    return;
  }
  for (const thread of outline.abandoned_threads) {
    if (!thread?.thread_id || !ctx.threadIds.has(thread.thread_id)) {
      findings.push(finding('quality.outline.abandoned_threads.unknown', 'high', `abandoned thread ${thread?.thread_id || '(missing)'} is not in thread_registry`, thread?.thread_id || ''));
    }
  }
}

function validateRegistryOrder(ctx) {
  const { outline, findings } = ctx;
  if (Array.isArray(outline.thread_registry)) {
    const sortedThreads = sortThreadArray(outline.thread_registry);
    if (sortedThreads.some((thread, index) => thread.id !== outline.thread_registry[index]?.id)) {
      findings.push(finding('quality.outline.thread.registry_order', 'low', 'thread_registry is not sorted by main/sub then id'));
    }
  }
  if (Array.isArray(outline.mystery_registry)) {
    const sorted = sortMysteryArray(outline.mystery_registry);
    if (sorted.some((mystery, index) => mystery.id !== outline.mystery_registry[index]?.id)) {
      findings.push(finding('quality.outline.mystery.registry_order', 'low', 'mystery_registry is not sorted by chapter_id/id', 'Sort the registry or run doctor --fix.'));
    }
  }
}
function collectOutlineStructure(ctx) {
  for (const [partIndex, part] of (ctx.outline.parts || []).entries()) {
    validateOutlinePart(ctx, part, partIndex);
  }
}

function validateOutlinePart(ctx, part, partIndex) {
  const partId = part?.id || `parts[${partIndex}]`;
  if (!part || typeof part !== 'object') {
    ctx.findings.push(finding('schema.outline.part', 'critical', `${partId} must be an object`, partId));
    return;
  }
  for (const key of ['id', 'title', 'summary']) {
    if (typeof part[key] !== 'string' || !part[key].trim()) {
      ctx.findings.push(finding(`schema.outline.part.${key}`, 'high', `${partId}.${key} must be a non-empty string`, partId));
    }
  }
  if (ctx.ids.has(part.id)) {
    ctx.findings.push(finding('quality.outline.duplicate_id', 'high', `duplicate id ${part.id}`, part.id));
  }
  ctx.ids.add(part.id);
  if (!Array.isArray(part.volumes) || part.volumes.length === 0) {
    ctx.findings.push(finding('schema.outline.volumes', 'high', `${partId}.volumes must be a non-empty array`, partId));
    return;
  }
  for (const [volumeIndex, volume] of part.volumes.entries()) {
    validateOutlineVolume(ctx, volume, { partId, volumeIndex });
  }
}

function validateOutlineVolume(ctx, volume, position) {
  ctx.volumeCount += 1;
  const volumeId = volume?.id || `${position.partId}.volumes[${position.volumeIndex}]`;
  if (!volume || typeof volume !== 'object') {
    ctx.findings.push(finding('schema.outline.volume', 'critical', `${volumeId} must be an object`, volumeId));
    return;
  }
  for (const key of ['id', 'title', 'summary']) {
    if (typeof volume[key] !== 'string' || !volume[key].trim()) {
      ctx.findings.push(finding(`schema.outline.volume.${key}`, 'high', `${volumeId}.${key} must be a non-empty string`, volumeId));
    }
  }
  if (ctx.ids.has(volume.id)) {
    ctx.findings.push(finding('quality.outline.duplicate_id', 'high', `duplicate id ${volume.id}`, volume.id));
  }
  ctx.ids.add(volume.id);
  if (!Array.isArray(volume.chapters) || volume.chapters.length === 0) {
    ctx.findings.push(finding('schema.outline.chapters', 'high', `${volumeId}.chapters must be a non-empty array`, volumeId));
    return;
  }
  for (const [chapterIndex, chapter] of volume.chapters.entries()) {
    validateOutlineChapter(ctx, chapter, { volumeId, chapterIndex });
  }
  if (ctx.config?.structure?.target_chapters && volume.chapters.length !== ctx.config.structure.target_chapters) {
    ctx.findings.push(finding('quality.outline.chapter_count', 'medium', `${volumeId} has ${volume.chapters.length} chapters; target is ${ctx.config.structure.target_chapters}`, volumeId));
  }
}

function validateOutlineChapter(ctx, chapter, position) {
  ctx.chapterCount += 1;
  const chapterId = chapter?.id || `${position.volumeId}.chapters[${position.chapterIndex}]`;
  if (!chapter || typeof chapter !== 'object') {
    ctx.findings.push(finding('schema.outline.chapter', 'critical', `${chapterId} must be an object`, chapterId));
    return;
  }
  ctx.chapterIds.push(chapter.id);
  ctx.chaptersById.set(chapter.id, chapter);
  collectChapterMysteries(ctx, chapter);
  for (const key of ['id', 'title', 'summary', 'conflict', 'pacing']) {
    if (typeof chapter[key] !== 'string' || !chapter[key].trim()) {
      ctx.findings.push(finding(`schema.outline.chapter.${key}`, 'high', `${chapterId}.${key} must be a non-empty string`, chapterId));
    }
  }
  if (typeof chapter.id === 'string' && /[\\/]|^\.\.?$/.test(chapter.id)) {
    ctx.findings.push(finding('schema.outline.chapter.id_format', 'high', `${chapterId} id must not contain path separators or be . or ..`, chapter.id));
  }
  if (ctx.threadIds.size > 0 && chapter.thread_id !== undefined && !ctx.threadIds.has(chapter.thread_id)) {
    ctx.findings.push(finding('quality.outline.unknown_thread', 'high', `${chapterId} references unknown thread ${chapter.thread_id}`, chapterId));
  }
  validateChapterCollections(ctx, chapter, chapterId);
  validateChapterEvents(ctx, chapter, chapterId);
  validateChapterTimeline(ctx, chapter, chapterId);
  validateChapterStateAnchor(ctx, chapter, chapterId);
  validateChapterMysteriesShape(ctx, chapter, chapterId);
  validateChapterExtras(ctx, chapter, chapterId);
  if (ctx.ids.has(chapter.id)) {
    ctx.findings.push(finding('quality.outline.duplicate_id', 'high', `duplicate id ${chapter.id}`, chapter.id));
  }
  ctx.ids.add(chapter.id);
}

function collectChapterMysteries(ctx, chapter) {
  for (const key of ['carried', 'planted', 'resolved', 'dropped']) {
    for (const mystery of chapter.mysteries?.[key] || []) recordMysteryStatus(ctx, mystery, chapter.id);
  }
  for (const scene of chapter.scenes || []) {
    for (const key of ['planted', 'resolved']) {
      for (const mystery of scene.mysteries?.[key] || []) recordMysteryStatus(ctx, mystery, chapter.id);
    }
  }
}

const MYSTERY_STATUS_PRIORITY = { open: 0, dropped: 1, resolved: 2 };

function recordMysteryStatus(ctx, mystery, chapterId) {
  if (!mystery?.id) return;
  ctx.mysteryChapter.set(mystery.id, chapterId);
  if (!mystery.status) return;
  const previous = ctx.mysteryFinalStatus.get(mystery.id);
  if (previous === undefined || (MYSTERY_STATUS_PRIORITY[mystery.status] || 0) >= (MYSTERY_STATUS_PRIORITY[previous] || 0)) {
    ctx.mysteryFinalStatus.set(mystery.id, mystery.status);
  }
}

function validateChapterCollections(ctx, chapter, chapterId) {
  if (!Array.isArray(chapter.characters) || chapter.characters.some((value) => typeof value !== 'string')) {
    ctx.findings.push(finding('schema.outline.chapter.characters', 'high', `${chapterId}.characters must be an array of strings`, chapterId));
  }
  if (!Array.isArray(chapter.events)) {
    ctx.findings.push(finding('schema.outline.chapter.events', 'high', `${chapterId}.events must be an array`, chapterId));
  }
}

function validateChapterEvents(ctx, chapter, chapterId) {
  if (!Array.isArray(chapter.events)) return;
  chapter.events.forEach((event, eventIndex) => {
    validateChapterEvent(ctx, event, `${chapterId}.events[${eventIndex}]`);
  });
}

function validateChapterEvent(ctx, event, eventId) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    ctx.findings.push(finding('schema.outline.chapter.event', 'high', `${eventId} must be an object`, eventId));
    return;
  }
  if (typeof (event.type || event.action) !== 'string' || !(event.type || event.action).trim()) {
    ctx.findings.push(finding('schema.outline.chapter.event', 'high', `${eventId} needs a non-empty type or action`, eventId));
  }
  if (event.characters !== undefined && (!Array.isArray(event.characters) || event.characters.some((value) => typeof value !== 'string'))) {
    ctx.findings.push(finding('schema.outline.chapter.event', 'medium', `${eventId}.characters must be an array of strings`, eventId));
  }
  if (event.target_type !== undefined && typeof event.target_type !== 'string') {
    ctx.findings.push(finding('schema.outline.chapter.event', 'medium', `${eventId}.target_type must be a string`, eventId));
  }
  if (event.order !== undefined && typeof event.order !== 'number') {
    ctx.findings.push(finding('schema.outline.chapter.event', 'medium', `${eventId}.order must be a number`, eventId));
  }
}

function validateChapterTimeline(ctx, chapter, chapterId) {
  if (chapter.timeline === undefined) return;
  if (!chapter.timeline || typeof chapter.timeline !== 'object' || Array.isArray(chapter.timeline)) {
    ctx.findings.push(finding('schema.outline.chapter.timeline', 'high', `${chapterId}.timeline must be an object`, chapterId));
  } else if (chapter.timeline.time_jump !== undefined && typeof chapter.timeline.time_jump !== 'boolean') {
    ctx.findings.push(finding('schema.outline.chapter.timeline', 'medium', `${chapterId}.timeline.time_jump must be a boolean`, chapterId));
  }
}

function validateChapterStateAnchor(ctx, chapter, chapterId) {
  if (chapter.state_anchor === undefined) return;
  if (!chapter.state_anchor || typeof chapter.state_anchor !== 'object' || Array.isArray(chapter.state_anchor)) {
    ctx.findings.push(finding('schema.outline.chapter.state_anchor', 'high', `${chapterId}.state_anchor must be an object`, chapterId));
    return;
  }
  const anchor = chapter.state_anchor;
  if (anchor.spirit_stones !== undefined && typeof anchor.spirit_stones !== 'number') {
    ctx.findings.push(finding('schema.outline.chapter.state_anchor', 'medium', `${chapterId}.state_anchor.spirit_stones must be a number`, chapterId));
  }
  for (const key of ['allies', 'key_items', 'injuries']) {
    if (anchor[key] !== undefined && (!Array.isArray(anchor[key]) || anchor[key].some((value) => typeof value !== 'string'))) {
      ctx.findings.push(finding('schema.outline.chapter.state_anchor', 'medium', `${chapterId}.state_anchor.${key} must be an array of strings`, chapterId));
    }
  }
}

function validateChapterMysteriesShape(ctx, chapter, chapterId) {
  if (chapter.mysteries === undefined) return;
  if (!chapter.mysteries || typeof chapter.mysteries !== 'object' || Array.isArray(chapter.mysteries)) {
    ctx.findings.push(finding('schema.outline.chapter.mysteries', 'high', `${chapterId}.mysteries must be an object`, chapterId));
    return;
  }
  for (const key of ['planted', 'resolved']) {
    if (chapter.mysteries[key] !== undefined && !Array.isArray(chapter.mysteries[key])) {
      ctx.findings.push(finding('schema.outline.chapter.mysteries', 'medium', `${chapterId}.mysteries.${key} must be an array`, chapterId));
    }
  }
}

function validateChapterExtras(ctx, chapter, chapterId) {
  if (chapter.chapter_payoff !== undefined && (!chapter.chapter_payoff || typeof chapter.chapter_payoff !== 'object' || Array.isArray(chapter.chapter_payoff))) {
    ctx.findings.push(finding('schema.outline.chapter.chapter_payoff', 'medium', `${chapterId}.chapter_payoff must be an object`, chapterId));
  }
  if (chapter.resource_ledger !== undefined && !Array.isArray(chapter.resource_ledger)) {
    ctx.findings.push(finding('schema.outline.chapter.resource_ledger', 'high', `${chapterId}.resource_ledger must be an array`, chapterId));
  }
}

function outlineIndex(outline) {
  return {
    part_count: outline?.parts?.length || 0,
    volume_count: (outline?.parts || []).reduce((n, p) => n + (p.volumes?.length || 0), 0),
    chapter_count: (outline?.parts || []).reduce((n, p) => n + (p.volumes || []).reduce((m, v) => m + (v.chapters?.length || 0), 0), 0),
    parts: (outline?.parts || []).map((p) => ({
      id: p.id,
      title: p.title,
      volumes: (p.volumes || []).map((v) => ({
        id: v.id,
        title: v.title,
        chapters: (v.chapters || []).map((c) => ({ id: c.id, title: c.title })),
      })),
    })),
  };
}

function findOutlineChapter(outline, id) {
  for (const part of outline?.parts || []) {
    for (const volume of part.volumes || []) {
      for (const chapter of volume.chapters || []) {
        if (chapter.id === id) return { part, volume, chapter };
      }
    }
  }
  return null;
}

export { findOutlineChapter, outlineIndex, validateOutline };
