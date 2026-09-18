import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';
import house from './eslint-rules/index.js';

/** ESLint 9 flat config — web/tz.md §2.1 / §2.2. Formatting is Prettier's job (backend/.prettierrc). */
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', 'stats.html', 'sourcemaps', 'playwright-report', 'test-results'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.es2021 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: '19.0' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      house,
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      // --- §17 security ------------------------------------------------------------------
      'react/no-danger': 'error',
      'no-restricted-properties': [
        'error',
        {
          object: 'localStorage',
          property: 'setItem',
          message:
            'Only refreshToken (obk.rt) touches localStorage, and only from shared/auth (web/tz.md §17).',
        },
      ],

      // --- the four house rules ----------------------------------------------------------
      'house/no-cross-feature-import': 'error',
      'house/no-url-literal': 'error',
      'house/no-raw-query-key': 'error',
      'house/no-design-literal': 'error',

      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // The token layer and the endpoint table are the one place literals are allowed.
  {
    files: ['src/shared/api/endpoints.ts', 'src/shared/api/client.ts'],
    rules: { 'house/no-url-literal': 'off' },
  },
  // The PII scrubber's tests and the deploy-time CSP check must feed real-world URLs.
  {
    files: ['src/shared/observability/**/*.test.ts', 'deploy/**/*.ts'],
    rules: { 'house/no-url-literal': 'off' },
  },
  {
    files: ['src/shared/api/queryKeys.ts'],
    rules: { 'house/no-raw-query-key': 'off' },
  },
  {
    files: ['src/shared/ui/**', 'tailwind.config.ts', 'src/app/layouts/**', 'scripts/**'],
    rules: { 'house/no-design-literal': 'off' },
  },

  // Local storage is written from exactly one module.
  {
    files: ['src/shared/auth/**'],
    rules: { 'no-restricted-properties': 'off' },
  },

  // Context/provider modules export a component and its hook from the same file by design.
  {
    files: [
      'src/app/**',
      'src/shared/auth/**',
      'src/shared/realtime/**',
      'src/shared/ui/**',
      'tests/setup/**',
    ],
    rules: { 'react-refresh/only-export-components': 'off' },
  },

  // §8.3 — a log screen never renders a timestamp in the browser timezone.
  {
    files: ['src/features/hos-logs/**', 'src/features/reports/**', 'src/shared/format/hos*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@/shared/format',
              importNames: ['formatLocal'],
              message:
                'HOS and log screens render in the driver home terminal timezone — use formatInTz (web/tz.md §8.3).',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.name='formatLocal']",
          message:
            'formatLocal is banned on log screens — the driver home terminal timezone wins (web/tz.md §8.3).',
        },
        {
          selector: "MemberExpression[property.name='formatLocal']",
          message:
            'formatLocal is banned on log screens — the driver home terminal timezone wins (web/tz.md §8.3).',
        },
      ],
    },
  },

  // MSW fixtures are generated from backend/docs/openapi.json — they are test data, not app code.
  {
    files: ['src/mocks/**'],
    rules: {
      'house/no-url-literal': 'off',
      'house/no-design-literal': 'off',
      'house/no-raw-query-key': 'off',
    },
  },

  {
    files: ['**/*.{test,spec}.{ts,tsx}', 'tests/**', 'scripts/**', '*.config.ts', 'eslint-rules/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      'house/no-url-literal': 'off',
      'house/no-raw-query-key': 'off',
      'house/no-design-literal': 'off',
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
