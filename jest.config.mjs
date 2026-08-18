/**
 * Jest, transformed by SWC.
 *
 * SWC rather than ts-jest because it is a transpiler and nothing more: types are checked once, by
 * `npm run typecheck`, and paying for a second full type-check on every test run buys nothing.
 *
 * Two mappings matter:
 *
 *   - `virtual:app-config` is a Vite virtual module and does not exist outside a Vite build, so it is
 *     pointed at a fixture that loads `config/config.test.yaml`. This is also why no source file
 *     reads `import.meta.env` — it would be a syntax error under CommonJS.
 *   - `.css` imports are stubbed; Tailwind is a build concern, not a test one.
 *
 * @type {import('jest').Config}
 */
export default {
  // jsdom plus the Node-provided web APIs it lacks; see src/test/jsdom-environment.ts.
  testEnvironment: '<rootDir>/src/test/jsdom-environment.ts',
  roots: ['<rootDir>/src', '<rootDir>/vite-plugins'],
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],

  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // The custom environment lives under src/test and must not be collected as a suite.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/test/'],

  moduleNameMapper: {
    '^virtual:app-config$': '<rootDir>/src/test/mocks/app-config-fixture.ts',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/test/mocks/style-stub.ts',
  },

  transform: {
    '^.+\\.(t|j)sx?$': [
      '@swc/jest',
      {
        jsc: {
          parser: { syntax: 'typescript', tsx: true },
          transform: { react: { runtime: 'automatic' } },
          target: 'es2022',
        },
      },
    ],
  },

  // Several dependencies ship ESM only; SWC transpiles them to CommonJS rather than Jest choking on
  // their `import` statements.
  transformIgnorePatterns: ['node_modules/(?!(lucide-react|react-router|react-router-dom|zod)/)'],

  clearMocks: true,
  restoreMocks: true,

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/test/**',
    '!src/main.tsx',
    '!src/types/**',
  ],
  coverageReporters: ['text-summary', 'lcov'],
  coverageThreshold: {
    // A floor CI enforces, set a little below where the suite actually sits so an unrelated change does
    // not fail the build on a rounding difference. The per-file entries below are the parts where a gap
    // in coverage would really matter, and they are held much higher.
    global: {
      statements: 80,
      branches: 72,
      functions: 72,
      lines: 80,
    },
    'src/features/portfolio-detail/lib/holdings.ts': {
      statements: 95,
      branches: 90,
      functions: 100,
      lines: 95,
    },
    'src/features/quotes/ws/quote-stream-client.ts': {
      statements: 85,
      branches: 70,
      functions: 85,
      lines: 85,
    },
    'src/features/portfolio-detail/lib/add-stock-validation.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
};
