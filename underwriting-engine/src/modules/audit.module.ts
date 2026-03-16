// ============================================================
// modules/audit.module.ts — API-020 Audit Log
// ============================================================

import { BaseApiClient } from '../integrations/base-api-client';
import {
  UnderwritingResponse, UnderwritingContext,
  AuditLogEntry, ApiCallLogEntry
} from '../types';
import { logger } from '../utils/logger';
import { maskPan, maskMobile } from '../utils/masking';
import { v4 as uuidv4 } from 'uuid';

const ENGINE_VERSION = '1.0.0';

export class AuditModule {
  async log(
    response: UnderwritingResponse,
    ctx: UnderwritingContext,
    apiCallLog: ApiCallLogEntry[]
  ): Promise<void> {
    const entry: AuditLogEntry = {
      auditId: response.auditId,
      applicationId: response.applicationId,
      decision: response.decision,
      scorecard: response.scorecard.moduleScores,
      hardGatesEvaluated: response.hardGatesTriggered,
      softFlagsTriggered: response.softFlagsTriggered,
      apiCallLog,
      maskedPan: maskPan(ctx.request.applicant.panNumber),
      maskedMobile: maskMobile(ctx.request.applicant.mobile),
      channelId: ctx.request.channel,
      processingTimeMs: response.processingTimeMs,
      timestamp: response.timestamp,
      engineVersion: ENGINE_VERSION,
    };

    const client = new BaseApiClient({
      apiId: 'API-020',
      provider: 'Audit Log Service',
      baseUrl: process.env.AUDIT_LOG_BASE_URL!,
      timeoutMs: parseInt(process.env.AUDIT_TIMEOUT_MS ?? '500'),
      maxRetries: 1,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/audit', entry)
    );

    if (!result.success) {
      // Audit failures are serious but must not block the response
      logger.error(`[Audit] Failed to persist audit log: ${result.error?.message}`);
      // In production: write to local file / dead-letter queue
    } else {
      logger.info(`[Audit] Logged auditId=${response.auditId}`);
    }
  }
}
