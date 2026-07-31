/**
 * Jest configuration for PostgreSQL integration tests.
 *
 * Entirely separate from `jest.config.cjs`: the unit suite stays fast, mocked, and unchanged, and
 * nothing here can affect it. Integration tests are opt-in via `pnpm test:integration`.
 *
 * `maxWorkers: 1` — every suite shares one database. Parallel workers would truncate each other's
 * rows mid-test, and a concurrency proof that fights unrelated writers proves nothing. The
 * concurrency *within* a test is real (multiple simultaneous connections); it is the suites that
 * are serialized.
 *
 * No `forceExit`: teardown is explicit in `test-integration/setup.ts`, and a run that needs
 * forcing has not demonstrated it cleaned up after itself.
 */

module.exports = {
  displayName: 'integration',
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.integration.test.ts'],
  clearMocks: true,
  maxWorkers: 1,
  // Bootstrap (migrate deploy over 30 migrations) plus real contended transactions.
  testTimeout: 60_000,
  globalSetup: '<rootDir>/src/test-integration/global-setup.ts',
  setupFilesAfterEnv: ['<rootDir>/src/test-integration/setup.ts'],
};
