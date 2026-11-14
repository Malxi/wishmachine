// Chinese prose tells: translationese, nominalization, jargon, body-performance
// emotion, soft adverbs, dialogue tags and subtitle-like paragraphs. These are
// advisory signals, so the tests lock both detection and low false positives.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, auditProject } from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import { chapterMetrics } from '../scripts/rules/style/metrics.js';
import { fixtureSet } from './fixtures.js';

const { tempProject } = fixtureSet('wishmachine-style-chinese-');

function writeChapter(dir, id, text) {
  const file = path.join(dir, 'chapters', `${id}.md`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}

const AI_CHAPTER = `# 第一章

在当今快速变化的时代背景下，团队对于协同效率的追求，使得流程得以不断优化。与此同时，我们进行了系统性的复盘，形成了闭环，实现了能力的提升。

他瞳孔骤缩，呼吸一滞，心脏漏跳了一拍。空气中仿佛弥漫着说不出的压抑。他微微皱眉，缓缓开口，淡淡道：“本质上，这不是一次普通延期，而是协作机制的重构。”

“你确定？”她低声问道。

“确定。”

“那为什么？”

“因为流程。”

“流程哪里有问题？”

“问题在于没有人拍板。”

本质上，真正重要的是，这意味着团队需要对齐颗粒度，打通底层逻辑，形成新的抓手。

没响。

没动。

他站着。

她坐着。

他看着窗外。
`;

const HUMAN_CHAPTER = `# 第一章

周辙把自行车推进闸口，前轮擦着铁皮，发出一点短促的响。清点员从上面探下头，问：“实载几件？”

“两件。”周辙说。

“准载一件。”

丁小满坐在后座，书包横在腿上，没动。她看了看闸门顶上那排黄灯，又低头去看自己的鞋尖。周辙把车梯踢下来，从口袋里摸出一张折过的纸，展开，对着机器上的字看了半天。

后面有人按铃。他没回头，只把纸塞进闸机口。机器响了一声，又把纸吐出来。

“申报不实。”清点员说。

丁小满忽然把书包背起来，整个人缩到后座和车架之间：“我与自行车融为一体了。”

周辙看她一眼，笑了一声，在物品栏里写下“扳手一把”。这回机器没吐纸，停了一会儿，闸门开了。
`;

test('Chinese prose metrics catch translationese, jargon, body clichés and subtitle paragraphs', () => {
  const metrics = chapterMetrics(AI_CHAPTER);
  assert.ok(metrics.translationesePer1k > 2, JSON.stringify(metrics));
  assert.ok(metrics.nominalizationPer1k > 2);
  assert.ok(metrics.jargonPer1k > 2);
  assert.ok(metrics.embodiedEmotionPer1k > 2);
  assert.ok(metrics.softAdverbPer1k > 8);
  assert.ok(metrics.dialogueTagPer1k > 2);
  assert.ok(metrics.lectureMarkerPer1k > 2);
  assert.ok(metrics.singleSentenceParagraphRatio > 0.5);
  assert.ok(metrics.consecutiveSingleSentenceParagraphs >= 3);
  assert.ok(metrics.qaRoundCount >= 3);
  assert.ok(metrics.oneLineDialogueRatio > 0.5);
  assert.ok(metrics.emotionBodyShare > 0.8);
  assert.ok(metrics.translationeseExamples.length > 0);
});

test('Chinese prose metrics stay quiet on a plain human dialogue scene', () => {
  const metrics = chapterMetrics(HUMAN_CHAPTER);
  assert.equal(metrics.translationesePer1k, 0);
  assert.equal(metrics.nominalizationPer1k, 0);
  assert.equal(metrics.jargonPer1k, 0);
  assert.equal(metrics.embodiedEmotionPer1k, 0);
  assert.equal(metrics.softAdverbPer1k, 0);
  assert.equal(metrics.dialogueTagPer1k, 0);
  assert.equal(metrics.lectureMarkerPer1k, 0);
  assert.equal(metrics.singleSentenceParagraphRatio, 0);
  assert.equal(metrics.consecutiveSingleSentenceParagraphs, 0);
  assert.ok(metrics.dialogueParagraphRatio <= 0.75);
});

test('style check surfaces the new Chinese findings without blocking', (t) => {
  const { dir } = tempProject(t, { name: 'chinese style', init: { chapter: 1 } });
  writeChapter(dir, 'P1-V1-C1', AI_CHAPTER);
  const result = checkProject(loadProject(dir), { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  const rules = new Set(result.findings.map((item) => item.rule_id));
  for (const rule of [
    'style.chapter.translationese',
    'style.chapter.nominalization',
    'style.chapter.jargon',
    'style.chapter.emotion_body',
    'style.chapter.soft_adverbs',
    'style.chapter.dialogue_tags',
    'style.chapter.subtitle_paragraphs',
    'style.chapter.subtitle_run',
    'style.chapter.lecture_markers',
    'style.chapter.qa_rounds',
    'style.chapter.one_line_dialogue',
  ]) {
    assert.ok(rules.has(rule), `${rule} missing from ${[...rules].join(',')}`);
  }
  assert.equal(result.blocking, false);
  assert.ok(result.findings.every((item) => item.severity === 'low' || item.severity === 'medium'));
});

test('book audit flags repeated chapter shape and theme-explaining endings', (t) => {
  const { dir } = tempProject(t, { name: 'book shape', init: { chapter: 3 } });
  for (const [id, title] of [['P1-V1-C1', '第一章'], ['P1-V1-C2', '第二章'], ['P1-V1-C3', '第三章']]) {
    writeChapter(dir, id, `# ${title}

他推开门，屋里没有人。桌上放着一只旧碗，碗边有一道缺口。他把碗收进包里，转身出去。

本质上，这一切都说明他终究还是放不下。
`);
  }
  const result = auditProject(loadProject(dir), { profile: 'style', view: 'full' });
  const rules = new Set(result.findings.map((item) => item.rule_id));
  assert.ok(rules.has('style.book.shape_convergence'), JSON.stringify([...rules]));
  assert.ok(rules.has('style.book.theme_explicitness'), JSON.stringify([...rules]));
  assert.equal(result.chapters.length, 3);
  assert.ok(result.chapters.every((chapter) => chapter.shape?.opening === 'narration'));
});

test('new thresholds are configurable per project', (t) => {
  const { dir } = tempProject(t, { name: 'thresholds', init: { chapter: 1 } });
  writeChapter(dir, 'P1-V1-C1', AI_CHAPTER);
  const project = loadProject(dir);
  project.config.style = { chapter: { translationesePer1k: { warn: 0.01, risk: 0.02 } } };
  const result = checkProject(project, { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  assert.ok(result.findings.some((item) => item.rule_id === 'style.chapter.translationese'));
});
