// Quality rules for story/compose/outline.json: cast continuity, event anchors,
// resource ledgers, mystery order and pacing across chapters and volumes.
// The per-concern checks live in the sibling outline-*.js modules; this file owns
// the shared state, setup gate and the part/volume/chapter walk.
import fs from 'node:fs';
import path from 'node:path';
import { CHAPTER_ID_PATTERN } from '../../contracts.js';
import { readJson } from '../../util.js';
import { finding } from '../finding.js';
import { asArray, isPlainObject } from './shared.js';
import {
  validateChapterAnchorQuality,
  validateChapterCastQuality,
  validateChapterStorylineQuality,
} from './outline-cast.js';
import { validateChapterEventQuality } from './outline-events.js';
import { validateChapterMysteryOrderQuality, validateChapterResourceQuality } from './outline-resources.js';

function qualityOutlineFindings(project, override) {
  const outline = override.outline || readJson(path.join(project.dir, 'story', 'compose', 'outline.json'));
  if (!isPlainObject(outline)) return [];
  const setupPath = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const setup = override.setup || (fs.existsSync(setupPath) ? readJson(setupPath) : null);
  const state = createOutlineQualityState(project, setup);
  const protagonistName = validateOutlineQualitySetup(state, setup);
  for (const part of asArray(outline.parts)) {
    for (const volume of asArray(part.volumes)) {
      validateOutlineVolumeQuality(state, volume);
    }
  }
  if (state.names.size === 0) {
    state.findings.push(finding('quality.outline.cast', 'high', 'outline has no chapter characters'));
  }
  if (protagonistName && !state.names.has(protagonistName)) {
    state.findings.push(finding('quality.outline.protagonist_missing', 'medium', `protagonist ${protagonistName} does not appear in any chapter`, 'protagonist'));
  }
  return state.findings;
}

function createOutlineQualityState(project, setup) {
  const knownItems = new Set([
    ...(asArray(setup?.world_resources).map((item) => item.name)),
    ...(asArray(setup?.premises).map((item) => item.name)),
  ].filter(Boolean));
  const craftItemPath = path.join(project.dir, 'story', 'craft', 'item.json');
  if (fs.existsSync(craftItemPath)) {
    const craftItem = readJson(craftItemPath);
    if (craftItem?.name) knownItems.add(craftItem.name);
  }
  return {
    findings: [],
    names: new Set(),
    itemState: new Map(),
    plantedMysteries: new Set(),
    knownItems,
    castNames: new Set(asArray(setup?.core_cast).map((character) => character.name).filter(Boolean)),
    storylineNames: new Set(asArray(setup?.storylines).map((storyline) => storyline.name).filter(Boolean)),
    lastSeen: new Map(),
    returnedCharacters: new Set(),
    deadCharacters: new Set(),
    absentCharacters: new Set(),
    previousSpiritEnd: null,
    sequence: 0,
  };
}

function validateOutlineQualitySetup(state, setup) {
  if (!setup) return '';
  const protagonist = asArray(setup.core_cast).find((character) => character.role === 'protagonist');
  if (!protagonist) {
    state.findings.push(finding('quality.setup.protagonist', 'medium', 'setup has no protagonist in core_cast', 'setup'));
    return '';
  }
  if (!protagonist.story_function) {
    state.findings.push(finding('quality.character.background', 'medium', 'protagonist has no story_function/background anchor', protagonist.id || protagonist.name || 'protagonist'));
  }
  if (!protagonist.relationship_to_lead && !protagonist.relationship_arc) {
    state.findings.push(finding('quality.character.motivation', 'medium', 'protagonist has no relationship or motivation anchor', protagonist.id || protagonist.name || 'protagonist'));
  }
  return protagonist.name || '';
}

function validateOutlineVolumeQuality(state, volume) {
  if (!isPlainObject(volume)) return;
  const eventTypes = {};
  const chapters = asArray(volume.chapters);
  chapters.forEach((chapter, index) => {
    state.sequence += 1;
    validateOutlineChapterQuality(state, chapter, { index, chapters });
    for (const event of asArray(chapter.events)) {
      const type = event.type || event.action;
      if (type) eventTypes[type] = (eventTypes[type] || 0) + 1;
    }
  });
  for (const [type, count] of Object.entries(eventTypes)) {
    if (count > 3) {
      state.findings.push(finding('quality.outline.event_repetition', 'medium', `event type '${type}' is used ${count} times in ${volume.id}`, volume.id, 'Vary the event types across the volume.'));
    }
  }
}

function validateOutlineChapterQuality(state, chapter, position) {
  if (!isPlainObject(chapter)) return;
  const { findings } = state;
  if (chapter.id && !CHAPTER_ID_PATTERN.test(chapter.id)) {
    findings.push(finding('quality.outline.chapter_id', 'low', `chapter id ${chapter.id} does not use P1-V1-C1 form`, chapter.id));
  }
  validateChapterCastQuality(state, chapter);
  validateChapterAnchorQuality(state, chapter);
  validateChapterEventQuality(state, chapter);
  validateChapterStorylineQuality(state, chapter);
  validateChapterResourceQuality(state, chapter, position);
  validateChapterMysteryOrderQuality(state, chapter, position);
}

export { qualityOutlineFindings };
