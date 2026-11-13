// Quality rules for story/compose/outline.json: cast continuity, event anchors,
// resource ledgers, mystery order and pacing across chapters and volumes.
import fs from 'node:fs';
import path from 'node:path';
import { readJson } from '../../util.js';
import { finding } from '../finding.js';
import { asArray, isPlainObject } from './shared.js';

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
  if (chapter.id && !/^P\d+-V\d+-C\d+$/.test(chapter.id)) {
    findings.push(finding('quality.outline.chapter_id', 'low', `chapter id ${chapter.id} does not use P1-V1-C1 form`, chapter.id));
  }
  validateChapterCastQuality(state, chapter);
  validateChapterAnchorQuality(state, chapter);
  validateChapterEventQuality(state, chapter);
  validateChapterStorylineQuality(state, chapter);
  validateChapterResourceQuality(state, chapter, position);
  validateChapterMysteryOrderQuality(state, chapter, position);
}

function validateChapterCastQuality(state, chapter) {
  const { findings } = state;
  const revivedNow = new Set(asArray(chapter.events)
    .filter((event) => ['revive', 'resurrect'].includes(String(event.action || event.change || '').toLowerCase()))
    .map((event) => String(event.target || event.subject || '').trim())
    .filter(Boolean));
  const returnedNow = new Set(asArray(chapter.events)
    .filter((event) => ['return', 'arrive', 'rejoin'].includes(String(event.action || event.change || '').toLowerCase()))
    .map((event) => String(event.target || event.subject || '').trim())
    .filter(Boolean));
  for (const name of asArray(chapter.characters)) {
    if (state.deadCharacters.has(name) && !revivedNow.has(name)) {
      findings.push(finding('quality.outline.dead_character_present', 'high', `${chapter.id} includes ${name}, who died in an earlier chapter`, chapter.id, 'Add a revival event or remove the character from this chapter.'));
    } else if (state.absentCharacters.has(name) && !returnedNow.has(name)) {
      findings.push(finding('quality.outline.character_absent_return', 'low', `${chapter.id} includes ${name}, who left earlier without a return event`, chapter.id, 'Add a return/arrive event or show how the character rejoined.'));
    }
  }
  for (const name of asArray(chapter.characters)) {
    state.names.add(name);
    const previous = state.lastSeen.get(name);
    if (previous !== undefined && state.sequence - previous > 2 && !state.returnedCharacters.has(name)) {
      findings.push(finding('quality.outline.character_return', 'low', `${name} returns after ${state.sequence - previous - 1} chapters without a presence beat`, chapter.id, 'Show where the character has been or why they return now.'));
      state.returnedCharacters.add(name);
    }
    state.lastSeen.set(name, state.sequence);
    if (state.castNames.size > 0 && !state.castNames.has(name)) {
      findings.push(finding('quality.outline.unknown_character', 'low', `${chapter.id} uses unknown character ${name}`, chapter.id));
    }
  }
  if (asArray(chapter.characters).length === 0) {
    findings.push(finding('quality.outline.characters', 'medium', `${chapter.id} has no characters`, chapter.id));
  }
  if (asArray(chapter.events).length === 0) {
    findings.push(finding('quality.outline.events', 'medium', `${chapter.id} has no events`, chapter.id));
  }
}

function validateChapterAnchorQuality(state, chapter) {
  const { findings } = state;
  for (const ally of asArray(chapter.state_anchor?.allies)) {
    if (state.deadCharacters.has(ally)) {
      findings.push(finding('quality.outline.dead_ally', 'high', `${chapter.id} state_anchor lists ${ally}, who already died`, chapter.id, 'Remove the dead ally or add a revival event.'));
    } else if (state.absentCharacters.has(ally)) {
      findings.push(finding('quality.outline.absent_ally', 'low', `${chapter.id} state_anchor lists ${ally}, who has left`, chapter.id));
    } else if (state.castNames.size > 0 && !state.castNames.has(ally)) {
      findings.push(finding('quality.outline.unknown_ally', 'low', `${chapter.id} state_anchor lists unknown ally ${ally}`, chapter.id));
    }
  }
  for (const item of asArray(chapter.state_anchor?.key_items)) {
    if (!state.knownItems.has(item) && !state.itemState.has(item)) {
      findings.push(finding('quality.outline.anchor_item', 'low', `${chapter.id} state_anchor lists unknown key item ${item}`, chapter.id, 'Define it in setup/craft or acquire it in an earlier event.'));
    }
  }
}

function validateChapterEventQuality(state, chapter) {
  const { findings } = state;
  let previousEventOrder = null;
  for (const event of asArray(chapter.events)) {
    const type = event.type || event.action;
    if (typeof event.order === 'number') {
      if (previousEventOrder !== null && event.order < previousEventOrder) {
        findings.push(finding('quality.outline.event_order', 'medium', `${chapter.id} event order goes backwards: ${previousEventOrder} -> ${event.order}`, chapter.id));
      }
      previousEventOrder = event.order;
    }
    const chapterCharacters = new Set(asArray(chapter.characters));
    if (event.actor && chapterCharacters.size > 0 && !chapterCharacters.has(event.actor) &&
      (state.castNames.size === 0 || state.castNames.has(event.actor))) {
      findings.push(finding('quality.outline.event_actor', 'medium', `${chapter.id} event actor ${event.actor} is not in chapter.characters`, chapter.id));
    }
    const targetType = String(event.target_type || '').toLowerCase();
    const target = String(event.target || event.subject || '').trim();
    if (targetType === 'character' && target && chapterCharacters.size > 0 && !chapterCharacters.has(target)) {
      findings.push(finding('quality.outline.event_target', 'medium', `${chapter.id} event target ${target} is not in chapter.characters`, chapter.id));
    }
    for (const name of asArray(event.characters)) {
      if (!asArray(chapter.characters).includes(name)) {
        findings.push(finding('quality.outline.event_character', 'medium', `${chapter.id} event uses ${name}, who is not in chapter.characters`, chapter.id));
      }
    }
    const action = String(event.action || event.change || '').toLowerCase();
    if (target && (targetType === 'character' || type === 'character')) {
      applyCharacterStateChange(state, action, target);
    }
    if (target && (targetType === 'item' || type === 'item')) {
      applyItemStateChange(state, chapter, action, target, findings);
    }
  }
}

function applyCharacterStateChange(state, action, target) {
  if (['kill', 'die', 'death'].includes(action)) {
    state.deadCharacters.add(target);
    state.absentCharacters.delete(target);
  } else if (['revive', 'resurrect'].includes(action)) {
    state.deadCharacters.delete(target);
  } else if (['leave', 'exit', 'depart'].includes(action)) {
    state.absentCharacters.add(target);
  } else if (['return', 'arrive', 'rejoin'].includes(action)) {
    state.absentCharacters.delete(target);
  }
}

function applyItemStateChange(state, chapter, action, target, findings) {
  if (['acquire', 'get', 'pickup', 'receive', 'gain'].includes(action)) {
    state.itemState.set(target, true);
  } else if (['use', 'consume', 'equip', 'spend'].includes(action) && !state.itemState.get(target) && !state.knownItems.has(target)) {
    findings.push(finding('quality.outline.item_usage', 'high', `${chapter.id} uses item ${target} before it is acquired`, chapter.id, 'Add an acquire event earlier or remove the item usage.'));
  }
}

function validateChapterStorylineQuality(state, chapter) {
  const { findings } = state;
  for (const advance of asArray(chapter.storyline_advances)) {
    const name = advance.storyline_name;
    if (name && state.storylineNames.size > 0 && !state.storylineNames.has(name)) {
      findings.push(finding('quality.outline.unknown_storyline', 'medium', `${chapter.id} advances unknown storyline ${name}`, chapter.id));
    }
  }
}

function validateChapterResourceQuality(state, chapter, position) {
  const { findings } = state;
  for (const entry of asArray(chapter.resource_ledger)) {
    if (typeof entry?.start !== 'number' || typeof entry?.delta !== 'number' || typeof entry?.end !== 'number') {
      findings.push(finding('quality.outline.resource_ledger', 'medium', `${chapter.id} resource_ledger entry for ${entry?.item || 'item'} needs numeric start/delta/end`, chapter.id));
    } else if (entry.start + entry.delta !== entry.end) {
      findings.push(finding('quality.outline.resource_ledger', 'high', `${chapter.id} resource_ledger arithmetic is wrong for ${entry.item || 'item'}: ${entry.start} + ${entry.delta} != ${entry.end}`, chapter.id));
    }
  }
  const anchorSpirit = chapter.state_anchor?.spirit_stones;
  if (state.previousSpiritEnd !== null && typeof anchorSpirit === 'number' && anchorSpirit !== state.previousSpiritEnd) {
    findings.push(finding('quality.outline.anchor_continuity', 'medium', `${chapter.id} state_anchor.spirit_stones ${anchorSpirit} does not match the previous ledger end ${state.previousSpiritEnd}`, chapter.id, 'Carry the previous end value into the next state_anchor.'));
  }
  const spiritEntry = asArray(chapter.resource_ledger).find((entry) =>
    /spirit|灵石|灵力|晶石/i.test(String(entry?.item || '')));
  if (spiritEntry && typeof spiritEntry.end === 'number') {
    state.previousSpiritEnd = spiritEntry.end;
  }
  if (spiritEntry && typeof anchorSpirit === 'number' && anchorSpirit !== spiritEntry.start) {
    findings.push(finding('quality.outline.anchor_start', 'medium', `${chapter.id} state_anchor.spirit_stones ${anchorSpirit} does not match its own ledger start ${spiritEntry.start}`, chapter.id));
  }
  if (typeof chapter.state_anchor?.spirit_stones === 'number' && chapter.state_anchor.spirit_stones < 0) {
    findings.push(finding('quality.outline.negative_resource', 'medium', `${chapter.id} state_anchor.spirit_stones is negative`, chapter.id));
  }
  if (position.index > 0) {
    const previous = position.chapters[position.index - 1];
    if (previous.location && chapter.location && previous.location !== chapter.location &&
      !String(chapter.timeline?.transition || '').trim()) {
      findings.push(finding('quality.outline.transition', 'low', `${previous.id} -> ${chapter.id} changes location without a timeline.transition`, chapter.id, 'Explain the move or add a transition beat.'));
    }
  }
}

function validateChapterMysteryOrderQuality(state, chapter, position) {
  const { findings } = state;
  for (const planted of asArray(chapter.mysteries?.planted)) {
    if (!planted.id) continue;
    if (state.plantedMysteries.has(planted.id)) {
      findings.push(finding('quality.outline.mystery_duplicate', 'low', `${chapter.id} re-plants mystery ${planted.id}`, chapter.id));
    }
    state.plantedMysteries.add(planted.id);
  }
  for (const resolved of asArray(chapter.mysteries?.resolved)) {
    if (resolved.id && !state.plantedMysteries.has(resolved.id)) {
      findings.push(finding('quality.outline.mystery_resolution', 'medium', `${chapter.id} resolves mystery ${resolved.id} before it is planted`, chapter.id));
    }
  }
  if (position.index >= 2) {
    const previous = position.chapters.slice(position.index - 2, position.index + 1);
    if (previous.every((item) => String(item.pacing || '').toLowerCase().startsWith('fast'))) {
      findings.push(finding('quality.outline.pacing', 'medium', `${previous[0].id}..${chapter.id} is three consecutive fast chapters`, chapter.id, 'Insert a slower chapter or a breather scene.'));
    }
  }
}

export { qualityOutlineFindings };
