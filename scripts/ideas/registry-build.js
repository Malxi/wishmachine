// Thread registry derivation shared by single- and multi-volume outlinepacks.
import { chapterResolvedMysteries, sortMysteryLinks } from '../registry.js';

function buildThreadRegistry(storylines, chapters, droppedMysteries) {
  const abandonedIds = new Set(droppedMysteries.map((item) => item.thread_id).filter(Boolean));
  return storylines.map((item, index) => {
    const id = item.id || `thread-${index + 1}`;
    const threadChapters = chapters.filter((chapter) => chapter.thread_id === id);
    const resolvedChapters = chapters
      .filter((chapter) => chapterResolvedMysteries(chapter).some((mystery) => mystery.thread_id === id))
      .map((chapter) => chapter.id);
    const lastChapter = threadChapters[threadChapters.length - 1];
    const resolvedIn = resolvedChapters[resolvedChapters.length - 1]
      || (lastChapter && ['climax', 'resolution'].includes(lastChapter.beat_function) ? lastChapter.id : null);
    const abandonedHistory = abandonedIds.has(id);
    const resolvedMysteries = chapters.flatMap((chapter) => (
      chapterResolvedMysteries(chapter)
        .filter((mystery) => mystery.thread_id === id)
        .map((mystery) => ({ id: mystery.id, chapter_id: chapter.id }))
    ));
    const abandonedMysteries = droppedMysteries
      .filter((mystery) => mystery.thread_id === id)
      .map((mystery) => ({ id: mystery.id, chapter_id: mystery.dropped_in, question: mystery.question }));
    return {
      id,
      name: item.title || `storyline ${index + 1}`,
      type: index === 0 ? 'main' : 'subplot',
      importance: index === 0 ? 10 : 6,
      status: resolvedIn ? 'resolved' : abandonedHistory ? 'abandoned' : 'active',
      resolved_in: resolvedIn,
      resolved_chapters: resolvedChapters,
      resolved_mysteries: sortMysteryLinks(resolvedMysteries),
      abandoned_history: abandonedHistory,
      abandoned_mysteries: sortMysteryLinks(abandonedMysteries),
    };
  });
}

export { buildThreadRegistry };
