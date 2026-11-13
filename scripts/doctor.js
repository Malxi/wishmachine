// Project doctor: layout/config/JSON/orphan checks plus the single registry
// repair path shared with schema.checkProject via registry-rules.js.

import fs from 'node:fs';
import path from 'node:path';
import { ensureDir, readJson } from './util.js';
import {
  configFile, listJsonFiles, outlineFile, projectPath, projectStatus, setupFile,
} from './artifacts.js';
import { loadRegistryDocs, repairRegistry } from './registry-actions.js';
import { registryRepairReasons } from './registry-rules.js';

const LAYOUT_DIRS = ['story/setup', 'story/compose', 'story/craft', 'story/recaps', 'chapters', 'drafts', 'logs'];

function collectLayoutIssues(project, add, actions, fix) {
  for (const dir of LAYOUT_DIRS) {
    if (fs.existsSync(path.join(project.dir, dir))) continue;
    add('medium', 'layout.missing_dir', `missing directory: ${dir}`, 'Create the directory or rerun book init on a fresh project.');
    if (fix) {
      ensureDir(path.join(project.dir, dir));
      actions.push(`created ${dir}`);
    }
  }
}

function collectConfigIssues(project, add) {
  let rawConfig;
  try {
    rawConfig = readJson(configFile(project.dir));
  } catch (error) {
    add('high', 'config.invalid_json', 'novel.json is not valid JSON', `Repair novel.json: ${error.message}`);
    return;
  }
  if (!rawConfig.name) add('low', 'config.name', 'novel.json has no name', 'Add a book name.');
}

function collectJsonIssues(project, add) {
  const files = [setupFile(project.dir), outlineFile(project.dir)];
  for (const dir of [projectPath(project.dir, 'craft'), projectPath(project.dir, 'recaps')]) {
    for (const name of listJsonFiles(dir)) files.push(path.join(dir, name));
  }
  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    try {
      readJson(file);
    } catch (error) {
      add('high', 'artifact.invalid_json', `${path.relative(project.dir, file)} is not valid JSON`, `Repair or replace the file: ${error.message}`);
    }
  }
}

function collectPresenceIssues(project, add) {
  if (!fs.existsSync(setupFile(project.dir))) add('low', 'artifact.setup', 'setup JSON is missing', 'Write setup through book write setup.');
  if (!fs.existsSync(outlineFile(project.dir))) add('low', 'artifact.outline', 'outline JSON is missing', 'Write an outline through book write outline.');
}

function collectRegistryIssues(project, add, actions, fix) {
  let docs;
  try {
    docs = loadRegistryDocs(project);
  } catch (error) {
    add('high', 'registry.unreadable', 'registry documents could not be read', `Repair the invalid artifact: ${error.message}`);
    return;
  }
  if (!docs) return;
  const reasons = registryRepairReasons(docs.setup, docs.outline);
  if (reasons.length === 0) return;
  add('medium', 'registry.drift_needs_repair', `registries are not self-consistent: ${reasons.join(', ')}`, 'Run doctor --fix to rewrite the canonical registries.');
  if (fix) {
    const repaired = repairRegistry(project);
    if (repaired) actions.push(...repaired.actions);
  }
}

function collectOrphanIssues(project, add) {
  let status;
  try {
    status = projectStatus(project);
  } catch (error) {
    add('high', 'artifact.status', 'project status could not be loaded', `Repair the invalid artifact: ${error.message}`);
    return;
  }
  for (const id of status.orphan_chapters || []) add('low', 'artifact.orphan_chapter', `chapter ${id} has no outline entry`, 'Rename the chapter or add it to the outline.');
  for (const id of status.orphan_recaps || []) add('low', 'artifact.orphan_recap', `recap ${id} has no outline entry`, 'Rename the recap or add its chapter to the outline.');
}

function collectIssues(project, options) {
  const issues = [];
  const actions = [];
  const fix = Boolean(options.fix);
  const add = (severity, code, message, suggestion = '') => issues.push({ severity, code, message, suggestion });
  collectLayoutIssues(project, add, actions, fix);
  collectConfigIssues(project, add);
  collectJsonIssues(project, add);
  collectPresenceIssues(project, add);
  collectRegistryIssues(project, add, actions, fix);
  collectOrphanIssues(project, add);
  return { issues, actions };
}

export function doctorProject(project, options = {}) {
  const { issues, actions } = collectIssues(project, options);
  const blocking = issues.some((issue) => issue.severity === 'high' || issue.severity === 'critical');
  if (options.fix) {
    const remaining = doctorProject(project, {});
    return { ...remaining, fixed: true, actions };
  }
  return {
    ok: !blocking,
    blocking,
    root: project.dir,
    name: project.config.name,
    fixed: false,
    actions,
    issues,
  };
}
