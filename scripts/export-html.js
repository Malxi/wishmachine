// Self-contained HTML reader page for `export --format html`.
// No external assets, no scripts: one portable file with a table of contents,
// front matter, chapters, light/dark styles and print rules.
import fs from 'node:fs';
import { readText } from './util.js';
import { chapterFile } from './paths.js';

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text) {
  return escapeHtml(text)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
}

function createBlockState() {
  return { html: [], paragraph: [], list: null, quote: [] };
}

function flushParagraph(state) {
  if (!state.paragraph.length) return;
  state.html.push(`<p>${renderInline(state.paragraph.join(' '))}</p>`);
  state.paragraph = [];
}

function flushList(state) {
  if (!state.list) return;
  const { tag, items } = state.list;
  state.html.push(`<${tag}>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`);
  state.list = null;
}

function flushQuote(state) {
  if (!state.quote.length) return;
  state.html.push(`<blockquote><p>${renderInline(state.quote.join(' '))}</p></blockquote>`);
  state.quote = [];
}

function flushBlocks(state) {
  flushParagraph(state);
  flushList(state);
  flushQuote(state);
}

function startList(state, tag) {
  if (state.list && state.list.tag === tag) return;
  flushList(state);
  state.list = { tag, items: [] };
}

// One Markdown line -> block state. Novel chapters are prose paragraphs; the
// extra cases keep headings, quotes, lists and horizontal rules from leaking.
function appendBlockLine(state, line) {
  const heading = line.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    flushBlocks(state);
    const level = Math.min(6, heading[1].length + 1);
    state.html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
    return;
  }
  if (/^---+$/.test(line)) {
    flushBlocks(state);
    state.html.push('<hr>');
    return;
  }
  const quoteLine = line.match(/^>\s?(.*)$/);
  if (quoteLine) {
    flushParagraph(state);
    flushList(state);
    state.quote.push(quoteLine[1]);
    return;
  }
  const bullet = line.match(/^[-*]\s+(.*)$/);
  if (bullet) {
    flushParagraph(state);
    flushQuote(state);
    startList(state, 'ul');
    state.list.items.push(bullet[1]);
    return;
  }
  const ordered = line.match(/^\d+[.)]\s+(.*)$/);
  if (ordered) {
    flushParagraph(state);
    flushQuote(state);
    startList(state, 'ol');
    state.list.items.push(ordered[1]);
    return;
  }
  flushList(state);
  flushQuote(state);
  state.paragraph.push(line);
}

function renderMarkdownBlocks(markdown) {
  const state = createBlockState();
  for (const raw of String(markdown).replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) {
      flushBlocks(state);
      continue;
    }
    appendBlockLine(state, line);
  }
  flushBlocks(state);
  return state.html.join('\n');
}

function stripTitle(text) {
  return String(text).replace(/^#\s+.*(?:\r?\n)+/, '').trim();
}

const READER_CSS = `
:root { color-scheme: light dark; --ink: #1f2328; --muted: #6b7280; --paper: #fbfaf7; --line: #e5e0d5; --accent: #7c5a35; }
@media (prefers-color-scheme: dark) { :root { --ink: #e7e3da; --muted: #a7a29a; --paper: #17181a; --line: #33363b; --accent: #d6b184; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--paper); color: var(--ink); font-family: "Noto Serif SC", "Songti SC", "Source Han Serif SC", Georgia, serif; line-height: 1.95; }
main.page { max-width: 42rem; margin: 0 auto; padding: 3rem 1.25rem 5rem; }
header.book { text-align: center; margin-bottom: 3rem; }
header.book h1 { font-size: 2.1rem; letter-spacing: 0.08em; margin: 0 0 0.5rem; }
header.book .meta { color: var(--muted); font-size: 0.95rem; margin: 0; }
h2 { font-size: 1.35rem; margin: 2.5rem 0 1rem; padding-bottom: 0.4rem; border-bottom: 1px solid var(--line); }
nav#toc ol { padding-left: 1.4rem; }
nav#toc li { margin: 0.35rem 0; }
nav#toc a { color: var(--accent); text-decoration: none; }
nav#toc a:hover { text-decoration: underline; }
.volume-title { color: var(--muted); font-size: 0.95rem; letter-spacing: 0.12em; margin: 2rem 0 0.5rem; }
article.chapter { margin-top: 2.5rem; }
article.chapter h2 { font-size: 1.45rem; }
article.chapter p { text-indent: 2em; margin: 0.9rem 0; text-align: justify; }
article.chapter h3, article.chapter h4, article.chapter h5, article.chapter h6 { margin: 1.4rem 0 0.6rem; }
blockquote { margin: 1rem 0; padding: 0.4rem 1rem; border-left: 3px solid var(--line); color: var(--muted); }
blockquote p { text-indent: 0; }
hr { border: 0; border-top: 1px solid var(--line); margin: 2rem 0; }
ul, ol { padding-left: 1.6rem; }
li { margin: 0.3rem 0; }
.back { text-align: right; font-size: 0.9rem; }
.back a { color: var(--muted); text-decoration: none; }
footer.end { margin-top: 3rem; text-align: center; color: var(--muted); }
@media print { body { background: #fff; color: #000; } nav#toc, .back { display: none; } article.chapter { page-break-before: always; } main.page { max-width: none; padding: 0; } }
`;

function pushHtmlFrontMatter(html, plan) {
  const { status, setup } = plan;
  const genres = (setup?.genres || []).map((genre) => escapeHtml(genre)).join(' · ');
  html.push(`<header class="book"><h1>${escapeHtml(status.name)}</h1>`);
  html.push(`<p class="meta">${genres ? `${genres} · ` : ''}全${plan.unique.length}章</p></header>`);
  if (setup?.premise) html.push(`<section class="front"><h2>内容简介</h2><p>${renderInline(setup.premise)}</p></section>`);
  if (setup?.theme) html.push(`<section class="front"><h2>主题</h2><p>${renderInline(setup.theme)}</p></section>`);
  if (setup?.core_cast?.length) {
    html.push('<section class="front"><h2>主要人物</h2><ul class="cast">');
    for (const character of setup.core_cast) {
      const role = character.role === 'protagonist' ? '主角' : character.role === 'antagonist' ? '对手' : '同行者';
      html.push(`<li><strong>${escapeHtml(character.name)}</strong>（${role}）：${renderInline(character.story_function || '')}</li>`);
    }
    html.push('</ul></section>');
  }
  if (setup?.rules?.length) {
    html.push('<section class="front"><h2>规则速览</h2><ul class="rules">');
    for (const rule of setup.rules.slice(0, 8)) html.push(`<li>${renderInline(rule)}</li>`);
    html.push('</ul></section>');
  }
  html.push('<nav id="toc"><h2>目录</h2><ol>');
  let number = 0;
  for (const part of plan.outline?.parts || []) {
    for (const volume of part.volumes || []) {
      for (const chapter of volume.chapters || []) {
        if (!plan.written.has(chapter.id)) continue;
        number += 1;
        html.push(`<li><a href="#chapter-${number}">${escapeHtml(chapter.title || chapter.id)}</a></li>`);
      }
    }
  }
  html.push('</ol></nav>');
}

function pushHtmlChapters(html, plan, project) {
  let currentVolume = '';
  let number = 0;
  for (const id of plan.unique) {
    let file;
    try {
      file = chapterFile(project.dir, id);
    } catch {
      continue;
    }
    if (!fs.existsSync(file)) continue;
    const info = plan.chapterInfo.get(id);
    const volumeTitle = info?.volume?.title || info?.volume?.id || '';
    if (volumeTitle && volumeTitle !== currentVolume) {
      currentVolume = volumeTitle;
      html.push(`<p class="volume-title">${escapeHtml(volumeTitle)}</p>`);
    }
    const raw = readText(file);
    const title = info?.chapter?.title || raw.match(/^#\s+(.+)$/m)?.[1] || id;
    number += 1;
    html.push(`<article class="chapter" id="chapter-${number}">`);
    html.push(`<h2>${escapeHtml(title)}</h2>`);
    html.push(renderMarkdownBlocks(stripTitle(raw)));
    html.push('<p class="back"><a href="#toc">返回目录</a></p></article>');
  }
  return number;
}

function renderHtml(project, plan) {
  const html = [
    '<!doctype html>',
    `<html lang="${escapeHtml(project.config.language || 'zh')}">`,
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(plan.status.name)} · 全本阅读</title>`,
    '<meta name="generator" content="wishmachine">',
    `<style>${READER_CSS}</style>`,
    '</head>',
    '<body>',
    '<main class="page">',
  ];
  pushHtmlFrontMatter(html, plan);
  const chapters = pushHtmlChapters(html, plan, project);
  html.push('<footer class="end"><p>全书完。</p></footer>', '</main>', '</body>', '</html>');
  return { chunks: [html.join('\n')], chapters };
}

export { renderHtml };
