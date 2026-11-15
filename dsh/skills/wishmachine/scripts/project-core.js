// Project lifecycle core: init/load, audit collection and refresh.
// The public API is re-exported by scripts/project.js; nothing here imports the
// facade (or write/read/export) so the dependency direction stays one-way.

import fs from 'node:fs';
import path from 'node:path';
import {
  ensureDir, nowIso, positiveInt, readJson, resolveProjectDir, writeJsonAtomic, writeTextAtomic,
} from './util.js';
import { checkProject } from './schema.js';
import { finding } from './rules/finding.js';
import { styleAudit } from './rules/style/index.js';
import {
  configFile, outlineFile, outlineMarkdownFile, projectPath, renderOutlineMarkdown,
  renderSetupMarkdown, setupFile, setupMarkdownFile,
} from './paths.js';
import { projectStatus } from './state.js';

function setupPlaceholder(name, genres) {
  return `# ${name}\n\n## Story Setup\n\n### Genre(s)\n${genres.map((genre) => `- ${genre}`).join('\n')}\n\n### Core Premise\n(待填写)\n\n### Theme\n(待填写)\n\n### Story Rules/Constraints\n- (待填写)\n`;
}

export function initProject(options) {
  const name = String(options.name || '').trim();
  if (!name) throw new Error('book name is required');
  const parts = positiveInt(options.parts, '--parts', 1);
  const volumes = positiveInt(options.volumes, '--volumes', 1);
  const chapters = positiveInt(options.chapter ?? options.chapters, '--chapter', 20);
  const targetChars = positiveInt(options.chapterChars, '--chapter-chars', 3000);
  const minChars = positiveInt(options.minChars, '--min-chars', 1800);
  if (minChars > targetChars) throw new Error('--chapter-chars must be >= --min-chars');
  const dir = path.resolve(options.dir || name);
  if (fs.existsSync(configFile(dir))) {
    throw new Error(`a Wishmachine project already exists at ${dir}`);
  }
  ensureDir(dir);
  const now = nowIso();
  const config = {
    name,
    version: '1.0.0',
    created_at: now,
    updated_at: now,
    language: options.language || 'zh',
    genres: options.genre
      ? String(options.genre).split(/[,，、/]/).map((item) => item.trim()).filter(Boolean)
      : ['未分类'],
    structure: {
      target_parts: parts,
      target_volumes: volumes,
      target_chapters: chapters,
    },
    chapter_config: {
      target_chars: targetChars,
      min_chars: minChars,
    },
  };
  for (const sub of ['story/setup', 'story/compose', 'story/craft', 'story/reviews', 'story/ideas', 'story/research', 'story/recaps', 'chapters', 'drafts', 'logs']) {
    ensureDir(path.join(dir, sub));
  }
  writeJsonAtomic(configFile(dir), config);
  writeTextAtomic(setupMarkdownFile(dir), setupPlaceholder(name, config.genres));
  return { dir, config };
}

function readStructure(config, dir) {
  const structure = config.structure;
  if (!structure || typeof structure !== 'object' || Array.isArray(structure)) {
    throw new Error(`novel.json at ${dir} has no structure object; rerun book init to create a project`);
  }
  return {
    target_parts: positiveInt(structure.target_parts, 'structure.target_parts'),
    target_volumes: positiveInt(structure.target_volumes, 'structure.target_volumes'),
    target_chapters: positiveInt(structure.target_chapters, 'structure.target_chapters'),
  };
}

function readChapterConfig(config) {
  const chapterConfig = config.chapter_config || {};
  return {
    target_chars: positiveInt(chapterConfig.target_chars, 'chapter_config.target_chars', 3000),
    min_chars: positiveInt(chapterConfig.min_chars, 'chapter_config.min_chars', 1800),
  };
}

export function loadProject(explicit) {
  const dir = resolveProjectDir(explicit);
  const file = configFile(dir);
  if (!fs.existsSync(file)) {
    throw new Error(`no novel.json found at ${dir}; run book init first`);
  }
  const config = readJson(file);
  config.structure = readStructure(config, dir);
  config.chapter_config = readChapterConfig(config);
  return { dir, config };
}

function auditTarget(project, target, id, options) {
  try {
    const result = checkProject(project, {
      profile: 'all',
      target,
      id,
      minSeverity: options.minSeverity,
      maxFindings: options.maxFindings,
      ignoreRules: options.ignoreRules,
    });
    return {
      target,
      id: id || undefined,
      ok: result.ok,
      blocking: result.blocking,
      score: result.score,
      summary: result.summary,
      findings: result.findings,
    };
  } catch (error) {
    // Unexpected check failures still surface as normal findings so audit output
    // keeps the {id, rule_id, severity, target_id, issue, suggestion} shape.
    const item = finding(
      'quality.audit.error',
      'critical',
      `${target} audit failed: ${error.message}`,
      id || target,
      'run doctor, repair the artifact and rerun audit',
    );
    return {
      target,
      id: id || undefined,
      ok: false,
      blocking: true,
      score: 0,
      summary: { total: 1, critical: 1, high: 0, medium: 0, low: 0, ignored_findings: 0, ignored_rules: {} },
      findings: [item],
    };
  }
}

function writtenChapterIds(project) {
  const dir = projectPath(project.dir, 'chapters');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((name) => name.endsWith('.md')).map((name) => name.slice(0, -3)).sort();
}

function statusChapters(project) {
  try {
    return projectStatus(project).chapters;
  } catch {
    // A corrupt outline must not abort audit before the artifact finding exists;
    // fall back to the chapter files that are actually on disk.
    return [];
  }
}

function missingArtifactTarget(target, id, message, options = {}) {
  const { suggestion = '', severity = 'medium', ruleId = '' } = options;
  const item = finding(ruleId || `artifact.${target}.missing`, severity, message, id || target, suggestion);
  const critical = severity === 'critical';
  const high = severity === 'high';
  return {
    target,
    id: id || undefined,
    ok: false,
    blocking: critical || high,
    score: 0,
    summary: { total: 1, critical: critical ? 1 : 0, high: high ? 1 : 0, medium: severity === 'medium' ? 1 : 0, low: severity === 'low' ? 1 : 0, ignored_findings: 0, ignored_rules: {} },
    findings: [item],
  };
}

function recapIdsOnDisk(project) {
  const dir = projectPath(project.dir, 'recaps');
  if (!fs.existsSync(dir)) return new Set();
  return new Set(fs.readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)));
}

function collectAuditTargets(project, options) {
  const targets = [];
  const add = (target, id = '') => targets.push(auditTarget(project, target, id, options));
  // audit is the last gate before a project is called done: a missing artifact must fail it,
  // not silently skip a target (otherwise a project with no chapter file can report blocking:false).
  if (fs.existsSync(setupFile(project.dir))) add('setup');
  else {
    targets.push(missingArtifactTarget('setup', '', 'story/setup/story_setup.json is missing (project is still empty)', {
      suggestion: 'planned-but-absent is reported, not blocking: write it with "wishmachine book write setup --from-idea <saved-id> --apply"',
      ruleId: 'quality.setup.unwritten',
    }));
  }
  if (fs.existsSync(outlineFile(project.dir))) add('outline');
  else {
    targets.push(missingArtifactTarget('outline', '', 'story/compose/outline.json is missing (project is still empty)', {
      suggestion: 'planned-but-absent is reported, not blocking: write it with "wishmachine book write outline --from-idea <saved-id> --apply"',
      ruleId: 'quality.outline.unwritten',
    }));
  }
  for (const name of fs.existsSync(projectPath(project.dir, 'craft')) ? fs.readdirSync(projectPath(project.dir, 'craft')).filter((item) => item.endsWith('.json')).sort() : []) {
    add('craft', name.slice(0, -5));
  }
  for (const name of fs.existsSync(projectPath(project.dir, 'recaps')) ? fs.readdirSync(projectPath(project.dir, 'recaps')).filter((item) => item.endsWith('.json')).sort() : []) {
    add('recap', name.slice(0, -5));
  }
  const chapters = statusChapters(project);
  const known = new Set(chapters.filter((chapter) => chapter.written).map((chapter) => chapter.id));
  for (const id of writtenChapterIds(project)) {
    if (!known.has(id)) add('chapter', id);
  }
  for (const chapter of chapters.filter((item) => item.written)) add('chapter', chapter.id);
  const recaps = recapIdsOnDisk(project);
  for (const chapter of chapters.filter((item) => !item.written)) {
    // A recap without its chapter file is data loss (critical); a chapter the outline merely
    // plans is normal work in progress (medium, non-blocking). Conflating them either hides a
    // deleted file or fails every half-written project.
    const lost = recaps.has(chapter.id);
    targets.push(missingArtifactTarget('chapter', chapter.id,
      lost
        ? `chapter ${chapter.id} has a recap but its chapter file is gone`
        : `chapter ${chapter.id} is planned in the outline but not written yet`, {
        suggestion: lost
          ? 'restore the chapter file (see checkpoints/) or delete the orphan recap'
          : `write chapters/${chapter.id}.md when the draft is ready, then import it with "wishmachine book write chapter --dir ${project.dir} --id ${chapter.id} --apply"`,
        severity: lost ? 'critical' : 'medium',
        ruleId: lost ? 'artifact.chapter.missing' : 'quality.chapter.unwritten',
      }));
  }
  return targets;
}

function summarizeAudit(project, targets, view) {
  const summary = { total: 0, critical: 0, high: 0, medium: 0, low: 0, ignored_findings: 0, ignored_rules: {} };
  for (const target of targets) {
    for (const key of ['total', 'critical', 'high', 'medium', 'low', 'ignored_findings']) {
      summary[key] += target.summary[key] || 0;
    }
    for (const [rule, count] of Object.entries(target.summary.ignored_rules || {})) {
      summary.ignored_rules[rule] = (summary.ignored_rules[rule] || 0) + count;
    }
  }
  const blocking = targets.some((target) => target.blocking);
  const result = {
    ok: !blocking,
    blocking,
    view,
    root: project.dir,
    name: project.config.name,
    summary,
  };
  if (view === 'summary') {
    result.failing_targets = targets
      .filter((target) => target.summary.total > 0)
      .map(({ target, id, ok, blocking: targetBlocking, score, summary: targetSummary }) => ({
        target, id, ok, blocking: targetBlocking, score, total: targetSummary.total,
      }));
    return result;
  }
  const allFindings = targets.flatMap((target) => target.findings.map((item) => ({
    ...item,
    audit_target: target.target,
  })));
  result.top_findings = allFindings.slice(0, 10);
  result.targets = view === 'full'
    ? targets
    : targets.map(({ findings, ...target }) => target);
  return result;
}

export function auditProject(project, options = {}) {
  if (options.profile === 'style') {
    return styleAudit(project, {
      view: options.view || 'brief',
      minSeverity: options.minSeverity,
      maxFindings: options.maxFindings,
      ignoreRules: options.ignoreRules,
    });
  }
  const view = ['full', 'summary'].includes(options.view) ? options.view : 'brief';
  const targets = collectAuditTargets(project, {
    maxFindings: options.maxFindings || 0,
    minSeverity: options.minSeverity,
    ignoreRules: options.ignoreRules,
  });
  return summarizeAudit(project, targets, view);
}

export function refreshProject(project, options = {}) {
  const target = options.target || 'all';
  if (!['all', 'setup', 'outline'].includes(target)) {
    throw new Error(`unsupported refresh target: ${target}`);
  }
  const refreshed = [];
  if ((target === 'all' || target === 'setup') && fs.existsSync(setupFile(project.dir))) {
    writeTextAtomic(setupMarkdownFile(project.dir), renderSetupMarkdown(readJson(setupFile(project.dir))));
    refreshed.push('story/setup/story_setup.md');
  }
  if ((target === 'all' || target === 'outline') && fs.existsSync(outlineFile(project.dir))) {
    writeTextAtomic(outlineMarkdownFile(project.dir), renderOutlineMarkdown(readJson(outlineFile(project.dir))));
    refreshed.push('story/compose/outline.md');
  }
  return { ok: true, action: 'refresh', target, refreshed };
}
