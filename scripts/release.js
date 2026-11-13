#!/usr/bin/env node
// Release helper: atomically bump every shipped version field and optionally
// build the two dist zips.
//
//   node scripts/release.js <version> [--pack] [--dry-run] [--root <dir>]
//
// The version has to be identical in all four shipped sources; the script
// refuses to touch the tree when they disagree:
//   package.json                  version
//   package-lock.json             version + packages[""].version
//   scripts/package.json          version (shipped inside the zip)
//   SKILL.md                      YAML frontmatter `version:`
//
// Exported functions let tests drive the same code against a fixture tree.
// No external dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/;
const VERSION_LINE = /^([ \t]*version[ \t]*:[ \t]*)([^\r\n]*?)[ \t]*$/gm;
const JSON_FILES = ['package.json', 'scripts/package.json'];
// Generated DSH bundle files: present in this repository, absent from minimal test fixtures.
const OPTIONAL_JSON_FILES = ['dsh/package.json', 'dsh/skills/wishmachine/scripts/package.json'];

class ReleaseError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

// `npm run release -- 0.3.3 --dry-run` does not forward --dry-run/--pack to the
// script: npm consumes its own config flags and re-exposes them as
// npm_config_* environment variables. Honor both spellings so the npm entry
// point can never turn an intended dry-run into a real version bump.
function envFlag(name) {
  const value = process.env[name];
  if (value === undefined || value === '') return false;
  return !['false', '0', 'no', 'off'].includes(String(value).toLowerCase());
}

function validateVersion(input) {
  const version = String(input ?? '').trim();
  if (!SEMVER.test(version)) {
    throw new ReleaseError('version.invalid', `invalid semver "${version}" (expected MAJOR.MINOR.PATCH[-pre][+build])`);
  }
  return version;
}

function compareVersions(left, right) {
  const first = SEMVER.exec(validateVersion(left));
  const second = SEMVER.exec(validateVersion(right));
  for (const index of [1, 2, 3]) {
    const delta = Number(first[index]) - Number(second[index]);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  const firstPre = first[4];
  const secondPre = second[4];
  if (firstPre === secondPre) return 0;
  if (!firstPre) return 1;
  if (!secondPre) return -1;
  return firstPre < secondPre ? -1 : 1;
}

function readJsonDoc(root, relative) {
  const file = path.join(root, relative);
  if (!fs.existsSync(file)) throw new ReleaseError('file.missing', `missing ${relative} under ${root}`);
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new ReleaseError('file.invalid', `${relative} is not valid JSON: ${error.message}`);
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) {
    throw new ReleaseError('file.invalid', `${relative} must contain a JSON object`);
  }
  return { file, doc };
}

function readSkillFile(root) {
  const file = path.join(root, 'SKILL.md');
  if (!fs.existsSync(file)) throw new ReleaseError('file.missing', `missing SKILL.md under ${root}`);
  return { file, text: fs.readFileSync(file, 'utf8') };
}

// Locate the YAML frontmatter block (`---` ... `---`) and the single version line in it.
function findSkillVersion(text) {
  const start = text.startsWith('---') ? text.indexOf('\n') + 1 : -1;
  const close = start > 0 ? text.indexOf('\n---', start - 1) : -1;
  if (start <= 0 || close < 0) throw new ReleaseError('skill.frontmatter', 'SKILL.md has no YAML frontmatter block');
  const front = text.slice(start, close);
  const matches = [...front.matchAll(VERSION_LINE)];
  if (matches.length === 0) throw new ReleaseError('skill.version', 'SKILL.md frontmatter has no version line');
  if (matches.length > 1)
    throw new ReleaseError('skill.version', 'SKILL.md frontmatter has more than one version line');
  const match = matches[0];
  const raw = match[2].trim();
  const quoted = raw.length >= 2 && (raw[0] === '"' || raw[0] === "'") && raw[raw.length - 1] === raw[0];
  return {
    raw,
    quoted: quoted ? raw[0] : '',
    value: quoted ? raw.slice(1, -1).trim() : raw,
    start: start + match.index + match[1].length,
  };
}

function updateSkillVersion(text, version) {
  const found = findSkillVersion(text);
  const written = found.quoted ? `${found.quoted}${version}${found.quoted}` : version;
  return `${text.slice(0, found.start)}${written}${text.slice(found.start + found.raw.length)}`;
}

// Read every shipped version source; each entry carries its own label so an
// inconsistency report names the exact file/field that drifted.
export function readVersions(root = ROOT) {
  const dir = path.resolve(root);
  const pkg = readJsonDoc(dir, 'package.json');
  const lock = readJsonDoc(dir, 'package-lock.json');
  const scriptsPkg = readJsonDoc(dir, 'scripts/package.json');
  const lockRoot = lock.doc.packages && lock.doc.packages[''];
  if (!lockRoot || typeof lockRoot !== 'object') {
    throw new ReleaseError('lock.packages', 'package-lock.json has no packages[""] entry');
  }
  const skill = readSkillFile(dir);
  const entries = [
    { label: 'package.json', version: pkg.doc.version },
    { label: 'package-lock.json', version: lock.doc.version },
    { label: 'package-lock.json packages[""]', version: lockRoot.version },
    { label: 'scripts/package.json', version: scriptsPkg.doc.version },
    { label: 'SKILL.md frontmatter', version: findSkillVersion(skill.text).value },
  ];
  for (const entry of entries) {
    if (typeof entry.version !== 'string' || !entry.version.trim()) {
      throw new ReleaseError('version.missing', `${entry.label} has no version field`);
    }
    entry.version = validateVersion(entry.version);
  }
  return { root: dir, entries, skill };
}

function consistentVersion(sources) {
  const unique = new Set(sources.entries.map((entry) => entry.version));
  if (unique.size > 1) {
    const detail = sources.entries.map((entry) => `${entry.label}=${entry.version}`).join(', ');
    throw new ReleaseError('version.inconsistent', `version fields disagree: ${detail}`);
  }
  return sources.entries[0].version;
}

function jsonContent(doc) {
  return `${JSON.stringify(doc, null, 2)}\n`;
}

function buildUpdates(root, version) {
  const updates = [];
  for (const relative of [...JSON_FILES, ...OPTIONAL_JSON_FILES]) {
    if (!fs.existsSync(path.join(root, relative))) continue;
    const { file, doc } = readJsonDoc(root, relative);
    doc.version = version;
    updates.push({ label: relative, file, content: jsonContent(doc) });
  }
  const lock = readJsonDoc(root, 'package-lock.json');
  lock.doc.version = version;
  lock.doc.packages[''].version = version;
  updates.push({ label: 'package-lock.json', file: lock.file, content: jsonContent(lock.doc) });
  const skill = readSkillFile(root);
  const skillContent = updateSkillVersion(skill.text, version);
  updates.push({ label: 'SKILL.md', file: skill.file, content: skillContent });
  // Keep the generated bundle's copied SKILL.md version in sync so lint:dsh stays green.
  const bundledSkill = path.join(root, 'dsh/skills/wishmachine/SKILL.md');
  if (fs.existsSync(bundledSkill)) {
    const text = fs.readFileSync(bundledSkill, 'utf8');
    updates.push({ label: 'dsh/skills/wishmachine/SKILL.md', file: bundledSkill, content: updateSkillVersion(text, version) });
  }
  const indexPath = path.join(root, 'dsh/market/index.json');
  if (fs.existsSync(indexPath)) {
    const index = readJsonDoc(root, 'dsh/market/index.json');
    const versions = index.doc?.plugins?.[0]?.versions;
    if (Array.isArray(versions) && versions[0]) versions[0].version = version;
    updates.push({ label: 'dsh/market/index.json', file: indexPath, content: jsonContent(index.doc) });
  }
  return updates;
}

// Stage every new file as a sibling temp file first, then rename them in; on any
// failure restore the originals so a half-written release cannot survive.
function atomicWrite(updates) {
  const originals = updates.map((update) => ({
    file: update.file,
    content: fs.existsSync(update.file) ? fs.readFileSync(update.file) : null,
  }));
  const staged = [];
  try {
    for (const update of updates) {
      const temp = `${update.file}.release-tmp-${process.pid}`;
      fs.writeFileSync(temp, update.content, 'utf8');
      staged.push({ temp, file: update.file });
    }
    for (const item of staged) fs.renameSync(item.temp, item.file);
  } catch (error) {
    for (const item of staged) fs.rmSync(item.temp, { force: true });
    for (const original of originals) {
      try {
        if (original.content === null) fs.rmSync(original.file, { force: true });
        else fs.writeFileSync(original.file, original.content);
      } catch {
        // Best effort rollback; the original error below stays the actionable one.
      }
    }
    throw new ReleaseError('write.failed', `failed to update version files: ${error.message}`);
  }
}

function packScript(root) {
  return path.join(root, 'scripts', 'pack.js');
}

function requirePack(root) {
  if (!fs.existsSync(packScript(root))) {
    throw new ReleaseError('pack.missing', `--pack requires scripts/pack.js under ${root}`);
  }
}

function runPack(root) {
  requirePack(root);
  const run = spawnSync(process.execPath, [packScript(root)], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  if (run.error) throw new ReleaseError('pack.failed', `failed to run scripts/pack.js: ${run.error.message}`);
  if (run.status !== 0) {
    throw new ReleaseError('pack.failed', `scripts/pack.js exited ${run.status}: ${String(run.stderr || '').trim()}`);
  }
  let output;
  try {
    output = JSON.parse(run.stdout);
  } catch {
    output = { raw: String(run.stdout || '').trim() };
  }
  return { command: 'node scripts/pack.js', ...output };
}

export function runRelease(options = {}) {
  const root = path.resolve(options.root || ROOT);
  const version = validateVersion(options.version);
  const dryRun = Boolean(options.dryRun) || envFlag('npm_config_dry_run');
  const pack = Boolean(options.pack) || envFlag('npm_config_pack');
  const sources = readVersions(root);
  const current = consistentVersion(sources);
  if (compareVersions(version, current) < 0) {
    throw new ReleaseError('version.downgrade', `refusing to downgrade ${current} -> ${version}`);
  }
  if (pack && !dryRun) requirePack(root);
  const updates = buildUpdates(root, version);
  const summary = {
    ok: true,
    action: 'release',
    dryRun,
    root,
    from: current,
    version,
    changed: current !== version,
    files: updates.map((update) => ({ file: update.label, from: current, to: version })),
    pack: pack ? { skipped: dryRun ? 'dry-run' : false } : null,
  };
  if (dryRun) return summary;
  atomicWrite(updates);
  if (pack) summary.pack = runPack(root);
  return summary;
}

function parseArgs(argv) {
  const options = { version: '', root: ROOT, dryRun: false, pack: false, help: false };
  const args = [...argv];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--pack') options.pack = true;
    else if (arg === '--root') {
      const value = args[index + 1];
      if (!value || value.startsWith('-')) throw new ReleaseError('args.root', '--root requires a directory path');
      options.root = path.resolve(value);
      index += 1;
    } else if (arg.startsWith('--root=')) options.root = path.resolve(arg.slice('--root='.length));
    else if (arg.startsWith('-')) throw new ReleaseError('args.unknown', `unknown option: ${arg}`);
    else if (options.version) throw new ReleaseError('args.version', `unexpected extra argument: ${arg}`);
    else options.version = arg;
  }
  if (!options.help && !options.version) {
    throw new ReleaseError('args.version', 'a target version is required (e.g. node scripts/release.js 0.3.3)');
  }
  return options;
}

function usage() {
  return (
    'Usage: node scripts/release.js <version> [--pack] [--dry-run] [--root <dir>]\n' +
    '  <version>   target semver, e.g. 0.3.3\n' +
    '  --pack      build dist zips via scripts/pack.js after bumping\n' +
    '  --dry-run   validate and print the plan without writing files\n' +
    '  --root      repository root to operate on (defaults to this checkout)\n'
  );
}

function fail(error) {
  const code = error instanceof ReleaseError ? error.code : 'release.failed';
  const message = error instanceof Error ? error.message : String(error);
  process.stdout.write(`${JSON.stringify({ ok: false, error: { code, message } })}\n`);
  process.stderr.write(`release failed: ${message}\n`);
  process.exitCode = 1;
}

function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      process.stdout.write(usage());
      return;
    }
    process.stdout.write(`${JSON.stringify(runRelease(options), null, 2)}\n`);
  } catch (error) {
    fail(error);
  }
}

export { ReleaseError, compareVersions, parseArgs, runRelease as release, validateVersion };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
