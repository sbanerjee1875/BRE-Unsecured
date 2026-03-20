import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProgressBar from '../components/ui/ProgressBar';
import Spinner from '../components/ui/Spinner';
import PersonalDetailsStep from '../components/steps/PersonalDetailsStep';
import EmploymentFinancialStep from '../components/steps/EmploymentFinancialStep';
import AddressStep from '../components/steps/AddressStep';
import LoanDetailsStep from '../components/steps/LoanDetailsStep';
import DeviceConsentStep from '../components/steps/DeviceConsentStep';
import ReviewStep from '../components/steps/ReviewStep';
import { useFormWizard } from '../hooks/useFormWizard';
import { useSubmitApplication } from '../hooks/useSubmitApplication';
import type { StepErrors } from '../types/form';

export default function FormWizardPage() {
  const { form, updateField, toggleConsent, nextStep, prevStep, goToStep } = useFormWizard();
  const { loading, result, error, submit } = useSubmitApplication();
  const [errors, setErrors] = useState<StepErrors>({});
  const navigate = useNavigate();

  const handleNext = () => {
    const stepErrors = nextStep();
    setErrors(stepErrors);
  };

  const handleSubmit = async () => {
    await submit(form);
  };

  const handleEdit = (step: number) => {
    goToStep(step);
    setErrors({});
  };

  if (result) {
    navigate('/result', { state: { result } });
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Loan Application</h1>
          <p className="text-sm text-gray-500">Fill in your details to get an instant underwriting decision</p>
        </div>

        <ProgressBar currentStep={form.currentStep} />

        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          {form.currentStep === 0 && <PersonalDetailsStep data={form.personal} errors={errors} onChange={updateField('personal')} />}
          {form.currentStep === 1 && <EmploymentFinancialStep data={form.employment} errors={errors} onChange={updateField('employment')} />}
          {form.currentStep === 2 && <AddressStep data={form.address} errors={errors} onChange={updateField('address')} />}
          {form.currentStep === 3 && <LoanDetailsStep data={form.loan} errors={errors} onChange={updateField('loan')} />}
          {form.currentStep === 4 && <DeviceConsentStep data={form.deviceConsent} errors={errors} onChange={updateField('deviceConsent')} onToggle={toggleConsent} />}
          {form.currentStep === 5 && <ReviewStep form={form} onEdit={handleEdit} />}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center">
            <Spinner />
            <p className="text-sm text-gray-500 mt-2">Processing your application...</p>
          </div>
        ) : (
          <div className="flex justify-between">
            <button
              onClick={prevStep}
              disabled={form.currentStep === 0}
              className="px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Back
            </button>

            {form.currentStep < 5 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-8 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Submit Application
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
