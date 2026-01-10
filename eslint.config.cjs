
// eslint.config.cjs — ESLint 9 (flat config)
const js = require('@eslint/js');                         // core ESLint rules
const tseslint = require('typescript-eslint');            // TS parser + plugin + shareable configs
const importPlugin = require('eslint-plugin-import');     // import rules
const globals = require('globals');                       // environment globals (node, ES2021)

module.exports = tseslint.config(
  // 1) Base: ESLint recommended
  js.configs.recommended,

  // 2) Global language options (ECMAScript + Node env)
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      // Use typescript-eslint's parser for TS files only (below),
      // default JS parser is fine for *.js/*.cjs/*.mjs
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      // Your original rules (applied to all files unless overridden later)
      // Turn off core rule; use TS-specific variant in TS section
      'no-unused-vars': 'off',
      'import/no-unresolved': 'off',
    },
  },

  // 3) TypeScript-specific config (applies only to TS/TSX)
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        // use your project's tsconfig if you need type-aware rules later
        // project: true, // uncomment when enabling "typed" rules
      },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      import: importPlugin,
    },
    // Use shareable configs from typescript-eslint (recommended)
    extends: [
      tseslint.configs.recommended, // base TS rules
      // You can optionally add:
      // tseslint.configs.strict,
      // tseslint.configs.stylistic,
    ],
    rules: {
      // Mirror your original TS rule settings
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // 4) Optional: ignore-output folders
  {
    ignores: ['node_modules/**', 'dist/**', 'coverage/**', 'src/test/**'],
  }
);
