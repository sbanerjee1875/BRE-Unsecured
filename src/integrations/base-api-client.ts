// ============================================================
// integrations/base-api-client.ts
// Base HTTP client — retry, timeout, logging, error handling
// ============================================================

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiResponse, ApiCallLogEntry } from '../types';
import { logger } from '../utils/logger';

interface ApiClientConfig {
  apiId: string;
  provider: string;
  baseUrl: string;
  timeoutMs: number;
  maxRetries?: number;
  apiKey?: string;
  bearerToken?: string;
  headers?: Record<string, string>;
}

// Simple in-memory circuit breaker state
const circuitState: Map<string, { failures: number; openUntil: number }> = new Map();
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_DURATION_MS = 30_000;

export class BaseApiClient {
  protected client: AxiosInstance;
  protected config: ApiClientConfig;
  public callLog: ApiCallLogEntry[] = [];

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(config.apiKey && { 'X-API-Key': config.apiKey }),
        ...(config.bearerToken && { Authorization: `Bearer ${config.bearerToken}` }),
        ...config.headers,
      },
    });

    // Request interceptor — add correlation ID
    this.client.interceptors.request.use((req) => {
      req.headers['X-Correlation-Id'] = req.headers['X-Correlation-Id'] || generateId();
      return req;
    });
  }

  protected isCircuitOpen(): boolean {
    const state = circuitState.get(this.config.apiId);
    if (!state) return false;
    if (Date.now() > state.openUntil) {
      circuitState.delete(this.config.apiId);
      return false;
    }
    return state.failures >= CIRCUIT_FAILURE_THRESHOLD;
  }

  protected recordFailure(): void {
    const state = circuitState.get(this.config.apiId) || { failures: 0, openUntil: 0 };
    state.failures++;
    if (state.failures >= CIRCUIT_FAILURE_THRESHOLD) {
      state.openUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
      logger.warn(`Circuit breaker OPEN for ${this.config.apiId} — too many failures`);
    }
    circuitState.set(this.config.apiId, state);
  }

  protected recordSuccess(): void {
    circuitState.delete(this.config.apiId);
  }

  public async executeWithRetry<T>(
    requestFn: () => Promise<AxiosResponse<T>>,
    maxRetries: number = this.config.maxRetries ?? 3
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();

    if (this.isCircuitOpen()) {
      return {
        success: false,
        error: { code: 'CIRCUIT_OPEN', message: `${this.config.provider} circuit breaker is open`, retryable: false },
        latencyMs: 0,
        provider: this.config.provider,
      };
    }

    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await requestFn();
        const latencyMs = Date.now() - startTime;

        this.recordSuccess();
        this.logCall(200, latencyMs, true);

        return {
          success: true,
          data: response.data,
          latencyMs,
          provider: this.config.provider,
        };
      } catch (err: any) {
        lastError = err;
        const statusCode = err.response?.status ?? 0;
        const latencyMs = Date.now() - startTime;

        // Do not retry on 4xx (client errors — bad request, auth failure)
        if (statusCode >= 400 && statusCode < 500) {
          this.logCall(statusCode, latencyMs, false);
          this.recordFailure();
          return {
            success: false,
            error: {
              code: `HTTP_${statusCode}`,
              message: err.response?.data?.message ?? err.message,
              retryable: false,
            },
            latencyMs,
            provider: this.config.provider,
          };
        }

        attempt++;
        if (attempt <= maxRetries) {
          const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 8000); // 1s, 2s, 4s, 8s
          logger.warn(`[${this.config.apiId}] Attempt ${attempt} failed. Retrying in ${backoffMs}ms...`);
          await sleep(backoffMs);
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    this.recordFailure();
    this.logCall(0, latencyMs, false);

    return {
      success: false,
      error: {
        code: 'MAX_RETRIES_EXCEEDED',
        message: lastError?.message ?? 'All retry attempts exhausted',
        retryable: true,
      },
      latencyMs,
      provider: this.config.provider,
    };
  }

  private logCall(statusCode: number, latencyMs: number, success: boolean): void {
    const entry: ApiCallLogEntry = {
      apiId: this.config.apiId,
      provider: this.config.provider,
      statusCode,
      latencyMs,
      success,
      fallbackUsed: false,
      timestamp: new Date().toISOString(),
    };
    this.callLog.push(entry);
    logger.info(`[API] ${this.config.apiId} | ${statusCode} | ${latencyMs}ms | ${success ? 'OK' : 'FAIL'}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
