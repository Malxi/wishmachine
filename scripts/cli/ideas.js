// `ideas` command handlers: types / import / discover / search / validate / draw.
import fs from 'node:fs';
import path from 'node:path';
import { discoverSources, loadProject, readSection, saveIdeaDraw, saveImportedIdeas, searchSources } from '../project.js';
import { readJson } from '../util.js';
import { drawIdeas, ideasTypes, validateIdeaDraw } from '../ideas.js';
import {
  EXIT_BLOCKING,
  EXIT_ERROR,
  EXIT_OK,
  IDEAS_TYPES,
  PROVIDER_VALUES,
  SEVERITY_VALUES,
  boolFlag,
  castCountFlag,
  enumFlag,
  intFlag,
  maxFindingsFlag,
  print,
  stringFlag,
  usageFail,
} from './args.js';

function runIdeasTypes() {
  print({ ok: true, section: 'ideas', count: ideasTypes().length, results: ideasTypes() });
  return EXIT_OK;
}

function runIdeasImport(flags) {
  const file = stringFlag(flags, 'file', '');
  if (!file) usageFail('ideas import requires --file', 'example: ideas import --file cards.json --dir <project>');
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const payload = readJson(path.resolve(file));
  print(saveImportedIdeas(project, payload, {
    type: stringFlag(flags, 'type', ''),
    genre: stringFlag(flags, 'genre', ''),
    source: stringFlag(flags, 'source', ''),
  }));
  return EXIT_OK;
}

async function runIdeasDiscover(flags) {
  const project = loadProject(stringFlag(flags, 'dir', ''));
  print(await discoverSources(project, {
    topic: stringFlag(flags, 'topic', ''),
    limit: intFlag(flags, 'limit', 3),
  }));
  return EXIT_OK;
}

async function runIdeasSearch(flags) {
  const query = stringFlag(flags, 'query', '');
  if (!query) usageFail('ideas search requires --query', 'example: ideas search --query "Mary Celeste"');
  const project = loadProject(stringFlag(flags, 'dir', ''));
  print(await searchSources(project, {
    query,
    provider: enumFlag(flags, 'provider', PROVIDER_VALUES, 'wikipedia'),
    limit: intFlag(flags, 'limit', 3),
    ingest: boolFlag(flags, 'ingest'),
  }));
  return EXIT_OK;
}

function createValidateEmitter(output) {
  return (payload, code) => {
    if (output && output !== '-') {
      const file = path.resolve(output);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temp = `${file}.tmp-${process.pid}`;
      try {
        fs.writeFileSync(temp, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
        fs.renameSync(temp, file);
      } catch (error) {
        fs.rmSync(temp, { force: true });
        throw error;
      }
      print({ ok: payload.ok, action: payload.action, output: file, count: payload.count, total_findings: payload.total_findings });
    } else {
      print(payload);
    }
    return code;
  };
}

function validateAllIdeas(project, options) {
  const list = readSection(project, 'ideas').results || [];
  const results = list.map((item) => {
    const draw = readSection(project, 'idea', { id: item.id }).draw;
    const result = validateIdeaDraw(draw, options);
    return {
      id: item.id,
      ok: result.ok,
      total_findings: result.findings.length,
      ignored_findings: result.ignored_findings,
      ignored_rules: result.ignored_rules,
      findings: options.maxFindings ? result.findings.slice(0, options.maxFindings) : result.findings,
    };
  });
  const ok = results.every((item) => item.ok);
  const ignoredFindings = results.reduce((sum, item) => sum + (item.ignored_findings || 0), 0);
  const ignoredRules = results.reduce((aggregate, item) => {
    for (const [rule, count] of Object.entries(item.ignored_rules || {})) {
      aggregate[rule] = (aggregate[rule] || 0) + count;
    }
    return aggregate;
  }, {});
  return { schema_version: 1, ok, section: 'ideas', action: 'validate-all', count: results.length, ignored_findings: ignoredFindings, ignored_rules: ignoredRules, results };
}

function validateOneIdea(project, id, options) {
  const draw = readSection(project, 'idea', { id }).draw;
  const result = validateIdeaDraw(draw, options);
  const findings = options.maxFindings ? result.findings.slice(0, options.maxFindings) : result.findings;
  return { schema_version: 1, ok: result.ok, section: 'ideas', action: 'validate', id, total_findings: result.findings.length, ignored_findings: result.ignored_findings, ignored_rules: result.ignored_rules, findings };
}

function runIdeasValidate(flags) {
  const project = loadProject(stringFlag(flags, 'dir', ''));
  const minSeverity = enumFlag(flags, 'min-severity', SEVERITY_VALUES, 'low');
  const maxFindings = maxFindingsFlag(flags);
  const ignoreFile = stringFlag(flags, 'ignore-file', '');
  let fileIgnore = [];
  if (ignoreFile) {
    const doc = readJson(path.resolve(ignoreFile));
    fileIgnore = Array.isArray(doc) ? doc : (doc.rules || []);
  }
  const ignoreRules = [
    ...stringFlag(flags, 'ignore', '').split(',').map((rule) => rule.trim()).filter(Boolean),
    ...fileIgnore.map((rule) => String(rule || '').trim()).filter(Boolean),
  ];
  const output = stringFlag(flags, 'output', '');
  const emit = createValidateEmitter(output);
  const options = { minSeverity, maxFindings, ignoreRules };
  const strict = boolFlag(flags, 'strict');
  if (boolFlag(flags, 'all')) {
    const payload = validateAllIdeas(project, options);
    return emit(payload, strict && !payload.ok ? EXIT_BLOCKING : EXIT_OK);
  }
  const id = stringFlag(flags, 'id', '');
  if (!id) usageFail('ideas validate requires --id or --all', 'example: ideas validate --id outlinepack-7-... --dir <project>');
  const payload = validateOneIdea(project, id, options);
  return emit(payload, strict && !payload.ok ? EXIT_BLOCKING : EXIT_OK);
}

function runIdeasDraw(flags) {
  const type = enumFlag(flags, 'type', [...IDEAS_TYPES], 'namecard');
  const draw = drawIdeas({
    type,
    genre: stringFlag(flags, 'genre', ''),
    count: flags.count === undefined ? undefined : intFlag(flags, 'count', 1),
    seed: flags.seed === undefined ? undefined : intFlag(flags, 'seed', 0),
    source: stringFlag(flags, 'source', ''),
    chapters: intFlag(flags, 'chapters', 10),
    scenes: intFlag(flags, 'scenes', 3),
    targetChars: intFlag(flags, 'target-chars', 3000),
    volumes: intFlag(flags, 'volumes', 1),
    chaptersPerVolume: intFlag(flags, 'chapters-per-volume', 0),
    castCount: castCountFlag(flags),
    castRoles: stringFlag(flags, 'cast-roles', ''),
    promptChars: intFlag(flags, 'prompt-chars', 800),
    characterPromptChars: intFlag(flags, 'character-prompt-chars', 160),
  });
  if (boolFlag(flags, 'save')) {
    const project = loadProject(stringFlag(flags, 'dir', ''));
    print(saveIdeaDraw(project, draw));
  } else if (stringFlag(flags, 'output', '')) {
    const file = path.resolve(stringFlag(flags, 'output', ''));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const text = `${JSON.stringify(draw, null, 2)}\n`;
    fs.writeFileSync(file, text, 'utf8');
    print({
      ok: true,
      action: 'draw',
      output: file,
      bytes: Buffer.byteLength(text),
      query: draw.query,
      count: draw.count,
      meta: { deck: draw.meta?.deck, seed: draw.meta?.seed },
      hint: 'The full draw was written to --output; read it as a file instead of stdout.',
    });
  } else {
    print(draw);
  }
  return EXIT_OK;
}

const IDEAS_HANDLERS = new Map([
  ['types', runIdeasTypes],
  ['import', runIdeasImport],
  ['discover', runIdeasDiscover],
  ['search', runIdeasSearch],
  ['validate', runIdeasValidate],
  ['draw', runIdeasDraw],
]);

async function runIdeas(args, flags) {
  const sub = args[0] || 'draw';
  const handler = IDEAS_HANDLERS.get(sub);
  if (!handler) {
    usageFail(`unknown ideas subcommand: ${sub}`, 'subcommands: draw|import|discover|search|validate|types');
    return EXIT_ERROR;
  }
  return handler(flags);
}

export { runIdeas };
