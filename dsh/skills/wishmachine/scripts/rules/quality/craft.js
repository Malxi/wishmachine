// Quality rules for story/craft/<kind>.json: character background and motivation depth.
import path from 'node:path';
import { readJson, safeSegment } from '../../util.js';
import { finding } from '../finding.js';
import { isPlainObject } from './shared.js';

function qualityCraftFindings(project, id, override) {
  const findings = [];
  const kind = safeSegment(id || 'character', 'craft kind');
  const craft = override.craft || readJson(path.join(project.dir, 'story', 'craft', `${kind}.json`));
  if (!isPlainObject(craft)) return findings;
  if (kind !== 'character') return findings;
  if (String(craft.background || '').trim().length < 20) {
    findings.push(finding('quality.craft.background', 'medium', 'character background is too thin', craft.name || kind));
  }
  if (String(craft.motivation || '').trim().length < 10) {
    findings.push(finding('quality.craft.motivation', 'medium', 'character motivation is too thin', craft.name || kind));
  }
  return findings;
}

export { qualityCraftFindings };
