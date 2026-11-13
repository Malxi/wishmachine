// checkCandidate / checkProject: collect profile findings, finalize (dedupe + sort),
// summarize, score and apply --min-severity / --max-findings filters.
import path from 'node:path';
import { readJson, safeSegment } from '../util.js';
import {
  CHECK_TARGETS,
  PROFILE_VALUES,
  SEVERITIES,
  SEVERITY_RANK,
  finalizeFindings,
  scoreFor,
  summarize,
} from './finding.js';
import { validateCraft, validateRecap, validateSetup } from './shape.js';
import { validateOutline } from './outline-shape.js';
import { qualityFindings } from './quality/index.js';
import { customFindings } from './custom.js';
import { threadConsistencyFindings } from './thread.js';

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
  const collected = [];
  if (target === 'setup') {
    const setup = readJson(path.join(project.dir, 'story', 'setup', 'story_setup.json'));
    if (profile === 'schema' || profile === 'all') collected.push(...validateSetup(setup));
    if (profile === 'quality' || profile === 'all') collected.push(...qualityFindings(project, target, id));
  } else if (target === 'outline') {
    const outline = readJson(path.join(project.dir, 'story', 'compose', 'outline.json'));
    if (profile === 'schema' || profile === 'all') collected.push(...validateOutline(outline, project.config));
    if (profile === 'quality' || profile === 'all') collected.push(...qualityFindings(project, target, id));
  } else if (target === 'chapter') {
    if (profile === 'schema') throw new Error('schema profile supports setup or outline (not chapter)');
    collected.push(...qualityFindings(project, target, id));
  } else if (target === 'craft') {
    const kind = safeSegment(id || 'character', 'craft kind');
    const craft = readJson(path.join(project.dir, 'story', 'craft', `${kind}.json`));
    if (profile === 'schema' || profile === 'all') collected.push(...validateCraft(craft, kind));
    if (profile === 'quality' || profile === 'all') collected.push(...qualityFindings(project, target, kind));
  } else if (target === 'recap') {
    const recap = readJson(path.join(project.dir, 'story', 'recaps', `${safeSegment(id, 'recap id')}.json`));
    if (profile === 'schema' || profile === 'all') collected.push(...validateRecap(recap));
    if (profile === 'quality' || profile === 'all') collected.push(...qualityFindings(project, target, id));
  }
  if (profile === 'custom' || profile === 'all') collected.push(...customFindings(project, target, id));
  if ((profile === 'schema' || profile === 'all') && ['setup', 'outline'].includes(target)) {
    collected.push(...threadConsistencyFindings(project));
  }
  const all = finalizeFindings(collected);
  const summary = summarize(all);
  const blocking = summary.critical > 0 || summary.high > 0;
  const score = scoreFor(summary);
  const visible = min ? all.filter((item) => SEVERITY_RANK[item.severity] <= SEVERITY_RANK[min]) : all;
  const filteredOut = all.length - visible.length;
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
    filtered_out: filteredOut,
    findings,
    truncated: options.maxFindings > 0 && visible.length > findings.length,
  };
}

export { checkCandidate, checkProject };
