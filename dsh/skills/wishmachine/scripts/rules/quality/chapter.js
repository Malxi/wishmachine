// Quality rules for chapters/<id>.md: length, outline agreement and recap agreement.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, readText, safeSegment } from '../../util.js';
import { finding } from '../finding.js';
import { findOutlineChapter } from '../outline-shape.js';
import { asArray } from './shared.js';

function qualityChapterFindings(project, id, override) {
  if (!id) throw new Error('chapter check requires --id');
  const safeId = safeSegment(id, 'chapter id');
  const file = path.join(project.dir, 'chapters', `${safeId}.md`);
  let text = override.chapterText;
  if (text === undefined) {
    if (!fs.existsSync(file)) throw new Error(`chapter not found: ${id}`);
    text = readText(file);
  }
  const findings = validateChapterLength(project, safeId, text);
  const found = validateChapterOutlineMatch(project, safeId, text, findings);
  validateChapterRecapMatch(project, safeId, found, findings);
  return findings;
}

function validateChapterLength(project, id, text) {
  const findings = [];
  const chapterConfig = project.config.chapter_config || {};
  const targetChars = Number(chapterConfig.target_chars) || 3000;
  const minChars = Number(chapterConfig.min_chars) || 1800;
  const cjkChars = (text.match(/[\u3400-\u9fff]/g) || []).length;
  if (cjkChars < minChars) {
    findings.push(finding('quality.chapter.length', 'high', `${id} has ${cjkChars} CJK characters; minimum is ${minChars}`, id, 'Expand the chapter into scenes before applying it.'));
  } else if (cjkChars < targetChars) {
    findings.push(finding('quality.chapter.length_target', 'medium', `${id} has ${cjkChars} CJK characters; target is ${targetChars}`, id, 'Add scene detail, dialogue, or a stronger turn.'));
  }
  return findings;
}

function validateChapterOutlineMatch(project, id, text, findings) {
  const outlinePath = path.join(project.dir, 'story', 'compose', 'outline.json');
  const outline = fs.existsSync(outlinePath) ? readJson(outlinePath) : null;
  const found = outline ? findOutlineChapter(outline, id) : null;
  if (outline && !found) {
    findings.push(finding('quality.chapter.not_in_outline', 'medium', `${id} is not present in the outline`, id));
  }
  if (!found?.chapter) return found;
  if (found.chapter.title && !text.includes(found.chapter.title)) {
    findings.push(finding('quality.chapter.title', 'low', `${id} text does not contain the outline title ${found.chapter.title}`, id));
  }
  for (const name of asArray(found.chapter.characters)) {
    if (!text.includes(name)) {
      findings.push(finding('quality.chapter.character_absent', 'low', `${id} outline character ${name} never appears in the text`, id));
    }
  }
  for (const event of asArray(found.chapter.events)) {
    const labels = [
      event.actor, event.target, event.subject,
      ...asArray(event.characters),
    ].filter((value) => typeof value === 'string' && value.trim());
    if (labels.length > 0 && !labels.some((value) => text.includes(value))) {
      findings.push(finding('quality.chapter.event_absent', 'low', `${id} outline event ${labels.join(' / ')} does not appear in the text`, id));
    }
  }
  return found;
}

function validateChapterRecapMatch(project, id, found, findings) {
  const recapPath = path.join(project.dir, 'story', 'recaps', `${safeSegment(id, 'recap id')}.json`);
  if (!fs.existsSync(recapPath)) {
    findings.push(finding('quality.chapter.no_recap', 'low', `${id} has no recap`, id));
    return;
  }
  const recap = readJson(recapPath);
  if (recap.chapter_id && recap.chapter_id !== id) {
    findings.push(finding('quality.chapter.recap_id', 'high', `${id} recap declares chapter_id ${recap.chapter_id}`, id));
  }
  const known = new Set(asArray(found?.chapter?.characters));
  for (const name of asArray(recap.present)) {
    if (known.size > 0 && !known.has(name)) {
      findings.push(finding('quality.chapter.recap_presence', 'medium', `${id} recap mentions ${name}, who is not in the outline chapter`, id));
    }
  }
  if (found?.chapter?.location && recap.location && found.chapter.location !== recap.location) {
    findings.push(finding('quality.chapter.recap_location', 'low', `${id} recap location ${recap.location} differs from outline location ${found.chapter.location}`, id));
  }
}

export { qualityChapterFindings };
