// Shared --ignore/--ignore-file parsing for check and audit. The file syntax
// matches `ideas validate`: a JSON array of rule ids or { "rules": [...] }.
import path from 'node:path';
import { readJson } from '../util.js';
import { stringFlag, usageFail } from './args.js';

function splitRuleList(value) {
  return String(value || '').split(',').map((rule) => rule.trim()).filter(Boolean);
}

function readIgnoreFile(file) {
  let doc;
  try {
    doc = readJson(path.resolve(file));
  } catch (error) {
    usageFail(`cannot read --ignore-file: ${error.message}`, 'pass a JSON array of rule ids or {"rules":["..."]}');
  }
  if (Array.isArray(doc)) return doc.map((rule) => String(rule ?? '').trim()).filter(Boolean);
  if (Array.isArray(doc?.rules)) return doc.rules.map((rule) => String(rule ?? '').trim()).filter(Boolean);
  usageFail(
    '--ignore-file must contain a JSON array or an object with a rules array',
    'example: ["quality.outline.cast"] or {"rules":["quality.outline.cast"]}',
  );
  return [];
}

function ignoreRulesFlag(flags) {
  const ignoreFile = stringFlag(flags, 'ignore-file', '');
  const fromFile = ignoreFile ? readIgnoreFile(ignoreFile) : [];
  return [...splitRuleList(stringFlag(flags, 'ignore', '')), ...fromFile];
}

export { ignoreRulesFlag };
