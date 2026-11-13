// Card builders for source ingestion/search: HTML text/meta/heading/link
// extraction plus Wikipedia and Gutenberg result mapping. Pure functions only;
// network access and persistence stay in ./sources.js.

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

export {
  buildGraph, extractHeadings, extractKeywords, extractLinks, extractTitle,
  gutenbergCard, htmlToText, metaContent, wikipediaCards,
};
