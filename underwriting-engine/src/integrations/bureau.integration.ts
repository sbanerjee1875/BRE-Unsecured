// ============================================================
// integrations/bureau.integration.ts
// API-001: CIBIL TransUnion | API-002: CIBIL Income Estimator
// API-003: Experian (fallback)
// ============================================================

import axios from 'axios';
import { BaseApiClient } from './base-api-client';
import {
  BureauData, BureauSource, ApiResponse,
  UnderwritingRequest, ApiCallLogEntry
} from '../types';
import { logger } from '../utils/logger';
import { maskPan, maskMobile } from '../utils/masking';

// ── OAuth2 Token Cache ─────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number;
}

let cibilTokenCache: TokenCache | null = null;

async function fetchCibilOAuthToken(): Promise<string> {
  if (cibilTokenCache && Date.now() < cibilTokenCache.expiresAt - 60_000) {
    return cibilTokenCache.token;
  }

  const response = await axios.post(
    process.env.CIBIL_TOKEN_URL!,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.CIBIL_CLIENT_ID!,
      client_secret: process.env.CIBIL_CLIENT_SECRET!,
    }),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 5000 }
  );

  cibilTokenCache = {
    token: response.data.access_token,
    expiresAt: Date.now() + response.data.expires_in * 1000,
  };

  logger.info('[CIBIL] OAuth token refreshed');
  return cibilTokenCache.token;
}

// ── CIBIL Report Raw Response Shape ───────────────────────────

interface CibilRawResponse {
  reportId: string;
  cibilScore: number;
  cibilVintageMonths: number;
  totalTradeLines: number;
  unsecuredTradeLines: number;
  securedTradeLines: number;
  activeTradeLines: number;
  dpd30Last6Months: number;
  dpd60Last12Months: number;
  dpd90Ever: number;
  writtenOffOrSettledCount: number;
  totalOutstandingDebt: number;
  existingMonthlyEmiObligations: number;
  enquiriesLast30Days: number;
  enquiriesLast90Days: number;
  creditUtilisationRatio: number;
  oldestTradeLineAgeMonths: number;
  tradeLines: Array<{
    accountType: string;
    lenderName: string;
    sanctionedAmount: number;
    currentBalance: number;
    emiAmount: number;
    dpd30: number;
    dpd60: number;
    dpd90: number;
    secured: boolean;
    active: boolean;
    openedDate: string;
    closedDate?: string;
    writeOffAmount?: number;
    settledAmount?: number;
  }>;
}

interface CibilIncomeEstimatorResponse {
  reportId: string;
  estimatedMonthlyIncome: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ── Bureau Integration Class ───────────────────────────────────

export class BureauIntegration {
  public callLog: ApiCallLogEntry[] = [];

  async fetchBureauData(request: UnderwritingRequest): Promise<ApiResponse<BureauData>> {
    logger.info(`[BUR] Fetching bureau for application ${request.applicationId}`);

    // Try CIBIL first
    const cibilResult = await this.fetchFromCibil(request);
    if (cibilResult.success && cibilResult.data) {
      return cibilResult;
    }

    logger.warn(`[BUR] CIBIL failed (${cibilResult.error?.code}), falling back to Experian`);

    // Fallback to Experian
    const experianResult = await this.fetchFromExperian(request);
    if (experianResult.success) {
      this.markFallbackUsed();
    }
    return experianResult;
  }

  // ── CIBIL ──────────────────────────────────────────────────

  private async fetchFromCibil(request: UnderwritingRequest): Promise<ApiResponse<BureauData>> {
    const client = new BaseApiClient({
      apiId: 'API-001',
      provider: 'CIBIL TransUnion',
      baseUrl: process.env.CIBIL_BASE_URL!,
      timeoutMs: parseInt(process.env.CIBIL_TIMEOUT_MS ?? '10000'),
      maxRetries: parseInt(process.env.CIBIL_MAX_RETRIES ?? '3'),
    });

    const result = await client.executeWithRetry<CibilRawResponse>(() =>
      (async () => {
        const token = await fetchCibilOAuthToken();
        return client['client'].post('/creditReport', {
          requestHeader: {
            customerId: request.applicationId,
            consentId: request.consentTokens.bureauConsent,
            requestTimestamp: new Date().toISOString(),
            channelId: 'DIGITAL_PL',
          },
          applicant: {
            panNumber: request.applicant.panNumber,
            dateOfBirth: request.applicant.dateOfBirth,
            mobile: request.applicant.mobile,
            firstName: request.applicant.firstName,
          },
          enquiryPurpose: 'PERSONAL_LOAN',
          loanAmount: request.loanRequest.requestedAmount,
          reportType: ['CREDIT_REPORT'],
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })()
    );

    this.callLog.push(...client.callLog);

    if (!result.success || !result.data) return result as ApiResponse<BureauData>;

    // Fetch Income Estimator in parallel
    const incomeResult = await this.fetchCibilIncomeEstimator(request, client);

    const raw = result.data;
    const bureauData: BureauData = {
      cibilScore: raw.cibilScore,
      cibilVintageMonths: raw.cibilVintageMonths,
      totalTradeLines: raw.totalTradeLines,
      unsecuredTradeLines: raw.unsecuredTradeLines,
      securedTradeLines: raw.securedTradeLines,
      unsecuredToSecuredRatio: raw.securedTradeLines > 0
        ? parseFloat((raw.unsecuredTradeLines / raw.securedTradeLines).toFixed(2))
        : raw.unsecuredTradeLines,
      activeTradeLines: raw.activeTradeLines,
      dpd30Last6Months: raw.dpd30Last6Months,
      dpd60Last12Months: raw.dpd60Last12Months,
      dpd90Ever: raw.dpd90Ever,
      writtenOffOrSettledCount: raw.writtenOffOrSettledCount,
      imputedIncome: incomeResult?.estimatedMonthlyIncome ?? 0,
      totalOutstandingDebt: raw.totalOutstandingDebt,
      existingMonthlyEmiObligations: raw.existingMonthlyEmiObligations,
      enquiriesLast30Days: raw.enquiriesLast30Days,
      enquiriesLast90Days: raw.enquiriesLast90Days,
      creditUtilisationRatio: raw.creditUtilisationRatio,
      oldestTradeLineAgeMonths: raw.oldestTradeLineAgeMonths,
      tradeLineDetails: raw.tradeLines.map((t) => ({
        accountType: t.accountType,
        lenderName: t.lenderName,
        sanctionedAmount: t.sanctionedAmount,
        currentBalance: t.currentBalance,
        emiAmount: t.emiAmount,
        dpd30Count: t.dpd30,
        dpd60Count: t.dpd60,
        dpd90Count: t.dpd90,
        isSecured: t.secured,
        isActive: t.active,
        openedDate: t.openedDate,
        closedDate: t.closedDate,
        writeOffAmount: t.writeOffAmount,
        settledAmount: t.settledAmount,
      })),
      bureauSource: BureauSource.CIBIL,
      reportFetchedAt: new Date().toISOString(),
      rawReportId: raw.reportId,
    };

    return { success: true, data: bureauData, latencyMs: result.latencyMs, provider: 'CIBIL' };
  }

  private async fetchCibilIncomeEstimator(
    request: UnderwritingRequest,
    client: BaseApiClient
  ): Promise<CibilIncomeEstimatorResponse | null> {
    const result = await client.executeWithRetry<CibilIncomeEstimatorResponse>(() =>
      (async () => {
        const token = await fetchCibilOAuthToken();
        return client['client'].post('/incomeEstimator', {
          panNumber: request.applicant.panNumber,
          consentId: request.consentTokens.bureauConsent,
        }, {
          headers: { Authorization: `Bearer ${token}` },
        });
      })()
    );
    this.callLog.push(...client.callLog);
    return result.success ? result.data ?? null : null;
  }

  // ── Experian Fallback ──────────────────────────────────────

  private async fetchFromExperian(request: UnderwritingRequest): Promise<ApiResponse<BureauData>> {
    const client = new BaseApiClient({
      apiId: 'API-003',
      provider: 'Experian India',
      baseUrl: process.env.EXPERIAN_BASE_URL!,
      timeoutMs: parseInt(process.env.EXPERIAN_TIMEOUT_MS ?? '10000'),
      apiKey: process.env.EXPERIAN_API_KEY,
      maxRetries: 2,
    });

    const result = await client.executeWithRetry<any>(() =>
      client['client'].post('/creditReport', {
        consumer: {
          pan: request.applicant.panNumber,
          dob: request.applicant.dateOfBirth,
          mobile: request.applicant.mobile,
        },
        enquiryPurpose: 'PERSONAL_LOAN',
        loanAmount: request.loanRequest.requestedAmount,
        consentToken: request.consentTokens.bureauConsent,
      })
    );

    this.callLog.push(...client.callLog);

    if (!result.success || !result.data) return result as ApiResponse<BureauData>;

    // Map Experian response to our BureauData schema
    const exp = result.data;
    const bureauData: BureauData = {
      cibilScore: exp.score ?? 0,
      cibilVintageMonths: exp.vintageMonths ?? 0,
      totalTradeLines: exp.totalAccounts ?? 0,
      unsecuredTradeLines: exp.unsecuredAccounts ?? 0,
      securedTradeLines: exp.securedAccounts ?? 0,
      unsecuredToSecuredRatio: exp.securedAccounts > 0
        ? exp.unsecuredAccounts / exp.securedAccounts : exp.unsecuredAccounts,
      activeTradeLines: exp.activeAccounts ?? 0,
      dpd30Last6Months: exp.dpd30Last6M ?? 0,
      dpd60Last12Months: exp.dpd60Last12M ?? 0,
      dpd90Ever: exp.dpd90Plus ?? 0,
      writtenOffOrSettledCount: exp.writeOffs ?? 0,
      imputedIncome: 0,
      totalOutstandingDebt: exp.outstandingBalance ?? 0,
      existingMonthlyEmiObligations: exp.monthlyEmi ?? 0,
      enquiriesLast30Days: exp.enquiries30Days ?? 0,
      enquiriesLast90Days: exp.enquiries90Days ?? 0,
      creditUtilisationRatio: exp.utilisation ?? 0,
      oldestTradeLineAgeMonths: exp.oldestAccount ?? 0,
      tradeLineDetails: [],
      bureauSource: BureauSource.EXPERIAN,
      reportFetchedAt: new Date().toISOString(),
      rawReportId: exp.reportId ?? '',
    };

    return { success: true, data: bureauData, latencyMs: result.latencyMs, provider: 'Experian' };
  }

  private markFallbackUsed(): void {
    if (this.callLog.length > 0) {
      this.callLog[this.callLog.length - 1].fallbackUsed = true;
    }
  }
}
