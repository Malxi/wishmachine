// Style ("AI smell") rules: statistical metrics, advisory findings, book-level audit. Never blocking.
import fs from 'node:fs';
import path from 'node:path';
import { readJson, readText } from '../../util.js';
import { chapterFile, setupFile } from '../../paths.js';
import { styleArtifactFindings } from './artifacts.js';
import { crossChapterMotifs } from './motifs.js';
import { DEFAULT_THRESHOLDS, CHAPTER_RULES, BOOK_RULES, SETUP_RULES } from './rules-table.js';
import { bookShapeFindings, chapterShape } from './shape.js';
import { finding, SEVERITY_RANK, usageFail } from '../finding.js';
import { chapterMetrics, setupMetrics } from './metrics.js';


function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function mergeThresholds(base, override) {
  const merged = { ...base };
  if (!override || typeof override !== 'object') return merged;
  for (const [key, value] of Object.entries(override)) {
    if (!merged[key] || !value || typeof value !== 'object') continue;
    const next = { ...merged[key] };
    for (const [field, number] of Object.entries(value)) {
      if (numeric(number)) next[field] = number;
    }
    merged[key] = next;
  }
  return merged;
}

function resolveThresholds(config) {
  const style = config?.style;
  return {
    chapter: mergeThresholds(DEFAULT_THRESHOLDS.chapter, style?.chapter),
    setup: mergeThresholds(DEFAULT_THRESHOLDS.setup, style?.setup),
  };
}

function resolveMotifs(config) {
  const motifs = config?.style?.motifs;
  return Array.isArray(motifs) ? motifs.filter((term) => typeof term === 'string' && term.trim()) : [];
}

function bandFor(value, threshold) {
  if (threshold.direction === 'low') {
    if (value < threshold.risk) return 'risk';
    if (value < threshold.warn) return 'warn';
    return 'ok';
  }
  if (numeric(threshold.min) || numeric(threshold.max)) {
    if (numeric(threshold.riskMin) && value < threshold.riskMin) return 'risk';
    if (numeric(threshold.min) && value < threshold.min) return 'warn';
    if (numeric(threshold.riskMax) && value > threshold.riskMax) return 'risk';
    if (numeric(threshold.max) && value > threshold.max) return 'warn';
    return 'ok';
  }
  if (value > threshold.risk) return 'risk';
  if (value > threshold.warn) return 'warn';
  return 'ok';
}

function describeThreshold(threshold) {
  if (threshold.direction === 'low') return `healthy >= ${threshold.warn}, risk < ${threshold.risk}`;
  if (numeric(threshold.min) || numeric(threshold.max)) {
    return `healthy ${threshold.min ?? '-'}..${threshold.max ?? '-'}, risk outside ${threshold.riskMin ?? '-'}..${threshold.riskMax ?? '-'}`;
  }
  return `healthy <= ${threshold.warn}, risk > ${threshold.risk}`;
}

function styleFinding(rule, severity, label, options) {
  const { metric, value, threshold, band, suggestion, targetId, evidence } = options;
  const item = finding(
    rule,
    severity,
    `${label}: ${value} (${describeThreshold(threshold)})`,
    targetId,
    suggestion,
  );
  item.metrics = { name: metric, value, band, threshold };
  if (Array.isArray(evidence) && evidence.length) item.evidence = evidence;
  return item;
}

function findingsFor(metrics, rules, thresholds, targetId) {
  const findings = [];
  for (const [metric, rule, label, issue, suggestion, evidenceKey] of rules) {
    const threshold = thresholds[metric];
    if (!threshold) continue;
    const value = metrics[metric];
    const band = bandFor(value, threshold);
    if (band === 'ok') continue;
    const evidence = evidenceKey ? metrics[evidenceKey] : undefined;
    const item = styleFinding(rule, band === 'risk' ? 'medium' : 'low', label, {
      metric, value, threshold, band, suggestion, targetId, evidence,
    });
    item.issue = `${item.issue}; ${issue}`;
    findings.push(item);
  }
  return findings;
}

function setupNames(setup) {
  return (setup?.core_cast || []).map((character) => character.name).filter(Boolean);
}

function readOptionalJson(file) {
  if (!fs.existsSync(file)) return null;
  try {
    return readJson(file);
  } catch {
    return null;
  }
}

function styleFindings(project, target, id, override = {}) {
  const thresholds = resolveThresholds(project.config);
  if (target === 'setup') {
    const setup = override.setup !== undefined ? override.setup : readOptionalJson(setupFile(project.dir));
    if (!setup) return [];
    return [
      ...findingsFor(setupMetrics(setup), SETUP_RULES, thresholds.setup, 'setup'),
      ...styleArtifactFindings(project),
    ];
  }
  if (target === 'chapter') {
    if (!id) {
      usageFail('chapter style check requires --id',
        'chapter style checks run one chapter at a time; list ids with "wishmachine state --dir <project> --view brief"',
        `wishmachine check --dir ${project.dir} --profile style --target chapter --id <chapter-id>`);
    }
    let text = override.chapterText;
    if (text === undefined) {
      const file = chapterFile(project.dir, id);
      if (!fs.existsSync(file)) {
        usageFail(`chapter not found: ${id}`,
          'the chapter id must exist in the outline; list ids with "wishmachine state --dir <project> --view brief"',
          `wishmachine state --dir ${project.dir} --view brief`);
      }
      text = readText(file);
    }
    const setup = override.setup !== undefined ? override.setup : readOptionalJson(setupFile(project.dir));
    const metrics = chapterMetrics(text, {
      names: setupNames(setup),
      targetChars: project.config.chapter_config?.target_chars,
      motifs: resolveMotifs(project.config),
    });
    return findingsFor(metrics, CHAPTER_RULES, thresholds.chapter, id);
  }
  usageFail(`style profile supports setup or chapter targets, got ${target}`,
    'style is a per-artifact fingerprint profile: run --target setup first, then --target chapter --id <id> per chapter (never bare)',
    `wishmachine check --dir ${project.dir} --profile style --target setup`);
}

function chapterFiles(project) {
  const dir = path.join(project.dir, 'chapters');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .sort()
    .map((name) => ({ id: name.slice(0, -3), text: readText(path.join(dir, name)) }));
}

function applyStyleFilters(findings, options = {}) {
  const ignoredRules = new Set(options.ignoreRules || []);
  const active = [];
  const ignoredRuleCounts = {};
  for (const item of findings) {
    if (ignoredRules.has(item.rule_id)) {
      ignoredRuleCounts[item.rule_id] = (ignoredRuleCounts[item.rule_id] || 0) + 1;
      continue;
    }
    if (options.minSeverity && SEVERITY_RANK[item.severity] > SEVERITY_RANK[options.minSeverity]) continue;
    active.push(item);
  }
  const limited = options.maxFindings > 0 ? active.slice(0, options.maxFindings) : active;
  return { active: limited, ignoredFindings: findings.length - active.length, ignoredRuleCounts };
}

function summarizeStyle(findings, extra = {}) {
  const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0, ...extra };
  for (const item of findings) summary[item.severity] += 1;
  return summary;
}

function styleAudit(project, options = {}) {
  const thresholds = resolveThresholds(project.config);
  const motifsConfig = resolveMotifs(project.config);
  const targetChars = project.config.chapter_config?.target_chars;
  const setup = readOptionalJson(setupFile(project.dir));
  const names = setupNames(setup);
  const chapters = chapterFiles(project);
  const findings = [];
  if (setup) findings.push(...findingsFor(setupMetrics(setup), SETUP_RULES, thresholds.setup, 'setup'));
  findings.push(...styleArtifactFindings(project));
  const chapterResults = chapters.map(({ id, text }) => {
    const metrics = chapterMetrics(text, { names, targetChars, motifs: motifsConfig });
    const chapterFindings = findingsFor(metrics, CHAPTER_RULES, thresholds.chapter, id);
    findings.push(...chapterFindings);
    return { id, metrics, shape: chapterShape(text, metrics), findings: chapterFindings };
  });
  const pooled = chapters.length
    ? chapterMetrics(chapters.map((chapter) => chapter.text).join('\n\n'), { names, targetChars, motifs: motifsConfig })
    : null;
  // Book-level pooled metrics re-report rules chapters already flagged: keep only book-wide ones.
  const chapterRuleIds = new Set(chapterResults.flatMap((result) => result.findings.map((item) => item.rule_id)));
  const bookFindings = pooled
    ? findingsFor(pooled, BOOK_RULES, thresholds.chapter, 'book').filter((item) => !chapterRuleIds.has(item.rule_id))
    : [];
  const motifs = crossChapterMotifs(chapters, names);
  if (motifs.length) {
    const item = finding(
      'style.book.repeated_motif',
      'medium',
      `重复出现的描写/动作短语：${motifs.slice(0, 3).map((entry) => entry.phrase).join('、')}`,
      'book',
      '同一动作/意象每次出现都要升级代价或认知；否则删掉重复，换成新信息。',
    );
    item.metrics = { name: 'crossChapterMotifChapters', value: motifs[0].chapters, totalChapters: chapters.length };
    item.evidence = motifs.slice(0, 5);
    bookFindings.push(item);
  }
  bookFindings.push(...bookShapeFindings(chapterResults));
  findings.push(...bookFindings);
  const filtered = applyStyleFilters(findings, options);
  const view = options.view || 'brief';
  const result = {
    ok: true,
    blocking: false,
    profile: 'style',
    view,
    root: project.dir,
    name: project.config.name,
    thresholds,
    metrics: pooled,
    motifs,
    chapters: chapterResults.map((chapter) => ({
      id: chapter.id,
      metrics: chapter.metrics,
      shape: chapter.shape,
      findings: view === 'summary' ? undefined : applyStyleFilters(chapter.findings, options).active,
    })),
    findings: view === 'summary' ? [] : filtered.active,
    summary: summarizeStyle(filtered.active, {
      ignored_findings: filtered.ignoredFindings,
      ignored_rules: filtered.ignoredRuleCounts,
    }),
  };
  return result;
}

export { DEFAULT_THRESHOLDS, resolveThresholds, styleAudit, styleFindings };
