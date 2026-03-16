// ============================================================
// types/index.ts — All domain types for the Underwriting Engine
// ============================================================

// ── Enums ────────────────────────────────────────────────────

export enum Decision {
  APPROVE = 'APPROVE',
  DECLINE = 'DECLINE',
  REFER = 'REFER',
}

export enum EmployerCategory {
  CAT_A = 'CAT_A', // PSU / Govt
  CAT_B = 'CAT_B', // MNC / Listed Large Cap
  CAT_C = 'CAT_C', // Unlisted / SME
  CAT_D = 'CAT_D', // Startup / Unverified
}

export enum ResidenceType {
  OWN = 'OWN',
  RENTED = 'RENTED',
  PG = 'PG',
}

export enum LoanPurpose {
  HOME_RENOVATION = 'HOME_RENOVATION',
  MEDICAL = 'MEDICAL',
  EDUCATION = 'EDUCATION',
  TRAVEL = 'TRAVEL',
  WEDDING = 'WEDDING',
  DEBT_CONSOLIDATION = 'DEBT_CONSOLIDATION',
  OTHER = 'OTHER',
}

export enum Channel {
  DIGITAL = 'DIGITAL',
  BRANCH = 'BRANCH',
  DSA = 'DSA',
  PARTNER_API = 'PARTNER_API',
}

export enum OsType {
  ANDROID = 'ANDROID',
  IOS = 'IOS',
}

export enum BureauSource {
  CIBIL = 'CIBIL',
  EXPERIAN = 'EXPERIAN',
  EQUIFAX = 'EQUIFAX',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum PinTier {
  TIER_1 = 'TIER_1',
  TIER_2 = 'TIER_2',
  TIER_3 = 'TIER_3',
}

// ── Request / Application Payload ────────────────────────────

export interface ApplicantDetails {
  panNumber: string;          // SHA-256 hashed
  aadhaarNumber?: string;     // Last 4 digits only stored
  mobile: string;             // E.164 format
  email: string;
  dateOfBirth: string;        // YYYY-MM-DD
  age: number;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  firstName: string;
  lastName: string;
}

export interface FinancialDetails {
  netMonthlySalary: number;       // ₹
  grossAnnualIncome: number;      // ₹
  employerName: string;
  employerCategory?: EmployerCategory;
  employmentTenureMonths: number;
  salaryAccountBank?: string;
}

export interface AddressDetails {
  residenceType: ResidenceType;
  pinCode: string;
  city: string;
  state: string;
  addressLine1?: string;
}

export interface LoanRequest {
  requestedAmount: number;        // ₹
  requestedTenure: number;        // months
  purpose: LoanPurpose;
}

export interface ConsentTokens {
  bureauConsent: string;          // JWT
  aaConsent: string;              // JWT
  smsConsent?: string;            // JWT
  locationConsent?: string;       // JWT
  appographyConsent?: string;     // JWT
}

export interface DeviceData {
  deviceId: string;               // SHA-256 hashed
  osType: OsType;
  osVersion: string;
  appVersion: string;
  deviceFingerprint?: string;
}

export interface UnderwritingRequest {
  applicationId: string;
  channel: Channel;
  applicant: ApplicantDetails;
  financials: FinancialDetails;
  address: AddressDetails;
  loanRequest: LoanRequest;
  consentTokens: ConsentTokens;
  deviceData: DeviceData;
  requestTimestamp: string;       // ISO8601
}

// ── Bureau Data ───────────────────────────────────────────────

export interface BureauTradeLineDetail {
  accountType: string;
  lenderName: string;
  sanctionedAmount: number;
  currentBalance: number;
  emiAmount: number;
  dpd30Count: number;
  dpd60Count: number;
  dpd90Count: number;
  isSecured: boolean;
  isActive: boolean;
  openedDate: string;
  closedDate?: string;
  writeOffAmount?: number;
  settledAmount?: number;
}

export interface BureauData {
  // BUR_001
  cibilScore: number;
  // BUR_002
  cibilVintageMonths: number;
  // BUR_003
  totalTradeLines: number;
  // BUR_004
  unsecuredTradeLines: number;
  // BUR_005
  securedTradeLines: number;
  // BUR_006 (derived)
  unsecuredToSecuredRatio: number;
  // BUR_007
  activeTradeLines: number;
  // BUR_008
  dpd30Last6Months: number;
  // BUR_009
  dpd60Last12Months: number;
  // BUR_010
  dpd90Ever: number;
  // BUR_011
  writtenOffOrSettledCount: number;
  // BUR_012
  imputedIncome: number;           // ₹/month from CIBIL Income Estimator
  // BUR_013
  totalOutstandingDebt: number;    // ₹
  // BUR_014
  existingMonthlyEmiObligations: number;  // ₹/month
  // BUR_015
  enquiriesLast30Days: number;
  // BUR_016
  enquiriesLast90Days: number;
  // BUR_017
  creditUtilisationRatio: number;  // 0.0 – 1.0
  // BUR_018
  oldestTradeLineAgeMonths: number;

  tradeLineDetails: BureauTradeLineDetail[];
  bureauSource: BureauSource;
  reportFetchedAt: string;         // ISO8601
  rawReportId: string;
}

// ── Account Aggregator / Financial Data ───────────────────────

export interface MonthlyBankSummary {
  month: string;                  // YYYY-MM
  totalCredit: number;
  totalDebit: number;
  avgClosingBalance: number;
  minBalance: number;
  salaryCredit: number;
  emiDebits: number;
  bounceCount: number;
}

export interface AccountAggregatorData {
  available: boolean;
  monthlySummaries: MonthlyBankSummary[];
  avgMonthlyCredit: number;
  avgMonthlyEmiDebit: number;
  salaryConsistencyScore: number;   // 0–1
  hasBounce: boolean;
  activeSipAmount: number;
  avgBalance6Month: number;
  balanceTrend: 'RISING' | 'STABLE' | 'DECLINING';
  overdraftUsageCount: number;
}

// ── Appography Data ────────────────────────────────────────────

export interface AppographyData {
  available: boolean;
  // APP_001
  fintechAppsCount: number;
  // APP_002
  lendingAppsCount: number;
  // APP_003
  bankingAppsCount: number;
  // APP_004
  hasInvestmentApp: boolean;
  // APP_005
  hasInsuranceApp: boolean;
  // APP_006
  ecommerceVintageDays: number;
  // APP_007
  hasRideShareFoodApp: boolean;
  // APP_008
  hasLinkedInApp: boolean;
  // APP_009
  daysSinceLastOsUpdate: number;
  // APP_010
  hasCasinoBettingApp: boolean;
}

// ── SMS Signals ────────────────────────────────────────────────

export interface SmsData {
  available: boolean;
  // SMS_001 + SMS_002
  salaryCreditMonthsLast6: number;
  // SMS_003
  salaryCreditStdDeviation: number;
  // SMS_004
  emiDebitCountLast6Months: number;
  avgEmiDebitAmount: number;
  // SMS_005
  creditCardPaymentCount: number;
  // SMS_006
  loanEnquirySmsLast30Days: number;
  // SMS_007
  utilityPaymentCount: number;
  // SMS_008
  bounceOrReturnCount: number;
  // SMS_009
  internationalTransactionCount: number;
}

// ── Telecom / WhatsApp Signals ─────────────────────────────────

export interface TelecomData {
  available: boolean;
  // WA_001
  whatsappVintageMonths: number;
  // WA_002
  isWhatsappBusiness: boolean;
  // WA_003
  hasProfilePhoto: boolean;
  // WA_004
  displayNameMatchesKyc: boolean;
  // WA_005
  daysSinceLastActive: number;
  // WA_006 / Mobile number vintage
  mobileNumberVintageMonths: number;
  mnpChangeCount: number;           // Number of operator changes
}

// ── Location Data ──────────────────────────────────────────────

export interface LocationData {
  available: boolean;
  // LOC_001
  homeLocationStable: boolean;
  // LOC_002
  officeLocationMatchesEmployer: boolean;
  // LOC_003
  cityTier: PinTier;
  // LOC_004
  stateRiskScore: number;           // 0–100 (higher = more risky)
  stateName: string;
  // LOC_005
  nighttimeLocationConsistent: boolean;
  // LOC_006
  locationVelocityFlag: boolean;    // true = suspicious rapid movement
  // LOC_007
  isNegativeZonePin: boolean;       // Known fraud hotspot
  pinTier: PinTier;
  pinNpaRate: number;               // Historical NPA rate for this PIN
}

// ── Employer Verification ──────────────────────────────────────

export interface EmployerVerificationData {
  available: boolean;
  employerVerified: boolean;
  resolvedCategory: EmployerCategory;
  cinNumber?: string;
  companyAge?: number;              // years
  employeeCountBand?: string;       // '1-50', '51-200', etc.
  isListedCompany: boolean;
}

// ── KYC Result ────────────────────────────────────────────────

export interface KycResult {
  panVerified: boolean;
  aadhaarVerified: boolean;
  nameOnPan: string;
  dateOfBirthMatches: boolean;
  panStatus: 'ACTIVE' | 'INACTIVE' | 'NOT_FOUND';
}

// ── Fraud Check ────────────────────────────────────────────────

export interface FraudCheckResult {
  blacklisted: boolean;
  deviceBlacklisted: boolean;
  sameDeviceApplicationCount7Days: number;
  deviceFingerprintRisk: RiskLevel;
  panFraudFlag: boolean;
  mobileFraudFlag: boolean;
}

// ── Scorecard Modules ──────────────────────────────────────────

export interface ScorecardModuleScores {
  bureauScore: number;              // Max 300
  bureauBehaviour: number;          // Max 200
  incomeFoir: number;               // Max 150
  employerDemographics: number;     // Max 100
  alternateBehavioural: number;     // Max 200
  fraudRisk: number;                // Max 50
  total: number;                    // Max 1000
}

export interface ScorecardResult {
  moduleScores: ScorecardModuleScores;
  scoreBand: string;
  hardGatesTriggered: HardGateResult[];
  softFlagsTriggered: string[];
}

export interface HardGateResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  value?: string | number;
}

// ── FOIR Calculation ───────────────────────────────────────────

export interface FoirResult {
  existingMonthlyEmi: number;
  proposedNewEmi: number;
  netMonthlyIncome: number;
  foirPreLoan: number;              // ratio
  foirPostLoan: number;             // ratio
  foirBreached: boolean;
  maxAllowableEmi: number;
  maxLoanAmountByFoir: number;
}

// ── Loan Offer ─────────────────────────────────────────────────

export interface LoanOffer {
  approvedAmount: number;           // ₹
  maxEligibleAmount: number;        // ₹ (up to which they qualify)
  interestRate: number;             // % p.a.
  rateType: 'REDUCING_BALANCE';
  tenure: number;                   // months
  emi: number;                      // ₹/month
  processingFee: number;            // ₹
  processingFeePercent: number;
  totalInterestPayable: number;     // ₹
  totalAmountPayable: number;       // ₹
  offerValidTill: string;           // ISO8601
}

// ── Final Decision ─────────────────────────────────────────────

export interface DataAvailabilitySummary {
  bureauSource: BureauSource;
  bureauFallbackUsed: boolean;
  aaDataAvailable: boolean;
  smsDataAvailable: boolean;
  appographyAvailable: boolean;
  locationDataAvailable: boolean;
  employerVerified: boolean;
  itrDataAvailable: boolean;
}

export interface UnderwritingResponse {
  applicationId: string;
  decision: Decision;
  decisionCode: string;
  decisionReason: string;
  scorecard: ScorecardResult;
  offer?: LoanOffer;                // Present only if APPROVE
  foirSummary: FoirResult;
  dataAvailability: DataAvailabilitySummary;
  hardGatesTriggered: HardGateResult[];
  softFlagsTriggered: string[];
  auditId: string;
  processingTimeMs: number;
  timestamp: string;
}

// ── Internal Context (passed through pipeline) ────────────────

export interface UnderwritingContext {
  request: UnderwritingRequest;
  kyc?: KycResult;
  bureau?: BureauData;
  aa?: AccountAggregatorData;
  appography?: AppographyData;
  sms?: SmsData;
  telecom?: TelecomData;
  location?: LocationData;
  employer?: EmployerVerificationData;
  fraud?: FraudCheckResult;
  foir?: FoirResult;
  scorecard?: ScorecardResult;
  startTime: number;
  errors: PipelineError[];
}

export interface PipelineError {
  stage: string;
  apiId: string;
  message: string;
  code: string;
  timestamp: string;
  fallbackUsed: boolean;
}

// ── API Response Wrappers ─────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  latencyMs: number;
  provider: string;
}

// ── Audit Log ─────────────────────────────────────────────────

export interface AuditLogEntry {
  auditId: string;
  applicationId: string;
  decision: Decision;
  scorecard: ScorecardModuleScores;
  hardGatesEvaluated: HardGateResult[];
  softFlagsTriggered: string[];
  apiCallLog: ApiCallLogEntry[];
  maskedPan: string;
  maskedMobile: string;
  channelId: Channel;
  processingTimeMs: number;
  timestamp: string;
  engineVersion: string;
}

export interface ApiCallLogEntry {
  apiId: string;
  provider: string;
  statusCode: number;
  latencyMs: number;
  success: boolean;
  fallbackUsed: boolean;
  timestamp: string;
}

// ── ZEN Engine Input Shape ─────────────────────────────────────

export interface ZenEngineHardGateInput {
  cibilScore: number;
  dpd90Ever: number;
  writtenOffOrSettledCount: number;
  age: number;
  netMonthlySalary: number;
  foirPostLoan: number;
  lendingAppsCount: number;
  bounceOrReturnCount: number;
  isNegativeZonePin: boolean;
  hasCasinoBettingApp: boolean;
  dpd30Last6Months: number;
  enquiriesLast30Days: number;
  cibilVintageMonths: number;
  aaDataAvailable: boolean;
  requestedTenure: number;
  maxTenureByAge: number;
}

export interface ZenEngineScorecardInput {
  // Bureau
  cibilScore: number;
  cibilVintageMonths: number;
  dpd30Last6Months: number;
  dpd60Last12Months: number;
  enquiriesLast30Days: number;
  enquiriesLast90Days: number;
  creditUtilisationRatio: number;
  unsecuredToSecuredRatio: number;
  unsecuredTradeLines: number;
  oldestTradeLineAgeMonths: number;
  // Income
  netMonthlySalary: number;
  foirPostLoan: number;
  incomeVerified: boolean;
  // Employer
  employerCategory: string;
  employmentTenureMonths: number;
  // Alternate
  salaryCreditMonthsLast6: number;
  whatsappVintageMonths: number;
  hasInvestmentApp: boolean;
  lendingAppsCount: number;
  upiInflowVsIncomeRatio: number;
  hasActiveSip: boolean;
  utilityPaymentCount: number;
  mobileNumberVintageMonths: number;
  avgBalance6MonthTrend: string;
  homeLocationStable: boolean;
  // Fraud
  sameDeviceApplicationCount7Days: number;
  mobileFraudFlag: boolean;
  locationVelocityFlag: boolean;
}

export interface ZenEngineOfferInput {
  scoreTotal: number;
  netMonthlySalary: number;
  employerCategory: string;
  foirPostLoan: number;
  maxAllowableEmi: number;
  requestedAmount: number;
  requestedTenure: number;
  pinTier: string;
  cibilScore: number;
  baseInterestRate: number;
}
