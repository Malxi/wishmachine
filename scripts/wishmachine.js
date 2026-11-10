#!/usr/bin/env node
import { main } from './lib/cli.js';

try {
  const code = await main();
  process.exitCode = code || 0;
} catch (error) {
  process.stderr.write(`wishmachine: ${error.message}\n`);
  process.exitCode = 1;
}
