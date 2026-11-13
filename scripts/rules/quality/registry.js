// Quality rule: the setup/outline pair must carry the canonical registries
// derived from their own content. doctor --fix rebuilds them; `book write
// setup/outline` repairs them automatically, so a green check no longer hides a
// pair that doctor would call inconsistent.
import fs from 'node:fs';
import { readJson } from '../../util.js';
import { outlineFile, setupFile } from '../../paths.js';
import { registryRepairReasons } from '../../registry-rules.js';
import { finding } from '../finding.js';

function readIfPresent(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    // Corrupt artifacts already surface as artifact.invalid_json findings.
    return null;
  }
}

function qualityRegistryFindings(project, override = {}) {
  const outline = override.outline !== undefined ? override.outline : readIfPresent(outlineFile(project.dir));
  if (!outline) return [];
  const setup = override.setup !== undefined ? override.setup : readIfPresent(setupFile(project.dir));
  if (!setup) return [];
  const reasons = registryRepairReasons(setup, outline);
  if (reasons.length === 0) return [];
  return [finding(
    'quality.registry.drift',
    'medium',
    `setup/outline registries are not canonical: ${reasons.join(', ')}`,
    'registries',
    'Run doctor --fix to rebuild the derived registries; book write setup/outline repairs them automatically.',
  )];
}

export { qualityRegistryFindings };
