// Artifact write path. Every section declares its allowed modes/targets up
// front, candidates are validated before touching disk, and the previous file
// is checkpointed with a bounded history.

import fs from 'node:fs';
import path from 'node:path';
import {
  ensureDir, readJson, writeJsonAtomic, writeTextAtomic, deepMerge, parseJson,
  safeSegment, nowIso,
} from './util.js';
import {
  chapterFile, configFile, craftFile, outlineFile, outlineMarkdownFile,
  recapFile, renderOutlineMarkdown, renderSetupMarkdown, setupFile,
  setupMarkdownFile,
} from './paths.js';
import { checkCandidate, checkProject } from './schema.js';
import { loadRegistryDocs } from './registry-docs.js';
import { registryRepairReasons } from './registry-rules.js';
import { repairRegistry } from './registry-repair.js';

const WRITE_MODES = {
  setup: ['replace', 'patch'],
  outline: ['replace', 'patch'],
  craft: ['replace', 'patch'],
  recap: ['replace', 'patch'],
  chapter: ['replace', 'append'],
};
const WRITE_TARGETS = {
  setup: [''],
  outline: ['', 'volume', 'chapter'],
  craft: ['', 'character', 'item', 'location', 'organization'],
  recap: [''],
  chapter: [''],
};
const CHECKPOINT_LIMIT = 10;

function assertWriteRequest(section, mode, target) {
  if (!WRITE_MODES[section]) throw new Error(`unsupported write section: ${section}`);
  if (!WRITE_MODES[section].includes(mode)) {
    throw new Error(`${section} mode must be ${WRITE_MODES[section].join(' or ')}, got ${mode}`);
  }
  if (!WRITE_TARGETS[section].includes(target)) {
    const allowed = WRITE_TARGETS[section].filter(Boolean).join('|') || '(none)';
    throw new Error(`unsupported write target for ${section}: ${target}; allowed: ${allowed}`);
  }
  if (section === 'outline' && target && mode !== 'patch') {
    throw new Error(`--target ${target} is only valid with --mode patch for outline writes`);
  }
}

function parseCandidate(raw, mode, file, label) {
  if (mode === 'patch' && fs.existsSync(file)) return parseJson(raw, `${label} patch`);
  return parseJson(raw, label);
}

function prepareSetup(project, request) {
  const file = setupFile(project.dir);
  const patch = parseCandidate(request.raw, request.mode, file, 'setup');
  const candidate = request.mode === 'patch' && fs.existsSync(file)
    ? deepMerge(readJson(file), patch)
    : patch;
  return { file, candidate, isJson: true };
}

function patchOutlineTarget(current, request) {
  if (request.target === 'volume') {
    if (!request.id) throw new Error('outline volume patch requires --id');
    let volume;
    for (const part of current.parts || []) {
      volume = (part.volumes || []).find((item) => item.id === request.id);
      if (volume) break;
    }
    if (!volume) throw new Error(`outline volume not found: ${request.id}`);
    Object.assign(volume, deepMerge(volume, request.patch));
    return current;
  }
  if (!request.id) throw new Error('outline chapter patch requires --id');
  let chapter;
  for (const part of current.parts || []) {
    for (const volume of part.volumes || []) {
      chapter = (volume.chapters || []).find((item) => item.id === request.id);
      if (chapter) break;
    }
    if (chapter) break;
  }
  if (!chapter) throw new Error(`outline chapter not found: ${request.id}`);
  Object.assign(chapter, deepMerge(chapter, request.patch));
  return current;
}

function prepareOutline(project, request) {
  const file = outlineFile(project.dir);
  if (request.mode !== 'patch') {
    return { file, candidate: parseJson(request.raw, 'outline'), isJson: true };
  }
  const current = fs.existsSync(file) ? readJson(file) : { parts: [] };
  const patch = parseJson(request.raw, 'outline patch');
  const candidate = request.target
    ? patchOutlineTarget(current, { ...request, patch })
    : deepMerge(current, patch);
  return { file, candidate, isJson: true };
}

function prepareChapter(project, request) {
  if (!request.id) throw new Error('chapter write requires --id');
  const file = chapterFile(project.dir, request.id);
  let candidate;
  if (request.mode === 'append') {
    const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trimEnd() : '';
    candidate = `${existing}${existing ? '\n\n' : ''}${request.raw.trimStart()}`;
  } else {
    candidate = request.raw;
  }
  if (!candidate.trim()) throw new Error('chapter content is empty');
  return { file, candidate, isJson: false };
}

function prepareCraft(project, request) {
  const kind = safeSegment(request.target || 'character', 'craft kind');
  const file = craftFile(project.dir, kind);
  const patch = parseCandidate(request.raw, request.mode, file, 'craft');
  const candidate = request.mode === 'patch' && fs.existsSync(file)
    ? deepMerge(readJson(file), patch)
    : patch;
  return { file, candidate, isJson: true };
}

function prepareRecap(project, request) {
  if (!request.id) throw new Error('recap write requires --id');
  const file = recapFile(project.dir, request.id);
  const patch = parseCandidate(request.raw, request.mode, file, 'recap');
  const candidate = request.mode === 'patch' && fs.existsSync(file)
    ? deepMerge(readJson(file), patch)
    : patch;
  return { file, candidate, isJson: true };
}

const PREPARERS = {
  setup: prepareSetup,
  outline: prepareOutline,
  chapter: prepareChapter,
  craft: prepareCraft,
  recap: prepareRecap,
};

function pruneCheckpoints(dir, section, extension) {
  const prefix = `${section}_`;
  const history = fs.readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(extension))
    .sort();
  for (const name of history.slice(0, Math.max(0, history.length - CHECKPOINT_LIMIT))) {
    fs.rmSync(path.join(dir, name), { force: true });
  }
}

function checkpointName(section, extension) {
  const now = new Date();
  const pad = (value, width = 2) => String(value).padStart(width, '0');
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}${pad(now.getMilliseconds(), 3)}`;
  return `${section}_${date}_${time}${extension}`;
}

function checkpoint(file, section) {
  if (!fs.existsSync(file)) return;
  const dir = path.join(path.dirname(file), 'checkpoints');
  ensureDir(dir);
  fs.copyFileSync(file, path.join(dir, checkpointName(section, path.extname(file))));
  pruneCheckpoints(dir, section, path.extname(file));
}

function writeCompanionMarkdown(project, section, candidate) {
  if (section === 'setup') {
    writeTextAtomic(setupMarkdownFile(project.dir), renderSetupMarkdown(candidate));
  }
  if (section === 'outline') {
    writeTextAtomic(outlineMarkdownFile(project.dir), renderOutlineMarkdown(candidate));
  }
}

function touchProjectConfig(project) {
  const file = configFile(project.dir);
  const config = readJson(file);
  config.updated_at = nowIso();
  writeJsonAtomic(file, config);
  return config;
}

function persistCandidate(project, section, prepared) {
  checkpoint(prepared.file, section);
  if (prepared.isJson) {
    writeJsonAtomic(prepared.file, prepared.candidate);
  } else {
    const text = prepared.candidate.endsWith('\n') ? prepared.candidate : `${prepared.candidate}\n`;
    writeTextAtomic(prepared.file, text);
  }
  writeCompanionMarkdown(project, section, prepared.candidate);
  return touchProjectConfig(project);
}

function readIfPresent(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

// Registries are derived, never hand-edited: tell the caller up front which
// fields an --apply would rebuild, so a dry-run never hides a pending repair.
function plannedRegistryRepair(project, section, candidate) {
  if (section !== 'setup' && section !== 'outline') return null;
  const setup = section === 'setup' ? candidate : readIfPresent(setupFile(project.dir));
  const outline = section === 'outline' ? candidate : readIfPresent(outlineFile(project.dir));
  if (!setup || !outline) return null;
  const reasons = registryRepairReasons(setup, outline);
  return reasons.length > 0 ? reasons : null;
}

// `book write setup/outline` used to accept artifacts without canonical
// registries and leave doctor --fix to a later step; rebuild them here instead.
function autoRepairRegistries(project, section) {
  if (section !== 'setup' && section !== 'outline') return null;
  try {
    const docs = loadRegistryDocs(project);
    if (!docs) return null;
    const reasons = registryRepairReasons(docs.setup, docs.outline);
    if (reasons.length === 0) return null;
    checkpoint(section === 'setup' ? docs.outlineFile : docs.setupFile, section === 'setup' ? 'outline' : 'setup');
    const repaired = repairRegistry(project);
    return { repaired: true, reasons: repaired?.reasons || reasons, actions: repaired?.actions || [] };
  } catch (error) {
    return { repaired: false, error: error.message };
  }
}

function candidateStats(section, candidate) {
  if (section !== 'chapter') return null;
  const text = String(candidate);
  return {
    cjk: (text.match(/[\u3400-\u9fff]/g) || []).length,
    chars: [...text].length,
    paragraphs: text.split(/\n\s*\n/).filter(Boolean).length,
  };
}

function runCandidateCheck(project, section, candidate, options) {
  return checkCandidate(project, {
    section,
    candidate,
    kind: options.target || 'character',
    id: section === 'chapter' || section === 'recap' ? options.id : undefined,
    maxFindings: options.maxIssues || 0,
  });
}

function runPostWriteCheck(project, section, config, options) {
  return checkProject({ ...project, config }, {
    profile: 'all',
    target: section,
    id: section === 'craft' ? (options.target || 'character') : options.id,
    maxFindings: options.maxIssues || 0,
  });
}

export function writeArtifact(project, options) {
  const section = options.section;
  const mode = options.mode || 'replace';
  const apply = Boolean(options.apply);
  const target = options.target || '';
  const id = options.id ? safeSegment(options.id) : '';
  assertWriteRequest(section, mode, target);
  const request = { raw: options.content ?? '', mode, target, id };
  const prepared = PREPARERS[section](project, request);
  const plannedRepair = plannedRegistryRepair(project, section, prepared.candidate);
  const stats = candidateStats(section, prepared.candidate);
  const check = runCandidateCheck(project, section, prepared.candidate, { ...options, id });
  if (check?.blocking && apply) {
    return { ok: false, applied: false, dry_run: false, section, check, stats, registry_repair: plannedRepair ? { needed: plannedRepair } : undefined };
  }
  if (!apply) {
    return {
      ok: check?.ok ?? true,
      applied: false,
      dry_run: true,
      section,
      id,
      check,
      stats,
      registry_repair: plannedRepair ? { needed: plannedRepair } : undefined,
    };
  }
  const config = persistCandidate(project, section, prepared);
  const registryRepair = autoRepairRegistries(project, section);
  const after = runPostWriteCheck(project, section, config, { ...options, id });
  const result = {
    ok: after ? after.ok : true,
    applied: true,
    dry_run: false,
    section,
    id,
    changed: true,
    check: after || check,
    stats,
    registry_repair: registryRepair || (plannedRepair ? { repaired: false, reasons: plannedRepair } : undefined),
  };
  if (result.ok === false) {
    result.warning = 'post-write check reports blocking findings; the artifact was written, run check and repair';
  }
  return result;
}
