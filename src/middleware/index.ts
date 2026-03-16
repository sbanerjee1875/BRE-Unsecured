// ============================================================
// middleware/index.ts — Express middleware stack
// ============================================================

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

// ── JWT Auth Middleware ────────────────────────────────────────

export interface AuthenticatedRequest extends Request {
  caller?: { clientId: string; channel: string; };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Bearer token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    req.caller = { clientId: decoded.clientId, channel: decoded.channel };
    next();
  } catch (err) {
    res.status(401).json({ code: 'TOKEN_INVALID', message: 'Invalid or expired token' });
  }
}

// ── Rate Limiter ───────────────────────────────────────────────

export const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests — please try again later' },
});

// ── Request Logger ─────────────────────────────────────────────

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const correlationId = req.headers['x-correlation-id'] as string ?? `req-${Date.now()}`;
  req.headers['x-correlation-id'] = correlationId;

  res.on('finish', () => {
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms [${correlationId}]`);
  });
  next();
}

// ── Global Error Handler ───────────────────────────────────────

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack, path: req.path });
  res.status(500).json({
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
    correlationId: req.headers['x-correlation-id'],
  });
}

// ── Consent Validation Middleware ─────────────────────────────

export function validateConsents(req: Request, res: Response, next: NextFunction): void {
  const { consentTokens } = req.body;
  if (!consentTokens?.bureauConsent || !consentTokens?.aaConsent) {
    res.status(422).json({
      code: 'CONSENT_MISSING',
      message: 'bureauConsent and aaConsent are mandatory for processing',
    });
    return;
  }
  next();
}
