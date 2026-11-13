// Artifact paths and the small path/markdown helpers shared by every module.
// L1 leaf per docs/MODULES.md: only node builtins + util.js (L0), never a domain
// module, so nothing can create an import cycle through it. Everything that turns
// an artifact id into a filesystem path lives here, so read, write, export, state
// and check all apply the same containment rules.

import fs from 'node:fs';
import path from 'node:path';
import { readJson, safeSegment } from './util.js';

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
