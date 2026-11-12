import { loadProject, initProject, projectStatus, projectState, auditProject, refreshProject, exportManuscript, doctorProject, saveIdeaDraw, saveImportedIdeas, saveResearchReport, discoverSources, searchSources, readSection, writeArtifact, projectRegistryStatus, cleanRegistry, abandonMystery, registryOperations, undoRegistryOperation, redoRegistryOperation, registryBackups, createRegistrySnapshot, restoreRegistryBackup, checkRegistryBackups } from './project.js';
import { checkProject } from './schema.js';
import { readJson } from './util.js';
import { drawIdeas, ideasTypes, validateIdeaDraw } from './ideas.js';
import { listWorkflows, readWorkflow, listReferences, readReference, listSkills, readSkill } from './guides.js';

const VERSION = '0.2.22';
const BOOLEAN_FLAGS = new Set(['apply', 'json', 'help', 'h', 'dry-run', 'force', 'ingest']);
const COMMANDS = new Set(['book', 'check', 'ideas', 'gen', 'state', 'audit', 'refresh', 'export', 'doctor', 'version', 'help']);

function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--') {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (token.startsWith('--')) {
      const body = token.slice(2);
      const eq = body.indexOf('=');
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
        continue;
      }
      if (BOOLEAN_FLAGS.has(body)) {
        if (argv[i + 1] === 'true' || argv[i + 1] === 'false') {
          flags[body] = argv[i + 1];
          i += 1;
        } else {
          flags[body] = true;
        }
        continue;
      }
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) {
        flags[body] = next;
        i += 1;
      } else {
        flags[body] = true;
      }
      continue;
    }
    if (token.startsWith('-') && token.length > 1) {
      flags[token.slice(1)] = true;
      continue;
    }
    positionals.push(token);
  }
  return { flags, positionals };
}

function boolFlag(flags, name) {
  const value = flags[name];
  return value === true || value === 'true';
}

function stringFlag(flags, name, fallback = '') {
  const value = flags[name];
  return value === undefined || value === true ? fallback : String(value);
}

function intFlag(flags, name, fallback = 0) {
  const value = Number(flags[name]);
  return Number.isFinite(value) ? value : fallback;
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function fail(message) {
  const error = new Error(message);
  error.isWishmachine = true;
  throw error;
}

async function stdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
  }
  return chunks.join('');
}

function help() {
  return `wishmachine ${VERSION}

Commands:
  book init <name> [--dir <dir>] [--parts 1] [--volumes 1] [--chapter 20] [--chapter-chars 3000] [--min-chars 1800] [--genre ...]
  book status [--dir <dir>] [--json]
  state [--dir <dir>] [--view brief|full]
  audit [--dir <dir>] [--view brief|full] [--min-severity low|medium|high|critical] [--max-findings 10]
  refresh [setup|outline|all] [--dir <dir>]
  export [--dir <dir>] [--output drafts/manuscript.md] [--format book|plain]
  doctor [--dir <dir>] [--fix]
  book read <setup|outline|craft|chapter|recap|context|logs|ideas|idea|research|graph> [--id <id>] [--view index|full]
  book registry [--dir <project>]
  book registry clean [--dir <project>] [--dry-run]
  book registry log [--limit 20] [--action abandon|clean] [--since ISO] [--dir <project>]
  book registry undo [--operation <id>] [--dir <project>]
  book registry redo [--operation <id>] [--dir <project>]
  book registry backups [--keep 10] [--prune] [--dir <project>]
  book registry check-backups [--dir <project>]
  book registry backup [--dir <project>]
  book registry restore --backup <name> [--dry-run] [--dir <project>]
  book registry abandon --mystery <id> [--reason <text>] [--dry-run] [--dir <project>]
  book write <setup|outline|craft|chapter|recap|research> [--mode replace|patch|append] [--apply] [--id <id>] [--from-idea <id>]
  check [--profile quality|schema|custom|all] [--target setup|outline|chapter] [--id <id>]
  ideas draw --type namecard|premise|resource|scenario ... [--count 5] [--seed 42] [--dir <project> --save]
  ideas draw --type outlinepack [--chapters 10] [--scenes 3] [--target-chars 3000]
  ideas draw --type outlinepack [--volumes 3] [--chapters-per-volume 10]
  ideas import --file <cards.json> [--dir <project>] [--type <type>] [--source <source>]
  ideas discover [--topic history|myth|novel] [--limit 3] [--dir <project>]
  ideas search --query <text> [--provider wikipedia|gutenberg] [--limit 3] [--ingest] [--dir <project>]
  ideas validate --id <saved-outlinepack-id> [--dir <project>]
  ideas types
  gen workflow list|read <name>
  gen skill list|read <name>
  gen reference list|read <name>
  version
`;
}

async function runBook(args, flags) {
  const sub = args[0];
  if (sub === 'init') {
    const name = args[1];
    if (!name) fail('book init requires a name');
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
    return 0;
  }
  if (sub === 'status') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    const status = projectStatus(project);
    if (boolFlag(flags, 'json')) {
      print(status);
    } else {
      const written = status.chapters.filter((c) => c.written).length;
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
    }
    return 0;
  }
  if (sub === 'registry') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    if (args[1] === 'backup') {
      print(createRegistrySnapshot(project));
      return 0;
    }
    if (args[1] === 'restore') {
      const backup = stringFlag(flags, 'backup', '');
      if (!backup) fail('book registry restore requires --backup');
      print(restoreRegistryBackup(project, backup, { dryRun: boolFlag(flags, 'dry-run') }));
      return 0;
    }
    if (args[1] === 'check-backups') {
      const result = checkRegistryBackups(project);
      print(result);
      return result.ok ? 0 : 1;
    }
    if (args[1] === 'backups') {
      print(registryBackups(project, {
        keep: intFlag(flags, 'keep', 10),
        prune: boolFlag(flags, 'prune'),
      }));
      return 0;
    }
    if (args[1] === 'redo') {
      print(redoRegistryOperation(project, { operationId: stringFlag(flags, 'operation', '') }));
      return 0;
    }
    if (args[1] === 'undo') {
      print(undoRegistryOperation(project, { operationId: stringFlag(flags, 'operation', '') }));
      return 0;
    }
    if (args[1] === 'log') {
      print(registryOperations(project, {
        limit: intFlag(flags, 'limit', 20),
        action: stringFlag(flags, 'action', ''),
        since: stringFlag(flags, 'since', ''),
      }));
      return 0;
    }
    if (args[1] === 'clean') {
      const result = cleanRegistry(project, { dryRun: boolFlag(flags, 'dry-run') });
      print({ ok: result.ok, section: 'book', action: 'registry-clean', result });
      return result.ok ? 0 : 1;
    }
    if (args[1] === 'abandon') {
      const mystery = stringFlag(flags, 'mystery', '');
      if (!mystery) fail('book registry abandon requires --mystery');
      const result = abandonMystery(project, mystery, stringFlag(flags, 'reason', 'manual'), { dryRun: boolFlag(flags, 'dry-run') });
      print({ ok: result.ok, section: 'book', action: 'registry-abandon', result });
      return result.ok ? 0 : 1;
    }
    const registry = projectRegistryStatus(project);
    print({ ok: registry.ok, section: 'book', action: 'registry', registry });
    return registry.ok ? 0 : 1;
  }
  if (sub === 'state') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(projectState(project, { view: stringFlag(flags, 'view', 'brief') }));
    return 0;
  }
  if (sub === 'audit') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(auditProject(project, {
      view: stringFlag(flags, 'view', 'brief'),
      minSeverity: stringFlag(flags, 'min-severity', ''),
      maxFindings: intFlag(flags, 'max-findings', 0),
    }));
    return 0;
  }
  if (sub === 'refresh') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(refreshProject(project, { target: args[1] || stringFlag(flags, 'target', 'all') }));
    return 0;
  }
  if (sub === 'export') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(exportManuscript(project, {
      output: stringFlag(flags, 'output', ''),
      format: stringFlag(flags, 'format', 'book'),
    }));
    return 0;
  }
  if (sub === 'doctor') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(doctorProject(project, { fix: boolFlag(flags, 'fix') }));
    return 0;
  }
  if (sub === 'read') {
    const section = args[1];
    if (!section) fail('book read requires a section');
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(readSection(project, section, {
      id: stringFlag(flags, 'id', ''),
      view: stringFlag(flags, 'view', 'brief'),
    }));
    return 0;
  }
  if (sub === 'write') {
    const section = args[1];
    if (!section) fail('book write requires a section');
    const project = loadProject(stringFlag(flags, 'dir', ''));
    const fromIdea = stringFlag(flags, 'from-idea', '');
    let content;
    if ((section === 'outline' || section === 'setup') && fromIdea) {
      const draw = readSection(project, 'idea', { id: fromIdea }).draw;
      const field = section === 'outline' ? 'draft_outline' : 'setup_draft';
      const result = (draw.results || []).find((item) => item[field]);
      if (!result) fail(`saved idea ${fromIdea} has no ${field}`);
      content = JSON.stringify(result[field]);
    } else {
      content = await stdinText();
    }
    if (section === 'research') {
      const id = stringFlag(flags, 'id', '');
      const report = JSON.parse(content.charCodeAt(0) === 0xfeff ? content.slice(1) : content);
      print(saveResearchReport(project, id, report));
      return 0;
    }
    const result = writeArtifact(project, {
      section,
      mode: stringFlag(flags, 'mode', 'replace'),
      apply: boolFlag(flags, 'apply'),
      target: stringFlag(flags, 'target', ''),
      id: stringFlag(flags, 'id', ''),
      maxIssues: intFlag(flags, 'max-issues', 0),
      content,
    });
    print(result);
    return result.ok ? 0 : 1;
  }
  fail(`unknown book subcommand: ${sub}`);
}

function runCheck(flags) {
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const target = stringFlag(flags, 'target', 'outline');
  if (!['setup', 'outline', 'craft', 'recap', 'chapter'].includes(target)) {
    fail(`unsupported check target: ${target}`);
  }
  const result = checkProject(project, {
    profile: stringFlag(flags, 'profile', 'all'),
    target,
    id: stringFlag(flags, 'id', ''),
    minSeverity: stringFlag(flags, 'min-severity', ''),
    maxFindings: intFlag(flags, 'max-findings', 0),
  });
  print(result);
  return 0;
}

async function runIdeas(args, flags) {
  const sub = args[0] || 'draw';
  if (sub === 'types') {
    print({ ok: true, section: 'ideas', count: ideasTypes().length, results: ideasTypes() });
    return 0;
  }
  if (sub === 'import') {
    const file = stringFlag(flags, 'file', '');
    if (!file) fail('ideas import requires --file');
    const project = loadProject(stringFlag(flags, 'dir', ''));
    const payload = readJson(file);
    print(saveImportedIdeas(project, payload, {
      type: stringFlag(flags, 'type', ''),
      genre: stringFlag(flags, 'genre', ''),
      source: stringFlag(flags, 'source', ''),
    }));
    return 0;
  }
  if (sub === 'discover') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(await discoverSources(project, {
      topic: stringFlag(flags, 'topic', ''),
      limit: intFlag(flags, 'limit', 3),
    }));
    return 0;
  }
  if (sub === 'search') {
    const query = stringFlag(flags, 'query', '');
    if (!query) fail('ideas search requires --query');
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(await searchSources(project, {
      query,
      provider: stringFlag(flags, 'provider', 'wikipedia'),
      limit: intFlag(flags, 'limit', 3),
      ingest: boolFlag(flags, 'ingest'),
    }));
    return 0;
  }
  if (sub === 'validate') {
    const id = stringFlag(flags, 'id', '');
    if (!id) fail('ideas validate requires --id');
    const project = loadProject(stringFlag(flags, 'dir', ''));
    const draw = readSection(project, 'idea', { id }).draw;
    const result = validateIdeaDraw(draw);
    print({ ok: result.ok, section: 'ideas', action: 'validate', id, findings: result.findings });
    return 0;
  }
  if (sub !== 'draw') fail(`unknown ideas subcommand: ${sub}`);
  const draw = drawIdeas({
    type: stringFlag(flags, 'type', 'namecard'),
    genre: stringFlag(flags, 'genre', ''),
    count: intFlag(flags, 'count', 5),
    seed: intFlag(flags, 'seed', 0),
    source: stringFlag(flags, 'source', ''),
    category: stringFlag(flags, 'category', ''),
    level: stringFlag(flags, 'level', 'axiom'),
    mode: stringFlag(flags, 'mode', 'balanced'),
    chapters: intFlag(flags, 'chapters', 10),
    scenes: intFlag(flags, 'scenes', 3),
    targetChars: intFlag(flags, 'target-chars', 3000),
    volumes: intFlag(flags, 'volumes', 1),
    chaptersPerVolume: intFlag(flags, 'chapters-per-volume', 0),
  });
  if (boolFlag(flags, 'save')) {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(saveIdeaDraw(project, draw));
  } else {
    print(draw);
  }
  return 0;
}

function runGen(args) {
  const group = args[0];
  const sub = args[1] || 'list';
  const name = args[2];
  if (group === 'workflow') {
    if (sub === 'list') {
      print({ ok: true, section: 'workflow', count: listWorkflows().length, results: listWorkflows() });
      return 0;
    }
    if (sub === 'read') {
      if (!name) fail('gen workflow read requires a name');
      print({ ok: true, section: 'workflow', count: 1, results: [{ name, content: readWorkflow(name) }] });
      return 0;
    }
  }
  if (group === 'skill') {
    if (sub === 'list') {
      print({ ok: true, section: 'skill', count: listSkills().length, results: listSkills() });
      return 0;
    }
    if (sub === 'read') {
      if (!name) fail('gen skill read requires a name');
      print({ ok: true, section: 'skill', count: 1, results: [{ name, content: readSkill(name) }] });
      return 0;
    }
  }
  if (group === 'reference') {
    if (sub === 'list') {
      print({ ok: true, section: 'reference', count: listReferences().length, results: listReferences() });
      return 0;
    }
    if (sub === 'read') {
      if (!name) fail('gen reference read requires a name');
      print({ ok: true, section: 'reference', count: 1, results: [{ name, content: readReference(name) }] });
      return 0;
    }
  }
  fail(`unknown gen command: ${args.join(' ')}`);
}

export async function main(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  if (boolFlag(flags, 'help') || boolFlag(flags, 'h')) {
    process.stdout.write(help());
    return 0;
  }
  const command = positionals[0];
  if (!command) {
    process.stdout.write(help());
    return 0;
  }
  if (!COMMANDS.has(command)) fail(`unknown command: ${command}`);
  if (command === 'version') {
    process.stdout.write(`wishmachine ${VERSION}\n`);
    return 0;
  }
  if (command === 'help') {
    process.stdout.write(help());
    return 0;
  }
  if (command === 'book') return runBook(positionals.slice(1), flags);
  if (command === 'state') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(projectState(project, { view: stringFlag(flags, 'view', 'brief') }));
    return 0;
  }
  if (command === 'audit') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(auditProject(project, {
      view: stringFlag(flags, 'view', 'brief'),
      minSeverity: stringFlag(flags, 'min-severity', ''),
      maxFindings: intFlag(flags, 'max-findings', 0),
    }));
    return 0;
  }
  if (command === 'refresh') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(refreshProject(project, { target: positionals[1] || stringFlag(flags, 'target', 'all') }));
    return 0;
  }
  if (command === 'export') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(exportManuscript(project, {
      output: stringFlag(flags, 'output', ''),
      format: stringFlag(flags, 'format', 'book'),
    }));
    return 0;
  }
  if (command === 'doctor') {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(doctorProject(project, { fix: boolFlag(flags, 'fix') }));
    return 0;
  }
  if (command === 'check') return runCheck(flags);
  if (command === 'ideas') return runIdeas(positionals.slice(1), flags);
  if (command === 'gen') return runGen(positionals.slice(1));
  fail(`unhandled command: ${command}`);
}
