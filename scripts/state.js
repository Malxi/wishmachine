// Read-only project views: projectStatus (what exists on disk / what to do next)
// and projectState (the AI-facing brief/full JSON envelope).
// Depends on paths.js + graph.js + outlineIndex only; never on project.js.

import fs from 'node:fs';
import { outlineIndex } from './rules/outline-shape.js';
import {
  chapterFile, listFilesWithSizes, listJsonFiles, outlineFile, projectPath,
  readOptionalJson, setupFile,
} from './paths.js';
import { buildProjectGraph } from './graph.js';

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
    next: nextStep(project, chapters, setup, outline),
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

// Commands in state.next are copy-pasteable for the current project: the real
// root replaces the old `<project>` placeholder, quoted when it contains spaces.
function shellArg(value) {
  const text = String(value);
  return /\s/.test(text) ? `"${text}"` : text;
}

function nextStep(project, chapters, setup, outline) {
  const cli = 'node scripts/wishmachine.js';
  const dir = shellArg(project.dir);
  if (!setup) {
    return {
      stage: 'setup',
      targetId: 'setup',
      reason: '故事设定尚未生成。',
      command: `${cli} book write setup --dir ${dir} --mode replace`,
      fast_path: `${cli} ideas draw --type outlinepack --save --dir ${dir}`,
    };
  }
  if (!outline) {
    return {
      stage: 'outline',
      targetId: 'outline',
      reason: '大纲尚未生成。',
      command: `${cli} book write outline --dir ${dir} --mode replace`,
      fast_path: `${cli} ideas draw --type outlinepack --save --dir ${dir}`,
    };
  }
  const unwritten = chapters.find((chapter) => !chapter.written);
  if (unwritten) {
    return {
      stage: 'write',
      targetId: `chapter:${unwritten.id}`,
      reason: '仍有章节未写正文。',
      command: `${cli} book write chapter --dir ${dir} --id ${shellArg(unwritten.id)} --mode replace`,
    };
  }
  return {
    stage: 'complete',
    targetId: '',
    reason: '全部章节已写正文。',
    command: `${cli} export --dir ${dir} --format book`,
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
