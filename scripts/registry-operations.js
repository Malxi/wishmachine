// Registry operations log: append/read the JSONL audit trail, undo/redo and the
// operation-state projection used by `book registry log`.

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { ensureDir, nowIso } from './util.js';
import { registryOperationsFile } from './paths.js';
import { copyBackupIntoProject } from './registry-backup.js';

export function appendRegistryOperation(project, operation) {
  ensureDir(path.dirname(registryOperationsFile(project.dir)));
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
