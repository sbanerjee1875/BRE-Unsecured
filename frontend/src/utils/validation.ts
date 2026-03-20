import type { PersonalData, EmploymentData, AddressData, LoanData, DeviceConsentData, StepErrors } from '../types/form';

export function validatePersonal(data: PersonalData): StepErrors {
  const errors: StepErrors = {};

  if (!data.firstName || data.firstName.length < 2 || data.firstName.length > 50)
    errors.firstName = 'First name must be 2-50 characters';

  if (!data.lastName || data.lastName.length < 1 || data.lastName.length > 50)
    errors.lastName = 'Last name is required (1-50 characters)';

  if (!data.dateOfBirth) {
    errors.dateOfBirth = 'Date of birth is required';
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.dateOfBirth)) {
    errors.dateOfBirth = 'Invalid date format';
  }

  const age = parseInt(data.age);
  if (!data.age || isNaN(age) || age < 18 || age > 70)
    errors.age = 'Age must be between 18 and 70';

  if (!data.gender) errors.gender = 'Gender is required';

  if (!data.panNumber || !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(data.panNumber.toUpperCase()))
    errors.panNumber = 'Enter valid PAN (e.g. ABCDE1234F)';

  if (!data.mobile || !/^\+91[6-9]\d{9}$/.test(data.mobile))
    errors.mobile = 'Enter valid mobile (+91XXXXXXXXXX)';

  if (!data.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))
    errors.email = 'Enter a valid email address';

  return errors;
}

export function validateEmployment(data: EmploymentData): StepErrors {
  const errors: StepErrors = {};

  if (!data.employerName || data.employerName.length < 2 || data.employerName.length > 200)
    errors.employerName = 'Employer name must be 2-200 characters';

  const tenure = parseInt(data.employmentTenureMonths);
  if (!data.employmentTenureMonths || isNaN(tenure) || tenure < 0 || tenure > 600)
    errors.employmentTenureMonths = 'Tenure must be 0-600 months';

  const salary = parseFloat(data.netMonthlySalary);
  if (!data.netMonthlySalary || isNaN(salary) || salary < 1 || salary > 10000000)
    errors.netMonthlySalary = 'Salary must be between 1 and 1,00,00,000';

  const income = parseFloat(data.grossAnnualIncome);
  if (!data.grossAnnualIncome || isNaN(income) || income < 1)
    errors.grossAnnualIncome = 'Gross annual income is required';

  return errors;
}

export function validateAddress(data: AddressData): StepErrors {
  const errors: StepErrors = {};

  if (!data.residenceType) errors.residenceType = 'Residence type is required';

  if (!data.pinCode || !/^\d{6}$/.test(data.pinCode))
    errors.pinCode = 'Enter a valid 6-digit PIN code';

  if (!data.city || data.city.length < 2 || data.city.length > 100)
    errors.city = 'City must be 2-100 characters';

  if (!data.state || data.state.length < 2 || data.state.length > 100)
    errors.state = 'State is required';

  return errors;
}

export function validateLoan(data: LoanData): StepErrors {
  const errors: StepErrors = {};

  const amount = parseFloat(data.requestedAmount);
  if (!data.requestedAmount || isNaN(amount) || amount < 50000 || amount > 2500000)
    errors.requestedAmount = 'Amount must be between 50,000 and 25,00,000';

  const tenure = parseInt(data.requestedTenure);
  if (!data.requestedTenure || isNaN(tenure) || tenure < 12 || tenure > 60)
    errors.requestedTenure = 'Tenure must be 12-60 months';

  if (!data.purpose) errors.purpose = 'Loan purpose is required';
  if (!data.channel) errors.channel = 'Channel is required';

  return errors;
}

export function validateDeviceConsent(data: DeviceConsentData): StepErrors {
  const errors: StepErrors = {};

  if (!data.osType) errors.osType = 'OS type is required';
  if (!data.osVersion) errors.osVersion = 'OS version is required';
  if (!data.appVersion) errors.appVersion = 'App version is required';
  if (!data.bureauConsent) errors.bureauConsent = 'Bureau consent is mandatory';
  if (!data.aaConsent) errors.aaConsent = 'Account Aggregator consent is mandatory';

  return errors;
}
