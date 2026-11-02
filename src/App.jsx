import React, { useState, useEffect } from 'react';
import AuthPage from './AuthPage.jsx';
import Dashboard from './Dashboard.jsx';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('token'));
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem('token')));

  // On page load, confirm the saved token is still valid with the server
  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
  const [selectedReport, setSelectedReport] = useState('report1');

  // Summary State
  const [summary, setSummary] = useState({
    assignedFund: '0.00',
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

    fetch(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error('invalid token');
      })
      .catch(() => handleLogout())
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = (newToken) => {
    sessionStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setToken(null);
  };

  if (checking) return null;

  if (!token) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

export default App;