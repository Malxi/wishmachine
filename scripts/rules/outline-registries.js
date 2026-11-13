// Outline registry shape rules: mystery/thread registry entries, abandoned
// threads and the required main/sub-then-id registry ordering.
import {
  ABANDONED_THREADS_FIELD,
  MYSTERY_REGISTRY_FIELD,
  THREAD_REGISTRY_FIELD,
  THREAD_REGISTRY_OBJECT_ARRAY_FIELDS,
} from '../contracts.js';
import { sortMysteryArray, sortThreadArray } from '../registry.js';
import { finding } from './finding.js';

function validateOutlineRegistries(ctx) {
  const { outline, findings } = ctx;
  if (outline[MYSTERY_REGISTRY_FIELD] !== undefined) {
    if (!Array.isArray(outline[MYSTERY_REGISTRY_FIELD])) {
      findings.push(finding('schema.outline.mystery_registry', 'high', 'mystery_registry must be an array'));
    } else {
      for (const mystery of outline[MYSTERY_REGISTRY_FIELD]) {
        if (!mystery?.id) {
          findings.push(finding('schema.outline.mystery_registry.id', 'high', 'mystery registry entry needs an id'));
          continue;
        }
        if (ctx.mysteryRegistryIds.has(mystery.id)) {
          findings.push(finding('quality.outline.mystery_registry.duplicate', 'high', `duplicate mystery id ${mystery.id}`, mystery.id));
        }
        ctx.mysteryRegistryIds.add(mystery.id);
      }
    }
  }
  if (outline[THREAD_REGISTRY_FIELD] === undefined) return;
  if (!Array.isArray(outline[THREAD_REGISTRY_FIELD])) {
    findings.push(finding('schema.outline.thread_registry', 'high', 'thread_registry must be an array'));
    return;
  }
  for (const thread of outline[THREAD_REGISTRY_FIELD]) {
    if (!thread?.id) {
      findings.push(finding('schema.outline.thread_registry.id', 'high', 'thread registry entry needs an id'));
      continue;
    }
    if (ctx.threadIds.has(thread.id)) {
      findings.push(finding('quality.outline.thread_registry.duplicate', 'high', `duplicate thread id ${thread.id}`, thread.id));
    }
    ctx.threadIds.add(thread.id);
    ctx.threadMap.set(thread.id, thread);
    validateOutlineThreadShape(thread, findings);
  }
  validateOutlineAbandonedThreads(ctx);
}

function validateOutlineThreadShape(thread, findings) {
  if (thread.resolved_chapters !== undefined && (!Array.isArray(thread.resolved_chapters) || thread.resolved_chapters.some((id) => typeof id !== 'string'))) {
    findings.push(finding('schema.outline.thread_registry.resolved_chapters', 'medium', `${thread.id}.resolved_chapters must be an array of chapter ids`, thread.id));
  }
  if (thread.resolved_in && Array.isArray(thread.resolved_chapters) && !thread.resolved_chapters.includes(thread.resolved_in)) {
    findings.push(finding('quality.outline.thread.resolved_chapters_mismatch', 'medium', `${thread.id}.resolved_in is not listed in resolved_chapters`, thread.id));
  }
  if (thread.abandoned_history !== undefined && typeof thread.abandoned_history !== 'boolean') {
    findings.push(finding('schema.outline.thread_registry.abandoned_history', 'medium', `${thread.id}.abandoned_history must be boolean`, thread.id));
  }
  for (const key of THREAD_REGISTRY_OBJECT_ARRAY_FIELDS) {
    if (thread[key] !== undefined && (!Array.isArray(thread[key]) || thread[key].some((item) => typeof item !== 'object' || Array.isArray(item)))) {
      findings.push(finding(`schema.outline.thread_registry.${key}`, 'medium', `${thread.id}.${key} must be an array of objects`, thread.id));
    }
  }
}

function validateOutlineAbandonedThreads(ctx) {
  const { outline, findings } = ctx;
  if (outline[ABANDONED_THREADS_FIELD] === undefined) return;
  if (!Array.isArray(outline[ABANDONED_THREADS_FIELD])) {
    findings.push(finding('schema.outline.abandoned_threads', 'high', 'abandoned_threads must be an array'));
    return;
  }
  for (const thread of outline[ABANDONED_THREADS_FIELD]) {
    if (!thread?.thread_id || !ctx.threadIds.has(thread.thread_id)) {
      findings.push(finding('quality.outline.abandoned_threads.unknown', 'high', `abandoned thread ${thread?.thread_id || '(missing)'} is not in thread_registry`, thread?.thread_id || ''));
    }
  }
}

function validateRegistryOrder(ctx) {
  const { outline, findings } = ctx;
  if (Array.isArray(outline[THREAD_REGISTRY_FIELD])) {
    const sortedThreads = sortThreadArray(outline[THREAD_REGISTRY_FIELD]);
    if (sortedThreads.some((thread, index) => thread.id !== outline[THREAD_REGISTRY_FIELD][index]?.id)) {
      findings.push(finding('quality.outline.thread.registry_order', 'low', 'thread_registry is not sorted by main/sub then id'));
    }
  }
  if (Array.isArray(outline[MYSTERY_REGISTRY_FIELD])) {
    const sorted = sortMysteryArray(outline[MYSTERY_REGISTRY_FIELD]);
    if (sorted.some((mystery, index) => mystery.id !== outline[MYSTERY_REGISTRY_FIELD][index]?.id)) {
      findings.push(finding('quality.outline.mystery.registry_order', 'low', 'mystery_registry is not sorted by chapter_id/id', 'Sort the registry or run doctor --fix.'));
    }
  }
}

export { validateOutlineRegistries, validateRegistryOrder };
