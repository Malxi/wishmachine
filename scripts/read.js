// book read implementation. One reader per section, dispatched from a table.

import fs from 'node:fs';
import { readJson, readText, safeSegment } from './util.js';
import {
  chapterFile, craftFile, ideaFile, listFilesWithSizes, outlineFile,
  projectPath, readOptionalJson, recapFile, researchFile, setupFile, styleVoiceFile,
} from './paths.js';
import { projectStatus } from './state.js';
import { outlineIndex } from './schema.js';
import { buildProjectGraph } from './graph.js';
import { voiceCardSummary } from './style-card.js';

function readSetup(project) {
  const file = setupFile(project.dir);
  if (!fs.existsSync(file)) throw new Error('story setup has not been written yet');
  return { ok: true, section: 'setup', setup: readJson(file) };
}

function readOutline(project, { id, view }) {
  const file = outlineFile(project.dir);
  if (!fs.existsSync(file)) throw new Error('outline has not been written yet');
  const outline = readJson(file);
  if (id) {
    const match = findOutlineEntry(outline, id);
    if (match) return { ok: true, section: 'outline', ...match };
    throw new Error(`outline id not found: ${id}`);
  }
  return { ok: true, section: 'outline', outline: view === 'index' ? outlineIndex(outline) : outline };
}

function findOutlineEntry(outline, id) {
  for (const part of outline.parts || []) {
    for (const volume of part.volumes || []) {
      if (volume.id === id) return { volume };
      for (const chapter of volume.chapters || []) {
        if (chapter.id === id) return { chapter };
      }
    }
  }
  return null;
}

function readChapter(project, { id }) {
  if (!id) throw new Error('book read chapter requires --id');
  const file = chapterFile(project.dir, id);
  if (!fs.existsSync(file)) throw new Error(`chapter not found: ${id}`);
  return { ok: true, section: 'chapter', id, content: readText(file) };
}

function readRecap(project, { id }) {
  if (!id) throw new Error('book read recap requires --id');
  const file = recapFile(project.dir, id);
  if (!fs.existsSync(file)) throw new Error(`recap not found: ${id}`);
  return { ok: true, section: 'recap', id, recap: readJson(file) };
}

function describeIdeaId(name) {
  // Saved ids are `<type>-<seed>-<YYYYMMDD_HHMMSS>`; imported cards may use other shapes.
  const match = /^(.*)-(\d+)-(\d{8}_\d{6})$/.exec(name);
  if (!match) return { type: '', seed: null, saved_at: '' };
  return { type: match[1], seed: Number(match[2]), saved_at: match[3] };
}

function readIdeas(project) {
  return {
    ok: true,
    section: 'ideas',
    hint: 'Pass one of these ids to --from-idea or book read idea; the timestamped file id is required.',
    results: listFilesWithSizes(projectPath(project.dir, 'ideas')).map((item) => ({
      id: item.name,
      ...describeIdeaId(item.name),
      size: item.size,
    })),
  };
}

function readIdea(project, { id, view }) {
  if (!id) throw new Error('book read idea requires --id');
  const file = ideaFile(project.dir, id);
  if (!fs.existsSync(file)) {
    const error = new Error(`saved idea draw not found: ${id}`);
    error.code = 'idea.not_found';
    error.hint = 'use the timestamped saved id listed by "book read ideas --dir <project>" (e.g. outlinepack-42-20261113_133642), not the card result id such as outlinepack-42-01';
    throw error;
  }
  if (view !== 'summary') return { ok: true, section: 'idea', id, draw: readJson(file) };
  const draw = readJson(file);
  return {
    ok: true,
    section: 'idea',
    id,
    view: 'summary',
    summary: {
      type: draw?.query?.type || '',
      genre: draw?.query?.genre || '',
      seed: draw?.query?.seed || 0,
      count: Array.isArray(draw?.results) ? draw.results.length : 0,
      result_ids: (draw?.results || []).map((item) => item.id).filter(Boolean),
      bytes: fs.statSync(file).size,
    },
    hint: 'Pass --view full to load the raw draw payload.',
  };
}

function readResearch(project, { id }) {
  const dir = projectPath(project.dir, 'research');
  if (id) {
    const file = researchFile(project.dir, id);
    if (!fs.existsSync(file)) throw new Error(`research report not found: ${id}`);
    return { ok: true, section: 'research', id, report: readJson(file) };
  }
  return { ok: true, section: 'research', results: listFilesWithSizes(dir) };
}

function readCraft(project, { id }) {
  const dir = projectPath(project.dir, 'craft');
  if (!fs.existsSync(dir)) return { ok: true, section: 'craft', results: [] };
  if (id) {
    const file = craftFile(project.dir, id);
    if (!fs.existsSync(file)) throw new Error(`craft file not found: ${id}`);
    return { ok: true, section: 'craft', id, craft: readJson(file) };
  }
  return { ok: true, section: 'craft', results: listFilesWithSizes(dir) };
}

function readGraph(project) {
  return { ok: true, section: 'graph', graph: buildProjectGraph(project) };
}

function readStyle(project) {
  const file = styleVoiceFile(project.dir);
  if (!fs.existsSync(file)) {
    return { ok: true, section: 'style', present: false, hint: 'Write one with book write style --apply < voice.json.' };
  }
  const card = readJson(file);
  return { ok: true, section: 'style', present: true, voice: card, summary: voiceCardSummary(card) };
}

function readContext(project) {
  const outline = readOptionalJson(outlineFile(project.dir));
  const voice = readOptionalJson(styleVoiceFile(project.dir));
  return {
    ok: true,
    section: 'context',
    status: projectStatus(project),
    outline: outline ? outlineIndex(outline) : null,
    style: voiceCardSummary(voice),
  };
}

function readLogs(project) {
  const dir = projectPath(project.dir, 'logs');
  const results = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
  return { ok: true, section: 'logs', results };
}

const READERS = {
  setup: readSetup,
  outline: readOutline,
  chapter: readChapter,
  recap: readRecap,
  ideas: readIdeas,
  idea: readIdea,
  research: readResearch,
  graph: readGraph,
  craft: readCraft,
  context: readContext,
  style: readStyle,
  logs: readLogs,
};

export function readSection(project, section, options = {}) {
  const reader = READERS[section];
  if (!reader) throw new Error(`unsupported read section: ${section}`);
  const id = options.id ? safeSegment(options.id) : '';
  const view = options.view || 'brief';
  return reader(project, { id, view });
}
