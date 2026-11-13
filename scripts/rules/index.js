// Public rule API for the rest of the codebase. Implementation lives in the
// sibling rule modules; this file only re-exports so callers get one stable
// surface: finding, validateCraft, validateRecap, validateSetup, validateOutline,
// outlineIndex, checkCandidate and checkProject.
export { finding } from './finding.js';
export { validateCraft, validateRecap, validateSetup } from './shape.js';
export { outlineIndex, validateOutline } from './outline-shape.js';
export { checkCandidate, checkProject } from './check.js';
