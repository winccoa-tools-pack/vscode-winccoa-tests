
// eslint.config.js (CommonJS)
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  // Base ESLint recommended rules (replacement for "eslint:recommended")
  js.configs.recommended,

  // TypeScript recommended rules (replacement for "plugin:@typescript-eslint/recommended")
  tseslint.configs.recommended,

  // Apply TS-specific parser options & environment equivalents
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: ['./tsconfig.json'],   // matches your original "project"
        sourceType: 'module',           // matches your original "sourceType"
        ecmaVersion: 2021,              // ES2021
      },
      // Node + ES2021 environment analogue
      globals: {
        // Node globals (minimal set; extend as you need)
        process: 'readonly',
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
      },
    },
    rules: {
      // keep empty (you had "rules": {})
      // add rule overrides here if needed
    },
  },

  // Legacy tests: allow `any` without spending time refactoring
  {
    files: ['src/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Ignore typical output folders (flat config replaces .eslintignore)
  {
    ignores: ['node_modules/', 'dist/', 'out/', 'coverage/']
  }
);
