// ============================================================
// index.ts — Application entry point
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
const PORT = parseInt(process.env.PORT ?? '3000');

// ── Security & Performance Middleware ─────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGINS?.split(',') ?? '*' }));
app.use(compression());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(rateLimiter);

// ── Routes ─────────────────────────────────────────────────────
app.use('/v1', underwritingRouter);

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ code: 'NOT_FOUND', message: `Route ${req.path} not found` });
});

// ── Global Error Handler ──────────────────────────────────────
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`✅ Underwriting Engine running on port ${PORT} [${process.env.NODE_ENV}]`);
  logger.info(`📊 Base rate: ${process.env.BASE_INTEREST_RATE}% | Max FOIR: ${parseFloat(process.env.MAX_FOIR ?? '0.65') * 100}%`);
});

export default app;
