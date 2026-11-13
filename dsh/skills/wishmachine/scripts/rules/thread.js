// Consistency between the setup and outline thread registries.
import fs from 'node:fs';
import path from 'node:path';
import { registryConsistencyFindings } from '../registry-rules.js';
import { readJson } from '../util.js';
import { finding } from './finding.js';

function threadConsistencyFindings(project) {
  const setupPath = path.join(project.dir, 'story', 'setup', 'story_setup.json');
  const outlinePath = path.join(project.dir, 'story', 'compose', 'outline.json');
  if (!fs.existsSync(setupPath) || !fs.existsSync(outlinePath)) return [];
  let setup;
  let outline;
  try {
    setup = readJson(setupPath);
    outline = readJson(outlinePath);
  } catch {
    return [];
  }
  return registryConsistencyFindings(setup, outline).map((rule) => (
    finding(rule.rule_id, rule.severity, rule.issue, rule.target_id, rule.suggestion)
  ));
}

export { threadConsistencyFindings };
