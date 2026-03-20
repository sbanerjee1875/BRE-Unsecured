export interface PersonalData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: string;
  gender: string;
  panNumber: string;
  aadhaarNumber: string;
  mobile: string;
  email: string;
}

export interface EmploymentData {
  employerName: string;
  employerCategory: string;
  employmentTenureMonths: string;
  netMonthlySalary: string;
  grossAnnualIncome: string;
  salaryAccountBank: string;
}

export interface AddressData {
  residenceType: string;
  addressLine1: string;
  city: string;
  state: string;
  pinCode: string;
}

export interface LoanData {
  requestedAmount: string;
  requestedTenure: string;
  purpose: string;
  channel: string;
}

export interface DeviceConsentData {
  osType: string;
  osVersion: string;
  appVersion: string;
  bureauConsent: boolean;
  aaConsent: boolean;
  smsConsent: boolean;
  locationConsent: boolean;
  appographyConsent: boolean;
}

export interface FormState {
  currentStep: number;
  personal: PersonalData;
  employment: EmploymentData;
  address: AddressData;
  loan: LoanData;
  deviceConsent: DeviceConsentData;
}

export type StepErrors = Record<string, string>;
