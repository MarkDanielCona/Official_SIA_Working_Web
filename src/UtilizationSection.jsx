import React, { useState } from "react";
import { COST_CENTERS } from "./data/costCenters";

function UtilizationSection({
  table1Rows,
  table2Rows,
  availableFund,
  onAddRow,
  onUpdateRow,
  onDeleteRow,
}) {
  const subtotal1 = table1Rows.reduce(
    (sum, r) => sum + (parseFloat(r.amount) || 0),
    0,
  );
  const subtotal2 = table2Rows.reduce(
    (sum, r) => sum + (parseFloat(r.amount) || 0),
    0,
  );

  const [warningb, setWarningb] = useState("");
  const [warning2, setWarning2] = useState("");
  const [warning1, setWarning1] = useState("");

  // Validates disbursement amounts according to script_2 rules
  const handleAmountBlur = (tableIndex, id, value) => {
    let numeric = parseFloat(value) || 0;
    
    if (tableIndex === 1 && numeric > 3000) {
      alert("Amount cannot exceed PHP 3,000 for this section.");
      numeric = 3000;
    }
    if (tableIndex === 2 && numeric < 3000) {
      alert(
        "Table 2 is restricted to disbursements of PHP 3,000 or more.",
      );
      numeric = 3000;
    }
    if (numeric < 0) {
      alert("Amount cannot be negative.");
      numeric = 0;
    }
    if (numeric > availableFund) {
      alert("Amount exceeds available fund.");
      numeric = 0;
    }

    onUpdateRow(tableIndex, id, "amount", numeric.toFixed(2));
  };

  const renderTable = (rows, tableIndex, title, subtitle, subtotal) => (
    <div className="section utilization-section">
      <h2>
        {title} <br />
        <span className="subtitle">{subtitle}</span>
      </h2>
      <table id={`utilizationTable${tableIndex}`}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Reference No.</th>
            <th>Cost Center Code</th>
            <th></th>
            <th>Description</th>
            <th>Amount</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <input
                  type="date"
                  className="row-date"
                  value={row.date}
                  onChange={(e) =>
                    onUpdateRow(tableIndex, row.id, "date", e.target.value)
                  }
                />
              </td>
              <td>
                <div className="ref-container">
                  <span className="ref-prefix">PCDF NO.</span>
                  <input
                    type="number"
                    className={`ref-input ${!row.isFirstRow ? "readonly-input" : ""}`}
                    value={row.refNum}
                    readOnly={!row.isFirstRow}
                    onChange={(e) =>
                      onUpdateRow(tableIndex, row.id, "refNum", e.target.value)
                    }
                  />
                </div>
              </td>
              <td>
                <input
                  type="text"
                  className="cc-code"
                  placeholder="Code"
                  list="cc-list"
                  value={row.costCenterCode}
                  onChange={(e) =>
                    onUpdateRow(
                      tableIndex,
                      row.id,
                      "costCenterCode",
                      e.target.value,
                    )
                  }
                />
              </td>
              <td>
                <input
                  type="text"
                  className="cc-desc readonly-input"
                  readOnly
                  placeholder="Auto-filled"
                  value={row.costCenterDesc}
                />
              </td>
              <td>
                <textarea
                  className="manual-desc"
                  placeholder="Expense details..."
                  value={row.description}
                  onChange={(e) =>
                    onUpdateRow(
                      tableIndex,
                      row.id,
                      "description",
                      e.target.value,
                    )
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="amount-input"
                  step="0.01"
                  max={tableIndex === 1 ? "3000" : undefined}
                  value={row.amount}
                  onChange={(e) =>
                    onUpdateRow(tableIndex, row.id, "amount", e.target.value)
                  }
                  onBlur={(e) =>
                    handleAmountBlur(tableIndex, row.id, e.target.value)
                  }
                />
              </td>
              <td>
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => onDeleteRow(tableIndex, row.id)}
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="subtotal-row">
            <td colSpan="5" className="subtotal-label">
              Subtotal:
            </td>
            <td className="subtotal-value">Php {subtotal.toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
      <button
        type="button"
        className="add-btn"
        onClick={() => onAddRow(tableIndex)}
      >
        + Add Row
      </button>
    </div>
  );

  return (
    <>
      <datalist id="cc-list">
        {Object.keys(COST_CENTERS).map((code) => (
          <option key={code} value={code}>
            {COST_CENTERS[code]}
          </option>
        ))}
      </datalist>

      {/* Inline Warning Message */}
      {warningb && <h4 className="inline-warning">⚠️ {warningb}</h4>}

      {/* Inline Warning Message */}
      {warning1 && <h4 className="inline-warning">⚠️ {warning1}</h4>}

      {renderTable(
        table1Rows,
        1,
        "Fund Utilization",
        "(PHP3,000 OR LESS CASH DISBURSEMENTS)",
        subtotal1,
      )}

      {/* Inline Warning Message */}
      {warningb && <h4 className="inline-warning">⚠️ {warningb}</h4>}

      {/* Inline Warning Message */}
      {warning2 && <h4 className="inline-warning">⚠️ {warning2}</h4>}

      {renderTable(
        table2Rows,
        2,
        "Fund Utilization",
        "(MORE THAN PHP3,000 CASH DISBURSEMENTS)",
        subtotal2,
      )}
    </>
  );
}

export default UtilizationSection;
