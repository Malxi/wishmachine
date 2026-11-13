// Public rule API. Implementation lives in ./rules/*; this facade only re-exports
// so existing imports (project.js, write.js, read.js, artifacts.js, registry-actions.js)
// keep working unchanged.
export { finding } from './rules/finding.js';
export { validateCraft, validateRecap, validateSetup } from './rules/shape.js';
export { outlineIndex, validateOutline } from './rules/outline-shape.js';
export { checkCandidate, checkProject } from './rules/check.js';
