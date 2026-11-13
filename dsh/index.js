// DSH bundle entry: contributes the `wishmachine` skill to the Host-wide skill
// catalog. The skill files (SKILL.md, scripts/, references/) are copied into
// ./skills/wishmachine by scripts/build-dsh-bundle.js, and that directory is
// reported as the skill's resource base so relative paths resolve correctly.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { description } from './skill-meta.js';

const SKILL_NAME = 'wishmachine';
const PROVIDER_NAME = 'wishmachine';
const SKILL_DIR = fileURLToPath(new URL('./skills/wishmachine/', import.meta.url));
const SKILL_FILE = fileURLToPath(new URL('./skills/wishmachine/SKILL.md', import.meta.url));
const RESOURCE_BASE = { kind: 'directory', path: SKILL_DIR };
const INVOCATION = { modelInvocable: true, userInvocable: true };

const CANDIDATE = {
  name: SKILL_NAME,
  description,
  invocation: INVOCATION,
  provider: PROVIDER_NAME,
  source: 'bundled',
  resourceBase: RESOURCE_BASE,
  rank: 600,
  locator: SKILL_FILE,
};

const provider = {
  name: PROVIDER_NAME,
  list: () => Promise.resolve([CANDIDATE]),
  async get() {
    return {
      name: CANDIDATE.name,
      description: CANDIDATE.description,
      invocation: CANDIDATE.invocation,
      provider: CANDIDATE.provider,
      source: CANDIDATE.source,
      resourceBase: RESOURCE_BASE,
      content: await readFile(SKILL_FILE, 'utf8'),
    };
  },
};

export const name = 'wishmachine-skill';
export const inject = ['skills'];

export function apply(ctx) {
  ctx.skills.registerProvider(() => provider);
}
