// checkCandidate / checkProject: collect profile findings, finalize (dedupe + sort),
// summarize, score and apply --min-severity / --max-findings / --ignore filters.
// Missing or corrupt artifacts become structured findings (artifact.<target>.*)
// instead of raw ENOENT/JSON errors, so agents can branch on ok/blocking/rule_id.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, safeSegment } from '../util.js';
import { chapterFile, craftFile, outlineFile, recapFile, setupFile } from '../paths.js';
import {
  CHECK_TARGETS,
  PROFILE_VALUES,
  SEVERITIES,
  SEVERITY_RANK,
  finalizeFindings,
  finding,
  scoreFor,
  summarize,
} from './finding.js';
import { validateCraft, validateRecap, validateSetup } from './shape.js';
import { validateOutline } from './outline-shape.js';
import { qualityFindings } from './quality/index.js';
import { styleFindings } from './style/index.js';
import { customFindings } from './custom.js';
import { threadConsistencyFindings } from './thread.js';

const ARTIFACT_WRITE_HINTS = {
  setup: 'book write setup --mode replace',
  outline: 'book write outline --mode replace',
  chapter: 'book write chapter --id <id> --mode replace',
  craft: 'book write craft --target <kind> --mode replace',
  recap: 'book write recap --id <id> --mode replace',
};

function artifactFile(project, target, id) {
  if (target === 'setup') return setupFile(project.dir);
  if (target === 'outline') return outlineFile(project.dir);
  if (target === 'chapter') return chapterFile(project.dir, id);
  if (target === 'craft') return craftFile(project.dir, id || 'character');
  return recapFile(project.dir, id);
}

function relativeArtifact(project, file) {
  return path.relative(project.dir, file).split(path.sep).join('/');
}

function artifactMissingFinding(project, target, id) {
  const file = artifactFile(project, target, id);
  return finding(
    `artifact.${target}.missing`,
    'critical',
    `${relativeArtifact(project, file)} does not exist`,
    id || target,
    `create it with ${ARTIFACT_WRITE_HINTS[target]}, or run doctor to list missing artifacts`,
  );
}

function artifactInvalidJsonFinding(project, target, id, error) {
  const file = artifactFile(project, target, id);
  return finding(
    `artifact.${target}.invalid_json`,
    'critical',
    `${relativeArtifact(project, file)} is not valid JSON: ${error.message}`,
    id || target,
    'repair or replace the JSON file, then rerun check; doctor reports corrupt artifacts',
  );
}

// Pre-flight the target artifact so every caller sees a finding instead of an
// exception. chapter files are markdown, so only their presence is checked here.
function readTargetArtifact(project, target, id) {
  const file = artifactFile(project, target, id);
  if (!fs.existsSync(file)) return { finding: artifactMissingFinding(project, target, id) };
  if (target === 'chapter') return { file };
  try {
    return { file, value: readJson(file) };
  } catch (error) {
    return { finding: artifactInvalidJsonFinding(project, target, id, error) };
  }
}

// Safety net for failures raised by dependencies the pre-flight cannot cover
// (e.g. a corrupt craft/item.json while checking the outline).
function unexpectedCheckFinding(target, id, error) {
  const message = String(error?.message || error);
  const invalidJson = /JSON|Unexpected token/i.test(message);
  return finding(
    `artifact.${target}.${invalidJson ? 'invalid_json' : 'unreadable'}`,
    'critical',
    `cannot check ${target}: ${message}`,
    id || target,
    'repair the referenced artifact and rerun check; doctor reports corrupt JSON artifacts',
  );
}

function collectProjectFindings(project, context) {
  const { profile, target, id, artifact, collected } = context;
  if (profile === 'style') {
    collected.push(...styleFindings(project, target, id));
    return;
  }
  if (target === 'setup') {
    if (profile === 'schema' || profile === 'all') collected.push(...validateSetup(artifact.value));
    if (profile === 'quality' || profile === 'all') {
      collected.push(...qualityFindings(project, target, id, { setup: artifact.value }));
    }
  } else if (target === 'outline') {
    if (profile === 'schema' || profile === 'all') collected.push(...validateOutline(artifact.value, project.config));
    if (profile === 'quality' || profile === 'all') {
      collected.push(...qualityFindings(project, target, id, { outline: artifact.value }));
    }
  } else if (target === 'chapter') {
    collected.push(...qualityFindings(project, target, id));
  } else if (target === 'craft') {
    const kind = safeSegment(id || 'character', 'craft kind');
    if (profile === 'schema' || profile === 'all') collected.push(...validateCraft(artifact.value, kind));
    if (profile === 'quality' || profile === 'all') {
      collected.push(...qualityFindings(project, target, kind, { craft: artifact.value }));
    }
  } else if (target === 'recap') {
    if (profile === 'schema' || profile === 'all') collected.push(...validateRecap(artifact.value));
    if (profile === 'quality' || profile === 'all') {
      collected.push(...qualityFindings(project, target, id, { recap: artifact.value }));
    }
  }
  if (profile === 'custom' || profile === 'all') collected.push(...customFindings(project, target, id));
  if ((profile === 'schema' || profile === 'all') && ['setup', 'outline'].includes(target)) {
    collected.push(...threadConsistencyFindings(project));
  }
}

// --ignore/--ignore-file rules suppress matching findings from the result *and*
// from ok/blocking/score, so a known-acceptable rule can no longer fail a run.
function applyIgnoreFindings(findings, ignoreRules) {
  const ignored = new Set(ignoreRules || []);
  if (ignored.size === 0) return { active: findings, ignoredFindings: 0, ignoredRuleCounts: {} };
  const active = [];
  const ignoredRuleCounts = {};
  for (const item of findings) {
    if (!ignored.has(item.rule_id)) {
      active.push(item);
      continue;
    }
    ignoredRuleCounts[item.rule_id] = (ignoredRuleCounts[item.rule_id] || 0) + 1;
  }
  return { active, ignoredFindings: findings.length - active.length, ignoredRuleCounts };
}

function checkCandidate(project, options = {}) {
  const section = options.section;
  const candidate = options.candidate;
  const kind = options.kind || 'character';
  let findings = [];
  if (section === 'setup') {
    findings.push(...validateSetup(candidate));
    findings.push(...qualityFindings(project, 'setup', '', { setup: candidate }));
  } else if (section === 'outline') {
    findings.push(...validateOutline(candidate, project.config));
    findings.push(...qualityFindings(project, 'outline', '', { outline: candidate }));
  } else if (section === 'craft') {
    findings.push(...validateCraft(candidate, kind));
    findings.push(...qualityFindings(project, 'craft', kind, { craft: candidate }));
  } else if (section === 'recap') {
    findings.push(...validateRecap(candidate));
    findings.push(...qualityFindings(project, 'recap', options.id || candidate?.chapter_id || '', { recap: candidate }));
  } else if (section === 'chapter') {
    findings.push(...qualityFindings(project, 'chapter', options.id || '', { chapterText: candidate }));
  } else {
    throw new Error(`unsupported candidate section: ${section}`);
  }
  const candidateText = section === 'chapter' ? candidate : JSON.stringify(candidate);
  findings.push(...customFindings(project, section, options.id || '', candidateText));
  const all = finalizeFindings(findings);
  const summary = summarize(all);
  const blocking = summary.critical > 0 || summary.high > 0;
  return {
    ok: !blocking,
    blocking,
    profile: 'all',
    target: section,
    id: options.id || undefined,
    score: scoreFor(summary),
    summary,
    findings: options.maxFindings > 0 ? all.slice(0, options.maxFindings) : all,
    truncated: options.maxFindings > 0 && all.length > options.maxFindings,
  };
}

function checkProject(project, options = {}) {
  const profile = options.profile || 'all';
  const target = options.target || 'outline';
  const id = options.id || '';
  const min = options.minSeverity || '';
  if (!PROFILE_VALUES.includes(profile)) {
    throw new Error(`unknown check profile: ${profile}; allowed: ${PROFILE_VALUES.join('|')}`);
  }
  if (!CHECK_TARGETS.includes(target)) {
    throw new Error(`unsupported check target: ${target}; allowed: ${CHECK_TARGETS.join('|')}`);
  }
  if (min && !SEVERITIES.includes(min)) {
    throw new Error(`unknown min-severity: ${min}; allowed: ${SEVERITIES.join('|')}`);
  }
  if (['chapter', 'recap'].includes(target) && !id) {
    throw new Error(`${target} check requires --id`);
  }
  if (profile === 'schema' && target === 'chapter') {
    throw new Error('schema profile supports setup or outline (not chapter)');
  }
  if (profile === 'style' && !['setup', 'chapter'].includes(target)) {
    throw new Error('style profile supports setup or chapter targets');
  }
  const collected = [];
  const artifact = readTargetArtifact(project, target, id);
  if (artifact.finding) {
    collected.push(artifact.finding);
  } else {
    try {
      collectProjectFindings(project, { profile, target, id, artifact, collected });
    } catch (error) {
      collected.push(unexpectedCheckFinding(target, id, error));
    }
  }
  const all = finalizeFindings(collected);
  const { active, ignoredFindings, ignoredRuleCounts } = applyIgnoreFindings(all, options.ignoreRules);
  const summary = { ...summarize(active), ignored_findings: ignoredFindings, ignored_rules: ignoredRuleCounts };
  const blocking = summary.critical > 0 || summary.high > 0;
  const score = scoreFor(summary);
  const visible = min ? active.filter((item) => SEVERITY_RANK[item.severity] <= SEVERITY_RANK[min]) : active;
  const filteredOut = active.length - visible.length;
  const findings = options.maxFindings > 0 && visible.length > options.maxFindings
    ? visible.slice(0, options.maxFindings)
    : visible;
  return {
    ok: !blocking,
    blocking,
    profile,
    target,
    id: id || undefined,
    score,
    summary,
    ignored_findings: ignoredFindings,
    ignored_rules: ignoredRuleCounts,
    filtered_out: filteredOut,
    findings,
    truncated: options.maxFindings > 0 && visible.length > findings.length,
  };
}

export { checkCandidate, checkProject };
