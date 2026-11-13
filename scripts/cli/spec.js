// Command specification: flag tables, enum value lists, dispatch keys and flag validation.
// Command mechanics (parsing/flag accessors/output) live in ./args.js.
import { ideasTypes } from '../ideas.js';
import { usageFail } from './args.js';
import { BOOK_COMMAND_FLAGS } from './spec/book.js';
import { GEN_COMMAND_FLAGS } from './spec/gen.js';
import { IDEAS_COMMAND_FLAGS } from './spec/ideas.js';
import { PROJECT_COMMAND_FLAGS } from './spec/project.js';

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

const COMMANDS = new Set(['book', 'check', 'ideas', 'gen', 'state', 'audit', 'refresh', 'export', 'doctor', 'version', 'help']);

const COMMAND_FLAGS = {
  ...PROJECT_COMMAND_FLAGS,
  ...BOOK_COMMAND_FLAGS,
  ...IDEAS_COMMAND_FLAGS,
  ...GEN_COMMAND_FLAGS,
};

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

export {
  CHECK_TARGETS,
  COMMANDS,
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
  commandKey,
  validateFlags,
};
