import type { FormState } from '../types/form';
import { sha256Hex } from './hashPan';
import { DEMO_CONSENT_TOKEN } from './constants';

export async function generatePayload(form: FormState) {
  const panHashed = await sha256Hex(form.personal.panNumber.toUpperCase());
  const deviceId = await sha256Hex(navigator.userAgent + Date.now().toString());
  const deviceFingerprint = 'fp_' + deviceId.substring(0, 12);

  return {
    applicationId: `PL-2024-${crypto.randomUUID()}`,
    channel: form.loan.channel,
    applicant: {
      panNumber: panHashed,
      aadhaarNumber: form.personal.aadhaarNumber || undefined,
      mobile: form.personal.mobile,
      email: form.personal.email,
      dateOfBirth: form.personal.dateOfBirth,
      age: parseInt(form.personal.age),
      gender: form.personal.gender,
      firstName: form.personal.firstName,
      lastName: form.personal.lastName,
    },
    financials: {
      netMonthlySalary: parseFloat(form.employment.netMonthlySalary),
      grossAnnualIncome: parseFloat(form.employment.grossAnnualIncome),
      employerName: form.employment.employerName,
      employerCategory: form.employment.employerCategory || undefined,
      employmentTenureMonths: parseInt(form.employment.employmentTenureMonths),
      salaryAccountBank: form.employment.salaryAccountBank || undefined,
    },
    address: {
      residenceType: form.address.residenceType,
      pinCode: form.address.pinCode,
      city: form.address.city,
      state: form.address.state,
      addressLine1: form.address.addressLine1 || undefined,
    },
    loanRequest: {
      requestedAmount: parseFloat(form.loan.requestedAmount),
      requestedTenure: parseInt(form.loan.requestedTenure),
      purpose: form.loan.purpose,
    },
    consentTokens: {
      bureauConsent: DEMO_CONSENT_TOKEN,
      aaConsent: DEMO_CONSENT_TOKEN,
      smsConsent: form.deviceConsent.smsConsent ? DEMO_CONSENT_TOKEN : undefined,
      locationConsent: form.deviceConsent.locationConsent ? DEMO_CONSENT_TOKEN : undefined,
      appographyConsent: form.deviceConsent.appographyConsent ? DEMO_CONSENT_TOKEN : undefined,
    },
    deviceData: {
      deviceId,
      osType: form.deviceConsent.osType,
      osVersion: form.deviceConsent.osVersion,
      appVersion: form.deviceConsent.appVersion,
      deviceFingerprint,
    },
    requestTimestamp: new Date().toISOString(),
  };
}
