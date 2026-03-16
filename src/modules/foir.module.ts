// ============================================================
// modules/foir.module.ts
// Fixed Obligation to Income Ratio Calculator
// Rules: R-FOIR-01 through R-FOIR-04
// ============================================================

import { BureauData, AccountAggregatorData, LoanRequest, FoirResult } from '../types';
import { logger } from '../utils/logger';

const MAX_FOIR = parseFloat(process.env.MAX_FOIR ?? '0.65');

export class FoirCalculator {
  calculate(params: {
    netMonthlySalary: number;
    bureau: BureauData;
    aa: AccountAggregatorData;
    loanRequest: LoanRequest;
  }): FoirResult {
    const { netMonthlySalary, bureau, aa, loanRequest } = params;

    // R-FOIR-02: Use the LOWER of stated salary vs AA-verified credit as income
    const verifiedIncome = this.resolveIncome(netMonthlySalary, aa);
    const incomeVerified = verifiedIncome < netMonthlySalary * 0.9;

    // R-FOIR-04: Existing obligations from bureau + any undeclared EMIs from AA
    const bureauEmi = bureau.existingMonthlyEmiObligations;
    const aaEmi = aa.available ? aa.avgMonthlyEmiDebit : 0;
    const existingMonthlyEmi = Math.max(bureauEmi, aaEmi); // take the higher (more conservative)

    // Propose a new EMI using 36 months at base rate for initial FOIR check
    const proposedEmi = this.estimateEmi(
      loanRequest.requestedAmount,
      loanRequest.requestedTenure
    );

    const foirPreLoan = verifiedIncome > 0 ? existingMonthlyEmi / verifiedIncome : 1;
    const foirPostLoan = verifiedIncome > 0
      ? (existingMonthlyEmi + proposedEmi) / verifiedIncome
      : 1;

    const foirBreached = foirPostLoan > MAX_FOIR;

    // Maximum allowable EMI = MAX_FOIR * income - existing obligations
    const maxAllowableEmi = Math.max(0, (MAX_FOIR * verifiedIncome) - existingMonthlyEmi);

    // Maximum loan amount by FOIR (using base rate + 10.5%, 60 months for max)
    const maxLoanAmountByFoir = this.reverseEmi(maxAllowableEmi, 60);

    logger.info(
      `[FOIR] income=${verifiedIncome} existingEMI=${existingMonthlyEmi} ` +
      `proposedEMI=${proposedEmi} foirPost=${foirPostLoan.toFixed(3)} breached=${foirBreached}`
    );

    return {
      existingMonthlyEmi,
      proposedNewEmi: proposedEmi,
      netMonthlyIncome: verifiedIncome,
      foirPreLoan: parseFloat(foirPreLoan.toFixed(4)),
      foirPostLoan: parseFloat(foirPostLoan.toFixed(4)),
      foirBreached,
      maxAllowableEmi: Math.round(maxAllowableEmi),
      maxLoanAmountByFoir: Math.round(maxLoanAmountByFoir / 1000) * 1000,
    };
  }

  // R-FOIR-02: income verification
  private resolveIncome(stated: number, aa: AccountAggregatorData): number {
    if (!aa.available || aa.avgMonthlyCredit === 0) return stated;

    // If AA credits are < 90% of stated, flag and use AA income
    if (aa.avgMonthlyCredit < stated * 0.9) {
      logger.warn(`[FOIR] Income mismatch: stated=${stated} AA=${aa.avgMonthlyCredit}`);
      return aa.avgMonthlyCredit;
    }

    return stated;
  }

  // EMI = P * r * (1+r)^n / ((1+r)^n - 1)
  private estimateEmi(principal: number, tenureMonths: number): number {
    const baseRate = parseFloat(process.env.BASE_INTEREST_RATE ?? '10.50');
    const r = baseRate / 100 / 12;
    if (r === 0) return principal / tenureMonths;
    const factor = Math.pow(1 + r, tenureMonths);
    return Math.round(principal * r * factor / (factor - 1));
  }

  // Reverse EMI: given max monthly payment, what's the max loan?
  private reverseEmi(maxEmi: number, tenureMonths: number): number {
    const baseRate = parseFloat(process.env.BASE_INTEREST_RATE ?? '10.50');
    const r = baseRate / 100 / 12;
    if (r === 0) return maxEmi * tenureMonths;
    const factor = Math.pow(1 + r, tenureMonths);
    return maxEmi * (factor - 1) / (r * factor);
  }
}
