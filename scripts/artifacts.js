// Artifact paths and small artifact stores.
// Everything that turns an artifact id into a filesystem path lives here so the
// same safeSegment/containment rules are applied by read, write, export and
// check paths.

import fs from 'node:fs';
import path from 'node:path';
import {
  ensureDir, nowIso, readJson, safeSegment, stamp, toPosixPath, writeJsonAtomic,
} from './util.js';
import { outlineIndex } from './schema.js';
import { buildProjectGraph } from './graph.js';

const PATHS = {
  config: ['novel.json'],
  setup: ['story', 'setup', 'story_setup.json'],
  setupMarkdown: ['story', 'setup', 'story_setup.md'],
  outline: ['story', 'compose', 'outline.json'],
  outlineMarkdown: ['story', 'compose', 'outline.md'],
  chapters: ['chapters'],
  drafts: ['drafts'],
  logs: ['logs'],
  craft: ['story', 'craft'],
  recaps: ['story', 'recaps'],
  ideas: ['story', 'ideas'],
  research: ['story', 'research'],
  registryBackups: ['logs', 'registry-backups'],
  registryOperations: ['logs', 'registry-operations.jsonl'],
};

export function projectPath(dir, key) {
  return path.join(dir, ...PATHS[key]);
}

export function setupFile(dir) {
  return projectPath(dir, 'setup');
}

export function setupMarkdownFile(dir) {
  return projectPath(dir, 'setupMarkdown');
}

export function outlineFile(dir) {
  return projectPath(dir, 'outline');
}

export function outlineMarkdownFile(dir) {
  return projectPath(dir, 'outlineMarkdown');
}

export function configFile(dir) {
  return projectPath(dir, 'config');
}

export function chapterFile(dir, id) {
  return path.join(projectPath(dir, 'chapters'), `${safeSegment(id, 'chapter id')}.md`);
}

export function recapFile(dir, id) {
  return path.join(projectPath(dir, 'recaps'), `${safeSegment(id, 'recap id')}.json`);
}

export function craftFile(dir, kind) {
  return path.join(projectPath(dir, 'craft'), `${safeSegment(kind, 'craft kind')}.json`);
}

export function ideaFile(dir, id) {
  return path.join(projectPath(dir, 'ideas'), `${safeSegment(id, 'idea id')}.json`);
}

export function researchFile(dir, id) {
  return path.join(projectPath(dir, 'research'), `${safeSegment(id, 'research id')}.json`);
}

export function registryBackupsDir(dir) {
  return projectPath(dir, 'registryBackups');
}

export function registryOperationsFile(dir) {
  return projectPath(dir, 'registryOperations');
}

export function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort();
}

export function listFilesWithSizes(dir, extension = '.json') {
  return listJsonFiles(dir)
    .filter((name) => name.endsWith(extension))
    .map((name) => ({
      name: name.slice(0, -extension.length),
      size: fs.statSync(path.join(dir, name)).size,
    }));
}

export function readOptionalJson(file) {
  return fs.existsSync(file) ? readJson(file) : null;
}

export function projectStatus(project) {
  const config = project.config;
  const setup = fs.existsSync(setupFile(project.dir));
  const outline = readOptionalJson(outlineFile(project.dir));
  const chapters = [];
  for (const part of outline?.parts || []) {
    for (const volume of part.volumes || []) {
      for (const chapter of volume.chapters || []) {
        chapters.push({
          id: chapter.id,
          title: chapter.title,
          volume_id: volume.id,
          written: isChapterWritten(project.dir, chapter.id),
        });
      }
    }
  }
  const chapterDir = projectPath(project.dir, 'chapters');
  const chapterFiles = fs.existsSync(chapterDir)
    ? fs.readdirSync(chapterDir).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3)).sort()
    : [];
  const knownChapterIds = new Set(chapters.map((chapter) => chapter.id));
  const recapFiles = listJsonFiles(projectPath(project.dir, 'recaps')).map((name) => name.slice(0, -5));
  return {
    name: config.name,
    root: project.dir,
    setup,
    structure: config.structure,
    chapter_config: config.chapter_config,
    outline: outline ? {
      parts: outline.parts?.length || 0,
      volumes: (outline.parts || []).reduce((n, part) => n + (part.volumes?.length || 0), 0),
      chapters: (outline.parts || []).reduce((n, part) => n + (part.volumes || []).reduce((m, volume) => m + (volume.chapters?.length || 0), 0), 0),
    } : { parts: 0, volumes: 0, chapters: 0 },
    chapters,
    orphan_chapters: chapterFiles.filter((id) => !knownChapterIds.has(id)),
    orphan_recaps: recapFiles.filter((id) => !knownChapterIds.has(id)),
    next: nextStep(chapters, setup, outline),
  };
}

function isChapterWritten(dir, id) {
  try {
    return fs.existsSync(chapterFile(dir, id));
  } catch {
    // An outline id that cannot be a filename simply has no chapter file.
    return false;
  }
}

function nextStep(chapters, setup, outline) {
  const cli = 'node scripts/wishmachine.js';
  if (!setup) {
    return {
      stage: 'setup',
      targetId: 'setup',
      reason: '故事设定尚未生成。',
      command: `${cli} book write setup --dir <project> --mode replace`,
      fast_path: `${cli} ideas draw --type outlinepack --save --dir <project>`,
    };
  }
  if (!outline) {
    return {
      stage: 'outline',
      targetId: 'outline',
      reason: '大纲尚未生成。',
      command: `${cli} book write outline --dir <project> --mode replace`,
      fast_path: `${cli} ideas draw --type outlinepack --save --dir <project>`,
    };
  }
  const unwritten = chapters.find((chapter) => !chapter.written);
  if (unwritten) {
    return {
      stage: 'write',
      targetId: `chapter:${unwritten.id}`,
      reason: '仍有章节未写正文。',
      command: `${cli} book write chapter --dir <project> --id ${unwritten.id} --mode replace`,
    };
  }
  return {
    stage: 'complete',
    targetId: '',
    reason: '全部章节已写正文。',
    command: `${cli} export --dir <project> --format book`,
  };
}

export function projectState(project, options = {}) {
  const status = projectStatus(project);
  const setup = readOptionalJson(setupFile(project.dir));
  const outline = readOptionalJson(outlineFile(project.dir));
  const view = options.view === 'full' ? 'full' : 'brief';
  const state = {
    project: {
      name: status.name,
      root: status.root,
      language: project.config.language || '',
      structure: status.structure,
      chapter_config: status.chapter_config,
    },
    setup: setup ? {
      present: true,
      project_name: setup.project_name || status.name,
      genres: setup.genres || [],
      premise: clip(setup.premise, 300),
      theme: clip(setup.theme, 180),
      cast: (setup.core_cast || []).map((item) => ({ name: item.name, role: item.role, importance: item.importance })),
      storyline_count: (setup.storylines || []).length,
      premise_count: (setup.premises || []).length,
      resource_count: (setup.world_resources || []).length,
    } : { present: false },
    outline: outline ? outlineIndex(outline) : null,
    chapters: status.chapters,
    chapter_count: status.chapters.length,
    written_count: status.chapters.filter((chapter) => chapter.written).length,
    orphan_chapters: status.orphan_chapters || [],
    orphan_recaps: status.orphan_recaps || [],
    ideas: listFilesWithSizes(projectPath(project.dir, 'ideas')),
    research: listFilesWithSizes(projectPath(project.dir, 'research')),
    graph: (() => {
      const graph = buildProjectGraph(project);
      return { draws: graph.draws, cards: graph.cards, counts: graph.counts, blocking: graph.blocking };
    })(),
    craft: listFilesWithSizes(projectPath(project.dir, 'craft')),
    recaps: listFilesWithSizes(projectPath(project.dir, 'recaps')),
    next: status.next,
  };
  if (view === 'full') {
    state.setup_full = setup;
    state.outline_full = outline;
  }
  return { ok: true, view, state };
}

function clip(text, max) {
  const value = String(text || '');
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

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

export function renderSetupMarkdown(setup) {
  const lines = [`# ${setup.project_name || 'Story Setup'}`, ''];
  for (const [key, label] of [['premise', 'Premise'], ['theme', 'Theme'], ['tone', 'Tone'], ['target_audience', 'Audience']]) {
    if (setup[key]) lines.push(`## ${label}`, '', String(setup[key]), '');
  }
  if (setup.rules?.length) lines.push('## Rules', '', ...setup.rules.map((rule) => `- ${rule}`), '');
  return lines.join('\n');
}

export function renderOutlineMarkdown(outline) {
  const lines = [];
  for (const part of outline.parts || []) {
    lines.push(`# ${part.title || part.id}`, '', part.summary || '', '');
    for (const volume of part.volumes || []) {
      lines.push(`## ${volume.title || volume.id}`, '', volume.summary || '', '');
      for (const chapter of volume.chapters || []) {
        lines.push(`### ${chapter.id} ${chapter.title || ''}`, '', chapter.summary || '', '');
      }
    }
  }
  return lines.join('\n');
}
