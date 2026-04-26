/**
 * API Version Middleware
 * Adds X-API-Version header to all responses.
 * Adds Deprecation header for non-versioned routes.
 */

import { Request, Response, NextFunction } from 'express';

export const API_VERSION = '1';

export function apiVersionHeader(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-API-Version', API_VERSION);

  // Mark non-versioned /api/ routes as deprecated
  if (req.path.startsWith('/api/') && !req.path.startsWith('/api/v1/')) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', 'Sat, 01 Jan 2027 00:00:00 GMT');
  }

  next();
}
