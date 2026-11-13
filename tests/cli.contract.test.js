import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { initProject } from '../scripts/project.js';
import { drawIdeas } from '../scripts/ideas.js';
import { fixtureSet, outlinepack, sampleSetup } from './fixtures.js';

const entry = path.resolve('scripts/wishmachine.js');
const { tempDir } = fixtureSet('wishmachine-contract-');

function run(args, options = {}) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || process.cwd(),
    input: options.input,
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
  initProject({ name: 'contract', dir, parts: 1, volumes: 1, chapter: 2 });
  return dir;
}

test('unknown flags fail with a JSON error instead of being ignored', () => {
  const result = run(['state', '--foo', 'bar']);
  assert.equal(result.status, 1);
  assert.equal(result.json.ok, false);
  assert.match(result.json.error.message, /unknown flag: --foo/);
  assert.match(result.stderr, /wishmachine: unknown flag/);
});

test('short unknown flags are rejected', () => {
  const result = run(['state', '-x']);
  assert.equal(result.status, 1);
  assert.equal(result.json.ok, false);
  assert.match(result.json.error.message, /unknown flag: -x/);
});

test('invalid enum values are rejected instead of silently skipping checks', (t) => {
  const dir = project(t);
  const profile = run(['check', '--dir', dir, '--profile', 'qualty', '--target', 'setup']);
  assert.equal(profile.status, 1);
  assert.match(profile.json.error.message, /invalid value for --profile/);
  const severity = run(['check', '--dir', dir, '--target', 'setup', '--min-severity', 'nope']);
  assert.equal(severity.status, 1);
  assert.match(severity.json.error.message, /invalid value for --min-severity/);
});

test('value flags require an explicit value', (t) => {
  const dir = project(t);
  const result = run(['check', '--dir', dir, '--target']);
  assert.equal(result.status, 1);
  assert.match(result.json.error.message, /--target requires a value/);
  const int = run(['ideas', 'draw', '--type', 'namecard', '--count']);
  assert.equal(int.status, 1);
  assert.match(int.json.error.message, /--count requires a number/);
});

test('blocking checks exit with code 2 unless --no-strict is passed', (t) => {
  const dir = project(t);
  const setupFile = path.join(dir, 'story', 'setup', 'story_setup.json');
  fs.writeFileSync(setupFile, JSON.stringify({ project_name: 'broken' }));
  const strict = run(['check', '--dir', dir, '--profile', 'schema', '--target', 'setup']);
  assert.equal(strict.status, 2);
  assert.equal(strict.json.blocking, true);
  assert.ok(strict.json.findings.some((item) => item.rule_id === 'schema.setup.premise'));
  const lenient = run(['check', '--dir', dir, '--profile', 'schema', '--target', 'setup', '--no-strict']);
  assert.equal(lenient.status, 0);
});

test('check findings are deduplicated, sorted and stable', (t) => {
  const dir = project(t);
  fs.writeFileSync(path.join(dir, 'story', 'setup', 'story_setup.json'), JSON.stringify({ project_name: 'broken' }));
  const first = run(['check', '--dir', dir, '--profile', 'schema', '--target', 'setup', '--no-strict']);
  const ids = first.json.findings.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const finding of first.json.findings) assert.match(finding.id, /^finding-[0-9a-f]{8}$/);
  const second = run(['check', '--dir', dir, '--profile', 'schema', '--target', 'setup', '--no-strict']);
  assert.deepEqual(second.json.findings.map((item) => item.id), ids);
});

test('invalid --dir never falls back to an ancestor project', (t) => {
  const dir = project(t);
  const nested = path.join(dir, 'story');
  const result = run(['state', '--dir', path.join(nested, 'typo')], { cwd: nested });
  assert.equal(result.status, 1);
  assert.equal(result.json.ok, false);
  assert.match(result.json.error.message, /no novel\.json found/);
  assert.ok(result.json.error.message.includes('typo'));
});

test('--mode append is rejected for JSON artifacts instead of silently replacing them', (t) => {
  const dir = project(t);
  const result = run(['book', 'write', 'setup', '--dir', dir, '--mode', 'append'], {
    input: JSON.stringify({ project_name: 'x', premise: 'y', theme: 'z' }),
  });
  assert.equal(result.status, 1);
  assert.match(result.json.error.message, /setup mode must be replace or patch/);
  assert.equal(fs.existsSync(path.join(dir, 'story', 'setup', 'story_setup.json')), false);
});

test('ideas --save returns a small envelope instead of the whole draw', (t) => {
  const dir = project(t);
  const result = run(['ideas', 'draw', '--type', 'outlinepack', '--genre', '悬疑', '--chapters', '3', '--seed', '42', '--dir', dir, '--save']);
  assert.equal(result.status, 0);
  assert.equal(result.json.ok, true);
  assert.ok(result.json.saved.id);
  assert.ok(result.json.saved.bytes > 0);
  assert.equal(result.json.results, undefined);
  assert.ok(result.stdout.length < 4000, `save envelope too large: ${result.stdout.length}`);
  const listed = run(['book', 'read', 'ideas', '--dir', dir]);
  assert.equal(listed.status, 0);
  assert.match(listed.json.hint, /timestamped/);
  assert.equal(listed.json.results[0].type, 'outlinepack');
  assert.equal(typeof listed.json.results[0].seed, 'number');
  assert.match(listed.json.results[0].saved_at, /^\d{8}_\d{6}$/);
  const summary = run(['book', 'read', 'idea', '--dir', dir, '--id', result.json.saved.id]);
  assert.equal(summary.status, 0);
  assert.equal(summary.json.view, 'summary');
  assert.ok(summary.json.summary.count >= 1);
  assert.ok(summary.stdout.length < 4000);
  const full = run(['book', 'read', 'idea', '--dir', dir, '--id', result.json.saved.id, '--view', 'full']);
  assert.ok(full.json.draw.results.length >= 1);
});

test('--from-idea rejects card ids with a hint pointing at the timestamped saved id', (t) => {
  const dir = project(t);
  const result = run(['book', 'write', 'setup', '--dir', dir, '--from-idea', 'outlinepack-42-01', '--mode', 'replace']);
  assert.equal(result.status, 1);
  assert.equal(result.json.error.code, 'idea.not_found');
  assert.match(result.json.error.hint, /timestamped/);
});

test('composite idea draws default to one pack and clamp huge counts', () => {
  const single = drawIdeas({ type: 'outlinepack', genre: '科幻', seed: 3, chapters: 3 });
  assert.equal(single.results.length, 1);
  assert.equal(single.query.count, 1);
  const clamped = drawIdeas({ type: 'namecard', count: 999, seed: 3 });
  assert.equal(clamped.results.length, 50);
  assert.ok(clamped.meta.warnings.some((message) => message.includes('clamped')));
});

test('research writes are dry-run unless --apply is passed', (t) => {
  const dir = project(t);
  const report = JSON.stringify({ pack_id: 'p1', entities: [], relations: [] });
  const dry = run(['book', 'write', 'research', '--dir', dir, '--id', 'p1'], { input: report });
  assert.equal(dry.status, 0);
  assert.equal(dry.json.dry_run, true);
  assert.equal(fs.existsSync(path.join(dir, 'story', 'research', 'p1.json')), false);
  const applied = run(['book', 'write', 'research', '--dir', dir, '--id', 'p1', '--apply'], { input: report });
  assert.equal(applied.status, 0);
  assert.ok(fs.existsSync(path.join(dir, 'story', 'research', 'p1.json')));
});

test('version and help stay on stdout as plain text', () => {
  const version = run(['version']);
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^wishmachine \d+\.\d+\.\d+/);
  const help = run(['help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Output contract:/);
});

test('unknown commands return a JSON error with an exhaustive hint', () => {
  const result = run(['nope']);
  assert.equal(result.status, 1);
  assert.equal(result.json.error.code, 'usage.unknown_command');
  assert.match(result.json.error.hint, /commands:/);
});

test('ideas draw --output writes the full draw and keeps stdout small', (t) => {
  const outputFile = path.join(tempDir(t), 'nested', 'draw.json');
  const result = run(['ideas', 'draw', '--type', 'outlinepack', '--genre', '悬疑', '--chapters', '3', '--seed', '42', '--output', outputFile]);
  assert.equal(result.status, 0);
  assert.equal(result.json.ok, true);
  assert.equal(result.json.output, outputFile);
  assert.ok(result.json.bytes > 0);
  assert.equal(result.json.results, undefined);
  assert.equal(result.json.query.seed, 42);
  assert.equal(result.json.count, 1);
  assert.ok(result.stdout.length < 4000, `output envelope too large: ${result.stdout.length}`);
  const written = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  assert.equal(written.ok, true);
  assert.equal(written.results.length, 1);
  assert.equal(written.query.seed, 42);
});

test('book write reports a post-write warning although the artifact was applied', (t) => {
  const dir = tempDir(t);
  initProject({ name: 'contract', dir, parts: 1, volumes: 1, chapter: 10 });
  const pack = outlinepack();
  const outlineWrite = run(['book', 'write', 'outline', '--dir', dir, '--mode', 'replace', '--apply'], {
    input: JSON.stringify(pack.draft_outline),
  });
  assert.equal(outlineWrite.status, 0, outlineWrite.stderr);
  assert.equal(outlineWrite.json.applied, true);
  const setupWrite = run(['book', 'write', 'setup', '--dir', dir, '--mode', 'replace', '--apply'], {
    input: JSON.stringify(sampleSetup()),
  });
  assert.equal(setupWrite.status, 2, setupWrite.stderr);
  assert.equal(setupWrite.json.ok, false);
  assert.equal(setupWrite.json.applied, true);
  assert.match(String(setupWrite.json.warning), /post-write check/);
  assert.ok(setupWrite.json.check.findings.some((finding) => finding.rule_id === 'quality.thread.registry_missing_setup'));
  assert.ok(fs.existsSync(path.join(dir, 'story', 'setup', 'story_setup.json')));
});
