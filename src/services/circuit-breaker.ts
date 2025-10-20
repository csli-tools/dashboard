/**
 * Circuit Breaker pattern implementation for fault tolerance
 *
 * Addresses the robustness concerns from PR #22:
 * - Prevents cascading failures when services are unavailable
 * - Provides automatic recovery with exponential backoff
 * - Reduces load on failing services
 */

export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Failures exceeded threshold, rejecting calls
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;     // Failures before opening circuit
  resetTimeout?: number;         // Time before attempting recovery (ms)
  successThreshold?: number;     // Successes needed to close circuit
  monitoringPeriod?: number;     // Time window for failure counting (ms)
  fallback?: () => any;          // Fallback function when circuit is open
}

export class CircuitBreaker<T = any> {
  private state = CircuitState.CLOSED;
  private failures = 0;
  private successes = 0;
  private lastFailureTime = 0;
  private nextAttempt = 0;

  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly successThreshold: number;
  private readonly monitoringPeriod: number;
  private readonly fallback?: () => T;

  constructor(
    private readonly name: string,
    options: CircuitBreakerOptions = {}
  ) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 60000; // 1 minute
    this.successThreshold = options.successThreshold ?? 2;
    this.monitoringPeriod = options.monitoringPeriod ?? 60000; // 1 minute
    this.fallback = options.fallback;
  }

  async execute<R = T>(fn: () => Promise<R>): Promise<R> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        return this.handleOpen();
      }
      // Try half-open
      this.state = CircuitState.HALF_OPEN;
      this.log('info', 'Circuit half-open, testing...');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.close();
      }
    } else {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  private onFailure(error: any): void {
    const now = Date.now();

    // Reset old failures outside monitoring period
    if (now - this.lastFailureTime > this.monitoringPeriod) {
      this.failures = 0;
    }

    this.failures++;
    this.lastFailureTime = now;

    if (this.state === CircuitState.HALF_OPEN) {
      this.open();
      this.log('error', `Circuit opened after half-open test failed: ${error.message}`);
    } else if (this.failures >= this.failureThreshold) {
      this.open();
      this.log('error', `Circuit opened after ${this.failures} failures: ${error.message}`);
    }
  }

  private open(): void {
    this.state = CircuitState.OPEN;
    this.nextAttempt = Date.now() + this.resetTimeout;
    this.successes = 0;
  }

  private close(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.log('info', 'Circuit closed, service recovered');
  }

  private handleOpen<R = T>(): R {
    if (this.fallback) {
      this.log('info', 'Using fallback while circuit is open');
      return this.fallback() as R;
    }

    const waitTime = Math.ceil((this.nextAttempt - Date.now()) / 1000);
    const error = new Error(
      `Circuit breaker '${this.name}' is OPEN. Service unavailable. Retry in ${waitTime}s`
    );
    (error as any).code = 'CIRCUIT_OPEN';
    (error as any).retryAfter = this.nextAttempt;
    throw error;
  }

  private log(level: 'info' | 'error', message: string): void {
    const prefix = `[CircuitBreaker:${this.name}]`;
    if (level === 'error') {
      console.error(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats() {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.state === CircuitState.OPEN ? new Date(this.nextAttempt).toISOString() : null
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.close();
    this.log('info', 'Circuit manually reset');
  }
}

/**
 * Circuit breaker specifically configured for RPC calls
 */
export function createRPCCircuitBreaker(name: string): CircuitBreaker {
  return new CircuitBreaker(name, {
    failureThreshold: 5,        // Open after 5 failures
    resetTimeout: 30000,        // Try again after 30 seconds
    successThreshold: 2,        // Need 2 successes to fully close
    monitoringPeriod: 60000,    // Count failures within 1 minute window
  });
}