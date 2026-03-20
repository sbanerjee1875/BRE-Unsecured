import React from 'react';
import FormField from '../ui/FormField';
import SelectField from '../ui/SelectField';
import type { AddressData, StepErrors } from '../../types/form';
import { RESIDENCE_TYPE_OPTIONS, INDIAN_STATES } from '../../utils/constants';

interface Props {
  data: AddressData;
  errors: StepErrors;
  onChange: (name: string, value: string) => void;
}

const STATE_OPTIONS = [
  { value: '', label: 'Select State' },
  ...INDIAN_STATES.map((s) => ({ value: s, label: s })),
];

export default function AddressStep({ data, errors, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Address Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SelectField label="Residence Type" name="residenceType" value={data.residenceType} onChange={onChange} options={RESIDENCE_TYPE_OPTIONS} error={errors.residenceType} required />
        <div className="md:col-span-2">
          <FormField label="Address Line 1" name="addressLine1" value={data.addressLine1} onChange={onChange} placeholder="Optional (e.g. Flat 4B, Marine Lines)" />
        </div>
        <FormField label="City" name="city" value={data.city} onChange={onChange} error={errors.city} required placeholder="Mumbai" />
        <SelectField label="State" name="state" value={data.state} onChange={onChange} options={STATE_OPTIONS} error={errors.state} required />
        <FormField label="PIN Code" name="pinCode" value={data.pinCode} onChange={onChange} error={errors.pinCode} required placeholder="400001" maxLength={6} />
      </div>
    </div>
  );
}
