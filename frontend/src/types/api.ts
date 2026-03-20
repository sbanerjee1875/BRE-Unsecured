export interface UnderwritingResponse {
  applicationId: string;
  decision: 'APPROVE' | 'DECLINE' | 'REFER';
  decisionCode: string;
  decisionReason: string;
  scorecard: {
    moduleScores: {
      bureauScore: number;
      bureauBehaviour: number;
      incomeFoir: number;
      employerDemographics: number;
      alternateBehavioural: number;
      fraudRisk: number;
      total: number;
    };
    scoreBand: string;
    hardGatesTriggered: HardGateResult[];
    softFlagsTriggered: string[];
  };
  offer?: LoanOffer;
  foirSummary: {
    existingMonthlyEmi: number;
    proposedNewEmi: number;
    netMonthlyIncome: number;
    foirPreLoan: number;
    foirPostLoan: number;
    foirBreached: boolean;
    maxAllowableEmi: number;
    maxLoanAmountByFoir: number;
  };
  hardGatesTriggered: HardGateResult[];
  softFlagsTriggered: string[];
  auditId: string;
  processingTimeMs: number;
  timestamp: string;
}

export interface LoanOffer {
  approvedAmount: number;
  maxEligibleAmount: number;
  interestRate: number;
  rateType: string;
  tenure: number;
  emi: number;
  processingFee: number;
  processingFeePercent: number;
  totalInterestPayable: number;
  totalAmountPayable: number;
  offerValidTill: string;
}

export interface HardGateResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  value?: string | number;
}
