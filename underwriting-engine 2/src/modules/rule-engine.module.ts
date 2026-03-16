// ============================================================
// modules/rule-engine.module.ts
// Uses pure TypeScript ZenEvaluator (Vercel-compatible).
// Loads JDM JSON files, evaluates Hard Gates, Scorecard, Offer.
// ============================================================

import * as fs from 'fs';
import * as path from 'path';
import { ZenEvaluator, JdmGraph } from './zen-evaluator';
import {
  UnderwritingContext, HardGateResult, ScorecardResult,
  LoanOffer, ScorecardModuleScores,
  ZenEngineHardGateInput, ZenEngineScorecardInput, ZenEngineOfferInput,
  EmployerCategory
} from '../types';
import { logger } from '../utils/logger';

// ── Resolve rules directory — works locally AND on Vercel ─────
// Vercel sets cwd to /var/task; rules are bundled via vercel.json
const RULES_DIR = (() => {
  const candidates = [
    process.env.RULES_DIRECTORY,
    path.resolve(process.cwd(), 'rules'),
    path.resolve(__dirname, '../../rules'),
    path.resolve(__dirname, '../../../rules'),
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch { /* skip */ }
  }
  return path.resolve(process.cwd(), 'rules');
})();

export class RuleEngineModule {
  private evaluator     = new ZenEvaluator();
  private lastReloadTime = 0;

  constructor() {
    this.preloadAllRules();
    logger.info(`[RuleEngine] Initialized — rules dir: ${RULES_DIR}`);
  }

  private preloadAllRules(): void {
    const rulePaths: Record<string, string> = {
      'hard-gates/hard-gates.json': path.join(RULES_DIR, 'hard-gates', 'hard-gates.json'),
      'scorecard/scorecard.json':   path.join(RULES_DIR, 'scorecard',  'scorecard.json'),
      'offer/offer.json':           path.join(RULES_DIR, 'offer',       'offer.json'),
    };

    for (const [key, filePath] of Object.entries(rulePaths)) {
      this.loadRule(key, filePath);
    }
    this.lastReloadTime = Date.now();
  }

  private loadRule(key: string, filePath: string): void {
    try {
      const graph: JdmGraph = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      this.evaluator.loadGraph(key, graph);
      logger.info(`[RuleEngine] Loaded: ${key}`);
    } catch (err: any) {
      logger.error(`[RuleEngine] Cannot load ${key}: ${err.message}`);
      this.loadFallbackRule(key);
    }
  }

  private loadFallbackRule(key: string): void {
    const passthrough: JdmGraph = {
      nodes: [
        { id: 'input',  type: 'inputNode',  name: 'Input'  },
        { id: 'output', type: 'outputNode', name: 'Output' },
      ],
      edges: [{ id: 'e1', sourceId: 'input', targetId: 'output' }],
    };
    this.evaluator.loadGraph(key, passthrough);
    logger.warn(`[RuleEngine] Using passthrough fallback for: ${key}`);
  }

  // ── Hard Gates ──────────────────────────────────────────────

  async evaluateHardGates(ctx: UnderwritingContext): Promise<HardGateResult[]> {
    const { request, bureau, foir, appography, sms, location } = ctx;
    if (!bureau || !foir) throw new Error('Bureau and FOIR required for hard gate evaluation');

    const age        = calcAge(request.applicant.dateOfBirth);
    const maxTenure  = Math.max(0, (60 - age) * 12);

    const input: ZenEngineHardGateInput = {
      cibilScore:               bureau.cibilScore,
      dpd90Ever:                bureau.dpd90Ever,
      writtenOffOrSettledCount: bureau.writtenOffOrSettledCount,
      age,
      netMonthlySalary:         request.financials.netMonthlySalary,
      foirPostLoan:             foir.foirPostLoan,
      lendingAppsCount:         appography?.lendingAppsCount     ?? 0,
      bounceOrReturnCount:      sms?.bounceOrReturnCount         ?? 0,
      isNegativeZonePin:        location?.isNegativeZonePin      ?? false,
      hasCasinoBettingApp:      appography?.hasCasinoBettingApp  ?? false,
      dpd30Last6Months:         bureau.dpd30Last6Months,
      enquiriesLast30Days:      bureau.enquiriesLast30Days,
      cibilVintageMonths:       bureau.cibilVintageMonths,
      aaDataAvailable:          ctx.aa?.available                ?? false,
      requestedTenure:          request.loanRequest.requestedTenure,
      maxTenureByAge:           maxTenure,
    };

    logger.info(`[RuleEngine] Hard gates — appId=${request.applicationId} age=${age} cibil=${bureau.cibilScore}`);

    const { result } = this.evaluator.evaluate('hard-gates/hard-gates.json', input as any);
    return this.parseHardGateResult(result);
  }

  private parseHardGateResult(result: Record<string, unknown>): HardGateResult[] {
    const gates: HardGateResult[] = [];
    const nodeOutputs = (result.__nodeOutputs as any[]) ?? [];

    if (nodeOutputs.length > 0) {
      for (const out of nodeOutputs) {
        if (out.triggered === true || out.triggered === 'true') {
          gates.push({
            ruleId:   String(out.ruleId   ?? ''),
            ruleName: String(out.ruleName ?? ''),
            triggered: true,
          });
        }
      }
    } else if (result.triggered !== undefined) {
      gates.push({
        ruleId:    String(result.ruleId   ?? ''),
        ruleName:  String(result.ruleName ?? ''),
        triggered: result.triggered === true || result.triggered === 'true',
      });
    }

    return gates;
  }

  // ── Scorecard ────────────────────────────────────────────────

  async evaluateScorecard(ctx: UnderwritingContext): Promise<ScorecardResult> {
    const { request, bureau, foir, aa, appography, sms, telecom, location, employer } = ctx;
    if (!bureau || !foir) throw new Error('Bureau and FOIR required for scorecard');

    const resolvedCategory = (
      employer?.resolvedCategory ?? request.financials.employerCategory ?? EmployerCategory.CAT_C
    ).toString();

    const upiRatio = aa?.available && request.financials.netMonthlySalary > 0
      ? Math.min(aa.avgMonthlyCredit / request.financials.netMonthlySalary, 2)
      : 0;

    const input: ZenEngineScorecardInput = {
      cibilScore:               bureau.cibilScore,
      cibilVintageMonths:       bureau.cibilVintageMonths,
      dpd30Last6Months:         bureau.dpd30Last6Months,
      dpd60Last12Months:        bureau.dpd60Last12Months,
      enquiriesLast30Days:      bureau.enquiriesLast30Days,
      enquiriesLast90Days:      bureau.enquiriesLast90Days,
      creditUtilisationRatio:   bureau.creditUtilisationRatio,
      unsecuredToSecuredRatio:  bureau.unsecuredToSecuredRatio,
      unsecuredTradeLines:      bureau.unsecuredTradeLines,
      oldestTradeLineAgeMonths: bureau.oldestTradeLineAgeMonths,
      netMonthlySalary:         request.financials.netMonthlySalary,
      foirPostLoan:             foir.foirPostLoan,
      incomeVerified:           aa?.available ?? false,
      employerCategory:         resolvedCategory,
      employmentTenureMonths:   request.financials.employmentTenureMonths,
      salaryCreditMonthsLast6:  sms?.salaryCreditMonthsLast6     ?? 0,
      whatsappVintageMonths:    telecom?.whatsappVintageMonths   ?? 0,
      hasInvestmentApp:         appography?.hasInvestmentApp     ?? false,
      lendingAppsCount:         appography?.lendingAppsCount     ?? 0,
      upiInflowVsIncomeRatio:   upiRatio,
      hasActiveSip:             (aa?.activeSipAmount ?? 0) > 0,
      utilityPaymentCount:      sms?.utilityPaymentCount         ?? 0,
      mobileNumberVintageMonths: telecom?.mobileNumberVintageMonths ?? 0,
      avgBalance6MonthTrend:    aa?.balanceTrend                 ?? 'STABLE',
      homeLocationStable:       location?.homeLocationStable     ?? true,
      sameDeviceApplicationCount7Days: ctx.fraud?.sameDeviceApplicationCount7Days ?? 0,
      mobileFraudFlag:          ctx.fraud?.mobileFraudFlag       ?? false,
      locationVelocityFlag:     location?.locationVelocityFlag   ?? false,
    };

    logger.info(`[RuleEngine] Scorecard — appId=${request.applicationId}`);
    const { result } = this.evaluator.evaluate('scorecard/scorecard.json', input as any);
    const r = result as any;

    const moduleScores: ScorecardModuleScores = {
      bureauScore:          Number(r.bureauScore          ?? 0),
      bureauBehaviour:      Number(r.bureauBehaviour      ?? 0),
      incomeFoir:           Number(r.incomeFoir           ?? 0),
      employerDemographics: Number(r.employerBaseScore ?? 0) + Number(r.tenureBonus ?? 0),
      alternateBehavioural: Number(r.alternateBehavioural ?? 0),
      fraudRisk:            Number(r.fraudRisk            ?? 0),
      total:                Number(r.totalScore           ?? 0),
    };

    logger.info(`[RuleEngine] Score=${moduleScores.total} band=${r.scoreBand}`);

    return {
      moduleScores,
      scoreBand:          String(r.scoreBand ?? 'UNKNOWN'),
      hardGatesTriggered: ctx.scorecard?.hardGatesTriggered ?? [],
      softFlagsTriggered: this.computeSoftFlags(ctx, moduleScores),
    };
  }

  private computeSoftFlags(ctx: UnderwritingContext, scores: ScorecardModuleScores): string[] {
    const flags: string[] = [];
    const { bureau, appography, sms, telecom, location } = ctx;
    const lendApps = appography?.lendingAppsCount ?? 0;
    if (lendApps > 1 && lendApps <= 3)                        flags.push('R-ALT-04_LENDING_APPS_2_3');
    if ((bureau?.enquiriesLast90Days ?? 0) > 6)                flags.push('R-BUR-15B_HIGH_ENQUIRIES_90D');
    if ((bureau?.unsecuredToSecuredRatio ?? 0) > 2.0)          flags.push('R-BUR-06B_HIGH_UNSECURED_RATIO');
    if ((sms?.salaryCreditMonthsLast6 ?? 0) < 4)               flags.push('R-ALT-01_LOW_SALARY_CONSISTENCY');
    if ((telecom?.mnpChangeCount ?? 0) >= 3)                   flags.push('R-ALT-08_MULTIPLE_MNP_CHANGES');
    if ((location?.stateRiskScore ?? 0) > 70)                  flags.push('R-GEO-04A_HIGH_NPA_STATE');
    if (scores.alternateBehavioural < 60)                      flags.push('WEAK_ALTERNATE_DATA_PROFILE');
    return flags;
  }

  // ── Offer Generation ─────────────────────────────────────────

  async generateOffer(ctx: UnderwritingContext): Promise<LoanOffer | undefined> {
    const { request, foir, scorecard, location, employer } = ctx;
    if (!foir || !scorecard) return undefined;

    const resolvedCategory = (
      employer?.resolvedCategory ?? request.financials.employerCategory ?? EmployerCategory.CAT_C
    ).toString();

    const input: ZenEngineOfferInput = {
      scoreTotal:       scorecard.moduleScores.total,
      netMonthlySalary: request.financials.netMonthlySalary,
      employerCategory: resolvedCategory,
      foirPostLoan:     foir.foirPostLoan,
      maxAllowableEmi:  foir.maxAllowableEmi,
      requestedAmount:  request.loanRequest.requestedAmount,
      requestedTenure:  request.loanRequest.requestedTenure,
      pinTier:          location?.pinTier?.toString() ?? 'TIER_2',
      cibilScore:       ctx.bureau?.cibilScore ?? 0,
      baseInterestRate: parseFloat(process.env.BASE_INTEREST_RATE ?? '10.50'),
    };

    logger.info(`[RuleEngine] Offer — score=${scorecard.moduleScores.total}`);
    const { result } = this.evaluator.evaluate('offer/offer.json', input as any);
    const r = result as any;

    if (!r.approvedAmount || Number(r.approvedAmount) <= 0) return undefined;

    return {
      approvedAmount:       Number(r.approvedAmount),
      maxEligibleAmount:    Number(r.maxEligibleAmount),
      interestRate:         Number(r.interestRate),
      rateType:             'REDUCING_BALANCE',
      tenure:               Number(r.tenure ?? request.loanRequest.requestedTenure),
      emi:                  Number(r.emi),
      processingFee:        Number(r.processingFee),
      processingFeePercent: Number(r.processingFeePercent),
      totalInterestPayable: Number(r.totalInterestPayable),
      totalAmountPayable:   Number(r.totalAmountPayable),
      offerValidTill:       String(r.offerValidTill ?? ''),
    };
  }

  invalidateCache(): void {
    this.preloadAllRules();
    logger.info('[RuleEngine] Rules reloaded');
  }
}

function calcAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  return Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000));
}
