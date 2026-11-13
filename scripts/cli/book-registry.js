// `book registry` subcommands: backup/restore/undo/redo/log/clean/abandon + status.
import {
  abandonMystery,
  checkRegistryBackups,
  cleanRegistry,
  createRegistrySnapshot,
  loadProject,
  projectRegistryStatus,
  redoRegistryOperation,
  registryBackups,
  registryOperations,
  restoreRegistryBackup,
  undoRegistryOperation,
} from '../project.js';
import { EXIT_BLOCKING, EXIT_ERROR, EXIT_OK, boolFlag, enumFlag, intFlag, print, stringFlag, usageFail } from './args.js';
import { REGISTRY_LOG_ACTIONS } from './spec.js';

function runBookRegistry(args, flags) {
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const registrySub = args[1];
  if (registrySub === 'backup') {
    print(createRegistrySnapshot(project));
    return EXIT_OK;
  }
  if (registrySub === 'restore') {
    const backup = stringFlag(flags, 'backup', '');
    if (!backup) usageFail('book registry restore requires --backup', 'example: book registry restore --backup <name>');
    print(restoreRegistryBackup(project, backup, { dryRun: boolFlag(flags, 'dry-run') }));
    return EXIT_OK;
  }
  if (registrySub === 'check-backups') {
    const result = checkRegistryBackups(project);
    print(result);
    return result.ok ? EXIT_OK : EXIT_BLOCKING;
  }
  if (registrySub === 'backups') {
    print(registryBackups(project, { keep: intFlag(flags, 'keep', 10), prune: boolFlag(flags, 'prune') }));
    return EXIT_OK;
  }
  if (registrySub === 'redo') {
    print(redoRegistryOperation(project, { operationId: stringFlag(flags, 'operation', '') }));
    return EXIT_OK;
  }
  if (registrySub === 'undo') {
    print(undoRegistryOperation(project, { operationId: stringFlag(flags, 'operation', '') }));
    return EXIT_OK;
  }
  if (registrySub === 'log') {
    print(registryOperations(project, {
      limit: intFlag(flags, 'limit', 20),
      action: enumFlag(flags, 'action', REGISTRY_LOG_ACTIONS, ''),
      since: stringFlag(flags, 'since', ''),
    }));
    return EXIT_OK;
  }
  if (registrySub === 'clean') {
    const result = cleanRegistry(project, { dryRun: boolFlag(flags, 'dry-run') });
    print({ ok: result.ok, section: 'book', action: 'registry-clean', result });
    return result.ok ? EXIT_OK : EXIT_ERROR;
  }
  if (registrySub === 'abandon') {
    const mystery = stringFlag(flags, 'mystery', '');
    if (!mystery) usageFail('book registry abandon requires --mystery', 'example: book registry abandon --mystery <id>');
    const result = abandonMystery(project, mystery, stringFlag(flags, 'reason', 'manual'), { dryRun: boolFlag(flags, 'dry-run') });
    print({ ok: result.ok, section: 'book', action: 'registry-abandon', result });
    return result.ok ? EXIT_OK : EXIT_ERROR;
  }
  const registry = projectRegistryStatus(project);
  print({ ok: registry.ok, section: 'book', action: 'registry', registry });
  return registry.ok ? EXIT_OK : EXIT_BLOCKING;
}

export { runBookRegistry };
