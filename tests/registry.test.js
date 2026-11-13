// Registry family: check-vs-repair agreement, doctor fixes, clean/abandon and
// the backup/undo/redo store.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  loadProject, doctorProject, projectRegistryStatus, cleanRegistry, abandonMystery,
  undoRegistryOperation, redoRegistryOperation, registryBackups, createRegistrySnapshot,
  restoreRegistryBackup, checkRegistryBackups, registryOperations, readSection, auditProject,
} from '../scripts/project.js';
import { checkProject } from '../scripts/schema.js';
import { registryRepairReasons, registryConsistencyFindings } from '../scripts/registry-rules.js';
import { fixtureSet } from './fixtures.js';

const { projectWithOutlinepack } = fixtureSet('wishmachine-registry-');

function docPaths(dir) {
  return {
    setup: path.join(dir, 'story', 'setup', 'story_setup.json'),
    outline: path.join(dir, 'story', 'compose', 'outline.json'),
  };
}

function readDocs(dir) {
  const paths = docPaths(dir);
  return {
    setup: JSON.parse(fs.readFileSync(paths.setup, 'utf8')),
    outline: JSON.parse(fs.readFileSync(paths.outline, 'utf8')),
  };
}

test('checkProject reports setup/outline thread registry drift', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  assert.equal(checkProject(loadProject(dir), { profile: 'schema', target: 'outline' }).findings.length, 0);
  const setup = JSON.parse(fs.readFileSync(paths.setup, 'utf8'));
  setup.thread_registry.pop();
  fs.writeFileSync(paths.setup, JSON.stringify(setup, null, 2));
  const drifted = checkProject(loadProject(dir), { profile: 'schema', target: 'outline' });
  assert.ok(drifted.findings.some((finding) => finding.rule_id === 'quality.thread.registry_missing_setup'));
});

test('registry check findings and doctor repair agree', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  let docs = readDocs(dir);
  assert.deepEqual(registryRepairReasons(docs.setup, docs.outline), []);
  assert.deepEqual(registryConsistencyFindings(docs.setup, docs.outline), []);

  // Drift both registries in setup only: check and repair must see the same thing.
  docs.setup.thread_registry.pop();
  docs.setup.mystery_registry.pop();
  fs.writeFileSync(paths.setup, JSON.stringify(docs.setup, null, 2));
  docs = readDocs(dir);
  const reasons = registryRepairReasons(docs.setup, docs.outline);
  const rules = registryConsistencyFindings(docs.setup, docs.outline);
  assert.ok(reasons.some((reason) => reason.includes('thread_registry (setup)')), reasons.join(','));
  assert.ok(reasons.some((reason) => reason.includes('mystery_registry (setup)')), reasons.join(','));
  assert.ok(rules.some((rule) => rule.rule_id === 'quality.thread.registry_missing_setup'), JSON.stringify(rules));
  assert.ok(rules.some((rule) => rule.rule_id === 'quality.mystery.registry_missing_setup'), JSON.stringify(rules));
  const check = checkProject(loadProject(dir), { profile: 'schema', target: 'outline' });
  assert.ok(check.findings.some((finding) => finding.rule_id === 'quality.thread.registry_missing_setup'));

  const report = doctorProject(loadProject(dir), { fix: true });
  assert.equal(report.fixed, true);
  assert.ok(report.actions.some((action) => String(action).includes('repaired registry')), JSON.stringify(report.actions));
  docs = readDocs(dir);
  assert.deepEqual(registryRepairReasons(docs.setup, docs.outline), []);
  assert.deepEqual(registryConsistencyFindings(docs.setup, docs.outline), []);
  assert.equal(checkProject(loadProject(dir), { profile: 'schema', target: 'outline' }).findings.length, 0);
});

test('quality check reports canonical registry drift instead of staying green', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  for (const file of [paths.setup, paths.outline]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete doc.mystery_registry;
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  const project = loadProject(dir);
  const check = checkProject(project, { profile: 'quality', target: 'outline' });
  const drift = check.findings.find((finding) => finding.rule_id === 'quality.registry.drift');
  assert.ok(drift, JSON.stringify(check.findings));
  assert.equal(drift.severity, 'medium');
  assert.equal(check.blocking, false);
  const audit = auditProject(project);
  assert.equal(audit.ok, true);
  assert.ok(audit.summary.medium >= 1);
  assert.ok(audit.top_findings.some((finding) => finding.rule_id === 'quality.registry.drift'));
  doctorProject(project, { fix: true });
  const fixed = checkProject(loadProject(dir), { profile: 'quality', target: 'outline' });
  assert.ok(!fixed.findings.some((finding) => finding.rule_id === 'quality.registry.drift'));
});

test('doctor --fix repairs setup/outline registry drift', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  const tampered = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  tampered.thread_registry.pop();
  fs.writeFileSync(paths.outline, JSON.stringify(tampered, null, 2));
  const report = doctorProject(loadProject(dir), { fix: true });
  assert.equal(report.fixed, true);
  const setup = JSON.parse(fs.readFileSync(paths.setup, 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.equal(JSON.stringify(setup.thread_registry), JSON.stringify(repaired.thread_registry));
});

test('doctor --fix repairs thread status from resolved mysteries', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  for (const file of [paths.setup, paths.outline]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.thread_registry[0].status = 'active';
    doc.thread_registry[0].resolved_in = null;
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  const report = doctorProject(loadProject(dir), { fix: true });
  assert.equal(report.fixed, true);
  const repairedSetup = JSON.parse(fs.readFileSync(paths.setup, 'utf8'));
  const repairedOutline = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.equal(repairedSetup.thread_registry[0].status, 'resolved');
  assert.equal(repairedOutline.thread_registry[0].status, 'resolved');
  assert.ok(repairedSetup.thread_registry[0].resolved_in);
});

test('doctor --fix downgrades resolved threads without a resolved mystery', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  const doc = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  const thread = doc.thread_registry.find((item) => item.status === 'resolved');
  for (const chapter of doc.parts[0].volumes[0].chapters) {
    chapter.mysteries.resolved = (chapter.mysteries.resolved || []).filter((item) => item.thread_id !== thread.id);
    for (const scene of chapter.scenes || []) {
      scene.mysteries.resolved = (scene.mysteries.resolved || []).filter((item) => item.thread_id !== thread.id);
    }
  }
  fs.writeFileSync(paths.outline, JSON.stringify(doc, null, 2));
  const setup = JSON.parse(fs.readFileSync(paths.setup, 'utf8'));
  setup.thread_registry.find((item) => item.id === thread.id).status = 'resolved';
  setup.thread_registry.find((item) => item.id === thread.id).abandoned_history = false;
  fs.writeFileSync(paths.setup, JSON.stringify(setup, null, 2));
  const outlineDoc = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  outlineDoc.thread_registry.find((item) => item.id === thread.id).abandoned_history = false;
  fs.writeFileSync(paths.outline, JSON.stringify(outlineDoc, null, 2));
  doctorProject(loadProject(dir), { fix: true });
  const repaired = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.equal(repaired.thread_registry.find((item) => item.id === thread.id).status, 'active');
});

test('doctor --fix fills missing mystery registry', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  for (const file of [paths.setup, paths.outline]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    delete doc.mystery_registry;
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  doctorProject(loadProject(dir), { fix: true });
  const setup = JSON.parse(fs.readFileSync(paths.setup, 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.ok(setup.mystery_registry.length > 0);
  assert.ok(repaired.mystery_registry.length > 0);
  assert.equal(setup.mystery_registry.length, repaired.mystery_registry.length);
});

test('doctor --fix removes stale mystery registry entries', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  for (const file of [paths.setup, paths.outline]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.mystery_registry.push({ id: 'stale-mystery', status: 'open' });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  doctorProject(loadProject(dir), { fix: true });
  const setup = JSON.parse(fs.readFileSync(paths.setup, 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.ok(!setup.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
  assert.ok(!repaired.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
});

test('doctor --fix sorts registry arrays', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  for (const file of [paths.setup, paths.outline]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.thread_registry.reverse();
    doc.mystery_registry.reverse();
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  doctorProject(loadProject(dir), { fix: true });
  const setup = JSON.parse(fs.readFileSync(paths.setup, 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.equal(setup.thread_registry[0].type, 'main');
  assert.ok(setup.mystery_registry.every((mystery, index, list) => index === 0 || String(list[index - 1].chapter_id).localeCompare(String(mystery.chapter_id), undefined, { numeric: true }) <= 0));
  assert.deepEqual(setup.thread_registry.map((thread) => thread.id), repaired.thread_registry.map((thread) => thread.id));
});

test('project registry status summarizes setup and outline registries', (t) => {
  const { project } = projectWithOutlinepack(t);
  const status = projectRegistryStatus(project);
  assert.equal(status.ok, true);
  assert.ok(status.setup.thread_count > 0);
  assert.ok(status.outline.mystery_count > 0);
});

test('book registry clean removes stale registry entries', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  for (const file of [paths.setup, paths.outline]) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    doc.mystery_registry.push({ id: 'stale-mystery', status: 'open' });
    doc.thread_registry[0].resolved_mysteries.push({ id: 'stale-mystery', chapter_id: 'P1-V1-C1' });
    fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  }
  const dryRun = cleanRegistry(loadProject(dir), { dryRun: true });
  assert.equal(dryRun.dryRun, true);
  assert.ok(dryRun.removed.includes('stale-mystery'));
  assert.ok(dryRun.removedLinks > 0);
  const before = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.ok(before.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
  const result = cleanRegistry(loadProject(dir));
  assert.equal(result.ok, true);
  assert.ok(result.removed.includes('stale-mystery'));
  assert.ok(result.removedLinks > 0);
  const setup = JSON.parse(fs.readFileSync(paths.setup, 'utf8'));
  const repaired = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.ok(!setup.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
  assert.ok(!repaired.mystery_registry.some((mystery) => mystery.id === 'stale-mystery'));
  assert.equal(projectRegistryStatus(loadProject(dir)).ok, true);
});

test('book registry abandon marks a mystery as manually dropped', (t) => {
  const { dir, project } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  const before = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  const target = before.mystery_registry.find((mystery) => mystery.status === 'resolved');
  assert.ok(target);
  const dryRun = abandonMystery(project, target.id, '作者决定放弃', { dryRun: true });
  assert.equal(dryRun.dryRun, true);
  assert.equal(JSON.parse(fs.readFileSync(paths.outline, 'utf8')).mystery_registry.find((mystery) => mystery.id === target.id).status, 'resolved');
  const result = abandonMystery(project, target.id, '作者决定放弃');
  assert.equal(result.ok, true);
  assert.equal(result.reason, '作者决定放弃');
  const after = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  const dropped = after.mystery_registry.find((mystery) => mystery.id === target.id);
  assert.equal(dropped.status, 'dropped');
  assert.equal(dropped.reason, '作者决定放弃');
  assert.ok(after.parts[0].volumes[0].chapters.some((chapter) => chapter.mysteries.dropped.some((mystery) => mystery.id === target.id)));
  assert.ok(projectRegistryStatus(loadProject(dir)).operations.some((operation) => operation.action === 'abandon' && operation.id === target.id));
  assert.ok(registryBackups(loadProject(dir)).count > 0);
  createRegistrySnapshot(loadProject(dir));
  const pruned = registryBackups(loadProject(dir), { keep: 1, prune: true });
  assert.ok(pruned.count >= 1);
  assert.ok(pruned.protected.length > 0);
  assert.ok(registryOperations(loadProject(dir), { limit: 20 }).operations.some((operation) => operation.action === 'abandon'));
  assert.equal(registryOperations(loadProject(dir), { action: 'abandon' }).operations.at(-1).state, 'applied');
  assert.ok(registryOperations(loadProject(dir), { action: 'abandon' }).operations.every((operation) => operation.action === 'abandon'));
  assert.ok(!registryOperations(loadProject(dir), { action: 'clean' }).operations.some((operation) => operation.action === 'abandon'));
  const undo = undoRegistryOperation(loadProject(dir), {
    operationId: registryOperations(loadProject(dir), { action: 'abandon' }).operations.at(-1).id,
  });
  assert.equal(undo.action, 'undo');
  const restored = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.equal(restored.mystery_registry.find((mystery) => mystery.id === target.id).status, 'resolved');
  assert.equal(registryOperations(loadProject(dir), { action: 'abandon' }).operations.at(-1).state, 'undone');
  const redo = redoRegistryOperation(loadProject(dir));
  assert.equal(redo.action, 'redo');
  const redone = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.equal(redone.mystery_registry.find((mystery) => mystery.id === target.id).status, 'dropped');
  assert.equal(registryOperations(loadProject(dir), { action: 'abandon' }).operations.at(-1).state, 'applied');
});

test('manual registry snapshot can be restored', (t) => {
  const { dir, project } = projectWithOutlinepack(t);
  const paths = docPaths(dir);
  const snapshot = createRegistrySnapshot(project);
  const listed = registryBackups(project).backups.find((backup) => backup.name === snapshot.backup.split('/').pop());
  assert.ok(listed.created_at);
  assert.equal(listed.action, 'manual');
  const before = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  before.thread_registry = [];
  fs.writeFileSync(paths.outline, JSON.stringify(before, null, 2));
  const dryRun = restoreRegistryBackup(project, snapshot.backup.split('/').pop(), { dryRun: true });
  assert.equal(dryRun.dryRun, true);
  assert.ok(dryRun.changes.outline.includes('thread_registry'));
  assert.equal(JSON.parse(fs.readFileSync(paths.outline, 'utf8')).thread_registry.length, 0);
  const restored = restoreRegistryBackup(project, snapshot.backup.split('/').pop());
  assert.equal(restored.ok, true);
  const after = JSON.parse(fs.readFileSync(paths.outline, 'utf8'));
  assert.ok(after.thread_registry.length > 0);
});

test('registry restore rejects a tampered snapshot', (t) => {
  const { dir, project } = projectWithOutlinepack(t);
  const snapshot = createRegistrySnapshot(project);
  const name = snapshot.backup.split('/').pop();
  assert.equal(checkRegistryBackups(project).ok, true);
  fs.appendFileSync(path.join(dir, 'logs', 'registry-backups', name, 'outline.json'), '\n');
  assert.throws(() => restoreRegistryBackup(project, name), /checksum mismatch/);
  assert.ok(checkRegistryBackups(project).findings.some((finding) => finding.status === 'checksum_mismatch'));
});

test('registry readers expose the tampered state through the public API', (t) => {
  const { dir } = projectWithOutlinepack(t);
  const outline = readSection(loadProject(dir), 'outline').outline;
  assert.ok(outline.thread_registry.length > 0);
  const check = checkProject(loadProject(dir), { profile: 'schema', target: 'outline' });
  assert.equal(check.blocking, false);
});
