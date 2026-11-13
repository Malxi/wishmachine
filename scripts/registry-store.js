// Registry backup/undo/redo/log store.
// Owns every path under logs/registry-backups and logs/registry-operations.jsonl.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import {
  ensureDir, readJson, writeJsonAtomic, nowIso, stamp, assertInside, toPosixPath,
} from './util.js';
import { outlineFile, registryBackupsDir, registryOperationsFile, setupFile } from './artifacts.js';

function fileChecksum(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function registryFiles(project) {
  return {
    setup: setupFile(project.dir),
    outline: outlineFile(project.dir),
  };
}

// Timestamp keeps backups sortable; the random suffix keeps two backups created
// in the same second from silently overwriting each other.
function backupDirName(action) {
  return `${stamp()}-${action}-${randomUUID().slice(0, 8)}`;
}

export function createRegistryBackup(project, action) {
  const dir = path.join(registryBackupsDir(project.dir), backupDirName(action));
  ensureDir(dir);
  const files = registryFiles(project);
  fs.copyFileSync(files.setup, path.join(dir, 'story_setup.json'));
  fs.copyFileSync(files.outline, path.join(dir, 'outline.json'));
  writeJsonAtomic(path.join(dir, 'manifest.json'), {
    created_at: nowIso(),
    action,
    files: ['story_setup.json', 'outline.json'],
    checksums: {
      'story_setup.json': fileChecksum(files.setup),
      'outline.json': fileChecksum(files.outline),
    },
  });
  return toPosixPath(path.relative(project.dir, dir));
}

export function appendRegistryOperation(project, operation) {  ensureDir(path.dirname(registryOperationsFile(project.dir)));
  fs.appendFileSync(
    registryOperationsFile(project.dir),
    `${JSON.stringify({ id: randomUUID(), at: nowIso(), ...operation })}\n`,
    'utf8',
  );
}

export function readRegistryOperations(project, limit = 5) {
  const file = registryOperationsFile(project.dir);
  if (!fs.existsSync(file)) return [];
  const operations = fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  return operations.slice(-limit);
}

function backupDirectory(project, backupName) {
  // Operations store project-relative paths ("logs/registry-backups/<dir>");
  // restore/undo callers may also pass just the directory name.
  try {
    const direct = assertInside(project.dir, backupName, 'registry backup');
    if (fs.existsSync(direct)) return direct;
  } catch {
    // Not a path inside the project; fall through to the backup-directory form.
  }
  return assertInside(registryBackupsDir(project.dir), backupName, 'registry backup');
}

function backupFile(project, backupName, file) {
  return path.join(backupDirectory(project, backupName), file);
}

function copyBackupIntoProject(project, backupName) {
  const files = registryFiles(project);
  fs.copyFileSync(backupFile(project, backupName, 'story_setup.json'), files.setup);
  fs.copyFileSync(backupFile(project, backupName, 'outline.json'), files.outline);
}

export function undoRegistryOperation(project, options = {}) {
  const operations = readRegistryOperations(project, 200);
  const target = options.operationId
    ? operations.find((operation) => operation.id === options.operationId)
    : [...operations].reverse().find((operation) => operation.backup && operation.action !== 'undo');
  if (!target) throw new Error('no registry operation with a backup to undo');
  copyBackupIntoProject(project, target.backup);
  appendRegistryOperation(project, {
    action: 'undo',
    restored: target.backup,
    original_action: target.action,
    original_operation_id: target.id,
    after_backup: target.after_backup,
  });
  return {
    ok: true,
    action: 'undo',
    restored: target.backup,
    original_action: target.action,
  };
}

export function redoRegistryOperation(project, options = {}) {
  const operations = readRegistryOperations(project, 200);
  const target = options.operationId
    ? operations.find((operation) => (
      operation.action === 'undo'
      && (operation.id === options.operationId || operation.original_operation_id === options.operationId)
    ))
    : [...operations].reverse().find((operation) => operation.action === 'undo' && operation.after_backup);
  if (!target?.after_backup) throw new Error('no undo operation with an after_backup to redo');
  copyBackupIntoProject(project, target.after_backup);
  appendRegistryOperation(project, {
    action: 'redo',
    restored: target.after_backup,
    original_operation_id: target.id,
  });
  return {
    ok: true,
    action: 'redo',
    restored: target.after_backup,
    original_operation_id: target.id,
  };
}

export function createRegistrySnapshot(project) {
  const backup = createRegistryBackup(project, 'manual');
  return { ok: true, action: 'registry-backup', backup, path: backup };
}

function backupNames(project) {
  const dir = registryBackupsDir(project.dir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => fs.statSync(path.join(dir, name)).isDirectory()).sort();
}

function inspectBackup(project, name) {
  const dir = path.join(registryBackupsDir(project.dir), name);
  const manifestFile = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestFile)) return [{ backup: name, status: 'missing_manifest' }];
  let manifest;
  try {
    manifest = readJson(manifestFile);
  } catch (error) {
    return [{ backup: name, status: 'invalid_manifest', error: error.message }];
  }
  const findings = [];
  for (const [file, checksum] of Object.entries(manifest.checksums || {})) {
    const target = path.join(dir, file);
    if (!fs.existsSync(target)) {
      findings.push({ backup: name, status: 'missing_file', file });
    } else if (fileChecksum(target) !== checksum) {
      findings.push({ backup: name, status: 'checksum_mismatch', file });
    }
  }
  return findings;
}

export function checkRegistryBackups(project) {
  const names = backupNames(project);
  const findings = names.flatMap((name) => inspectBackup(project, name));
  return { ok: findings.length === 0, action: 'check-backups', checked: names.length, findings };
}

function manifestOf(project, name) {
  const file = path.join(registryBackupsDir(project.dir), name, 'manifest.json');
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

export function registryBackups(project, options = {}) {
  const dir = registryBackupsDir(project.dir);
  const names = backupNames(project);
  if (!fs.existsSync(dir)) {
    return { ok: true, action: 'registry-backups', count: 0, backups: [], removed: [], protected: [] };
  }
  const keep = Math.max(1, Math.min(100, Number(options.keep) || 10));
  const newestFirst = [...names].sort().reverse();
  const referenced = new Set(readRegistryOperations(project, 1000)
    .flatMap((operation) => [operation.backup, operation.after_backup])
    .map((backup) => String(backup || '').split('/').pop())
    .filter(Boolean));
  const keepSet = new Set(newestFirst.slice(0, keep));
  const removed = [];
  const protectedBackups = [];
  if (options.prune) {
    for (const name of newestFirst) {
      if (keepSet.has(name)) continue;
      if (referenced.has(name)) {
        protectedBackups.push(name);
        continue;
      }
      fs.rmSync(path.join(dir, name), { recursive: true, force: true });
      removed.push(name);
    }
  }
  const backups = names
    .filter((name) => !removed.includes(name))
    .map((name) => {
      const manifest = manifestOf(project, name);
      return {
        name,
        path: toPosixPath(path.relative(project.dir, path.join(dir, name))),
        created_at: manifest?.created_at || null,
        action: manifest?.action || null,
        files: manifest?.files || [],
        referenced: referenced.has(name),
      };
    });
  return {
    ok: true,
    action: 'registry-backups',
    count: backups.length,
    backup: backups,
    backups,
    removed,
    protected: protectedBackups,
  };
}

function changedKeys(current, next) {
  const keys = new Set([...Object.keys(current || {}), ...Object.keys(next || {})]);
  return [...keys].filter((key) => JSON.stringify(current?.[key]) !== JSON.stringify(next?.[key]));
}

export function restoreRegistryBackup(project, backupName, options = {}) {
  if (!backupName) throw new Error('restoreRegistryBackup requires a backup name');
  const setupSource = backupFile(project, backupName, 'story_setup.json');
  const outlineSource = backupFile(project, backupName, 'outline.json');
  if (!fs.existsSync(setupSource) || !fs.existsSync(outlineSource)) {
    throw new Error(`registry backup not found: ${backupName}`);
  }
  const files = registryFiles(project);
  const backupDir = path.dirname(setupSource);
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    for (const [name, checksum] of Object.entries(manifest.checksums || {})) {
      const target = assertInside(backupDir, name, 'registry backup file');
      if (fileChecksum(target) !== checksum) {
        throw new Error(`registry backup checksum mismatch: ${backupName}/${name}`);
      }
    }
  }
  const changes = {
    setup: changedKeys(readJson(files.setup), readJson(setupSource)),
    outline: changedKeys(readJson(files.outline), readJson(outlineSource)),
  };
  if (options.dryRun) {
    return { ok: true, action: 'restore-dry-run', backup: backupName, changes, dryRun: true };
  }
  fs.copyFileSync(setupSource, files.setup);
  fs.copyFileSync(outlineSource, files.outline);
  appendRegistryOperation(project, {
    action: 'restore',
    backup: toPosixPath(path.relative(project.dir, backupDir)),
  });
  return { ok: true, action: 'restore', backup: backupName, changes };
}

export function registryOperations(project, options = {}) {
  const limit = Math.max(1, Math.min(200, Number(options.limit) || 20));
  const all = readRegistryOperations(project, 10000);
  const states = new Map();
  for (const operation of all) {
    if (operation.action === 'undo' && operation.original_operation_id) {
      states.set(operation.original_operation_id, 'undone');
      states.set(operation.id, 'applied');
    } else if (operation.action === 'redo' && operation.original_operation_id) {
      const undo = all.find((item) => item.id === operation.original_operation_id);
      if (undo?.original_operation_id) states.set(undo.original_operation_id, 'applied');
      states.set(operation.id, 'applied');
    }
  }
  const operations = all
    .filter((operation) => !options.action || operation.action === options.action)
    .filter((operation) => !options.since || String(operation.at || '') >= options.since)
    .slice(-limit)
    .map((operation) => ({ ...operation, state: states.get(operation.id) || 'applied' }));
  return {
    ok: true,
    action: 'registry-log',
    path: 'logs/registry-operations.jsonl',
    count: operations.length,
    operations,
  };
}
