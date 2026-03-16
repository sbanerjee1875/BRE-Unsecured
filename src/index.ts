// ============================================================
// index.ts — Application entry point
// Vercel serverless compatible — no app.listen()
// For local dev: ts-node-dev runs this with server.ts wrapper
// ============================================================

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import underwritingRouter from './routes/underwriting.routes';
import { requestLogger, errorHandler, rateLimiter } from './middleware';
import { logger } from './utils/logger';

const app = express();

// ── Security & Performance Middleware ─────────────────────────
app.use(helmet({
  // Relax CSP for API-only service
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') ?? '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
}));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(rateLimiter);

// ── Routes ────────────────────────────────────────────────────
app.use('/v1', underwritingRouter);

// ── Root ping (useful for Vercel deploy health check) ─────────
app.get('/', (_req, res) => {
  res.json({
    service: 'Personal Loan Underwriting Engine',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health:      'GET  /v1/health',
      underwrite:  'POST /v1/underwrite',
      rulesReload: 'POST /v1/rules/reload',
    },
  });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
    availableRoutes: ['GET /', 'GET /v1/health', 'POST /v1/underwrite'],
  });
});

// ── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ── Local dev server (only runs outside Vercel) ───────────────
// Vercel imports this file as a module — it must NOT call listen()
// When running locally via `npm run dev`, server.ts calls listen()
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  const PORT = parseInt(process.env.PORT ?? '3000');
  app.listen(PORT, () => {
    logger.info(`✅ Underwriting Engine running on http://localhost:${PORT}`);
    logger.info(`📊 Base rate: ${process.env.BASE_INTEREST_RATE ?? '10.50'}% | Max FOIR: ${parseFloat(process.env.MAX_FOIR ?? '0.65') * 100}%`);
  });
}

// ── IMPORTANT: export default for Vercel serverless ──────────
export default app;
