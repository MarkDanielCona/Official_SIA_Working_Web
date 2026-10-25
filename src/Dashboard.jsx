import React, { useState } from 'react';
import Header from './header.jsx';
import SummarySection from './summarySection.jsx';
import UtilizationSection from './UtilizationSection.jsx';
import FinalSummarySection from './FinalSummarySection.jsx';
import { COST_CENTERS } from './data/costCenters';

function createRow(refNum = '1', isFirstRow = false) {
  return {
    id: crypto.randomUUID(),
    date: '',
    refNum,
    costCenterCode: '',
    costCenterDesc: '',
    description: '',
    amount: '0.00',
    isFirstRow
  };
}

function Dashboard({ onLogout }) {
  const [selectedReport, setSelectedReport] = useState('report1');

  // Summary State
  const [summary, setSummary] = useState({
    assignedFund: '50000.00',
    fundBalance: '0.00',
    replenishment: '0.00'
  });

  // Table Row State (Initialized with 1 row in each table)
  const [table1Rows, setTable1Rows] = useState([createRow('1', true)]);
  const [table2Rows, setTable2Rows] = useState([createRow('2', false)]);

  // Re-indexes reference numbers sequentially across both tables
  const syncRefNumbers = (t1, t2) => {
    const combined = [...t1, ...t2];
    if (combined.length === 0) return { syncedT1: t1, syncedT2: t2 };

    let currentRef = parseInt(combined[0].refNum, 10) || 1;

    const syncedT1 = t1.map((row, idx) => {
      const isFirst = idx === 0;
      const ref = isFirst ? row.refNum : String(currentRef);
      currentRef = (parseInt(ref, 10) || currentRef) + 1;
      return { ...row, refNum: ref, isFirstRow: isFirst };
    });

    const syncedT2 = t2.map((row, idx) => {
      const isFirst = t1.length === 0 && idx === 0;
      const ref = isFirst ? row.refNum : String(currentRef);
      currentRef = (parseInt(ref, 10) || currentRef) + 1;
      return { ...row, refNum: ref, isFirstRow: isFirst };
    });

    return { syncedT1, syncedT2 };
  };

  const handleSummaryChange = (field, value) => {
    setSummary((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddRow = (tableIndex) => {
    const totalCount = table1Rows.length + table2Rows.length;
    const nextRef = String(totalCount + 1);
    const newRow = createRow(nextRef, false);

    if (tableIndex === 1) {
      const { syncedT1, syncedT2 } = syncRefNumbers([...table1Rows, newRow], table2Rows);
      setTable1Rows(syncedT1);
      setTable2Rows(syncedT2);
    } else {
      const { syncedT1, syncedT2 } = syncRefNumbers(table1Rows, [...table2Rows, newRow]);
      setTable1Rows(syncedT1);
      setTable2Rows(syncedT2);
    }
  };

  const handleUpdateRow = (tableIndex, id, field, value) => {
    const updateList = (list) =>
      list.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        if (field === 'costCenterCode') {
          const code = value.trim();
          updated.costCenterDesc = COST_CENTERS[code] || (code ? 'Unknown Code' : '');
        }
        return updated;
      });

    const updatedT1 = tableIndex === 1 ? updateList(table1Rows) : table1Rows;
    const updatedT2 = tableIndex === 2 ? updateList(table2Rows) : table2Rows;

    const { syncedT1, syncedT2 } = syncRefNumbers(updatedT1, updatedT2);
    setTable1Rows(syncedT1);
    setTable2Rows(syncedT2);
  };

  const handleDeleteRow = (tableIndex, id) => {
    const updatedT1 = tableIndex === 1 ? table1Rows.filter((r) => r.id !== id) : table1Rows;
    const updatedT2 = tableIndex === 2 ? table2Rows.filter((r) => r.id !== id) : table2Rows;

    const { syncedT1, syncedT2 } = syncRefNumbers(updatedT1, updatedT2);
    setTable1Rows(syncedT1);
    setTable2Rows(syncedT2);
  };

  const handleSave = () => {
    alert("FLR Report saved successfully!");
  };

  // Calculations derived directly during rendering
  const availableFund = (parseFloat(summary.fundBalance) || 0) + (parseFloat(summary.replenishment) || 0);
  const subtotal1 = table1Rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const subtotal2 = table2Rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const totalUtilized = subtotal1 + subtotal2;
  const endingBalance = availableFund - totalUtilized;

  return (
    <div className="container">
      <div style={{ textAlign: 'right', marginBottom: '8px' }}>
        <button onClick={onLogout}>Log out</button>
      </div>
      <Header
        selectedReport={selectedReport}
        onReportChange={setSelectedReport}
      />
      <SummarySection
        assignedFund={summary.assignedFund}
        fundBalance={summary.fundBalance}
        replenishment={summary.replenishment}
        availableFund={availableFund}
        onSummaryChange={handleSummaryChange}
      />
      <UtilizationSection
        table1Rows={table1Rows}
        table2Rows={table2Rows}
        availableFund={availableFund}
        onAddRow={handleAddRow}
        onUpdateRow={handleUpdateRow}
        onDeleteRow={handleDeleteRow}
      />
      <FinalSummarySection
        availableFund={availableFund}
        totalUtilized={totalUtilized}
        endingBalance={endingBalance}
        onSave={handleSave}
      />
    </div>
  );
}

export default Dashboard;