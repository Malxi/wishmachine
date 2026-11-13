// Custom rules loaded from references/builtin-rules.json and <project>/.wishmachine/rules/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readText, safeSegment } from '../util.js';
import { SEVERITIES, finding } from './finding.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const BUILTIN_RULES_FILE = path.join(ROOT, 'references', 'builtin-rules.json');

function customRules(project) {
  const dirs = [
    path.join(project.dir, '.wishmachine', 'rules'),
  ];
  const rules = [];
  if (fs.existsSync(BUILTIN_RULES_FILE)) {
    try {
      const value = JSON.parse(readText(BUILTIN_RULES_FILE));
      for (const rule of Array.isArray(value) ? value : [value]) {
        rules.push({ ...rule, source: 'builtin', file: 'builtin-rules.json' });
      }
    } catch {
      // Built-in rule corruption must not make every check fail.
    }
  }
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json')).sort()) {
      try {
        const value = JSON.parse(readText(path.join(dir, name)));
        const list = Array.isArray(value) ? value : [value];
        for (const rule of list) rules.push({ ...rule, source: 'project', file: name });
      } catch {
        // A malformed rule is reported by check as one low finding; it must not match every text.
        rules.push({ id: `invalid.${name}`, target: 'all', severity: 'low', invalid: true, file: name, message: `invalid custom rule file ${name}` });
      }
    }
  }
  return rules;
}

function customFindings(project, target, id, overrideText) {
  const findings = [];
  let text = overrideText;
  if (text === undefined) {
    text = '';
    if (target === 'setup') text = readText(path.join(project.dir, 'story', 'setup', 'story_setup.json'));
    if (target === 'outline') text = readText(path.join(project.dir, 'story', 'compose', 'outline.json'));
    if (target === 'chapter') {
      if (!id) throw new Error('chapter custom check requires --id');
      text = readText(path.join(project.dir, 'chapters', `${safeSegment(id, 'chapter id')}.md`));
    }
    if (target === 'craft') {
      const kind = safeSegment(id || 'character', 'craft kind');
      text = readText(path.join(project.dir, 'story', 'craft', `${kind}.json`));
    }
    if (target === 'recap') {
      if (!id) throw new Error('recap custom check requires --id');
      text = readText(path.join(project.dir, 'story', 'recaps', `${safeSegment(id, 'recap id')}.json`));
    }
  }
  for (const rule of customRules(project)) {
    if (rule.invalid) {
      findings.push(finding(`invalid.${rule.file}`, 'low', rule.message, 'custom-rules', 'Fix or remove the malformed rule file under .wishmachine/rules/.'));
      continue;
    }
    const ruleTarget = String(rule.target || 'all');
    if (ruleTarget !== 'all' && ruleTarget !== target) continue;
    let matched = false;
    if (rule.kind === 'contains') {
      matched = text.includes(rule.pattern || '');
    } else {
      try {
        matched = new RegExp(rule.pattern || '').test(text);
      } catch {
        findings.push(finding(`invalid.${rule.file || 'rule'}`, 'medium', `invalid regex in ${rule.id || 'custom rule'}`));
        continue;
      }
    }
    if (matched) {
      const severity = SEVERITIES.includes(rule.severity) ? rule.severity : 'medium';
      findings.push(finding(rule.id || 'custom', severity, rule.message || 'custom rule matched', id || target, rule.suggestion || ''));
    }
  }
  return findings;
}

export { customFindings };
