// DSH bundle contract: the dsh/ package is a valid DSH bundle whose provider
// exposes the wishmachine skill, and its generated skill tree stays in sync with
// the repository sources (`npm run lint:dsh`).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateSkillManifest } from '../scripts/skill-manifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dshDir = path.join(root, 'dsh');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));

test('dsh/package.json is a valid DSH bundle manifest', () => {
  const pkg = readJson('dsh/package.json');
  assert.equal(pkg.dsh?.bundle?.patch, './cordis.patch.yml');
  assert.equal(typeof pkg.engines?.dsh, 'string');
  assert.ok(pkg.engines.dsh.length > 0);
  assert.ok(pkg.exports['./locale/*.json']);
  assert.ok(fs.existsSync(path.join(dshDir, 'cordis.patch.yml')));
  assert.ok(fs.existsSync(path.join(dshDir, 'icon.svg')));
  assert.ok(fs.existsSync(path.join(dshDir, 'locale', 'en.json')));
  assert.ok(fs.existsSync(path.join(dshDir, 'locale', 'zh.json')));
  const patch = fs.readFileSync(path.join(dshDir, 'cordis.patch.yml'), 'utf8');
  assert.match(patch, /id: wishmachine-skill/);
  assert.match(patch, /name: wishmachine-dsh/);
});

test('the DSH provider registers the wishmachine skill with a usable resource base', async () => {
  const { apply, inject, name } = await import('../dsh/index.js');
  assert.equal(name, 'wishmachine-skill');
  assert.deepEqual(inject, ['skills']);
  let provider;
  const ctx = { skills: { registerProvider: (create) => { provider = create({ signal: new AbortController().signal, invalidate() {} }); } } };
  apply(ctx);
  assert.ok(provider, 'apply() must call ctx.skills.registerProvider');
  assert.equal(provider.name, 'wishmachine');
  const candidates = await provider.list();
  assert.equal(candidates.length, 1);
  const candidate = candidates[0];
  assert.equal(candidate.name, 'wishmachine');
  assert.equal(typeof candidate.description, 'string');
  assert.ok(candidate.description.length > 0);
  assert.equal(candidate.resourceBase.kind, 'directory');
  const skillDir = candidate.resourceBase.path;
  assert.ok(fs.existsSync(path.join(skillDir, 'SKILL.md')));
  assert.ok(fs.existsSync(path.join(skillDir, 'scripts', 'wishmachine.js')));
  assert.ok(fs.existsSync(path.join(skillDir, 'references', 'setup-schema.md')));
  const definition = await provider.get(candidate);
  assert.equal(definition.name, 'wishmachine');
  assert.match(definition.content, /^---\nname: wishmachine/);
  const manifest = validateSkillManifest(definition.content, { expectedVersion: readJson('package.json').version });
  assert.equal(manifest.ok, true, manifest.errors.join('; '));
});

test('the generated DSH skill tree is in sync with the repository sources', () => {
  const run = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-dsh-bundle.js'), '--check'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
  const summary = JSON.parse(run.stdout);
  assert.equal(summary.ok, true);
  assert.deepEqual(summary.problems, []);
});

test('the DSH bundle versions stay in sync with the package version', () => {
  const version = readJson('package.json').version;
  assert.equal(readJson('dsh/package.json').version, version);
  assert.equal(readJson('dsh/skills/wishmachine/scripts/package.json').version, version);
  const index = readJson('dsh/market/index.json');
  assert.equal(index.format, 1);
  assert.equal(index.plugins[0].name, 'wishmachine-dsh');
  assert.equal(index.plugins[0].versions[0].version, version);
  assert.equal(index.plugins[0].versions[0].engines.dsh, readJson('dsh/package.json').engines.dsh);
});

test('the plugin-market index names a git source with a pinned commit and the bundle path', () => {
  const index = readJson('dsh/market/index.json');
  assert.equal(index.format, 1);
  assert.equal(typeof index.title.en, 'string');
  const source = index.plugins[0].versions[0].source;
  assert.equal(source.type, 'git');
  assert.equal(source.url, 'https://github.com/Malxi/wishmachine.git');
  assert.equal(source.path, 'dsh');
  assert.match(source.commit, /^[0-9a-f]{40}$/);
  assert.ok(Number.isInteger(index.plugins[0].versions[0].publishTimestamp));
});
