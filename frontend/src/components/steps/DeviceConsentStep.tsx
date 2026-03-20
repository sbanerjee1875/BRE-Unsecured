import React from 'react';
import FormField from '../ui/FormField';
import SelectField from '../ui/SelectField';
import type { DeviceConsentData, StepErrors } from '../../types/form';
import { OS_TYPE_OPTIONS } from '../../utils/constants';

interface Props {
  data: DeviceConsentData;
  errors: StepErrors;
  onChange: (name: string, value: string) => void;
  onToggle: (name: string, checked: boolean) => void;
}

export default function DeviceConsentStep({ data, errors, onChange, onToggle }: Props) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Device & Consent</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <SelectField label="OS Type" name="osType" value={data.osType} onChange={onChange} options={OS_TYPE_OPTIONS} error={errors.osType} required />
        <FormField label="OS Version" name="osVersion" value={data.osVersion} onChange={onChange} error={errors.osVersion} required placeholder="14.0" />
        <FormField label="App Version" name="appVersion" value={data.appVersion} onChange={onChange} error={errors.appVersion} required placeholder="3.2.1" />
      </div>

      <div className="border-t pt-4">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Consent Permissions</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={data.bureauConsent} onChange={(e) => onToggle('bureauConsent', e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-gray-300" />
            <span className="text-sm">
              Bureau Consent <span className="text-red-500">*</span>
              <span className="text-gray-500 ml-1">(Required - Credit bureau check)</span>
            </span>
          </label>
          {errors.bureauConsent && <p className="text-xs text-red-600 ml-7">{errors.bureauConsent}</p>}

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={data.aaConsent} onChange={(e) => onToggle('aaConsent', e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-gray-300" />
            <span className="text-sm">
              Account Aggregator Consent <span className="text-red-500">*</span>
              <span className="text-gray-500 ml-1">(Required - Bank statement analysis)</span>
            </span>
          </label>
          {errors.aaConsent && <p className="text-xs text-red-600 ml-7">{errors.aaConsent}</p>}

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={data.smsConsent} onChange={(e) => onToggle('smsConsent', e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-gray-300" />
            <span className="text-sm">SMS Consent <span className="text-gray-500 ml-1">(Optional - SMS transaction analysis)</span></span>
          </label>

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={data.locationConsent} onChange={(e) => onToggle('locationConsent', e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-gray-300" />
            <span className="text-sm">Location Consent <span className="text-gray-500 ml-1">(Optional - Location verification)</span></span>
          </label>

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={data.appographyConsent} onChange={(e) => onToggle('appographyConsent', e.target.checked)} className="h-4 w-4 text-blue-600 rounded border-gray-300" />
            <span className="text-sm">Appography Consent <span className="text-gray-500 ml-1">(Optional - App usage analysis)</span></span>
          </label>
        </div>
      </div>
    </div>
  );
}
