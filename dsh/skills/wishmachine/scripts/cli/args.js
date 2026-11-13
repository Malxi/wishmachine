// argv parsing, flag accessors and shared output/error helpers (command specs live in ./spec.js).
const EXIT_OK = 0;
const EXIT_ERROR = 1;
const EXIT_BLOCKING = 2;

const BOOLEAN_FLAGS = new Set(['apply', 'json', 'help', 'h', 'dry-run', 'ingest', 'save', 'all', 'strict', 'fix', 'prune', 'no-strict']);

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
  EXIT_BLOCKING,
  EXIT_ERROR,
  EXIT_OK,
  boolFlag,
  castCountFlag,
  checkExit,
  enumFlag,
  fail,
  intFlag,
  maxFindingsFlag,
  parseArgs,
  print,
  stdinText,
  stringFlag,
  usageFail,
};
