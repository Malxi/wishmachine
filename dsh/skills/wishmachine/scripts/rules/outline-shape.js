// Outline shape: registries, ordering and per-part/volume/chapter structure.
// Cross-chapter mystery/thread semantics live in ./outline-semantics.js, the
// registry rules in ./outline-registries.js, the tree walk in
// ./outline-structure.js and the index helpers in ./outline-index.js.
// outlineIndex/findOutlineChapter stay re-exported here: state.js, read.js and
// rules/index.js import them from this module path.
import { finding } from './finding.js';
import { validateMysterySemantics, validateOutlineCounts, validateThreadSemantics } from './outline-semantics.js';
import { validateOutlineRegistries, validateRegistryOrder } from './outline-registries.js';
import { collectOutlineStructure } from './outline-structure.js';
import { findOutlineChapter, outlineIndex } from './outline-index.js';

function validateOutline(outline, config) {
  if (!outline || typeof outline !== 'object' || Array.isArray(outline)) {
    return [finding('schema.outline.object', 'critical', 'outline must be a JSON object')];
  }
  if (!Array.isArray(outline.parts) || outline.parts.length === 0) {
    return [finding('schema.outline.parts', 'critical', 'outline.parts must be a non-empty array')];
  }
  const ctx = createOutlineContext(outline, config);
  validateOutlineRegistries(ctx);
  validateRegistryOrder(ctx);
  collectOutlineStructure(ctx);
  validateMysterySemantics(ctx);
  validateThreadSemantics(ctx);
  validateOutlineCounts(ctx);
  return ctx.findings;
}

function createOutlineContext(outline, config) {
  return {
    outline,
    config,
    findings: [],
    ids: new Set(),
    threadIds: new Set(),
    threadMap: new Map(),
    mysteryRegistryIds: new Set(),
    hasMysteryRegistry: outline.mystery_registry !== undefined,
    chapterIds: [],
    chaptersById: new Map(),
    mysteryChapter: new Map(),
    mysteryFinalStatus: new Map(),
    volumeCount: 0,
    chapterCount: 0,
  };
}

export { findOutlineChapter, outlineIndex, validateOutline };
