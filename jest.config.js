/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.js'],
  coverageDirectory: 'test/coverage',
  coverageReporters: ['text', 'lcov'],
  collectCoverageFrom: [
    'apps/**/*.js',
    '!apps/views/**',
    '!apps/entities/**',
    '!apps/database/**',
    '!node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  verbose: true,
  testTimeout: 10000,
  forceExit: true,
  detectOpenHandles: true,
};
