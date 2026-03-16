// ============================================================
// modules/underwriting.pipeline.ts
// Master orchestrator — coordinates all API calls and
// rule engine phases in the correct sequence
// ============================================================

import {
  UnderwritingRequest, UnderwritingResponse, UnderwritingContext,
  Decision, DataAvailabilitySummary, BureauSource, PipelineError,
  AuditLogEntry, ApiCallLogEntry
} from '../types';
import { BureauIntegration } from '../integrations/bureau.integration';
import {
  KycIntegration, AccountAggregatorIntegration, AppographyIntegration,
  SmsIntegration, TelecomIntegration, LocationIntegration,
  EmployerIntegration, FraudIntegration
} from '../integrations/data-sources.integration';
import { FoirCalculator } from './foir.module';
import { RuleEngineModule } from './rule-engine.module';
import { AuditModule } from './audit.module';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { maskPan, maskMobile } from '../utils/masking';

export class UnderwritingPipeline {
  private bureauIntegration = new BureauIntegration();
  private kycIntegration = new KycIntegration();
  private aaIntegration = new AccountAggregatorIntegration();
  private appographyIntegration = new AppographyIntegration();
  private smsIntegration = new SmsIntegration();
  private telecomIntegration = new TelecomIntegration();
  private locationIntegration = new LocationIntegration();
  private employerIntegration = new EmployerIntegration();
  private fraudIntegration = new FraudIntegration();
  private foirCalculator = new FoirCalculator();
  private ruleEngine = new RuleEngineModule();
  private auditModule = new AuditModule();

  async process(request: UnderwritingRequest): Promise<UnderwritingResponse> {
    const startTime = Date.now();
    const auditId = uuidv4();

    logger.info(`[Pipeline] START applicationId=${request.applicationId} channel=${request.channel}`);

    const ctx: UnderwritingContext = {
      request,
      startTime,
      errors: [],
    };

    try {
      // ── PHASE 1: Identity Verification (Sequential) ────────
      logger.info(`[Pipeline] Phase 1 — KYC`);
      ctx.kyc = await this.runWithErrorCapture(
        () => this.kycIntegration.verifyKyc(request),
        ctx, 'KYC', 'API-004/005'
      );

      if (!ctx.kyc?.panVerified) {
        return this.buildDeclineResponse(ctx, auditId, 'D000', 'KYC_PAN_VERIFICATION_FAILED', startTime);
      }

      // ── PHASE 2: Bureau + Financial Data (Parallel) ────────
      logger.info(`[Pipeline] Phase 2 — Bureau + Financial (parallel)`);
      const [bureauResult, aaResult, appResult, smsResult] = await Promise.allSettled([
        this.runWithErrorCapture(() => this.bureauIntegration.fetchBureauData(request), ctx, 'BUREAU', 'API-001/003'),
        this.runWithErrorCapture(() => this.aaIntegration.fetchFinancialData(request), ctx, 'AA', 'API-006'),
        this.runWithErrorCapture(() => this.appographyIntegration.fetchAppSignals(request), ctx, 'APPOGRAPHY', 'API-009'),
        this.runWithErrorCapture(() => this.smsIntegration.fetchSmsSignals(request), ctx, 'SMS', 'API-010'),
      ]);

      ctx.bureau = this.extractResult(bureauResult);
      ctx.aa = this.extractResult(aaResult) ?? { available: false, monthlySummaries: [], avgMonthlyCredit: 0, avgMonthlyEmiDebit: 0, salaryConsistencyScore: 0, hasBounce: false, activeSipAmount: 0, avgBalance6Month: 0, balanceTrend: 'STABLE', overdraftUsageCount: 0 };
      ctx.appography = this.extractResult(appResult);
      ctx.sms = this.extractResult(smsResult);

      if (!ctx.bureau) {
        return this.buildDeclineResponse(ctx, auditId, 'D001', 'BUREAU_DATA_UNAVAILABLE', startTime);
      }

      // ── PHASE 3: Alternate + Enrichment Data (Parallel) ───
      logger.info(`[Pipeline] Phase 3 — Alternate + enrichment (parallel)`);
      const [telecomResult, locationResult, employerResult, fraudResult] = await Promise.allSettled([
        this.runWithErrorCapture(() => this.telecomIntegration.fetchTelecomSignals(request), ctx, 'TELECOM', 'API-011'),
        this.runWithErrorCapture(() => this.locationIntegration.fetchLocationData(request), ctx, 'LOCATION', 'API-012/013'),
        this.runWithErrorCapture(() => this.employerIntegration.verifyEmployer(request), ctx, 'EMPLOYER', 'API-014'),
        this.runWithErrorCapture(() => this.fraudIntegration.checkFraud(request), ctx, 'FRAUD', 'API-016'),
      ]);

      ctx.telecom = this.extractResult(telecomResult);
      ctx.location = this.extractResult(locationResult);
      ctx.employer = this.extractResult(employerResult);
      ctx.fraud = this.extractResult(fraudResult);

      // ── PHASE 4: FOIR Calculation ─────────────────────────
      logger.info(`[Pipeline] Phase 4 — FOIR calculation`);
      ctx.foir = this.foirCalculator.calculate({
        netMonthlySalary: request.financials.netMonthlySalary,
        bureau: ctx.bureau,
        aa: ctx.aa,
        loanRequest: request.loanRequest,
      });

      // ── PHASE 5: Hard Gate Evaluation ─────────────────────
      logger.info(`[Pipeline] Phase 5 — Hard gates`);
      const hardGates = await this.ruleEngine.evaluateHardGates(ctx);
      const triggeredGates = hardGates.filter((g) => g.triggered);

      if (triggeredGates.length > 0) {
        const primaryGate = triggeredGates[0];
        logger.warn(`[Pipeline] Hard gate triggered: ${primaryGate.ruleId}`);
        return this.buildDeclineResponse(
          ctx, auditId, primaryGate.ruleId, primaryGate.ruleName, startTime,
          triggeredGates
        );
      }

      // ── PHASE 6: Scorecard ────────────────────────────────
      logger.info(`[Pipeline] Phase 6 — Scorecard evaluation`);
      ctx.scorecard = await this.ruleEngine.evaluateScorecard(ctx);
      ctx.scorecard.hardGatesTriggered = hardGates;

      const totalScore = ctx.scorecard.moduleScores.total;
      logger.info(`[Pipeline] Score: ${totalScore} | Band: ${ctx.scorecard.scoreBand}`);

      // Score too low — decline
      if (totalScore < 400) {
        return this.buildDeclineResponse(ctx, auditId, 'D002', 'SCORE_BELOW_MINIMUM_THRESHOLD', startTime);
      }

      // Refer to manual underwriting
      if (totalScore < 500) {
        return this.buildReferResponse(ctx, auditId, 'R001', 'SCORE_BAND_400_499_REFER', startTime);
      }

      // ── PHASE 7: Offer Generation ─────────────────────────
      logger.info(`[Pipeline] Phase 7 — Offer generation`);
      const offer = await this.ruleEngine.generateOffer(ctx);

      if (!offer || offer.approvedAmount <= 0) {
        return this.buildDeclineResponse(ctx, auditId, 'D003', 'OFFER_AMOUNT_ZERO', startTime);
      }

      // ── PHASE 8: Build Response ───────────────────────────
      const processingTimeMs = Date.now() - startTime;
      logger.info(`[Pipeline] APPROVE applicationId=${request.applicationId} amount=${offer.approvedAmount} rate=${offer.interestRate}% time=${processingTimeMs}ms`);

      const response: UnderwritingResponse = {
        applicationId: request.applicationId,
        decision: Decision.APPROVE,
        decisionCode: ctx.scorecard.scoreBand,
        decisionReason: this.getDecisionReason(totalScore),
        scorecard: ctx.scorecard,
        offer,
        foirSummary: ctx.foir,
        dataAvailability: this.buildDataAvailability(ctx),
        hardGatesTriggered: hardGates,
        softFlagsTriggered: ctx.scorecard.softFlagsTriggered,
        auditId,
        processingTimeMs,
        timestamp: new Date().toISOString(),
      };

      // Async audit log — do not await
      this.auditModule.log(response, ctx, this.collectCallLogs()).catch((err) =>
        logger.error(`[Audit] Failed to log: ${err.message}`)
      );

      return response;

    } catch (err: any) {
      logger.error(`[Pipeline] Unhandled error: ${err.message}`, { stack: err.stack });
      return this.buildDeclineResponse(ctx, auditId, 'D999', 'SYSTEM_ERROR', startTime);
    }
  }

  // ──────────────────────────────────────────────────────────
  // Response builders
  // ──────────────────────────────────────────────────────────

  private buildDeclineResponse(
    ctx: UnderwritingContext,
    auditId: string,
    decisionCode: string,
    reason: string,
    startTime: number,
    hardGates: any[] = []
  ): UnderwritingResponse {
    const processingTimeMs = Date.now() - startTime;
    logger.info(`[Pipeline] DECLINE applicationId=${ctx.request.applicationId} code=${decisionCode} reason=${reason}`);

    const response: UnderwritingResponse = {
      applicationId: ctx.request.applicationId,
      decision: Decision.DECLINE,
      decisionCode,
      decisionReason: reason,
      scorecard: ctx.scorecard ?? this.emptyScorecard(),
      foirSummary: ctx.foir ?? this.emptyFoir(ctx.request),
      dataAvailability: this.buildDataAvailability(ctx),
      hardGatesTriggered: hardGates,
      softFlagsTriggered: [],
      auditId,
      processingTimeMs,
      timestamp: new Date().toISOString(),
    };

    this.auditModule.log(response, ctx, this.collectCallLogs()).catch(() => {});
    return response;
  }

  private buildReferResponse(
    ctx: UnderwritingContext,
    auditId: string,
    decisionCode: string,
    reason: string,
    startTime: number
  ): UnderwritingResponse {
    const processingTimeMs = Date.now() - startTime;
    logger.info(`[Pipeline] REFER applicationId=${ctx.request.applicationId} code=${decisionCode}`);

    const response: UnderwritingResponse = {
      applicationId: ctx.request.applicationId,
      decision: Decision.REFER,
      decisionCode,
      decisionReason: reason,
      scorecard: ctx.scorecard ?? this.emptyScorecard(),
      foirSummary: ctx.foir ?? this.emptyFoir(ctx.request),
      dataAvailability: this.buildDataAvailability(ctx),
      hardGatesTriggered: [],
      softFlagsTriggered: ctx.scorecard?.softFlagsTriggered ?? [],
      auditId,
      processingTimeMs,
      timestamp: new Date().toISOString(),
    };

    this.auditModule.log(response, ctx, this.collectCallLogs()).catch(() => {});
    return response;
  }

  // ──────────────────────────────────────────────────────────
  // Utilities
  // ──────────────────────────────────────────────────────────

  private async runWithErrorCapture<T>(
    fn: () => Promise<T>,
    ctx: UnderwritingContext,
    stage: string,
    apiId: string
  ): Promise<T | undefined> {
    try {
      return await fn();
    } catch (err: any) {
      const error: PipelineError = {
        stage, apiId,
        message: err.message,
        code: err.code ?? 'UNKNOWN',
        timestamp: new Date().toISOString(),
        fallbackUsed: false,
      };
      ctx.errors.push(error);
      logger.warn(`[Pipeline] Non-fatal error in ${stage}: ${err.message}`);
      return undefined;
    }
  }

  private extractResult<T>(settled: PromiseSettledResult<T | undefined>): T | undefined {
    if (settled.status === 'fulfilled') return settled.value;
    return undefined;
  }

  private buildDataAvailability(ctx: UnderwritingContext): DataAvailabilitySummary {
    return {
      bureauSource: ctx.bureau?.bureauSource ?? BureauSource.CIBIL,
      bureauFallbackUsed: ctx.bureau?.bureauSource === BureauSource.EXPERIAN,
      aaDataAvailable: ctx.aa?.available ?? false,
      smsDataAvailable: ctx.sms?.available ?? false,
      appographyAvailable: ctx.appography?.available ?? false,
      locationDataAvailable: ctx.location?.available ?? false,
      employerVerified: ctx.employer?.employerVerified ?? false,
      itrDataAvailable: false,
    };
  }

  private collectCallLogs(): ApiCallLogEntry[] {
    return [
      ...this.bureauIntegration.callLog,
      ...this.kycIntegration.callLog,
      ...this.aaIntegration.callLog,
      ...this.appographyIntegration.callLog,
      ...this.smsIntegration.callLog,
      ...this.telecomIntegration.callLog,
      ...this.locationIntegration.callLog,
      ...this.employerIntegration.callLog,
      ...this.fraudIntegration.callLog,
    ];
  }

  private getDecisionReason(score: number): string {
    if (score >= 800) return 'AUTO_APPROVED_SUPER_PRIME';
    if (score >= 700) return 'AUTO_APPROVED_PRIME';
    if (score >= 600) return 'AUTO_APPROVED_STANDARD';
    return 'CONDITIONAL_APPROVED';
  }

  private emptyScorecard() {
    return {
      moduleScores: { bureauScore: 0, bureauBehaviour: 0, incomeFoir: 0, employerDemographics: 0, alternateBehavioural: 0, fraudRisk: 0, total: 0 },
      scoreBand: 'N/A',
      hardGatesTriggered: [],
      softFlagsTriggered: [],
    };
  }

  private emptyFoir(request: UnderwritingRequest) {
    return {
      existingMonthlyEmi: 0, proposedNewEmi: 0,
      netMonthlyIncome: request.financials.netMonthlySalary,
      foirPreLoan: 0, foirPostLoan: 0, foirBreached: false,
      maxAllowableEmi: 0, maxLoanAmountByFoir: 0,
    };
  }
}
