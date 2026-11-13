// Source ingestion/search. Every caller-supplied URL is checked against SSRF
// rules (private, loopback and cloud-metadata hosts) and redirects are followed
// manually so each hop is re-validated and capped.

import path from 'node:path';
import net from 'node:net';
import dns from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import { readJson, nowIso } from './util.js';
import { saveImportedIdeas } from './store.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const USER_AGENT = 'Wishmachine/0.1 (source ingest)';
const TIMEOUT_MS = 15000;
const MAX_REDIRECTS = 3;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const BLOCKED_HOSTNAMES = new Set(['metadata', 'metadata.google.internal', 'metadata.azure.internal']);

function privateHostsAllowed(options) {
  if (options?.allowPrivateHosts) return true;
  if (/^(1|true|yes)$/i.test(String(process.env.WISHMACHINE_ALLOW_PRIVATE_SOURCES || ''))) return true;
  // The local HTTP fixtures used by `node --test` need loopback access.
  return Boolean(process.env.NODE_TEST_CONTEXT);
}

function classifyAddress(address) {
  const version = net.isIP(address);
  if (!version) return 'unknown';
  if (version === 6) return classifyIpv6(address.toLowerCase());
  return classifyIpv4(address);
}

function classifyIpv6(address) {
  if (address === '::1') return 'loopback';
  if (address === '::') return 'reserved';
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return classifyIpv4(mapped[1]);
  if (/^fe[89ab]/.test(address)) return 'link-local';
  if (/^f[cd]/.test(address)) return 'private';
  return 'public';
}

function classifyIpv4(address) {
  const [a, b] = address.split('.').map(Number);
  if (a === 127) return 'loopback';
  if (a === 10 || a === 0) return a === 10 ? 'private' : 'reserved';
  if (a === 172 && b >= 16 && b <= 31) return 'private';
  if (a === 192 && b === 168) return 'private';
  if (a === 169 && b === 254) return 'link-local';
  if (a === 100 && b >= 64 && b <= 127) return 'private';
  if (a >= 224) return 'reserved';
  return 'public';
}

async function assertSafeSourceUrl(rawUrl, options = {}) {
  let parsed;
  try {
    parsed = rawUrl instanceof URL ? rawUrl : new URL(String(rawUrl));
  } catch {
    throw new Error(`invalid source URL: ${rawUrl}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('source URL must use http or https');
  }
  if (parsed.username || parsed.password) {
    throw new Error('source URL must not embed credentials');
  }
  const hostname = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname || BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error(`source host is not allowed: ${hostname || '(empty)'}`);
  }
  const allowed = privateHostsAllowed(options);
  const checkAddress = (address) => {
    const kind = classifyAddress(address);
    if (kind === 'link-local' || kind === 'reserved' || kind === 'unknown') {
      throw new Error(`source host is not allowed (${kind}): ${hostname}`);
    }
    if ((kind === 'private' || kind === 'loopback') && !allowed) {
      throw new Error(`source host is not allowed (${kind}): ${hostname}`);
    }
  };
  if (net.isIP(hostname)) {
    checkAddress(hostname);
    return parsed;
  }
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch (error) {
    throw new Error(`source host could not be resolved: ${hostname} (${error.code || error.message})`);
  }
  if (!addresses.length) throw new Error(`source host could not be resolved: ${hostname}`);
  for (const entry of addresses) checkAddress(entry.address);
  return parsed;
}

async function fetchDocument(url, options = {}) {
  let current = await assertSafeSourceUrl(url, options);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current.href, {
      redirect: 'manual',
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const location = response.headers?.get?.('location');
    if (REDIRECT_STATUSES.has(response.status) && location) {
      if (hop === MAX_REDIRECTS) {
        throw new Error(`source redirect limit exceeded (${MAX_REDIRECTS})`);
      }
      current = await assertSafeSourceUrl(new URL(location, current), options);
      continue;
    }
    if (!response.ok) {
      throw new Error(`source fetch failed: ${response.status} ${response.statusText}`);
    }
    return { response, finalUrl: current };
  }
  throw new Error(`source redirect limit exceeded (${MAX_REDIRECTS})`);
}

function decodeHtml(text) {
  return String(text)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function metaContent(html, name) {
  const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([\\s\\S]*?)["']`, 'i');
  return decodeHtml(html.match(pattern)?.[1] || '').trim();
}

function extractTitle(html, fallback) {
  return decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || fallback).trim();
}

function extractKeywords(html, title) {
  const keywordText = metaContent(html, 'keywords');
  if (keywordText) {
    return keywordText.split(/[,，;；]/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  }
  return [...new Set(title.split(/[\s:：·\-—]+/).filter((item) => item.length >= 2))].slice(0, 8);
}

function htmlToText(html) {
  return decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function extractHeadings(html) {
  return [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => decodeHtml(match[1].replace(/<[^>]+>/g, '')).trim())
    .filter(Boolean)
    .slice(0, 20);
}

function extractLinks(html, baseUrl) {
  const linkMap = new Map();
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = decodeHtml(match[2].replace(/<[^>]+>/g, '')).trim();
    if (!label) continue;
    let href;
    try {
      href = new URL(decodeHtml(match[1]), baseUrl).href;
    } catch {
      continue;
    }
    if (!/^https?:/i.test(href)) continue;
    if (!linkMap.has(href)) linkMap.set(href, label);
    if (linkMap.size >= 30) break;
  }
  return linkMap;
}

function buildGraph(parsed, title, headings, linkMap) {
  const sourceId = `source:${parsed.href}`;
  const entities = [
    { id: sourceId, type: 'source', label: title },
    ...headings.map((label, index) => ({ id: `source:heading-${index + 1}`, type: 'heading', label })),
    ...[...linkMap.entries()].map(([url, label], index) => ({ id: `source:link-${index + 1}`, type: 'link', label, url })),
  ];
  const relations = [
    ...headings.map((label, index) => ({ from: sourceId, to: `source:heading-${index + 1}`, type: 'mentions' })),
    ...[...linkMap.keys()].map((url, index) => ({ from: sourceId, to: `source:link-${index + 1}`, type: 'links_to' })),
  ];
  return { entities, relations };
}

export async function ingestSource(project, url, options = {}) {
  const { response, finalUrl } = await fetchDocument(url, options);
  const html = await response.text();
  const title = extractTitle(html, finalUrl.hostname);
  const keywords = extractKeywords(html, title);
  const headings = extractHeadings(html);
  const linkMap = extractLinks(html, finalUrl);
  const graph = buildGraph(finalUrl, title, headings, linkMap);
  const links = [...linkMap.entries()].map(([linkUrl, label]) => ({ label, url: linkUrl }));
  const card = {
    title,
    type: 'web-source',
    source: finalUrl.href,
    source_url: finalUrl.href,
    retrieved_at: nowIso(),
    description: metaContent(html, 'description') || metaContent(html, 'og:description'),
    keywords,
    headings,
    links,
    entities: graph.entities,
    graph,
    excerpt: htmlToText(html).slice(0, 4000),
  };
  return saveImportedIdeas(project, { results: [card] }, {
    type: options.type || 'source',
    source: finalUrl.href,
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Wishmachine/0.1 (source search)' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`search request failed: ${response.status} ${response.statusText}`);
  return response.json();
}

function wikipediaCards(data, query) {
  const titles = Array.isArray(data?.[1]) ? data[1] : [];
  const snippets = Array.isArray(data?.[2]) ? data[2] : [];
  const urls = Array.isArray(data?.[3]) ? data[3] : [];
  return titles.map((title, index) => {
    const entity = { id: `wikipedia:${encodeURIComponent(title)}`, type: 'topic', label: title };
    return {
      title,
      type: 'web-source',
      provider: 'wikipedia',
      query,
      source: urls[index] || '',
      source_url: urls[index] || '',
      description: snippets[index] || '',
      keywords: [query].filter(Boolean),
      excerpt: snippets[index] || '',
      entities: [entity],
      graph: { entities: [entity], relations: [] },
    };
  });
}

function gutenbergCard(book, query) {
  const formats = book.formats || {};
  const url = formats['text/html'] || formats['text/plain'] || `https://www.gutenberg.org/ebooks/${book.id}`;
  const workId = `gutenberg:${book.id}:work`;
  const entities = [{ id: workId, type: 'work', label: book.title || `Gutenberg #${book.id}` }];
  const relations = [];
  for (const author of book.authors || []) {
    if (!author?.name) continue;
    const authorId = `gutenberg:${book.id}:author:${encodeURIComponent(author.name)}`;
    entities.push({ id: authorId, type: 'author', label: author.name });
    relations.push({ from: workId, to: authorId, type: 'authored_by' });
  }
  for (const subject of book.subjects || []) {
    const subjectId = `gutenberg:${book.id}:subject:${encodeURIComponent(subject)}`;
    if (entities.some((entity) => entity.id === subjectId)) continue;
    entities.push({ id: subjectId, type: 'subject', label: subject });
    relations.push({ from: workId, to: subjectId, type: 'has_subject' });
  }
  return {
    title: book.title || `Gutenberg #${book.id}`,
    type: 'public-domain-novel',
    provider: 'gutenberg',
    query,
    source: url,
    source_url: url,
    description: (book.subjects || []).join('; '),
    keywords: [...(book.subjects || []), ...((book.authors || []).map((author) => author.name))].slice(0, 12),
    excerpt: '',
    gutenberg_id: book.id,
    entities,
    relations,
    graph: { entities, relations },
  };
}

async function saveSearchCards(project, cards, options) {
  const saved = [];
  if (options.ingest) {
    for (const card of cards) {
      try {
        saved.push((await ingestSource(project, card.source_url, { type: 'source' })).saved);
      } catch (error) {
        saved.push({ error: error.message, url: card.source_url });
      }
    }
    return saved;
  }
  if (cards.length) {
    saved.push(saveImportedIdeas(project, { results: cards }, { type: 'source', source: options.provider }).saved);
  }
  return saved;
}

export async function searchSources(project, options = {}) {
  const provider = String(options.provider || 'wikipedia').toLowerCase();
  const query = String(options.query || '').trim();
  if (!query) throw new Error('ideas search requires a query');
  const limit = Math.max(1, Math.min(10, Number(options.limit) || 3));
  if (!['wikipedia', 'gutenberg'].includes(provider)) {
    throw new Error(`unsupported source provider: ${provider}; use wikipedia or gutenberg`);
  }
  try {
    if (provider === 'wikipedia') {
      const host = /[\u3400-\u9fff]/.test(query) ? 'zh.wikipedia.org' : 'en.wikipedia.org';
      const endpoint = `https://${host}/w/api.php?action=opensearch&format=json&limit=${limit}&search=${encodeURIComponent(query)}`;
      const cards = wikipediaCards(await fetchJson(endpoint), query);
      const saved = await saveSearchCards(project, cards, { ...options, provider });
      return { ok: true, action: 'search', provider, query, count: cards.length, results: cards, saved };
    }
    const endpoint = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
    const data = await fetchJson(endpoint);
    const cards = (data?.results || []).slice(0, limit).map((book) => gutenbergCard(book, query));
    const saved = await saveSearchCards(project, cards, { ...options, provider });
    return { ok: true, action: 'search', provider, query, count: cards.length, results: cards, saved };
  } catch (error) {
    const wrapped = new Error(`source search failed (${provider}): ${error.message}`);
    wrapped.code = 'source.network';
    wrapped.hint = 'ideas search/discover need outbound network access; retry later, switch --provider, or save sourced cards locally and use "ideas import"';
    throw wrapped;
  }
}

export async function discoverSources(project, options = {}) {
  const catalogPath = options.catalogPath || path.join(ROOT, 'references', 'source-catalog.json');
  const catalog = readJson(catalogPath);
  const topic = String(options.topic || '').toLowerCase();
  const limit = Math.max(1, Math.min(20, Number(options.limit) || 3));
  const candidates = catalog
    .filter((source) => !topic || (source.topics || []).map((item) => item.toLowerCase()).includes(topic))
    .slice(0, limit);
  if (!candidates.length) {
    throw new Error(`no sources for topic: ${topic || '(all)'}`);
  }
  const results = [];
  for (const source of candidates) {
    try {
      const draw = await ingestSource(project, source.url, { type: 'source' });
      results.push({ id: source.id, title: source.title, url: source.url, ok: true, saved: draw.saved });
    } catch (error) {
      results.push({ id: source.id, title: source.title, url: source.url, ok: false, error: error.message });
    }
  }
  const anyOk = results.some((item) => item.ok);
  return {
    ok: anyOk,
    action: 'discover',
    topic: topic || 'all',
    count: results.length,
    results,
    ...(anyOk ? {} : { hint: 'all source fetches failed; discover needs outbound network access to the catalog source URLs' }),
  };
}

