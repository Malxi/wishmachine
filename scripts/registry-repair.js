// Registry repair: rewrite the canonical thread/mystery registries derived by
// registry-rules.js back into the setup and outline documents. This is the single
// repair path shared by `doctor --fix`, `book registry clean` and abandon.

import { writeJsonAtomic } from './util.js';
import { loadRegistryDocs } from './registry-docs.js';
import { registryExpectations, registryRepairReasons } from './registry-rules.js';

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
