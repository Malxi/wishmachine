// Quality rules for story/setup/story_setup.json: protagonist presence and premise depth.
import path from 'node:path';
import { readJson } from '../../util.js';
import { finding } from '../finding.js';
import { asArray, isPlainObject } from './shared.js';

function qualitySetupFindings(project, override) {
  const findings = [];
  const setup = override.setup || readJson(path.join(project.dir, 'story', 'setup', 'story_setup.json'));
  // Schema validation reports the shape; quality rules must not crash on
  // explicitly mistyped fields (e.g. core_cast: "oops").
  if (!isPlainObject(setup)) return findings;
  if (!asArray(setup.core_cast).some((character) => character?.role === 'protagonist')) {
    findings.push(finding('quality.setup.protagonist', 'medium', 'setup has no protagonist in core_cast', 'setup'));
  }
  if (!setup.premise || setup.premise.length < 20) {
    findings.push(finding('quality.setup.premise', 'medium', 'premise is too short to guide an outline', 'setup'));
  }
  return findings;
}

export { qualitySetupFindings };
