import React from 'react';

function FinalSummarySection({ assignedFund, availableFund, totalUtilized, endingBalance, onSave }) {
  // Only check when the assigned fund was actually passed in, and compare in cents
  // so tiny decimal differences don't trigger the alert.
  const hasAssigned = Number.isFinite(assignedFund);
  const exceedsAssigned =
    hasAssigned && Math.round(endingBalance * 100) > Math.round(assignedFund * 100);

  return (
    <div className="section final-summary-section">
      <h2>Balance Calculation</h2>
      <div className="calculation-row">
        <div className="calc-box">
          <label htmlFor="summaryAvailableFund">Available Fund For Use</label>
          <input
            type="text"
            id="summaryAvailableFund"
            value={`Php ${availableFund.toFixed(2)}`}
            readOnly
          />
        </div>

        <span className="calc-operator">&minus;</span>

        <div className="calc-box">
          <label htmlFor="totalFundUtilized">Total Fund Utilized</label>
          <input
            type="text"
            id="totalFundUtilized"
            value={`Php ${totalUtilized.toFixed(2)}`}
            readOnly
          />
        </div>

        <span className="calc-operator">=</span>

        <div className="calc-box ending-balance-box">
          <label htmlFor="endingFundBalance">Ending Fund Balance</label>
          <input
            type="text"
            id="endingFundBalance"
            value={`Php ${endingBalance.toFixed(2)}`}
            readOnly
            className={exceedsAssigned ? 'input-error' : ''}
            aria-invalid={exceedsAssigned}
          />
        </div>
      </div>

      {/* The alert sits below the row, so the three boxes always stay the same height */}
      {exceedsAssigned && (
        <p className="balance-alert" role="alert">
          Ending Fund Balance exceeds the Assigned Fund of PHP {assignedFund.toFixed(2)}. Please adjust your entries.
        </p>
      )}

      <button
        type="button"
        className="save-button"
        onClick={onSave}
        disabled={exceedsAssigned}
        title={exceedsAssigned ? 'Ending balance cannot exceed the assigned fund' : ''}
      >
        Save FLR
      </button>
    </div>
  );
}

export default FinalSummarySection;