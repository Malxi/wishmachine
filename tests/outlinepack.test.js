// Outlinepack generator output shape and the idea/outline validators that guard it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateIdeaDraw } from '../scripts/ideas.js';
import { validateOutline, validateSetup } from '../scripts/schema.js';
import { drawCached, outlinepack } from './fixtures.js';

test('outlinepack expands plot beats into chapters and a draft outline', () => {
  const pack = outlinepack({ chapters: 10, scenes: 3, targetChars: 2000 });
  assert.equal(pack.chapters.length, 10);
  assert.equal(pack.chapters[0].scenes.length, 3);
  assert.equal(pack.chapters[0].target_chars, 2000);
  const chapter10Index = pack.mystery_registry.findIndex((mystery) => mystery.chapter_id === 'P1-V1-C10');
  const chapter2Index = pack.mystery_registry.findIndex((mystery) => mystery.chapter_id === 'P1-V1-C2');
  assert.ok(chapter10Index > chapter2Index);
  assert.deepEqual(pack.chapters.map((chapter) => chapter.id), Array.from({ length: 10 }, (_, index) => `P1-V1-C${index + 1}`));
  assert.equal(pack.draft_outline.parts[0].volumes[0].chapters.length, 10);
  assert.ok(pack.draft_outline.parts[0].volumes[0].chapters[0].events.length > 0);
  assert.ok(pack.chapters[0].chapter_payoff.desire);
  assert.deepEqual(validateOutline(pack.draft_outline, { structure: {} }), []);
});

test('outlinepack expands into multiple volumes', () => {
  const outline = drawCached({
    type: 'outlinepack', genre: '修仙', count: 1, seed: 42,
    volumes: 3, chaptersPerVolume: 4, scenes: 3, targetChars: 2000,
  }).results[0];
  assert.equal(outline.volumes.length, 3);
  assert.equal(outline.chapters.length, 12);
  assert.equal(outline.chapter_config.volumes, 3);
  assert.equal(outline.chapter_config.chapters_per_volume, 4);
  assert.equal(outline.chapters[0].id, 'P1-V1-C1');
  assert.equal(outline.chapters[11].id, 'P1-V3-C4');
  assert.equal(outline.volumes[2].payoff_contract.big_win.length > 0, true);
  assert.ok(new Set(outline.volumes.map((volume) => volume.payoff_contract.big_win)).size > 1);
  assert.ok(outline.volumes[0].chapters.every((chapter) => chapter.beat_function !== 'resolution'));
  assert.ok(outline.volumes[2].chapters.some((chapter) => chapter.beat_function === 'resolution'));
  assert.ok(outline.volumes[0].opening_beat);
  assert.ok(outline.volumes[0].closing_beat);
  assert.ok(outline.volumes[0].mysteries.planted.length > 0);
  assert.ok(outline.volumes[0].timeline.anchor);
  assert.ok(outline.volumes[0].beat_map.length > 0);
  assert.ok(outline.chapters[0].obstacle);
  assert.ok(outline.chapters[0].mysteries.planted.length > 0);
  assert.ok(outline.chapters[11].mysteries.resolved.length > 0);
  assert.ok(outline.chapters[0].scenes[0].obstacle);
  assert.equal(outline.chapters[0].scenes[0].turn, 'choice');
  assert.equal(outline.chapters[0].scenes[2].turn, 'reversal');
  assert.ok(outline.chapters[0].scenes[0].stakes);
  assert.ok(outline.chapters[0].scenes[0].turn_event);
  assert.ok(outline.chapters[0].scenes[0].mysteries.planted.length > 0);
  assert.ok(outline.chapters[0].scenes[0].mysteries.planted[0].question);
  assert.ok(outline.chapters[0].scenes[2].mysteries.resolved.length > 0);
  assert.ok(outline.chapters[0].scenes[2].mysteries.resolved[0].answer);
  assert.ok(new Set(outline.chapters[0].scenes.map((scene) => scene.obstacle)).size > 1);
  assert.ok(new Set(outline.chapters[0].scenes.map((scene) => scene.goal)).size > 1);
  assert.ok(outline.chapters[0].scenes.every((scene) => scene.consequence));
  assert.ok(outline.chapters[0].scenes.every((scene) => !('result' in scene)));
  assert.ok(outline.chapters[0].scenes[1].goal.includes('承接'));
  assert.ok(outline.chapters[0].scenes[1].mysteries.planted.length > 0);
  assert.equal(outline.chapters[0].scene_chain.length, 3);
  assert.equal(outline.chapters[0].scene_chain[1].turn, outline.chapters[0].scenes[1].turn_event);
  assert.equal(outline.chapters[1].entry_from_previous, outline.chapters[0].exit_consequence);
  assert.ok(outline.chapters[1].scenes[0].goal.includes('承接上一章'));
  assert.ok(outline.chapters[1].conflict.includes('承接上一章后果'));
  assert.ok(outline.chapters[1].obstacle.includes('上一章后果未解'));
  assert.ok(outline.chapters[1].mysteries.carried.length > 0);
  assert.ok(outline.chapters[1].mysteries.carried[0].id);
  assert.ok(outline.chapters[1].mysteries.carried[0].question);
  assert.ok(outline.chapters[1].mysteries.carried[0].importance);
  assert.ok(outline.chapters[1].mysteries.carried[0].thread);
  assert.ok(outline.chapters[1].mysteries.carried[0].related_cast.length > 0);
  assert.ok(outline.chapters[1].mysteries.carried.some((mystery) => mystery.thread_type === 'scene'));
  assert.ok(outline.chapters[1].mysteries.carried[0].thread.length > 0);
  assert.ok(outline.chapters[1].mysteries.carried[0].thread_id);
  assert.ok(outline.chapters[1].mysteries.carried[0].related_cast_ids.length > 0);
  assert.ok(outline.chapters[11].mysteries.resolved.length > 0);
  assert.ok(outline.chapters[11].mysteries.resolved[0].answer);
  assert.ok(outline.volumes[1].chapters[0].mysteries.carried.length > 0);
  assert.ok(outline.pending_mysteries.length <= 5);
  assert.ok(outline.chapters[1].scenes[0].obstacle.includes('上一章后果未解'));
  assert.ok(outline.chapters[1].chapter_payoff.pressure.includes('上一章留下的后果'));
  assert.ok(outline.chapters[0].chapter_payoff.hook.includes('下一章要处理'));
  assert.equal(outline.volumes[1].chapters[0].entry_from_previous, outline.volumes[0].chapters[3].exit_consequence);
  assert.ok(outline.setup_draft.storylines.length >= 2);
  assert.ok(outline.setup_draft.storylines.some((storyline) => storyline.type === 'subplot'));
  assert.ok(outline.setup_draft.storylines[0].thread_id);
  assert.ok(outline.thread_registry.length >= 2);
  assert.ok(outline.thread_registry.some((thread) => thread.id === outline.setup_draft.storylines[0].thread_id));
  assert.ok(outline.thread_registry.every((thread) => ['active', 'abandoned', 'resolved'].includes(thread.status)));
  assert.ok(outline.thread_registry.every((thread) => thread.status !== 'resolved' || thread.resolved_in));
  assert.ok(outline.chapters.every((chapter) => chapter.thread_id));
  assert.ok(outline.thread_registry.some((thread) => thread.status === 'resolved'));
  const resolvedThread = outline.thread_registry.find((thread) => thread.status === 'resolved');
  assert.ok(resolvedThread.resolved_mysteries.length > 0);
  assert.ok(resolvedThread.resolved_mysteries.every((mystery) => mystery.id && mystery.chapter_id));
  assert.ok(outline.mystery_registry.length > 0);
  const sortedRegistry = [...outline.mystery_registry].sort((a, b) => (
    String(a.chapter_id || '').localeCompare(String(b.chapter_id || ''), undefined, { numeric: true })
    || String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true })
  ));
  assert.deepEqual(outline.mystery_registry.map((mystery) => mystery.id), sortedRegistry.map((mystery) => mystery.id));
  assert.ok(outline.mystery_registry.some((mystery) => mystery.status === 'resolved'));
  assert.ok(outline.setup_draft.mystery_registry.length > 0);
  assert.equal(outline.draft_outline.mystery_registry.length, outline.mystery_registry.length);
  assert.ok(outline.setup_draft.core_cast[0].storyline_refs.includes(outline.setup_draft.storylines[0].thread_id));
  assert.equal(validateIdeaDraw({ results: [outline] }).ok, true);
  assert.equal(outline.setup_draft.premises[0].progression.length, 4);
  assert.ok(outline.setup_draft.world_timeline.length >= 2);
  assert.ok(outline.setup_draft.world_resources.every((resource) => ['能源', '消耗品', '材料', '货币'].includes(resource.category)));
  assert.ok(outline.setup_draft.project_name);
  assert.ok(outline.setup_draft.thread_registry.length >= 2);
  assert.equal(outline.draft_outline.thread_registry.length, outline.thread_registry.length);
  assert.deepEqual(validateSetup(outline.setup_draft), []);
  assert.deepEqual(validateOutline(outline.draft_outline, { structure: {} }), []);
  const badOutline = JSON.parse(JSON.stringify(outline.draft_outline));
  badOutline.parts[0].volumes[0].chapters[0].thread_id = 'missing-thread';
  assert.ok(validateOutline(badOutline, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.unknown_thread'));
});

test('long outlinepack records dropped mysteries', () => {
  const outline = outlinepack({ genre: '修仙', chapters: 30, scenes: 3 });
  assert.ok(outline.dropped_mysteries.length > 0);
  assert.ok(outline.dropped_mysteries.every((mystery) => mystery.status === 'dropped'));
  assert.ok(outline.dropped_mysteries.every((mystery) => mystery.dropped_in));
  assert.ok(outline.dropped_mysteries.every((mystery) => mystery.abandoned_thread?.thread_id));
  assert.ok(outline.abandoned_threads.length > 0);
  assert.ok(outline.chapters.some((chapter) => chapter.mysteries.dropped.length > 0));
  const abandonedThread = outline.thread_registry.find((thread) => thread.abandoned_mysteries.length > 0);
  assert.ok(abandonedThread);
  const unlinked = JSON.parse(JSON.stringify(outline.draft_outline));
  unlinked.thread_registry.find((thread) => thread.id === abandonedThread.id).abandoned_mysteries = [];
  assert.ok(validateOutline(unlinked, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.abandonment_not_linked'));
});

test('idea validation rejects unknown thread ids', () => {
  const outline = outlinepack();
  outline.chapters[0].mysteries.planted[0].thread_id = 'missing-thread';
  const result = validateIdeaDraw({ results: [outline] });
  assert.equal(result.ok, false);
  assert.ok(result.findings.some((finding) => finding.rule_id === 'idea.thread.unknown_mystery_thread'));
});

test('outline validation checks thread resolution and abandoned threads', () => {
  const outline = outlinepack();
  const bad = JSON.parse(JSON.stringify(outline.draft_outline));
  const resolved = bad.thread_registry.find((thread) => thread.status === 'resolved');
  assert.ok(resolved);
  const resolvedChapter = bad.parts[0].volumes[0].chapters.find((chapter) => chapter.id === resolved.resolved_in);
  resolvedChapter.mysteries.resolved = [];
  assert.ok(validateOutline(bad, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread_resolution_missing'));
  const abandoned = JSON.parse(JSON.stringify(outline.draft_outline));
  abandoned.thread_registry[0].status = 'abandoned';
  abandoned.abandoned_threads = [];
  assert.ok(validateOutline(abandoned, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.abandoned_thread_missing'));
  const unknownMystery = JSON.parse(JSON.stringify(outline.draft_outline));
  const resolvedThread = unknownMystery.thread_registry.find((thread) => thread.status === 'resolved');
  resolvedThread.resolved_mysteries[0].id = 'missing-mystery';
  assert.ok(validateOutline(unknownMystery, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.resolved_mystery_missing'));
  const missingRegistry = JSON.parse(JSON.stringify(outline.draft_outline));
  missingRegistry.mystery_registry = [];
  assert.ok(validateOutline(missingRegistry, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.mystery_not_in_registry'));
  const unsorted = JSON.parse(JSON.stringify(outline.draft_outline));
  unsorted.mystery_registry.reverse();
  assert.ok(validateOutline(unsorted, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.mystery.registry_order'));
  const unsortedThreads = JSON.parse(JSON.stringify(outline.draft_outline));
  unsortedThreads.thread_registry.reverse();
  assert.ok(validateOutline(unsortedThreads, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.registry_order'));
  const unsortedSetup = JSON.parse(JSON.stringify(outline.setup_draft));
  unsortedSetup.mystery_registry.reverse();
  assert.ok(validateSetup(unsortedSetup).some((finding) => finding.rule_id === 'quality.setup.mystery_registry.order'));
  const statusMismatch = JSON.parse(JSON.stringify(outline.draft_outline));
  const resolvedMystery = statusMismatch.mystery_registry.find((mystery) => mystery.status === 'resolved' && mystery.id.endsWith('-mystery-core'));
  resolvedMystery.status = 'open';
  assert.ok(validateOutline(statusMismatch, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.mystery.status_mismatch'));
  const stale = JSON.parse(JSON.stringify(outline.draft_outline));
  stale.mystery_registry.push({ id: 'stale-mystery', status: 'open' });
  assert.ok(validateOutline(stale, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.mystery.stale_registry'));
  const unlinked = JSON.parse(JSON.stringify(outline.draft_outline));
  const unlinkedThread = unlinked.thread_registry.find((thread) => thread.status === 'resolved');
  unlinkedThread.resolved_mysteries = [];
  assert.ok(validateOutline(unlinked, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.resolution_not_linked'));
  const unsortedLinks = JSON.parse(JSON.stringify(outline.draft_outline));
  const linkThread = unsortedLinks.thread_registry.find((thread) => thread.resolved_mysteries.length > 1);
  if (linkThread) {
    linkThread.resolved_mysteries.reverse();
    assert.ok(validateOutline(unsortedLinks, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.mystery_link_order'));
  }
  const duplicateLinks = JSON.parse(JSON.stringify(outline.draft_outline));
  const duplicateThread = duplicateLinks.thread_registry.find((thread) => thread.resolved_mysteries.length > 0);
  duplicateThread.resolved_mysteries.push(duplicateThread.resolved_mysteries[0]);
  assert.ok(validateOutline(duplicateLinks, { structure: {} }).some((finding) => finding.rule_id === 'quality.outline.thread.mystery_link_duplicate'));
});

test('idea validation checks thread status consistency', () => {
  const outline = outlinepack();
  const bad = JSON.parse(JSON.stringify(outline));
  bad.thread_registry[0].status = 'active';
  bad.thread_registry[0].resolved_in = 'P1-V1-C1';
  const active = validateIdeaDraw({ results: [bad] });
  assert.ok(active.findings.some((finding) => finding.rule_id === 'idea.thread.active_with_resolution'));
  const missing = JSON.parse(JSON.stringify(outline));
  missing.thread_registry[0].status = 'resolved';
  missing.thread_registry[0].resolved_in = 'missing-chapter';
  const resolved = validateIdeaDraw({ results: [missing] });
  assert.ok(resolved.findings.some((finding) => finding.rule_id === 'idea.thread.unknown_resolved_chapter'));
  const invalid = JSON.parse(JSON.stringify(outline));
  invalid.thread_registry[0].status = 'paused';
  assert.ok(validateIdeaDraw({ results: [invalid] }).findings.some((finding) => finding.rule_id === 'idea.thread.invalid_status'));
});
