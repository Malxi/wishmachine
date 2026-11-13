// CLI version: single-sourced from the package.json that ships with the bundle.
// The packaged skill contains scripts/package.json (no root package.json), so
// resolve one level up from scripts/cli/ rather than two.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../package.json');

export { VERSION };
