// Outline quality: resource ledgers and pacing/mystery order. The spirit-stone
// ledger must be continuous and arithmetically sound, and chapter mysteries must
// be planted before they are resolved.
import { finding } from '../finding.js';
import { asArray } from './shared.js';

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
      findings.push(finding('quality.outline.pacing', 'medium', `${previous[0].id}..${chapter.id} is three consecutive fast chapters`, chapter.id, 'Insert a slower chapter or a breather beat.'));
    }
  }
}

export { validateChapterMysteryOrderQuality, validateChapterResourceQuality };
