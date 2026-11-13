// Read-only outline index helpers: a compact part/volume/chapter summary plus a
// chapter lookup. Re-exported from ./outline-shape.js because state.js, read.js
// and the recap/chapter quality rules import them from there.

function outlineIndex(outline) {
  return {
    part_count: outline?.parts?.length || 0,
    volume_count: (outline?.parts || []).reduce((n, p) => n + (p.volumes?.length || 0), 0),
    chapter_count: (outline?.parts || []).reduce((n, p) => n + (p.volumes || []).reduce((m, v) => m + (v.chapters?.length || 0), 0), 0),
    parts: (outline?.parts || []).map((p) => ({
      id: p.id,
      title: p.title,
      volumes: (p.volumes || []).map((v) => ({
        id: v.id,
        title: v.title,
        chapters: (v.chapters || []).map((c) => ({ id: c.id, title: c.title })),
      })),
    })),
  };
}

function findOutlineChapter(outline, id) {
  for (const part of outline?.parts || []) {
    for (const volume of part.volumes || []) {
      for (const chapter of volume.chapters || []) {
        if (chapter.id === id) return { part, volume, chapter };
      }
    }
  }
  return null;
}

export { findOutlineChapter, outlineIndex };
