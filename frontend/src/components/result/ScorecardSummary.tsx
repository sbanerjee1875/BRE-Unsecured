import React from 'react';
import type { UnderwritingResponse } from '../../types/api';

interface Props {
  response: UnderwritingResponse;
}

const MODULES = [
  { key: 'bureauScore', label: 'Bureau Score', max: 300, color: 'bg-blue-500' },
  { key: 'bureauBehaviour', label: 'Bureau Behaviour', max: 200, color: 'bg-indigo-500' },
  { key: 'incomeFoir', label: 'Income / FOIR', max: 150, color: 'bg-green-500' },
  { key: 'employerDemographics', label: 'Employer & Demographics', max: 100, color: 'bg-yellow-500' },
  { key: 'alternateBehavioural', label: 'Alternate Behavioural', max: 200, color: 'bg-purple-500' },
  { key: 'fraudRisk', label: 'Fraud Risk', max: 50, color: 'bg-red-500' },
] as const;

export default function ScorecardSummary({ response }: Props) {
  const scores = response.scorecard.moduleScores;
  const foir = response.foirSummary;

  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">
        Scorecard — {scores.total}/1000
        <span className="ml-2 text-sm font-normal text-gray-500">Band: {response.scorecard.scoreBand}</span>
      </h3>

      <div className="space-y-3 mb-6">
        {MODULES.map(({ key, label, max, color }) => {
          const val = scores[key];
          const pct = Math.min((val / max) * 100, 100);
          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium">{val}/{max}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t pt-4">
        <h4 className="font-medium text-gray-800 mb-3">FOIR Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><span className="text-gray-500 block">Existing EMI</span><span className="font-medium">₹{foir.existingMonthlyEmi.toLocaleString('en-IN')}</span></div>
          <div><span className="text-gray-500 block">Proposed EMI</span><span className="font-medium">₹{foir.proposedNewEmi.toLocaleString('en-IN')}</span></div>
          <div><span className="text-gray-500 block">FOIR Pre-Loan</span><span className="font-medium">{(foir.foirPreLoan * 100).toFixed(1)}%</span></div>
          <div>
            <span className="text-gray-500 block">FOIR Post-Loan</span>
            <span className={`font-medium ${foir.foirBreached ? 'text-red-600' : 'text-green-600'}`}>
              {(foir.foirPostLoan * 100).toFixed(1)}%{foir.foirBreached ? ' (Breached)' : ''}
            </span>
          </div>
        </div>
      </div>

      {response.hardGatesTriggered.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h4 className="font-medium text-red-700 mb-2">Hard Gates Triggered</h4>
          <div className="space-y-1">
            {response.hardGatesTriggered.filter(g => g.triggered).map((gate) => (
              <div key={gate.ruleId} className="text-sm flex justify-between bg-red-50 px-3 py-2 rounded">
                <span>{gate.ruleId}: {gate.ruleName}</span>
                {gate.value !== undefined && <span className="text-red-600 font-medium">{gate.value}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
