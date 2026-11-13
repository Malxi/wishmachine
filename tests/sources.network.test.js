// Network-path regressions for source ingestion/search: the default transport
// really connects to the validated IP (pinned node:http lookup), never falls
// back to global.fetch, keeps TLS/Host semantics, follows redirects manually
// with per-hop SSRF validation, decompresses gzip/deflate/br, and the injectable
// transport/resolver seams exercise every success and failure path hermetically.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import {
  discoverSources, ingestSource, searchSources,
} from '../scripts/project.js';
import { setSourceResolver, setSourceTransport } from '../scripts/sources/net.js';
import { fixtureSet } from './fixtures.js';

const { tempProject } = fixtureSet('wishmachine-network-');

const PUBLIC_ADDRESSES = [{ address: '93.184.216.34', family: 4 }];

function installStubs({ resolver, transport }) {
  const restores = [];
  if (resolver) restores.push(setSourceResolver(resolver));
  if (transport) restores.push(setSourceTransport(transport));
  return () => {
    while (restores.length) restores.pop()();
  };
}

function fakeResponse(body, options = {}) {
  const status = options.status ?? 200;
  const headers = new Map(Object.entries(options.headers || {})
    .map(([name, value]) => [String(name).toLowerCase(), String(value)]));
  return {
    status,
    statusText: options.statusText ?? 'OK',
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers.get(String(name).toLowerCase()) ?? null },
    text: async () => body,
    json: async () => JSON.parse(body),
  };
}

function jsonResponse(payload, options = {}) {
  return fakeResponse(JSON.stringify(payload), {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
}

function htmlResponse(html) {
  return fakeResponse(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

async function startServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    port: server.address().port,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('the default transport connects to the validated IP and never calls global.fetch', async (t) => {
  const seen = [];
  const fixture = await startServer((request, response) => {
    seen.push({ host: request.headers.host, url: request.url });
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<html><head><title>固定地址</title></head><body><p>ok</p></body></html>');
  });
  t.after(() => fixture.close());
  const { project } = tempProject(t, { name: 'pinned source', init: { chapter: 1 } });
  let resolverCalls = 0;
  let fetchCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = () => {
    fetchCalls += 1;
    throw new Error('global.fetch must not be used');
  };
  const restore = installStubs({
    resolver: async (hostname) => {
      resolverCalls += 1;
      assert.equal(hostname, 'fixture.invalid');
      return [{ address: '127.0.0.1', family: 4 }];
    },
  });
  try {
    // fixture.invalid does not resolve in DNS: only the pinned 127.0.0.1 can work.
    const result = await ingestSource(project, `http://fixture.invalid:${fixture.port}/source`);
    assert.equal(result.results[0].title, '固定地址');
    assert.equal(result.results[0].source_url, `http://fixture.invalid:${fixture.port}/source`);
    assert.deepEqual(seen, [{ host: `fixture.invalid:${fixture.port}`, url: '/source' }]);
    assert.equal(resolverCalls, 1, 'DNS resolves exactly once, before the pinned connection');
    assert.equal(fetchCalls, 0, 'the default network path must never use global.fetch');
  } finally {
    restore();
    global.fetch = originalFetch;
  }
});

test('the validated address is pinned: a later DNS rebind to a private IP is never fetched', async (t) => {
  const { project } = tempProject(t, { name: 'rebind source', init: { chapter: 1 } });
  const originalContext = process.env.NODE_TEST_CONTEXT;
  delete process.env.NODE_TEST_CONTEXT;
  let answers = PUBLIC_ADDRESSES;
  let resolverCalls = 0;
  const transportAddresses = [];
  const restore = installStubs({
    resolver: async () => {
      resolverCalls += 1;
      return answers;
    },
    transport: async (request) => {
      transportAddresses.push(request.addresses.map((entry) => entry.address));
      return htmlResponse('<html><head><title>rebound</title></head></html>');
    },
  });
  try {
    await ingestSource(project, 'http://rebind.example/source');
    assert.deepEqual(transportAddresses, [['93.184.216.34']]);
    assert.equal(resolverCalls, 1);
    // Rebind after validation: the next DNS answer is private, but the transport
    // never re-resolves and the private address is rejected before any request.
    answers = [{ address: '10.9.8.7', family: 4 }];
    await assert.rejects(() => ingestSource(project, 'http://rebind.example/source'), /not allowed \(private\)/);
    assert.deepEqual(transportAddresses, [['93.184.216.34']], 'the rebound private address must never reach the transport');
    assert.equal(resolverCalls, 2);
  } finally {
    restore();
    if (originalContext === undefined) delete process.env.NODE_TEST_CONTEXT;
    else process.env.NODE_TEST_CONTEXT = originalContext;
  }
});

test('redirects are followed manually and the final URL becomes the card source', async (t) => {
  const hits = [];
  const fixture = await startServer((request, response) => {
    hits.push(request.url);
    if (request.url === '/start') {
      response.writeHead(302, { location: '/final' });
      response.end();
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<html><head><title>重定向后</title></head></html>');
  });
  t.after(() => fixture.close());
  const { project } = tempProject(t, { name: 'redirect source', init: { chapter: 1 } });
  const result = await ingestSource(project, `http://127.0.0.1:${fixture.port}/start`);
  assert.equal(result.results[0].title, '重定向后');
  assert.equal(result.results[0].source_url, `http://127.0.0.1:${fixture.port}/final`);
  assert.deepEqual(hits, ['/start', '/final']);
});

test('every redirect hop is re-validated against the SSRF guards', async (t) => {
  const fixture = await startServer((request, response) => {
    response.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' });
    response.end();
  });
  t.after(() => fixture.close());
  const { project } = tempProject(t, { name: 'redirect ssrf', init: { chapter: 1 } });
  await assert.rejects(
    () => ingestSource(project, `http://127.0.0.1:${fixture.port}/hop`),
    /source host is not allowed \(link-local\): 169\.254\.169\.254/,
  );
});

test('redirects are capped at 3 and keep the redirect-limit error contract', async (t) => {
  let hits = 0;
  const fixture = await startServer((request, response) => {
    hits += 1;
    response.writeHead(302, { location: '/loop' });
    response.end();
  });
  t.after(() => fixture.close());
  const { project } = tempProject(t, { name: 'redirect cap', init: { chapter: 1 } });
  await assert.rejects(
    () => ingestSource(project, `http://127.0.0.1:${fixture.port}/loop`),
    /source redirect limit exceeded \(3\)/,
  );
  assert.equal(hits, 4, 'one request for the original URL plus three followed redirects');
});

test('gzip, deflate and brotli bodies are decompressed on the default path', async (t) => {
  const payload = '<html><head><title>压缩史料</title></head><body>ok</body></html>';
  const encoded = new Map([
    ['/gzip', { encoding: 'gzip', body: zlib.gzipSync(payload) }],
    ['/deflate', { encoding: 'deflate', body: zlib.deflateSync(payload) }],
    ['/br', { encoding: 'br', body: zlib.brotliCompressSync(payload) }],
  ]);
  const acceptEncodings = [];
  const fixture = await startServer((request, response) => {
    acceptEncodings.push(request.headers['accept-encoding']);
    const entry = encoded.get(request.url);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'content-encoding': entry.encoding });
    response.end(entry.body);
  });
  t.after(() => fixture.close());
  const { project } = tempProject(t, { name: 'compressed source', init: { chapter: 1 } });
  for (const route of encoded.keys()) {
    const result = await ingestSource(project, `http://127.0.0.1:${fixture.port}${route}`);
    assert.equal(result.results[0].title, '压缩史料', `${route} body should be decompressed`);
  }
  assert.deepEqual(acceptEncodings, ['gzip, deflate, br', 'gzip, deflate, br', 'gzip, deflate, br']);
});

test('non-2xx document responses keep the source fetch error contract', async (t) => {
  const fixture = await startServer((request, response) => {
    response.writeHead(404, 'Not Found', { 'content-type': 'text/plain' });
    response.end('missing');
  });
  t.after(() => fixture.close());
  const { project } = tempProject(t, { name: 'fetch failure', init: { chapter: 1 } });
  await assert.rejects(
    () => ingestSource(project, `http://127.0.0.1:${fixture.port}/missing`),
    /^Error: source fetch failed: 404 Not Found$/,
  );
});

test('unresolvable hosts keep the resolution error contract and never reach the transport', async () => {
  let transportCalls = 0;
  const restore = installStubs({
    resolver: async () => {
      throw Object.assign(new Error('getaddrinfo ENOTFOUND missing.invalid'), { code: 'ENOTFOUND' });
    },
    transport: async () => {
      transportCalls += 1;
      throw new Error('network must not be reached');
    },
  });
  try {
    await assert.rejects(
      () => ingestSource(null, 'http://missing.invalid/source'),
      /source host could not be resolved: missing\.invalid \(ENOTFOUND\)/,
    );
    assert.equal(transportCalls, 0);
  } finally {
    restore();
  }
});

test('wikipedia search maps opensearch results into source cards and saved draws', async (t) => {
  const { project } = tempProject(t, { name: 'wikipedia search', init: { chapter: 1 } });
  let seenUrl;
  const restore = installStubs({
    resolver: async (hostname) => {
      assert.equal(hostname, 'en.wikipedia.org');
      return PUBLIC_ADDRESSES;
    },
    transport: async (request) => {
      seenUrl = request.url;
      return jsonResponse([
        'Mary Celeste',
        ['Mary Celeste', 'Ghost ship'],
        ['A merchant ship found abandoned.', 'A ship with no crew.'],
        ['https://en.wikipedia.org/wiki/Mary_Celeste', 'https://en.wikipedia.org/wiki/Ghost_ship'],
      ]);
    },
  });
  try {
    const result = await searchSources(project, { provider: 'wikipedia', query: 'Mary Celeste', limit: 2 });
    assert.equal(result.ok, true);
    assert.equal(result.action, 'search');
    assert.equal(result.provider, 'wikipedia');
    assert.equal(result.count, 2);
    assert.equal(result.results[0].title, 'Mary Celeste');
    assert.equal(result.results[0].source_url, 'https://en.wikipedia.org/wiki/Mary_Celeste');
    assert.equal(result.results[0].description, 'A merchant ship found abandoned.');
    assert.ok(result.saved[0].id, 'non-ingest search saves the batch of cards');
    assert.equal(seenUrl.hostname, 'en.wikipedia.org');
    assert.equal(seenUrl.pathname, '/w/api.php');
    assert.equal(seenUrl.searchParams.get('action'), 'opensearch');
    assert.equal(seenUrl.searchParams.get('format'), 'json');
    assert.equal(seenUrl.searchParams.get('limit'), '2');
    assert.equal(seenUrl.searchParams.get('search'), 'Mary Celeste');
  } finally {
    restore();
  }
});

test('CJK search queries use zh.wikipedia.org', async (t) => {
  const { project } = tempProject(t, { name: 'zh wikipedia search', init: { chapter: 1 } });
  const hosts = [];
  const restore = installStubs({
    resolver: async (hostname) => {
      hosts.push(hostname);
      return PUBLIC_ADDRESSES;
    },
    transport: async () => jsonResponse([
      '郑和',
      ['郑和'],
      ['明代航海家。'],
      ['https://zh.wikipedia.org/wiki/郑和'],
    ]),
  });
  try {
    const result = await searchSources(project, { provider: 'wikipedia', query: '郑和' });
    assert.equal(result.count, 1);
    assert.equal(result.results[0].title, '郑和');
    assert.deepEqual(hosts, ['zh.wikipedia.org']);
  } finally {
    restore();
  }
});

test('gutenberg search with --ingest saves the cards and fetches each source page', async (t) => {
  const { project } = tempProject(t, { name: 'gutenberg ingest', init: { chapter: 1 } });
  const seen = [];
  const restore = installStubs({
    resolver: async () => PUBLIC_ADDRESSES,
    transport: async (request) => {
      seen.push(request.url.href);
      if (request.url.hostname === 'gutendex.com') {
        return jsonResponse({
          results: [{
            id: 84,
            title: 'Frankenstein',
            authors: [{ name: 'Mary Shelley' }],
            subjects: ['Gothic', 'Science'],
            formats: { 'text/html': 'https://www.gutenberg.org/ebooks/84.html' },
          }],
        });
      }
      return htmlResponse('<html><head><title>Frankenstein; Or, The Modern Prometheus</title></head></html>');
    },
  });
  try {
    const result = await searchSources(project, { provider: 'gutenberg', query: 'Frankenstein', limit: 1, ingest: true });
    assert.equal(result.count, 1);
    assert.equal(result.results[0].title, 'Frankenstein');
    assert.ok(result.saved[0].id, 'ingest mode saves the fetched source page');
    assert.ok(seen[0].startsWith('https://gutendex.com/books/?search=Frankenstein'));
    assert.ok(seen.includes('https://www.gutenberg.org/ebooks/84.html'));
  } finally {
    restore();
  }
});

test('discoverSources ingests every catalog source through the transport', async (t) => {
  const { dir, project } = tempProject(t, { name: 'discover sources', init: { chapter: 1 } });
  const catalogPath = path.join(dir, 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify([
    { id: 'a', title: '源 A', url: 'https://catalog.example/a', topics: ['history'], type: 'history' },
    { id: 'b', title: '源 B', url: 'https://catalog.example/b', topics: ['history'], type: 'history' },
  ]));
  const restore = installStubs({
    resolver: async () => PUBLIC_ADDRESSES,
    transport: async (request) => htmlResponse(`<html><head><title>${request.url.pathname === '/a' ? '源 A 页面' : '源 B 页面'}</title></head></html>`),
  });
  try {
    const result = await discoverSources(project, { catalogPath, topic: 'history' });
    assert.equal(result.ok, true);
    assert.equal(result.action, 'discover');
    assert.equal(result.count, 2);
    assert.deepEqual(result.results.map((item) => item.ok), [true, true]);
    assert.ok(result.results[0].saved.id);
    assert.ok(result.results[1].saved.id);
    assert.equal(result.hint, undefined);
  } finally {
    restore();
  }
});

test('search network failures keep code source.network and the retry hint', async (t) => {
  const { project } = tempProject(t, { name: 'search network failure', init: { chapter: 1 } });
  const restore = installStubs({
    resolver: async () => PUBLIC_ADDRESSES,
    transport: async () => {
      throw Object.assign(new Error('connect ECONNREFUSED 93.184.216.34:443'), { code: 'ECONNREFUSED' });
    },
  });
  try {
    const error = await searchSources(project, { query: 'x', provider: 'wikipedia' }).then(() => null, (caught) => caught);
    assert.ok(error, 'searchSources must reject when the provider is unreachable');
    assert.equal(error.code, 'source.network');
    assert.match(error.message, /source search failed \(wikipedia\): connect ECONNREFUSED/);
    assert.match(error.hint, /outbound network access/);
  } finally {
    restore();
  }
});

test('search HTTP errors keep the search request error contract', async (t) => {
  const { project } = tempProject(t, { name: 'search http failure', init: { chapter: 1 } });
  const restore = installStubs({
    resolver: async () => PUBLIC_ADDRESSES,
    transport: async () => fakeResponse('', { status: 503, statusText: 'Service Unavailable' }),
  });
  try {
    const error = await searchSources(project, { query: 'x', provider: 'gutenberg' }).then(() => null, (caught) => caught);
    assert.ok(error);
    assert.equal(error.code, 'source.network');
    assert.match(error.message, /source search failed \(gutenberg\): search request failed: 503 Service Unavailable/);
  } finally {
    restore();
  }
});

test('discoverSources reports ok false plus a network hint when every source fails', async (t) => {
  const { dir, project } = tempProject(t, { name: 'discover failure', init: { chapter: 1 } });
  const catalogPath = path.join(dir, 'catalog.json');
  fs.writeFileSync(catalogPath, JSON.stringify([
    { id: 'a', title: '源 A', url: 'https://catalog.example/a', topics: [], type: 'history' },
    { id: 'b', title: '源 B', url: 'https://catalog.example/b', topics: [], type: 'history' },
  ]));
  const restore = installStubs({
    resolver: async () => PUBLIC_ADDRESSES,
    transport: async () => {
      throw new Error('fetch failed');
    },
  });
  try {
    const result = await discoverSources(project, { catalogPath });
    assert.equal(result.ok, false);
    assert.equal(result.count, 2);
    assert.deepEqual(result.results.map((item) => item.ok), [false, false]);
    assert.ok(result.results.every((item) => /fetch failed/.test(item.error)));
    assert.match(result.hint, /outbound network access/);
  } finally {
    restore();
  }
});
