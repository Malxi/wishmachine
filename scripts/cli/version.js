// CLI version: single-sourced from package.json.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { version: VERSION } = require('../../package.json');

export { VERSION };
