/**
 * Circuit Breaker for AI Engine calls.
 *
 * States:
 *   CLOSED (normal) → forward requests
 *   OPEN (blocking) → return fallback immediately
 *   HALF_OPEN (testing) → forward 1 request to test recovery
 *
 * Transitions:
 *   CLOSED → OPEN: after `failureThreshold` consecutive failures
 *   OPEN → HALF_OPEN: after `resetTimeout` ms
 *   HALF_OPEN → CLOSED: on success
 *   HALF_OPEN → OPEN: on failure
 */

import logger from '../config/logger';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerOptions {
  failureThreshold?: number;
  resetTimeout?: number;  // ms
  name?: string;
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly name: string;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeout = options.resetTimeout ?? 30000; // 30s
    this.name = options.name ?? 'default';
  }

  /**
   * Execute a function through the circuit breaker.
   * Returns the function result or throws if circuit is open.
   */
  async exec<T>(fn: () => Promise<T>, fallback?: () => T | Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'HALF_OPEN';
        logger.info(`[CircuitBreaker:${this.name}] OPEN → HALF_OPEN (testing recovery)`);
      } else {
        logger.debug(`[CircuitBreaker:${this.name}] OPEN — using fallback`);
        if (fallback) return fallback();
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (error) {
      this._onFailure(error as Error);
      if (fallback) return fallback();
      throw error;
    }
  }

  private _onSuccess() {
    if (this.state === 'HALF_OPEN') {
      logger.info(`[CircuitBreaker:${this.name}] HALF_OPEN → CLOSED (recovered)`);
    }
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  private _onFailure(error: Error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      logger.warn(`[CircuitBreaker:${this.name}] HALF_OPEN → OPEN (test failed: ${error.message})`);
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.warn(
        `[CircuitBreaker:${this.name}] CLOSED → OPEN after ${this.failureCount} failures (${error.message})`
      );
    }
  }

  getStatus(): { state: CircuitState; failureCount: number; lastFailureAt: string | null } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureAt: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

// Singleton for AI engine calls
export const aiEngineBreaker = new CircuitBreaker({
  name: 'ai-engine',
  failureThreshold: 5,
  resetTimeout: 30000,
});

export default CircuitBreaker;
