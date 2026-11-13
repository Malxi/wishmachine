// Facade for the Wishmachine core. Each concern lives in its own module; this
// file keeps the historical public API of scripts/project.js (27 names) intact
// so scripts/cli/** and the tests need no changes. Keep it logic-free: a pure
// re-export surface stays conflict-free while modules evolve in parallel.

export { initProject, loadProject, auditProject, refreshProject } from './project-core.js';
export { projectStatus, projectState } from './state.js';
export { saveIdeaDraw, saveImportedIdeas, saveResearchReport } from './store.js';
export { writeArtifact } from './write.js';
export { readSection } from './read.js';
export { exportManuscript } from './export.js';
export { ingestSource, searchSources, discoverSources } from './sources.js';
export { buildProjectGraph } from './graph.js';
export { doctorProject } from './doctor.js';
export { cleanRegistry, abandonMystery, projectRegistryStatus } from './registry-actions.js';
export {
  undoRegistryOperation, redoRegistryOperation, registryBackups, createRegistrySnapshot,
  restoreRegistryBackup, checkRegistryBackups, registryOperations,
} from './registry-store.js';
