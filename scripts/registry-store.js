// Registry backup/undo/redo/log store facade. The implementation is split by
// concern so parallel edits do not collide:
//   - ./registry-backup.js     shared backup file layout/checksum helpers
//   - ./registry-snapshot.js   create/list/check/restore backups
//   - ./registry-operations.js append/read log, undo/redo, operation states
// Every name below is re-exported from its original module path, so project.js
// and registry-actions.js keep importing ./registry-store.js unchanged.

export {
  checkRegistryBackups, createRegistryBackup, createRegistrySnapshot,
  registryBackups, restoreRegistryBackup,
} from './registry-snapshot.js';
export {
  appendRegistryOperation, readRegistryOperations, redoRegistryOperation,
  registryOperations, undoRegistryOperation,
} from './registry-operations.js';
