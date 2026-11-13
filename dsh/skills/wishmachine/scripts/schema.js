// Public rule API facade; implementation and layering live in ./rules/index.js so
// callers keep one stable surface while the rules tree is split into small modules.
export {
  finding, validateCraft, validateRecap, validateSetup, outlineIndex,
  validateOutline, checkCandidate, checkProject,
} from './rules/index.js';
