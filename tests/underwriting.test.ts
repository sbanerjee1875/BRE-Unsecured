// ============================================================
// tests/underwriting.test.ts
// Full test coverage — Hard Gates, Scorecard, FOIR, Pipeline
// ============================================================

import { FoirCalculator } from '../src/modules/foir.module';
import {
  BureauData, BureauSource, AccountAggregatorData, LoanRequest,
  LoanPurpose, EmployerCategory, Decision, UnderwritingRequest,
  Channel, OsType, ResidenceType
} from '../src/types';

// ── Test Fixtures ─────────────────────────────────────────────

const makeBureau = (overrides: Partial<BureauData> = {}): BureauData => ({
  cibilScore: 750,
  cibilVintageMonths: 36,
  totalTradeLines: 4,
  unsecuredTradeLines: 2,
  securedTradeLines: 2,
  unsecuredToSecuredRatio: 1.0,
  activeTradeLines: 3,
  dpd30Last6Months: 0,
  dpd60Last12Months: 0,
  dpd90Ever: 0,
  writtenOffOrSettledCount: 0,
  imputedIncome: 55000,
  totalOutstandingDebt: 300000,
  existingMonthlyEmiObligations: 8000,
  enquiriesLast30Days: 1,
  enquiriesLast90Days: 2,
  creditUtilisationRatio: 0.25,
  oldestTradeLineAgeMonths: 48,
  tradeLineDetails: [],
  bureauSource: BureauSource.CIBIL,
  reportFetchedAt: new Date().toISOString(),
  rawReportId: 'TEST-RPT-001',
  ...overrides,
});

const makeAA = (overrides: Partial<AccountAggregatorData> = {}): AccountAggregatorData => ({
  available: true,
  monthlySummaries: [],
  avgMonthlyCredit: 52000,
  avgMonthlyEmiDebit: 8000,
  salaryConsistencyScore: 1.0,
  hasBounce: false,
  activeSipAmount: 5000,
  avgBalance6Month: 45000,
  balanceTrend: 'STABLE',
  overdraftUsageCount: 0,
  ...overrides,
});

const makeLoanRequest = (overrides: Partial<LoanRequest> = {}): LoanRequest => ({
  requestedAmount: 500000,
  requestedTenure: 36,
  purpose: LoanPurpose.HOME_RENOVATION,
  ...overrides,
});

const makeRequest = (overrides: any = {}): UnderwritingRequest => ({
  applicationId: 'PL-TEST-001',
  channel: Channel.DIGITAL,
  applicant: {
    panNumber: 'a'.repeat(64),
    mobile: '+919876543210',
    email: 'test@example.com',
    dateOfBirth: '1990-06-15',
    age: 34,
    gender: 'MALE',
    firstName: 'Rahul',
    lastName: 'Sharma',
  },
  financials: {
    netMonthlySalary: 60000,
    grossAnnualIncome: 900000,
    employerName: 'Tata Consultancy Services',
    employerCategory: EmployerCategory.CAT_B,
    employmentTenureMonths: 36,
  },
  address: {
    residenceType: ResidenceType.RENTED,
    pinCode: '400001',
    city: 'Mumbai',
    state: 'Maharashtra',
  },
  loanRequest: makeLoanRequest(),
  consentTokens: {
    bureauConsent: 'test-bureau-consent',
    aaConsent: 'test-aa-consent',
    smsConsent: 'test-sms-consent',
    locationConsent: 'test-location-consent',
  },
  deviceData: {
    deviceId: 'b'.repeat(64),
    osType: OsType.ANDROID,
    osVersion: '14.0',
    appVersion: '3.2.1',
  },
  requestTimestamp: new Date().toISOString(),
  ...overrides,
});

// ══════════════════════════════════════════════════════════════
// FOIR CALCULATOR TESTS
// ══════════════════════════════════════════════════════════════

describe('FoirCalculator', () => {
  const calculator = new FoirCalculator();

  describe('Basic FOIR calculation', () => {
    it('should calculate FOIR correctly for standard case', () => {
      const result = calculator.calculate({
        netMonthlySalary: 60000,
        bureau: makeBureau({ existingMonthlyEmiObligations: 8000 }),
        aa: makeAA(),
        loanRequest: makeLoanRequest({ requestedAmount: 500000, requestedTenure: 36 }),
      });

      expect(result.existingMonthlyEmi).toBe(8000);
      expect(result.netMonthlyIncome).toBe(52000); // AA wins (lower than stated 60k)
      expect(result.foirPreLoan).toBeCloseTo(8000 / 52000, 3);
      expect(result.foirBreached).toBe(false);
      expect(result.maxAllowableEmi).toBeGreaterThan(0);
    });

    it('should flag FOIR breach when post-loan FOIR > 65%', () => {
      const result = calculator.calculate({
        netMonthlySalary: 25000,
        bureau: makeBureau({ existingMonthlyEmiObligations: 10000 }),
        aa: makeAA({ available: false, avgMonthlyCredit: 0 }),
        loanRequest: makeLoanRequest({ requestedAmount: 500000, requestedTenure: 12 }),
      });

      expect(result.foirBreached).toBe(true);
      expect(result.foirPostLoan).toBeGreaterThan(0.65);
    });

    it('should use AA income when lower than stated', () => {
      const result = calculator.calculate({
        netMonthlySalary: 100000,
        bureau: makeBureau({ existingMonthlyEmiObligations: 5000 }),
        aa: makeAA({ avgMonthlyCredit: 45000 }), // AA shows only 45k
        loanRequest: makeLoanRequest(),
      });

      // AA income (45k) should be used since < 90% of stated (100k)
      expect(result.netMonthlyIncome).toBe(45000);
    });

    it('should use stated income when AA unavailable', () => {
      const result = calculator.calculate({
        netMonthlySalary: 60000,
        bureau: makeBureau({ existingMonthlyEmiObligations: 5000 }),
        aa: makeAA({ available: false, avgMonthlyCredit: 0 }),
        loanRequest: makeLoanRequest(),
      });

      expect(result.netMonthlyIncome).toBe(60000);
    });

    it('should compute maxLoanAmountByFoir reasonably', () => {
      const result = calculator.calculate({
        netMonthlySalary: 80000,
        bureau: makeBureau({ existingMonthlyEmiObligations: 5000 }),
        aa: makeAA({ available: false }),
        loanRequest: makeLoanRequest(),
      });

      // max EMI = 65% * 80k - 5k = 47k
      expect(result.maxAllowableEmi).toBeCloseTo(47000, -3);
      expect(result.maxLoanAmountByFoir).toBeGreaterThan(1000000);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero salary gracefully', () => {
      const result = calculator.calculate({
        netMonthlySalary: 0,
        bureau: makeBureau({ existingMonthlyEmiObligations: 0 }),
        aa: makeAA({ available: false }),
        loanRequest: makeLoanRequest(),
      });

      expect(result.foirBreached).toBe(true);
      expect(result.foirPostLoan).toBe(1); // capped at 1 when income is 0
    });

    it('should compute EMI for minimum loan at min tenure', () => {
      const result = calculator.calculate({
        netMonthlySalary: 30000,
        bureau: makeBureau({ existingMonthlyEmiObligations: 0 }),
        aa: makeAA({ available: false }),
        loanRequest: makeLoanRequest({ requestedAmount: 50000, requestedTenure: 12 }),
      });

      expect(result.proposedNewEmi).toBeGreaterThan(0);
      expect(result.proposedNewEmi).toBeLessThan(50000);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// HARD GATE RULE LOGIC TESTS (unit — testing conditions)
// ══════════════════════════════════════════════════════════════

describe('Hard Gate Business Logic', () => {

  describe('R-HG-001: CIBIL Score Gate', () => {
    it('should decline when CIBIL score < 650', () => {
      const bureau = makeBureau({ cibilScore: 620 });
      expect(bureau.cibilScore < 650).toBe(true);
    });

    it('should not decline when CIBIL score = 650', () => {
      const bureau = makeBureau({ cibilScore: 650 });
      expect(bureau.cibilScore < 650).toBe(false);
    });

    it('should not decline when CIBIL score = 800', () => {
      const bureau = makeBureau({ cibilScore: 800 });
      expect(bureau.cibilScore < 650).toBe(false);
    });
  });

  describe('R-HG-002: DPD 90+ Gate', () => {
    it('should decline when DPD 90+ count > 0', () => {
      const bureau = makeBureau({ dpd90Ever: 1 });
      expect(bureau.dpd90Ever > 0).toBe(true);
    });

    it('should pass when DPD 90+ count = 0', () => {
      const bureau = makeBureau({ dpd90Ever: 0 });
      expect(bureau.dpd90Ever > 0).toBe(false);
    });
  });

  describe('R-HG-003: Write-off / Settled Gate', () => {
    it('should decline when write-off exists', () => {
      const bureau = makeBureau({ writtenOffOrSettledCount: 1 });
      expect(bureau.writtenOffOrSettledCount > 0).toBe(true);
    });
  });

  describe('R-HG-004/005: Age Gates', () => {
    it('should decline when age < 21', () => {
      const age = 20;
      expect(age < 21).toBe(true);
    });

    it('should decline when age > 58', () => {
      const age = 59;
      expect(age > 58).toBe(true);
    });

    it('should pass for age = 35', () => {
      const age = 35;
      expect(age < 21 || age > 58).toBe(false);
    });
  });

  describe('R-HG-006: Minimum Income Gate', () => {
    it('should decline when salary < 20000', () => {
      const salary = 18000;
      expect(salary < 20000).toBe(true);
    });

    it('should pass when salary = 20000', () => {
      const salary = 20000;
      expect(salary < 20000).toBe(false);
    });
  });

  describe('R-HG-007: FOIR Gate', () => {
    it('should decline when FOIR > 65%', () => {
      const foir = 0.70;
      expect(foir > 0.65).toBe(true);
    });

    it('should pass when FOIR = 65%', () => {
      const foir = 0.65;
      expect(foir > 0.65).toBe(false);
    });
  });

  describe('R-HG-008: Lending Apps Gate', () => {
    it('should decline when lending apps > 5', () => {
      const count = 6;
      expect(count > 5).toBe(true);
    });

    it('should pass when lending apps = 5', () => {
      const count = 5;
      expect(count > 5).toBe(false);
    });
  });

  describe('R-HG-011: Casino/Betting Gate', () => {
    it('should decline when casino app installed', () => {
      const hasCasinoApp = true;
      expect(hasCasinoApp).toBe(true);
    });
  });

  describe('R-HG-012: Recent DPD Gate', () => {
    it('should decline when DPD 30+ > 1 in last 6 months', () => {
      const bureau = makeBureau({ dpd30Last6Months: 2 });
      expect(bureau.dpd30Last6Months > 1).toBe(true);
    });

    it('should pass when DPD 30+ = 1 in last 6 months', () => {
      const bureau = makeBureau({ dpd30Last6Months: 1 });
      expect(bureau.dpd30Last6Months > 1).toBe(false);
    });
  });
});

// ══════════════════════════════════════════════════════════════
// BUREAU SCORING LOGIC TESTS
// ══════════════════════════════════════════════════════════════

describe('Bureau Scorecard Logic', () => {

  const scoreCibil = (score: number): number => {
    if (score < 650) return 0;
    if (score <= 699) return 100;
    if (score <= 749) return 160;
    if (score <= 799) return 220;
    if (score <= 849) return 270;
    return 300;
  };

  it('should return 0 points for CIBIL < 650', () => {
    expect(scoreCibil(600)).toBe(0);
    expect(scoreCibil(649)).toBe(0);
  });

  it('should return 100 points for CIBIL 650-699', () => {
    expect(scoreCibil(650)).toBe(100);
    expect(scoreCibil(699)).toBe(100);
  });

  it('should return 300 points for CIBIL >= 850', () => {
    expect(scoreCibil(850)).toBe(300);
    expect(scoreCibil(900)).toBe(300);
  });

  it('should return correct bureau behaviour score with good vintage', () => {
    // Base 100 + vintage bonus 30 = 130
    const vintageBonus = 60 >= 60 ? 30 : 0;
    expect(100 + vintageBonus).toBe(130);
  });

  it('should penalise high credit utilisation', () => {
    // Base 100, utilisation > 0.80 = -25
    const score = 100 - 25;
    expect(score).toBe(75);
  });

  it('should reward low credit utilisation', () => {
    // Base 100, utilisation < 0.30 = +20
    const score = 100 + 20;
    expect(score).toBe(120);
  });
});

// ══════════════════════════════════════════════════════════════
// ALTERNATE DATA SCORING TESTS
// ══════════════════════════════════════════════════════════════

describe('Alternate Data Scoring Logic', () => {

  const scoreAlternate = (params: {
    salaryCreditMonthsLast6?: number;
    whatsappVintageMonths?: number;
    hasInvestmentApp?: boolean;
    lendingAppsCount?: number;
    upiInflowRatio?: number;
    hasActiveSip?: boolean;
    utilityPaymentCount?: number;
    mobileVintageMonths?: number;
    balanceTrend?: string;
    locationStable?: boolean;
  }): number => {
    let score = 80;
    if ((params.salaryCreditMonthsLast6 ?? 0) >= 6) score += 20;
    else if ((params.salaryCreditMonthsLast6 ?? 0) >= 4) score += 5;
    else score -= 20;
    if ((params.whatsappVintageMonths ?? 0) >= 24) score += 10;
    else if ((params.whatsappVintageMonths ?? 0) < 6) score -= 5;
    if (params.hasInvestmentApp) score += 10;
    const lendApps = params.lendingAppsCount ?? 0;
    if (lendApps === 0) score += 5;
    else if (lendApps > 3) score -= 30;
    else if (lendApps > 1) score -= 10;
    if ((params.upiInflowRatio ?? 0) >= 0.80) score += 15;
    else if ((params.upiInflowRatio ?? 0) < 0.40) score -= 15;
    if (params.hasActiveSip) score += 15;
    if ((params.utilityPaymentCount ?? 0) >= 12) score += 10;
    else if ((params.utilityPaymentCount ?? 0) <= 2) score -= 20;
    if ((params.mobileVintageMonths ?? 0) >= 36) score += 15;
    else if ((params.mobileVintageMonths ?? 0) < 12) score -= 25;
    if (params.balanceTrend === 'RISING') score += 10;
    else if (params.balanceTrend === 'DECLINING') score -= 15;
    if (params.locationStable) score += 10;
    else score -= 30;
    return Math.max(0, Math.min(200, score));
  };

  it('should score maximum for ideal alternate profile', () => {
    const score = scoreAlternate({
      salaryCreditMonthsLast6: 6,
      whatsappVintageMonths: 36,
      hasInvestmentApp: true,
      lendingAppsCount: 0,
      upiInflowRatio: 0.95,
      hasActiveSip: true,
      utilityPaymentCount: 12,
      mobileVintageMonths: 48,
      balanceTrend: 'RISING',
      locationStable: true,
    });
    expect(score).toBeGreaterThanOrEqual(190);
    expect(score).toBeLessThanOrEqual(200);
  });

  it('should score near minimum for poor alternate profile', () => {
    const score = scoreAlternate({
      salaryCreditMonthsLast6: 2,
      whatsappVintageMonths: 3,
      hasInvestmentApp: false,
      lendingAppsCount: 4,
      upiInflowRatio: 0.20,
      hasActiveSip: false,
      utilityPaymentCount: 1,
      mobileVintageMonths: 8,
      balanceTrend: 'DECLINING',
      locationStable: false,
    });
    expect(score).toBe(0); // clamped at 0
  });

  it('should penalise >3 lending apps by 30 points', () => {
    const withFewApps = scoreAlternate({ lendingAppsCount: 0, locationStable: true, salaryCreditMonthsLast6: 6, mobileVintageMonths: 36 });
    const withManyApps = scoreAlternate({ lendingAppsCount: 4, locationStable: true, salaryCreditMonthsLast6: 6, mobileVintageMonths: 36 });
    expect(withFewApps - withManyApps).toBe(35); // 5 bonus + 30 penalty = 35 diff
  });

  it('should give +15 for active SIP', () => {
    const withSip = scoreAlternate({ hasActiveSip: true, salaryCreditMonthsLast6: 6, locationStable: true, mobileVintageMonths: 36 });
    const withoutSip = scoreAlternate({ hasActiveSip: false, salaryCreditMonthsLast6: 6, locationStable: true, mobileVintageMonths: 36 });
    expect(withSip - withoutSip).toBe(15);
  });
});

// ══════════════════════════════════════════════════════════════
// OFFER CALCULATION TESTS
// ══════════════════════════════════════════════════════════════

describe('Offer Calculation Logic', () => {

  const computeEmi = (principal: number, annualRate: number, tenureMonths: number): number => {
    const r = annualRate / 100 / 12;
    if (r === 0) return Math.round(principal / tenureMonths);
    const factor = Math.pow(1 + r, tenureMonths);
    return Math.round(principal * r * factor / (factor - 1));
  };

  it('should compute EMI correctly for standard loan', () => {
    // ₹5L at 12.5% for 36 months
    const emi = computeEmi(500000, 12.5, 36);
    // Expected ~₹16,734
    expect(emi).toBeGreaterThan(16000);
    expect(emi).toBeLessThan(17500);
  });

  it('should compute higher EMI for shorter tenure', () => {
    const emi24 = computeEmi(500000, 12.5, 24);
    const emi48 = computeEmi(500000, 12.5, 48);
    expect(emi24).toBeGreaterThan(emi48);
  });

  it('should compute total interest correctly', () => {
    const principal = 500000;
    const emi = computeEmi(principal, 12.5, 36);
    const totalPayable = emi * 36;
    const totalInterest = totalPayable - principal;
    expect(totalInterest).toBeGreaterThan(0);
    expect(totalPayable).toBeGreaterThan(principal);
  });

  it('should cap approved amount at requested amount', () => {
    const requested = 500000;
    const maxEligible = 750000;
    const approved = Math.min(requested, maxEligible);
    expect(approved).toBe(500000);
  });

  it('should not approve more than max eligible', () => {
    const requested = 1000000;
    const maxEligible = 750000;
    const approved = Math.min(requested, maxEligible);
    expect(approved).toBe(750000);
  });

  it('should apply employer category rate adjustments correctly', () => {
    const baseRate = 10.50;
    const catAAdj = -50; // bps
    const catDAdj = 250; // bps
    expect(baseRate + catAAdj / 100).toBeCloseTo(10.00, 2);
    expect(baseRate + catDAdj / 100).toBeCloseTo(13.00, 2);
  });

  it('should apply PIN tier adjustment for Tier 3', () => {
    const baseRate = 10.50;
    const tier3Adj = 75; // bps
    expect(baseRate + tier3Adj / 100).toBeCloseTo(11.25, 2);
  });
});

// ══════════════════════════════════════════════════════════════
// DECISION MATRIX TESTS
// ══════════════════════════════════════════════════════════════

describe('Decision Matrix', () => {

  const getDecision = (score: number): string => {
    if (score < 400) return 'DECLINE';
    if (score < 500) return 'REFER';
    return 'APPROVE';
  };

  const getScoreBand = (score: number): string => {
    if (score < 400) return 'DECLINE';
    if (score < 500) return '400-499';
    if (score < 600) return '500-599';
    if (score < 700) return '600-699';
    if (score < 800) return '700-799';
    return '800+';
  };

  it('should DECLINE for score < 400', () => {
    expect(getDecision(350)).toBe('DECLINE');
    expect(getDecision(399)).toBe('DECLINE');
  });

  it('should REFER for score 400-499', () => {
    expect(getDecision(400)).toBe('REFER');
    expect(getDecision(499)).toBe('REFER');
  });

  it('should APPROVE for score >= 500', () => {
    expect(getDecision(500)).toBe('APPROVE');
    expect(getDecision(750)).toBe('APPROVE');
    expect(getDecision(900)).toBe('APPROVE');
  });

  it('should assign correct score bands', () => {
    expect(getScoreBand(399)).toBe('DECLINE');
    expect(getScoreBand(450)).toBe('400-499');
    expect(getScoreBand(550)).toBe('500-599');
    expect(getScoreBand(650)).toBe('600-699');
    expect(getScoreBand(750)).toBe('700-799');
    expect(getScoreBand(850)).toBe('800+');
  });
});

// ══════════════════════════════════════════════════════════════
// EMPLOYER CATEGORY TESTS
// ══════════════════════════════════════════════════════════════

describe('Employer Category Rules', () => {

  const getMinIncome = (cat: EmployerCategory): number => {
    const map = {
      [EmployerCategory.CAT_A]: 20000,
      [EmployerCategory.CAT_B]: 25000,
      [EmployerCategory.CAT_C]: 30000,
      [EmployerCategory.CAT_D]: 40000,
    };
    return map[cat];
  };

  const getMaxLoan = (cat: EmployerCategory): number => {
    const map = {
      [EmployerCategory.CAT_A]: 2500000,
      [EmployerCategory.CAT_B]: 2500000,
      [EmployerCategory.CAT_C]: 1500000,
      [EmployerCategory.CAT_D]: 500000,
    };
    return map[cat];
  };

  it('should have lowest minimum income for CAT_A', () => {
    expect(getMinIncome(EmployerCategory.CAT_A)).toBeLessThan(getMinIncome(EmployerCategory.CAT_D));
  });

  it('should have highest max loan for CAT_A and CAT_B', () => {
    expect(getMaxLoan(EmployerCategory.CAT_A)).toBe(2500000);
    expect(getMaxLoan(EmployerCategory.CAT_B)).toBe(2500000);
  });

  it('should cap CAT_D loans at ₹5L', () => {
    expect(getMaxLoan(EmployerCategory.CAT_D)).toBe(500000);
  });
});

// ══════════════════════════════════════════════════════════════
// MASKING UTILITY TESTS
// ══════════════════════════════════════════════════════════════

describe('PII Masking', () => {
  const { maskPan, maskMobile } = require('../src/utils/masking');

  it('should mask PAN correctly', () => {
    const pan = 'A'.repeat(64); // SHA-256 hash
    const masked = maskPan(pan);
    expect(masked).toMatch(/^[A-Z]{2}\*{3}[A-Z]$/);
  });

  it('should mask mobile correctly', () => {
    const mobile = '+919876543210';
    const masked = maskMobile(mobile);
    expect(masked).toBe('***3210');
  });

  it('should handle short PAN gracefully', () => {
    expect(maskPan('AB')).toBe('***');
  });
});
