/**
 * Centralized error handling utilities
 *
 * Addresses error handling requirements from PR #22:
 * - User-friendly error messages
 * - Graceful degradation
 * - Proper error logging
 */

export enum ErrorSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  component?: string;
  operation?: string;
  componentStack?: string;
  metadata?: Record<string, any>;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly severity: ErrorSeverity,
    public context?: ErrorContext,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'AppError';

    // Maintains proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  getUserMessage(): string {
    switch (this.code) {
      case 'NETWORK_ERROR':
        return 'Network connection issue. Please check your connection and try again.';
      case 'RPC_ERROR':
        return 'Unable to connect to NEAR network. The service may be temporarily unavailable.';
      case 'CIRCUIT_OPEN':
        return 'Service temporarily unavailable due to high error rate. Please wait a moment.';
      case 'WEBSOCKET_ERROR':
        return 'Real-time connection lost. Attempting to reconnect...';
      case 'DATABASE_ERROR':
        return 'Local storage error. Some features may be unavailable.';
      case 'INVALID_INPUT':
        return 'Invalid input provided. Please check and try again.';
      case 'PERMISSION_DENIED':
        return 'Permission denied. Please check your configuration.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      context: this.context,
      stack: this.stack,
      cause: this.cause?.message
    };
  }
}

/**
 * Global error handler for uncaught errors
 */
export function installGlobalErrorHandlers() {
  process.on('uncaughtException', (error: Error) => {
    console.error('[CRITICAL] Uncaught Exception:', error);
    // Log to file if needed
    logError(new AppError(
      error.message,
      'UNCAUGHT_EXCEPTION',
      ErrorSeverity.CRITICAL,
      { metadata: { stack: error.stack } },
      error
    ));

    // Graceful shutdown
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('[ERROR] Unhandled Promise Rejection:', reason);
    logError(new AppError(
      reason?.message || String(reason),
      'UNHANDLED_REJECTION',
      ErrorSeverity.ERROR,
      { metadata: { promise: String(promise) } },
      reason
    ));
  });
}

/**
 * Log error with appropriate formatting
 */
export function logError(error: AppError | Error) {
  const timestamp = new Date().toISOString();
  const isAppError = error instanceof AppError;

  const logEntry = {
    timestamp,
    level: isAppError ? error.severity : ErrorSeverity.ERROR,
    message: error.message,
    code: isAppError ? error.code : 'UNKNOWN',
    context: isAppError ? error.context : undefined,
    stack: error.stack
  };

  // In production, this could write to a log file or send to monitoring service
  console.error(JSON.stringify(logEntry, null, 2));
}

/**
 * Wrap async functions with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context: ErrorContext
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof AppError) {
        error.context = { ...error.context, ...context };
        throw error;
      }

      // Convert unknown errors to AppError
      throw new AppError(
        error instanceof Error ? error.message : String(error),
        'UNKNOWN_ERROR',
        ErrorSeverity.ERROR,
        context,
        error instanceof Error ? error : undefined
      );
    }
  }) as T;
}

/**
 * Create error handlers for specific components
 */
export function createErrorHandler(component: string) {
  return (error: Error | AppError, operation: string) => {
    const appError = error instanceof AppError ? error : new AppError(
      error.message,
      'COMPONENT_ERROR',
      ErrorSeverity.ERROR,
      { component, operation },
      error
    );

    logError(appError);
    return appError;
  };
}

/**
 * Network error helpers
 */
export function isNetworkError(error: any): boolean {
  return error?.code === 'ECONNREFUSED' ||
         error?.code === 'ENOTFOUND' ||
         error?.code === 'ETIMEDOUT' ||
         error?.code === 'NETWORK_ERROR' ||
         error?.message?.includes('fetch failed');
}

export function isRetryableError(error: any): boolean {
  if (error instanceof AppError) {
    return error.severity !== ErrorSeverity.CRITICAL &&
           ['NETWORK_ERROR', 'RPC_ERROR', 'TIMEOUT'].includes(error.code);
  }
  return isNetworkError(error);
}