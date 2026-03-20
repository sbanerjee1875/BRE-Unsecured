import { useReducer } from 'react';
import type { FormState, StepErrors } from '../types/form';
import { validatePersonal, validateEmployment, validateAddress, validateLoan, validateDeviceConsent } from '../utils/validation';

const initialState: FormState = {
  currentStep: 0,
  personal: {
    firstName: '', lastName: '', dateOfBirth: '', age: '',
    gender: '', panNumber: '', aadhaarNumber: '', mobile: '', email: '',
  },
  employment: {
    employerName: '', employerCategory: '', employmentTenureMonths: '',
    netMonthlySalary: '', grossAnnualIncome: '', salaryAccountBank: '',
  },
  address: {
    residenceType: '', addressLine1: '', city: '', state: '', pinCode: '',
  },
  loan: {
    requestedAmount: '', requestedTenure: '', purpose: '', channel: 'DIGITAL',
  },
  deviceConsent: {
    osType: '', osVersion: '', appVersion: '',
    bureauConsent: true, aaConsent: true,
    smsConsent: false, locationConsent: false, appographyConsent: false,
  },
};

type Action =
  | { type: 'UPDATE_FIELD'; section: keyof Omit<FormState, 'currentStep'>; name: string; value: string }
  | { type: 'TOGGLE_CONSENT'; name: string; checked: boolean }
  | { type: 'SET_STEP'; step: number };

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case 'UPDATE_FIELD':
      return { ...state, [action.section]: { ...state[action.section], [action.name]: action.value } };
    case 'TOGGLE_CONSENT':
      return { ...state, deviceConsent: { ...state.deviceConsent, [action.name]: action.checked } };
    case 'SET_STEP':
      return { ...state, currentStep: action.step };
    default:
      return state;
  }
}

const validators = [validatePersonal, validateEmployment, validateAddress, validateLoan, validateDeviceConsent];
const sections: (keyof Omit<FormState, 'currentStep'>)[] = ['personal', 'employment', 'address', 'loan', 'deviceConsent'];

export function useFormWizard() {
  const [form, dispatch] = useReducer(reducer, initialState);

  const updateField = (section: keyof Omit<FormState, 'currentStep'>) => (name: string, value: string) => {
    dispatch({ type: 'UPDATE_FIELD', section, name, value });
  };

  const toggleConsent = (name: string, checked: boolean) => {
    dispatch({ type: 'TOGGLE_CONSENT', name, checked });
  };

  const validateStep = (step: number): StepErrors => {
    if (step >= validators.length) return {};
    return validators[step](form[sections[step]] as any);
  };

  const goToStep = (step: number) => dispatch({ type: 'SET_STEP', step });

  const nextStep = (): StepErrors => {
    const errors = validateStep(form.currentStep);
    if (Object.keys(errors).length === 0 && form.currentStep < 5) {
      dispatch({ type: 'SET_STEP', step: form.currentStep + 1 });
    }
    return errors;
  };

  const prevStep = () => {
    if (form.currentStep > 0) dispatch({ type: 'SET_STEP', step: form.currentStep - 1 });
  };

  return { form, updateField, toggleConsent, validateStep, nextStep, prevStep, goToStep, sections };
}
