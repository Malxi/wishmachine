import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listMarkdown, readMarkdown, readText, firstHeading } from './util.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REFERENCES_DIR = path.join(ROOT, 'references');
export const WORKFLOWS_DIR = path.join(REFERENCES_DIR, 'workflows');
export const SKILL_FILE = path.join(ROOT, 'SKILL.md');

export function listWorkflows() {
  return listMarkdown(WORKFLOWS_DIR);
}

export function readWorkflow(name) {
  return readMarkdown(WORKFLOWS_DIR, name);
}

export function listReferences() {
  const list = listMarkdown(REFERENCES_DIR);
  return list.filter((item) => item.name !== 'workflows');
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
