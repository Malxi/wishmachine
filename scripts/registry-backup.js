// Registry backup file layout: the checksum, path and copy helpers shared by the
// snapshot store (backup/restore/list) and the operations log (undo/redo), so both
// concerns resolve backup names through exactly one implementation.

import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { assertInside } from './util.js';
import { outlineFile, registryBackupsDir, setupFile } from './paths.js';

function fileChecksum(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function registryFiles(project) {
  return {
    setup: setupFile(project.dir),
    outline: outlineFile(project.dir),
  };
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

export { backupDirectory, backupFile, copyBackupIntoProject, fileChecksum, registryFiles };
