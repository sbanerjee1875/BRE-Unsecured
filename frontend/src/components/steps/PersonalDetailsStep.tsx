import React from 'react';
import FormField from '../ui/FormField';
import SelectField from '../ui/SelectField';
import type { PersonalData, StepErrors } from '../../types/form';
import { GENDER_OPTIONS } from '../../utils/constants';

interface Props {
  data: PersonalData;
  errors: StepErrors;
  onChange: (name: string, value: string) => void;
}

function calculateAge(dob: string): string {
  if (!dob) return '';
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age.toString() : '';
}

export default function PersonalDetailsStep({ data, errors, onChange }: Props) {
  const handleChange = (name: string, value: string) => {
    onChange(name, value);
    if (name === 'dateOfBirth') {
      onChange('age', calculateAge(value));
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Personal Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="First Name" name="firstName" value={data.firstName} onChange={handleChange} error={errors.firstName} required placeholder="Rahul" />
        <FormField label="Last Name" name="lastName" value={data.lastName} onChange={handleChange} error={errors.lastName} required placeholder="Sharma" />
        <FormField label="Date of Birth" name="dateOfBirth" value={data.dateOfBirth} onChange={handleChange} error={errors.dateOfBirth} required type="date" />
        <FormField label="Age" name="age" value={data.age} onChange={handleChange} error={errors.age} readOnly />
        <SelectField label="Gender" name="gender" value={data.gender} onChange={handleChange} options={GENDER_OPTIONS} error={errors.gender} required />
        <FormField label="PAN Number" name="panNumber" value={data.panNumber} onChange={(n, v) => handleChange(n, v.toUpperCase())} error={errors.panNumber} required placeholder="ABCDE1234F" maxLength={10} />
        <FormField label="Aadhaar (last 4 digits)" name="aadhaarNumber" value={data.aadhaarNumber} onChange={handleChange} placeholder="Optional" maxLength={4} />
        <FormField label="Mobile Number" name="mobile" value={data.mobile} onChange={handleChange} error={errors.mobile} required placeholder="+919876543210" />
        <FormField label="Email" name="email" value={data.email} onChange={handleChange} error={errors.email} required placeholder="rahul@example.com" type="email" />
      </div>
    </div>
  );
}
