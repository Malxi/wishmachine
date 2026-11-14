// Chinese prose tells: translationese, nominalization, jargon, body-performance
// emotion, soft adverbs, dialogue tags and subtitle-like paragraphs. These are
// diagnostic signals, not a ban list: every metric is density-based and keeps
// its matched sentences so a human can decide whether the move is earned.
const TRANSLATIONESE = [
  /对于[^。！？]{0,20}来说/g,
  /基于(?:此|这|上述|以上|这一|当前|现有)/g,
  /围绕[^。！？]{0,20}展开/g,
  /在[^。！？]{0,20}的?背景下/g,
  /随着[^。！？]{0,20}(?:发展|推进|深入|普及|兴起|变化)/g,
  /使得[^。！？]{0,20}得以/g,
  /(?:与此同时|在此基础上|具体而言|进一步来说|就此而言|从某种意义上(?:说|讲)|从某种角度(?:说|看))/g,
  /被认为是|被视为/g,
];

const NOMINALIZATION = [
  /进行(?:了|着)?[^。！？]{0,12}(?:讨论|分析|研究|处理|检查|评估|优化|调整|改进|测试|验证|梳理|复盘|推进|落实|部署)/g,
  /(?:作出|做出|予以|加以|给予)[^。！？]{0,12}(?:判断|处理|解决|回应|说明|安排|考虑|分析|评价|调整)/g,
  /(?:实现|推动|构建|形成|完成|开展|提升|强化|深化|优化)[^。！？]{0,10}(?:提升|优化|升级|转型|落地|闭环|突破|增长|发展|建设|管理|治理|协同)/g,
  /(?:进行|实现|推动|构建|形成|完成|开展|提升|强化|深化|优化|作出|做出|予以|加以|给予)[^。！？]{0,12}[一-龥]{2,}(?:性|化|度)/g,
];

const JARGON = /(?:赋能|抓手|闭环|颗粒度|底层逻辑|顶层设计|对齐|拉齐|沉淀|范式|生态位|链路|矩阵|中台|飞轮|破局|突围|组合拳|先手棋|压舱石|定盘星|风向标|助推器|新引擎|新动能|新质生产力|降本增效|护城河|打法|复盘|加持|助力|引爆|裂变|破圈|出圈|心智|势能|卡位|补位|错位|越位|归位|到位|缺位|失位|让位|站位|卡点|堵点|痛点|难点|爆点|爽点|泪点|笑点|记忆点|传播点|增长点|盈利点|风险点|落脚点|出发点|着力点|切入点|结合点|交汇点|平衡点|支撑点|发力点|突破口|重构|重塑|锚点|张力|叙事)/g;

const BODY_EMOTION = [
  /瞳孔(?:骤|猛|微|猛地|骤然)?(?:缩|一缩|紧缩)/g,
  /呼吸(?:一|骤|猛|猛地|骤然)?(?:滞|停|顿|屏|一窒)/g,
  /心脏(?:漏跳|骤停|猛地一跳|狂跳|一紧)/g,
  /指尖(?:泛白|发白|冰凉|颤抖|发凉)/g,
  /喉结(?:滚动|上下滑动|动了动|一滚)/g,
  /眼底(?:闪过|翻涌|划过|掠过|浮现|一沉)/g,
  /(?:空气|时间)(?:仿佛|似乎|好像)?(?:凝固|静止|停滞|安静)/g,
  /(?:一股|一阵|某种)[^。！？]{0,12}(?:涌上|袭来|泛上|漫上)(?:心头|心底|全身|心口)/g,
  /(?:五味杂陈|百感交集|说不出的|莫名的|复杂的)(?:情绪|滋味|感觉|不安)/g,
  /(?:嘴角|唇边)(?:勾起|扬起|弯起|扯出|浮现)/g,
  /(?:心中|心里)(?:一紧|一沉|一颤|发紧|发沉)/g,
  /(?:后背|脊背)(?:发凉|一凉|窜起|发寒)/g,
  /头皮(?:发麻|炸开|一麻)/g,
  /血液(?:凝固|倒流|一凉)/g,
  /大脑(?:空白|一片空白|嗡的一声)/g,
];

const EMOTION_LABELS = /(?:害怕|恐惧|愤怒|生气|委屈|难过|悲伤|开心|高兴|紧张|焦虑|不安|尴尬|羞愧|后悔|不甘|绝望|兴奋|激动|心疼|心酸|无奈|释然|愧疚|厌恶|惊讶|震惊|慌乱|担心|失望|孤独|疲惫|厌倦)/g;
const SOFT_ADVERBS = /(?:微微|缓缓|淡淡|轻轻|默默|静静|不由得|下意识|情不自禁|不知不觉)(?:地)?/g;

const DIALOGUE_TAGS = [
  ['淡淡道', /淡淡道/g],
  ['低声道', /低声道/g],
  ['沉声道', /沉声道/g],
  ['冷冷道', /冷冷道/g],
  ['轻声道', /轻声道/g],
  ['缓缓道', /缓缓道/g],
  ['平静道', /平静道/g],
  ['苦笑道', /苦笑道/g],
  ['冷笑道', /冷笑道/g],
  ['嗤笑道', /嗤笑道/g],
  ['开口道', /开口道/g],
  ['薄唇轻启', /薄唇轻启/g],
  ['嘴角勾起', /嘴角(?:勾起|扬起|弯起|扯出)/g],
  ['眼底闪过', /眼底(?:闪过|划过|掠过|浮现)/g],
  ['似笑非笑', /似笑非笑/g],
  ['意味深长', /意味深长/g],
];

const LECTURE_MARKERS = [
  /本质上/g,
  /真正重要的是/g,
  /归根结底/g,
  /说到底/g,
  /回到最初/g,
  /更重要的是/g,
  /关键在于/g,
  /问题在于/g,
  /核心在于/g,
  /重点在于/g,
  /这意味着/g,
  /这说明/g,
  /这告诉我们/g,
  /或许这就是/g,
  /也许这就是/g,
  /不得不说/g,
];

const SENTENCE_SPLIT = /(?<=[。！？…])/;
const QUOTE_PATTERN = /“[^”]*”|「[^」]*」|『[^』]*』|"[^"]*"/g;

function cjkCount(text) {
  return (String(text).match(/[\u3400-\u9fff]/g) || []).length;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function per1k(count, total) {
  return total > 0 ? round((1000 * count) / total) : 0;
}

function ratio(part, total) {
  return total > 0 ? round(part / total) : 0;
}

function sentencesOf(text) {
  return String(text)
    .replace(/^#.*$/m, '')
    .split(SENTENCE_SPLIT)
    .map((sentence) => sentence.trim())
    .filter((sentence) => cjkCount(sentence) > 0);
}

function firstSentence(text) {
  return sentencesOf(text)[0] || '';
}

function lastSentence(text) {
  const sentences = sentencesOf(text);
  return sentences[sentences.length - 1] || '';
}

function sentenceCount(text) {
  return sentencesOf(text).length;
}

function narrationOnly(text) {
  return String(text).replace(QUOTE_PATTERN, '');
}

function isDialogueParagraph(paragraph) {
  return /["“”「」『』]/.test(paragraph);
}

function isSystemParagraph(paragraph) {
  return /[【】]/.test(paragraph);
}

function isNarrationParagraph(paragraph) {
  return !isDialogueParagraph(paragraph) && !isSystemParagraph(paragraph);
}

function countMatches(text, patterns) {
  let total = 0;
  for (const pattern of patterns) {
    const matches = String(text).match(pattern);
    total += matches ? matches.length : 0;
  }
  return total;
}

function matchingSentences(sentences, patterns, limit = 6) {
  const matched = [];
  for (const sentence of sentences) {
    const hit = patterns.some((pattern) => {
      pattern.lastIndex = 0;
      return pattern.test(sentence);
    });
    if (hit) matched.push(sentence);
    if (matched.length >= limit) break;
  }
  return matched;
}

function hasLectureMarker(text) {
  return LECTURE_MARKERS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(String(text));
  });
}

function dialogueMetrics(paragraphs) {
  const dialogueParagraphs = paragraphs.filter(isDialogueParagraph);
  const oneLineDialogue = dialogueParagraphs.filter((paragraph) => sentenceCount(paragraph) <= 1).length;
  let qaRounds = 0;
  for (let index = 0; index < paragraphs.length - 1; index += 1) {
    const current = paragraphs[index];
    const next = paragraphs[index + 1];
    if (isDialogueParagraph(current) && /[？?]/.test(current) && isDialogueParagraph(next)) qaRounds += 1;
  }
  return {
    dialogueParagraphCount: dialogueParagraphs.length,
    dialogueParagraphRatio: ratio(dialogueParagraphs.length, paragraphs.length),
    oneLineDialogueRatio: dialogueParagraphs.length >= 4 ? ratio(oneLineDialogue, dialogueParagraphs.length) : 0,
    qaRoundCount: qaRounds,
  };
}

function paragraphMetrics(paragraphs) {
  const narrationParagraphs = paragraphs.filter(isNarrationParagraph);
  const singleSentence = narrationParagraphs.filter((paragraph) => sentenceCount(paragraph) <= 1).length;
  let maxConsecutive = 0;
  let currentRun = 0;
  for (const paragraph of paragraphs) {
    if (isNarrationParagraph(paragraph) && sentenceCount(paragraph) <= 1) {
      currentRun += 1;
      maxConsecutive = Math.max(maxConsecutive, currentRun);
    } else {
      currentRun = 0;
    }
  }
  return {
    narrationParagraphCount: narrationParagraphs.length,
    singleSentenceParagraphRatio: ratio(singleSentence, narrationParagraphs.length),
    consecutiveSingleSentenceParagraphs: maxConsecutive,
    singleSentenceParagraphExamples: narrationParagraphs
      .filter((paragraph) => sentenceCount(paragraph) <= 1)
      .slice(0, 6),
  };
}

function dialogueTagMetrics(text, cjk) {
  let total = 0;
  let distinct = 0;
  const examples = [];
  for (const [label, pattern] of DIALOGUE_TAGS) {
    const matches = String(text).match(pattern);
    if (!matches) continue;
    total += matches.length;
    distinct += 1;
    if (examples.length < 6) examples.push(label);
  }
  return {
    dialogueTagCount: total,
    dialogueTagPer1k: per1k(total, cjk),
    dialogueTagDiversity: total >= 4 ? ratio(distinct, total) : 1,
    dialogueTagExamples: examples,
  };
}

function chapterChineseMetrics(text, context = {}) {
  const source = String(text);
  const sentences = Array.isArray(context.sentences) ? context.sentences : sentencesOf(source);
  const paragraphs = Array.isArray(context.paragraphs) ? context.paragraphs : source.split(/\n\s*\n/);
  const cjk = Number.isFinite(context.cjk) ? context.cjk : cjkCount(source);
  const narration = narrationOnly(source);
  const narrationCjk = cjkCount(narration);
  const narrationSentences = sentencesOf(narration);
  const bodyEmotion = countMatches(source, BODY_EMOTION);
  const emotionLabels = countMatches(narration, [EMOTION_LABELS]);
  const dash = (source.match(/——/g) || []).length;
  const semicolons = (source.match(/；/g) || []).length;
  const colons = (source.match(/：/g) || []).length;
  const paragraph = paragraphMetrics(paragraphs);
  return {
    narrationCjk,
    translationesePer1k: per1k(countMatches(narration, TRANSLATIONESE), narrationCjk),
    translationeseExamples: matchingSentences(narrationSentences, TRANSLATIONESE),
    nominalizationPer1k: per1k(countMatches(narration, NOMINALIZATION), narrationCjk),
    nominalizationExamples: matchingSentences(narrationSentences, NOMINALIZATION),
    jargonPer1k: per1k(countMatches(narration, [JARGON]), narrationCjk),
    jargonExamples: matchingSentences(narrationSentences, [JARGON]),
    embodiedEmotionPer1k: per1k(bodyEmotion, cjk),
    embodiedEmotionExamples: matchingSentences(sentences, BODY_EMOTION),
    emotionLabelPer1k: per1k(emotionLabels, narrationCjk),
    emotionBodyShare: bodyEmotion + emotionLabels >= 3 ? ratio(bodyEmotion, bodyEmotion + emotionLabels) : 0,
    softAdverbPer1k: per1k(countMatches(narration, [SOFT_ADVERBS]), narrationCjk),
    softAdverbExamples: matchingSentences(narrationSentences, [SOFT_ADVERBS]),
    punctuationTicPer1k: per1k(dash + semicolons + colons, cjk),
    punctuationTicCounts: { dash, semicolons, colons },
    lectureMarkerPer1k: per1k(countMatches(narration, LECTURE_MARKERS), narrationCjk),
    lectureMarkerExamples: matchingSentences(narrationSentences, LECTURE_MARKERS),
    ...paragraph,
    ...dialogueMetrics(paragraphs),
    ...dialogueTagMetrics(source, cjk),
  };
}

export {
  cjkCount,
  chapterChineseMetrics,
  firstSentence,
  hasLectureMarker,
  isDialogueParagraph,
  lastSentence,
  narrationOnly,
  sentenceCount,
};
