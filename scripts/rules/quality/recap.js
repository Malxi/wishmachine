// Quality rules for story/recaps/<chapter>.json: plot beats, outline agreement,
// presence consistency and text anchors.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, readText, safeSegment } from '../../util.js';
import { finding } from '../finding.js';
import { findOutlineChapter } from '../outline-shape.js';
import { asArray, isPlainObject } from './shared.js';

function qualityRecapFindings(project, id, override) {
  if (!id) throw new Error('recap check requires --id');
  const findings = [];
  const recap = override.recap || readJson(path.join(project.dir, 'story', 'recaps', `${safeSegment(id, 'recap id')}.json`));
  if (!isPlainObject(recap)) return findings;
  if (!asArray(recap.plot_beats).length) {
    findings.push(finding('quality.recap.plot_beats', 'medium', 'recap has no plot beats', id));
  }
  if (recap.chapter_id && recap.chapter_id !== id) {
    findings.push(finding('quality.recap.chapter_id', 'high', `recap declares chapter_id ${recap.chapter_id}, expected ${id}`, id));
  }
  const found = qualityRecapOutlineFindings(project, id, recap, findings);
  qualityRecapTextFindings(project, id, recap, found, findings);
  return findings;
}

function qualityRecapOutlineFindings(project, id, recap, findings) {
  const outlinePath = path.join(project.dir, 'story', 'compose', 'outline.json');
  if (!fs.existsSync(outlinePath)) return null;
  const found = findOutlineChapter(readJson(outlinePath), id);
  if (!found) {
    findings.push(finding('quality.recap.not_in_outline', 'medium', `${id} recap has no matching outline chapter`, id));
    return null;
  }
  const known = new Set(asArray(found.chapter.characters));
  for (const name of asArray(recap.present)) {
    if (known.size > 0 && !known.has(name)) {
      findings.push(finding('quality.recap.presence', 'medium', `${id} recap mentions ${name}, who is not in the outline chapter`, id));
    }
  }
  const outlineBeats = new Set(asArray(found.chapter.events).map((event) =>
    `${event.actor || ''}：${event.details || event.result || event.target || ''}`).filter((beat) => beat !== '：'));
  for (const beat of asArray(recap.plot_beats)) {
    if (outlineBeats.has(beat)) {
      findings.push(finding('quality.recap.outline_copy', 'medium', `${id} recap plot beat is copied from the outline event list`, id, 'Rewrite the recap from what the chapter actually dramatizes.'));
    }
  }
  if (found.chapter.location && recap.location && found.chapter.location !== recap.location) {
    findings.push(finding('quality.recap.location', 'low', `${id} recap location ${recap.location} differs from outline location ${found.chapter.location}`, id));
  }
  return found;
}

function qualityRecapTextFindings(project, id, recap, found, findings) {
  const chapterPath = path.join(project.dir, 'chapters', `${safeSegment(id, 'chapter id')}.md`);
  if (!fs.existsSync(chapterPath)) return;
  const chapterText = readText(chapterPath);
  if (recap.last_line && !chapterText.includes(recap.last_line)) {
    findings.push(finding('quality.recap.last_line', 'low', `${id} recap last_line does not appear in the chapter text`, id));
  }
  for (const name of asArray(recap.present)) {
    if (!chapterText.includes(name)) {
      findings.push(finding('quality.recap.presence_text', 'low', `${id} recap present character ${name} does not appear in the chapter text`, id));
    }
  }
  const knownNames = [...new Set([...asArray(found?.chapter?.characters), ...asArray(recap.present)])];
  for (const beat of asArray(recap.plot_beats)) {
    const beatNames = knownNames.filter((name) => String(beat).includes(name));
    const anchored = beatNames.length > 0
      ? beatNames.some((name) => chapterText.includes(name))
      : chapterText.includes(String(beat).slice(0, 6));
    if (!anchored) {
      findings.push(finding('quality.recap.plot_beat_text', 'low', `${id} recap plot beat has no recognizable anchor in the chapter text: ${beat}`, id));
    }
  }
}

export { qualityRecapFindings };
