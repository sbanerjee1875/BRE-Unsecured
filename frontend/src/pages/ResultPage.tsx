import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import type { UnderwritingResponse } from '../types/api';
import DecisionBanner from '../components/result/DecisionBanner';
import LoanOfferCard from '../components/result/LoanOfferCard';
import ScorecardSummary from '../components/result/ScorecardSummary';

export default function ResultPage() {
  const location = useLocation();
  const result = (location.state as any)?.result as UnderwritingResponse | undefined;

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Result Found</h2>
          <p className="text-gray-500 mb-4">Please submit a loan application first.</p>
          <Link to="/apply" className="text-blue-600 hover:text-blue-800 font-medium">Start Application</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Application Result</h1>
            <p className="text-sm text-gray-500">ID: {result.applicationId} | Processed in {result.processingTimeMs}ms</p>
          </div>
          <Link to="/apply" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
            New Application
          </Link>
        </div>

        <DecisionBanner decision={result.decision} decisionCode={result.decisionCode} decisionReason={result.decisionReason} />

        {result.offer && <LoanOfferCard offer={result.offer} />}

        <ScorecardSummary response={result} />

        {result.softFlagsTriggered.length > 0 && (
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-amber-700 mb-3">Soft Flags</h3>
            <div className="flex flex-wrap gap-2">
              {result.softFlagsTriggered.map((flag, i) => (
                <span key={i} className="px-3 py-1 bg-amber-50 text-amber-700 text-sm rounded-full border border-amber-200">{flag}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
