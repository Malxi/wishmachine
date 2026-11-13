// Outline quality: cast continuity and state anchors. Characters that die or
// leave must not reappear without a revival/return event, and chapter anchors must
// reference known cast, items and storylines.
import { finding } from '../finding.js';
import { asArray } from './shared.js';

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

function validateChapterStorylineQuality(state, chapter) {
  const { findings } = state;
  for (const advance of asArray(chapter.storyline_advances)) {
    const name = advance.storyline_name;
    if (name && state.storylineNames.size > 0 && !state.storylineNames.has(name)) {
      findings.push(finding('quality.outline.unknown_storyline', 'medium', `${chapter.id} advances unknown storyline ${name}`, chapter.id));
    }
  }
}

export { validateChapterAnchorQuality, validateChapterCastQuality, validateChapterStorylineQuality };
