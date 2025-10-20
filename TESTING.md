# Testing Guide - CSLI Dashboard

## Overview

This document outlines the testing strategy for the CSLI Dashboard, addressing the security review requirements from PR #22.

## Test Structure

```
tests/
├── json-auto-parse.test.ts    # JSON parsing functionality
├── websocket-manager.test.ts  # WebSocket connection management
├── path-security.test.ts      # Path traversal protection
└── setup.ts                   # Test configuration
```

## Running Tests

```bash
# Install test dependencies first
npm install --save-dev jest @types/jest ts-jest

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test json-auto-parse

# Run integration tests
npm run test:near    # Test NEAR RPC connectivity
npm run test:models  # Test data model parsing
```

## Test Coverage Areas

### 1. Security Tests ✅
- **Path Traversal**: Validates path sanitization prevents directory escapes
- **SQL Injection**: Verifies parameterized queries (already safe)
- **Resource Limits**: Tests connection limits and buffer constraints

### 2. Core Functionality Tests ✅
- **JSON Parsing**: Tests recursive JSON string detection and parsing
- **WebSocket Manager**: Tests connection handling, broadcasting, keep-alive
- **Error Handling**: Validates graceful error recovery

### 3. Integration Tests (Manual)
- **NEAR Connection**: `npm run test:near`
- **Data Models**: `npm run test:models`

## Writing New Tests

Keep tests simple and focused:

```typescript
describe('Feature', () => {
  it('should do something specific', () => {
    // Arrange
    const input = { ... };

    // Act
    const result = myFunction(input);

    // Assert
    expect(result).toBe(expected);
  });
});
```

## Mocking Guidelines

- Mock external dependencies (network, filesystem)
- Use real implementations when possible
- Keep mocks simple - no complex behavior

## Coverage Goals

- Critical security paths: 100%
- Core business logic: 80%+
- UI components: 50%+
- Overall target: 70%

## CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Run tests
  run: |
    npm ci
    npm test -- --ci --coverage

- name: Upload coverage
  uses: codecov/codecov-action@v3
```

## Performance Testing

For load testing WebSocket connections:

```bash
# Simple load test (requires artillery)
artillery quick --count 100 --num 10 ws://localhost:63736
```

## Security Testing Checklist

- [x] Path traversal attempts blocked
- [x] SQL injection impossible (parameterized queries)
- [x] Resource exhaustion prevented (connection/memory limits)
- [x] Race conditions eliminated (thread-safe WebSocket handling)
- [x] Error messages don't leak sensitive info
- [x] All inputs validated and sanitized

## Notes

- Tests use Jest with ts-jest for TypeScript support
- Global test timeout is 10 seconds for async operations
- Console errors/warnings are mocked to reduce noise
- Each test file can be run independently