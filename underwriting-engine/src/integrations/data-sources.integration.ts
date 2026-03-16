// ============================================================
// integrations/data-sources.integration.ts
// All alternate data & KYC API integrations:
// API-004: PAN KYC | API-005: Aadhaar eKYC
// API-006: Account Aggregator | API-009: Appography
// API-010: SMS Analysis | API-011: Telecom/WhatsApp
// API-012: Location | API-013: PIN Risk
// API-014: Employer Verification | API-016: Fraud Blacklist
// ============================================================

import { BaseApiClient } from './base-api-client';
import {
  KycResult, AccountAggregatorData, AppographyData, SmsData,
  TelecomData, LocationData, EmployerVerificationData, FraudCheckResult,
  UnderwritingRequest, EmployerCategory, PinTier, RiskLevel,
  ApiCallLogEntry
} from '../types';
import { logger } from '../utils/logger';

// ──────────────────────────────────────────────────────────────
// API-004 + API-005: KYC Integration
// ──────────────────────────────────────────────────────────────

export class KycIntegration {
  public callLog: ApiCallLogEntry[] = [];

  async verifyKyc(request: UnderwritingRequest): Promise<KycResult> {
    const [panResult, aadhaarResult] = await Promise.allSettled([
      this.verifyPan(request),
      this.verifyAadhaar(request),
    ]);

    const panData = panResult.status === 'fulfilled' ? panResult.value : null;
    const aadhaarData = aadhaarResult.status === 'fulfilled' ? aadhaarResult.value : null;

    return {
      panVerified: panData?.verified ?? false,
      aadhaarVerified: aadhaarData?.verified ?? false,
      nameOnPan: panData?.name ?? '',
      dateOfBirthMatches: panData?.dobMatches ?? false,
      panStatus: panData?.status ?? 'NOT_FOUND',
    };
  }

  private async verifyPan(request: UnderwritingRequest): Promise<any> {
    const client = new BaseApiClient({
      apiId: 'API-004',
      provider: 'NSDL/Protean PAN KYC',
      baseUrl: process.env.PAN_KYC_BASE_URL!,
      timeoutMs: parseInt(process.env.PAN_KYC_TIMEOUT_MS ?? '5000'),
      apiKey: process.env.PAN_KYC_API_KEY,
      maxRetries: 2,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/pan/verify', {
        panNumber: request.applicant.panNumber,
        dateOfBirth: request.applicant.dateOfBirth,
        name: `${request.applicant.firstName} ${request.applicant.lastName}`,
        consentToken: request.consentTokens.bureauConsent,
      })
    );

    this.callLog.push(...client.callLog);

    if (!result.success) {
      logger.error(`[KYC] PAN verification failed: ${result.error?.message}`);
      return null;
    }

    return {
      verified: result.data?.status === 'VALID',
      name: result.data?.name ?? '',
      dobMatches: result.data?.dobMatch ?? false,
      status: result.data?.panStatus ?? 'NOT_FOUND',
    };
  }

  private async verifyAadhaar(request: UnderwritingRequest): Promise<any> {
    if (!request.applicant.aadhaarNumber) return { verified: false };

    const client = new BaseApiClient({
      apiId: 'API-005',
      provider: 'UIDAI Aadhaar eKYC',
      baseUrl: process.env.AADHAAR_BASE_URL!,
      timeoutMs: parseInt(process.env.AADHAAR_TIMEOUT_MS ?? '8000'),
      maxRetries: 1,
      headers: {
        'AUA-Code': process.env.AADHAAR_AUA_CODE!,
        'ASA-License-Key': process.env.AADHAAR_ASA_LICENSE_KEY!,
      },
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/otp/verify', {
        aadhaar: request.applicant.aadhaarNumber,
        mobile: request.applicant.mobile,
        consentToken: request.consentTokens.bureauConsent,
      })
    );

    this.callLog.push(...client.callLog);
    return { verified: result.success && result.data?.authenticated === true };
  }
}

// ──────────────────────────────────────────────────────────────
// API-006: Account Aggregator (SAHAMATI / Finvu)
// ──────────────────────────────────────────────────────────────

export class AccountAggregatorIntegration {
  public callLog: ApiCallLogEntry[] = [];

  async fetchFinancialData(request: UnderwritingRequest): Promise<AccountAggregatorData> {
    const client = new BaseApiClient({
      apiId: 'API-006',
      provider: 'Finvu AA',
      baseUrl: process.env.AA_BASE_URL!,
      timeoutMs: parseInt(process.env.AA_TIMEOUT_MS ?? '35000'),
      maxRetries: 1,
      headers: {
        'AA-Client-Id': process.env.AA_CLIENT_ID!,
        'FIU-Id': process.env.AA_FIU_ID!,
      },
    });

    // Step 1: Initiate consent request
    const consentResult = await client.executeWithRetry<any>(() =>
      client['client'].post('/consentRequest', {
        consentId: request.consentTokens.aaConsent,
        customerId: request.applicationId,
        fiuId: process.env.AA_FIU_ID,
        dataRange: {
          from: getDateMonthsAgo(24),
          to: new Date().toISOString(),
        },
        fiTypes: ['DEPOSIT', 'RECURRING_DEPOSIT', 'TERM_DEPOSIT', 'MUTUAL_FUNDS'],
        fetchType: 'PERIODIC',
        consentTypes: ['TRANSACTIONS', 'SUMMARY', 'PROFILE'],
        frequency: { unit: 'MONTH', value: 1 },
      })
    );

    this.callLog.push(...client.callLog);

    if (!consentResult.success) {
      logger.warn('[AA] Consent initiation failed — proceeding without AA data');
      return buildEmptyAAData();
    }

    const sessionId = consentResult.data?.sessionId;

    // Step 2: Poll for data (async webhook OR polling)
    const dataResult = await this.pollForAAData(client, sessionId);
    this.callLog.push(...client.callLog);

    if (!dataResult) return buildEmptyAAData();

    return this.parseAAResponse(dataResult);
  }

  private async pollForAAData(client: BaseApiClient, sessionId: string): Promise<any | null> {
    const maxPolls = parseInt(process.env.AA_MAX_POLLS ?? '6');
    const pollIntervalMs = parseInt(process.env.AA_POLL_INTERVAL_MS ?? '5000');

    for (let i = 0; i < maxPolls; i++) {
      await sleep(pollIntervalMs);

      const result = await client.executeWithRetry<any>(() =>
        client['client'].get(`/dataSession/${sessionId}`), 1
      );

      if (result.success && result.data?.status === 'READY') {
        return result.data?.accounts ?? [];
      }
    }

    logger.warn(`[AA] Data not ready after ${maxPolls} polls`);
    return null;
  }

  private parseAAResponse(accounts: any[]): AccountAggregatorData {
    // Parse 24 months of bank statements
    const monthlySummaries: any[] = [];
    let totalEmiDebit = 0;
    let totalCredit = 0;
    let hasBounce = false;
    let activeSipAmount = 0;
    const balances: number[] = [];

    for (const account of accounts) {
      for (const txn of account.transactions ?? []) {
        // Aggregate by month
        const month = txn.valueDate?.substring(0, 7) ?? 'unknown';
        let summary = monthlySummaries.find(s => s.month === month);
        if (!summary) {
          summary = { month, totalCredit: 0, totalDebit: 0, avgClosingBalance: 0, minBalance: Infinity, salaryCredit: 0, emiDebits: 0, bounceCount: 0 };
          monthlySummaries.push(summary);
        }

        if (txn.type === 'CREDIT') {
          summary.totalCredit += txn.amount;
          totalCredit += txn.amount;
          if (txn.narration?.toLowerCase().includes('salary')) {
            summary.salaryCredit += txn.amount;
          }
        } else {
          summary.totalDebit += txn.amount;
          if (txn.narration?.toLowerCase().includes('emi') || txn.narration?.toLowerCase().includes('nach')) {
            summary.emiDebits += txn.amount;
            totalEmiDebit += txn.amount;
          }
          if (txn.narration?.toLowerCase().includes('bounce') || txn.narration?.toLowerCase().includes('return')) {
            summary.bounceCount++;
            hasBounce = true;
          }
        }

        if (txn.closingBalance !== undefined) {
          balances.push(txn.closingBalance);
          summary.minBalance = Math.min(summary.minBalance, txn.closingBalance);
        }
      }

      // SIP detection from mutual fund accounts
      if (account.fiType === 'MUTUAL_FUNDS' && account.sipAmount) {
        activeSipAmount += account.sipAmount;
      }
    }

    const monthCount = Math.max(monthlySummaries.length, 1);
    const avgMonthlyCredit = totalCredit / monthCount;
    const avgMonthlyEmiDebit = totalEmiDebit / monthCount;
    const avgBalance6Month = balances.length > 0
      ? balances.slice(-180).reduce((a, b) => a + b, 0) / Math.min(balances.slice(-180).length, 1)
      : 0;

    // Balance trend: compare last 3M avg vs prior 3M avg
    const recentAvg = balances.slice(-90).reduce((a, b) => a + b, 0) / Math.max(balances.slice(-90).length, 1);
    const priorAvg = balances.slice(-180, -90).reduce((a, b) => a + b, 0) / Math.max(balances.slice(-180, -90).length, 1);
    const balanceTrend: 'RISING' | 'STABLE' | 'DECLINING' =
      recentAvg > priorAvg * 1.05 ? 'RISING' :
      recentAvg < priorAvg * 0.95 ? 'DECLINING' : 'STABLE';

    const salaryCreditMonths = monthlySummaries.filter(s => s.salaryCredit > 0).length;
    const salaryConsistencyScore = Math.min(salaryCreditMonths / 6, 1);

    return {
      available: true,
      monthlySummaries,
      avgMonthlyCredit,
      avgMonthlyEmiDebit,
      salaryConsistencyScore,
      hasBounce,
      activeSipAmount,
      avgBalance6Month,
      balanceTrend,
      overdraftUsageCount: monthlySummaries.filter(s => s.minBalance < 0).length,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// API-009: Appography (IDfy SDK)
// ──────────────────────────────────────────────────────────────

export class AppographyIntegration {
  public callLog: ApiCallLogEntry[] = [];

  async fetchAppSignals(request: UnderwritingRequest): Promise<AppographyData> {
    if (!request.consentTokens.appographyConsent) {
      return buildEmptyAppography();
    }

    const client = new BaseApiClient({
      apiId: 'API-009',
      provider: 'IDfy Appography',
      baseUrl: process.env.APPOGRAPHY_BASE_URL!,
      timeoutMs: parseInt(process.env.APPOGRAPHY_TIMEOUT_MS ?? '5000'),
      apiKey: process.env.APPOGRAPHY_API_KEY,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/deviceSignals', {
        deviceId: request.deviceData.deviceId,
        consentToken: request.consentTokens.appographyConsent,
        osType: request.deviceData.osType,
      })
    );

    this.callLog.push(...client.callLog);

    if (!result.success || !result.data) return buildEmptyAppography();

    const d = result.data;
    return {
      available: true,
      fintechAppsCount: d.fintechApps ?? 0,
      lendingAppsCount: d.lendingApps ?? 0,
      bankingAppsCount: d.bankingApps ?? 0,
      hasInvestmentApp: d.investmentApps?.length > 0 ?? false,
      hasInsuranceApp: d.insuranceApps?.length > 0 ?? false,
      ecommerceVintageDays: d.ecommerceVintageDays ?? 0,
      hasRideShareFoodApp: d.rideShareApps?.length > 0 ?? false,
      hasLinkedInApp: d.professionalApps?.includes('linkedin') ?? false,
      daysSinceLastOsUpdate: d.daysSinceOsUpdate ?? 999,
      hasCasinoBettingApp: d.gamblingApps?.length > 0 ?? false,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// API-010: SMS Analysis (Finarkein)
// ──────────────────────────────────────────────────────────────

export class SmsIntegration {
  public callLog: ApiCallLogEntry[] = [];

  async fetchSmsSignals(request: UnderwritingRequest): Promise<SmsData> {
    if (!request.consentTokens.smsConsent) {
      return buildEmptySmsData();
    }

    const client = new BaseApiClient({
      apiId: 'API-010',
      provider: 'Finarkein SMS Analysis',
      baseUrl: process.env.SMS_BASE_URL!,
      timeoutMs: parseInt(process.env.SMS_TIMEOUT_MS ?? '5000'),
      apiKey: process.env.SMS_API_KEY,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/smsAnalysis', {
        mobile: request.applicant.mobile,
        consentToken: request.consentTokens.smsConsent,
        lookbackMonths: 12,
      })
    );

    this.callLog.push(...client.callLog);

    if (!result.success || !result.data) return buildEmptySmsData();

    const d = result.data;
    return {
      available: true,
      salaryCreditMonthsLast6: d.salaryCredits?.monthsDetected ?? 0,
      salaryCreditStdDeviation: d.salaryCredits?.stdDeviation ?? 0,
      emiDebitCountLast6Months: d.emiDebits?.count ?? 0,
      avgEmiDebitAmount: d.emiDebits?.avgAmount ?? 0,
      creditCardPaymentCount: d.creditCardPayments?.count ?? 0,
      loanEnquirySmsLast30Days: d.loanEnquiries?.last30Days ?? 0,
      utilityPaymentCount: d.utilityPayments?.count ?? 0,
      bounceOrReturnCount: d.bounces?.count ?? 0,
      internationalTransactionCount: d.internationalTxns?.count ?? 0,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// API-011: Telecom / WhatsApp Vintage
// ──────────────────────────────────────────────────────────────

export class TelecomIntegration {
  public callLog: ApiCallLogEntry[] = [];

  async fetchTelecomSignals(request: UnderwritingRequest): Promise<TelecomData> {
    const client = new BaseApiClient({
      apiId: 'API-011',
      provider: 'TRAI MNP API',
      baseUrl: process.env.TELECOM_BASE_URL!,
      timeoutMs: parseInt(process.env.TELECOM_TIMEOUT_MS ?? '5000'),
      apiKey: process.env.TELECOM_API_KEY,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/mobileVintage', {
        mobile: request.applicant.mobile,
        consentToken: request.consentTokens.bureauConsent,
      })
    );

    this.callLog.push(...client.callLog);

    if (!result.success || !result.data) {
      return {
        available: false,
        whatsappVintageMonths: 0, isWhatsappBusiness: false,
        hasProfilePhoto: false, displayNameMatchesKyc: false,
        daysSinceLastActive: 999, mobileNumberVintageMonths: 0, mnpChangeCount: 0,
      };
    }

    const d = result.data;
    const activationDate = new Date(d.activationDate);
    const vintageMonths = monthsDiff(activationDate, new Date());

    return {
      available: true,
      whatsappVintageMonths: d.whatsappVintageMonths ?? 0,
      isWhatsappBusiness: d.isWhatsappBusiness ?? false,
      hasProfilePhoto: d.hasProfilePhoto ?? false,
      displayNameMatchesKyc: d.displayNameMatch ?? false,
      daysSinceLastActive: d.daysSinceActive ?? 0,
      mobileNumberVintageMonths: vintageMonths,
      mnpChangeCount: d.mnpHistory?.length ?? 0,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// API-012 + API-013: Location + PIN Risk
// ──────────────────────────────────────────────────────────────

export class LocationIntegration {
  public callLog: ApiCallLogEntry[] = [];

  async fetchLocationData(request: UnderwritingRequest): Promise<LocationData> {
    const [locationResult, pinRiskResult] = await Promise.allSettled([
      this.fetchLocationProfile(request),
      this.fetchPinRisk(request.address.pinCode),
    ]);

    const loc = locationResult.status === 'fulfilled' ? locationResult.value : null;
    const pin = pinRiskResult.status === 'fulfilled' ? pinRiskResult.value : null;

    return {
      available: !!(loc || pin),
      homeLocationStable: loc?.homeStable ?? true,
      officeLocationMatchesEmployer: loc?.officeMatch ?? true,
      cityTier: mapPinTier(pin?.tier ?? 'TIER_2'),
      stateRiskScore: pin?.stateRiskScore ?? 50,
      stateName: request.address.state,
      nighttimeLocationConsistent: loc?.nighttimeConsistent ?? true,
      locationVelocityFlag: loc?.velocityFlag ?? false,
      isNegativeZonePin: pin?.isNegative ?? false,
      pinTier: mapPinTier(pin?.tier ?? 'TIER_2'),
      pinNpaRate: pin?.npaRate ?? 3.0,
    };
  }

  private async fetchLocationProfile(request: UnderwritingRequest): Promise<any | null> {
    if (!request.consentTokens.locationConsent) return null;

    const client = new BaseApiClient({
      apiId: 'API-012',
      provider: 'Location Triangulation',
      baseUrl: process.env.LOCATION_INTERNAL_BASE_URL!,
      timeoutMs: parseInt(process.env.LOCATION_TIMEOUT_MS ?? '3000'),
      maxRetries: 1,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/locationProfile', {
        deviceId: request.deviceData.deviceId,
        consentToken: request.consentTokens.locationConsent,
        lookbackDays: 60,
        homeAddress: { pinCode: request.address.pinCode, city: request.address.city },
      })
    );

    this.callLog.push(...client.callLog);
    return result.success ? result.data : null;
  }

  private async fetchPinRisk(pinCode: string): Promise<any | null> {
    const client = new BaseApiClient({
      apiId: 'API-013',
      provider: 'PIN Risk Service',
      baseUrl: process.env.PIN_RISK_BASE_URL!,
      timeoutMs: parseInt(process.env.PIN_RISK_TIMEOUT_MS ?? '1000'),
      maxRetries: 1,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].get(`/pinRisk/${pinCode}`)
    );

    this.callLog.push(...client.callLog);
    return result.success ? result.data : null;
  }
}

// ──────────────────────────────────────────────────────────────
// API-014: Employer Verification (Karza)
// ──────────────────────────────────────────────────────────────

export class EmployerIntegration {
  public callLog: ApiCallLogEntry[] = [];

  async verifyEmployer(request: UnderwritingRequest): Promise<EmployerVerificationData> {
    const client = new BaseApiClient({
      apiId: 'API-014',
      provider: 'Karza Employer Verification',
      baseUrl: process.env.EMPLOYER_BASE_URL!,
      timeoutMs: parseInt(process.env.EMPLOYER_TIMEOUT_MS ?? '8000'),
      apiKey: process.env.EMPLOYER_API_KEY,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/employer/verify', {
        employerName: request.financials.employerName,
        employerCity: request.address.city,
        employerState: request.address.state,
      })
    );

    this.callLog.push(...client.callLog);

    if (!result.success || !result.data) {
      return {
        available: false,
        employerVerified: false,
        resolvedCategory: request.financials.employerCategory ?? EmployerCategory.CAT_C,
        isListedCompany: false,
      };
    }

    const d = result.data;
    return {
      available: true,
      employerVerified: d.verified ?? false,
      resolvedCategory: mapEmployerCategory(d.category),
      cinNumber: d.cinNumber,
      companyAge: d.companyAgeYears,
      employeeCountBand: d.employeeCountBand,
      isListedCompany: d.isListed ?? false,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// API-016: Fraud Blacklist
// ──────────────────────────────────────────────────────────────

export class FraudIntegration {
  public callLog: ApiCallLogEntry[] = [];

  async checkFraud(request: UnderwritingRequest): Promise<FraudCheckResult> {
    const client = new BaseApiClient({
      apiId: 'API-016',
      provider: 'Fraud Blacklist Service',
      baseUrl: process.env.FRAUD_BLACKLIST_BASE_URL!,
      timeoutMs: parseInt(process.env.FRAUD_BLACKLIST_TIMEOUT_MS ?? '1000'),
      maxRetries: 1,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/check', {
        pan: request.applicant.panNumber,
        mobile: request.applicant.mobile,
        deviceId: request.deviceData.deviceId,
        deviceFingerprint: request.deviceData.deviceFingerprint,
      })
    );

    this.callLog.push(...client.callLog);

    if (!result.success || !result.data) {
      return {
        blacklisted: false, deviceBlacklisted: false,
        sameDeviceApplicationCount7Days: 0,
        deviceFingerprintRisk: RiskLevel.LOW,
        panFraudFlag: false, mobileFraudFlag: false,
      };
    }

    const d = result.data;
    return {
      blacklisted: d.panBlacklisted ?? false,
      deviceBlacklisted: d.deviceBlacklisted ?? false,
      sameDeviceApplicationCount7Days: d.deviceAppCount7Days ?? 0,
      deviceFingerprintRisk: d.deviceRisk ?? RiskLevel.LOW,
      panFraudFlag: d.panFraudFlag ?? false,
      mobileFraudFlag: d.mobileFraudFlag ?? false,
    };
  }
}

// ──────────────────────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function getDateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

function monthsDiff(a: Date, b: Date): number {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function mapPinTier(raw: string): PinTier {
  if (raw === 'TIER_1') return PinTier.TIER_1;
  if (raw === 'TIER_3') return PinTier.TIER_3;
  return PinTier.TIER_2;
}

function mapEmployerCategory(raw: string): EmployerCategory {
  const map: Record<string, EmployerCategory> = {
    'GOVT': EmployerCategory.CAT_A, 'PSU': EmployerCategory.CAT_A,
    'MNC': EmployerCategory.CAT_B, 'LISTED': EmployerCategory.CAT_B,
    'UNLISTED': EmployerCategory.CAT_C, 'SME': EmployerCategory.CAT_C,
    'STARTUP': EmployerCategory.CAT_D,
  };
  return map[raw?.toUpperCase()] ?? EmployerCategory.CAT_C;
}

function buildEmptyAAData(): AccountAggregatorData {
  return {
    available: false, monthlySummaries: [], avgMonthlyCredit: 0,
    avgMonthlyEmiDebit: 0, salaryConsistencyScore: 0, hasBounce: false,
    activeSipAmount: 0, avgBalance6Month: 0, balanceTrend: 'STABLE',
    overdraftUsageCount: 0,
  };
}

function buildEmptyAppography(): AppographyData {
  return {
    available: false, fintechAppsCount: 0, lendingAppsCount: 0,
    bankingAppsCount: 0, hasInvestmentApp: false, hasInsuranceApp: false,
    ecommerceVintageDays: 0, hasRideShareFoodApp: false, hasLinkedInApp: false,
    daysSinceLastOsUpdate: 0, hasCasinoBettingApp: false,
  };
}

function buildEmptySmsData(): SmsData {
  return {
    available: false, salaryCreditMonthsLast6: 0, salaryCreditStdDeviation: 0,
    emiDebitCountLast6Months: 0, avgEmiDebitAmount: 0, creditCardPaymentCount: 0,
    loanEnquirySmsLast30Days: 0, utilityPaymentCount: 0, bounceOrReturnCount: 0,
    internationalTransactionCount: 0,
  };
}
