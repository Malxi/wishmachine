// Project graph: merge every saved idea draw into one entity/relation view.

import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './util.js';
import { projectPath } from './artifacts.js';

function graphFindingsInvalidDraw(file) {
  return {
    rule_id: 'graph.invalid_draw',
    severity: 'high',
    target_id: file,
    issue: 'saved idea draw is not valid JSON',
    suggestion: 'Re-export or remove the broken draw.',
  };
}

function addEntity(state, entity, file) {
  if (!entity?.id) return;
  const existing = state.entities.get(entity.id);
  if (existing && existing.label !== entity.label) {
    state.findings.push({
      rule_id: 'graph.entity_conflict',
      severity: 'medium',
      target_id: entity.id,
      issue: `entity ${entity.id} has conflicting labels: ${existing.label} / ${entity.label}`,
      suggestion: 'Rename one entity or merge it explicitly.',
    });
    return;
  }
  state.entities.set(entity.id, { ...entity, draw: file });
}

function addRelation(state, relation, file) {
  if (!relation?.from || !relation?.to) return;
  const key = `${relation.from}|${relation.type || 'related_to'}|${relation.to}`;
  if (!state.relations.has(key)) {
    state.relations.set(key, { ...relation, type: relation.type || 'related_to', draw: file });
  }
}

function mergeCard(state, card, file) {
  state.cards += 1;
  for (const keyword of card.keywords || []) {
    state.keywordCounts.set(keyword, (state.keywordCounts.get(keyword) || 0) + 1);
  }
  for (const entity of card.graph?.entities || []) addEntity(state, entity, file);
  for (const relation of card.graph?.relations || []) addRelation(state, relation, file);
}

function danglingRelationFindings(state) {
  const findings = [];
  for (const relation of state.relations.values()) {
    if (state.entities.has(relation.from) && state.entities.has(relation.to)) continue;
    findings.push({
      rule_id: 'graph.dangling_relation',
      severity: 'high',
      target_id: relation.from || relation.to,
      issue: `relation ${relation.from} -> ${relation.to} references a missing entity`,
      suggestion: 'Add the missing entity or remove the relation before using this graph.',
    });
  }
  return findings;
}

function keywordSummary(state) {
  return [...state.keywordCounts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([keyword, count]) => ({ keyword, count }));
}

export function buildProjectGraph(project) {
  const dir = projectPath(project.dir, 'ideas');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort() : [];
  const state = {
    entities: new Map(),
    relations: new Map(),
    keywordCounts: new Map(),
    findings: [],
    cards: 0,
  };
  for (const file of files) {
    let draw;
    try {
      draw = readJson(path.join(dir, file));
    } catch {
      state.findings.push(graphFindingsInvalidDraw(file));
      continue;
    }
    for (const card of draw.results || []) mergeCard(state, card, file);
  }
  state.findings.push(...danglingRelationFindings(state));
  const keywords = keywordSummary(state);
  const labels = [...state.entities.values()].slice(0, 12).map((entity) => entity.label);
  const prompt = [...new Set([...labels, ...keywords.slice(0, 12).map((item) => item.keyword)])].join('；');
  const blocking = state.findings.some((finding) => finding.severity === 'high' || finding.severity === 'critical');
  return {
    ok: !blocking,
    blocking,
    draws: files.length,
    cards: state.cards,
    counts: {
      entities: state.entities.size,
      relations: state.relations.size,
      keywords: keywords.length,
    },
    entities: [...state.entities.values()],
    relations: [...state.relations.values()],
    keywords,
    prompt,
    findings: state.findings,
  };
}
