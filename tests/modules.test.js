// Architecture contract: layers, cycles, facade thinness and feature isolation.
// The checker is also exposed as `npm run lint:modules` and runs in CI.
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkModules } from '../scripts/check-imports.js';

test('module boundaries hold (layers, cycles, facades, feature isolation)', () => {
  const result = checkModules();
  assert.equal(result.ok, true, `module boundary violations:\n${result.violations.join('\n')}`);
});
