// Per-part/volume/chapter structural rules for the outline tree: required
// fields, duplicate ids, nesting and the per-chapter checks.
import {
  OUTLINE_CHAPTER_REQUIRED_FIELDS,
  OUTLINE_PART_REQUIRED_FIELDS,
  OUTLINE_VOLUME_REQUIRED_FIELDS,
  UNSAFE_ID_PATTERN,
} from '../contracts.js';
import { finding } from './finding.js';
import {
  collectChapterMysteries, validateChapterCollections, validateChapterEvents,
  validateChapterExtras, validateChapterMysteriesShape, validateChapterStateAnchor,
  validateChapterTimeline,
} from './outline-chapters.js';

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
  for (const key of OUTLINE_PART_REQUIRED_FIELDS) {
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
  for (const key of OUTLINE_VOLUME_REQUIRED_FIELDS) {
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
  for (const key of OUTLINE_CHAPTER_REQUIRED_FIELDS) {
    if (typeof chapter[key] !== 'string' || !chapter[key].trim()) {
      ctx.findings.push(finding(`schema.outline.chapter.${key}`, 'high', `${chapterId}.${key} must be a non-empty string`, chapterId));
    }
  }
  if (typeof chapter.id === 'string' && UNSAFE_ID_PATTERN.test(chapter.id)) {
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

export { collectOutlineStructure };
