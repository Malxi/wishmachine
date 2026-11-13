// Outline quality: event anchors. Event order, actor/target membership and the
// character/item state changes events imply (death, revival, leaving, item use).
import { finding } from '../finding.js';
import { asArray } from './shared.js';

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
      applyItemStateChange(state, { chapter, action, target, findings });
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

function applyItemStateChange(state, { chapter, action, target, findings }) {
  if (['acquire', 'get', 'pickup', 'receive', 'gain'].includes(action)) {
    state.itemState.set(target, true);
  } else if (['use', 'consume', 'equip', 'spend'].includes(action) && !state.itemState.get(target) && !state.knownItems.has(target)) {
    findings.push(finding('quality.outline.item_usage', 'high', `${chapter.id} uses item ${target} before it is acquired`, chapter.id, 'Add an acquire event earlier or remove the item usage.'));
  }
}

export { validateChapterEventQuality };
