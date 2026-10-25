import React, { useState } from 'react';

// Change these to the accounts you want to allow
const USERS = {
  admin: 'admin123',
  // anotherUser: 'anotherPassword',
};

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = username.trim();

    if (Object.prototype.hasOwnProperty.call(USERS, name) && USERS[name] === password) {
      onLogin();
    } else {
      setError('Incorrect username or password');
      setPassword('');
    }
  };

  return (
    <div className="wrapper-container">
      <div className="wrapper">
        <form onSubmit={handleSubmit}>
          <h2 className="login-header">Log in</h2>
          <div className="username-input">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="password-input">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <button type="submit">Log in</button>
          {error && <p style={{ color: 'red' }}>{error}</p>}
        </form>
      </div>
    </div>
  );
}

export default LoginPage;