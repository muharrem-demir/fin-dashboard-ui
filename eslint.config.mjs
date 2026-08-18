import js from '@eslint/js';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import testingLibrary from 'eslint-plugin-testing-library';
import prettier from 'eslint-config-prettier';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Flat-config ESLint for the whole repo.
 *
 * The type-aware rules (`recommendedTypeChecked` and friends) are the reason this config needs a
 * `project` reference: without type information, the rules that catch the mistakes that actually
 * reach production here — a floating promise from a mutation, an `await` on a non-thenable, a
 * template literal quietly stringifying an object — cannot run at all.
 *
 * `npm run build` runs this with `--max-warnings=0`, so there is no such thing as a warning that
 * survives a build; anything not worth fixing is switched off deliberately below.
 */
export default tseslint.config(
  {
    // `public/` holds a browser script served verbatim, not source to be linted against a tsconfig.
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', '.claude/**', 'public/**'],
  },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // ---- Application and test sources -----------------------------------------------------------
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.es2023 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'jsx-a11y': jsxA11y,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,

      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // The project's headline requirement: strict TypeScript with no `any`. An error, not a warning,
      // and no unchecked escape hatches around it either.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',

      // A dropped promise from a mutation is invisible at runtime and loses the error entirely.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': [
        'error',
        // Turned off for JSX props: `onClick={() => { void mutate(); }}` is the correct shape, and the
        // rule cannot tell it from a genuinely unhandled promise handler.
        { checksVoidReturn: { attributes: false } },
      ],

      // `if (name)` on a string treats "" and undefined alike; on this codebase's optional prices that
      // difference is the whole point.
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        { allowString: false, allowNumber: false, allowNullableObject: true },
      ],
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: false }],

      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/explicit-function-return-type': [
        'warn',
        { allowExpressions: true, allowTypedFunctionExpressions: true, allowHigherOrderFunctions: true },
      ],

      // `logger` exists so that level filtering is not optional; see src/shared/lib/logger.ts.
      'no-console': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-param-reassign': 'error',
      'prefer-const': 'error',
      'object-shorthand': ['error', 'always'],

      // Import order, enforced by hand rather than with a plugin: builtin/external, then anything
      // above the current directory, then siblings.
      'sort-imports': ['off'],
    },
  },

  // ---- Tests ----------------------------------------------------------------------------------
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
    plugins: {
      'testing-library': testingLibrary,
    },
    rules: {
      ...testingLibrary.configs['flat/react'].rules,

      // Test doubles legitimately need looser typing than production code — a stubbed `fetch` or a
      // fake `WebSocket` cannot satisfy the real interface without becoming unreadable.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      // ...but `any` itself stays banned, even here.
      '@typescript-eslint/no-explicit-any': 'error',
      'react-refresh/only-export-components': 'off',
    },
  },

  // ---- The flat-config files themselves ---------------------------------------------------------
  // Deliberately linted without type information: they belong to no tsconfig, and an inferred program
  // types every plugin import as `any`, which the type-aware rules then report on every line.
  {
    files: ['*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // ---- Build tooling --------------------------------------------------------------------------
  {
    files: ['vite.config.ts', 'vite-plugins/**/*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },

  // Last, so it can switch off the stylistic rules Prettier owns.
  prettier,
);
