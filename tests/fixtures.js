// Shared fixtures for the Wishmachine test suite.
//
// Guarantees this module provides:
// - every temporary directory lives under os.tmpdir() and is removed by the
//   test's own t.after hook (100% cleanup, even when a test throws);
// - fixtureSet() registers one file-level `after` hook that fails the file if a
//   directory created by that file is still on disk, so `node --test` reports
//   temp leaks instead of hiding them;
// - expensive deterministic draws are memoized once per options object and
//   deep-cloned on the way out, so generators run once while every test still
//   owns a private copy that it can mutate.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { after } from 'node:test';
import { drawIdeas } from '../scripts/ideas.js';
import { initProject, loadProject, writeArtifact } from '../scripts/project.js';

const SETUP_TEMPLATE = {
  project_name: '测试小说',
  genres: ['科幻'],
  premise: '一艘船在虫潮中寻找逃生路线，必须在封锁前决定谁上船。',
  theme: '生存与选择',
  rules: ['跃迁会烧毁记忆'],
  target_audience: '成人',
  tone: '冷峻',
  tense: 'past',
  pov_style: 'third_person_limited',
  core_cast: [{ id: 'cast_lead', name: '孟启明', role: 'protagonist', importance: 10, story_function: '决定谁上船', entry_phase: 'opening' }],
  storylines: [{ name: '逃生', description: '逃离虫潮', type: 'main', importance: 10 }],
};

const OUTLINE_TEMPLATE = {
  parts: [{
    id: 'P1', title: '第一部', summary: '封锁与逃生',
    volumes: [
      {
        id: 'P1-V1', title: '第一卷', summary: '出港',
        chapters: [
          { id: 'P1-V1-C1', title: '封锁令', summary: '孟启明发现名单异常', characters: ['孟启明'], location: '砚港', events: [{ type: 'item', characters: ['孟启明'], subject: '名单', change: 'discover' }], conflict: '名单与虫潮时间矛盾', pacing: 'fast' },
          { id: 'P1-V1-C2', title: '登船', summary: '孟启明争取舱位', characters: ['孟启明'], location: '码头', events: [{ type: 'relationship', characters: ['孟启明'], subject: '舱位', change: 'get' }], conflict: '舱位不足', pacing: 'medium' },
        ],
      },
      {
        id: 'P1-V2', title: '第二卷', summary: '跃迁',
        chapters: [
          { id: 'P1-V2-C1', title: '第一次跃迁', summary: '跃迁失败', characters: ['孟启明'], location: '舰桥', events: [{ type: 'status', characters: ['孟启明'], subject: '伤势', change: 'lost' }], conflict: '虫族预判', pacing: 'fast' },
          { id: 'P1-V2-C2', title: '关闭引擎', summary: '决定停航', characters: ['孟启明'], location: '机库', events: [{ type: 'goal', characters: ['孟启明'], subject: '路线', change: 'changed' }], conflict: '路线选择', pacing: 'slow' },
        ],
      },
    ],
  }],
};

const RECAP_TEMPLATE = {
  chapter_id: 'P1-V1-C1',
  title: '封锁令',
  location: '砚港',
  time: '封锁前夜',
  present: ['孟启明'],
  plot_beats: ['发现名单时间戳异常'],
  decisions: ['决定登船'],
  reveals: ['名单早于虫潮预警'],
  unresolved: ['谁改了名单'],
  promises: [],
  items: ['名单副本'],
  status: ['警觉'],
  last_line: '他把名单折进内袋。',
  cliffhanger: '',
};

function clone(value) {
  return structuredClone(value);
}

export function sampleSetup() {
  return clone(SETUP_TEMPLATE);
}

export function sampleOutline() {
  return clone(OUTLINE_TEMPLATE);
}

export function sampleRecap(overrides = {}) {
  return { ...clone(RECAP_TEMPLATE), ...clone(overrides) };
}

export function longChapter(title = '第一章') {
  return `# ${title}\n\n${'宋夜航在灯下抄册，墨迹未干。'.repeat(150)}`;
}

const drawCache = new Map();

// Deterministic draws are pure functions of their options: cache one copy and
// hand out clones so tests can tamper freely.
export function drawCached(options) {
  const key = JSON.stringify(options);
  let draw = drawCache.get(key);
  if (!draw) {
    draw = drawIdeas(clone(options));
    drawCache.set(key, draw);
  }
  return clone(draw);
}

// Call `outlinepack({ chapters: 3 })` or `outlinepack(7, { chapters: 3 })`:
// the optional leading number is a seed override.
function drawOptions(defaults, seedOrOptions = {}, options = {}) {
  if (typeof seedOrOptions === 'number') return { ...defaults, ...options, seed: seedOrOptions };
  return { ...defaults, ...seedOrOptions };
}

export function outlinepack(seedOrOptions = {}, options = {}) {
  const draw = drawCached(drawOptions({
    type: 'outlinepack', genre: '悬疑', seed: 42, count: 1, chapters: 10,
  }, seedOrOptions, options));
  return draw.results[0];
}

export function worldpack(seedOrOptions = {}, options = {}) {
  const draw = drawCached(drawOptions({
    type: 'worldpack', genre: '科幻', seed: 42, count: 1,
  }, seedOrOptions, options));
  return draw.results[0];
}

export function plotpack(seedOrOptions = {}, options = {}) {
  const draw = drawCached(drawOptions({
    type: 'plotpack', genre: '悬疑', seed: 42, count: 1,
  }, seedOrOptions, options));
  return draw.results[0];
}

function listTempDirs(prefix) {
  if (!fs.existsSync(os.tmpdir())) return [];
  return fs.readdirSync(os.tmpdir())
    .filter((name) => name.startsWith(prefix))
    .map((name) => path.join(os.tmpdir(), name));
}

// Bind fixtures to a file-unique temp prefix. The returned helpers always clean
// up through t.after and the file-level hook proves nothing was left behind.
export function fixtureSet(prefix) {
  assert.ok(prefix && prefix.endsWith('-'), 'fixtureSet(prefix) needs a file-unique prefix ending in "-"');
  const baseline = new Set(listTempDirs(prefix));

  function tempDir(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    t?.after?.(() => fs.rmSync(dir, { recursive: true, force: true }));
    return dir;
  }

  function tempProject(t, options = {}) {
    const dir = tempDir(t);
    initProject({
      name: options.name || '测试小说',
      parts: 1,
      volumes: 1,
      chapter: 2,
      ...(options.init || {}),
      dir,
    });
    return { dir, project: loadProject(dir) };
  }

  // A project whose setup/outline were generated by one outlinepack. Used by the
  // registry tests, which need a self-consistent pair of registries to tamper with.
  function projectWithOutlinepack(t, options = {}) {
    const chapters = options.chapters || 10;
    const { dir } = tempProject(t, {
      name: options.name || 'registry',
      init: { chapter: chapters, ...(options.init || {}) },
    });
    const pack = outlinepack({ chapters, ...(options.pack || {}) });
    const setupWrite = writeArtifact(loadProject(dir), {
      section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(pack.setup_draft),
    });
    assert.equal(setupWrite.applied, true, `setup write blocked: ${JSON.stringify(setupWrite.check?.findings)}`);
    const outlineWrite = writeArtifact(loadProject(dir), {
      section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(pack.draft_outline),
    });
    assert.equal(outlineWrite.applied, true, `outline write blocked: ${JSON.stringify(outlineWrite.check?.findings)}`);
    return { dir, project: loadProject(dir), pack };
  }

  function expectNoTempLeaks() {
    const leaked = listTempDirs(prefix).filter((dir) => !baseline.has(dir));
    assert.deepEqual(leaked, [], `temporary directories leaked under ${os.tmpdir()}: ${leaked.join(', ')}`);
  }

  after(expectNoTempLeaks);
  return { tempDir, tempProject, projectWithOutlinepack, expectNoTempLeaks };
}
