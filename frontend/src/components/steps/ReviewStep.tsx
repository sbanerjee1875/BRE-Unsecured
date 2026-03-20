import React from 'react';
import type { FormState } from '../../types/form';

interface Props {
  form: FormState;
  onEdit: (step: number) => void;
}

function Section({ title, step, onEdit, children }: { title: string; step: number; onEdit: (s: number) => void; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-800">{title}</h3>
        <button onClick={() => onEdit(step)} className="text-sm text-blue-600 hover:text-blue-800">Edit</button>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-800 font-medium">{value || '-'}</span>
    </>
  );
}

export default function ReviewStep({ form, onEdit }: Props) {
  const { personal: p, employment: e, address: a, loan: l, deviceConsent: d } = form;
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Review & Submit</h2>
      <p className="text-sm text-gray-500 mb-4">Please review your application details before submitting.</p>

      <Section title="Personal Details" step={0} onEdit={onEdit}>
        <Field label="Name" value={`${p.firstName} ${p.lastName}`} />
        <Field label="DOB / Age" value={`${p.dateOfBirth} (${p.age} yrs)`} />
        <Field label="Gender" value={p.gender} />
        <Field label="PAN" value={p.panNumber ? `${p.panNumber.substring(0, 4)}****${p.panNumber.slice(-1)}` : ''} />
        <Field label="Mobile" value={p.mobile} />
        <Field label="Email" value={p.email} />
      </Section>

      <Section title="Employment & Financial" step={1} onEdit={onEdit}>
        <Field label="Employer" value={e.employerName} />
        <Field label="Category" value={e.employerCategory || 'Not specified'} />
        <Field label="Tenure" value={`${e.employmentTenureMonths} months`} />
        <Field label="Monthly Salary" value={`₹${Number(e.netMonthlySalary).toLocaleString('en-IN')}`} />
        <Field label="Annual Income" value={`₹${Number(e.grossAnnualIncome).toLocaleString('en-IN')}`} />
        <Field label="Salary Bank" value={e.salaryAccountBank || 'Not specified'} />
      </Section>

      <Section title="Address" step={2} onEdit={onEdit}>
        <Field label="Residence" value={a.residenceType} />
        <Field label="Address" value={a.addressLine1 || 'Not specified'} />
        <Field label="City" value={a.city} />
        <Field label="State" value={a.state} />
        <Field label="PIN Code" value={a.pinCode} />
      </Section>

      <Section title="Loan Details" step={3} onEdit={onEdit}>
        <Field label="Amount" value={`₹${Number(l.requestedAmount).toLocaleString('en-IN')}`} />
        <Field label="Tenure" value={`${l.requestedTenure} months`} />
        <Field label="Purpose" value={l.purpose.replace(/_/g, ' ')} />
        <Field label="Channel" value={l.channel} />
      </Section>

      <Section title="Device & Consent" step={4} onEdit={onEdit}>
        <Field label="OS" value={`${d.osType} ${d.osVersion}`} />
        <Field label="App Version" value={d.appVersion} />
        <Field label="Bureau Consent" value={d.bureauConsent ? 'Yes' : 'No'} />
        <Field label="AA Consent" value={d.aaConsent ? 'Yes' : 'No'} />
        <Field label="SMS Consent" value={d.smsConsent ? 'Yes' : 'No'} />
        <Field label="Location Consent" value={d.locationConsent ? 'Yes' : 'No'} />
      </Section>
    </div>
  );
}
