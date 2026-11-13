// Release tooling: version bumping across the four shipped sources, dry-run
// safety, inconsistent-tree refusal and the optional pack wiring.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ReleaseError, parseArgs, readVersions, runRelease, validateVersion } from '../scripts/release.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CURRENT = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).version;
const NEXT = bumpPatch(CURRENT);
const CLI = path.join(repoRoot, 'scripts', 'release.js');
const FILES = ['package.json', 'package-lock.json', 'scripts/package.json', 'SKILL.md'];

function bumpPatch(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  assert.ok(match, `package.json version ${version} must be plain semver for this test`);
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function previousVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (Number(match[3]) > 0) return `${match[1]}.${match[2]}.${Number(match[3]) - 1}`;
  if (Number(match[2]) > 0) return `${match[1]}.${Number(match[2]) - 1}.0`;
  return `${Number(match[1]) - 1}.0.0`;
}

function readFile(dir, relative) {
  return fs.readFileSync(path.join(dir, relative), 'utf8');
}

function writeFile(dir, relative, content) {
  fs.writeFileSync(path.join(dir, relative), content);
}

function snapshot(dir) {
  return Object.fromEntries(FILES.map((relative) => [relative, readFile(dir, relative)]));
}

// Copy the four real version-bearing files (never read the repo through the
// release code itself, so the test cannot mask a path bug).
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wishmachine-release-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'scripts'));
  for (const relative of FILES) fs.copyFileSync(path.join(repoRoot, relative), path.join(dir, relative));
  return dir;
}

test('dry-run reports every version source without touching the fixture', (t) => {
  const dir = fixture(t);
  const before = snapshot(dir);
  const summary = runRelease({ version: NEXT, root: dir, dryRun: true, pack: true });
  assert.equal(summary.ok, true);
  assert.equal(summary.action, 'release');
  assert.equal(summary.dryRun, true);
  assert.equal(summary.from, CURRENT);
  assert.equal(summary.version, NEXT);
  assert.equal(summary.changed, true);
  assert.deepEqual(
    summary.files.map((file) => file.file),
    ['package.json', 'scripts/package.json', 'package-lock.json', 'SKILL.md'],
  );
  assert.ok(summary.files.every((file) => file.from === CURRENT && file.to === NEXT));
  assert.deepEqual(summary.pack, { skipped: 'dry-run' });
  assert.deepEqual(snapshot(dir), before);
});

test('release bump updates all four sources and no unrelated byte changes', (t) => {
  const dir = fixture(t);
  const before = snapshot(dir);
  const summary = runRelease({ version: NEXT, root: dir });
  assert.equal(summary.ok, true);
  assert.equal(summary.dryRun, false);
  assert.equal(summary.changed, true);
  assert.equal(summary.pack, null);
  assert.deepEqual(
    readVersions(dir).entries.map((entry) => entry.version),
    Array(5).fill(NEXT),
  );

  const pkg = JSON.parse(readFile(dir, 'package.json'));
  const expectedPkg = JSON.parse(before['package.json']);
  expectedPkg.version = NEXT;
  assert.deepEqual(pkg, expectedPkg);

  const lock = JSON.parse(readFile(dir, 'package-lock.json'));
  const expectedLock = JSON.parse(before['package-lock.json']);
  expectedLock.version = NEXT;
  expectedLock.packages[''].version = NEXT;
  assert.deepEqual(lock, expectedLock);

  const scriptsPkg = JSON.parse(readFile(dir, 'scripts/package.json'));
  const expectedScripts = JSON.parse(before['scripts/package.json']);
  expectedScripts.version = NEXT;
  assert.deepEqual(scriptsPkg, expectedScripts);

  assert.equal(readFile(dir, 'SKILL.md'), before['SKILL.md'].replace(`version: ${CURRENT}`, `version: ${NEXT}`));
  const leftovers = [...fs.readdirSync(dir), ...fs.readdirSync(path.join(dir, 'scripts'))].filter((name) =>
    name.includes('release-tmp'),
  );
  assert.deepEqual(leftovers, []);

  // Re-running with the same version is an idempotent no-op (retry-safe).
  const retry = runRelease({ version: NEXT, root: dir });
  assert.equal(retry.changed, false);
  assert.equal(retry.from, NEXT);
});

test('refuses a tree whose version sources disagree and leaves it untouched', (t) => {
  const dir = fixture(t);
  const pkg = JSON.parse(readFile(dir, 'package.json'));
  pkg.version = previousVersion(CURRENT);
  writeFile(dir, 'package.json', `${JSON.stringify(pkg, null, 2)}\n`);
  const before = snapshot(dir);
  assert.throws(
    () => runRelease({ version: NEXT, root: dir }),
    (error) =>
      error instanceof ReleaseError &&
      error.code === 'version.inconsistent' &&
      /version fields disagree/.test(error.message),
  );
  assert.deepEqual(snapshot(dir), before);
});

test('rejects invalid semver, downgrades and missing sources', (t) => {
  const dir = fixture(t);
  for (const bad of ['', '1.2', 'v1.2.3', '01.2.3', '1.2.3-', '1.2.3.4']) {
    assert.throws(
      () => validateVersion(bad),
      (error) => error instanceof ReleaseError && error.code === 'version.invalid',
    );
  }
  assert.throws(
    () => runRelease({ version: previousVersion(CURRENT), root: dir }),
    (error) => error instanceof ReleaseError && error.code === 'version.downgrade',
  );
  fs.rmSync(path.join(dir, 'scripts', 'package.json'));
  assert.throws(
    () => runRelease({ version: NEXT, root: dir }),
    (error) => error instanceof ReleaseError && error.code === 'file.missing',
  );
});

test('parses flags and reports usage errors', () => {
  const parsed = parseArgs([NEXT, '--dry-run', '--pack', '--root', '.']);
  assert.equal(parsed.version, NEXT);
  assert.equal(parsed.dryRun, true);
  assert.equal(parsed.pack, true);
  assert.equal(parsed.root, path.resolve('.'));
  assert.equal(parseArgs(['--help']).help, true);
  assert.throws(
    () => parseArgs([]),
    (error) => error.code === 'args.version',
  );
  assert.throws(
    () => parseArgs([NEXT, NEXT]),
    (error) => error.code === 'args.version',
  );
  assert.throws(
    () => parseArgs([NEXT, '--bogus']),
    (error) => error.code === 'args.unknown',
  );
  assert.throws(
    () => parseArgs([NEXT, '--root']),
    (error) => error.code === 'args.root',
  );
});

test('CLI dry-run prints a JSON plan and failure paths exit 1 with JSON errors', (t) => {
  const dir = fixture(t);
  const run = spawnSync(process.execPath, [CLI, NEXT, '--dry-run', '--root', dir], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, '');
  const summary = JSON.parse(run.stdout);
  assert.equal(summary.ok, true);
  assert.equal(summary.dryRun, true);
  assert.equal(summary.version, NEXT);

  const failure = spawnSync(process.execPath, [CLI, 'not-semver', '--root', dir], { encoding: 'utf8' });
  assert.equal(failure.status, 1);
  assert.equal(JSON.parse(failure.stdout).ok, false);
  assert.equal(JSON.parse(failure.stdout).error.code, 'version.invalid');
  assert.match(failure.stderr, /release failed:/);
});

test('npm config env flags cannot bypass --dry-run safety', (t) => {
  const dir = fixture(t);
  const before = snapshot(dir);
  // `npm run release -- 0.3.3 --dry-run` forwards only the version: npm consumes
  // --dry-run and re-exposes it as npm_config_dry_run for the script.
  process.env.npm_config_dry_run = 'true';
  try {
    const summary = runRelease({ version: NEXT, root: dir });
    assert.equal(summary.dryRun, true);
    assert.equal(summary.changed, true);
    assert.deepEqual(snapshot(dir), before);
  } finally {
    delete process.env.npm_config_dry_run;
  }

  const cli = spawnSync(process.execPath, [CLI, NEXT, '--root', dir], {
    encoding: 'utf8',
    env: { ...process.env, npm_config_dry_run: 'true' },
  });
  assert.equal(cli.status, 0, cli.stderr);
  assert.equal(JSON.parse(cli.stdout).dryRun, true);
  assert.deepEqual(snapshot(dir), before);
});

test('--pack runs scripts/pack.js in the target root and refuses to bump without it', (t) => {
  const dir = fixture(t);
  const stub = [
    "import fs from 'node:fs';",
    "fs.mkdirSync('dist', { recursive: true });",
    "fs.writeFileSync('dist/packed.txt', 'ok');",
    "const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;",
    'console.log(JSON.stringify({ ok: true, version, normal: "stub.zip", flat: "stub-flat.zip" }));',
    '',
  ].join('\n');
  writeFile(dir, 'scripts/pack.js', stub);
  const summary = runRelease({ version: NEXT, root: dir, pack: true });
  assert.equal(summary.pack.ok, true);
  assert.equal(summary.pack.command, 'node scripts/pack.js');
  assert.equal(summary.pack.version, NEXT);
  assert.equal(readFile(dir, 'dist/packed.txt'), 'ok');

  // npm exposes --pack as npm_config_pack; that spelling must wire pack too.
  const npmStyle = fixture(t);
  writeFile(npmStyle, 'scripts/pack.js', stub);
  process.env.npm_config_pack = 'true';
  try {
    const envSummary = runRelease({ version: NEXT, root: npmStyle });
    assert.equal(envSummary.pack.ok, true);
    assert.equal(envSummary.pack.version, NEXT);
  } finally {
    delete process.env.npm_config_pack;
  }

  const bare = fixture(t);
  const before = snapshot(bare);
  assert.throws(
    () => runRelease({ version: NEXT, root: bare, pack: true }),
    (error) => error instanceof ReleaseError && error.code === 'pack.missing',
  );
  assert.deepEqual(snapshot(bare), before);
});
