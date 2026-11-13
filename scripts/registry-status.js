// Registry status: summarize the setup/outline registries and report check drift
// plus the last few operations. Read-only; repairs live in ./registry-repair.js.

import { checkProject } from './schema.js';
import { loadRegistryDocs } from './registry-docs.js';
import { readRegistryOperations } from './registry-store.js';

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
