#!/usr/bin/env node
// Structural gate for parallel work: file length, function length and parameter
// count. Kept dependency-free so `npm test`/CI can run it anywhere.
//
// Limits (see docs/MODULES.md):
//   FILE_MAX_LINES   = 350  split the file instead of growing it
//   FUNCTION_MAX     = 80   split the function or extract helpers
//   PARAMS_MAX       = 4    pass an options object instead of a long positional list
//
// Deliberate API exceptions live in PARAM_ALLOWLIST with a reason; keep it short.
// Run with `npm run lint:structure`; tests/structure.test.js calls checkStructure().

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE_MAX_LINES = 350;
const FUNCTION_MAX = 80;
const PARAMS_MAX = 4;
const PARAM_ALLOWLIST = new Map([
  // finding(ruleId, severity, issue, targetId, suggestion) is the rule vocabulary
  // itself; an options object here would make every rule call harder to read.
  ['rules/finding.js:finding', 'rule vocabulary used by every validation rule'],
]);

function relOf(file) {
  return path.relative(path.join(ROOT, 'scripts'), file).replace(/\\/g, '/');
}

function listScripts(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listScripts(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// Replaces comments and string/template literals with spaces while preserving
// newlines and offsets, so brace matching cannot be confused by source text.
function stripSource(text) {
  const out = text.split('');
  let mode = 'code';
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (mode === 'code') {
      if (ch === '/' && next === '/') { mode = 'line'; out[i] = ' '; out[i + 1] = ' '; i += 1; continue; }
      if (ch === '/' && next === '*') { mode = 'block'; out[i] = ' '; out[i + 1] = ' '; i += 1; continue; }
      if (ch === "'" || ch === '"' || ch === '`') { mode = ch; out[i] = ' '; continue; }
      continue;
    }
    if (mode === 'line') {
      if (ch === '\n') { mode = 'code'; } else out[i] = ' ';
      continue;
    }
    if (mode === 'block') {
      if (ch === '*' && next === '/') { out[i] = ' '; out[i + 1] = ' '; i += 1; mode = 'code'; continue; }
      if (ch !== '\n') out[i] = ' ';
      continue;
    }
    // string / template
    if (ch === '\\') { out[i] = ' '; if (next !== '\n') out[i + 1] = ' '; i += 1; continue; }
    if (ch === mode) { mode = 'code'; out[i] = ' '; continue; }
    if (ch !== '\n') out[i] = ' ';
  }
  return out.join('');
}

function lineAt(code, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (code[i] === '\n') line += 1;
  return line;
}

function matchPair(code, openIndex, openChar, closeChar) {
  let depth = 0;
  for (let i = openIndex; i < code.length; i += 1) {
    if (code[i] === openChar) depth += 1;
    else if (code[i] === closeChar) {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function countParams(paramText) {
  const text = paramText.trim();
  if (!text) return 0;
  let depth = 0;
  let count = 1;
  for (const ch of text) {
    if ('([{'.includes(ch)) depth += 1;
    else if (')]}'.includes(ch)) depth -= 1;
    else if (ch === ',' && depth === 0) count += 1;
  }
  return count;
}

function functionsIn(code) {
  const found = [];
  // function declarations / expressions
  const declRe = /\bfunction\b\s*\*?\s*([A-Za-z_$][\w$]*)?\s*\(/g;
  for (const match of code.matchAll(declRe)) {
    const name = match[1] || '(anonymous)';
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchPair(code, openParen, '(', ')');
    if (closeParen < 0) continue;
    const braceIndex = code.indexOf('{', closeParen);
    if (braceIndex < 0 || code.slice(closeParen + 1, braceIndex).trim()) continue;
    const closeBrace = matchPair(code, braceIndex, '{', '}');
    if (closeBrace < 0) continue;
    found.push({ name, line: lineAt(code, match.index), start: match.index, end: closeBrace, params: countParams(code.slice(openParen + 1, closeParen)) });
  }
  // const name = (params) => ... or const name = async (params) => ...
  const arrowRe = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g;
  for (const match of code.matchAll(arrowRe)) {
    const openParen = match.index + match[0].length - 1;
    const closeParen = matchPair(code, openParen, '(', ')');
    if (closeParen < 0) continue;
    const tail = code.slice(closeParen + 1);
    const arrow = tail.match(/^\s*=>\s*/);
    if (!arrow) continue;
    const bodyStart = closeParen + 1 + arrow[0].length;
    let end = bodyStart;
    if (code[bodyStart] === '{') {
      end = matchPair(code, bodyStart, '{', '}');
      if (end < 0) continue;
    } else {
      // expression body: stop at the end of the statement/line
      const newline = code.indexOf('\n', bodyStart);
      end = newline < 0 ? code.length - 1 : newline;
    }
    found.push({ name: match[1], line: lineAt(code, match.index), start: match.index, end, params: countParams(code.slice(openParen + 1, closeParen)) });
  }
  // single-identifier arrow: const f = x => ...
  const singleRe = /\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?([A-Za-z_$][\w$]*)\s*=>/g;
  for (const match of code.matchAll(singleRe)) {
    const bodyStart = match.index + match[0].length;
    let end = bodyStart;
    if (code[bodyStart] === '{' || /\s*\{/.test(code.slice(bodyStart, bodyStart + 2))) {
      const brace = code.indexOf('{', bodyStart);
      end = matchPair(code, brace, '{', '}');
      if (end < 0) continue;
    } else {
      const newline = code.indexOf('\n', bodyStart);
      end = newline < 0 ? code.length - 1 : newline;
    }
    found.push({ name: match[1], line: lineAt(code, match.index), start: match.index, end, params: 1 });
  }
  return found;
}

export function checkStructure(root = ROOT) {
  const files = listScripts(path.join(root, 'scripts'));
  const violations = [];
  let functionCount = 0;
  for (const file of files) {
    const rel = relOf(file);
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/).length - 1;
    if (lines > FILE_MAX_LINES) {
      violations.push(`${rel}: file has ${lines} lines > ${FILE_MAX_LINES} (split it into modules)`);
    }
    const code = stripSource(text);
    for (const fn of functionsIn(code)) {
      functionCount += 1;
      const length = lineAt(code, fn.end) - fn.line + 1;
      const allowKey = `${rel}:${fn.name}`;
      if (length > FUNCTION_MAX) {
        violations.push(`${rel}:${fn.line} function ${fn.name} has ${length} lines > ${FUNCTION_MAX} (extract helpers)`);
      }
      if (fn.params > PARAMS_MAX && !PARAM_ALLOWLIST.has(allowKey)) {
        violations.push(`${rel}:${fn.line} function ${fn.name} has ${fn.params} parameters > ${PARAMS_MAX} (pass an options object)`);
      }
    }
  }
  return { ok: violations.length === 0, files: files.length, functions: functionCount, violations };
}

function main() {
  const result = checkStructure();
  if (result.ok) {
    process.stdout.write(`structure ok: ${result.files} files, ${result.functions} functions, ` +
      `limits file<=${FILE_MAX_LINES} fn<=${FUNCTION_MAX} params<=${PARAMS_MAX}\n`);
    process.exitCode = 0;
    return;
  }
  process.stdout.write(`structure violations (${result.violations.length}):\n`);
  for (const violation of result.violations) process.stdout.write(`  - ${violation}\n`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
