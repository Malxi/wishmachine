// Registry abandon: mark one mystery as manually dropped, relink its thread as
// abandoned, rewrite both registries and record the operation.

import { writeJsonAtomic } from './util.js';
import { collectOutlineMysteryRegistry } from './registry.js';
import { findMysteryNode, loadRegistryDocs } from './registry-docs.js';
import { repairRegistry } from './registry-repair.js';
import { appendRegistryOperation, createRegistryBackup } from './registry-store.js';

function removeFromLists(chapter, mysteryId) {
  chapter.mysteries = chapter.mysteries || { carried: [], planted: [], resolved: [], dropped: [] };
  const removed = (list) => (list || []).filter((item) => item.id !== mysteryId);
  chapter.mysteries.carried = removed(chapter.mysteries.carried);
  chapter.mysteries.planted = removed(chapter.mysteries.planted);
  chapter.mysteries.resolved = removed(chapter.mysteries.resolved);
  chapter.mysteries.dropped = removed(chapter.mysteries.dropped);
  for (const scene of chapter.scenes || []) {
    if (!scene.mysteries) continue;
    scene.mysteries.planted = removed(scene.mysteries.planted);
    scene.mysteries.resolved = removed(scene.mysteries.resolved);
  }
}

function markMysteryDropped(docs, found, mysteryId, reason) {
  const { chapter, mystery } = found;
  const chapterId = chapter.id;
  removeFromLists(chapter, mysteryId);
  chapter.mysteries.dropped.push({ ...mystery, status: 'dropped', reason, dropped_in: chapterId });
  docs.outline.dropped_mysteries = Array.isArray(docs.outline.dropped_mysteries) ? docs.outline.dropped_mysteries : [];
  if (!docs.outline.dropped_mysteries.some((item) => item.id === mysteryId)) {
    docs.outline.dropped_mysteries.push({ ...mystery, status: 'dropped', reason, dropped_in: chapterId });
  }
}

function linkAbandonedThreads({ docs, mysteryId, threadId, chapterId, question }) {
  for (const doc of [docs.setup, docs.outline]) {
    for (const thread of doc.thread_registry || []) {
      if (thread.id !== threadId) continue;
      thread.resolved_mysteries = (thread.resolved_mysteries || []).filter((item) => item.id !== mysteryId);
      thread.abandoned_mysteries = thread.abandoned_mysteries || [];
      if (!thread.abandoned_mysteries.some((item) => item.id === mysteryId)) {
        thread.abandoned_mysteries.push({ id: mysteryId, chapter_id: chapterId, question });
      }
      thread.abandoned_history = true;
    }
  }
}

export function abandonMystery(project, mysteryId, reason = 'manual', options = {}) {
  if (!mysteryId) throw new Error('abandonMystery requires a mystery id');
  const docs = loadRegistryDocs(project);
  if (!docs) throw new Error('setup and outline are required before abandoning a mystery');
  const found = findMysteryNode(docs.outline, mysteryId);
  if (!found) throw new Error(`mystery not found: ${mysteryId}`);
  const { chapter, mystery } = found;
  const threadId = mystery.thread_id || '';
  const chapterId = chapter.id;
  const question = mystery.question || mystery.mystery || mysteryId;
  if (options.dryRun) {
    return {
      ok: true,
      action: 'abandon-dry-run',
      id: mysteryId,
      chapter_id: chapterId,
      thread_id: threadId,
      reason,
      dryRun: true,
    };
  }
  const backup = createRegistryBackup(project, 'abandon');
  markMysteryDropped(docs, found, mysteryId, reason);
  linkAbandonedThreads({ docs, mysteryId, threadId, chapterId, question });
  const expected = collectOutlineMysteryRegistry(docs.outline);
  docs.setup.mystery_registry = expected;
  docs.outline.mystery_registry = expected;
  writeJsonAtomic(docs.setupFile, docs.setup);
  writeJsonAtomic(docs.outlineFile, docs.outline);
  repairRegistry(project);
  const afterBackup = createRegistryBackup(project, 'abandon-after');
  appendRegistryOperation(project, {
    action: 'abandon',
    id: mysteryId,
    chapter_id: chapterId,
    thread_id: threadId,
    reason,
    backup,
    after_backup: afterBackup,
  });
  return {
    ok: true,
    action: 'abandon',
    id: mysteryId,
    chapter_id: chapterId,
    thread_id: threadId,
    reason,
  };
}
