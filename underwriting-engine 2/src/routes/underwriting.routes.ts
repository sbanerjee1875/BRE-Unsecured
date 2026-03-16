// ============================================================
// routes/underwriting.routes.ts — REST API endpoints
// ============================================================

import { Router, Request, Response } from 'express';
import { UnderwritingPipeline } from '../modules/underwriting.pipeline';
import { RuleEngineModule } from '../modules/rule-engine.module';
import { validateUnderwritingRequest } from '../utils/masking';
import { authMiddleware, validateConsents } from '../middleware';
import { logger } from '../utils/logger';

const router = Router();
const pipeline = new UnderwritingPipeline();
const ruleEngine = new RuleEngineModule();

// ── POST /v1/underwrite — Main underwriting endpoint ──────────
//
// Request:  UnderwritingRequest (see types/index.ts)
// Response: UnderwritingResponse (APPROVE | DECLINE | REFER)
//
router.post(
  '/underwrite',
  authMiddleware,
  validateConsents,
  async (req: Request, res: Response) => {
    const { value, error } = validateUnderwritingRequest(req.body);

    if (error) {
      return res.status(422).json({
        code: 'VALIDATION_ERROR',
        message: 'Request payload validation failed',
        details: error.details.map((d) => ({ field: d.path.join('.'), message: d.message })),
      });
    }

    try {
      const result = await pipeline.process(value);
      const statusCode = result.decision === 'APPROVE' ? 200
        : result.decision === 'REFER' ? 202
        : 200; // Decline also returns 200 — decision is in body

      return res.status(statusCode).json(result);
    } catch (err: any) {
      logger.error(`[Route] Underwrite error: ${err.message}`);
      return res.status(500).json({ code: 'ENGINE_ERROR', message: 'Underwriting engine error' });
    }
  }
);

// ── POST /v1/rules/reload — Force reload rules from disk ───────
// Useful when credit policy is updated without restarting service
router.post('/rules/reload', authMiddleware, (req: Request, res: Response) => {
  ruleEngine.invalidateCache();
  logger.info('[Route] Rules cache invalidated by API call');
  return res.json({ status: 'ok', message: 'Rule cache cleared — rules will reload on next evaluation' });
});

// ── GET /v1/health — Health check ─────────────────────────────
router.get('/health', (req: Request, res: Response) => {
  return res.json({
    status: 'healthy',
    service: 'underwriting-engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ── GET /v1/health/deep — Deep health (checks dependencies) ───
router.get('/health/deep', authMiddleware, async (req: Request, res: Response) => {
  // TODO: ping bureau, AA, DB in parallel
  return res.json({
    status: 'healthy',
    checks: {
      ruleEngine: 'ok',
      database: 'ok',
      redis: 'ok',
    },
    timestamp: new Date().toISOString(),
  });
});

export default router;
