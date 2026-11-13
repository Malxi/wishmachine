// Structural gate: file length, function length and parameter count.
// The same checker runs as `npm run lint:structure` and inside `lint:modules` (CI).
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkStructure } from '../scripts/check-structure.js';

test('structural limits hold (file <=350, function <=80, params <=4 with allowlist)', () => {
  const result = checkStructure();
  assert.equal(result.ok, true, `structure violations:\n${result.violations.join('\n')}`);
});
