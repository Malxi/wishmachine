// Book-level shape checks: repeated chapter openings/endings, the same
// structural signature across chapters, and endings that explain the theme.
// These are advisory signals; they never block writes.
import { finding } from '../finding.js';
import {
  cjkCount,
  firstSentence,
  hasLectureMarker,
  isDialogueParagraph,
  lastSentence,
} from './chinese.js';

function isQuestion(sentence) {
  return /[？?]\s*$/.test(sentence);
}

function isEllipsis(sentence) {
  return /……\s*$/.test(sentence);
}

function classifyOpening(text) {
  const sentence = firstSentence(text);
  if (/^[“「『"]/.test(sentence)) return 'dialogue';
  if (isQuestion(sentence)) return 'question';
  if (hasLectureMarker(sentence)) return 'summary';
  if (cjkCount(sentence) <= 8) return 'short';
  return 'narration';
}

function classifyEnding(text) {
  const sentence = lastSentence(text);
  if (isDialogueParagraph(sentence)) return 'dialogue';
  if (isQuestion(sentence)) return 'question';
  if (isEllipsis(sentence)) return 'ellipsis';
  if (hasLectureMarker(sentence)) return 'reflection';
  if (cjkCount(sentence) <= 10) return 'short';
  return 'narration';
}

function dialogueBand(metrics) {
  const ratio = Number(metrics?.dialogueRatio) || 0;
  if (ratio < 0.08) return 'low';
  if (ratio > 0.35) return 'high';
  return 'mid';
}

function emotionBand(metrics) {
  const body = Number(metrics?.embodiedEmotionPer1k) || 0;
  const share = Number(metrics?.emotionBodyShare) || 0;
  return body >= 3 || share >= 0.7 ? 'body' : 'balanced';
}

function chapterShape(text, metrics) {
  return {
    opening: classifyOpening(text),
    ending: classifyEnding(text),
    dialogueBand: dialogueBand(metrics),
    emotionBand: emotionBand(metrics),
  };
}

function dominant(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  let winner = '';
  let count = 0;
  for (const [value, total] of counts) {
    if (total > count) {
      winner = value;
      count = total;
    }
  }
  return { value: winner, count };
}

function shapeFinding(chapters, kind, message, suggestion) {
  const item = finding(
    `style.book.${kind}`,
    'medium',
    message,
    'book',
    suggestion,
  );
  item.evidence = chapters.slice(0, 8).map((chapter) => ({
    id: chapter.id,
    opening: chapter.shape.opening,
    ending: chapter.shape.ending,
  }));
  return item;
}

function bookShapeFindings(chapters, options = {}) {
  const minChapters = Number(options.minChapters) || 3;
  const dominance = Number(options.dominance) || 0.6;
  if (!Array.isArray(chapters) || chapters.length < minChapters) return [];
  const shaped = chapters.filter((chapter) => chapter?.shape);
  if (shaped.length < minChapters) return [];
  const findings = [];
  const openings = dominant(shaped.map((chapter) => chapter.shape.opening));
  const endings = dominant(shaped.map((chapter) => chapter.shape.ending));
  const signatures = dominant(shaped.map((chapter) => [
    chapter.shape.opening,
    chapter.shape.ending,
    chapter.shape.dialogueBand,
    chapter.shape.emotionBand,
  ].join('/')));
  const repeatedOpening = openings.count >= minChapters && openings.count / shaped.length >= dominance;
  const repeatedEnding = endings.count >= minChapters && endings.count / shaped.length >= dominance;
  const repeatedSignature = signatures.count >= minChapters && signatures.count / shaped.length >= dominance;
  if (repeatedOpening || repeatedEnding || repeatedSignature) {
    const parts = [];
    if (repeatedOpening) parts.push(`${openings.count}/${shaped.length} 章用 ${openings.value} 开头`);
    if (repeatedEnding) parts.push(`${endings.count}/${shaped.length} 章用 ${endings.value} 收尾`);
    if (repeatedSignature) parts.push(`${signatures.count}/${shaped.length} 章共享同一结构签名`);
    findings.push(shapeFinding(
      shaped,
      'shape_convergence',
      `章节结构同质化：${parts.join('；')}`,
      '换一种开头/收尾/场景骨架；至少让一章的进入方式和落点不同，不要每章都同一套节拍。',
    ));
  }
  const reflections = shaped.filter((chapter) => chapter.shape.ending === 'reflection');
  if (reflections.length >= minChapters && reflections.length / shaped.length >= dominance) {
    findings.push(shapeFinding(
      reflections,
      'theme_explicitness',
      `${reflections.length}/${shaped.length} 章以主题总结/抽象抬升收尾`,
      '把主题留给情节和代价；至少让一章停在具体动作、物件或未解释的细节上。',
    ));
  }
  return findings;
}

export { bookShapeFindings, chapterShape, classifyEnding, classifyOpening };
