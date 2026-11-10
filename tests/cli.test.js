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
  const ideas = JSON.parse(run(['ideas', 'draw', '--type', 'namecard', '--genre', '科幻', '--count', '2', '--seed', '7']));
  assert.equal(ideas.count, 2);
  assert.equal(ideas.results.length, 2);
});
