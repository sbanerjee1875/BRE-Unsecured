import React from 'react';
import FormField from '../ui/FormField';
import SelectField from '../ui/SelectField';
import type { LoanData, StepErrors } from '../../types/form';
import { LOAN_PURPOSE_OPTIONS, CHANNEL_OPTIONS } from '../../utils/constants';

interface Props {
  data: LoanData;
  errors: StepErrors;
  onChange: (name: string, value: string) => void;
}

export default function LoanDetailsStep({ data, errors, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Loan Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Requested Amount" name="requestedAmount" value={data.requestedAmount} onChange={onChange} error={errors.requestedAmount} required type="number" prefix="₹" placeholder="500000" />
        <FormField label="Requested Tenure (months)" name="requestedTenure" value={data.requestedTenure} onChange={onChange} error={errors.requestedTenure} required type="number" placeholder="36" />
        <SelectField label="Loan Purpose" name="purpose" value={data.purpose} onChange={onChange} options={LOAN_PURPOSE_OPTIONS} error={errors.purpose} required />
        <SelectField label="Channel" name="channel" value={data.channel} onChange={onChange} options={CHANNEL_OPTIONS} error={errors.channel} required />
      </div>
      <div className="mt-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
        Amount: 50,000 - 25,00,000 | Tenure: 12-60 months
      </div>
    </div>
  );
}
