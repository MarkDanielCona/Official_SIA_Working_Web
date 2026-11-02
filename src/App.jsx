import React, { useState, useEffect } from 'react';
import AuthPage from './AuthPage.jsx';
import Dashboard from './Dashboard.jsx';

const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');

function App() {
  const [token, setToken] = useState(sessionStorage.getItem('token'));
  const [checking, setChecking] = useState(Boolean(sessionStorage.getItem('token')));

  const handleLogin = (newToken) => {
    sessionStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('token');
    setToken(null);
  };

  // On page load, confirm the saved token is still valid with the server
  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }

    fetch(`${API_URL}/api/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (!res.ok) throw new Error('invalid token');
      })
      .catch(() => handleLogout())
      .finally(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) return null;

  if (!token) {
    return <AuthPage onLogin={handleLogin} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

export default App;
