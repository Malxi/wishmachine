// Registry actions facade: clean stale entries, abandon a mystery, repair drift and
// report status. All status/order repair goes through registry-rules.js so check
// and repair share one derivation. Implementations live in the sibling modules:
//   - ./registry-docs.js    load setup/outline docs, find a mystery node
//   - ./registry-clean.js   cleanRegistry
//   - ./registry-abandon.js abandonMystery
//   - ./registry-repair.js  repairRegistry
//   - ./registry-status.js  projectRegistryStatus

export { findMysteryNode, loadRegistryDocs } from './registry-docs.js';
export { cleanRegistry } from './registry-clean.js';
export { abandonMystery } from './registry-abandon.js';
export { repairRegistry } from './registry-repair.js';
export { projectRegistryStatus } from './registry-status.js';
