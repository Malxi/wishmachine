// SKILL.md frontmatter validation without external dependencies.
//
// Skill hosts (Doubao, DSH, ...) parse the YAML frontmatter and require at least
// `name` and `description`. A single unquoted `: ` inside a value makes the
// document invalid YAML and the host reports "SKILL.md is missing the YAML skill
// name/description" instead of a YAML error, so pack.js refuses to build a
// package unless this validator (and the js-yaml test) passes.

const NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const MAX_DESCRIPTION = 1024;
const SPECIAL_START = '{}[]&*!|>\'"%@`#';

export function extractFrontmatter(text) {
  if (text.charCodeAt(0) === 0xfeff) return { error: 'SKILL.md starts with a UTF-8 BOM; save it without BOM' };
  const lines = text.split(/\r?\n/);
  if (lines[0] !== '---') return { error: 'SKILL.md must start with a YAML frontmatter line "---"' };
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === '---') { end = index; break; }
  }
  if (end < 0) return { error: 'SKILL.md frontmatter is not closed by a "---" line' };
  return {
    raw: lines.slice(1, end).join('\n'),
    lines: lines.slice(1, end),
    body: lines.slice(end + 1).join('\n').trim(),
  };
}

function unquote(value) {
  const text = value.trim();
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
    return { quoted: true, value: text.slice(1, -1) };
  }
  return { quoted: false, value: text };
}

function scalarError(key, raw) {
  const value = raw.trim();
  if (!value) return null;
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return null; // quoted scalars are always safe
  }
  if (SPECIAL_START.includes(value[0])) return `${key}: value starts with a YAML-special character; quote it`;
  if (value.includes(': ')) return `${key}: unquoted value contains ": "; wrap the value in double quotes`;
  if (value.includes(' #')) return `${key}: unquoted value contains " #"; wrap the value in double quotes`;
  return null;
}

export function validateSkillManifest(text, options = {}) {
  const errors = [];
  const extracted = extractFrontmatter(text);
  if (extracted.error) return { ok: false, errors: [extracted.error], data: null };
  const data = {};
  let lastKey = '';
  for (const line of extracted.lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem) {
      if (!lastKey) { errors.push(`list item without a key: ${line}`); continue; }
      const { value } = unquote(listItem[1]);
      const error = scalarError(`${lastKey}[]`, listItem[1]);
      if (error) errors.push(error);
      if (!Array.isArray(data[lastKey])) data[lastKey] = [];
      data[lastKey].push(value);
      continue;
    }
    const mapping = line.match(/^([A-Za-z0-9_][A-Za-z0-9_-]*):(?:\s+(.*))?$/);
    if (!mapping) { errors.push(`cannot parse frontmatter line: ${line}`); continue; }
    const key = mapping[1];
    const raw = mapping[2] || '';
    lastKey = key;
    const error = scalarError(key, raw);
    if (error) errors.push(error);
    data[key] = unquote(raw).value;
  }
  if (typeof data.name !== 'string' || !data.name.trim()) {
    errors.push('frontmatter needs a non-empty "name"');
  } else if (!NAME_PATTERN.test(data.name.trim())) {
    errors.push('"name" must use lowercase letters, digits and hyphens (e.g. wishmachine)');
  }
  if (typeof data.description !== 'string' || !data.description.trim()) {
    errors.push('frontmatter needs a non-empty "description"');
  } else if (data.description.length > MAX_DESCRIPTION) {
    errors.push(`"description" is ${data.description.length} chars, limit is ${MAX_DESCRIPTION}`);
  }
  if (options.expectedVersion && data.version && data.version !== options.expectedVersion) {
    errors.push(`frontmatter version ${data.version} does not match package.json ${options.expectedVersion}`);
  }
  if (!extracted.body) errors.push('SKILL.md body is empty');
  return { ok: errors.length === 0, errors, data, raw: extracted.raw };
}
