import React from 'react';

function SummarySection({ assignedFund, fundBalance, replenishment, availableFund, onSummaryChange }) {
  return (
    <div className="section summary-section">
      <h2>Fund Summary</h2>
      <div className="form-group">
        <label htmlFor="assignedFund">Assigned Fund:</label>
        <input 
          type="number" 
          id="assignedFund" 
          value={assignedFund} 
          step="0.01" 
          onChange={(e) => onSummaryChange('assignedFund', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="fundBalance">Beginning Fund Balance:</label>
        <input 
          type="number" 
          id="fundBalance" 
          value={fundBalance} 
          step="0.01" 
          onChange={(e) => onSummaryChange('fundBalance', e.target.value)}
        />
      </div>
      <div className="form-group">
        <label htmlFor="replenishment">
          Replenishment of Previous Liquidation:
        </label>
        <input 
          type="number" 
          id="replenishment" 
          value={replenishment} 
          step="0.01" 
          onChange={(e) => onSummaryChange('replenishment', e.target.value)}
        />
      </div>
      <div className="form-group total-group">
        <label htmlFor="availableFund">Available Fund for Use:</label>
        <input 
          type="text" 
          id="availableFund" 
          value={availableFund.toFixed(2)} 
          readOnly 
        />
      </div>
    </div>
  );
}

export default SummarySection;