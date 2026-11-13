// Finding ids, severities, ordering, summarization and scoring. Every rule module
// builds findings through finding() so rule ids and the JSON envelope stay stable.
import { createHash } from 'node:crypto';

const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const PROFILE_VALUES = ['quality', 'schema', 'custom', 'all'];
const CHECK_TARGETS = ['setup', 'outline', 'chapter', 'craft', 'recap'];
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function findingId(ruleId, severity, issue, targetId) {
  const digest = createHash('sha1').update(`${ruleId}\u0000${severity}\u0000${issue}\u0000${targetId}`).digest('hex');
  return `finding-${digest.slice(0, 8)}`;
}

export function finding(ruleId, severity, issue, targetId = '', suggestion = '') {
  if (!SEVERITIES.includes(severity)) {
    throw new Error(`invalid finding severity ${JSON.stringify(severity)} for ${ruleId}; allowed: ${SEVERITIES.join('|')}`);
  }
  return {
    id: findingId(ruleId, severity, issue, targetId),
    rule_id: ruleId,
    severity,
    target_id: targetId,
    issue,
    suggestion,
  };
}

function finalizeFindings(findings) {
  const unique = new Map();
  for (const item of findings) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()].sort((a, b) => (
    (SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
    || a.rule_id.localeCompare(b.rule_id)
    || String(a.target_id).localeCompare(String(b.target_id))
    || a.issue.localeCompare(b.issue)
  ));
}

function summarize(findings) {
  const summary = { total: findings.length, critical: 0, high: 0, medium: 0, low: 0 };
  for (const item of findings) summary[item.severity] += 1;
  return summary;
}

function scoreFor(summary) {
  return Math.max(0, 100 - summary.critical * 20 - summary.high * 10 - summary.medium * 4 - summary.low);
}

export { CHECK_TARGETS, PROFILE_VALUES, SEVERITIES, SEVERITY_RANK, finalizeFindings, scoreFor, summarize };
