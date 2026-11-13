// Registry clean: drop stale mystery registry entries and thread links that no
// longer appear in the outline, then rewrite the canonical registries.

import { writeJsonAtomic } from './util.js';
import { collectOutlineMysteryRegistry } from './registry.js';
import { loadRegistryDocs } from './registry-docs.js';
import { repairRegistry } from './registry-repair.js';
import { appendRegistryOperation, createRegistryBackup } from './registry-store.js';

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
