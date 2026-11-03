import React, { useState, useRef, useEffect } from 'react';
import Header from './header.jsx';
import SummarySection from './summarySection.jsx';
import UtilizationSection from './UtilizationSection.jsx';
import FinalSummarySection from './FinalSummarySection.jsx';
import { COST_CENTERS } from './data/costCenters';
import { buildReportCSV, downloadCSV, parseReportCSV } from './utils/csv.js';
// === SAVE: new import ===
import { api } from './api.js';

const DEFAULT_SUMMARY = {
  assignedFund: '50000.00',
  fundBalance: '0.00',
  replenishment: '0.00'
};

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

// Only the fields the server needs (no ids or display-only values)
const forServer = (rows) =>
  rows.map((r) => ({
    date: r.date,
    refNum: r.refNum,
    costCenterCode: r.costCenterCode,
    description: r.description,
    amount: r.amount
  }));

// === SAVE: token is new ===
function Dashboard({ token, onLogout }) {
  const [selectedReport, setSelectedReport] = useState('report1');

  // Summary State
  const [summary, setSummary] = useState(DEFAULT_SUMMARY);

  // Table Row State (Initialized with 1 row in each table)
  const [table1Rows, setTable1Rows] = useState([createRow('1', true)]);
  const [table2Rows, setTable2Rows] = useState([createRow('2', false)]);

  // === SAVE: new state ===
  // Cost centers start from the built-in list and are replaced by the database list when it loads
  const [costCenters, setCostCenters] = useState(COST_CENTERS);
  const [dirty, setDirty] = useState(false); // unsaved changes
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // === CSV: hidden file picker reference ===
  const fileInputRef = useRef(null);

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

  // === SAVE: shared by loading from the database and by CSV import ===
  // Replaces the whole report on screen with the given data.
  const applyData = ({ summary: newSummary, table1, table2 }) => {
    const toRows = (list) =>
      list.map((r) => {
        const code = (r.costCenterCode || '').trim();
        return {
          ...createRow(r.refNum || '1'),
          date: r.date || '',
          costCenterCode: code,
          costCenterDesc: costCenters[code] || (code ? 'Unknown Code' : ''),
          description: r.description || '',
          amount: r.amount ?? '0.00'
        };
      });

    let t1 = toRows(table1);
    let t2 = toRows(table2);
    if (t1.length === 0) t1 = [createRow('1', true)]; // keep at least one row per table
    if (t2.length === 0) t2 = [createRow('2', false)];

    const { syncedT1, syncedT2 } = syncRefNumbers(t1, t2);
    setSummary({ ...DEFAULT_SUMMARY, ...newSummary });
    setTable1Rows(syncedT1);
    setTable2Rows(syncedT2);
  };

  // === SAVE: error handling shared by all API calls ===
  const handleApiError = (err) => {
    if (err.status === 401) {
      alert('Your session has expired. Please log in again.');
      onLogout();
      return;
    }
    alert(err.message || 'Something went wrong.');
  };

  // === SAVE: load a saved report from the database ===
  const loadReport = async (key) => {
    setLoading(true);
    try {
      const { report } = await api(`/api/reports/${encodeURIComponent(key)}`, { token });
      if (report) {
        applyData(report);
      } else {
        // Nothing saved under this report yet: start with a blank one
        applyData({ summary: DEFAULT_SUMMARY, table1: [], table2: [] });
      }
      setDirty(false);
    } catch (err) {
      handleApiError(err);
    } finally {
      setLoading(false);
    }
  };

  // === SAVE: when the page opens, load cost centers and the saved report ===
  useEffect(() => {
    loadReport(selectedReport);

    api('/api/cost-centers', { token })
      .then(({ costCenters: list }) => {
        if (list && list.length > 0) {
          setCostCenters(Object.fromEntries(list.map((c) => [c.code, c.description])));
        }
      })
      .catch(() => {
        // Keep the built-in list if the database list can't be loaded
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the cost center list changes, refresh the descriptions already on screen
  useEffect(() => {
    const remap = (rows) =>
      rows.map((r) => {
        const code = r.costCenterCode.trim();
        return { ...r, costCenterDesc: costCenters[code] || (code ? 'Unknown Code' : '') };
      });
    setTable1Rows(remap);
    setTable2Rows(remap);
  }, [costCenters]);

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  // === SAVE: switching the report dropdown loads that report ===
  const handleReportChange = (key) => {
    if (key === selectedReport) return;
    if (dirty && !window.confirm('You have unsaved changes. Switching reports will discard them. Continue?')) {
      return;
    }
    setSelectedReport(key);
    loadReport(key);
  };

  const handleSummaryChange = (field, value) => {
    setSummary((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
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
    setDirty(true);
  };

  const handleUpdateRow = (tableIndex, id, field, value) => {
    const updateList = (list) =>
      list.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        if (field === 'costCenterCode') {
          const code = value.trim();
          updated.costCenterDesc = costCenters[code] || (code ? 'Unknown Code' : '');
        }
        return updated;
      });

    const updatedT1 = tableIndex === 1 ? updateList(table1Rows) : table1Rows;
    const updatedT2 = tableIndex === 2 ? updateList(table2Rows) : table2Rows;

    const { syncedT1, syncedT2 } = syncRefNumbers(updatedT1, updatedT2);
    setTable1Rows(syncedT1);
    setTable2Rows(syncedT2);
    setDirty(true);
  };

  const handleDeleteRow = (tableIndex, id) => {
    const updatedT1 = tableIndex === 1 ? table1Rows.filter((r) => r.id !== id) : table1Rows;
    const updatedT2 = tableIndex === 2 ? table2Rows.filter((r) => r.id !== id) : table2Rows;

    const { syncedT1, syncedT2 } = syncRefNumbers(updatedT1, updatedT2);
    setTable1Rows(syncedT1);
    setTable2Rows(syncedT2);
    setDirty(true);
  };

  // === SAVE: the Save button now stores the report in Supabase ===
  const handleSave = async () => {
    if (saving || loading) return;
    setSaving(true);
    try {
      await api(`/api/reports/${encodeURIComponent(selectedReport)}`, {
        method: 'PUT',
        token,
        body: {
          summary,
          table1: forServer(table1Rows),
          table2: forServer(table2Rows)
        }
      });
      setDirty(false);
      alert('FLR Report saved successfully!');
    } catch (err) {
      handleApiError(err);
    } finally {
      setSaving(false);
    }
  };

  // Calculations derived directly during rendering
  const availableFund = (parseFloat(summary.fundBalance) || 0) + (parseFloat(summary.replenishment) || 0);
  const subtotal1 = table1Rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const subtotal2 = table2Rows.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
  const totalUtilized = subtotal1 + subtotal2;
  const endingBalance = availableFund - totalUtilized;

  // === CSV: export ===
  const handleExport = () => {
    const csv = buildReportCSV({
      summary,
      table1Rows,
      table2Rows,
      totals: { availableFund, subtotal1, subtotal2, totalUtilized, endingBalance }
    });
    const today = new Date().toISOString().slice(0, 10);
    downloadCSV(csv, `FLR-Report_${selectedReport}_${today}.csv`);
  };

  // === CSV: import ===
  const handleImportClick = () => fileInputRef.current?.click();

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // lets the same file be chosen again later
    if (!file) return;

    try {
      const text = await file.text();
      const data = parseReportCSV(text, costCenters);

      if (!window.confirm('Importing will replace the current report data. Continue?')) return;

      applyData(data);
      setDirty(true); // imported data still has to be saved
    } catch (err) {
      alert(err.message || 'Could not import this file.');
    }
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '8px' }}>
        <button onClick={handleImportClick}>Import CSV</button>
        <button onClick={handleExport}>Export CSV</button>
        <button onClick={onLogout}>Log out</button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

      {/* === SAVE: status messages === */}
      {loading && <p>Loading saved report...</p>}
      {saving && <p>Saving...</p>}
      {dirty && !saving && !loading && <p>You have unsaved changes.</p>}

      <Header
        selectedReport={selectedReport}
        onReportChange={handleReportChange}
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
        assignedFund={parseFloat(summary.assignedFund) || 0}
        availableFund={availableFund}
        totalUtilized={totalUtilized}
        endingBalance={endingBalance}
        onSave={handleSave}
      />
    </div>
  );
}

export default Dashboard;