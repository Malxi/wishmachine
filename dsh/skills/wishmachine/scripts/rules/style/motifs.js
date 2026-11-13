// Cross-chapter repeated-phrase detection ("motif repetition").
function crossChapterMotifs(chapters, names) {
  const map = new Map();
  for (const { id, text } of chapters) {
    const clean = text.replace(/[^\u3400-\u9fff]/g, '');
    const seen = new Set();
    for (let size = 4; size <= 6; size += 1) {
      for (let index = 0; index + size <= clean.length; index += 1) {
        const phrase = clean.slice(index, index + size);
        if (seen.has(phrase)) continue;
        if (names.some((name) => phrase.includes(name))) continue;
        seen.add(phrase);
        if (!map.has(phrase)) map.set(phrase, new Set());
        map.get(phrase).add(id);
      }
    }
  }
  const minimum = Math.max(3, Math.ceil(chapters.length * 0.4));
  return [...map.entries()]
    .filter(([, ids]) => ids.size >= minimum)
    .sort((left, right) => right[1].size - left[1].size || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([phrase, ids]) => ({ phrase, chapters: ids.size, examples: [...ids].slice(0, 6) }));
}

export { crossChapterMotifs };
