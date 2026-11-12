import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ensureDir, readJson, readText, writeJsonAtomic, writeTextAtomic,
  resolveProjectDir, nowIso, stamp, deepMerge, safeSegment, parseJson,
} from './util.js';
import { checkCandidate, checkProject, outlineIndex } from './schema.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function initProject(options) {
  const name = String(options.name || '').trim();
  if (!name) throw new Error('book name is required');
  const parts = Number(options.parts || 1);
  const volumes = Number(options.volumes || 1);
  const chapters = Number(options.chapter || options.chapters || 20);
  const targetChars = Number(options.chapterChars || 3000);
  const minChars = Number(options.minChars || 1800);
  if (parts <= 0 || volumes <= 0 || chapters <= 0) {
    throw new Error('--parts, --volumes and --chapter must be positive');
  }
  if (targetChars <= 0 || minChars <= 0 || minChars > targetChars) {
    throw new Error('--chapter-chars must be positive and >= --min-chars');
  }
  const dir = path.resolve(options.dir || name);
  if (fs.existsSync(path.join(dir, 'novel.json'))) {
    throw new Error(`a Wishmachine project already exists at ${dir}`);
  }
  ensureDir(dir);
  const now = nowIso();
  const config = {
    name,
    version: '1.0.0',
    created_at: now,
    updated_at: now,
    language: options.language || 'zh',
    genres: options.genre ? String(options.genre).split(',').map((s) => s.trim()).filter(Boolean) : ['未分类'],
    structure: {
      target_parts: parts,
      target_volumes: volumes,
      target_chapters: chapters,
    },
    chapter_config: {
      target_chars: targetChars,
      min_chars: minChars,
    },
  };
  for (const sub of ['story/setup', 'story/compose', 'story/craft', 'story/reviews', 'story/ideas', 'story/research', 'chapters', 'drafts', 'logs']) {
    ensureDir(path.join(dir, sub));
  }
  writeJsonAtomic(path.join(dir, 'novel.json'), config);
  writeTextAtomic(path.join(dir, 'story', 'setup', 'story_setup.md'), setupPlaceholder(name, config.genres));
  return { dir, config };
}

function setupPlaceholder(name, genres) {
  return `# ${name}\n\n## Story Setup\n\n### Genre(s)\n${genres.map((g) => `- ${g}`).join('\n')}\n\n### Core Premise\n(待填写)\n\n### Theme\n(待填写)\n\n### Story Rules/Constraints\n- (待填写)\n`;
}

export function loadProject(explicit) {
  const dir = resolveProjectDir(explicit);
  const configFile = path.join(dir, 'novel.json');
  if (!fs.existsSync(configFile)) {
    throw new Error(`no novel.json found at ${dir}; run book init first`);
  }
  const config = readJson(configFile);
  const structure = config.structure || {};
  config.structure = {
    target_parts: Number(structure.target_parts ?? config.target_parts ?? 1),
    target_volumes: Number(structure.target_volumes ?? config.target_volumes ?? 1),
    target_chapters: Number(structure.target_chapters ?? config.target_chapters ?? config.chapter_count ?? 20),
  };
  const chapterConfig = config.chapter_config || {};
  config.chapter_config = {
    target_chars: Number(chapterConfig.target_chars ?? config.target_chars ?? 3000),
    min_chars: Number(chapterConfig.min_chars ?? config.min_chars ?? 1800),
  };
  return { dir, config };
}

export function projectStatus(project) {
  const config = project.config;
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  const setup = fs.existsSync(setupFile);
  const outline = fs.existsSync(outlineFile) ? readJson(outlineFile) : null;
  const chapters = [];
  if (outline) {
    for (const part of outline.parts || []) {
      for (const volume of part.volumes || []) {
        for (const chapter of volume.chapters || []) {
          chapters.push({
            id: chapter.id,
            title: chapter.title,
            volume_id: volume.id,
            written: fs.existsSync(path.join(project.dir, 'chapters', `${chapter.id}.md`)),
          });
        }
      }
    }
  }
  let next;
  if (!setup) {
    next = { stage: 'setup', targetId: 'setup', reason: '故事设定尚未生成。' };
  } else if (!outline) {
    next = { stage: 'outline', targetId: 'outline', reason: '大纲尚未生成。' };
  } else {
    const unwritten = chapters.find((chapter) => !chapter.written);
    next = unwritten
      ? { stage: 'write', targetId: `chapter:${unwritten.id}`, reason: '仍有章节未写正文。' }
      : { stage: 'complete', targetId: '', reason: '全部章节已写正文。' };
  }
  const chapterDir = path.join(project.dir, 'chapters');
  const chapterFiles = fs.existsSync(chapterDir)
    ? fs.readdirSync(chapterDir).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3)).sort()
    : [];
  const knownChapterIds = new Set(chapters.map((chapter) => chapter.id));
  const orphanChapters = chapterFiles.filter((id) => !knownChapterIds.has(id));
  const recapDir = path.join(project.dir, 'story', 'recaps');
  const recapFiles = fs.existsSync(recapDir)
    ? fs.readdirSync(recapDir).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)).sort()
    : [];
  const orphanRecaps = recapFiles.filter((id) => !knownChapterIds.has(id));
  return {
    name: config.name,
    root: project.dir,
    setup,
    structure: config.structure,
    chapter_config: config.chapter_config,
    outline: outline ? {
      parts: outline.parts?.length || 0,
      volumes: (outline.parts || []).reduce((n, p) => n + (p.volumes?.length || 0), 0),
      chapters: (outline.parts || []).reduce((n, p) => n + (p.volumes || []).reduce((m, v) => m + (v.chapters?.length || 0), 0), 0),
    } : { parts: 0, volumes: 0, chapters: 0 },
    chapters,
    orphan_chapters: orphanChapters,
    orphan_recaps: orphanRecaps,
    next,
  };
}

export function cleanRegistry(project, options = {}) {
  const docs = loadRegistryDocs(project);
  if (!docs) throw new Error('setup and outline are required before cleaning registries');
  const expected = collectOutlineMysteryRegistry(docs.outline);
  const before = (Array.isArray(docs.outline.mystery_registry) ? docs.outline.mystery_registry.length : 0)
    + (Array.isArray(docs.setup.mystery_registry) ? docs.setup.mystery_registry.length : 0);
  if (options.dryRun) {
    return {
      ok: true,
      action: 'clean-dry-run',
      before,
      after: expected.length * 2,
      entries: expected.length,
      dryRun: true,
    };
  }
  docs.setup.mystery_registry = expected;
  docs.outline.mystery_registry = expected;
  docs.setup.mystery_registry_version = 2;
  docs.outline.mystery_registry_version = 2;
  writeJsonAtomic(docs.setupFile, docs.setup);
  writeJsonAtomic(docs.outlineFile, docs.outline);
  return {
    ok: true,
    action: 'clean',
    before,
    after: expected.length * 2,
    entries: expected.length,
    dryRun: false,
  };
}

export function projectRegistryStatus(project) {
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  if (!fs.existsSync(setupFile) && !fs.existsSync(outlineFile)) {
    return { ok: false, reason: 'setup and outline are missing' };
  }
  const setup = fs.existsSync(setupFile) ? readJson(setupFile) : {};
  const outline = fs.existsSync(outlineFile) ? readJson(outlineFile) : {};
  const summarize = (threads, mysteries) => {
    const threadStatus = {};
    for (const thread of threads) threadStatus[thread.status || 'unknown'] = (threadStatus[thread.status || 'unknown'] || 0) + 1;
    const mysteryStatus = {};
    for (const mystery of mysteries) mysteryStatus[mystery.status || 'unknown'] = (mysteryStatus[mystery.status || 'unknown'] || 0) + 1;
    return {
      thread_count: threads.length,
      mystery_count: mysteries.length,
      thread_status: threadStatus,
      mystery_status: mysteryStatus,
    };
  };
  const setupThreads = Array.isArray(setup.thread_registry) ? setup.thread_registry : [];
  const setupMysteries = Array.isArray(setup.mystery_registry) ? setup.mystery_registry : [];
  const outlineThreads = Array.isArray(outline.thread_registry) ? outline.thread_registry : [];
  const outlineMysteries = Array.isArray(outline.mystery_registry) ? outline.mystery_registry : [];
  const check = checkProject(project, { profile: 'schema', target: 'outline' });
  const drift = (check.findings || []).filter((finding) => (
    String(finding.rule_id || '').startsWith('quality.thread.')
    || String(finding.rule_id || '').startsWith('quality.mystery.')
    || String(finding.rule_id || '').startsWith('quality.setup.')
  ));
  return {
    ok: drift.length === 0,
    setup: {
      thread_registry_version: setup.thread_registry_version ?? null,
      mystery_registry_version: setup.mystery_registry_version ?? null,
      ...summarize(setupThreads, setupMysteries),
    },
    outline: {
      thread_registry_version: outline.thread_registry_version ?? null,
      mystery_registry_version: outline.mystery_registry_version ?? null,
      ...summarize(outlineThreads, outlineMysteries),
    },
    drift,
  };
}

export function saveImportedIdeas(project, payload, options = {}) {
  const raw = Array.isArray(payload) ? { results: payload } : payload;
  if (!raw || !Array.isArray(raw.results) || raw.results.length === 0) {
    throw new Error('ideas import expects an array or an object with a non-empty results array');
  }
  for (const [index, card] of raw.results.entries()) {
    if (!card || typeof card !== 'object' || Array.isArray(card)) {
      throw new Error(`ideas import item ${index + 1} must be an object`);
    }
    if (!card.title && !card.name) {
      throw new Error(`ideas import item ${index + 1} needs a title or name`);
    }
    const graph = card.graph;
    if (graph) {
      if (!Array.isArray(graph.entities) || !Array.isArray(graph.relations)) {
        throw new Error(`ideas import item ${index + 1} graph needs entities and relations arrays`);
      }
      const ids = new Set();
      for (const entity of graph.entities) {
        if (!entity?.id || !entity?.type || !entity?.label) {
          throw new Error(`ideas import item ${index + 1} graph entity needs id, type and label`);
        }
        ids.add(entity.id);
      }
      for (const relation of graph.relations) {
        if (!relation?.from || !relation?.to || !ids.has(relation.from) || !ids.has(relation.to)) {
          throw new Error(`ideas import item ${index + 1} graph relation references a missing entity`);
        }
      }
    }
  }
  const type = options.type || raw.type || 'reference';
  const results = raw.results.map((item) => ({
    ...item,
    source: item.source || options.source || '',
    imported_at: nowIso(),
  }));
  const draw = {
    ok: true,
    section: 'ideas',
    query: {
      type,
      genre: options.genre || '',
      source: options.source || '',
      imported: true,
      count: results.length,
    },
    count: results.length,
    results,
    meta: {
      deck: 'imported',
      source: options.source || '',
      usage: [
        'Imported cards are references, not canon.',
        'Check source and period before turning them into setup/outline facts.',
      ],
    },
  };
  const id = `import-${stamp()}`;
  const dir = path.join(project.dir, 'story', 'ideas');
  ensureDir(dir);
  const file = path.join(dir, `${id}.json`);
  writeJsonAtomic(file, draw);
  return { ...draw, saved: { id, path: path.relative(project.dir, file).replace(/\\/g, '/') } };
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

export async function ingestSource(project, url, options = {}) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`invalid source URL: ${url}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('source URL must use http or https');
  }
  const response = await fetch(parsed.href, {
    redirect: 'follow',
    headers: { 'user-agent': 'Wishmachine/0.1 (source ingest)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) {
    throw new Error(`source fetch failed: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || parsed.hostname).trim();
  const meta = (name) => {
    const pattern = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([\\s\\S]*?)["']`, 'i');
    return decodeHtml(html.match(pattern)?.[1] || '').trim();
  };
  const description = meta('description') || meta('og:description');
  const keywordText = meta('keywords');
  const text = decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
  const keywords = keywordText
    ? keywordText.split(/[,，;；]/).map((item) => item.trim()).filter(Boolean).slice(0, 12)
    : [...new Set(title.split(/[\s:：·\-—]+/).filter((item) => item.length >= 2))].slice(0, 8);
  const headings = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => decodeHtml(match[1].replace(/<[^>]+>/g, '')).trim())
    .filter(Boolean)
    .slice(0, 20);
  const linkMap = new Map();
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const label = decodeHtml(match[2].replace(/<[^>]+>/g, '')).trim();
    if (!label) continue;
    let href;
    try {
      href = new URL(decodeHtml(match[1]), parsed).href;
    } catch {
      continue;
    }
    if (!/^https?:/i.test(href)) continue;
    if (!linkMap.has(href)) linkMap.set(href, label);
    if (linkMap.size >= 30) break;
  }
  const sourceId = `source:${parsed.href}`;
  const entities = [
    { id: sourceId, type: 'source', label: title },
    ...headings.map((label, index) => ({ id: `source:heading-${index + 1}`, type: 'heading', label })),
    ...[...linkMap.entries()].map(([url, label], index) => ({
      id: `source:link-${index + 1}`,
      type: 'link',
      label,
      url,
    })),
  ];
  const relations = [
    ...headings.map((label, index) => ({
      from: sourceId,
      to: `source:heading-${index + 1}`,
      type: 'mentions',
    })),
    ...[...linkMap.entries()].map(([url, label], index) => ({
      from: sourceId,
      to: `source:link-${index + 1}`,
      type: 'links_to',
    })),
  ];
  const links = [...linkMap.entries()].map(([url, label]) => ({ label, url }));
  const card = {
    title,
    type: 'web-source',
    source: parsed.href,
    source_url: parsed.href,
    retrieved_at: nowIso(),
    description,
    keywords,
    headings,
    links,
    entities,
    graph: { entities, relations },
    excerpt: text.slice(0, 4000),
  };
  return saveImportedIdeas(project, { results: [card] }, {
    type: options.type || 'source',
    source: parsed.href,
  });
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { 'user-agent': 'Wishmachine/0.1 (source search)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`search request failed: ${response.status} ${response.statusText}`);
  return response.json();
}

export async function searchSources(project, options = {}) {
  const provider = String(options.provider || 'wikipedia').toLowerCase();
  const query = String(options.query || '').trim();
  if (!query) throw new Error('ideas search requires a query');
  const limit = Math.max(1, Math.min(10, Number(options.limit) || 3));
  if (provider === 'wikipedia') {
    const host = /[\u3400-\u9fff]/.test(query) ? 'zh.wikipedia.org' : 'en.wikipedia.org';
    const endpoint = `https://${host}/w/api.php?action=opensearch&format=json&limit=${limit}&search=${encodeURIComponent(query)}`;
    const data = await fetchJson(endpoint);
    const titles = Array.isArray(data?.[1]) ? data[1] : [];
    const snippets = Array.isArray(data?.[2]) ? data[2] : [];
    const urls = Array.isArray(data?.[3]) ? data[3] : [];
    const cards = titles.map((title, index) => ({
      title,
      type: 'web-source',
      provider: 'wikipedia',
      query,
      source: urls[index] || '',
      source_url: urls[index] || '',
      description: snippets[index] || '',
      keywords: [query].filter(Boolean),
      excerpt: snippets[index] || '',
      entities: [{ id: `wikipedia:${encodeURIComponent(title)}`, type: 'topic', label: title }],
      graph: {
        entities: [{ id: `wikipedia:${encodeURIComponent(title)}`, type: 'topic', label: title }],
        relations: [],
      },
    }));
    const saved = [];
    if (options.ingest) {
      for (const card of cards) {
        try {
          saved.push((await ingestSource(project, card.source_url, { type: 'source' })).saved);
        } catch (error) {
          saved.push({ error: error.message, url: card.source_url });
        }
      }
    } else if (cards.length) {
      const draw = saveImportedIdeas(project, { results: cards }, { type: 'source', source: 'wikipedia' });
      saved.push(draw.saved);
    }
    return { ok: true, action: 'search', provider, query, count: cards.length, results: cards, saved };
  }
  if (provider === 'gutenberg') {
    const endpoint = `https://gutendex.com/books/?search=${encodeURIComponent(query)}`;
    const data = await fetchJson(endpoint);
    const books = (data?.results || []).slice(0, limit);
    const cards = books.map((book) => {
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
    });
    const draw = cards.length
      ? saveImportedIdeas(project, { results: cards }, { type: 'source', source: 'gutenberg' })
      : null;
    return { ok: true, action: 'search', provider, query, count: cards.length, results: cards, saved: draw ? [draw.saved] : [] };
  }
  throw new Error(`unsupported source provider: ${provider}; use wikipedia or gutenberg`);
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
      results.push({
        id: source.id,
        title: source.title,
        url: source.url,
        ok: true,
        saved: draw.saved,
      });
    } catch (error) {
      results.push({
        id: source.id,
        title: source.title,
        url: source.url,
        ok: false,
        error: error.message,
      });
    }
  }
  return {
    ok: results.some((item) => item.ok),
    action: 'discover',
    topic: topic || 'all',
    count: results.length,
    results,
  };
}

export function buildProjectGraph(project) {
  const dir = path.join(project.dir, 'story', 'ideas');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort() : [];
  const entities = new Map();
  const relations = new Map();
  const keywordCounts = new Map();
  const findings = [];
  let cards = 0;
  for (const file of files) {
    let draw;
    try {
      draw = readJson(path.join(dir, file));
    } catch {
      findings.push({
        rule_id: 'graph.invalid_draw',
        severity: 'high',
        target_id: file,
        issue: 'saved idea draw is not valid JSON',
        suggestion: 'Re-export or remove the broken draw.',
      });
      continue;
    }
    for (const card of draw.results || []) {
      cards += 1;
      for (const keyword of card.keywords || []) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
      for (const entity of card.graph?.entities || card.entities || []) {
        if (!entity?.id) continue;
        const existing = entities.get(entity.id);
        if (existing && existing.label !== entity.label) {
          findings.push({
            rule_id: 'graph.entity_conflict',
            severity: 'medium',
            target_id: entity.id,
            issue: `entity ${entity.id} has conflicting labels: ${existing.label} / ${entity.label}`,
            suggestion: 'Rename one entity or merge it explicitly.',
          });
        } else {
          entities.set(entity.id, { ...entity, draw: file });
        }
      }
      for (const relation of card.graph?.relations || card.relations || []) {
        if (!relation?.from || !relation?.to) continue;
        const key = `${relation.from}|${relation.type || 'related_to'}|${relation.to}`;
        if (!relations.has(key)) relations.set(key, { ...relation, type: relation.type || 'related_to', draw: file });
      }
    }
  }
  for (const relation of relations.values()) {
    if (!entities.has(relation.from) || !entities.has(relation.to)) {
      findings.push({
        rule_id: 'graph.dangling_relation',
        severity: 'high',
        target_id: relation.from || relation.to,
        issue: `relation ${relation.from} -> ${relation.to} references a missing entity`,
        suggestion: 'Add the missing entity or remove the relation before using this graph.',
      });
    }
  }
  const keywords = [...keywordCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([keyword, count]) => ({ keyword, count }));
  const labels = [...entities.values()].slice(0, 12).map((entity) => entity.label);
  const prompt = [...new Set([...labels, ...keywords.slice(0, 12).map((item) => item.keyword)])].join('；');
  const blocking = findings.some((finding) => finding.severity === 'high' || finding.severity === 'critical');
  return {
    ok: !blocking,
    blocking,
    draws: files.length,
    cards,
    counts: {
      entities: entities.size,
      relations: relations.size,
      keywords: keywords.length,
    },
    entities: [...entities.values()],
    relations: [...relations.values()],
    keywords,
    prompt,
    findings,
  };
}

export function saveResearchReport(project, id, report) {
  if (!id) throw new Error('research report requires an id');
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('research report must be a JSON object');
  }
  const dir = path.join(project.dir, 'story', 'research');
  ensureDir(dir);
  const file = path.join(dir, `${safeSegment(id)}.json`);
  writeJsonAtomic(file, report);
  return {
    ok: true,
    action: 'research',
    id: safeSegment(id),
    path: path.relative(project.dir, file).replace(/\\/g, '/'),
  };
}

export function saveIdeaDraw(project, draw) {
  const type = String(draw?.query?.type || 'ideas');
  const seed = draw?.query?.seed || 0;
  const id = `${type}-${seed}-${stamp()}`;
  const dir = path.join(project.dir, 'story', 'ideas');
  ensureDir(dir);
  const file = path.join(dir, `${id}.json`);
  writeJsonAtomic(file, draw);
  return {
    ...draw,
    saved: {
      id,
      path: path.relative(project.dir, file).replace(/\\/g, '/'),
    },
  };
}

export function projectState(project, options = {}) {
  const status = projectStatus(project);
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  const setup = fs.existsSync(setupFile) ? readJson(setupFile) : null;
  const outline = fs.existsSync(outlineFile) ? readJson(outlineFile) : null;
  const craftDir = path.join(project.dir, 'story', 'craft');
  const recapDir = path.join(project.dir, 'story', 'recaps');
  const files = (dir) => fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort().map((name) => ({
      name: name.slice(0, -5),
      size: fs.statSync(path.join(dir, name)).size,
    }))
    : [];
  const view = options.view === 'full' ? 'full' : 'brief';
  const clip = (text, max) => {
    const value = String(text || '');
    return value.length > max ? `${value.slice(0, max)}…` : value;
  };
  const orphanChapters = status.orphan_chapters || [];
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
    orphan_chapters: orphanChapters,
    orphan_recaps: status.orphan_recaps || [],
    ideas: files(path.join(project.dir, 'story', 'ideas')),
    research: files(path.join(project.dir, 'story', 'research')),
    graph: (() => {
      const graph = buildProjectGraph(project);
      return { draws: graph.draws, cards: graph.cards, counts: graph.counts, blocking: graph.blocking };
    })(),
    craft: files(craftDir),
    recaps: files(recapDir),
    next: status.next,
  };
  if (view === 'full') {
    state.setup_full = setup;
    state.outline_full = outline;
  }
  return { ok: true, view, state };
}

export function auditProject(project, options = {}) {
  const targets = [];
  const maxFindings = options.maxFindings || 0;
  const minSeverity = options.minSeverity;
  const view = options.view === 'full' ? 'full' : 'brief';
  const add = (target, id) => {
    try {
      const result = checkProject(project, {
        profile: 'all',
        target,
        id,
        minSeverity,
        maxFindings,
      });
      targets.push({
        target,
        id: id || undefined,
        ok: result.ok,
        blocking: result.blocking,
        score: result.score,
        summary: result.summary,
        findings: result.findings,
      });
    } catch (error) {
      targets.push({
        target,
        id: id || undefined,
        ok: false,
        blocking: true,
        score: 0,
        summary: { total: 1, critical: 1, high: 0, medium: 0, low: 0 },
        findings: [{
          rule_id: 'audit.error',
          severity: 'critical',
          target_id: id || target,
          issue: error.message,
          suggestion: '',
        }],
      });
    }
  };
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  if (fs.existsSync(setupFile)) add('setup');
  if (fs.existsSync(outlineFile)) add('outline');
  const files = (dir, ext) => fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((name) => name.endsWith(ext)).sort()
    : [];
  for (const name of files(path.join(project.dir, 'story', 'craft'), '.json')) {
    add('craft', name.slice(0, -5));
  }
  for (const name of files(path.join(project.dir, 'story', 'recaps'), '.json')) {
    add('recap', name.slice(0, -5));
  }
  const chapterDir = path.join(project.dir, 'chapters');
  const writtenChapters = fs.existsSync(chapterDir)
    ? fs.readdirSync(chapterDir).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3)).sort()
    : [];
  const known = new Set(projectStatus(project).chapters.filter((item) => item.written).map((item) => item.id));
  for (const id of writtenChapters) {
    if (!known.has(id)) add('chapter', id);
  }
  for (const chapter of projectStatus(project).chapters.filter((item) => item.written)) {
    add('chapter', chapter.id);
  }
  const summary = { total: 0, critical: 0, high: 0, medium: 0, low: 0 };
  for (const target of targets) {
    for (const key of Object.keys(summary)) summary[key] += target.summary[key] || 0;
  }
  const blocking = targets.some((target) => target.blocking);
  const allFindings = targets.flatMap((target) => target.findings.map((item) => ({
    ...item,
    audit_target: target.target,
  })));
  return {
    ok: !blocking,
    blocking,
    view,
    root: project.dir,
    name: project.config.name,
    summary,
    top_findings: allFindings.slice(0, 10),
    targets: view === 'full'
      ? targets
      : targets.map(({ findings, ...target }) => target),
  };
}

export function refreshProject(project, options = {}) {
  const target = options.target || 'all';
  if (!['all', 'setup', 'outline'].includes(target)) {
    throw new Error(`unsupported refresh target: ${target}`);
  }
  const refreshed = [];
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  if ((target === 'all' || target === 'setup') && fs.existsSync(setupFile)) {
    writeTextAtomic(path.join(project.dir, 'story', 'setup', 'story_setup.md'), setupMarkdown(readJson(setupFile)));
    refreshed.push('story/setup/story_setup.md');
  }
  if ((target === 'all' || target === 'outline') && fs.existsSync(outlineFile)) {
    writeTextAtomic(path.join(project.dir, 'story', 'compose', 'outline.md'), outlineMarkdown(readJson(outlineFile)));
    refreshed.push('story/compose/outline.md');
  }
  return { ok: true, action: 'refresh', target, refreshed };
}

export function exportManuscript(project, options = {}) {
  const status = projectStatus(project);
  const format = options.format === 'plain' ? 'plain' : 'book';
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  const setup = fs.existsSync(setupFile) ? readJson(setupFile) : null;
  const outline = fs.existsSync(outlineFile) ? readJson(outlineFile) : null;
  const ordered = [
    ...status.chapters.filter((chapter) => chapter.written).map((chapter) => chapter.id),
    ...status.orphan_chapters,
  ];
  const unique = [...new Set(ordered)];
  const written = new Set(unique);
  const chapterInfo = new Map();
  for (const part of outline?.parts || []) {
    for (const volume of part.volumes || []) {
      for (const chapter of volume.chapters || []) {
        chapterInfo.set(chapter.id, { chapter, volume });
      }
    }
  }
  const stripTitle = (text) => String(text).replace(/^#\s+.*(?:\r?\n)+/, '').trim();
  const chunks = [];
  let chapters = 0;

  if (format === 'book' && setup && outline) {
    const genres = (setup.genres || []).join(' · ');
    const total = unique.length;
    chunks.push(`# ${status.name}`, '');
    if (genres) chunks.push(`> ${genres}　|　全${total}章`, '');
    if (setup.premise) chunks.push('## 内容简介', '', String(setup.premise), '');
    if (setup.theme) chunks.push('## 主题', '', String(setup.theme), '');
    chunks.push('## 目录', '');
    let number = 0;
    for (const part of outline.parts || []) {
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
    if (setup.core_cast?.length) {
      chunks.push('## 主要人物', '');
      for (const character of setup.core_cast) {
        const role = character.role === 'protagonist' ? '主角' : character.role === 'antagonist' ? '对手' : '同行者';
        chunks.push(`- **${character.name}**（${role}）：${character.story_function || ''}`);
      }
      chunks.push('');
    }
    if (setup.rules?.length) {
      chunks.push('## 规则速览', '');
      for (const rule of setup.rules.slice(0, 8)) chunks.push(`- ${rule}`);
      chunks.push('');
    }
    chunks.push('---', '');
    let currentVolume = '';
    for (const id of unique) {
      const file = path.join(project.dir, 'chapters', `${id}.md`);
      if (!fs.existsSync(file)) continue;
      const info = chapterInfo.get(id);
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
  } else {
    chunks.push(`# ${status.name}`, '', '> 由小说许愿机从 chapters/ 导出。', '');
    for (const id of unique) {
      const file = path.join(project.dir, 'chapters', `${id}.md`);
      if (!fs.existsSync(file)) continue;
      chunks.push('---', '', readText(file).trimEnd(), '');
      chapters += 1;
    }
  }

  const content = `${chunks.join('\n').trimEnd()}\n`;
  const output = path.resolve(project.dir, options.output || path.join('drafts', 'manuscript.md'));
  ensureDir(path.dirname(output));
  writeTextAtomic(output, content);
  return {
    ok: true,
    action: 'export',
    format,
    output,
    chapters,
    bytes: Buffer.byteLength(content, 'utf8'),
  };
}

function outlineChapters(outline) {
  const chapters = [];
  for (const part of outline?.parts || []) {
    for (const volume of part.volumes || []) {
      chapters.push(...(volume.chapters || []));
    }
  }
  return chapters;
}

function collectOutlineMysteryRegistry(outline) {
  const registry = new Map();
  const priority = { open: 0, dropped: 1, resolved: 2 };
  const add = (mystery, chapterId, source) => {
    if (!mystery?.id) return;
    const existing = registry.get(mystery.id);
    if (existing && (priority[existing.status] || 0) >= (priority[mystery.status] || 0)) return;
    registry.set(mystery.id, { ...mystery, chapter_id: chapterId, source });
  };
  for (const chapter of outlineChapters(outline)) {
    for (const key of ['carried', 'planted', 'resolved', 'dropped']) {
      for (const mystery of chapter.mysteries?.[key] || []) add(mystery, chapter.id, `chapter.${key}`);
    }
    for (const scene of chapter.scenes || []) {
      for (const key of ['planted', 'resolved']) {
        for (const mystery of scene.mysteries?.[key] || []) add(mystery, chapter.id, `scene.${key}`);
      }
    }
  }
  return [...registry.values()].sort((left, right) => (
    String(left.chapter_id || '').localeCompare(String(right.chapter_id || ''), undefined, { numeric: true })
    || String(left.id || '').localeCompare(String(right.id || ''), undefined, { numeric: true })
  ));
}

function needsThreadMigration(project) {
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  if (!fs.existsSync(setupFile) || !fs.existsSync(outlineFile)) return false;
  let setup;
  let outline;
  try {
    setup = readJson(setupFile);
    outline = readJson(outlineFile);
  } catch {
    return false;
  }
  const setupRegistry = Array.isArray(setup.thread_registry) ? setup.thread_registry : null;
  const outlineRegistry = Array.isArray(outline.thread_registry) ? outline.thread_registry : null;
  if (!setupRegistry || !outlineRegistry) return true;
  if (JSON.stringify(setupRegistry) !== JSON.stringify(outlineRegistry)) return true;
  if ((setup.storylines || []).some((storyline) => !storyline.thread_id)) return true;
  if (outlineChapters(outline).some((chapter) => !chapter.thread_id)) return true;
  if (setup.thread_registry_version !== 2 || outline.thread_registry_version !== 2) return true;
  if (setup.mystery_registry_version !== 2 || outline.mystery_registry_version !== 2) return true;
  const expectedMysteries = collectOutlineMysteryRegistry(outline);
  const hasMysteryRegistry = Array.isArray(setup.mystery_registry) || Array.isArray(outline.mystery_registry);
  if (hasMysteryRegistry || expectedMysteries.length > 0) {
    if (!Array.isArray(setup.mystery_registry) || !Array.isArray(outline.mystery_registry)) return true;
    if (JSON.stringify(setup.mystery_registry) !== JSON.stringify(expectedMysteries)) return true;
    if (JSON.stringify(outline.mystery_registry) !== JSON.stringify(expectedMysteries)) return true;
  }
  return false;
}

function migrateThreadRegistry(project) {
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  if (!fs.existsSync(setupFile) || !fs.existsSync(outlineFile)) return null;
  let setup;
  let outline;
  try {
    setup = readJson(setupFile);
    outline = readJson(outlineFile);
  } catch {
    return null;
  }
  const setupRegistry = Array.isArray(setup.thread_registry) ? setup.thread_registry : null;
  const outlineRegistry = Array.isArray(outline.thread_registry) ? outline.thread_registry : null;
  const storylines = Array.isArray(setup.storylines) ? setup.storylines : [];
  const baseRegistry = setupRegistry || outlineRegistry || storylines.map((storyline, index) => ({
    id: storyline.thread_id || `thread-${index + 1}`,
    name: storyline.name || `storyline ${index + 1}`,
    type: index === 0 ? 'main' : 'subplot',
    importance: index === 0 ? 10 : 6,
    status: 'active',
    resolved_in: null,
  }));
  const outlineById = new Map((outlineRegistry || []).map((thread) => [thread.id, thread]));
  const registry = baseRegistry.map((thread) => {
    const outlineThread = outlineById.get(thread.id);
    if (outlineThread?.status === 'resolved' && outlineThread.resolved_in) {
      return { ...thread, status: 'resolved', resolved_in: outlineThread.resolved_in };
    }
    return thread;
  });
  for (const thread of outlineRegistry || []) {
    if (!registry.some((item) => item.id === thread.id)) registry.push(thread);
  }
  if (!registry.length) return null;
  const mainThreadId = registry[0].id;
  let changed = false;
  if (JSON.stringify(setup.thread_registry) !== JSON.stringify(registry)) {
    setup.thread_registry = registry;
    changed = true;
  }
  if (JSON.stringify(outline.thread_registry) !== JSON.stringify(registry)) {
    outline.thread_registry = registry;
    changed = true;
  }
  if (setup.thread_registry_version !== 2) {
    setup.thread_registry_version = 2;
    changed = true;
  }
  if (outline.thread_registry_version !== 2) {
    outline.thread_registry_version = 2;
    changed = true;
  }
  if (setup.mystery_registry_version !== 2) {
    setup.mystery_registry_version = 2;
    changed = true;
  }
  if (outline.mystery_registry_version !== 2) {
    outline.mystery_registry_version = 2;
    changed = true;
  }
  setup.storylines = storylines.map((storyline, index) => {
    const threadId = storyline.thread_id || registry[index]?.id || mainThreadId;
    if (threadId !== storyline.thread_id) changed = true;
    return { ...storyline, thread_id: threadId };
  });
  let chapterCount = 0;
  for (const chapter of outlineChapters(outline)) {
    if (!chapter.thread_id) {
      const text = `${chapter.title || ''} ${chapter.summary || ''} ${chapter.conflict || ''}`;
      const matching = registry.find((thread) => thread.name && text.includes(thread.name));
      chapter.thread_id = matching?.id || mainThreadId;
      chapterCount += 1;
      changed = true;
    }
  }
  const expectedMysteries = collectOutlineMysteryRegistry(outline);
  let mysteryCount = 0;
  const hasMysteryRegistry = Array.isArray(setup.mystery_registry) || Array.isArray(outline.mystery_registry);
  if (expectedMysteries.length > 0 || hasMysteryRegistry) {
    if (JSON.stringify(setup.mystery_registry) !== JSON.stringify(expectedMysteries)) {
      setup.mystery_registry = expectedMysteries;
      changed = true;
    }
    if (JSON.stringify(outline.mystery_registry) !== JSON.stringify(expectedMysteries)) {
      outline.mystery_registry = expectedMysteries;
      changed = true;
    }
    mysteryCount = expectedMysteries.length;
  }
  if (!changed) return null;
  writeJsonAtomic(setupFile, setup);
  writeJsonAtomic(outlineFile, outline);
  return {
    registry,
    actions: [
      'migrated setup.thread_registry',
      'migrated outline.thread_registry',
      ...(mysteryCount ? [`synced ${mysteryCount} mystery registry entries`] : []),
      ...(chapterCount ? [`filled ${chapterCount} chapter thread_id values`] : []),
    ],
  };
}

function loadRegistryDocs(project) {
  const setupFile = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlineFile = path.join(project.dir, 'story', 'compose', 'outline.json');
  if (!fs.existsSync(setupFile) || !fs.existsSync(outlineFile)) return null;
  try {
    return {
      setupFile,
      outlineFile,
      setup: readJson(setupFile),
      outline: readJson(outlineFile),
    };
  } catch {
    return null;
  }
}

function chapterResolvedMysteries(chapter) {
  return [
    ...(chapter.mysteries?.resolved || []),
    ...(chapter.scenes || []).flatMap((scene) => scene.mysteries?.resolved || []),
  ];
}

function threadResolutionChapters(outline) {
  const map = new Map();
  for (const chapter of outlineChapters(outline)) {
    for (const mystery of chapterResolvedMysteries(chapter)) {
      if (!mystery?.thread_id) continue;
      if (!map.has(mystery.thread_id)) map.set(mystery.thread_id, []);
      if (!map.get(mystery.thread_id).includes(chapter.id)) map.get(mystery.thread_id).push(chapter.id);
    }
  }
  return map;
}

function sameArray(left, right) {
  return JSON.stringify(left || []) === JSON.stringify(right || []);
}

function needsThreadStatusRepair(project) {
  const docs = loadRegistryDocs(project);
  if (!docs) return false;
  const setupRegistry = Array.isArray(docs.setup.thread_registry) ? docs.setup.thread_registry : [];
  const outlineRegistry = Array.isArray(docs.outline.thread_registry) ? docs.outline.thread_registry : [];
  if (!setupRegistry.length || !outlineRegistry.length) return false;
  const resolvedChapters = threadResolutionChapters(docs.outline);
  const resolvedMysteries = new Map();
  for (const chapter of outlineChapters(docs.outline)) {
    for (const mystery of chapterResolvedMysteries(chapter)) {
      if (!mystery?.thread_id) continue;
      if (!resolvedMysteries.has(mystery.thread_id)) resolvedMysteries.set(mystery.thread_id, []);
      resolvedMysteries.get(mystery.thread_id).push({ id: mystery.id, chapter_id: chapter.id });
    }
  }
  const droppedMysteries = Array.isArray(docs.outline.dropped_mysteries) ? docs.outline.dropped_mysteries : [];
  const abandoned = new Set((docs.outline.abandoned_threads || []).map((item) => item.thread_id));
  return [...setupRegistry, ...outlineRegistry].some((thread) => {
    const chapters = resolvedChapters.get(thread.id) || [];
    const hasResolution = chapters.length > 0;
    const listed = abandoned.has(thread.id);
    const expectedIn = hasResolution ? chapters[chapters.length - 1] : null;
    const expectedMysteries = resolvedMysteries.get(thread.id) || [];
    const expectedAbandoned = droppedMysteries
      .filter((mystery) => mystery.thread_id === thread.id)
      .map((mystery) => ({ id: mystery.id, chapter_id: mystery.dropped_in, question: mystery.question }));
    return (thread.status === 'active' && hasResolution)
      || (thread.status === 'resolved' && !hasResolution)
      || (thread.status === 'abandoned' && !listed)
      || (thread.status === 'abandoned' && hasResolution)
      || (thread.resolved_in || null) !== expectedIn
      || !sameArray(thread.resolved_chapters, chapters)
      || !sameArray(thread.resolved_mysteries, expectedMysteries)
      || !sameArray(thread.abandoned_mysteries, expectedAbandoned)
      || Boolean(thread.abandoned_history) !== (listed || thread.status === 'abandoned');
  });
}

function repairThreadStatuses(project) {
  const docs = loadRegistryDocs(project);
  if (!docs) return null;
  const resolvedChapters = threadResolutionChapters(docs.outline);
  const resolvedMysteries = new Map();
  for (const chapter of outlineChapters(docs.outline)) {
    for (const mystery of chapterResolvedMysteries(chapter)) {
      if (!mystery?.thread_id) continue;
      if (!resolvedMysteries.has(mystery.thread_id)) resolvedMysteries.set(mystery.thread_id, []);
      resolvedMysteries.get(mystery.thread_id).push({ id: mystery.id, chapter_id: chapter.id });
    }
  }
  const droppedMysteries = Array.isArray(docs.outline.dropped_mysteries) ? docs.outline.dropped_mysteries : [];
  let changed = false;
  for (const doc of [docs.setup, docs.outline]) {
    const registry = Array.isArray(doc.thread_registry) ? doc.thread_registry : [];
    const abandoned = Array.isArray(doc.abandoned_threads) ? doc.abandoned_threads : [];
    for (const thread of registry) {
      const before = JSON.stringify(thread);
      const chapters = resolvedChapters.get(thread.id) || [];
      const hasResolution = chapters.length > 0;
      const wasAbandoned = thread.status === 'abandoned' || thread.abandoned_history === true;
      const listed = abandoned.some((item) => item.thread_id === thread.id);
      thread.resolved_chapters = chapters;
      thread.resolved_mysteries = sortMysteryLinks(resolvedMysteries.get(thread.id) || []);
      thread.resolved_in = hasResolution ? chapters[chapters.length - 1] : null;
      thread.status = hasResolution ? 'resolved' : (wasAbandoned ? 'abandoned' : 'active');
      thread.abandoned_history = Boolean(wasAbandoned || listed);
      thread.abandoned_mysteries = sortMysteryLinks(droppedMysteries
        .filter((mystery) => mystery.thread_id === thread.id)
        .map((mystery) => ({ id: mystery.id, chapter_id: mystery.dropped_in, question: mystery.question })));
      if (thread.status === 'abandoned' && !listed) {
        abandoned.push({
          thread_id: thread.id,
          thread: thread.name,
          question: thread.name,
          importance: thread.importance,
        });
      }
      if (JSON.stringify(thread) !== before) changed = true;
    }
    if (abandoned.length) doc.abandoned_threads = abandoned;
  }
  if (!changed) return null;
  writeJsonAtomic(docs.setupFile, docs.setup);
  writeJsonAtomic(docs.outlineFile, docs.outline);
  return { actions: ['repaired thread statuses'] };
}

function sortMysteryLinks(links) {
  const unique = new Map();
  for (const link of links || []) {
    if (link?.id && !unique.has(link.id)) unique.set(link.id, link);
  }
  return [...unique.values()].sort((left, right) => (
    String(left.chapter_id || '').localeCompare(String(right.chapter_id || ''), undefined, { numeric: true })
    || String(left.id || '').localeCompare(String(right.id || ''), undefined, { numeric: true })
  ));
}

function sortThreadArray(threads) {
  return [...threads].sort((left, right) => {
    if (left.type !== right.type) return left.type === 'main' ? -1 : 1;
    return String(left.id || '').localeCompare(String(right.id || ''), undefined, { numeric: true });
  });
}

function sortMysteryArray(mysteries) {
  return [...mysteries].sort((left, right) => (
    String(left.chapter_id || '').localeCompare(String(right.chapter_id || ''), undefined, { numeric: true })
    || String(left.id || '').localeCompare(String(right.id || ''), undefined, { numeric: true })
  ));
}

function needsRegistryOrderRepair(project) {
  const docs = loadRegistryDocs(project);
  if (!docs) return false;
  return [docs.setup, docs.outline].some((doc) => (
    (Array.isArray(doc.thread_registry) && !sameArray(doc.thread_registry.map((thread) => thread.id), sortThreadArray(doc.thread_registry).map((thread) => thread.id)))
    || (Array.isArray(doc.mystery_registry) && !sameArray(doc.mystery_registry.map((mystery) => mystery.id), sortMysteryArray(doc.mystery_registry).map((mystery) => mystery.id)))
  ));
}

function normalizeRegistryOrder(project) {
  const docs = loadRegistryDocs(project);
  if (!docs) return null;
  let changed = false;
  for (const doc of [docs.setup, docs.outline]) {
    if (Array.isArray(doc.thread_registry)) {
      const sorted = sortThreadArray(doc.thread_registry);
      if (!sameArray(doc.thread_registry.map((thread) => thread.id), sorted.map((thread) => thread.id))) {
        doc.thread_registry = sorted;
        changed = true;
      }
    }
    if (Array.isArray(doc.mystery_registry)) {
      const sorted = sortMysteryArray(doc.mystery_registry);
      if (!sameArray(doc.mystery_registry.map((mystery) => mystery.id), sorted.map((mystery) => mystery.id))) {
        doc.mystery_registry = sorted;
        changed = true;
      }
    }
  }
  if (!changed) return null;
  writeJsonAtomic(docs.setupFile, docs.setup);
  writeJsonAtomic(docs.outlineFile, docs.outline);
  return { actions: ['sorted registry order'] };
}

export function doctorProject(project, options = {}) {
  const issues = [];
  const actions = [];
  const fix = Boolean(options.fix);
  const add = (severity, code, message, suggestion = '') => issues.push({ severity, code, message, suggestion });
  for (const dir of ['story/setup', 'story/compose', 'story/craft', 'story/recaps', 'chapters', 'drafts', 'logs']) {
    if (!fs.existsSync(path.join(project.dir, dir))) {
      add('medium', 'layout.missing_dir', `missing directory: ${dir}`, 'Create the directory or rerun book init on a fresh project.');
      if (fix) {
        ensureDir(path.join(project.dir, dir));
        actions.push(`created ${dir}`);
      }
    }
  }
  const configFile = path.join(project.dir, 'novel.json');
  const rawConfig = readJson(configFile);
  if (!rawConfig.structure) {
    add('low', 'config.structure', 'novel.json has no structure object; using target_* or defaults', 'Add a structure object or keep the legacy target_* fields.');
    if (fix) {
      rawConfig.structure = project.config.structure;
      rawConfig.updated_at = nowIso();
      writeJsonAtomic(configFile, rawConfig);
      actions.push('wrote novel.json structure');
    }
  }
  if (!rawConfig.name) add('low', 'config.name', 'novel.json has no name', 'Add a book name.');
  const jsonFiles = [
    path.join(project.dir, 'story', 'setup', 'story_setup.json'),
    path.join(project.dir, 'story', 'compose', 'outline.json'),
  ];
  for (const dir of ['story/craft', 'story/recaps']) {
    const full = path.join(project.dir, dir);
    if (!fs.existsSync(full)) continue;
    for (const name of fs.readdirSync(full).filter((item) => item.endsWith('.json')).sort()) {
      jsonFiles.push(path.join(full, name));
    }
  }
  for (const file of jsonFiles) {
    if (!fs.existsSync(file)) continue;
    try {
      readJson(file);
    } catch (error) {
      add('high', 'artifact.invalid_json', `${path.relative(project.dir, file)} is not valid JSON`, `Repair or replace the file: ${error.message}`);
    }
  }
  if (!fs.existsSync(path.join(project.dir, 'story', 'setup', 'story_setup.json'))) add('low', 'artifact.setup', 'setup JSON is missing', 'Write setup through book write setup.');
  if (!fs.existsSync(path.join(project.dir, 'story', 'compose', 'outline.json'))) add('low', 'artifact.outline', 'outline JSON is missing', 'Write an outline through book write outline.');
  const setupPath = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlinePath = path.join(project.dir, 'story', 'compose', 'outline.json');
  if (fs.existsSync(setupPath) && fs.existsSync(outlinePath) && needsThreadMigration(project)) {
    add('medium', 'thread.registry_missing_or_drift', 'setup/outline thread_registry is missing or inconsistent', 'Run doctor --fix to migrate thread ids, or rerun book write setup/outline.');
    if (fix) {
      const migration = migrateThreadRegistry(project);
      if (migration) actions.push(...migration.actions);
    }
  }
  if (fs.existsSync(setupPath) && fs.existsSync(outlinePath) && needsThreadStatusRepair(project)) {
    add('medium', 'thread.status_needs_repair', 'thread status does not match resolved/abandoned evidence', 'Run doctor --fix to synchronize thread status.');
    if (fix) {
      const repaired = repairThreadStatuses(project);
      if (repaired) actions.push(...repaired.actions);
    }
  }
  if (fs.existsSync(setupPath) && fs.existsSync(outlinePath) && needsRegistryOrderRepair(project)) {
    add('low', 'registry.order_needs_repair', 'registry arrays are not in stable order', 'Run doctor --fix to sort registries.');
    if (fix) {
      const normalized = normalizeRegistryOrder(project);
      if (normalized) actions.push(...normalized.actions);
    }
  }
  let status = { orphan_chapters: [], orphan_recaps: [] };
  try {
    status = projectStatus(project);
  } catch (error) {
    add('high', 'artifact.status', 'project status could not be loaded', `Repair the invalid artifact: ${error.message}`);
  }
  for (const id of status.orphan_chapters || []) add('low', 'artifact.orphan_chapter', `chapter ${id} has no outline entry`, 'Rename the chapter or add it to the outline.');
  for (const id of status.orphan_recaps || []) add('low', 'artifact.orphan_recap', `recap ${id} has no outline entry`, 'Rename the recap or add its chapter to the outline.');
  const blocking = issues.some((issue) => issue.severity === 'high' || issue.severity === 'critical');
  if (fix) {
    const remaining = doctorProject(project, {});
    return { ...remaining, fixed: true, actions };
  }
  return {
    ok: !blocking,
    blocking,
    root: project.dir,
    name: project.config.name,
    fixed: false,
    actions,
    issues,
  };
}

export function readSection(project, section, options = {}) {
  const id = options.id ? safeSegment(options.id) : '';
  const view = options.view || 'brief';
  switch (section) {
    case 'setup': {
      const file = path.join(project.dir, 'story', 'setup', 'story_setup.json');
      if (!fs.existsSync(file)) throw new Error('story setup has not been written yet');
      return { ok: true, section, setup: readJson(file) };
    }
    case 'outline': {
      const file = path.join(project.dir, 'story', 'compose', 'outline.json');
      if (!fs.existsSync(file)) throw new Error('outline has not been written yet');
      const outline = readJson(file);
      if (id) {
        for (const part of outline.parts || []) {
          for (const volume of part.volumes || []) {
            if (volume.id === id) return { ok: true, section, volume };
            for (const chapter of volume.chapters || []) {
              if (chapter.id === id) return { ok: true, section, chapter };
            }
          }
        }
        throw new Error(`outline id not found: ${id}`);
      }
      return { ok: true, section, outline: view === 'index' ? outlineIndex(outline) : outline };
    }
    case 'chapter': {
      if (!id) throw new Error('book read chapter requires --id');
      const file = path.join(project.dir, 'chapters', `${id}.md`);
      if (!fs.existsSync(file)) throw new Error(`chapter not found: ${id}`);
      return { ok: true, section, id, content: readText(file) };
    }
    case 'recap': {
      if (!id) throw new Error('book read recap requires --id');
      const file = path.join(project.dir, 'story', 'recaps', `${id}.json`);
      if (!fs.existsSync(file)) throw new Error(`recap not found: ${id}`);
      return { ok: true, section, id, recap: readJson(file) };
    }
    case 'ideas': {
      const dir = path.join(project.dir, 'story', 'ideas');
      const results = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort().map((name) => ({
          id: name.slice(0, -5),
          size: fs.statSync(path.join(dir, name)).size,
        }))
        : [];
      return { ok: true, section, results };
    }
    case 'idea': {
      if (!id) throw new Error('book read idea requires --id');
      const file = path.join(project.dir, 'story', 'ideas', `${id}.json`);
      if (!fs.existsSync(file)) throw new Error(`saved idea draw not found: ${id}`);
      return { ok: true, section, id, draw: readJson(file) };
    }
    case 'research': {
      const dir = path.join(project.dir, 'story', 'research');
      if (id) {
        const file = path.join(dir, `${id}.json`);
        if (!fs.existsSync(file)) throw new Error(`research report not found: ${id}`);
        return { ok: true, section, id, report: readJson(file) };
      }
      const results = fs.existsSync(dir)
        ? fs.readdirSync(dir).filter((name) => name.endsWith('.json')).sort().map((name) => ({
          id: name.slice(0, -5),
          size: fs.statSync(path.join(dir, name)).size,
        }))
        : [];
      return { ok: true, section, results };
    }
    case 'graph': {
      return { ok: true, section, graph: buildProjectGraph(project) };
    }
    case 'craft': {
      const dir = path.join(project.dir, 'story', 'craft');
      if (!fs.existsSync(dir)) return { ok: true, section, results: [] };
      if (id) {
        const file = path.join(dir, `${id}.json`);
        if (!fs.existsSync(file)) throw new Error(`craft file not found: ${id}`);
        return { ok: true, section, id, craft: readJson(file) };
      }
      const results = fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort().map((name) => ({
        name: name.slice(0, -5),
        size: fs.statSync(path.join(dir, name)).size,
      }));
      return { ok: true, section, results };
    }
    case 'context': {
      return { ok: true, section, status: projectStatus(project), outline: fs.existsSync(path.join(project.dir, 'story', 'compose', 'outline.json'))
        ? outlineIndex(readJson(path.join(project.dir, 'story', 'compose', 'outline.json')))
        : null };
    }
    case 'logs': {
      const dir = path.join(project.dir, 'logs');
      const results = fs.existsSync(dir) ? fs.readdirSync(dir).sort() : [];
      return { ok: true, section, results };
    }
    default:
      throw new Error(`unsupported read section: ${section}`);
  }
}

function checkpoint(file, name) {
  if (!fs.existsSync(file)) return;
  const dir = path.join(path.dirname(file), 'checkpoints');
  ensureDir(dir);
  const target = path.join(dir, `${name}_${stamp()}${path.extname(file)}`);
  fs.copyFileSync(file, target);
}

function setupMarkdown(setup) {
  const lines = [`# ${setup.project_name || 'Story Setup'}`, ''];
  for (const [key, label] of [['premise', 'Premise'], ['theme', 'Theme'], ['tone', 'Tone'], ['target_audience', 'Audience']]) {
    if (setup[key]) lines.push(`## ${label}`, '', String(setup[key]), '');
  }
  if (setup.rules?.length) lines.push('## Rules', '', ...setup.rules.map((r) => `- ${r}`), '');
  return lines.join('\n');
}

function outlineMarkdown(outline) {
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

export function writeArtifact(project, options) {
  const section = options.section;
  const mode = options.mode || 'replace';
  const apply = Boolean(options.apply);
  const raw = options.content ?? '';
  const id = options.id ? safeSegment(options.id) : '';
  let candidate;
  let file;
  let isJson = true;

  if (section === 'setup') {
    file = path.join(project.dir, 'story', 'setup', 'story_setup.json');
    const incoming = mode === 'patch' && fs.existsSync(file)
      ? deepMerge(readJson(file), parseJson(raw, 'setup patch'))
      : parseJson(raw, 'setup');
    candidate = incoming;
  } else if (section === 'outline') {
    file = path.join(project.dir, 'story', 'compose', 'outline.json');
    if (mode === 'patch') {
      const current = fs.existsSync(file) ? readJson(file) : { parts: [] };
      const patch = parseJson(raw, 'outline patch');
      if (options.target === 'volume') {
        if (!id) throw new Error('outline volume patch requires --id');
        let volume;
        for (const part of current.parts || []) {
          volume = (part.volumes || []).find((v) => v.id === id);
          if (volume) break;
        }
        if (!volume) throw new Error(`outline volume not found: ${id}`);
        Object.assign(volume, deepMerge(volume, patch));
        candidate = current;
      } else if (options.target === 'chapter') {
        if (!id) throw new Error('outline chapter patch requires --id');
        let chapter;
        for (const part of current.parts || []) {
          for (const volume of part.volumes || []) {
            chapter = (volume.chapters || []).find((item) => item.id === id);
            if (chapter) break;
          }
          if (chapter) break;
        }
        if (!chapter) throw new Error(`outline chapter not found: ${id}`);
        Object.assign(chapter, deepMerge(chapter, patch));
        candidate = current;
      } else {
        candidate = deepMerge(current, patch);
      }
    } else {
      candidate = parseJson(raw, 'outline');
    }
  } else if (section === 'chapter') {
    if (!id) throw new Error('chapter write requires --id');
    file = path.join(project.dir, 'chapters', `${id}.md`);
    isJson = false;
    if (mode === 'append') {
      const existing = fs.existsSync(file) ? readText(file).trimEnd() : '';
      candidate = `${existing}${existing ? '\n\n' : ''}${raw.trimStart()}`;
    } else if (mode === 'replace') {
      candidate = raw;
    } else {
      throw new Error(`chapter mode must be replace or append, got ${mode}`);
    }
    if (!candidate.trim()) throw new Error('chapter content is empty');
  } else if (section === 'craft') {
    const kind = options.target || 'character';
    file = path.join(project.dir, 'story', 'craft', `${kind}.json`);
    const incoming = mode === 'patch' && fs.existsSync(file)
      ? deepMerge(readJson(file), parseJson(raw, 'craft patch'))
      : parseJson(raw, 'craft');
    candidate = incoming;
  } else if (section === 'recap') {
    if (!id) throw new Error('recap write requires --id');
    file = path.join(project.dir, 'story', 'recaps', `${id}.json`);
    const incoming = mode === 'patch' && fs.existsSync(file)
      ? deepMerge(readJson(file), parseJson(raw, 'recap patch'))
      : parseJson(raw, 'recap');
    candidate = incoming;
  } else {
    throw new Error(`unsupported write section: ${section}`);
  }

  const check = ['setup', 'outline', 'craft', 'recap', 'chapter'].includes(section)
    ? checkCandidate(project, {
      section,
      candidate,
      kind: options.target || 'character',
      id: section === 'chapter' || section === 'recap' ? id : undefined,
      maxFindings: options.maxIssues || 0,
    })
    : null;

  if (check?.blocking && apply) {
    return { ok: false, applied: false, dry_run: false, section, check };
  }
  if (!apply) {
    return { ok: check?.ok ?? true, applied: false, dry_run: true, section, id, check };
  }

  checkpoint(file, section);
  if (isJson) {
    writeJsonAtomic(file, candidate);
  } else {
    writeTextAtomic(file, candidate.endsWith('\n') ? candidate : `${candidate}\n`);
  }
  if (section === 'setup') {
    writeTextAtomic(path.join(project.dir, 'story', 'setup', 'story_setup.md'), setupMarkdown(candidate));
  }
  if (section === 'outline') {
    writeTextAtomic(path.join(project.dir, 'story', 'compose', 'outline.md'), outlineMarkdown(candidate));
  }
  const config = readJson(path.join(project.dir, 'novel.json'));
  config.updated_at = nowIso();
  writeJsonAtomic(path.join(project.dir, 'novel.json'), config);
  const after = ['setup', 'outline', 'craft', 'recap', 'chapter'].includes(section)
    ? checkProject({ ...project, config }, {
      profile: 'all',
      target: section,
      id: section === 'craft' ? (options.target || 'character') : id,
      maxFindings: options.maxIssues || 0,
    })
    : null;
  return { ok: true, applied: true, dry_run: false, section, id, changed: true, check: after || check };
}
