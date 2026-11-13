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
          add('low', 'idea.cast.duplicate_archetype', character.archetype, `duplicate cast archetype ${character.archetype}`, 'Pick a different archetype or reduce cast count.');
        }
        castArchetypes.add(character.archetype);
      }
    }
    if (!castRoles.has('protagonist')) {
      add('high', 'idea.cast.missing_protagonist', result.id || 'worldpack', 'cast has no protagonist', 'Add a protagonist or let cast-roles auto-fix it.');
    }
  }
  if (Array.isArray(result.cast) && Array.isArray(result.cast_relations)) {
    // Plotpacks and outlinepacks carry the same graph as the worldpack they
    // were built from; validate cast relations against that graph.
    const entityIds = new Set((result.graph?.entities || result.entities || []).map((entity) => entity.id));
    const relationKeys = new Set();
    for (const relation of result.cast_relations) {
      if (entityIds.size > 0 && (!relation?.from || !relation?.to || !entityIds.has(relation.from) || !entityIds.has(relation.to))) {
        add('high', 'idea.cast_relation.unknown_entity', result.id || 'worldpack', `cast relation references an unknown entity: ${relation?.from} -> ${relation?.to}`, 'Point cast relations at ids from the graph entities.');
      }
      if (relation?.type && !KNOWN_RELATION_TYPES.has(relation.type)) {
        add('low', 'idea.cast_relation.unknown_type', result.id || 'worldpack', `unknown cast relation type: ${relation.type}`, 'Use a relation type from the genre vocabulary.');
      }
      const key = `${relation?.from}|${relation?.to}|${relation?.type}`;
      if (relationKeys.has(key)) {
        add('low', 'idea.cast_relation.duplicate', result.id || 'worldpack', `duplicate cast relation ${key}`, 'Remove the duplicate relation.');
      }
      relationKeys.add(key);
    }
  }
}

function validateIdeaThreadFindings(result, add) {
  const registry = result.thread_registry;
  if (!Array.isArray(registry)) return;
  const ids = new Set();
  const chaptersById = new Map((result.chapters || []).map((chapter) => [chapter.id, chapter]));
  for (const thread of registry) {
    if (!thread?.id) {
      add('high', 'idea.thread.missing_id', result.id || 'outlinepack', 'thread registry entry has no id', 'Add a stable thread id.');
      continue;
    }
    if (ids.has(thread.id)) {
      add('high', 'idea.thread.duplicate_id', thread.id, 'duplicate thread id', 'Give each thread a unique id.');
    }
    ids.add(thread.id);
    if (!['active', 'resolved', 'abandoned'].includes(thread.status)) {
      add('high', 'idea.thread.invalid_status', thread.id, `unknown thread status ${thread.status}`, 'Use active, resolved or abandoned.');
    }
    if (thread.status === 'active' && thread.resolved_in) {
      add('high', 'idea.thread.active_with_resolution', thread.id, 'active thread has resolved_in', 'Clear resolved_in or mark the thread resolved.');
    }
    if (thread.status === 'resolved') {
      if (!thread.resolved_in) {
        add('high', 'idea.thread.resolved_without_chapter', thread.id, 'resolved thread has no resolved_in', 'Set resolved_in to the resolving chapter.');
      } else {
        const chapter = chaptersById.get(thread.resolved_in);
        if (!chapter) {
          add('high', 'idea.thread.unknown_resolved_chapter', thread.id, `resolved_in ${thread.resolved_in} is not a chapter`, 'Use an existing chapter id.');
        } else {
          if (chapter.thread_id !== thread.id) {
            const resolvedHere = (chapter.mysteries?.resolved || []).some((mystery) => mystery.thread_id === thread.id);
            if (!resolvedHere) {
              add('high', 'idea.thread.resolved_chapter_mismatch', thread.id, `resolved_in ${thread.resolved_in} belongs to ${chapter.thread_id}`, 'Resolve the thread in one of its own chapters.');
            }
          }
          if (!['climax', 'resolution'].includes(chapter.beat_function)) {
            add('high', 'idea.thread.resolved_outside_climax', thread.id, `resolved_in ${thread.resolved_in} is ${chapter.beat_function}`, 'Resolve on a climax or resolution chapter.');
          }
        }
      }
    }
  }
  for (const storyline of result.setup_draft?.storylines || []) {
    if (!storyline.thread_id || !ids.has(storyline.thread_id)) {
      add('high', 'idea.thread.unknown_setup_thread', storyline.name || 'storyline', 'setup storyline references an unknown thread id', 'Use an id from thread_registry.');
    }
  }
  const checkMystery = (mystery, target) => {
    if (mystery?.thread_id && !ids.has(mystery.thread_id)) {
      add('high', 'idea.thread.unknown_mystery_thread', target, `mystery references unknown thread ${mystery.thread_id}`, 'Use an id from thread_registry or add the thread.');
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
  for (const thread of result.abandoned_threads || []) {
    if (thread?.thread_id && !ids.has(thread.thread_id)) {
      add('high', 'idea.thread.unknown_abandoned_thread', thread.thread_id, 'abandoned thread is not in thread_registry', 'Keep abandoned threads in the registry with status abandoned.');
    }
  }
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
  const add = (severity, rule, target, issue, suggestion) => {
    findings.push({ rule_id: rule, severity, target_id: target, issue, suggestion });
  };
  for (const result of results) {
    validateIdeaCastFindings(result, add);
    validateIdeaThreadFindings(result, add);
  }
  return finalizeIdeaFindings(findings, options);
}
