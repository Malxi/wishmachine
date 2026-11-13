// Focus/padding metrics: motif density, dialogue paragraphs, redundant paragraphs
// and chapter length relative to target. Split out of metrics.js to keep every
// function within the structure gate.

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function chapterFocusMetrics(text, paragraphs, cjk, options) {
  const targetChars = Number(options.targetChars) || 0;
  const motifs = asArray(options.motifs).filter((term) => typeof term === 'string' && term.trim());
  const motifCounts = motifs.map((term) => ({ term, count: String(text).split(term).length - 1 }))
    .filter((item) => item.count > 0)
    .map((item) => ({ ...item, per1k: round((1000 * item.count) / (cjk || 1)) }));
  const dialogueParagraphs = paragraphs.filter((paragraph) => /["“「]/.test(paragraph)).length;
  const paragraphSets = paragraphs.map((paragraph) => {
    const clean = paragraph.replace(/[^\u3400-\u9fff]/g, '');
    const set = new Set();
    for (let index = 0; index + 2 <= clean.length; index += 2) set.add(clean.slice(index, index + 2));
    return set;
  });
  let redundantParagraphs = 0;
  for (let index = 1; index < paragraphSets.length; index += 1) {
    const left = paragraphSets[index - 1];
    const right = paragraphSets[index];
    if (left.size === 0 || right.size === 0) continue;
    let intersection = 0;
    for (const item of left) if (right.has(item)) intersection += 1;
    if (intersection / (left.size + right.size - intersection) >= 0.5) redundantParagraphs += 1;
  }
  return {
    motifCounts,
    motifMaxPer1k: motifCounts.length ? Math.max(...motifCounts.map((item) => item.per1k)) : 0,
    dialogueParagraphRatio: round(dialogueParagraphs / (paragraphs.length || 1)),
    redundantParagraphRatio: round(redundantParagraphs / (paragraphs.length || 1)),
    paddingRatio: targetChars > 0 ? round(cjk / targetChars) : 0,
  };
}

export { chapterFocusMetrics };
