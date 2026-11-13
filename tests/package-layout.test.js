// Regression for packaged-skill layout: the zip ships scripts/ + SKILL.md +
// references/ but NOT the repository root package.json. Anything that resolves
// the repo root at runtime (e.g. require('../../package.json')) makes every
// command crash with MODULE_NOT_FOUND in the packaged layout, so this test
// copies the shipped files to a clean directory and runs the CLI there.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEV_ONLY = new Set(['pack.js', 'skill-manifest.js', 'check-imports.js', 'check-structure.js']);

function copyShipment(dir) {
  for (const name of ['SKILL.md', 'README.md', 'LICENSE']) {
    fs.copyFileSync(path.join(root, name), path.join(dir, name));
  }
  for (const sub of ['references', 'scripts']) {
    fs.cpSync(path.join(root, sub), path.join(dir, sub), {
      recursive: true,
      filter: (source) => {
        const relative = path.relative(root, source).split(path.sep).join('/');
        if (!relative.startsWith('scripts/')) return true;
        return !DEV_ONLY.has(relative.slice('scripts/'.length));
      },
    });
  }
}

function run(dir, args) {
  return spawnSync(process.execPath, [path.join(dir, 'scripts', 'wishmachine.js'), ...args], {
    encoding: 'utf8',
    cwd: dir,
    env: { ...process.env, TEMP: os.tmpdir(), TMP: os.tmpdir() },
  });
}

test('the shipped skill layout runs without the repository root package.json', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishmachine-shipment-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  copyShipment(dir);
  assert.equal(fs.existsSync(path.join(dir, 'package.json')), false, 'shipment must not rely on a root package.json');
  assert.ok(fs.existsSync(path.join(dir, 'scripts', 'package.json')), 'shipment carries scripts/package.json');

  const version = run(dir, ['version']);
  assert.equal(version.status, 0, version.stderr);
  assert.match(version.stdout, /^wishmachine \d+\.\d+\.\d+/);

  const types = run(dir, ['ideas', 'types']);
  assert.equal(types.status, 0, types.stderr);
  assert.equal(JSON.parse(types.stdout).count, 21);
});

test('the shipped skill can create a project and run a full setup/outline write', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishmachine-shipment-flow-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  copyShipment(dir);
  const book = path.join(dir, 'my-book');
  const init = run(dir, ['book', 'init', '打包验证', '--dir', book, '--parts', '1', '--volumes', '1', '--chapter', '3', '--genre', '科幻']);
  assert.equal(init.status, 0, init.stderr);
  const draw = run(dir, ['ideas', 'draw', '--type', 'outlinepack', '--genre', '科幻', '--volumes', '1', '--chapters-per-volume', '3', '--count', '1', '--seed', '7', '--dir', book, '--save']);
  assert.equal(draw.status, 0, draw.stderr);
  const id = JSON.parse(draw.stdout).saved.id;
  for (const section of ['setup', 'outline']) {
    const write = run(dir, ['book', 'write', section, '--dir', book, '--from-idea', id, '--mode', 'replace', '--apply']);
    assert.equal(write.status, 0, `${section} write failed: ${write.stderr}`);
    assert.equal(JSON.parse(write.stdout).applied, true);
  }
  const check = run(dir, ['check', '--dir', book, '--profile', 'all', '--target', 'outline']);
  assert.equal(check.status, 0, check.stderr);
  assert.equal(JSON.parse(check.stdout).ok, true);
});
