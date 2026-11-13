// Source ingestion/search entry point: validate URLs, parse pages, map provider
// results into idea cards and save them. Network/SSRF guards live in
// ./sources/net.js, HTML and provider card mapping in ./sources/cards.js.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, nowIso } from './util.js';
import { saveImportedIdeas } from './store.js';
import { fetchDocument, fetchJson } from './sources/net.js';
import {
  buildGraph, extractHeadings, extractKeywords, extractLinks, extractTitle,
  gutenbergCard, htmlToText, metaContent, wikipediaCards,
} from './sources/cards.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
