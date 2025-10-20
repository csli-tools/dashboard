/**
 * Simple debug logger that respects environment variables
 * Useful for debugging issues without cluttering production logs
 */

const DEBUG_ENABLED = process.env.CSLI_DEBUG === '1' || process.env.DEBUG === '1';

export function debugLog(context: string, message: string, error?: any) {
  if (!DEBUG_ENABLED) return;

  const timestamp = new Date().toISOString();
  const errorInfo = error ? ` - ${error.message || error}` : '';

  // Log to stderr to avoid interfering with UI output
  console.error(`[DEBUG ${timestamp}] ${context}: ${message}${errorInfo}`);

  // If there's a stack trace, log it separately
  if (error?.stack && typeof error.stack === 'string') {
    console.error(error.stack);
  }
}

export function debugError(context: string, message: string, error: any) {
  debugLog(context, message, error);
}