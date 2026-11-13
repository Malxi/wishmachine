import js from '@eslint/js';

const nodeGlobals = {
  Buffer: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  AbortController: 'readonly',
  AbortSignal: 'readonly',
  TextDecoder: 'readonly',
  TextEncoder: 'readonly',
  atob: 'readonly',
  btoa: 'readonly',
  console: 'readonly',
  fetch: 'readonly',
  process: 'readonly',
  global: 'readonly',
  setImmediate: 'readonly',
  clearImmediate: 'readonly',
  setInterval: 'readonly',
  clearInterval: 'readonly',
  setTimeout: 'readonly',
  clearTimeout: 'readonly',
  structuredClone: 'readonly',
};

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'references/**',
      // Generated mirror of scripts/ + SKILL.md; the canonical sources are linted.
      'dsh/skills/**',
      'dsh/market/**',
      '**/checkpoints/**',
      '**/.tmp-*',
      '.tmp-*',
    ],
  },
  js.configs.recommended,
  {
    files: ['scripts/**/*.js', 'tests/**/*.js', 'dsh/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: nodeGlobals,
    },
    rules: {
      // The runtime is dependency-free and uses result objects instead of throwing in
      // many paths; keep lint pragmatic: real errors block, style nits are warnings.
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-useless-escape': 'warn',
      'no-control-regex': 'off',
      'no-irregular-whitespace': ['error', { skipStrings: true, skipComments: true, skipTemplates: true }],
    },
  },
];
