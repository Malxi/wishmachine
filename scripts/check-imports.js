#!/usr/bin/env node
// Module-boundary checker for parallel work.
//
// Rules:
//  1. Every local import resolves to a file that exists.
//  2. No import cycles.
//  3. Imports only point to a lower or equal architectural layer.
//  4. scripts/cli.js and scripts/cli/** may import only the public facades,
//     util.js and their own directory (never domain internals directly).
//  5. scripts/rules/** is a leaf feature: it may not import project/state/CLI
//     or scripts/ideas/**; scripts/ideas/** may not import scripts/rules/**.
//  6. The public facades (schema.js, ideas.js, project.js) contain no logic,
//     only imports and re-exports.
//  7. scripts/decks/*.js data modules (except index.js) have no local imports.
//
// Run with `npm run lint:modules`; tests/modules.test.js also calls checkModules().

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPTS = path.join(ROOT, 'scripts');
const FACADES = new Set(['schema.js', 'ideas.js', 'project.js']);
const DELETED = new Set(['artifacts.js']);

// 0 = leaf utility, 4 = CLI/dev tooling. A module may import its own layer or below.
const LAYERS = [
  { layer: 0, match: (rel) => rel === 'util.js' },
  { layer: 1, match: (rel) => rel === 'paths.js' || rel === 'registry.js' || rel === 'rules/finding.js' || rel.startsWith('decks/') },
  { layer: 2, match: (rel) => /^(rules|ideas|decks|sources)\//.test(rel) || /^(graph|store|state|write|read|export|sources|doctor|registry-store|registry-actions|registry-rules|guides|schema|ideas)\.js$/.test(rel) },
  { layer: 3, match: (rel) => /^(project-core|project)\.js$/.test(rel) },
  { layer: 4, match: (rel) => rel === 'cli.js' || rel.startsWith('cli/') || /^(wishmachine|pack|check-imports|check-structure|skill-manifest)\.js$/.test(rel) },
];

const CLI_ALLOWED = new Set(['project.js', 'schema.js', 'ideas.js', 'guides.js', 'util.js']);

function layerOf(rel) {
  for (const entry of LAYERS) if (entry.match(rel)) return entry.layer;
  return null;
}

function relOf(file) {
  return path.relative(SCRIPTS, file).replace(/\\/g, '/');
}

function listScripts(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listScripts(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

function parseImports(text) {
  const specs = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/\bimport\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/)
      || line.match(/\bexport\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/);
    if (match) specs.push({ spec: match[1], line: index + 1 });
    else if (/^\s*import\s*['"]/.test(line)) {
      const bare = line.match(/['"]([^'"]+)['"]/);
      if (bare) specs.push({ spec: bare[1], line: index + 1 });
    }
  }
  return specs;
}

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null;
}

function logicLines(text) {
  const stripped = text
    .replace(/^#!.*$/gm, '')
    .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?/gm, '')
    .replace(/^export\s+(?:\*|\{[\s\S]*?\})\s+from\s+['"][^'"]+['"];?/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  return stripped.split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter((item) => item.line.length > 0);
}

export function checkModules(root = ROOT) {
  const scriptsRoot = path.join(root, 'scripts');
  const files = listScripts(scriptsRoot);
  const violations = [];
  const graph = new Map();
  const lineCounts = new Map();

  for (const file of files) {
    const rel = relOf(file);
    const text = fs.readFileSync(file, 'utf8');
    lineCounts.set(rel, text.split(/\r?\n/).length - 1);
    const deps = [];
    for (const { spec, line } of parseImports(text)) {
      const resolved = resolveImport(file, spec);
      if (!resolved) {
        if (spec.startsWith('.')) violations.push(`${rel}:${line} broken import '${spec}'`);
        continue;
      }
      const target = relOf(resolved);
      deps.push({ target, line });
      if (DELETED.has(target)) violations.push(`${rel}:${line} imports deleted module ${target}`);
    }
    graph.set(rel, deps);
  }

  for (const [rel, deps] of graph) {
    const ownLayer = layerOf(rel);
    if (ownLayer === null) violations.push(`${rel}: not assigned to an architectural layer (update LAYERS in scripts/check-imports.js)`);
    for (const dep of deps) {
      const targetLayer = layerOf(dep.target);
      if (targetLayer === null) continue;
      if (ownLayer !== null && targetLayer > ownLayer) {
        violations.push(`${rel}:${dep.line} imports ${dep.target} (layer ${targetLayer}) but lives in layer ${ownLayer}`);
      }
      if ((rel === 'cli.js' || rel.startsWith('cli/')) && !dep.target.startsWith('cli/') && !CLI_ALLOWED.has(dep.target)) {
        violations.push(`${rel}:${dep.line} CLI must not import domain internals: ${dep.target}`);
      }
      if (rel.startsWith('rules/') && (/^(ideas|cli)\//.test(dep.target) || /^(project|state|store|write|read|export|sources|graph|doctor|project-core)\.js$/.test(dep.target))) {
        violations.push(`${rel}:${dep.line} rules must stay a leaf feature; imports ${dep.target}`);
      }
      if (rel.startsWith('ideas/') && (dep.target.startsWith('rules/') || /^(project|state|store|write|read|export|sources|graph|doctor|project-core|schema)\.js$/.test(dep.target))) {
        violations.push(`${rel}:${dep.line} ideas must not import ${dep.target}`);
      }
    }
  }

  // Cycle detection.
  const state = new Map();
  const cycles = [];
  function visit(node, stack) {
    state.set(node, 'visiting');
    for (const dep of graph.get(node) || []) {
      if (!graph.has(dep.target)) continue;
      if (state.get(dep.target) === 'visiting') cycles.push([...stack.slice(stack.indexOf(dep.target)), dep.target].join(' -> '));
      else if (!state.has(dep.target)) visit(dep.target, [...stack, dep.target]);
    }
    state.set(node, 'done');
  }
  for (const rel of graph.keys()) if (!state.has(rel)) visit(rel, [rel]);
  for (const cycle of cycles) violations.push(`import cycle: ${cycle}`);

  for (const rel of FACADES) {
    if (!lineCounts.has(rel)) {
      violations.push(`${rel}: facade file is missing`);
      continue;
    }
    if (lineCounts.get(rel) > 80) violations.push(`${rel}: facade must stay thin (${lineCounts.get(rel)} > 80 lines)`);
    const text = fs.readFileSync(path.join(scriptsRoot, rel), 'utf8');
    const logic = logicLines(text);
    for (const item of logic.slice(0, 5)) violations.push(`${rel}:${item.number} facade must only re-export, found: ${item.line.slice(0, 80)}`);
  }


  return { ok: violations.length === 0, files: files.length, violations, lineCounts };
}

function main() {
  const result = checkModules();
  if (result.ok) {
    process.stdout.write(`modules ok: ${result.files} files, layers/cycles/facades clean\n`);
    process.exitCode = 0;
    return;
  }
  process.stdout.write(`module boundary violations (${result.violations.length}):\n`);
  for (const violation of result.violations) process.stdout.write(`  - ${violation}\n`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
