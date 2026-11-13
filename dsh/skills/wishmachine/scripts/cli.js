// CLI entry: parses argv once, then dispatches to the handlers under ./cli/.
import { EXIT_ERROR, EXIT_OK, boolFlag, fail, parseArgs } from './cli/args.js';
import { runAudit, runBook, runCheck, runDoctor, runExport, runGen, runIdeas, runRefresh, runState } from './cli/index.js';
import { commandHelp, help } from './cli/help.js';
import { COMMANDS, commandKey, validateFlags } from './cli/spec.js';
import { VERSION } from './cli/version.js';

function assertKnownCommand(command) {
  if (!COMMANDS.has(command)) {
    fail(`unknown command: ${command}`, {
      code: 'usage.unknown_command',
      hint: `commands: ${[...COMMANDS].join(', ')}`,
    });
  }
}

export async function main(argv = process.argv.slice(2)) {
  const { flags, positionals } = parseArgs(argv);
  const command = positionals[0];
  const wantsHelp = boolFlag(flags, 'help') || boolFlag(flags, 'h');
  if (wantsHelp) {
    if (!command) {
      process.stdout.write(help());
      return EXIT_OK;
    }
    assertKnownCommand(command);
    validateFlags(commandKey(positionals), flags);
    process.stdout.write(commandHelp(positionals));
    return EXIT_OK;
  }
  if (!command) {
    process.stdout.write(help());
    return EXIT_OK;
  }
  assertKnownCommand(command);
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
