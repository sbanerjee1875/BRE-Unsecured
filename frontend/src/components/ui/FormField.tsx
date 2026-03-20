import React from 'react';

interface Props {
  label: string;
  name: string;
  value: string;
  onChange: (name: string, value: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  readOnly?: boolean;
  prefix?: string;
  maxLength?: number;
}

export default function FormField({
  label, name, value, onChange, error, type = 'text',
  placeholder, required, readOnly, prefix, maxLength,
}: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className={prefix ? 'flex' : ''}>
        {prefix && (
          <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
            {prefix}
          </span>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={(e) => onChange(name, e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          maxLength={maxLength}
          className={`block w-full px-3 py-2 border rounded-md shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
            prefix ? 'rounded-l-none' : ''
          } ${error ? 'border-red-300 bg-red-50' : 'border-gray-300'} ${
            readOnly ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
