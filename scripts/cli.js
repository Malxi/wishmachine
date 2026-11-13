// CLI entry: parses argv once, then dispatches to the handlers under ./cli/.
import {
  COMMANDS,
  EXIT_ERROR,
  EXIT_OK,
  boolFlag,
  commandKey,
  fail,
  parseArgs,
  validateFlags,
} from './cli/args.js';
import { runBook } from './cli/book.js';
import { runGen } from './cli/gen.js';
import { help } from './cli/help.js';
import { runIdeas } from './cli/ideas.js';
import { runAudit, runCheck, runDoctor, runExport, runRefresh, runState } from './cli/project.js';
import { VERSION } from './cli/version.js';

export async function main(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  if (boolFlag(flags, 'help') || boolFlag(flags, 'h')) {
    process.stdout.write(help());
    return EXIT_OK;
  }
  const command = positionals[0];
  if (!command) {
    process.stdout.write(help());
    return EXIT_OK;
  }
  if (!COMMANDS.has(command)) {
    fail(`unknown command: ${command}`, {
      code: 'usage.unknown_command',
      hint: `commands: ${[...COMMANDS].join(', ')}`,
    });
  }
  validateFlags(commandKey(positionals), flags);
  if (command === 'version') {
    process.stdout.write(`wishmachine ${VERSION}\n`);
    return EXIT_OK;
  }
  if (command === 'help') {
    process.stdout.write(help());
    return EXIT_OK;
  }
  if (command === 'book') return runBook(positionals.slice(1), flags);
  if (command === 'state') return runState(flags);
  if (command === 'audit') return runAudit(flags);
  if (command === 'refresh') return runRefresh(positionals, flags);
  if (command === 'export') return runExport(flags);
  if (command === 'doctor') return runDoctor(flags);
  if (command === 'check') return runCheck(flags);
  if (command === 'ideas') return runIdeas(positionals.slice(1), flags);
  if (command === 'gen') return runGen(positionals.slice(1));
  return EXIT_ERROR;
}
