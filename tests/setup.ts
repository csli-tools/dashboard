// Test setup file
// Add any global test configuration here

// Increase timeout for integration tests
jest.setTimeout(10000);

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  // Keep log for debugging
  log: console.log,
};

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});