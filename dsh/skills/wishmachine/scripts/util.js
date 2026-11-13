import fs from 'node:fs';
import path from 'node:path';

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

export function readText(file) {
  const text = fs.readFileSync(file, 'utf8');
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function readJson(file) {
  return JSON.parse(readText(file));
}

export function writeTextAtomic(file, text) {
  ensureDir(path.dirname(file));
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, text, 'utf8');
  fs.renameSync(temp, file);
}

export function writeJsonAtomic(file, value) {
  writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function parseJson(text, what) {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  try {
    return JSON.parse(clean);
  } catch (error) {
    throw new Error(`${what} is not valid JSON: ${error.message}`);
  }
}

export function resolveProjectDir(explicit) {
  if (explicit) {
    // An explicit --dir is authoritative: never walk up, so a typo cannot silently
    // resolve to an ancestor project and write to the wrong book.
    const resolved = path.resolve(explicit);
    try {
      if (fs.statSync(resolved).isFile()) {
        return path.dirname(resolved);
      }
    } catch {
      // Missing directory: return it and let loadProject report a clear error.
    }
    return resolved;
  }
  let current = path.resolve(process.env.WISHMACHINE_PROJECT_DIR || process.cwd());
  try {
    if (fs.statSync(current).isFile()) {
      current = path.dirname(current);
    }
  } catch {
    // Fall back to the current directory.
  }
  let cursor = current;
  while (true) {
    if (fs.existsSync(path.join(cursor, 'novel.json'))) {
      return cursor;
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) {
      return current;
    }
    cursor = parent;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

export function deepMerge(base, patch) {
  if (Array.isArray(base) || Array.isArray(patch) || patch === null || typeof patch !== 'object') {
    return patch;
  }
  const out = { ...(base && typeof base === 'object' ? base : {}) };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = key in out ? deepMerge(out[key], value) : value;
  }
  return out;
}

export function safeSegment(value, label = 'id') {
  const text = String(value || '').trim();
  if (!text || text === '.' || text === '..' || /[\\/]/.test(text)) {
    throw new Error(`invalid ${label}: ${value}`);
  }
  return text;
}

// Resolve `target` and prove it stays inside `root`. Used everywhere a
// data-controlled string (backup name, export path, artifact id) becomes a
// filesystem path, so `../sibling/evil` cannot escape the project.
export function assertInside(root, target, label = 'path') {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, target);
  const relative = path.relative(resolvedRoot, resolved);
  const inside = relative === ''
    || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  if (!inside) {
    throw new Error(`${label} is outside ${resolvedRoot}: ${resolved}`);
  }
  return resolved;
}

export function toPosixPath(value) {
  return String(value).replace(/\\/g, '/');
}

export function positiveInt(value, label, fallback) {
  if (value === undefined || value === null || value === '') {
    if (fallback === undefined) throw new Error(`${label} is required`);
    return fallback;
  }
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number) || number <= 0) {
    throw new Error(`${label} must be a positive integer, got ${JSON.stringify(value)}`);
  }
  return number;
}

export function hashSeed(value) {
  let hash = 2166136261 >>> 0;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function pickMany(rng, list, count) {
  const pool = [...list];
  const out = [];
  while (pool.length && out.length < count) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

export function firstHeading(text) {
  for (const line of text.split('\n')) {
    if (line.startsWith('# ')) {
      return line.slice(2).trim();
    }
  }
  return '';
}

export function listMarkdown(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => {
      const full = path.join(dir, name);
      return { name: name.slice(0, -3), description: firstHeading(readText(full)) };
    });
}

export function readMarkdown(dir, name) {
  const safe = safeSegment(name, 'name');
  const file = path.join(dir, `${safe}.md`);
  if (!fs.existsSync(file)) {
    throw new Error(`not found: ${safe}`);
  }
  return readText(file);
}
