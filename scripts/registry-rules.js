// Single source of truth for mystery/thread registry rules.
//
// schema.checkProject turns `registryConsistencyFindings()` into findings;
// doctorProject uses `registryRepairReasons()`/`registryExpectations()` to decide
// whether the registries need repair and what the canonical registries are.
// Both sides therefore read the same derivation: whatever check flags, repair
// rewrites; whatever repair rewrites, check accepts.

import {
  outlineChapters, chapterResolvedMysteries, collectMysteryRegistry,
  sortMysteryLinks, sortThreadArray,
} from './registry.js';

export function outlineEvidence(outline) {
  const chapters = outlineChapters(outline);
  const resolvedChaptersByThread = new Map();
  const resolvedMysteriesByThread = new Map();
  const abandonedThreadIds = new Set();
  for (const item of outline?.abandoned_threads || []) {
    if (item?.thread_id) abandonedThreadIds.add(item.thread_id);
  }
  for (const chapter of chapters) {
    for (const mystery of chapterResolvedMysteries(chapter)) {
      if (!mystery?.thread_id) continue;
      if (!resolvedChaptersByThread.has(mystery.thread_id)) resolvedChaptersByThread.set(mystery.thread_id, []);
      const resolvedChapters = resolvedChaptersByThread.get(mystery.thread_id);
      if (!resolvedChapters.includes(chapter.id)) resolvedChapters.push(chapter.id);
      if (!resolvedMysteriesByThread.has(mystery.thread_id)) resolvedMysteriesByThread.set(mystery.thread_id, []);
      resolvedMysteriesByThread.get(mystery.thread_id).push({ id: mystery.id, chapter_id: chapter.id });
    }
  }
  return {
    chapters,
    resolvedChaptersByThread,
    resolvedMysteriesByThread,
    abandonedThreadIds,
    droppedMysteries: Array.isArray(outline?.dropped_mysteries) ? outline.dropped_mysteries : [],
  };
}

// Derive the self-consistent status fields of one thread from chapter evidence.
// Non-derived fields (id/name/type/importance/...) are preserved as-is.
export function deriveThreadEntry(thread, evidence) {
  const resolvedChapters = evidence.resolvedChaptersByThread.get(thread.id) || [];
  const hasResolution = resolvedChapters.length > 0;
  const listed = evidence.abandonedThreadIds.has(thread.id);
  const wasAbandoned = thread.status === 'abandoned' || thread.abandoned_history === true;
  return {
    ...thread,
    status: hasResolution ? 'resolved' : (wasAbandoned ? 'abandoned' : 'active'),
    resolved_in: hasResolution ? resolvedChapters[resolvedChapters.length - 1] : null,
    resolved_chapters: resolvedChapters,
    resolved_mysteries: sortMysteryLinks(evidence.resolvedMysteriesByThread.get(thread.id) || []),
    abandoned_history: Boolean(wasAbandoned || listed),
    abandoned_mysteries: sortMysteryLinks(evidence.droppedMysteries
      .filter((mystery) => mystery.thread_id === thread.id)
      .map((mystery) => ({ id: mystery.id, chapter_id: mystery.dropped_in, question: mystery.question }))),
  };
}

export function deriveThreadRegistry(setup, outline, evidence = outlineEvidence(outline)) {
  const byId = new Map();
  for (const thread of setup?.thread_registry || []) {
    if (thread?.id && !byId.has(thread.id)) byId.set(thread.id, thread);
  }
  for (const thread of outline?.thread_registry || []) {
    if (thread?.id && !byId.has(thread.id)) byId.set(thread.id, thread);
  }
  return sortThreadArray([...byId.values()].map((thread) => deriveThreadEntry(thread, evidence)));
}

function deriveAbandonedThreads(setup, outline, threads) {
  const byThread = new Map();
  for (const doc of [setup, outline]) {
    for (const item of doc?.abandoned_threads || []) {
      if (item?.thread_id && !byThread.has(item.thread_id)) byThread.set(item.thread_id, item);
    }
  }
  for (const thread of threads) {
    if (thread.status !== 'abandoned' || byThread.has(thread.id)) continue;
    byThread.set(thread.id, {
      thread_id: thread.id,
      thread: thread.name,
      question: thread.name,
      importance: thread.importance,
    });
  }
  return [...byThread.values()];
}

export function deriveMysteryRegistry(outline) {
  return collectMysteryRegistry(outlineChapters(outline));
}

// Entries every document should carry in abandoned_threads. Existing entries are
// preserved as-is: generators may legitimately list one entry per dropped mystery.
function missingAbandonedThreads(doc, expected) {
  const known = new Set((doc?.abandoned_threads || []).map((item) => item.thread_id));
  return expected.filter((item) => !known.has(item.thread_id));
}

// The canonical registries every artifact should contain.
export function registryExpectations(setup, outline) {
  const evidence = outlineEvidence(outline);
  const threads = deriveThreadRegistry(setup, outline, evidence);
  const mysteries = deriveMysteryRegistry(outline);
  return {
    threads,
    mysteries,
    abandonedThreads: deriveAbandonedThreads(setup, outline, threads),
    hasThreads: threads.length > 0
      || Array.isArray(setup?.thread_registry)
      || Array.isArray(outline?.thread_registry),
    hasMysteries: mysteries.length > 0
      || Array.isArray(setup?.mystery_registry)
      || Array.isArray(outline?.mystery_registry),
  };
}

function sameJson(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

// Human-readable list of registry fields that differ from the canonical form.
// Empty list == registries are already self-consistent.
export function registryRepairReasons(setup, outline) {
  const expected = registryExpectations(setup, outline);
  const reasons = [];
  for (const [label, doc] of [['setup', setup], ['outline', outline]]) {
    if (expected.hasThreads && !sameJson(doc?.thread_registry, expected.threads)) {
      reasons.push(`thread_registry (${label})`);
    }
    if (expected.hasMysteries && !sameJson(doc?.mystery_registry, expected.mysteries)) {
      reasons.push(`mystery_registry (${label})`);
    }
    if (missingAbandonedThreads(doc, expected.abandonedThreads).length > 0) {
      reasons.push(`abandoned_threads (${label})`);
    }
  }
  return reasons;
}

function rule(ruleId, severity, issue, targetId = '', suggestion = '') {
  return { rule_id: ruleId, severity, issue, target_id: targetId, suggestion };
}

function threadRegistryFindings(setup, outline) {
  const setupRegistry = setup.thread_registry;
  const outlineRegistry = outline.thread_registry;
  if (!Array.isArray(setupRegistry) && !Array.isArray(outlineRegistry)) return [];
  if (!Array.isArray(setupRegistry)) {
    return [rule('quality.thread.registry_missing_setup', 'high', 'outline has thread_registry but setup does not', 'thread_registry', 'Run doctor --fix to rebuild the setup registry.')];
  }
  if (!Array.isArray(outlineRegistry)) {
    return [rule('quality.thread.registry_missing_outline', 'high', 'setup has thread_registry but outline does not', 'thread_registry', 'Run doctor --fix to rebuild the outline registry.')];
  }
  const findings = [];
  const setupMap = new Map(setupRegistry.map((thread) => [thread.id, thread]));
  const outlineMap = new Map(outlineRegistry.map((thread) => [thread.id, thread]));
  for (const [id, thread] of setupMap) {
    if (!outlineMap.has(id)) {
      findings.push(rule('quality.thread.registry_missing_outline', 'high', `outline is missing setup thread ${id}`, id));
      continue;
    }
    const other = outlineMap.get(id);
    if (thread.status !== other.status) {
      findings.push(rule('quality.thread.status_mismatch', 'medium', `thread ${id} status ${thread.status} in setup but ${other.status} in outline`, id));
    }
    if ((thread.resolved_in || null) !== (other.resolved_in || null)) {
      findings.push(rule('quality.thread.resolved_in_mismatch', 'medium', `thread ${id} resolved_in differs between setup and outline`, id));
    }
  }
  for (const id of outlineMap.keys()) {
    if (!setupMap.has(id)) {
      findings.push(rule('quality.thread.registry_missing_setup', 'high', `setup is missing outline thread ${id}`, id));
    }
  }
  return findings;
}

function mysteryRegistryFindings(setup, outline) {
  const setupMysteries = setup.mystery_registry;
  const outlineMysteries = outline.mystery_registry;
  if (!Array.isArray(setupMysteries) && !Array.isArray(outlineMysteries)) return [];
  if (!Array.isArray(setupMysteries)) {
    return [rule('quality.mystery.registry_missing_setup', 'high', 'outline has mystery_registry but setup does not', 'thread_registry', 'Run doctor --fix to rebuild the setup mystery registry.')];
  }
  if (!Array.isArray(outlineMysteries)) {
    return [rule('quality.mystery.registry_missing_outline', 'high', 'setup has mystery_registry but outline does not', 'thread_registry', 'Run doctor --fix to rebuild the outline mystery registry.')];
  }
  const findings = [];
  const setupMap = new Map(setupMysteries.map((mystery) => [mystery.id, mystery]));
  const outlineMap = new Map(outlineMysteries.map((mystery) => [mystery.id, mystery]));
  for (const [id, mystery] of setupMap) {
    if (!outlineMap.has(id)) {
      findings.push(rule('quality.mystery.registry_missing_outline', 'high', `outline is missing setup mystery ${id}`, id));
      continue;
    }
    if (mystery.status !== outlineMap.get(id).status) {
      findings.push(rule('quality.mystery.status_mismatch', 'medium', `mystery ${id} status differs between setup and outline`, id));
    }
  }
  for (const id of outlineMap.keys()) {
    if (!setupMap.has(id)) {
      findings.push(rule('quality.mystery.registry_missing_setup', 'high', `setup is missing outline mystery ${id}`, id));
    }
  }
  return findings;
}

// Setup/outline registry cross-file consistency rules, shared by schema.checkProject.
export function registryConsistencyFindings(setup, outline) {
  if (!setup || !outline) return [];
  return [...threadRegistryFindings(setup, outline), ...mysteryRegistryFindings(setup, outline)];
}
