// Quality rule dispatcher. The per-target implementations live in the sibling
// modules so each one can be edited without touching the others.
import { qualityChapterFindings } from './chapter.js';
import { qualityCraftFindings } from './craft.js';
import { qualityOutlineFindings } from './outline.js';
import { qualityRecapFindings } from './recap.js';
import { qualitySetupFindings } from './setup.js';

function qualityFindings(project, target, id, override = {}) {
  if (target === 'setup') return qualitySetupFindings(project, override);
  if (target === 'craft') return qualityCraftFindings(project, id, override);
  if (target === 'recap') return qualityRecapFindings(project, id, override);
  if (target === 'outline') return qualityOutlineFindings(project, override);
  if (target === 'chapter') return qualityChapterFindings(project, id, override);
  return [];
}

export { qualityFindings };
