// `ideas` command handlers: types / import / discover / search / draw (validate lives in ./ideas-validate.js).
import fs from 'node:fs';
import path from 'node:path';
import { discoverSources, loadProject, saveIdeaDraw, saveImportedIdeas, searchSources } from '../project.js';
import { readJson } from '../util.js';
import { drawIdeas, ideasTypes } from '../ideas.js';
import { runIdeasValidate } from './ideas-validate.js';
import { EXIT_ERROR, EXIT_OK, boolFlag, castCountFlag, enumFlag, intFlag, print, stringFlag, usageFail } from './args.js';
import { IDEAS_TYPES, PROVIDER_VALUES } from './spec.js';

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
