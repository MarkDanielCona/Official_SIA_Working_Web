import React, { useState, useEffect } from 'react';

const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');

function AuthPage({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // Background image only while this page is showing
  useEffect(() => {
    document.body.classList.add('login-bg');
    return () => document.body.classList.remove('login-bg');
  }, []);

  const isRegister = mode === 'register';

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError('');
    setInfo('');
    setPassword('');
    setConfirm('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (isRegister && password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/${isRegister ? 'register' : 'login'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        return;
      }

      if (isRegister) {
        // Account created: send them to the login form
        setMode('login');
        setPassword('');
        setConfirm('');
        setInfo('Account created. You can log in now.');
      } else {
        onLogin(data.token);
      }
    } catch {
      setError('Cannot reach the server. Is the API running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="container">
        <form className="login-form" onSubmit={handleSubmit}>
          <h2>{isRegister ? 'Create account' : 'Log in'}</h2>

          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            required
            autoFocus
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={isRegister ? 'new-password' : 'current-password'}
            required
            minLength={isRegister ? 8 : undefined}
          />
          {isRegister && (
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm password"
              autoComplete="new-password"
              required
            />
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isRegister ? 'Register' : 'Log in'}
          </button>

          {error && <p style={{ color: 'red' }}>{error}</p>}
          {info && <p style={{ color: 'green' }}>{info}</p>}

          <p className="auth-switch">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                switchMode();
              }}
            >
              {isRegister ? 'Log in' : 'Register'}
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}

export default AuthPage;