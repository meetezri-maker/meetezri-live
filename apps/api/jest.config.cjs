module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  // Integration tests need a real PostgreSQL and live in their own project
  // (jest.integration.config.cjs). Excluding them here keeps the unit suite fast, hermetic, and
  // runnable with no infrastructure — exactly as it was before Phase 2C.
  testPathIgnorePatterns: ["/node_modules/", "\\.integration\\.test\\.ts$"],
  clearMocks: true,
  // Closes the lazily-created shared Redis client after each suite. Without it, any suite touching
  // a cache-invalidating path leaves an open ioredis socket with reconnect timers and Jest cannot
  // exit. See src/test-setup.ts.
  setupFilesAfterEnv: ["<rootDir>/src/test-setup.ts"],
};
