// Per-chapter outline shape rules: mystery status collection plus chapter
// collections, events, timeline, state anchors and extra chapter fields.
import { finding } from './finding.js';

const MYSTERY_STATUS_PRIORITY = { open: 0, dropped: 1, resolved: 2 };

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

export {
  collectChapterMysteries, validateChapterCollections, validateChapterEvents,
  validateChapterExtras, validateChapterMysteriesShape, validateChapterStateAnchor,
  validateChapterTimeline,
};
