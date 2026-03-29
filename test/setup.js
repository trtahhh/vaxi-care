// Global test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.JWT_REFRESH_SECRET = 'test_jwt_refresh_secret_key_for_testing_only';
process.env.DB_HOST = 'localhost';
process.env.DB_USER = 'root';
process.env.DB_PASSWORD = '';
process.env.DB_NAME = 'vaxi_care_test';

// Increase timeout for DB operations in CI
jest.setTimeout(10000);

// Suppress console logs during tests unless DEBUG is set
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: console.error,
  };
}

// Clean up after all tests
afterAll(async () => {
  // Allow time for any remaining handles to close
  await new Promise(resolve => setTimeout(resolve, 500));
});
