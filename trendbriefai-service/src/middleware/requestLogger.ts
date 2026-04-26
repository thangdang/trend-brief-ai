/**
 * Request Logger Middleware
 * Structured JSON logging with request_id, duration, and slow request warnings.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

// Error rate tracking (5-min window)
let _errorCount = 0;
let _totalCount = 0;
let _windowStart = Date.now();
const WINDOW_MS = 5 * 60 * 1000;

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestId = uuid();
  const start = Date.now();

  // Attach to request for downstream use
  (req as any).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const userId = (req as any).user?.id || null;

    // Reset window if expired
    if (Date.now() - _windowStart > WINDOW_MS) {
      _errorCount = 0;
      _totalCount = 0;
      _windowStart = Date.now();
    }
    _totalCount++;
    if (res.statusCode >= 500) _errorCount++;

    const log = {
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_ms: duration,
      user_id: userId,
    };

    if (duration > 1000) {
      console.warn('SLOW_REQUEST', JSON.stringify(log));
    } else if (res.statusCode >= 500) {
      console.error('ERROR_REQUEST', JSON.stringify(log));
    }

    // Alert if error rate > 5%
    if (_totalCount >= 20 && (_errorCount / _totalCount) > 0.05) {
      console.warn(`HIGH_ERROR_RATE: ${_errorCount}/${_totalCount} (${((_errorCount / _totalCount) * 100).toFixed(1)}%) in last 5 min`);
    }
  });

  next();
}

export function getRequestMetrics() {
  return {
    total_requests_5min: _totalCount,
    error_count_5min: _errorCount,
    error_rate: _totalCount > 0 ? Math.round((_errorCount / _totalCount) * 10000) / 100 : 0,
  };
}
