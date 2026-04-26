/**
 * Zod Validation Middleware
 * Validates request body, query, and params against Zod schemas.
 * Returns 400 with field-level errors on validation failure.
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodType } from 'zod';

interface ValidationSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate(schemas: ValidationSchemas) {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: Array<{ field: string; message: string; path: string }> = [];

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            field: issue.path.join('.') || 'body',
            message: issue.message,
            path: `body.${issue.path.join('.')}`,
          });
        }
      } else {
        req.body = result.data; // use parsed/transformed data
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            field: issue.path.join('.') || 'query',
            message: issue.message,
            path: `query.${issue.path.join('.')}`,
          });
        }
      } else {
        req.query = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            field: issue.path.join('.') || 'params',
            message: issue.message,
            path: `params.${issue.path.join('.')}`,
          });
        }
      }
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }

    next();
  };
}

// ─── Common Schemas ───

export const feedQuerySchema = z.object({
  topic: z.enum(['ai', 'finance', 'lifestyle', 'drama', 'career', 'insight', 'technology', 'health', 'entertainment', 'sport']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  topic: z.enum(['ai', 'finance', 'lifestyle', 'drama', 'career', 'insight', 'technology', 'health', 'entertainment', 'sport']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const bookmarkBodySchema = z.object({
  article_id: z.string().min(1),
});

export const interactionBodySchema = z.object({
  article_id: z.string().min(1),
  action: z.enum(['view', 'click_original', 'share', 'bookmark']),
});

export const registerBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(100).optional(),
});

export const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const articleIdParamSchema = z.object({
  id: z.string().min(1),
});

export const summarizeUrlBodySchema = z.object({
  url: z.string().url(),
});
