import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listMarkdown, readMarkdown, readText, firstHeading } from './util.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REFERENCES_DIR = path.join(ROOT, 'references');
export const WORKFLOW_PREFIX = 'workflow-';
export const SKILL_FILE = path.join(ROOT, 'SKILL.md');

export function listWorkflows() {
  return listMarkdown(REFERENCES_DIR)
    .filter((item) => item.name.startsWith(WORKFLOW_PREFIX))
    .map((item) => ({ name: item.name.slice(WORKFLOW_PREFIX.length), description: item.description }));
}

export function readWorkflow(name) {
  return readMarkdown(REFERENCES_DIR, `${WORKFLOW_PREFIX}${name}`);
}

export function listReferences() {
  return listMarkdown(REFERENCES_DIR).filter((item) => !item.name.startsWith(WORKFLOW_PREFIX));
}

export function readReference(name) {
  return readMarkdown(REFERENCES_DIR, name);
}

export function listSkills() {
  return [{ name: 'wishmachine', description: firstHeading(readText(SKILL_FILE)) || 'Wishmachine skill' }];
}

export function readSkill(name) {
  if (String(name || '').toLowerCase() !== 'wishmachine') {
    throw new Error(`unknown skill: ${name}`);
  }
  return readText(SKILL_FILE);
}
