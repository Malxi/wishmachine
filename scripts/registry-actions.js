// Registry actions: clean stale entries, abandon a mystery, repair drift.
// All status/order repair goes through registry-rules.js so check and repair
// share one derivation.

import fs from 'node:fs';
import { readJson, writeJsonAtomic } from './util.js';
import { collectOutlineMysteryRegistry, outlineChapters } from './registry.js';
import { outlineFile, setupFile } from './artifacts.js';
import { registryExpectations, registryRepairReasons } from './registry-rules.js';
import { appendRegistryOperation, createRegistryBackup, readRegistryOperations } from './registry-store.js';
import { checkProject } from './schema.js';

export function loadRegistryDocs(project) {
  const setupPath = setupFile(project.dir);
  const outlinePath = outlineFile(project.dir);
  if (!fs.existsSync(setupPath) || !fs.existsSync(outlinePath)) return null;
  try {
    return {
      setupFile: setupPath,
      outlineFile: outlinePath,
      setup: readJson(setupPath),
      outline: readJson(outlinePath),
    };
  } catch (error) {
    throw new Error(`registry documents could not be read: ${error.message}`);
  }
}

function findMysteryNode(outline, id) {
  for (const chapter of outlineChapters(outline)) {
    for (const key of ['carried', 'planted', 'resolved', 'dropped']) {
      const list = chapter.mysteries?.[key] || [];
      const index = list.findIndex((mystery) => mystery.id === id);
      if (index >= 0) return { chapter, key, index, mystery: list[index], scene: null };
    }
    for (const scene of chapter.scenes || []) {
      for (const key of ['planted', 'resolved']) {
        const list = scene.mysteries?.[key] || [];
        const index = list.findIndex((mystery) => mystery.id === id);
        if (index >= 0) return { chapter, key, index, mystery: list[index], scene };
      }
    }
  }
  return null;
}

function cleanThreadLinks(docs, validIds) {
  let removedLinks = 0;
  for (const doc of [docs.setup, docs.outline]) {
    for (const thread of doc.thread_registry || []) {
      const resolved = (thread.resolved_mysteries || []).filter((mystery) => validIds.has(mystery.id));
      const abandoned = (thread.abandoned_mysteries || []).filter((mystery) => validIds.has(mystery.id));
      removedLinks += (thread.resolved_mysteries || []).length - resolved.length;
      removedLinks += (thread.abandoned_mysteries || []).length - abandoned.length;
      thread.resolved_mysteries = resolved;
      thread.abandoned_mysteries = abandoned;
    }
  }
  return removedLinks;
}

function registryEntryCount(doc) {
  return Array.isArray(doc?.mystery_registry) ? doc.mystery_registry.length : 0;
}

export function cleanRegistry(project, options = {}) {
  const docs = loadRegistryDocs(project);
  if (!docs) throw new Error('setup and outline are required before cleaning registries');
  const expected = collectOutlineMysteryRegistry(docs.outline);
  const validIds = new Set(expected.map((mystery) => mystery.id));
  const removed = [];
  const seen = new Set();
  for (const doc of [docs.setup, docs.outline]) {
    for (const mystery of doc.mystery_registry || []) {
      if (mystery?.id && !validIds.has(mystery.id) && !seen.has(mystery.id)) {
        seen.add(mystery.id);
        removed.push(mystery.id);
      }
    }
  }
  const removedLinks = cleanThreadLinks(docs, validIds);
  const before = registryEntryCount(docs.outline) + registryEntryCount(docs.setup);
  const after = expected.length * 2;
  if (options.dryRun) {
    return {
      ok: true,
      action: 'clean-dry-run',
      before,
      after,
      entries: expected.length,
      removed,
      removedLinks,
      dryRun: true,
    };
  }
  const backup = createRegistryBackup(project, 'clean');
  docs.setup.mystery_registry = expected;
  docs.outline.mystery_registry = expected;
  writeJsonAtomic(docs.setupFile, docs.setup);
  writeJsonAtomic(docs.outlineFile, docs.outline);
  const statusRepair = repairRegistry(project);
  const afterBackup = createRegistryBackup(project, 'clean-after');
  appendRegistryOperation(project, {
    action: 'clean',
    before,
    after,
    entries: expected.length,
    removed,
    removedLinks,
    backup,
    after_backup: afterBackup,
  });
  return {
    ok: true,
    action: 'clean',
    before,
    after,
    entries: expected.length,
    removed,
    removedLinks,
    statusRepaired: Boolean(statusRepair),
    dryRun: false,
  };
}

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

function linkAbandonedThreads(docs, mysteryId, threadId, chapterId, question) {
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
  linkAbandonedThreads(docs, mysteryId, threadId, chapterId, question);
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

// Write the canonical registries derived by registry-rules.js to both docs.
export function repairRegistry(project) {
  const docs = loadRegistryDocs(project);
  if (!docs) return null;
  const reasons = registryRepairReasons(docs.setup, docs.outline);
  if (reasons.length === 0) return null;
  const expected = registryExpectations(docs.setup, docs.outline);
  for (const doc of [docs.setup, docs.outline]) {
    if (expected.hasThreads) doc.thread_registry = expected.threads;
    if (expected.hasMysteries) doc.mystery_registry = expected.mysteries;
    addMissingAbandonedThreads(doc, expected.abandonedThreads);
  }
  writeJsonAtomic(docs.setupFile, docs.setup);
  writeJsonAtomic(docs.outlineFile, docs.outline);
  return { actions: [`repaired registry: ${reasons.join(', ')}`], reasons };
}

function addMissingAbandonedThreads(doc, expected) {
  const known = new Set((doc.abandoned_threads || []).map((item) => item.thread_id));
  const missing = expected.filter((item) => !known.has(item.thread_id));
  if (!missing.length) return;
  doc.abandoned_threads = [...(Array.isArray(doc.abandoned_threads) ? doc.abandoned_threads : []), ...missing];
}

function summarizeRegistry(threads, mysteries) {
  const threadStatus = {};
  for (const thread of threads) threadStatus[thread.status || 'unknown'] = (threadStatus[thread.status || 'unknown'] || 0) + 1;
  const mysteryStatus = {};
  for (const mystery of mysteries) mysteryStatus[mystery.status || 'unknown'] = (mysteryStatus[mystery.status || 'unknown'] || 0) + 1;
  return {
    thread_count: threads.length,
    mystery_count: mysteries.length,
    thread_status: threadStatus,
    mystery_status: mysteryStatus,
  };
}

export function projectRegistryStatus(project) {
  const docs = loadRegistryDocs(project);
  if (!docs) return { ok: false, reason: 'setup and outline are missing' };
  const check = checkProject(project, { profile: 'schema', target: 'outline' });
  const drift = (check.findings || []).filter((finding) => (
    String(finding.rule_id || '').startsWith('quality.thread.')
    || String(finding.rule_id || '').startsWith('quality.mystery.')
    || String(finding.rule_id || '').startsWith('quality.setup.')
  ));
  return {
    ok: drift.length === 0,
    setup: summarizeRegistry(docs.setup.thread_registry || [], docs.setup.mystery_registry || []),
    outline: summarizeRegistry(docs.outline.thread_registry || [], docs.outline.mystery_registry || []),
    drift,
    operations: readRegistryOperations(project, 5),
  };
}

export { findMysteryNode };
