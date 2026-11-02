const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// ---------- Config ----------
const PORT = process.env.PORT || 3001;
const { JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

const missing = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
  .filter((name) => !process.env[name]);

if (missing.length) {
  console.error('Missing environment variables:', missing.join(', '));
  process.exit(1);
}

// Comma-separated list of allowed website addresses, e.g.
// CLIENT_ORIGIN=https://my-app.vercel.app,http://localhost:5173
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

// The service role key bypasses Row Level Security. It must stay on the server only.
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const app = express();
app.set('trust proxy', 1); // needed so rate limiting sees real IPs behind Render/Railway
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '10kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Try again later.' },
});
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

// ---------- Helpers ----------
function validateCredentials(username, password) {
  if (typeof username !== 'string' || typeof password !== 'string') {
    return 'Username and password are required.';
  }
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username.trim())) {
    return 'Username must be 3-20 characters (letters, numbers, underscore).';
  }
  if (password.length < 8 || password.length > 72) {
    return 'Password must be 8-72 characters.';
  }
  return null;
}

// Usernames are stored in lowercase so "Admin" and "admin" are the same account
const normalize = (username) => username.trim().toLowerCase();

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not logged in.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// ---------- Routes ----------
app.get('/', (req, res) => res.json({ status: 'ok' })); // handy for host health checks

app.post('/api/register', async (req, res) => {
  const { username, password } = req.body || {};
  const problem = validateCredentials(username, password);
  if (problem) return res.status(400).json({ error: problem });

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const { error } = await supabase
      .from('users')
      .insert({ username: normalize(username), password_hash: passwordHash });

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: 'That username is already taken.' });
      }
      console.error('Register error:', error);
      return res.status(500).json({ error: 'Something went wrong.' });
    }

    res.status(201).json({ message: 'Account created.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, password_hash')
      .eq('username', normalize(username))
      .maybeSingle();

    if (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Something went wrong.' });
    }

    // Same message for "no such user" and "wrong password"
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect username or password.' });
    }

    const token = jwt.sign(
      { sub: user.id, username: user.username },
      JWT_SECRET,
      { expiresIn: '2h' }
    );
    res.json({ token, username: user.username });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong.' });
  }
});

// Protected route: the frontend uses it to check a saved token is still valid
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: req.user.sub, username: req.user.username });
});

app.listen(PORT, () => console.log(`API running on port ${PORT}`));