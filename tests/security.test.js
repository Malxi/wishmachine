// Security regressions: path containment for data-controlled ids/paths, export
// containment, SSRF guards that must reject before any DNS/HTTP work, and
// numeric validation of the project config. Network assertions go through the
// injectable source transport, never through a monkeypatched global.fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadProject, writeArtifact, readSection, exportManuscript, ingestSource,
} from '../scripts/project.js';
import { setSourceTransport } from '../scripts/sources/net.js';
import { assertInside, safeSegment } from '../scripts/util.js';
import { checkProject } from '../scripts/schema.js';
import { fixtureSet, longChapter } from './fixtures.js';

const { tempDir, tempProject } = fixtureSet('wishmachine-security-');

test('safeSegment and assertInside reject path traversal', (t) => {
  const root = tempDir(t);
  assert.equal(safeSegment('P1-V1-C1'), 'P1-V1-C1');
  assert.throws(() => safeSegment(''), /invalid id/);
  assert.throws(() => safeSegment('..'), /invalid id/);
  assert.throws(() => safeSegment('../evil'), /invalid id/);
  assert.throws(() => safeSegment('a/b', 'craft kind'), /invalid craft kind/);
  assert.throws(() => safeSegment('a\\b', 'chapter id'), /invalid chapter id/);
  assert.equal(assertInside(root, 'story/setup.json'), path.join(root, 'story', 'setup.json'));
  assert.throws(() => assertInside(root, '../evil.json'), /outside/);
  assert.throws(() => assertInside(root, path.join(root, '..', 'evil.json')), /outside/);
  assert.throws(() => assertInside(root, path.resolve(root, '..', 'evil.json'), 'export output'), /export output is outside/);
});

test('artifact writes reject traversal ids and never escape the project', (t) => {
  const { dir } = tempProject(t, { name: 'safe ids', init: { chapter: 1 } });
  const sibling = path.join(path.dirname(dir), 'wishmachine-security-escaped.md');
  assert.throws(() => writeArtifact(loadProject(dir), {
    section: 'chapter', id: '../wishmachine-security-escaped', mode: 'replace', apply: true, content: longChapter(),
  }), /invalid id/);
  assert.throws(() => writeArtifact(loadProject(dir), {
    section: 'craft', target: '../escape', mode: 'replace', apply: true, content: '{}',
  }), /unsupported write target for craft/);
  assert.throws(() => writeArtifact(loadProject(dir), {
    section: 'recap', id: '..\\escape', mode: 'replace', apply: true, content: '{}',
  }), /invalid id/);
  assert.throws(() => readSection(loadProject(dir), 'chapter', { id: '../../etc/passwd' }), /invalid id/);
  assert.throws(() => readSection(loadProject(dir), 'idea', { id: '..' }), /invalid id/);
  assert.equal(fs.existsSync(sibling), false);
});

test('outline ids with path separators are reported instead of being used as file paths', (t) => {
  const { dir } = tempProject(t, { name: 'outline id format', init: { chapter: 1 } });
  const evil = {
    parts: [{
      id: 'P1', title: '卷', summary: 's', volumes: [{
        id: 'P1-V1', title: 'v', summary: 's', chapters: [{
          id: '../../evil', title: 't', summary: 's', characters: [], location: 'l', events: [], conflict: 'c', pacing: 'p',
        }],
      }],
    }],
  };
  fs.writeFileSync(path.join(dir, 'story', 'compose', 'outline.json'), JSON.stringify(evil));
  const check = checkProject(loadProject(dir), { profile: 'schema', target: 'outline' });
  assert.equal(check.blocking, true);
  assert.ok(check.findings.some((item) => item.rule_id === 'schema.outline.chapter.id_format'));
  assert.equal(exportManuscript(loadProject(dir)).chapters, 0);
});

test('export output outside the project is rejected unless forced', (t) => {
  const { dir } = tempProject(t, { name: 'export containment', init: { chapter: 1 } });
  writeArtifact(loadProject(dir), { section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true, content: longChapter() });
  const outsideDir = tempDir(t);
  const outside = path.join(outsideDir, 'evil.md');
  assert.throws(() => exportManuscript(loadProject(dir), { output: outside }), /outside/);
  assert.equal(fs.existsSync(outside), false);
  assert.throws(() => exportManuscript(loadProject(dir), { output: path.join('..', 'evil.md') }), /outside/);
  const forced = exportManuscript(loadProject(dir), { output: outside, force: true });
  assert.equal(forced.output, outside);
  assert.ok(fs.existsSync(outside));
});

test('ingestSource blocks metadata, reserved and malformed URLs before fetching', async () => {
  let calls = 0;
  const restore = setSourceTransport(() => { calls += 1; throw new Error('network must not be reached'); });
  try {
    await assert.rejects(() => ingestSource(null, 'http://169.254.169.254/latest/meta-data/'), /not allowed \(link-local\)/);
    await assert.rejects(() => ingestSource(null, 'http://metadata.google.internal/computeMetadata/v1/'), /not allowed/);
    await assert.rejects(() => ingestSource(null, 'http://[::]/'), /not allowed \(reserved\)/);
    await assert.rejects(() => ingestSource(null, 'file:///etc/passwd'), /must use http or https/);
    await assert.rejects(() => ingestSource(null, 'http://user:pass@example.com/'), /must not embed credentials/);
    await assert.rejects(() => ingestSource(null, 'not a url'), /invalid source URL/);
    assert.equal(calls, 0);
  } finally {
    restore();
  }
});

test('ingestSource blocks loopback and private hosts outside the test harness', async () => {
  const originalContext = process.env.NODE_TEST_CONTEXT;
  let calls = 0;
  const restore = setSourceTransport(() => { calls += 1; throw new Error('network must not be reached'); });
  try {
    delete process.env.NODE_TEST_CONTEXT;
    for (const url of ['http://127.0.0.1:9/', 'http://10.1.2.3/', 'http://192.168.1.10/', 'http://172.16.0.1/', 'http://[::1]/']) {
      await assert.rejects(() => ingestSource(null, url), /not allowed/, `${url} should be rejected`);
    }
    assert.equal(calls, 0);
  } finally {
    restore();
    if (originalContext === undefined) delete process.env.NODE_TEST_CONTEXT;
    else process.env.NODE_TEST_CONTEXT = originalContext;
  }
});

test('loopback is only allowed for the local test fixtures, never silently for products', async () => {
  let calls = 0;
  const restore = setSourceTransport(() => { calls += 1; throw new Error('fixture fetch reached'); });
  try {
    assert.ok(process.env.NODE_TEST_CONTEXT, 'node --test sets NODE_TEST_CONTEXT for fixture servers');
    await assert.rejects(() => ingestSource(null, 'http://127.0.0.1:9/'), /fixture fetch reached/);
    assert.equal(calls, 1);
  } finally {
    restore();
  }
});

test('project config numbers are validated on load', (t) => {
  const { dir } = tempProject(t, { name: 'config numbers' });
  const configPath = path.join(dir, 'novel.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.structure.target_chapters = 'abc';
  fs.writeFileSync(configPath, JSON.stringify(config));
  assert.throws(() => loadProject(dir), /structure.target_chapters must be a positive integer/);
  assert.throws(() => loadProject(path.join(dir, 'missing')), /no novel\.json found/);
});
