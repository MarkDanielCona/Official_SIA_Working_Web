import React, { useState } from 'react';
import LoginPage from './LoginPage.jsx';
import Dashboard from './Dashboard.jsx';

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(
    sessionStorage.getItem('auth') === 'true'
  );

  const handleLogin = () => {
    sessionStorage.setItem('auth', 'true');
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('auth');
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

export default App;