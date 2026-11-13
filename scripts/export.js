// Manuscript export: collect written chapters, render the selected format,
// write inside the project unless --force allows an explicit outside path.

import fs from 'node:fs';
import path from 'node:path';
import { assertInside, ensureDir, readText, writeTextAtomic } from './util.js';
import {
  chapterFile, outlineFile, readOptionalJson, setupFile,
} from './paths.js';
import { projectStatus } from './state.js';
import { outlineChapters } from './registry.js';

function chapterPath(project, id) {
  try {
    return chapterFile(project.dir, id);
  } catch {
    return null;
  }
}

function collectExportPlan(project) {
  const status = projectStatus(project);
  const setup = readOptionalJson(setupFile(project.dir));
  const outline = readOptionalJson(outlineFile(project.dir));
  const ordered = [
    ...status.chapters.filter((chapter) => chapter.written).map((chapter) => chapter.id),
    ...status.orphan_chapters,
  ];
  const unique = [...new Set(ordered)];
  const chapterInfo = new Map();
  for (const chapter of outlineChapters(outline)) {
    const volume = findVolumeForChapter(outline, chapter.id);
    chapterInfo.set(chapter.id, { chapter, volume });
  }
  return { status, setup, outline, unique, written: new Set(unique), chapterInfo };
}

function findVolumeForChapter(outline, id) {
  for (const part of outline?.parts || []) {
    for (const volume of part.volumes || []) {
      if ((volume.chapters || []).some((chapter) => chapter.id === id)) return volume;
    }
  }
  return null;
}

function pushBookFrontMatter(chunks, plan) {
  const { status, setup } = plan;
  const genres = (setup.genres || []).join(' · ');
  chunks.push(`# ${status.name}`, '');
  if (genres) chunks.push(`> ${genres}　|　全${plan.unique.length}章`, '');
  if (setup.premise) chunks.push('## 内容简介', '', String(setup.premise), '');
  if (setup.theme) chunks.push('## 主题', '', String(setup.theme), '');
  pushTableOfContents(chunks, plan.outline, plan.written);
  pushCast(chunks, setup);
  pushRules(chunks, setup);
  chunks.push('---', '');
}

function pushTableOfContents(chunks, outline, written) {
  chunks.push('## 目录', '');
  let number = 0;
  for (const part of outline?.parts || []) {
    for (const volume of part.volumes || []) {
      const volumeChapters = (volume.chapters || []).filter((chapter) => written.has(chapter.id));
      if (!volumeChapters.length) continue;
      chunks.push(`**${volume.title || volume.id}**`, '');
      for (const chapter of volumeChapters) {
        number += 1;
        chunks.push(`${number}. ${chapter.title || chapter.id}`);
      }
      chunks.push('');
    }
  }
}

function pushCast(chunks, setup) {
  if (!setup.core_cast?.length) return;
  chunks.push('## 主要人物', '');
  for (const character of setup.core_cast) {
    const role = character.role === 'protagonist' ? '主角' : character.role === 'antagonist' ? '对手' : '同行者';
    chunks.push(`- **${character.name}**（${role}）：${character.story_function || ''}`);
  }
  chunks.push('');
}

function pushRules(chunks, setup) {
  if (!setup.rules?.length) return;
  chunks.push('## 规则速览', '');
  for (const rule of setup.rules.slice(0, 8)) chunks.push(`- ${rule}`);
  chunks.push('');
}

function stripTitle(text) {
  return String(text).replace(/^#\s+.*(?:\r?\n)+/, '').trim();
}

function pushBookChapters(chunks, plan, project) {
  let currentVolume = '';
  let chapters = 0;
  for (const id of plan.unique) {
    const file = chapterPath(project, id);
    if (!file || !fs.existsSync(file)) continue;
    const info = plan.chapterInfo.get(id);
    const volumeTitle = info?.volume?.title || info?.volume?.id || '未分组';
    if (volumeTitle !== currentVolume) {
      currentVolume = volumeTitle;
      chunks.push(`## ${volumeTitle}`, '');
      if (info?.volume?.summary) chunks.push(`> ${info.volume.summary}`, '');
      chunks.push('---', '');
    }
    const raw = readText(file);
    const title = info?.chapter?.title || raw.match(/^#\s+(.+)$/m)?.[1] || id;
    chunks.push(`### ${title}`, '', stripTitle(raw), '', '---', '');
    chapters += 1;
  }
  chunks.push('> 全书完。', '');
  return chapters;
}

function renderBook(project, plan) {
  const chunks = [];
  pushBookFrontMatter(chunks, plan);
  const chapters = pushBookChapters(chunks, plan, project);
  return { chunks, chapters };
}

function renderPlain(project, plan) {
  const chunks = [`# ${plan.status.name}`, '', '> 由小说许愿机从 chapters/ 导出。', ''];
  let chapters = 0;
  for (const id of plan.unique) {
    const file = chapterPath(project, id);
    if (!file || !fs.existsSync(file)) continue;
    chunks.push('---', '', readText(file).trimEnd(), '');
    chapters += 1;
  }
  return { chunks, chapters };
}

function resolveOutput(project, options, format) {
  // Keep the two formats apart by default so consecutive exports do not overwrite each other.
  const defaultName = format === 'plain' ? 'manuscript-plain.md' : 'manuscript.md';
  const requested = options.output || path.join('drafts', defaultName);
  if (options.force) return path.resolve(project.dir, requested);
  return assertInside(project.dir, requested, 'export output');
}

export function exportManuscript(project, options = {}) {
  const format = options.format === 'plain' ? 'plain' : 'book';
  const plan = collectExportPlan(project);
  const rendered = format === 'book' && plan.setup && plan.outline
    ? renderBook(project, plan)
    : renderPlain(project, plan);
  const content = `${rendered.chunks.join('\n').trimEnd()}\n`;
  const output = resolveOutput(project, options, format);
  ensureDir(path.dirname(output));
  writeTextAtomic(output, content);
  return {
    ok: true,
    action: 'export',
    format,
    output,
    chapters: rendered.chapters,
    bytes: Buffer.byteLength(content, 'utf8'),
  };
}
