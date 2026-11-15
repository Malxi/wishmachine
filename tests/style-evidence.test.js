// Style findings must be actionable: every rule that can point at prose carries the matched
// sentences in `evidence`, so an agent does not have to re-scan the chapter to find them.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadProject } from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import { chapterMetrics } from '../scripts/rules/style/metrics.js';
import { fixtureSet } from './fixtures.js';

const { tempProject } = fixtureSet('wishmachine-style-evidence-');

const EVIDENCE_RULES = [
  'style.chapter.template_connectors',
  'style.chapter.simile_density',
  'style.chapter.subject_openers',
];

test('最后 只在序列或句首出现时算模板连接句', () => {
  const text = '报告翻到最后一页。连最后一个数字都分毫不差。他先看封条，再看温度，最后把手电照进凹槽。最后，他把纸折好。';
  const metrics = chapterMetrics(text, {});
  assert.equal(metrics.templateConnectors, 2, 'only the 先…最后 series and the clause-initial 最后， count');
  assert.deepEqual(metrics.templateExamples, [
    '他先看封条，再看温度，最后把手电照进凹槽。',
    '最后，他把纸折好。',
  ]);
});

test('style findings carry the matched sentences as evidence', (t) => {
  const { dir, project } = tempProject(t, { init: { volumes: 1, chapter: 1, genre: '悬疑' } });
  const text = [
    '罗观衡把报告推到桌角。他不是没看见，而是不想看见。',
    '罗观衡先看封条，再看温度，最后把手电照进凹槽。',
    '罗观衡抬头。罗观衡站着。罗观衡没答。',
    '窗外的风像有人磨牙，又像纸在刮。',
    '陆停云低头看纸。',
  ].join('\n\n');
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'chapters', 'P1-V1-C1.md'), `# 第1章 试\n\n${text}\n`);
  const loaded = loadProject(dir);
  assert.equal(loaded.dir, project.dir);
  const result = checkProject(loaded, { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  const findings = result.findings || [];
  const checked = findings.filter((item) => EVIDENCE_RULES.includes(item.rule_id));
  assert.ok(checked.length >= 1, `expected at least one evidence rule to fire, got ${findings.map((f) => f.rule_id).join(',')}`);
  for (const item of checked) {
    assert.ok(Array.isArray(item.evidence) && item.evidence.length > 0,
      `${item.rule_id} must carry evidence sentences`);
  }
  const template = findings.find((item) => item.rule_id === 'style.chapter.template_connectors');
  assert.ok(template, 'the 不是…而是 + 先…最后 chapter must trip the template rule');
  assert.ok(template.evidence.some((sentence) => sentence.includes('先看封条')),
    'template evidence must point at the 先…最后 sentence');
});

test('三段式序列脚手架一章出现一次也报，并带命中句', (t) => {
  const { dir } = tempProject(t, { init: { volumes: 1, chapter: 1, genre: '悬疑' } });
  const text = [
    '闻既白闭上眼。闻既白先报天气，再报路灯，最后说穿雨衣的人走进北槐路地下室。',
    '陆停云低头看纸。她把纸推回来。纸边发黄。',
  ].join('\n\n');
  fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'chapters', 'P1-V1-C1.md'), `# 第1章 试\n\n${text}\n`);
  const result = checkProject(loadProject(dir), { profile: 'style', target: 'chapter', id: 'P1-V1-C1' });
  const hit = (result.findings || []).find((item) => item.rule_id === 'style.chapter.sequence_scaffold');
  assert.ok(hit, 'a 先…再…最后 sentence must be reported even once');
  assert.ok(hit.evidence.some((sentence) => sentence.includes('先报天气')), 'evidence must point at the scaffold sentence');
});
