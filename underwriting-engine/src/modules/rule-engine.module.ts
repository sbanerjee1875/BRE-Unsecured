// ============================================================
// modules/rule-engine.module.ts
// GoRules ZEN Engine wrapper — loads JDM rules from disk,
// evaluates Hard Gates, Scorecard, and Offer modules
// ============================================================

import { ZenEngine } from '@gorules/zen-engine';
import * as fs from 'fs';
import * as path from 'path';
import {
  UnderwritingContext, HardGateResult, ScorecardResult,
  LoanOffer, ScorecardModuleScores, Decision,
  ZenEngineHardGateInput, ZenEngineScorecardInput, ZenEngineOfferInput,
  EmployerCategory
} from '../types';
import { logger } from '../utils/logger';

const RULES_DIR = path.resolve(process.env.RULES_DIRECTORY ?? './rules');

export class RuleEngineModule {
  private engine: ZenEngine;
  private rulesCache: Map<string, Buffer> = new Map();
  private lastReloadTime = 0;

  constructor() {
    // Loader function — reads JDM JSON from disk (or DB/S3 in production)
    const loader = async (key: string): Promise<Buffer> => {
      if (this.rulesCache.has(key) && this.isCacheValid()) {
        return this.rulesCache.get(key)!;
      }
      const filePath = path.join(RULES_DIR, key);
      logger.info(`[RuleEngine] Loading rule: ${filePath}`);
      const content = fs.readFileSync(filePath);
      this.rulesCache.set(key, content);
      this.lastReloadTime = Date.now();
      return content;
    };

    this.engine = new ZenEngine({ loader });
    logger.info('[RuleEngine] ZEN Engine initialized');
  }

  private isCacheValid(): boolean {
    const reloadInterval = parseInt(process.env.RULES_RELOAD_INTERVAL_MS ?? '60000');
    return Date.now() - this.lastReloadTime < reloadInterval;
  }

  // ── Phase 1: Hard Gate Evaluation ──────────────────────────

  async evaluateHardGates(ctx: UnderwritingContext): Promise<HardGateResult[]> {
    const { request, bureau, foir, appography, sms, location } = ctx;

    if (!bureau || !foir) {
      throw new Error('Bureau and FOIR data required for hard gate evaluation');
    }

    const dob = new Date(request.applicant.dateOfBirth);
    const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
    const maxTenureByAge = Math.max(0, (60 - age) * 12);

    const input: ZenEngineHardGateInput = {
      cibilScore: bureau.cibilScore,
      dpd90Ever: bureau.dpd90Ever,
      writtenOffOrSettledCount: bureau.writtenOffOrSettledCount,
      age,
      netMonthlySalary: request.financials.netMonthlySalary,
      foirPostLoan: foir.foirPostLoan,
      lendingAppsCount: appography?.lendingAppsCount ?? 0,
      bounceOrReturnCount: sms?.bounceOrReturnCount ?? 0,
      isNegativeZonePin: location?.isNegativeZonePin ?? false,
      hasCasinoBettingApp: appography?.hasCasinoBettingApp ?? false,
      dpd30Last6Months: bureau.dpd30Last6Months,
      enquiriesLast30Days: bureau.enquiriesLast30Days,
      cibilVintageMonths: bureau.cibilVintageMonths,
      aaDataAvailable: ctx.aa?.available ?? false,
      requestedTenure: request.loanRequest.requestedTenure,
      maxTenureByAge,
    };

    logger.info(`[RuleEngine] Evaluating hard gates for application ${request.applicationId}`);

    try {
      const result = await this.engine.evaluate('hard-gates/hard-gates.json', input);
      return this.parseHardGateResult(result.result);
    } catch (err: any) {
      logger.error(`[RuleEngine] Hard gate evaluation error: ${err.message}`);
      throw err;
    }
  }

  private parseHardGateResult(result: any): HardGateResult[] {
    const gates: HardGateResult[] = [];
    // ZEN engine returns array of outputs from all nodes
    const outputs = Array.isArray(result) ? result : [result];
    for (const output of outputs) {
      if (output && output.triggered !== undefined) {
        gates.push({
          ruleId: output.ruleId ?? '',
          ruleName: output.ruleName ?? '',
          triggered: output.triggered === true || output.triggered === 'true',
        });
      }
    }
    return gates;
  }

  // ── Phase 2: Scorecard Evaluation ──────────────────────────

  async evaluateScorecard(ctx: UnderwritingContext): Promise<ScorecardResult> {
    const { request, bureau, foir, aa, appography, sms, telecom, location, employer } = ctx;

    if (!bureau || !foir) throw new Error('Bureau and FOIR required for scorecard');

    const resolvedEmployerCategory = (
      employer?.resolvedCategory ?? request.financials.employerCategory ?? EmployerCategory.CAT_C
    ).toString();

    const upiInflowVsIncomeRatio =
      aa?.available && request.financials.netMonthlySalary > 0
        ? Math.min(aa.avgMonthlyCredit / request.financials.netMonthlySalary, 2)
        : 0;

    const input: ZenEngineScorecardInput = {
      // Bureau
      cibilScore: bureau.cibilScore,
      cibilVintageMonths: bureau.cibilVintageMonths,
      dpd30Last6Months: bureau.dpd30Last6Months,
      dpd60Last12Months: bureau.dpd60Last12Months,
      enquiriesLast30Days: bureau.enquiriesLast30Days,
      enquiriesLast90Days: bureau.enquiriesLast90Days,
      creditUtilisationRatio: bureau.creditUtilisationRatio,
      unsecuredToSecuredRatio: bureau.unsecuredToSecuredRatio,
      unsecuredTradeLines: bureau.unsecuredTradeLines,
      oldestTradeLineAgeMonths: bureau.oldestTradeLineAgeMonths,
      // Income
      netMonthlySalary: request.financials.netMonthlySalary,
      foirPostLoan: foir.foirPostLoan,
      incomeVerified: aa?.available ?? false,
      // Employer
      employerCategory: resolvedEmployerCategory,
      employmentTenureMonths: request.financials.employmentTenureMonths,
      // Alternate
      salaryCreditMonthsLast6: sms?.salaryCreditMonthsLast6 ?? 0,
      whatsappVintageMonths: telecom?.whatsappVintageMonths ?? 0,
      hasInvestmentApp: appography?.hasInvestmentApp ?? false,
      lendingAppsCount: appography?.lendingAppsCount ?? 0,
      upiInflowVsIncomeRatio,
      hasActiveSip: (aa?.activeSipAmount ?? 0) > 0,
      utilityPaymentCount: sms?.utilityPaymentCount ?? 0,
      mobileNumberVintageMonths: telecom?.mobileNumberVintageMonths ?? 0,
      avgBalance6MonthTrend: aa?.balanceTrend ?? 'STABLE',
      homeLocationStable: location?.homeLocationStable ?? true,
      // Fraud
      sameDeviceApplicationCount7Days: ctx.fraud?.sameDeviceApplicationCount7Days ?? 0,
      mobileFraudFlag: ctx.fraud?.mobileFraudFlag ?? false,
      locationVelocityFlag: location?.locationVelocityFlag ?? false,
    };

    logger.info(`[RuleEngine] Evaluating scorecard for application ${request.applicationId}`);

    const result = await this.engine.evaluate('scorecard/scorecard.json', input);
    const r = result.result as any;

    const moduleScores: ScorecardModuleScores = {
      bureauScore: r.bureauScore ?? 0,
      bureauBehaviour: r.bureauBehaviour ?? 0,
      incomeFoir: r.incomeFoir ?? 0,
      employerDemographics: (r.employerBaseScore ?? 0) + (r.tenureBonus ?? 0),
      alternateBehavioural: r.alternateBehavioural ?? 0,
      fraudRisk: r.fraudRisk ?? 0,
      total: r.totalScore ?? 0,
    };

    const softFlags = this.computeSoftFlags(ctx, moduleScores);

    return {
      moduleScores,
      scoreBand: r.scoreBand ?? 'UNKNOWN',
      hardGatesTriggered: ctx.scorecard?.hardGatesTriggered ?? [],
      softFlagsTriggered: softFlags,
    };
  }

  private computeSoftFlags(ctx: UnderwritingContext, scores: ScorecardModuleScores): string[] {
    const flags: string[] = [];
    const { bureau, appography, sms, telecom, location } = ctx;

    if ((appography?.lendingAppsCount ?? 0) > 1 && (appography?.lendingAppsCount ?? 0) <= 3) {
      flags.push('R-ALT-04_LENDING_APPS_2_3');
    }
    if ((bureau?.enquiriesLast90Days ?? 0) > 6) {
      flags.push('R-BUR-15B_HIGH_ENQUIRIES_90D');
    }
    if ((bureau?.unsecuredToSecuredRatio ?? 0) > 2.0) {
      flags.push('R-BUR-06B_HIGH_UNSECURED_RATIO');
    }
    if ((sms?.salaryCreditMonthsLast6 ?? 0) < 4) {
      flags.push('R-ALT-01_LOW_SALARY_CONSISTENCY');
    }
    if ((telecom?.mnpChangeCount ?? 0) >= 3) {
      flags.push('R-ALT-08_MULTIPLE_MNP_CHANGES');
    }
    if (location?.stateRiskScore && location.stateRiskScore > 70) {
      flags.push('R-GEO-04A_HIGH_NPA_STATE');
    }
    if (scores.alternateBehavioural < 60) {
      flags.push('WEAK_ALTERNATE_DATA_PROFILE');
    }

    return flags;
  }

  // ── Phase 3: Offer Generation ─────────────────────────────

  async generateOffer(ctx: UnderwritingContext): Promise<LoanOffer | undefined> {
    const { request, foir, scorecard, location, employer } = ctx;

    if (!foir || !scorecard) return undefined;

    const resolvedEmployerCategory = (
      employer?.resolvedCategory ?? request.financials.employerCategory ?? EmployerCategory.CAT_C
    ).toString();

    const input: ZenEngineOfferInput = {
      scoreTotal: scorecard.moduleScores.total,
      netMonthlySalary: request.financials.netMonthlySalary,
      employerCategory: resolvedEmployerCategory,
      foirPostLoan: foir.foirPostLoan,
      maxAllowableEmi: foir.maxAllowableEmi,
      requestedAmount: request.loanRequest.requestedAmount,
      requestedTenure: request.loanRequest.requestedTenure,
      pinTier: location?.pinTier?.toString() ?? 'TIER_2',
      cibilScore: ctx.bureau?.cibilScore ?? 0,
      baseInterestRate: parseFloat(process.env.BASE_INTEREST_RATE ?? '10.50'),
    };

    logger.info(`[RuleEngine] Generating offer for application ${request.applicationId}`);

    const result = await this.engine.evaluate('offer/offer.json', input);
    const r = result.result as any;

    return {
      approvedAmount: r.approvedAmount ?? 0,
      maxEligibleAmount: r.maxEligibleAmount ?? 0,
      interestRate: r.interestRate ?? 0,
      rateType: 'REDUCING_BALANCE',
      tenure: r.tenure ?? request.loanRequest.requestedTenure,
      emi: r.emi ?? 0,
      processingFee: r.processingFee ?? 0,
      processingFeePercent: r.processingFeePercent ?? 0,
      totalInterestPayable: r.totalInterestPayable ?? 0,
      totalAmountPayable: r.totalAmountPayable ?? 0,
      offerValidTill: r.offerValidTill ?? '',
    };
  }

  // Force reload rules (e.g., after credit policy update)
  invalidateCache(): void {
    this.rulesCache.clear();
    this.lastReloadTime = 0;
    logger.info('[RuleEngine] Rule cache invalidated — next evaluation will reload from disk');
  }
}
