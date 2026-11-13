// Small artifact stores: imported idea cards, saved idea draws, research reports.
// File layout comes from paths.js so read/export/check agree on every location.

import fs from 'node:fs';
import path from 'node:path';
import {
  ensureDir, nowIso, safeSegment, stamp, toPosixPath, writeJsonAtomic,
} from './util.js';
import { projectPath, researchFile } from './paths.js';

export function saveImportedIdeas(project, payload, options = {}) {
  const raw = Array.isArray(payload) ? { results: payload } : payload;
  if (!raw || !Array.isArray(raw.results) || raw.results.length === 0) {
    throw new Error('ideas import expects an array or an object with a non-empty results array');
  }
  for (const [index, card] of raw.results.entries()) {
    validateImportedCard(card, index);
  }
  const type = options.type || raw.type || 'reference';
  const results = raw.results.map((item) => ({
    ...item,
    source: item.source || options.source || '',
    imported_at: nowIso(),
  }));
  const draw = {
    ok: true,
    section: 'ideas',
    query: {
      type,
      genre: options.genre || '',
      source: options.source || '',
      imported: true,
      count: results.length,
    },
    count: results.length,
    results,
    meta: {
      deck: 'imported',
      source: options.source || '',
      usage: [
        'Imported cards are references, not canon.',
        'Check source and period before turning them into setup/outline facts.',
      ],
    },
  };
  const id = `import-${stamp()}`;
  const dir = projectPath(project.dir, 'ideas');
  ensureDir(dir);
  const file = path.join(dir, `${id}.json`);
  writeJsonAtomic(file, draw);
  return { ...draw, saved: { id, path: toPosixPath(path.relative(project.dir, file)) } };
}

function validateImportedCard(card, index) {
  if (!card || typeof card !== 'object' || Array.isArray(card)) {
    throw new Error(`ideas import item ${index + 1} must be an object`);
  }
  if (!card.title && !card.name) {
    throw new Error(`ideas import item ${index + 1} needs a title or name`);
  }
  const graph = card.graph;
  if (!graph) return;
  if (!Array.isArray(graph.entities) || !Array.isArray(graph.relations)) {
    throw new Error(`ideas import item ${index + 1} graph needs entities and relations arrays`);
  }
  const ids = new Set();
  for (const entity of graph.entities) {
    if (!entity?.id || !entity?.type || !entity?.label) {
      throw new Error(`ideas import item ${index + 1} graph entity needs id, type and label`);
    }
    ids.add(entity.id);
  }
  for (const relation of graph.relations) {
    if (!relation?.from || !relation?.to || !ids.has(relation.from) || !ids.has(relation.to)) {
      throw new Error(`ideas import item ${index + 1} graph relation references a missing entity`);
    }
  }
}

export function saveIdeaDraw(project, draw) {
  const type = safeSegment(String(draw?.query?.type || 'ideas'), 'idea type');
  const seed = draw?.query?.seed || 0;
  const id = `${type}-${seed}-${stamp()}`;
  const dir = projectPath(project.dir, 'ideas');
  ensureDir(dir);
  const file = path.join(dir, `${id}.json`);
  writeJsonAtomic(file, draw);
  const bytes = fs.statSync(file).size;
  return {
    ok: true,
    action: 'save',
    query: draw?.query || {},
    count: Array.isArray(draw?.results) ? draw.results.length : 0,
    result_ids: (draw?.results || []).map((item) => item.id).filter(Boolean),
    saved: {
      id,
      path: toPosixPath(path.relative(project.dir, file)),
      bytes,
    },
    hint: `Read it with "book read idea --id ${id}" (summary) or write it with "book write setup|outline --from-idea ${id}".`,
  };
}

export function saveResearchReport(project, id, report) {
  if (!id) throw new Error('research report requires an id');
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('research report must be a JSON object');
  }
  const dir = projectPath(project.dir, 'research');
  ensureDir(dir);
  const file = researchFile(project.dir, id);
  writeJsonAtomic(file, report);
  return {
    ok: true,
    action: 'research',
    id: safeSegment(id, 'research id'),
    path: toPosixPath(path.relative(project.dir, file)),
  };
}
