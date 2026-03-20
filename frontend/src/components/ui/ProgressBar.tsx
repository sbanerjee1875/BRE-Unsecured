import React from 'react';
import { STEP_LABELS } from '../../utils/constants';

interface Props {
  currentStep: number;
}

export default function ProgressBar({ currentStep }: Props) {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex-1 flex flex-col items-center relative">
            {i > 0 && (
              <div
                className={`absolute top-4 -left-1/2 w-full h-0.5 ${
                  i <= currentStep ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              />
            )}
            <div
              className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                i < currentStep
                  ? 'bg-blue-600 text-white'
                  : i === currentStep
                  ? 'bg-blue-600 text-white ring-4 ring-blue-100'
                  : 'bg-gray-200 text-gray-500'
              }`}
            >
              {i < currentStep ? (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </div>
            <span
              className={`mt-2 text-xs text-center hidden sm:block ${
                i <= currentStep ? 'text-blue-600 font-medium' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
