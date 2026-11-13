// `book` command handlers: init / status / registry / read / write.
import {
  abandonMystery,
  checkRegistryBackups,
  cleanRegistry,
  createRegistrySnapshot,
  initProject,
  loadProject,
  projectRegistryStatus,
  projectStatus,
  readSection,
  redoRegistryOperation,
  registryBackups,
  registryOperations,
  restoreRegistryBackup,
  saveResearchReport,
  undoRegistryOperation,
  writeArtifact,
} from '../project.js';
import {
  EXIT_BLOCKING,
  EXIT_ERROR,
  EXIT_OK,
  MODE_VALUES,
  READ_SECTIONS,
  REGISTRY_LOG_ACTIONS,
  VIEW_VALUES,
  WRITE_SECTIONS,
  boolFlag,
  enumFlag,
  fail,
  intFlag,
  print,
  stdinText,
  stringFlag,
  usageFail,
} from './args.js';

function runBookInit(args, flags) {
  const name = args[1];
  if (!name) usageFail('book init requires a name', 'example: book init "我的书" --dir my-book');
  const result = initProject({
    name,
    dir: stringFlag(flags, 'dir', ''),
    parts: intFlag(flags, 'parts', 1),
    volumes: intFlag(flags, 'volumes', 1),
    chapter: intFlag(flags, 'chapter', 20),
    chapterChars: intFlag(flags, 'chapter-chars', 3000),
    minChars: intFlag(flags, 'min-chars', 1800),
    genre: stringFlag(flags, 'genre', ''),
    language: stringFlag(flags, 'language', 'zh'),
  });
  print({ ok: true, action: 'init', name, projectDir: result.dir, structure: result.config.structure });
  return EXIT_OK;
}

function runBookStatus(flags) {
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const status = projectStatus(project);
  if (boolFlag(flags, 'json')) {
    print({ ok: true, ...status });
  } else {
    const written = status.chapters.filter((chapter) => chapter.written).length;
    process.stdout.write(`Project: ${status.name} (${status.root})\n`);
    process.stdout.write(`Setup: ${status.setup}\n`);
    process.stdout.write(`Structure: ${status.structure.target_parts} parts / ${status.structure.target_volumes} volumes / ${status.structure.target_chapters} chapters per volume, ${written} written\n`);
    process.stdout.write(`Chapter target: ${status.chapter_config?.target_chars || 3000} chars (min ${status.chapter_config?.min_chars || 1800})\n`);
    if (status.orphan_chapters?.length) {
      process.stdout.write(`Orphan chapters: ${status.orphan_chapters.join(', ')}\n`);
    }
    if (status.orphan_recaps?.length) {
      process.stdout.write(`Orphan recaps: ${status.orphan_recaps.join(', ')}\n`);
    }
    process.stdout.write(`Next: ${status.next.stage}${status.next.targetId ? ` ${status.next.targetId}` : ''}${status.next.reason ? ` (${status.next.reason})` : ''}\n`);
    if (status.next.command) process.stdout.write(`Next command: ${status.next.command}\n`);
  }
  return EXIT_OK;
}

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

function runBookRead(args, flags) {
  const section = args[1];
  if (!section) usageFail('book read requires a section', `sections: ${READ_SECTIONS.join('|')}`);
  if (!READ_SECTIONS.includes(section)) {
    usageFail(`unsupported read section: ${section}`, `sections: ${READ_SECTIONS.join('|')}`);
  }
  const defaultView = section === 'idea' ? 'summary' : 'brief';
  const view = enumFlag(flags, 'view', VIEW_VALUES, defaultView);
  const project = loadProject(stringFlag(flags, 'dir', ''));
  print(readSection(project, section, { id: stringFlag(flags, 'id', ''), view }));
  return EXIT_OK;
}

async function runBookWrite(args, flags) {
  const section = args[1];
  if (!section) usageFail('book write requires a section', `sections: ${WRITE_SECTIONS.join('|')}`);
  if (!WRITE_SECTIONS.includes(section)) {
    usageFail(`unsupported write section: ${section}`, `sections: ${WRITE_SECTIONS.join('|')}`);
  }
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const mode = enumFlag(flags, 'mode', MODE_VALUES, 'replace');
  const fromIdea = stringFlag(flags, 'from-idea', '');
  let content;
  if ((section === 'outline' || section === 'setup') && fromIdea) {
    const draw = readSection(project, 'idea', { id: fromIdea }).draw;
    const field = section === 'outline' ? 'draft_outline' : 'setup_draft';
    const result = (draw.results || []).find((item) => item[field]);
    if (!result) {
      fail(`saved idea ${fromIdea} has no ${field}`, {
        code: 'idea.missing_section',
        hint: 'use an outlinepack saved with --save, then pass its id',
      });
    }
    content = JSON.stringify(result[field]);
  } else {
    content = await stdinText();
  }
  if (section === 'research') {
    let report;
    try {
      report = JSON.parse(content.charCodeAt(0) === 0xfeff ? content.slice(1) : content);
    } catch (error) {
      fail(`research report is not valid JSON: ${error.message}`, { code: 'research.invalid_json' });
    }
    const id = stringFlag(flags, 'id', '');
    const apply = boolFlag(flags, 'apply');
    if (!apply) {
      print({ ok: true, applied: false, dry_run: true, section: 'research', id, report });
      return EXIT_OK;
    }
    print(saveResearchReport(project, id, report));
    return EXIT_OK;
  }
  let result;
  try {
    result = writeArtifact(project, {
      section,
      mode,
      apply: boolFlag(flags, 'apply'),
      target: stringFlag(flags, 'target', ''),
      id: stringFlag(flags, 'id', ''),
      maxIssues: intFlag(flags, 'max-issues', 0),
      content,
    });
  } catch (error) {
    if (error?.isWishmachine) throw error;
    fail(error.message, { code: 'write.invalid' });
  }
  print(result);
  return result.ok ? EXIT_OK : EXIT_BLOCKING;
}

const BOOK_HANDLERS = new Map([
  ['init', runBookInit],
  ['status', (args, flags) => runBookStatus(flags)],
  ['registry', runBookRegistry],
  ['read', runBookRead],
  ['write', runBookWrite],
]);

async function runBook(args, flags) {
  const sub = args[0];
  const handler = sub ? BOOK_HANDLERS.get(sub) : undefined;
  if (!handler) {
    usageFail(`unknown book subcommand: ${sub || '(none)'}`, 'subcommands: init|status|registry|read|write');
    return EXIT_ERROR;
  }
  return handler(args, flags);
}

export { runBook };
