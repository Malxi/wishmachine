// Stable CLI command surface: scripts/cli.js imports every handler from here.
export { runBook } from './book.js';
export { runGen } from './gen.js';
export { runIdeas } from './ideas.js';
export { runAudit, runCheck, runDoctor, runExport, runRefresh, runState } from './project.js';
