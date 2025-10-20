# Security Analysis - CSLI Dashboard

This document addresses the security concerns raised in PR #22 and validates the current implementation.

## SQL Injection Analysis ✅ SAFE

### Current Implementation Review

The CSLI Dashboard uses `better-sqlite3` with **parameterized queries** throughout. Analysis of `src/services/history-worker.ts`:

1. **All queries use parameter binding with `?` placeholders**:
   ```typescript
   // Examples from the codebase:
   stmtBlock = db.prepare(`INSERT OR REPLACE INTO blocks(height,hash,ts_ms,tx_count) VALUES (?,?,?,?)`);
   stmtTx = db.prepare(`INSERT OR REPLACE INTO txs(hash,height,signer,receiver,actions_json,raw_json) VALUES (?,?,?,?,?,?)`);
   stmtMarkUpsert = db.prepare(`INSERT INTO marks(label,pane,height,tx,when_ms,pinned) VALUES (?,?,?,?,?,?)`);
   ```

2. **Dynamic query building in `buildSearchSQL()` is secure**:
   - All user input goes through parameter binding
   - The only dynamic SQL construction is for WHERE clauses structure
   - All values are passed as parameters, never concatenated
   ```typescript
   where.push(`(${vals.map(() => `${col} LIKE ?`).join(' OR ')})`);
   for (const v of vals) params.push(`%${v.toLowerCase()}%`);
   ```

3. **LIMIT clause security** (lines 343-345):
   ```typescript
   // SQLite doesn't support parameterized LIMIT, but numeric constraint prevents injection
   const safeLimit = Math.max(1, Math.min(5000, limit));
   ```
   - Input is coerced to number and bounded between 1-5000
   - No string concatenation of user input

4. **Additional protections**:
   - Database size limit: `db.pragma('max_page_count = 262144')` (1GB limit)
   - All input types are validated in TypeScript interfaces
   - Worker thread isolation prevents direct database access

### Verdict
**NO SQL INJECTION VULNERABILITIES FOUND**. The implementation correctly uses parameterized queries for all user input.

## Path Traversal Protection ✅ IMPLEMENTED

The `src/utils/path-security.ts` module provides comprehensive path validation:

1. **Sanitization features**:
   - Resolves paths to absolute form (prevents `../` attacks)
   - Checks for null bytes
   - Validates against allowed base directories
   - Blocks system-critical directories

2. **Specialized validators**:
   - `sanitizeDbPath()` - For database files
   - `sanitizeCredentialsPath()` - For credential directories
   - Different security levels for different file types

3. **Platform-aware**:
   - Handles Windows, macOS, and Linux paths
   - Blocks platform-specific system directories

## Security Issues Fixed ✅

1. **WebSocket Race Condition** - FIXED
   - Created `WebSocketManager` class with thread-safe client management
   - Uses Map instead of Set with proper snapshot iteration
   - Prevents concurrent modification exceptions
   - Added connection limits and buffer size checks

## Remaining Security Tasks

### High Priority (Implement First)

1. **Circuit Breaker for RPC** (8 hours)
   - Prevent cascading failures
   - Automatic recovery after cooldown
   - Already have basic retry logic, need circuit breaker pattern

### Medium Priority

1. **Error Handling** (1 day)
   - Add try-catch blocks in critical paths
   - User-friendly error messages
   - Graceful degradation

2. **Input Validation** (6 hours)
   - Validate all WebSocket messages
   - Sanitize transaction data before display

### Testing Requirements

1. **Unit Tests** (2 days)
   - JSON parsing edge cases
   - Path traversal attempts
   - SQL injection attempts

2. **Integration Tests** (2 days)
   - WebSocket connection handling
   - Database operations
   - RPC failure scenarios

## Security Best Practices Already Implemented

- ✅ Parameterized SQL queries
- ✅ Path traversal protection
- ✅ Database size limits
- ✅ Worker thread isolation
- ✅ Type validation with TypeScript
- ✅ Null byte filtering
- ✅ Home directory expansion handling
- ✅ Platform-specific path validation

## Summary

The current implementation has strong security fundamentals. The SQL injection concern was a false positive - the code correctly uses parameterized queries. Path traversal protection is already implemented. The main remaining work involves adding robustness features (race condition fixes, resource limits, error handling) and comprehensive testing.