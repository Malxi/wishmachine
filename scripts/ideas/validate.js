// Validator for generated idea draws (worldpack / plotpack / outlinepack).
import { createHash } from 'node:crypto';
import { KNOWN_RELATION_TYPES } from '../decks/index.js';

function validateIdeaCastFindings(result, add) {
  if (Array.isArray(result.cast)) {
    const castRoles = new Set();
    const castArchetypes = new Set();
    for (const character of result.cast) {
      const role = character?.role_tags?.[0];
      if (role) castRoles.add(role);
      if (character?.archetype) {
        if (castArchetypes.has(character.archetype)) {
          add({
            severity: 'low',
            rule: 'idea.cast.duplicate_archetype',
            target: character.archetype,
            issue: `duplicate cast archetype ${character.archetype}`,
            suggestion: 'Pick a different archetype or reduce cast count.',
          });
        }
        castArchetypes.add(character.archetype);
      }
    }
    if (!castRoles.has('protagonist')) {
      add({
        severity: 'high',
        rule: 'idea.cast.missing_protagonist',
        target: result.id || 'worldpack',
        issue: 'cast has no protagonist',
        suggestion: 'Add a protagonist or let cast-roles auto-fix it.',
      });
    }
  }
  if (Array.isArray(result.cast) && Array.isArray(result.cast_relations)) {
    // Plotpacks and outlinepacks carry the same graph as the worldpack they
    // were built from; validate cast relations against that graph.
    const entityIds = new Set((result.graph?.entities || result.entities || []).map((entity) => entity.id));
    const relationKeys = new Set();
    for (const relation of result.cast_relations) {
      if (entityIds.size > 0 && (!relation?.from || !relation?.to || !entityIds.has(relation.from) || !entityIds.has(relation.to))) {
        add({
          severity: 'high',
          rule: 'idea.cast_relation.unknown_entity',
          target: result.id || 'worldpack',
          issue: `cast relation references an unknown entity: ${relation?.from} -> ${relation?.to}`,
          suggestion: 'Point cast relations at ids from the graph entities.',
        });
      }
      if (relation?.type && !KNOWN_RELATION_TYPES.has(relation.type)) {
        add({
          severity: 'low',
          rule: 'idea.cast_relation.unknown_type',
          target: result.id || 'worldpack',
          issue: `unknown cast relation type: ${relation.type}`,
          suggestion: 'Use a relation type from the genre vocabulary.',
        });
      }
      const key = `${relation?.from}|${relation?.to}|${relation?.type}`;
      if (relationKeys.has(key)) {
        add({
          severity: 'low',
          rule: 'idea.cast_relation.duplicate',
          target: result.id || 'worldpack',
          issue: `duplicate cast relation ${key}`,
          suggestion: 'Remove the duplicate relation.',
        });
      }
      relationKeys.add(key);
    }
  }
}

function validateThreadDuplicatesAndStatus(thread, ids, add) {
  if (ids.has(thread.id)) {
    add({
      severity: 'high', rule: 'idea.thread.duplicate_id', target: thread.id,
      issue: 'duplicate thread id', suggestion: 'Give each thread a unique id.',
    });
  }
  ids.add(thread.id);
  if (!['active', 'resolved', 'abandoned'].includes(thread.status)) {
    add({
      severity: 'high', rule: 'idea.thread.invalid_status', target: thread.id,
      issue: `unknown thread status ${thread.status}`, suggestion: 'Use active, resolved or abandoned.',
    });
  }
  if (thread.status === 'active' && thread.resolved_in) {
    add({
      severity: 'high', rule: 'idea.thread.active_with_resolution', target: thread.id,
      issue: 'active thread has resolved_in', suggestion: 'Clear resolved_in or mark the thread resolved.',
    });
  }
}

function validateThreadResolution(thread, chaptersById, add) {
  if (!thread.resolved_in) {
    add({
      severity: 'high', rule: 'idea.thread.resolved_without_chapter', target: thread.id,
      issue: 'resolved thread has no resolved_in', suggestion: 'Set resolved_in to the resolving chapter.',
    });
    return;
  }
  const chapter = chaptersById.get(thread.resolved_in);
  if (!chapter) {
    add({
      severity: 'high', rule: 'idea.thread.unknown_resolved_chapter', target: thread.id,
      issue: `resolved_in ${thread.resolved_in} is not a chapter`, suggestion: 'Use an existing chapter id.',
    });
    return;
  }
  if (chapter.thread_id !== thread.id) {
    const resolvedHere = (chapter.mysteries?.resolved || []).some((mystery) => mystery.thread_id === thread.id);
    if (!resolvedHere) {
      add({
        severity: 'high', rule: 'idea.thread.resolved_chapter_mismatch', target: thread.id,
        issue: `resolved_in ${thread.resolved_in} belongs to ${chapter.thread_id}`,
        suggestion: 'Resolve the thread in one of its own chapters.',
      });
    }
  }
  if (!['climax', 'resolution'].includes(chapter.beat_function)) {
    add({
      severity: 'high', rule: 'idea.thread.resolved_outside_climax', target: thread.id,
      issue: `resolved_in ${thread.resolved_in} is ${chapter.beat_function}`,
      suggestion: 'Resolve on a climax or resolution chapter.',
    });
  }
}

function validateThreadRegistry(registry, result, add) {
  const ids = new Set();
  const chaptersById = new Map((result.chapters || []).map((chapter) => [chapter.id, chapter]));
  for (const thread of registry) {
    if (!thread?.id) {
      add({
        severity: 'high', rule: 'idea.thread.missing_id', target: result.id || 'outlinepack',
        issue: 'thread registry entry has no id', suggestion: 'Add a stable thread id.',
      });
      continue;
    }
    validateThreadDuplicatesAndStatus(thread, ids, add);
    if (thread.status === 'resolved') validateThreadResolution(thread, chaptersById, add);
  }
  return ids;
}

function validateSetupThreads(result, ids, add) {
  for (const storyline of result.setup_draft?.storylines || []) {
    if (!storyline.thread_id || !ids.has(storyline.thread_id)) {
      add({
        severity: 'high', rule: 'idea.thread.unknown_setup_thread', target: storyline.name || 'storyline',
        issue: 'setup storyline references an unknown thread id', suggestion: 'Use an id from thread_registry.',
      });
    }
  }
}

function validateMysteryThreads(result, ids, add) {
  const checkMystery = (mystery, target) => {
    if (mystery?.thread_id && !ids.has(mystery.thread_id)) {
      add({
        severity: 'high', rule: 'idea.thread.unknown_mystery_thread', target,
        issue: `mystery references unknown thread ${mystery.thread_id}`,
        suggestion: 'Use an id from thread_registry or add the thread.',
      });
    }
  };
  for (const chapter of result.chapters || []) {
    for (const key of ['carried', 'planted', 'resolved', 'dropped']) {
      for (const mystery of chapter.mysteries?.[key] || []) {
        checkMystery(mystery, chapter.id);
      }
    }
    for (const scene of chapter.scenes || []) {
      for (const key of ['planted', 'resolved']) {
        for (const mystery of scene.mysteries?.[key] || []) {
          checkMystery(mystery, `${chapter.id}-S${scene.order}`);
        }
      }
    }
  }
}

function validateAbandonedThreads(result, ids, add) {
  for (const thread of result.abandoned_threads || []) {
    if (thread?.thread_id && !ids.has(thread.thread_id)) {
      add({
        severity: 'high', rule: 'idea.thread.unknown_abandoned_thread', target: thread.thread_id,
        issue: 'abandoned thread is not in thread_registry',
        suggestion: 'Keep abandoned threads in the registry with status abandoned.',
      });
    }
  }
}

function validateIdeaThreadFindings(result, add) {
  const registry = result.thread_registry;
  if (!Array.isArray(registry)) return;
  const ids = validateThreadRegistry(registry, result, add);
  validateSetupThreads(result, ids, add);
  validateMysteryThreads(result, ids, add);
  validateAbandonedThreads(result, ids, add);
}

function finalizeIdeaFindings(findings, options) {
  const severityRank = { low: 1, medium: 2, high: 3, critical: 4 };
  const minSeverity = options.minSeverity || 'low';
  const ignoredRules = new Set(options.ignoreRules || []);
  const ignoredByRule = {};
  for (const finding of findings) {
    if (!ignoredRules.has(finding.rule_id)) continue;
    ignoredByRule[finding.rule_id] = (ignoredByRule[finding.rule_id] || 0) + 1;
  }
  const ignoredFindings = findings.filter((finding) => ignoredRules.has(finding.rule_id)).length;
  const filtered = findings
    .filter((finding) => !ignoredRules.has(finding.rule_id))
    .filter((finding) => (severityRank[finding.severity] || 0) >= (severityRank[minSeverity] || 1))
    .sort((left, right) => (
      (severityRank[right.severity] || 0) - (severityRank[left.severity] || 0)
      || String(left.rule_id || '').localeCompare(String(right.rule_id || ''))
      || String(left.target_id || '').localeCompare(String(right.target_id || ''))
    ))
    .map((finding) => {
      const key = `${finding.rule_id || ''}|${finding.target_id || ''}|${finding.issue || ''}`;
      const hash = createHash('sha1').update(key).digest('hex').slice(0, 8);
      return { id: `finding-${hash}`, ...finding };
    });
  const deduped = [];
  const seenFindingIds = new Set();
  for (const finding of filtered) {
    if (seenFindingIds.has(finding.id)) continue;
    seenFindingIds.add(finding.id);
    deduped.push(finding);
  }
  return {
    schema_version: 1,
    ok: deduped.length === 0,
    ignored_findings: ignoredFindings,
    ignored_rules: ignoredByRule,
    findings: deduped,
  };
}

export function validateIdeaDraw(draw, options = {}) {
  const results = Array.isArray(draw) ? draw : (draw?.results || []);
  const findings = [];
  const add = ({ severity, rule, target, issue, suggestion }) => {
    findings.push({ rule_id: rule, severity, target_id: target, issue, suggestion });
  };
  for (const result of results) {
    validateIdeaCastFindings(result, add);
    validateIdeaThreadFindings(result, add);
  }
  return finalizeIdeaFindings(findings, options);
}
