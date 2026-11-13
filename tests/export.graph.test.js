// Project graph, source search/ingestion and manuscript export: the parts of
// the project facade that read many artifacts and talk to the outside world
// (network calls are mocked or served from a local fixture server).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {
  loadProject, writeArtifact, readSection, exportManuscript, saveIdeaDraw, saveImportedIdeas,
  buildProjectGraph, searchSources, ingestSource, discoverSources,
} from '../scripts/project.js';
import {
  fixtureSet, longChapter, drawCached, sampleSetup, sampleOutline,
} from './fixtures.js';

const { tempDir, tempProject } = fixtureSet('wishmachine-graph-');

function projectWithChapter(t) {
  const { dir } = tempProject(t, { name: '导出测试', init: { volumes: 2, chapter: 2 } });
  writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(sampleSetup()) });
  writeArtifact(loadProject(dir), { section: 'outline', mode: 'replace', apply: true, content: JSON.stringify(sampleOutline()) });
  writeArtifact(loadProject(dir), { section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true, content: longChapter() });
  return dir;
}

test('project graph merges saved cards and rejects dangling relations', (t) => {
  const { project } = tempProject(t, { name: 'graph test', init: { chapter: 1 } });
  saveIdeaDraw(project, drawCached({ type: 'worldpack', genre: '修仙', count: 1, seed: 42 }));
  saveImportedIdeas(project, { results: [{ title: '外部来源', source: 'web', keywords: ['外源'] }] }, { type: 'source' });
  const graph = buildProjectGraph(project);
  assert.ok(graph.counts.entities > 0);
  assert.ok(graph.counts.relations > 0);
  assert.ok(graph.prompt.length > 0);
  assert.equal(graph.blocking, false);
  assert.ok(readSection(project, 'graph').graph.counts.entities > 0);
  assert.throws(() => saveImportedIdeas(project, {
    results: [{
      title: '坏图',
      graph: { entities: [{ id: 'a', type: 'x', label: 'A' }], relations: [{ from: 'a', to: 'missing', type: 'x' }] },
    }],
  }), /missing entity/);
});

test('source search maps Gutenberg results into source cards', async (t) => {
  const { project } = tempProject(t, { name: 'search test', init: { chapter: 1 } });
  const original = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => ({
      results: [{
        id: 84,
        title: 'Frankenstein',
        authors: [{ name: 'Mary Shelley' }],
        subjects: ['Gothic', 'Science'],
        formats: { 'text/html': 'https://www.gutenberg.org/ebooks/84.html' },
      }],
    }),
  });
  try {
    const result = await searchSources(project, { provider: 'gutenberg', query: 'Frankenstein', limit: 1 });
    assert.equal(result.count, 1);
    assert.equal(result.results[0].title, 'Frankenstein');
    assert.equal(result.results[0].source_url, 'https://www.gutenberg.org/ebooks/84.html');
    assert.ok(result.results[0].graph.entities.length >= 2);
    assert.ok(result.results[0].graph.relations.length >= 1);
    assert.ok(result.saved[0].id);
  } finally {
    global.fetch = original;
  }
});

test('web source ingestion creates a saved source card', async (t) => {
  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><title>测试史料</title><meta name="description" content="一段可核查的史料"><meta name="keywords" content="海船,失踪,日志"></head><body><h1>海船失踪</h1><p>船只被发现时货物完好。</p><a href="/related">相关档案</a></body></html>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const address = server.address();
    const { dir, project } = tempProject(t, { name: 'ingest test', init: { chapter: 1 } });
    const result = await ingestSource(project, `http://127.0.0.1:${address.port}/source`);
    assert.equal(result.results[0].title, '测试史料');
    assert.equal(result.results[0].source_url, `http://127.0.0.1:${address.port}/source`);
    assert.ok(result.results[0].keywords.includes('海船'));
    assert.ok(result.results[0].links.some((link) => link.label === '相关档案'));
    assert.ok(result.results[0].graph.relations.some((relation) => relation.type === 'links_to'));
    assert.ok(result.saved.id);
    const catalogPath = path.join(dir, 'catalog.json');
    fs.writeFileSync(catalogPath, JSON.stringify([{
      id: 'local', title: '本地史料', url: `http://127.0.0.1:${address.port}/local`, topics: ['history'], type: 'history',
    }]));
    const discovered = await discoverSources(project, { catalogPath, topic: 'history' });
    assert.equal(discovered.count, 1);
    assert.equal(discovered.results[0].id, 'local');
    assert.ok(discovered.results[0].ok);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('export renders book and plain formats inside the project', (t) => {
  const dir = projectWithChapter(t);
  const book = exportManuscript(loadProject(dir));
  assert.equal(book.ok, true);
  assert.equal(book.format, 'book');
  assert.equal(book.chapters, 1);
  assert.ok(book.bytes > 0);
  assert.equal(book.output, path.join(dir, 'drafts', 'manuscript.md'));
  const bookText = fs.readFileSync(book.output, 'utf8');
  assert.ok(bookText.includes('## 目录'));
  assert.ok(bookText.includes('## 第一卷'));
  assert.ok(bookText.includes('孟启明'));
  const plain = exportManuscript(loadProject(dir), { format: 'plain', output: path.join('drafts', 'plain.md') });
  assert.equal(plain.format, 'plain');
  assert.equal(plain.chapters, 1);
  const plainText = fs.readFileSync(plain.output, 'utf8');
  assert.match(plainText, /^# 导出测试/m);
  assert.ok(!plainText.includes('## 目录'));
});

test('export output defaults to per-format paths and supports a custom inside path', (t) => {
  const dir = projectWithChapter(t);
  exportManuscript(loadProject(dir));
  assert.ok(fs.existsSync(path.join(dir, 'drafts', 'manuscript.md')));
  const plainDefault = exportManuscript(loadProject(dir), { format: 'plain' });
  assert.equal(plainDefault.output, path.join(dir, 'drafts', 'manuscript-plain.md'));
  assert.ok(fs.existsSync(plainDefault.output));
  const custom = exportManuscript(loadProject(dir), { output: 'drafts/run/manuscript-2.md' });
  assert.equal(custom.output, path.join(dir, 'drafts', 'run', 'manuscript-2.md'));
  assert.ok(fs.existsSync(custom.output));
});

test('search reports network failures as actionable source errors', async (t) => {
  const { project } = tempProject(t, { name: 'search network', init: { chapter: 1 } });
  const originalFetch = global.fetch;
  global.fetch = async () => { throw new Error('fetch failed'); };
  try {
    const error = await searchSources(project, { query: 'Mary Celeste', provider: 'wikipedia' }).then(() => null, (caught) => caught);
    assert.ok(error, 'searchSources should reject when the provider is unreachable');
    assert.equal(error.code, 'source.network');
    assert.match(error.hint, /network/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('search and discover surface actionable errors for bad input', async (t) => {
  const { project } = tempProject(t, { name: 'search errors', init: { chapter: 1 } });
  await assert.rejects(() => searchSources(project, { query: '' }), /requires a query/);
  await assert.rejects(() => searchSources(project, { query: 'x', provider: 'nope' }), /unsupported source provider/);
  const missing = path.join(tempDir(t), 'missing.json');
  await assert.rejects(() => discoverSources(project, { catalogPath: missing }), /ENOENT|no such file/);
});
