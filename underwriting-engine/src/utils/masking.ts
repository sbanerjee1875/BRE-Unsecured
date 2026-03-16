// ============================================================
// utils/masking.ts — PII Masking per DPDP Act 2023
// ============================================================

export function maskPan(pan: string): string {
  if (!pan || pan.length < 5) return '***';
  // Show first 2 + last 1 chars: ABXXX1234P → AB***P
  return pan.substring(0, 2) + '***' + pan.substring(pan.length - 1);
}

export function maskMobile(mobile: string): string {
  if (!mobile || mobile.length < 4) return '***';
  // Show last 4 digits: +919876543210 → ******3210
  return '***' + mobile.substring(mobile.length - 4);
}

export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 4) return 'XXXX';
  return 'XXXX-XXXX-' + aadhaar.substring(aadhaar.length - 4);
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  return local.substring(0, 2) + '***@' + domain;
}


// ============================================================
// utils/validator.ts — Joi request validation
// ============================================================

import Joi from 'joi';
import { UnderwritingRequest, Channel, OsType, LoanPurpose, ResidenceType } from '../types';

const applicantSchema = Joi.object({
  panNumber: Joi.string().length(64).required(),                  // SHA-256 hex
  aadhaarNumber: Joi.string().optional(),
  mobile: Joi.string().pattern(/^\+91[6-9]\d{9}$/).required(),  // E.164 Indian mobile
  email: Joi.string().email().required(),
  dateOfBirth: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  age: Joi.number().integer().min(18).max(70).required(),
  gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER').required(),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(1).max(50).required(),
});

const financialsSchema = Joi.object({
  netMonthlySalary: Joi.number().min(1).max(10_000_000).required(),
  grossAnnualIncome: Joi.number().min(1).required(),
  employerName: Joi.string().min(2).max(200).required(),
  employerCategory: Joi.string().valid('CAT_A', 'CAT_B', 'CAT_C', 'CAT_D').optional(),
  employmentTenureMonths: Joi.number().integer().min(0).max(600).required(),
  salaryAccountBank: Joi.string().optional(),
});

const addressSchema = Joi.object({
  residenceType: Joi.string().valid(...Object.values(ResidenceType)).required(),
  pinCode: Joi.string().pattern(/^\d{6}$/).required(),
  city: Joi.string().min(2).max(100).required(),
  state: Joi.string().min(2).max(100).required(),
  addressLine1: Joi.string().optional(),
});

const loanRequestSchema = Joi.object({
  requestedAmount: Joi.number()
    .min(parseInt(process.env.MIN_LOAN_AMOUNT ?? '50000'))
    .max(parseInt(process.env.MAX_LOAN_AMOUNT ?? '2500000'))
    .required(),
  requestedTenure: Joi.number()
    .integer()
    .min(parseInt(process.env.MIN_TENURE_MONTHS ?? '12'))
    .max(parseInt(process.env.MAX_TENURE_MONTHS ?? '60'))
    .required(),
  purpose: Joi.string().valid(...Object.values(LoanPurpose)).required(),
});

export const underwritingRequestSchema = Joi.object({
  applicationId: Joi.string().uuid().required(),
  channel: Joi.string().valid(...Object.values(Channel)).required(),
  applicant: applicantSchema.required(),
  financials: financialsSchema.required(),
  address: addressSchema.required(),
  loanRequest: loanRequestSchema.required(),
  consentTokens: Joi.object({
    bureauConsent: Joi.string().required(),
    aaConsent: Joi.string().required(),
    smsConsent: Joi.string().optional(),
    locationConsent: Joi.string().optional(),
    appographyConsent: Joi.string().optional(),
  }).required(),
  deviceData: Joi.object({
    deviceId: Joi.string().length(64).required(),
    osType: Joi.string().valid(...Object.values(OsType)).required(),
    osVersion: Joi.string().required(),
    appVersion: Joi.string().required(),
    deviceFingerprint: Joi.string().optional(),
  }).required(),
  requestTimestamp: Joi.string().isoDate().required(),
});

export function validateUnderwritingRequest(body: any): {
  value: UnderwritingRequest;
  error?: Joi.ValidationError;
} {
  return underwritingRequestSchema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
  }) as any;
}
