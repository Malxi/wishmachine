import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initProject, loadProject, projectStatus, writeArtifact, readSection } from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import { drawIdeas } from '../scripts/ideas.js';
import { listWorkflows, readWorkflow, listReferences, readReference } from '../scripts/guides.js';

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'wishmachine-test-'));
}

const setup = {
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

const outline = {
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

test('init, status, write setup/outline and check', () => {
  const dir = tempDir();
  initProject({ name: '测试小说', dir, parts: 1, volumes: 2, chapter: 2, genre: '科幻' });
  assert.ok(fs.existsSync(path.join(dir, 'novel.json')));
  let project = loadProject(dir);
  assert.equal(projectStatus(project).setup, false);

  const setupResult = writeArtifact(project, { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(setup) });
  assert.equal(setupResult.applied, true);
  project = loadProject(dir);
  assert.equal(projectStatus(project).setup, true);

  const outlineResult = writeArtifact(project, { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(outline) });
  assert.equal(outlineResult.applied, true);
  project = loadProject(dir);
  const status = projectStatus(project);
  assert.equal(status.outline.volumes, 2);
  assert.equal(status.outline.chapters, 4);
  assert.equal(status.next.stage, 'write');

  const check = checkProject(project, { profile: 'all', target: 'outline' });
  assert.equal(check.blocking, false);
  assert.equal(check.summary.high, 0);
});

test('chapter write and read', () => {
  const dir = tempDir();
  initProject({ name: '章节测试', dir, parts: 1, volumes: 1, chapter: 1 });
  let project = loadProject(dir);
  const result = writeArtifact(project, { section: 'chapter', mode: 'replace', apply: true, id: 'P1-V1-C1', content: '# 第一章\n\n这是一段足够长的正文。'.repeat(20) });
  assert.equal(result.applied, true);
  project = loadProject(dir);
  const content = readSection(project, 'chapter', { id: 'P1-V1-C1' });
  assert.ok(content.content.includes('第一章'));
});

test('ideas are deterministic', () => {
  const a = drawIdeas({ type: 'namecard', genre: '科幻', count: 5, seed: 42 });
  const b = drawIdeas({ type: 'namecard', genre: '科幻', count: 5, seed: 42 });
  assert.deepEqual(a.results.map((r) => r.name), b.results.map((r) => r.name));
  assert.equal(a.count, 5);
  assert.equal(a.meta.seed, 42);
});

test('guides expose schemas and workflows', () => {
  assert.ok(listWorkflows().some((w) => w.name === 'outline'));
  assert.ok(readWorkflow('outline').includes('#'));
  assert.ok(listReferences().some((r) => r.name === 'setup-schema'));
  assert.ok(readReference('setup-schema').includes('premises'));
});
