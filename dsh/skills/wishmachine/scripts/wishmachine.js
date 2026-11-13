#!/usr/bin/env node
import { main } from './cli.js';

function emitError(error) {
  const payload = {
    ok: false,
    schema_version: 1,
    error: {
      code: error?.code || 'wishmachine.error',
      message: error?.message || String(error),
      ...(error?.hint ? { hint: error.hint } : {}),
      ...(error?.fixCommand ? { fix_command: error.fixCommand } : {}),
    },
  };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.stderr.write(`wishmachine: ${payload.error.message}\n`);
  process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1;
}

try {
  const code = await main();
  process.exitCode = code || 0;
} catch (error) {
  emitError(error);
}
