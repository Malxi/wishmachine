// Generator matrix regression: every supported genre x seed x structure config
// must produce a writable setup+outline pair whose deterministic check is clean.
// Draws are memoized through drawCached() so the whole matrix stays fast.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkProject } from '../scripts/schema.js';
import { initProject, loadProject, writeArtifact } from '../scripts/project.js';
import { drawCached, fixtureSet } from './fixtures.js';

const { tempDir } = fixtureSet('wishmachine-matrix-');

const GENRES = ['科幻', '修仙', '悬疑', '都市', '历史', '言情'];
const SEEDS = [1, 42];
const CONFIGS = [
  { volumes: 1, chaptersPerVolume: 10 },
  { volumes: 3, chaptersPerVolume: 5 },
];

function writeSection(dir, section, content) {
  return writeArtifact(loadProject(dir), {
    section,
    mode: 'replace',
    apply: true,
    content: JSON.stringify(content),
  });
}

function mediumCountsByConfig(rows) {
  const counts = {};
  for (const row of rows) {
    const key = `${row.volumes} 卷 x ${row.chaptersPerVolume} 章`;
    counts[key] = (counts[key] || 0) + row.medium;
  }
  return counts;
}

test('outlinepack matrix: every genre/seed/structure config writes and checks clean', (t) => {
  const rows = [];
  const mediumFindings = [];
  for (const genre of GENRES) {
    for (const seed of SEEDS) {
      for (const { volumes, chaptersPerVolume } of CONFIGS) {
        const label = `${genre}/seed=${seed}/${volumes}x${chaptersPerVolume}`;
        const dir = tempDir(t);
        initProject({ name: `矩阵-${genre}-${seed}`, dir, parts: 1, volumes, chapter: chaptersPerVolume });
        const pack = drawCached({
          type: 'outlinepack',
          genre,
          seed,
          count: 1,
          volumes,
          chaptersPerVolume,
        }).results[0];
        assert.equal(pack.draft_outline.parts[0].volumes.length, volumes, `${label}: volume count`);
        assert.equal(pack.chapters.length, volumes * chaptersPerVolume, `${label}: chapter count`);

        const setupWrite = writeSection(dir, 'setup', pack.setup_draft);
        assert.equal(
          setupWrite.applied,
          true,
          `${label}: setup write blocked: ${JSON.stringify(setupWrite.check?.findings)}`,
        );
        const outlineWrite = writeSection(dir, 'outline', pack.draft_outline);
        assert.equal(
          outlineWrite.applied,
          true,
          `${label}: outline write blocked: ${JSON.stringify(outlineWrite.check?.findings)}`,
        );

        const check = checkProject(loadProject(dir), { profile: 'all', target: 'outline' });
        const medium = check.findings.filter((finding) => finding.severity === 'medium');
        rows.push({
          genre,
          seed,
          volumes,
          chaptersPerVolume,
          high: check.summary.high,
          critical: check.summary.critical,
          medium: medium.length,
        });

        assert.equal(check.blocking, false, `${label}: blocking findings: ${JSON.stringify(check.findings)}`);
        assert.equal(
          check.summary.high + check.summary.critical,
          0,
          `${label}: high/critical findings: ${JSON.stringify(check.findings)}`,
        );
        if (medium.length > 0) {
          mediumFindings.push({
            label,
            findings: medium.map((finding) => ({
              rule_id: finding.rule_id,
              target_id: finding.target_id || '',
              issue: finding.issue,
            })),
          });
        }
      }
    }
  }

  assert.equal(rows.length, GENRES.length * SEEDS.length * CONFIGS.length);
  const mediumTotal = rows.reduce((sum, row) => sum + row.medium, 0);
  assert.equal(
    mediumTotal,
    0,
    `medium findings by config ${JSON.stringify(mediumCountsByConfig(rows))}: ${JSON.stringify(mediumFindings)}`,
  );
  assert.deepEqual(mediumFindings, []);
});
