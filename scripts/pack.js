#!/usr/bin/env node
/**
 * Build the two distributable Skill zips without any external dependency.
 *
 *   dist/wishmachine-skill-v<version>.zip        entries under wishmachine/
 *   dist/wishmachine-skill-flat-v<version>.zip   entries at the zip root
 *
 * Usage: node scripts/pack.js [--prune]
 *   --prune  delete every other zip in dist/ after building the pair
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { validateSkillManifest } from './skill-manifest.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PACKAGE = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = PACKAGE.version;

// A skill host parses the YAML frontmatter to find the skill name/description.
// Building a package with invalid frontmatter produces a zip that every host
// rejects with a misleading "missing YAML name/description" error, so refuse.
const manifest = validateSkillManifest(fs.readFileSync(path.join(ROOT, 'SKILL.md'), 'utf8'), { expectedVersion: VERSION });
if (!manifest.ok) {
  process.stderr.write('SKILL.md manifest is invalid; refusing to build a package:\n');
  for (const error of manifest.errors) process.stderr.write(`  - ${error}\n`);
  process.exit(1);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function walk(dir, base = dir) {
  const entries = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walk(full, base));
    } else {
      entries.push({ absolute: full, relative: path.relative(base, full).split(path.sep).join('/') });
    }
  }
  return entries;
}

function collectFiles() {
  const files = [
    'SKILL.md',
    'README.md',
    'LICENSE',
  ].map((name) => ({ absolute: path.join(ROOT, name), relative: name }));
  for (const dir of ['references', 'scripts']) {
    for (const file of walk(path.join(ROOT, dir))) {
      files.push({ absolute: file.absolute, relative: `${dir}/${file.relative}` });
    }
  }
  // Developer-only tools are not part of the installable Skill.
  const devOnly = new Set([
    'scripts/pack.js',
    'scripts/skill-manifest.js',
    'scripts/check-imports.js',
    'scripts/check-structure.js',
    'scripts/release.js',
    'scripts/build-dsh-bundle.js',
  ]);
  return files.filter((file) => !devOnly.has(file.relative));
}

function dosTime(date) {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

function buildZip(entries) {
  const stamp = dosTime(new Date());
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = fs.readFileSync(entry.absolute);
    const compressed = zlib.deflateRawSync(data);
    const checksum = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(stamp.time, 10);
    local.writeUInt16LE(stamp.date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(stamp.time, 12);
    central.writeUInt16LE(stamp.date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + compressed.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, ...centralParts, end]);
}

function pack(entries, prefix, fileName) {
  const zipped = buildZip(entries.map((entry) => ({
    absolute: entry.absolute,
    name: `${prefix}${entry.relative}`,
  })));
  const output = path.join(DIST, fileName);
  fs.writeFileSync(output, zipped);
  return { file: path.relative(ROOT, output).split(path.sep).join('/'), files: entries.length, bytes: zipped.length };
}

function prune(keep) {
  const removed = [];
  for (const file of fs.readdirSync(DIST)) {
    if (!keep.includes(file) && file.endsWith('.zip')) {
      fs.rmSync(path.join(DIST, file));
      removed.push(file);
    }
  }
  return removed;
}

const entries = collectFiles();
fs.mkdirSync(DIST, { recursive: true });
const normal = pack(entries, 'wishmachine/', `wishmachine-skill-v${VERSION}.zip`);
const flat = pack(entries, '', `wishmachine-skill-flat-v${VERSION}.zip`);
const keep = [path.basename(normal.file), path.basename(flat.file)];
const removed = process.argv.includes('--prune') ? prune(keep) : [];
process.stdout.write(`${JSON.stringify({ ok: true, version: VERSION, files: entries.length, normal, flat, removed }, null, 2)}\n`);
