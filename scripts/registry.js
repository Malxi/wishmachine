// Shared mystery/thread registry helpers.
// Both project.js (check/repair) and ideas.js (pack generation) must use these so
// the generator, the checker and the repair path agree on ordering and merging.

function naturalCompare(left, right) {
  return String(left || '').localeCompare(String(right || ''), undefined, { numeric: true });
}

export function outlineChapters(outline) {
  const chapters = [];
  for (const part of outline?.parts || []) {
    for (const volume of part.volumes || []) {
      chapters.push(...(volume.chapters || []));
    }
  }
  return chapters;
}

export function sortMysteryLinks(links) {
  const unique = new Map();
  for (const link of links || []) {
    if (link?.id && !unique.has(link.id)) unique.set(link.id, link);
  }
  return [...unique.values()].sort((left, right) => (
    naturalCompare(left.chapter_id, right.chapter_id) || naturalCompare(left.id, right.id)
  ));
}

export function chapterResolvedMysteries(chapter) {
  return [
    ...(chapter?.mysteries?.resolved || []),
    ...(chapter?.scenes || []).flatMap((scene) => scene.mysteries?.resolved || []),
  ];
}

const MYSTERY_STATUS_PRIORITY = { open: 0, dropped: 1, resolved: 2 };

export function collectMysteryRegistry(chapters) {
  const registry = new Map();
  const add = (mystery, chapterId, source) => {
    if (!mystery?.id) return;
    const existing = registry.get(mystery.id);
    if (existing && (MYSTERY_STATUS_PRIORITY[existing.status] || 0) >= (MYSTERY_STATUS_PRIORITY[mystery.status] || 0)) return;
    registry.set(mystery.id, { ...mystery, chapter_id: chapterId, source });
  };
  for (const chapter of chapters) {
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
    naturalCompare(left.chapter_id, right.chapter_id) || naturalCompare(left.id, right.id)
  ));
}

export function collectOutlineMysteryRegistry(outline) {
  return collectMysteryRegistry(outlineChapters(outline));
}

export function sortThreadArray(threads) {
  return [...threads].sort((left, right) => {
    if (left.type !== right.type) return left.type === 'main' ? -1 : 1;
    return naturalCompare(left.id, right.id);
  });
}

export function sortMysteryArray(mysteries) {
  return [...mysteries].sort((left, right) => (
    naturalCompare(left.chapter_id, right.chapter_id) || naturalCompare(left.id, right.id)
  ));
}

export function compareThreadRegistry(left, right) {
  return sortThreadArray([left, right])[0] === left ? -1 : 1;
}
