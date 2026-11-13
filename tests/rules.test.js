// Rule engine contract: builtin custom rules, project rules, check profiles and
// the severity/finding filters that used to fail open.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadProject, writeArtifact } from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import { fixtureSet, sampleSetup } from './fixtures.js';

const { tempProject } = fixtureSet('wishmachine-rules-');

test('mistyped setup arrays produce findings instead of throwing', (t) => {
  const { dir } = tempProject(t, { name: 'dirty setup', init: { chapter: 1 } });
  const dirty = {
    ...sampleSetup(),
    core_cast: 'oops',
    storylines: 5,
    premises: {},
    world_resources: true,
    world_timeline: 'x',
  };
  fs.writeFileSync(path.join(dir, 'story', 'setup', 'story_setup.json'), JSON.stringify(dirty));
  const check = checkProject(loadProject(dir), { profile: 'all', target: 'setup' });
  assert.equal(check.blocking, true);
  for (const key of ['core_cast', 'storylines', 'premises', 'world_resources', 'world_timeline']) {
    assert.ok(
      check.findings.some((item) => item.rule_id === `schema.setup.${key}`),
      `expected schema.setup.${key} for mistyped array`,
    );
  }
});

test('builtin custom rules are loaded', (t) => {
  const { dir } = tempProject(t, { name: 'rule test', init: { chapter: 1 } });
  const text = `他突然醒来，发现一切都是梦。${'他把这个念头按下去，继续检查氧气，记录时辰。'.repeat(120)}`;
  writeArtifact(loadProject(dir), { section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true, content: text });
  const check = checkProject(loadProject(dir), { profile: 'custom', target: 'chapter', id: 'P1-V1-C1' });
  assert.ok(check.findings.some((item) => item.rule_id === 'builtin.no-deus-ex'));
});

test('project custom rule blocks candidate write', (t) => {
  const { dir } = tempProject(t, { name: 'custom rule write', init: { chapter: 1 } });
  const ruleDir = path.join(dir, '.wishmachine', 'rules');
  fs.mkdirSync(ruleDir, { recursive: true });
  fs.writeFileSync(path.join(ruleDir, 'forbidden.json'), JSON.stringify({
    id: 'project.forbidden', target: 'chapter', severity: 'high', kind: 'contains', pattern: '禁忌', message: 'forbidden word',
  }));
  const result = writeArtifact(loadProject(dir), {
    section: 'chapter', id: 'P1-V1-C1', mode: 'replace', apply: true,
    content: `这里出现了禁忌。${'正常的正文继续推进。'.repeat(20)}`,
  });
  assert.equal(result.ok, false);
  assert.equal(result.applied, false);
  assert.ok(result.check.findings.some((item) => item.rule_id === 'project.forbidden'));
  assert.equal(fs.existsSync(path.join(dir, 'chapters', 'P1-V1-C1.md')), false);
});

test('placeholder custom rule applies to setup', (t) => {
  const { dir } = tempProject(t, { name: 'placeholder test', init: { chapter: 1 } });
  const placeholder = sampleSetup();
  placeholder.premise = '待填写';
  const result = writeArtifact(loadProject(dir), { section: 'setup', mode: 'replace', apply: true, content: JSON.stringify(placeholder) });
  assert.equal(result.applied, true);
  const check = checkProject(loadProject(dir), { profile: 'custom', target: 'setup' });
  assert.ok(check.findings.some((item) => item.rule_id === 'builtin.no-placeholder'));
});

test('check profiles scope schema, quality and custom findings', (t) => {
  const { dir } = tempProject(t, { name: 'profiles', init: { chapter: 1 } });
  fs.writeFileSync(path.join(dir, 'story', 'setup', 'story_setup.json'), JSON.stringify({ project_name: 'x', premise: '待填写' }));

  const schema = checkProject(loadProject(dir), { profile: 'schema', target: 'setup' });
  assert.ok(schema.findings.some((finding) => finding.rule_id.startsWith('schema.')));
  assert.ok(!schema.findings.some((finding) => finding.rule_id === 'builtin.no-placeholder'));

  const custom = checkProject(loadProject(dir), { profile: 'custom', target: 'setup' });
  assert.ok(custom.findings.some((finding) => finding.rule_id === 'builtin.no-placeholder'));
  assert.ok(!custom.findings.some((finding) => finding.rule_id.startsWith('schema.')));

  const quality = checkProject(loadProject(dir), { profile: 'quality', target: 'setup' });
  assert.ok(quality.findings.every((finding) => finding.rule_id.startsWith('quality.')));

  const all = checkProject(loadProject(dir), { profile: 'all', target: 'setup' });
  for (const finding of [...schema.findings, ...custom.findings]) {
    assert.ok(all.findings.some((item) => item.rule_id === finding.rule_id), `all profile should include ${finding.rule_id}`);
  }
  for (const finding of all.findings) assert.match(finding.id, /^finding-[0-9a-f]{8}$/);
  assert.equal(new Set(all.findings.map((finding) => finding.id)).size, all.findings.length);

  // --min-severity filters the visible list but the summary and blocking flag are
  // computed from the unfiltered findings (no more false green).
  const visible = checkProject(loadProject(dir), { profile: 'all', target: 'setup', minSeverity: 'high' });
  assert.ok(visible.findings.every((finding) => ['high', 'critical'].includes(finding.severity)));
  assert.ok(visible.filtered_out > 0);
  assert.equal(visible.summary.total, all.findings.length);
  assert.equal(visible.blocking, all.blocking);
});

test('checkProject rejects unknown profile, target and severity values', (t) => {
  const { dir } = tempProject(t, { name: 'check validation', init: { chapter: 1 } });
  const project = loadProject(dir);
  assert.throws(() => checkProject(project, { profile: 'qualty', target: 'setup' }), /unknown check profile/);
  assert.throws(() => checkProject(project, { profile: 'schema', target: 'volume' }), /unsupported check target/);
  assert.throws(() => checkProject(project, { profile: 'schema', target: 'setup', minSeverity: 'nope' }), /unknown min-severity/);
  assert.throws(() => checkProject(project, { profile: 'schema', target: 'chapter' }), /requires --id/);
});
