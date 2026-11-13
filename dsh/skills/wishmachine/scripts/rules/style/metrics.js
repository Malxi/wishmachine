// Deterministic style metrics for prose and setup artifacts. Pure functions:
// no project/state imports, so rules/style can stay a leaf feature.
import { chapterFocusMetrics } from './focus.js';

const SENTENCE_SPLIT = /(?<=[。！？…])/;
const CLAUSE_SPLIT = /[，,；;：:、]/;
const MODAL_PREDICATE = /([会没不才便就未别])([\u4e00-\u9fff])[。！？…]$/;
const SIMILE = /(?:像|仿佛|似乎|宛如|如同|好似|像是)/g;
const ABSTRACT_WORDS = [
  '命运', '人性', '文明', '宿命', '救赎', '意义', '灵魂', '永恒', '孤独', '存在',
  '自由', '真相', '世界', '时间', '记忆', '代价', '秩序', '疯狂', '恐惧', '希望',
  '绝望', '黑暗', '死亡', '生命',
];
const ABSTRACT_PATTERN = ABSTRACT_WORDS.join('|');
const UPLIFT = new RegExp(`(?:这|那|原来|终究|或许|也许|所谓|真正|某种|一切|所有|从来|不过|只是|毕竟|到底)[^。！？]{0,30}(?:${ABSTRACT_PATTERN})[^。！？]*[。！？]`, 'g');
const TEMPLATE = [
  /不是[^。！？]{0,24}而是/g,
  /不仅[^。！？]{0,24}(?:还|更)/g,
  /首先|其次|最后|值得注意的是|总而言之|某种意义上|由此可见|不难看出/g,
];
const APHORISM = /不是[^。！？]{0,30}是|从来|唯一|真正|说到底|归根结底|某种意义上/;
const CONCRETE_RULE = /[0-9一二三四五六七八九十百千万]|只能|必须|否则|代价|上限|不得|不能|会|每|尺|寸|息|垄|户|粒/;

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cjkCount(text) {
  return (String(text).match(/[\u3400-\u9fff]/g) || []).length;
}

function splitSentences(text) {
  return String(text)
    .replace(/^#.*$/m, '')
    .split(SENTENCE_SPLIT)
    .map((sentence) => sentence.trim())
    .filter((sentence) => cjkCount(sentence) > 0);
}

function splitClauses(sentence) {
  return sentence.split(CLAUSE_SPLIT).map((clause) => clause.trim()).filter((clause) => cjkCount(clause) > 0);
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values) {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function ratio(part, total) {
  return total > 0 ? part / total : 0;
}

function per1k(count, total) {
  return total > 0 ? (1000 * count) / total : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function splitParagraphs(text) {
  return String(text)
    .replace(/^#.*$/m, '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => cjkCount(paragraph) > 0);
}

function openingOf(sentence) {
  return (sentence.replace(/[^\u3400-\u9fff]/g, '').slice(0, 2));
}

function compressedPredicates(sentences) {
  const items = [];
  for (let index = 0; index < sentences.length; index += 1) {
    const match = sentences[index].match(MODAL_PREDICATE);
    if (match) items.push({ sentence: sentences[index], modal: match[1], predicate: match[2], index });
  }
  return items;
}

function countPatterns(text, patterns) {
  return patterns.reduce((total, pattern) => total + (String(text).match(pattern) || []).length, 0);
}

function abstractHits(text) {
  return ABSTRACT_WORDS.reduce((total, word) => total + (String(text).split(word).length - 1), 0);
}

function chapterMetrics(text, options = {}) {
  const cjk = cjkCount(text);
  const sentences = splitSentences(text);
  const paragraphs = splitParagraphs(text);
  const focus = chapterFocusMetrics(text, paragraphs, cjk, options);
  const sentenceLengths = sentences.map((sentence) => cjkCount(sentence));
  const clauseLengths = sentences.flatMap((sentence) => splitClauses(sentence).map((clause) => cjkCount(clause)));
  const paragraphsLengths = paragraphs.map((paragraph) => cjkCount(paragraph));
  const compressed = compressedPredicates(sentences);
  const negated = compressed.filter((item) => /[不没未别]/.test(item.modal)).length;
  const openings = new Map();
  for (const sentence of sentences) {
    const opening = openingOf(sentence);
    if (opening.length === 2) openings.set(opening, (openings.get(opening) || 0) + 1);
  }
  const names = asArray(options.names).filter((name) => typeof name === 'string' && name);
  const subjectOpenings = sentences.filter((sentence) => names.some((name) => sentence.startsWith(name))).length;
  const repeatedOpeningSentences = sentences.filter((sentence) => (openings.get(openingOf(sentence)) || 0) >= 3).length;
  const dialogueText = (String(text).match(/“[^”\n]*”|「[^」\n]*」|"[^"\n]*"/g) || []).join('');
  const uplift = String(text).match(UPLIFT) || [];
  const template = countPatterns(text, TEMPLATE);
  const similes = (String(text).match(SIMILE) || []).length;
  const dashes = (String(text).match(/——/g) || []).length;
  const semicolons = (String(text).match(/；/g) || []).length;
  const colons = (String(text).match(/：/g) || []).length;
  const shortClauses = clauseLengths.filter((length) => length <= 4).length;
  const duplicateSentences = new Set();
  const seen = new Set();
  for (const sentence of sentences) {
    const normalized = sentence.replace(/[^\u3400-\u9fff]/g, '');
    if (normalized.length >= 6 && seen.has(normalized)) duplicateSentences.add(normalized);
    seen.add(normalized);
  }
  return {
    cjk,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    sentencesPer1k: round(per1k(sentences.length, cjk)),
    sentenceMean: round(mean(sentenceLengths)),
    sentenceCv: round(ratio(stddev(sentenceLengths), mean(sentenceLengths))),
    shortSentenceRatio: round(ratio(sentenceLengths.filter((length) => length <= 8).length, sentences.length)),
    clauseMean: round(mean(clauseLengths)),
    shortClauseRatio: round(ratio(shortClauses, clauseLengths.length)),
    paragraphCv: round(ratio(stddev(paragraphsLengths), mean(paragraphsLengths))),
    compressedPredicate: compressed.length,
    compressedPredicatePer1k: round(per1k(compressed.length, cjk)),
    compressedPredicateSentenceRatio: round(ratio(compressed.length, sentences.length)),
    negatedCompressedShare: round(ratio(negated, compressed.length)),
    compressedDistinctRatio: round(ratio(new Set(compressed.map((item) => item.predicate)).size, compressed.length)),
    sentenceOpeningReuse: round(ratio(repeatedOpeningSentences, sentences.length)),
    subjectOpeningShare: round(ratio(subjectOpenings, sentences.length)),
    templateConnectors: template,
    templateConnectorsPer1k: round(per1k(template, cjk)),
    similePer1k: round(per1k(similes, cjk)),
    upliftCount: uplift.length,
    upliftPer1k: round(per1k(uplift.length, cjk)),
    dashPer1k: round(per1k(dashes, cjk)),
    semicolonPer1k: round(per1k(semicolons, cjk)),
    colonPer1k: round(per1k(colons, cjk)),
    dialogueRatio: round(ratio(cjkCount(dialogueText), cjk)),
    ...focus,
    duplicateSentenceCount: duplicateSentences.size,
    compressedExamples: compressed.slice(0, 8).map((item) => item.sentence),
    openingExamples: [...openings.entries()].filter(([, count]) => count >= 3).sort((left, right) => right[1] - left[1]).slice(0, 5).map(([prefix, count]) => ({ prefix, count })),
    upliftExamples: uplift.slice(0, 5),
  };
}

function setupMetrics(setup) {
  const premise = String(setup?.premise || '');
  const theme = String(setup?.theme || '');
  const rules = asArray(setup?.rules).filter((rule) => typeof rule === 'string');
  const text = [premise, theme, ...rules].join('\n');
  const cjk = cjkCount(text);
  const concreteRules = rules.filter((rule) => CONCRETE_RULE.test(rule)).length;
  const cast = asArray(setup?.core_cast).filter((character) => isObject(character));
  const names = cast.map((character) => String(character.name || '')).filter(Boolean);
  const surnameCounts = new Map();
  for (const name of names) {
    const surname = name.slice(0, 1);
    surnameCounts.set(surname, (surnameCounts.get(surname) || 0) + 1);
  }
  const descriptorNames = names.filter((name) => /^(?:老|小|阿).+|.+人$|.+那位$|.+者$/.test(name));
  const sourceCovered = cast.filter((character) => character.name_source === 'draw' || character.namecard_id).length;
  const styles = cast.map((character) => character.naming_style).filter(Boolean);
  return {
    genreCount: asArray(setup?.genres).length,
    premiseCjk: cjkCount(premise),
    themeCjk: cjkCount(theme),
    abstractPer1k: round(per1k(abstractHits(text), cjk)),
    themeAphorism: APHORISM.test(theme) ? 1 : 0,
    rules: rules.length,
    concreteRulesRatio: round(ratio(concreteRules, rules.length)),
    castCount: cast.length,
    resourceCount: asArray(setup?.world_resources).length,
    nameSurnameConcentration: round(ratio(Math.max(0, ...surnameCounts.values()), names.length)),
    nameDescriptorRatio: round(ratio(descriptorNames.length, names.length)),
    nameSingleCharGivenRatio: round(ratio(names.filter((name) => [...name].length === 2).length, names.length)),
    nameSourceCoverage: round(ratio(sourceCovered, names.length)),
    nameStyleDiversity: round(ratio(new Set(styles).size, styles.length || names.length)),
    nameDuplicateCount: names.length - new Set(names).size,
    nameExamples: names.slice(0, 8),
  };
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export {
  ABSTRACT_WORDS,
  chapterMetrics,
  cjkCount,
  round,
  setupMetrics,
  splitSentences,
};
