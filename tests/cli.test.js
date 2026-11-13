import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const entry = path.resolve('scripts/wishmachine.js');

function run(args, options = {}) {
  return execFileSync(process.execPath, [entry, ...args], {
    encoding: 'utf8',
    cwd: options.cwd || process.cwd(),
    maxBuffer: 20 * 1024 * 1024,
    env: { ...process.env, TEMP: os.tmpdir(), TMP: os.tmpdir() },
  });
}

test('CLI version and guides', () => {
  assert.match(run(['version']), /^wishmachine \d+\.\d+\.\d+/);
  const refs = JSON.parse(run(['gen', 'reference', 'list']));
  assert.ok(refs.results.some((item) => item.name === 'setup-schema'));
  const workflow = JSON.parse(run(['gen', 'workflow', 'read', 'outline']));
  assert.ok(workflow.results[0].content.length > 0);
});

test('CLI init, status and ideas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishmachine-cli-'));
  const init = JSON.parse(run(['book', 'init', 'CLI 测试', '--dir', dir, '--parts', '1', '--volumes', '2', '--chapter', '2']));
  assert.equal(init.ok, true);
  const status = JSON.parse(run(['book', 'status', '--dir', dir, '--json']));
  assert.equal(status.setup, false);
  const state = JSON.parse(run(['state', '--dir', dir, '--view', 'brief']));
  assert.equal(state.ok, true);
  assert.equal(state.state.project.name, 'CLI 测试');
  assert.equal(state.state.setup.present, false);
  const bookState = JSON.parse(run(['book', 'state', '--dir', dir]));
  assert.equal(bookState.state.project.root, dir);
  const audit = JSON.parse(run(['audit', '--dir', dir, '--max-findings', '5']));
  assert.equal(audit.ok, true);
  assert.equal(Array.isArray(audit.targets), true);
  const doctor = JSON.parse(run(['doctor', '--dir', dir]));
  const setupIssue = doctor.issues.find((issue) => issue.code === 'artifact.setup');
  assert.ok(setupIssue);
  assert.ok(setupIssue.suggestion.length > 0);
  fs.rmSync(path.join(dir, 'story', 'craft'), { recursive: true, force: true });
  const fixed = JSON.parse(run(['doctor', '--dir', dir, '--fix']));
  assert.ok(fixed.actions.some((action) => action.includes('story/craft')));
  assert.ok(fs.existsSync(path.join(dir, 'story', 'craft')));
  const ideas = JSON.parse(run(['ideas', 'draw', '--type', 'namecard', '--genre', '科幻', '--count', '2', '--seed', '7']));
  assert.equal(ideas.count, 2);
  assert.equal(ideas.results.length, 2);
  const saved = JSON.parse(run(['ideas', 'draw', '--type', 'outlinepack', '--genre', '悬疑', '--chapters', '10', '--seed', '42', '--dir', dir, '--save']));
  assert.equal(saved.ok, true);
  const validated = JSON.parse(run(['ideas', 'validate', '--all', '--dir', dir]));
  assert.equal(validated.action, 'validate-all');
  assert.ok(validated.count >= 1);
  assert.ok(validated.results.every((item) => item.ok));
  assert.throws(() => run(['ideas', 'validate', '--all', '--dir', dir, '--min-severity', 'nope']), /unknown min-severity/);
  const outputFile = path.join(dir, 'nested', 'validation.json');
  const written = JSON.parse(run(['ideas', 'validate', '--all', '--dir', dir, '--output', outputFile]));
  assert.equal(written.output, outputFile);
  assert.equal(JSON.parse(fs.readFileSync(outputFile, 'utf8')).schema_version, 1);
  assert.equal(JSON.parse(fs.readFileSync(outputFile, 'utf8')).action, 'validate-all');
  const stdout = JSON.parse(run(['ideas', 'validate', '--all', '--dir', dir, '--output', '-']));
  assert.equal(stdout.action, 'validate-all');
  assert.equal(stdout.schema_version, 1);
  const ignoreFile = path.join(dir, 'ignore.json');
  fs.writeFileSync(ignoreFile, JSON.stringify({ rules: ['idea.cast_relation.duplicate'] }));
  const ignored = JSON.parse(run(['ideas', 'validate', '--all', '--dir', dir, '--ignore-file', ignoreFile]));
  assert.equal(ignored.action, 'validate-all');
});
