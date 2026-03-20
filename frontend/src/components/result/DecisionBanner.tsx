import React from 'react';

interface Props {
  decision: 'APPROVE' | 'DECLINE' | 'REFER';
  decisionCode: string;
  decisionReason: string;
}

const STYLES = {
  APPROVE: 'bg-green-50 border-green-500 text-green-800',
  DECLINE: 'bg-red-50 border-red-500 text-red-800',
  REFER: 'bg-amber-50 border-amber-500 text-amber-800',
};

const ICONS = {
  APPROVE: (
    <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  DECLINE: (
    <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  REFER: (
    <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  ),
};

export default function DecisionBanner({ decision, decisionCode, decisionReason }: Props) {
  return (
    <div className={`border-l-4 rounded-lg p-6 ${STYLES[decision]}`}>
      <div className="flex items-center gap-3 mb-2">
        {ICONS[decision]}
        <h2 className="text-2xl font-bold">{decision === 'APPROVE' ? 'Approved' : decision === 'DECLINE' ? 'Declined' : 'Referred for Manual Review'}</h2>
      </div>
      <p className="text-sm opacity-80">Code: {decisionCode}</p>
      <p className="mt-1">{decisionReason}</p>
    </div>
  );
}
