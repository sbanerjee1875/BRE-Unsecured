import React from 'react';
import type { LoanOffer } from '../../types/api';
import { formatINR } from '../../utils/formatCurrency';

interface Props {
  offer: LoanOffer;
}

export default function LoanOfferCard({ offer }: Props) {
  return (
    <div className="bg-white border rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Loan Offer</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-gray-500 uppercase">Approved Amount</p>
          <p className="text-xl font-bold text-green-600">{formatINR(offer.approvedAmount)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Interest Rate</p>
          <p className="text-xl font-bold text-gray-800">{offer.interestRate}% p.a.</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Monthly EMI</p>
          <p className="text-xl font-bold text-blue-600">{formatINR(offer.emi)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Tenure</p>
          <p className="text-lg font-semibold">{offer.tenure} months</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Processing Fee</p>
          <p className="text-lg font-semibold">{formatINR(offer.processingFee)} ({offer.processingFeePercent}%)</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase">Total Payable</p>
          <p className="text-lg font-semibold">{formatINR(offer.totalAmountPayable)}</p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t text-sm text-gray-500">
        Max eligible: {formatINR(offer.maxEligibleAmount)} | Total interest: {formatINR(offer.totalInterestPayable)} | Valid till: {new Date(offer.offerValidTill).toLocaleDateString('en-IN')}
      </div>
    </div>
  );
}
