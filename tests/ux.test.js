// UX/contract regressions: structured artifact errors, real paths in state.next,
// --ignore for check/audit, finding() based audit errors and command-scoped help.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { auditProject, initProject, loadProject } from '../scripts/project.js';
import { fixtureSet, sampleOutline, sampleSetup } from './fixtures.js';

const entry = path.resolve('scripts/wishmachine.js');
const { tempDir } = fixtureSet('wishmachine-ux-');
const SEVERITIES = ['critical', 'high', 'medium', 'low'];

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, TEMP: os.tmpdir(), TMP: os.tmpdir() },
  });
  let json;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    json = null;
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
}

function project(t) {
  const dir = tempDir(t);
  initProject({ name: 'ux', dir, parts: 1, volumes: 1, chapter: 2 });
  return dir;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

function ruleIds(result) {
  return result.json.findings.map((item) => item.rule_id);
}

test('check on a fresh project returns a structured missing-artifact finding and exits 2', (t) => {
  const dir = project(t);
  const result = run(['check', '--dir', dir, '--target', 'outline']);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.json.ok, false);
  assert.equal(result.json.blocking, true);
  assert.equal(result.json.error, undefined);
  const item = result.json.findings.find((finding) => finding.rule_id === 'artifact.outline.missing');
  assert.ok(item, `expected artifact.outline.missing, got ${JSON.stringify(result.json.findings)}`);
  assert.equal(item.severity, 'critical');
  assert.equal(item.target_id, 'outline');
  assert.match(item.suggestion, /book write outline/);
  assert.match(item.suggestion, /doctor/);
  const lenient = run(['check', '--dir', dir, '--target', 'outline', '--no-strict']);
  assert.equal(lenient.status, 0);
});

test('every check target reports artifact.<target>.missing instead of throwing', (t) => {
  const dir = project(t);
  for (const [target, extra] of [
    ['setup', []],
    ['outline', []],
    ['craft', []],
    ['chapter', ['--id', 'P1-V1-C1']],
    ['recap', ['--id', 'P1-V1-C1']],
  ]) {
    const result = run(['check', '--dir', dir, '--target', target, ...extra]);
    assert.equal(result.status, 2, `${target}: ${result.stderr}`);
    assert.equal(result.json.error, undefined, `${target} leaked a raw error`);
    assert.ok(
      ruleIds(result).includes(`artifact.${target}.missing`),
      `${target} expected artifact.${target}.missing, got ${ruleIds(result).join(',')}`,
    );
  }
});

test('corrupt JSON artifacts become artifact.<target>.invalid_json findings', (t) => {
  const dir = project(t);
  fs.mkdirSync(path.join(dir, 'story', 'recaps'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'story', 'craft'), { recursive: true });
  const files = {
    setup: path.join(dir, 'story', 'setup', 'story_setup.json'),
    outline: path.join(dir, 'story', 'compose', 'outline.json'),
    craft: path.join(dir, 'story', 'craft', 'character.json'),
    recap: path.join(dir, 'story', 'recaps', 'P1-V1-C1.json'),
  };
  for (const file of Object.values(files)) fs.writeFileSync(file, '{not json');
  for (const target of Object.keys(files)) {
    const extra = ['chapter', 'recap'].includes(target) ? ['--id', 'P1-V1-C1'] : [];
    const result = run(['check', '--dir', dir, '--target', target, ...extra]);
    assert.equal(result.status, 2, `${target}: ${result.stderr}`);
    assert.equal(result.json.error, undefined, `${target} leaked a raw error`);
    const item = result.json.findings.find((finding) => finding.rule_id === `artifact.${target}.invalid_json`);
    assert.ok(item, `${target} expected artifact.${target}.invalid_json, got ${ruleIds(result).join(',')}`);
    assert.equal(item.severity, 'critical');
  }
  // doctor keeps its own contract: issues[].code stays artifact.invalid_json.
  const doctor = run(['doctor', '--dir', dir]);
  assert.equal(doctor.status, 2);
  assert.equal(doctor.json.error, undefined);
  const codes = doctor.json.issues.map((issue) => issue.code);
  assert.ok(codes.includes('artifact.invalid_json'));
  assert.ok(doctor.json.issues.some((issue) => String(issue.message).includes('story_setup.json')));
});

test('audit reports corrupt artifacts as findings and honors ignore filters', (t) => {
  const dir = project(t);
  fs.writeFileSync(path.join(dir, 'story', 'compose', 'outline.json'), '{not json');
  const strict = run(['audit', '--dir', dir, '--view', 'full']);
  assert.equal(strict.status, 2, strict.stderr);
  assert.equal(strict.json.ok, false);
  assert.equal(strict.json.blocking, true);
  assert.equal(strict.json.error, undefined);
  const outline = strict.json.targets.find((target) => target.target === 'outline');
  assert.ok(outline.findings.some((finding) => finding.rule_id === 'artifact.outline.invalid_json'));
  assert.ok(strict.json.top_findings.some((finding) => (
    finding.rule_id === 'artifact.outline.invalid_json' && finding.audit_target === 'outline'
  )));
  const ignored = run(['audit', '--dir', dir, '--ignore', 'artifact.outline.invalid_json']);
  assert.equal(ignored.status, 0, ignored.stderr);
  assert.equal(ignored.json.ok, true);
  assert.equal(ignored.json.summary.ignored_findings, 1);
  assert.equal(ignored.json.summary.ignored_rules['artifact.outline.invalid_json'], 1);
  assert.equal(ignored.json.top_findings.length, 0);
});

test('check --ignore/--ignore-file suppress findings, blocking and expose counts', (t) => {
  const dir = project(t);
  fs.writeFileSync(path.join(dir, 'story', 'compose', 'outline.json'), '{not json');
  const flagged = run(['check', '--dir', dir, '--target', 'outline', '--ignore', 'artifact.outline.invalid_json']);
  assert.equal(flagged.status, 0, flagged.stderr);
  assert.equal(flagged.json.ok, true);
  assert.equal(flagged.json.blocking, false);
  assert.deepEqual(flagged.json.findings, []);
  assert.equal(flagged.json.summary.ignored_findings, 1);
  assert.equal(flagged.json.ignored_findings, 1);
  assert.equal(flagged.json.summary.ignored_rules['artifact.outline.invalid_json'], 1);

  const asArray = path.join(dir, 'ignore-array.json');
  fs.writeFileSync(asArray, JSON.stringify(['artifact.outline.invalid_json']));
  const arrayForm = run(['check', '--dir', dir, '--target', 'outline', '--ignore-file', asArray]);
  assert.equal(arrayForm.status, 0, arrayForm.stderr);
  assert.deepEqual(arrayForm.json.findings, []);

  const asRules = path.join(dir, 'ignore-rules.json');
  fs.writeFileSync(asRules, JSON.stringify({ rules: ['artifact.outline.invalid_json', 'quality.none'] }));
  const rulesForm = run(['audit', '--dir', dir, '--ignore-file', asRules]);
  assert.equal(rulesForm.status, 0, rulesForm.stderr);
  assert.equal(rulesForm.json.summary.ignored_findings, 1);

  const unknown = run(['check', '--dir', dir, '--ignore', 'x', '--bogus']);
  assert.equal(unknown.status, 1);
  assert.match(unknown.json.error.message, /unknown flag: --bogus/);
  const missingFile = run(['check', '--dir', dir, '--ignore-file', path.join(dir, 'nope.json')]);
  assert.equal(missingFile.status, 1);
  assert.match(missingFile.json.error.message, /cannot read --ignore-file/);
  const brokenFile = path.join(dir, 'ignore-broken.json');
  fs.writeFileSync(brokenFile, '{not json');
  const broken = run(['check', '--dir', dir, '--ignore-file', brokenFile]);
  assert.equal(broken.status, 1);
  assert.match(broken.json.error.message, /cannot read --ignore-file/);
});

test('check --ignore only removes the matching rule ids', (t) => {
  const dir = project(t);
  writeJson(path.join(dir, 'story', 'setup', 'story_setup.json'), {});
  const quality = run(['check', '--dir', dir, '--target', 'setup', '--profile', 'quality', '--no-strict']);
  assert.equal(quality.status, 0);
  const ids = ruleIds(quality);
  assert.ok(ids.includes('quality.setup.premise'));
  assert.ok(ids.includes('quality.setup.protagonist'));
  const filtered = run([
    'check', '--dir', dir, '--target', 'setup', '--profile', 'quality',
    '--ignore', 'quality.setup.premise', '--no-strict',
  ]);
  assert.ok(!ruleIds(filtered).includes('quality.setup.premise'));
  assert.ok(ruleIds(filtered).includes('quality.setup.protagonist'));
  assert.equal(filtered.json.summary.ignored_findings, 1);
  assert.equal(filtered.json.summary.ignored_rules['quality.setup.premise'], 1);
  assert.equal(filtered.json.summary.total, ids.length - 1);
});

test('audit unexpected failures use finding() shape with a namespaced rule id', (t) => {
  const dir = project(t);
  fs.writeFileSync(path.join(dir, 'chapters', '..md'), 'chapter with an unusable id');
  const audit = auditProject(loadProject(dir), { view: 'full' });
  const target = audit.targets.find((item) => item.target === 'chapter' && item.id === '.');
  assert.ok(target, `expected a chapter target for id ".", got ${JSON.stringify(audit.targets)}`);
  const item = target.findings[0];
  assert.equal(item.rule_id, 'quality.audit.error');
  assert.match(item.id, /^finding-[0-9a-f]{8}$/);
  assert.ok(SEVERITIES.includes(item.severity), `invalid severity ${item.severity}`);
  assert.equal(typeof item.issue, 'string');
  assert.ok(item.suggestion.length > 0);
  assert.equal(Object.keys(item).sort().join(','), 'id,issue,rule_id,severity,suggestion,target_id');
  assert.equal(audit.blocking, true);
});

test('state.next command and fast_path embed the real project root', (t) => {
  const dir = project(t);
  const state = run(['state', '--dir', dir]);
  assert.equal(state.status, 0, state.stderr);
  const next = state.json.state.next;
  assert.equal(next.stage, 'setup');
  assert.ok(next.command.includes(dir), next.command);
  assert.ok(next.command.includes('--dir'));
  assert.ok(!next.command.includes('<project>'));
  assert.ok(next.fast_path.includes(dir), next.fast_path);
  assert.ok(!next.fast_path.includes('<project>'));

  writeJson(path.join(dir, 'story', 'setup', 'story_setup.json'), sampleSetup());
  writeJson(path.join(dir, 'story', 'compose', 'outline.json'), sampleOutline());
  const outlineState = run(['state', '--dir', dir]);
  assert.equal(outlineState.json.state.next.stage, 'write');
  assert.ok(outlineState.json.state.next.command.includes(dir));
  assert.ok(outlineState.json.state.next.command.includes('--id P1-V1-C1'));

  for (const part of sampleOutline().parts) {
    for (const volume of part.volumes) {
      for (const chapter of volume.chapters) {
        fs.writeFileSync(path.join(dir, 'chapters', `${chapter.id}.md`), '# chapter\n');
      }
    }
  }
  const complete = run(['state', '--dir', dir]);
  assert.equal(complete.json.state.next.stage, 'complete');
  assert.match(complete.json.state.next.command, /export --dir .* --format book$/);
  assert.ok(complete.json.state.next.command.includes(dir));
});

test('state.next quotes project paths that contain spaces', (t) => {
  const root = path.join(tempDir(t), 'my book');
  initProject({ name: 'spaced', dir: root, parts: 1, volumes: 1, chapter: 2 });
  const result = run(['state', '--dir', root]);
  assert.equal(result.status, 0, result.stderr);
  const next = result.json.state.next;
  assert.ok(next.command.includes(`--dir "${root}"`), next.command);
  assert.ok(next.fast_path.includes(`--dir "${root}"`), next.fast_path);
});

test('per-command --help is scoped while bare --help stays global', () => {
  const bare = run(['--help']);
  assert.equal(bare.status, 0);
  assert.match(bare.stdout, /Commands:/);
  assert.match(bare.stdout, /Output contract:/);
  const noArgs = run([]);
  assert.equal(noArgs.status, 0);
  assert.match(noArgs.stdout, /Commands:/);

  const scoped = {
    check: ['check', '--help'],
    state: ['state', '--help'],
    audit: ['audit', '--help'],
    bookInit: ['book', 'init', '--help'],
    bookWrite: ['book', 'write', '--help'],
    bookGroup: ['book', '--help'],
    bookRegistry: ['book', 'registry', 'log', '--help'],
    ideasGroup: ['ideas', '--help'],
    ideasDraw: ['ideas', 'draw', '--help'],
    ideasValidate: ['ideas', 'validate', '--help'],
    genWorkflow: ['gen', 'workflow', '--help'],
  };
  for (const [name, args] of Object.entries(scoped)) {
    const result = run(args);
    assert.equal(result.status, 0, `${name}: ${result.stderr}`);
    assert.match(result.stdout, /Usage:/, `${name} should print scoped usage`);
    assert.match(result.stdout, /Run "wishmachine --help" for the full command list\./, name);
  }
  assert.match(run(['check', '--help']).stdout, /--ignore-file/);
  assert.match(run(['ideas', 'validate', '--help']).stdout, /--ignore-file/);
  assert.match(run(['book', 'write', '--help']).stdout, /--from-idea/);
  assert.match(run(['book', 'registry', 'log', '--help']).stdout, /--limit/);
  assert.match(run(['gen', 'workflow', '--help']).stdout, /gen workflow list/);
  const checkHelp = run(['check', '--help']).stdout;
  assert.ok(!checkHelp.includes('book registry abandon'), 'scoped help must not dump the global list');

  const unknown = run(['nope', '--help']);
  assert.equal(unknown.status, 1);
  assert.equal(unknown.json.error.code, 'usage.unknown_command');
});
