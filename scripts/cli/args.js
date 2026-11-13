// Shared argv parsing, command/flag tables, enum validation and output helpers.
import { ideasTypes } from '../ideas.js';

const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_BLOCKING = 2;

const PROFILE_VALUES = ['quality', 'schema', 'custom', 'all'];
const SEVERITY_VALUES = ['low', 'medium', 'high', 'critical'];
const CHECK_TARGETS = ['setup', 'outline', 'chapter', 'craft', 'recap'];
const READ_SECTIONS = ['setup', 'outline', 'craft', 'chapter', 'recap', 'context', 'logs', 'ideas', 'idea', 'research', 'graph'];
const WRITE_SECTIONS = ['setup', 'outline', 'craft', 'chapter', 'recap', 'research'];
const VIEW_VALUES = ['brief', 'index', 'full', 'summary'];
const FORMAT_VALUES = ['book', 'plain'];
const MODE_VALUES = ['replace', 'patch', 'append'];
const PROVIDER_VALUES = ['wikipedia', 'gutenberg'];
const REFRESH_TARGETS = ['setup', 'outline', 'all'];
const REGISTRY_LOG_ACTIONS = ['abandon', 'clean'];
const IDEAS_TYPES = new Set(ideasTypes().map((item) => item.name));

const BOOLEAN_FLAGS = new Set(['apply', 'json', 'help', 'h', 'dry-run', 'ingest', 'save', 'all', 'strict', 'fix', 'prune', 'no-strict']);

const COMMAND_FLAGS = {
  version: [],
  help: [],
  state: ['dir', 'view'],
  audit: ['dir', 'view', 'min-severity', 'max-findings', 'no-strict'],
  refresh: ['dir', 'target'],
  export: ['dir', 'output', 'format', 'force'],
  doctor: ['dir', 'fix', 'no-strict'],
  check: ['dir', 'profile', 'target', 'id', 'min-severity', 'max-findings', 'no-strict'],
  'book init': ['dir', 'parts', 'volumes', 'chapter', 'chapter-chars', 'min-chars', 'genre', 'language'],
  'book status': ['dir', 'json'],
  'book registry': ['dir'],
  'book registry clean': ['dir', 'dry-run'],
  'book registry log': ['dir', 'limit', 'action', 'since'],
  'book registry undo': ['dir', 'operation'],
  'book registry redo': ['dir', 'operation'],
  'book registry backups': ['dir', 'keep', 'prune'],
  'book registry check-backups': ['dir'],
  'book registry backup': ['dir'],
  'book registry restore': ['dir', 'backup', 'dry-run'],
  'book registry abandon': ['dir', 'mystery', 'reason', 'dry-run'],
  'book read': ['dir', 'id', 'view'],
  'book write': ['dir', 'mode', 'apply', 'id', 'target', 'from-idea', 'max-issues'],
  'ideas draw': ['dir', 'type', 'genre', 'count', 'seed', 'source', 'chapters', 'scenes', 'target-chars', 'volumes', 'chapters-per-volume', 'cast-count', 'cast-roles', 'prompt-chars', 'character-prompt-chars', 'save', 'output'],
  'ideas import': ['dir', 'file', 'type', 'genre', 'source'],
  'ideas discover': ['dir', 'topic', 'limit'],
  'ideas search': ['dir', 'query', 'provider', 'limit', 'ingest'],
  'ideas validate': ['dir', 'id', 'all', 'strict', 'min-severity', 'max-findings', 'ignore', 'ignore-file', 'output'],
  'ideas types': [],
  'gen workflow list': [],
  'gen workflow read': [],
  'gen skill list': [],
  'gen skill read': [],
  'gen reference list': [],
  'gen reference read': [],
};

const COMMANDS = new Set(['book', 'check', 'ideas', 'gen', 'state', 'audit', 'refresh', 'export', 'doctor', 'version', 'help']);

function fail(message, options = {}) {
  const error = new Error(message);
  error.isWishmachine = true;
  error.code = options.code || 'wishmachine.error';
  error.hint = options.hint || '';
  error.fixCommand = options.fixCommand || '';
  error.exitCode = options.exitCode || EXIT_ERROR;
  throw error;
}

function usageFail(message, hint = '') {
  fail(message, { code: 'usage.error', hint });
}

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
      if (token === '-h') {
        flags.h = true;
        continue;
      }
      usageFail(`unknown flag: ${token}`, 'use --help for the command list');
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
  if (value === undefined) return fallback;
  if (value === true) usageFail(`--${name} requires a value`, `example: --${name} <value>`);
  return String(value);
}

function intFlag(flags, name, fallback = 0) {
  const value = flags[name];
  if (value === undefined) return fallback;
  if (value === true) usageFail(`--${name} requires a number`, `example: --${name} 3`);
  const number = Number(value);
  if (!Number.isFinite(number) || !Number.isInteger(number)) {
    usageFail(`--${name} must be an integer, got ${value}`);
  }
  return number;
}

function enumFlag(flags, name, allowed, fallback = '') {
  const value = flags[name];
  if (value === undefined) return fallback;
  if (value === true) usageFail(`--${name} requires a value`, `allowed: ${allowed.join('|')}`);
  const text = String(value);
  if (!allowed.includes(text)) {
    usageFail(`invalid value for --${name}: ${text}`, `allowed: ${allowed.join('|')}`);
  }
  return text;
}

function maxFindingsFlag(flags) {
  const value = flags['max-findings'];
  if (value === undefined || String(value) === 'all') return 0;
  return Math.max(0, intFlag(flags, 'max-findings', 0));
}

function castCountFlag(flags) {
  const value = flags['cast-count'];
  if (value === undefined) return 4;
  if (String(value) === 'auto') return 0;
  return intFlag(flags, 'cast-count', 4);
}

function commandKey(positionals) {
  const [first, second, third] = positionals;
  if (!first) return '';
  if (first === 'book') {
    if (second === 'registry') return third ? `book registry ${third}` : 'book registry';
    return `book ${second || ''}`.trim();
  }
  if (first === 'ideas') return `ideas ${second || 'draw'}`;
  if (first === 'gen') return `gen ${second || ''} ${third || 'list'}`.trim();
  return first;
}

function validateFlags(key, flags) {
  const allowed = new Set([...(COMMAND_FLAGS[key] || []), 'help', 'h']);
  for (const name of Object.keys(flags)) {
    if (!allowed.has(name)) {
      const listed = [...allowed].filter((item) => item !== 'help' && item !== 'h').join(', ') || '(none)';
      usageFail(`unknown flag: --${name}`, `allowed flags for ${key || 'this command'}: ${listed}`);
    }
  }
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function checkExit(result) {
  return result?.blocking ? EXIT_BLOCKING : EXIT_OK;
}

async function stdinText() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
  }
  return chunks.join('');
}

export {
  CHECK_TARGETS,
  COMMANDS,
  EXIT_BLOCKING,
  EXIT_ERROR,
  EXIT_OK,
  FORMAT_VALUES,
  IDEAS_TYPES,
  MODE_VALUES,
  PROFILE_VALUES,
  PROVIDER_VALUES,
  READ_SECTIONS,
  REFRESH_TARGETS,
  REGISTRY_LOG_ACTIONS,
  SEVERITY_VALUES,
  VIEW_VALUES,
  WRITE_SECTIONS,
  boolFlag,
  castCountFlag,
  checkExit,
  commandKey,
  enumFlag,
  fail,
  intFlag,
  maxFindingsFlag,
  parseArgs,
  print,
  stdinText,
  stringFlag,
  usageFail,
  validateFlags,
};
