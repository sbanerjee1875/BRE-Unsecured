// ============================================================
// routes/analytics.routes.ts — Analytics ingestion + Admin API
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { analyticsStore } from '../analytics/analytics.store';
import { logger } from '../utils/logger';

const router = Router();

// ── Simple admin auth (Bearer <ADMIN_PASSWORD>) ──────────────
// Set ADMIN_PASSWORD in your .env. Defaults to "admin123" for dev.

function adminAuth(req: Request, res: Response, next: NextFunction): void {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Admin Bearer token required' });
    return;
  }

  const token = authHeader.split(' ')[1];
  if (token !== adminPassword) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid admin password' });
    return;
  }

  next();
}

// ── POST /v1/analytics/event — receive events from frontend ──
// Accepts: page_view, click
// No auth required — public endpoint (events come from browsers)

router.post('/analytics/event', (req: Request, res: Response) => {
  const { type, path, sessionId, element, page, referrer } = req.body;

  if (!type || !sessionId) {
    res.status(422).json({ code: 'VALIDATION_ERROR', message: 'type and sessionId are required' });
    return;
  }

  switch (type) {
    case 'page_view':
      analyticsStore.recordPageView(path || '/', sessionId, referrer);
      break;
    case 'click':
      analyticsStore.recordClickEvent(element || 'unknown', page || '/', sessionId);
      break;
    default:
      // Unknown event types are silently accepted to be forward-compatible
      break;
  }

  res.status(204).send();
});

// ── POST /v1/admin/login — exchange password for a token ─────
// Returns the password itself as the token (stateless).

router.post('/admin/login', (req: Request, res: Response) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (!password || password !== adminPassword) {
    logger.warn('[Admin] Failed login attempt');
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid admin password' });
    return;
  }

  res.json({ token: adminPassword });
});

// ── GET /v1/admin/stats — full dashboard payload ─────────────

router.get('/admin/stats', adminAuth, (_req: Request, res: Response) => {
  const stats = analyticsStore.getStats();
  res.json(stats);
});

export default router;
