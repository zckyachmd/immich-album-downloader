export default {
  testEnvironment: "node",
  transform: {},
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: ["lib/**/*.js", "!lib/**/*.test.js", "!**/node_modules/**"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  // Coverage thresholds - set to realistic values based on current test coverage
  // Note: Files like api.js, db.js, download.js, health.js, cancellation.js
  // require complex mocking (fetch, database, signals) and are tested manually/integration
  // Current coverage: 21.52% statements, 14.92% branches, 37.07% functions, 20.84% lines
  coverageThreshold: {
    global: {
      branches: 12, // Slightly below current (14.92%) to allow for fluctuations
      functions: 30, // Below current (37.07%) to allow for fluctuations
      lines: 18, // Slightly below current (20.84%) to allow for fluctuations
      statements: 18, // Slightly below current (21.52%) to allow for fluctuations
    },
  },
};
