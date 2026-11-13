// Skill package manifest gate. Doubao/DSH parse the SKILL.md YAML frontmatter;
// one unquoted ": " inside a value makes the whole document invalid YAML and the
// host reports a misleading "SKILL.md needs YAML name/description" error.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { extractFrontmatter, validateSkillManifest } from '../scripts/skill-manifest.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillText = fs.readFileSync(path.join(root, 'SKILL.md'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('SKILL.md frontmatter is valid YAML with the required skill name and description', () => {
  const extracted = extractFrontmatter(skillText);
  assert.equal(extracted.error, undefined);
  const data = yaml.load(extracted.raw);
  assert.equal(typeof data, 'object');
  assert.equal(typeof data.name, 'string');
  assert.ok(data.name.length > 0);
  assert.equal(typeof data.description, 'string');
  assert.ok(data.description.length > 0);
  assert.ok(data.description.length <= 1024, 'description must stay within host limits');
  assert.match(data.name, /^[a-z0-9][a-z0-9-]*$/);
});

test('the dependency-free pack validator accepts the current manifest', () => {
  const result = validateSkillManifest(skillText, { expectedVersion: pkg.version });
  assert.equal(result.ok, true, `manifest errors:\n${result.errors.join('\n')}`);
});

test('frontmatter version and package version stay in sync', () => {
  const data = yaml.load(extractFrontmatter(skillText).raw);
  assert.equal(data.version, pkg.version);
});

test('the validator rejects the YAML mistakes that broke skill uploads', () => {
  const unquotedColon = '---\nname: wishmachine\ndescription: A wish machine: with an unquoted colon\n---\n\n# body\n';
  assert.equal(validateSkillManifest(unquotedColon).ok, false);
  const missingDescription = '---\nname: wishmachine\n---\n\n# body\n';
  assert.equal(validateSkillManifest(missingDescription).ok, false);
  const badName = '---\nname: Wish Machine\ndescription: x\n---\n\n# body\n';
  assert.equal(validateSkillManifest(badName).ok, false);
  const valid = '---\nname: wishmachine\ndescription: "A wish machine: quoted colon"\n---\n\n# body\n';
  assert.equal(validateSkillManifest(valid).ok, true);
});
