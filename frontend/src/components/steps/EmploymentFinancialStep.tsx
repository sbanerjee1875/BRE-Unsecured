import React from 'react';
import FormField from '../ui/FormField';
import SelectField from '../ui/SelectField';
import type { EmploymentData, StepErrors } from '../../types/form';
import { EMPLOYER_CATEGORY_OPTIONS } from '../../utils/constants';

interface Props {
  data: EmploymentData;
  errors: StepErrors;
  onChange: (name: string, value: string) => void;
}

export default function EmploymentFinancialStep({ data, errors, onChange }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Employment & Financial Details</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Employer Name" name="employerName" value={data.employerName} onChange={onChange} error={errors.employerName} required placeholder="Tata Consultancy Services" />
        <SelectField label="Employer Category" name="employerCategory" value={data.employerCategory} onChange={onChange} options={EMPLOYER_CATEGORY_OPTIONS} error={errors.employerCategory} />
        <FormField label="Employment Tenure (months)" name="employmentTenureMonths" value={data.employmentTenureMonths} onChange={onChange} error={errors.employmentTenureMonths} required type="number" placeholder="36" />
        <FormField label="Net Monthly Salary" name="netMonthlySalary" value={data.netMonthlySalary} onChange={onChange} error={errors.netMonthlySalary} required type="number" prefix="₹" placeholder="75000" />
        <FormField label="Gross Annual Income" name="grossAnnualIncome" value={data.grossAnnualIncome} onChange={onChange} error={errors.grossAnnualIncome} required type="number" prefix="₹" placeholder="1080000" />
        <FormField label="Salary Account Bank" name="salaryAccountBank" value={data.salaryAccountBank} onChange={onChange} placeholder="Optional (e.g. HDFC Bank)" />
      </div>
    </div>
  );
}
