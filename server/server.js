require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// ---------- Config ----------
const PORT = process.env.PORT || 3001;
const { JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

const missing = ['JWT_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'].filter(
  (name) => !process.env[name]
);
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
app.set('trust proxy', 1); // needed so rate limiting sees real IPs behind Vercel/Render
app.use(helmet());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json({ limit: '1mb' }));

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

// ---------- Auth routes ----------
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

// ---------- Report helpers ----------
class ValidationError extends Error {}

const REPORT_KEY = /^[A-Za-z0-9_-]{1,40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ROWS = 500;

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

function isRealDate(s) {
  if (!ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function parseMoney(value, label) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n) || Math.abs(n) > 1e12) {
    throw new ValidationError(`${label} must be a valid amount.`);
  }
  return round2(n);
}

// Checks one table's rows and converts them to the database columns.
// Untouched placeholder rows (nothing filled in) are skipped.
function cleanRows(list, tableLabel) {
  if (!Array.isArray(list)) throw new ValidationError(`${tableLabel} must be a list.`);
  if (list.length > MAX_ROWS) {
    throw new ValidationError(`${tableLabel} has too many rows (maximum ${MAX_ROWS}).`);
  }

  const out = [];
  list.forEach((r, i) => {
    const where = `${tableLabel}, row ${i + 1}`;
    const date = String(r?.date ?? '').trim();
    const refRaw = String(r?.refNum ?? '').trim();
    const code = String(r?.costCenterCode ?? '').trim();
    const description = String(r?.description ?? '').trim();
    const amount = parseMoney(r?.amount === '' || r?.amount == null ? 0 : r.amount, `${where}: amount`);

    if (!date && !code && !description && amount === 0) return;

    if (!isRealDate(date)) throw new ValidationError(`${where}: enter a valid date.`);
    if (!code) throw new ValidationError(`${where}: cost center code is required.`);
    if (code.length > 20) throw new ValidationError(`${where}: cost center code is too long.`);
    if (description.length > 500) throw new ValidationError(`${where}: description is too long (maximum 500 characters).`);

    const pcdfNo = Number(refRaw);
    if (refRaw === '' || !Number.isSafeInteger(pcdfNo) || pcdfNo < 0) {
      throw new ValidationError(`${where}: reference number must be a whole number.`);
    }

    out.push({
      expense_date: date,
      pcdf_no: pcdfNo,
      costcenter_code: code,
      description: description || null,
      amount,
    });
  });
  return out;
}

// ---------- Report routes ----------

// Cost center list for the dropdown/lookup
app.get('/api/cost-centers', requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from('Cost_Center_Code')
    .select('cost_center_code, description')
    .order('cost_center_code', { ascending: true });

  if (error) {
    console.error('Cost centers error:', error);
    return res.status(500).json({ error: 'Could not load cost centers.' });
  }
  res.json({
    costCenters: data.map((c) => ({ code: c.cost_center_code, description: c.description })),
  });
});

// Load the logged-in user's saved report (or { report: null } if none yet)
app.get('/api/reports/:key', requireAuth, async (req, res) => {
  const key = req.params.key;
  if (!REPORT_KEY.test(key)) return res.status(400).json({ error: 'Invalid report name.' });
  const userId = Number(req.user.sub);

  try {
    const { data: flr, error } = await supabase
      .from('FLR-AssignedFund')
      .select('id, assigned_fund, fund_balance_previous_liquidation, replenishment_of_previous_liquidation')
      .eq('user_id', userId)
      .eq('report_key', key)
      .maybeSingle();
    if (error) throw error;
    if (!flr) return res.json({ report: null });

    const { data: rows, error: rowsError } = await supabase
      .from('Fund_Utilization')
      .select('id, table_no, expense_date, pcdf_no, costcenter_code, description, amount')
      .eq('flr_ID', flr.id)
      .order('id', { ascending: true });
    if (rowsError) throw rowsError;

    const toRow = (r) => ({
      date: r.expense_date,
      refNum: String(r.pcdf_no),
      costCenterCode: r.costcenter_code,
      description: r.description || '',
      amount: Number(r.amount).toFixed(2),
    });

    res.json({
      report: {
        id: flr.id,
        summary: {
          assignedFund: Number(flr.assigned_fund).toFixed(2),
          fundBalance: Number(flr.fund_balance_previous_liquidation).toFixed(2),
          replenishment: Number(flr.replenishment_of_previous_liquidation).toFixed(2),
        },
        table1: rows.filter((r) => r.table_no !== 2).map(toRow),
        table2: rows.filter((r) => r.table_no === 2).map(toRow),
      },
    });
  } catch (err) {
    console.error('Load report error:', err);
    res.status(500).json({ error: 'Could not load the report.' });
  }
});

// Save (create or overwrite) the logged-in user's report
app.put('/api/reports/:key', requireAuth, async (req, res) => {
  const key = req.params.key;
  if (!REPORT_KEY.test(key)) return res.status(400).json({ error: 'Invalid report name.' });
  const userId = Number(req.user.sub);

  try {
    const body = req.body || {};
    const s = body.summary || {};
    const assigned = parseMoney(s.assignedFund, 'Assigned fund');
    const balance = parseMoney(s.fundBalance, 'Beginning fund balance');
    const replenishment = parseMoney(s.replenishment, 'Replenishment');
    const rows1 = cleanRows(body.table1, 'Table 1');
    const rows2 = cleanRows(body.table2, 'Table 2');

    // Totals are calculated here, not trusted from the browser
    const available = round2(balance + replenishment);
    const utilized = round2([...rows1, ...rows2].reduce((sum, r) => sum + r.amount, 0));
    const ending = round2(available - utilized);

    // 1) Save the report header (creates it the first time, updates it after that)
    const { data: flr, error: flrError } = await supabase
      .from('FLR-AssignedFund')
      .upsert(
        {
          user_id: userId,
          report_key: key,
          assigned_fund: assigned,
          fund_balance_previous_liquidation: balance,
          replenishment_of_previous_liquidation: replenishment,
          available_fund: available,
          fund_balance: ending,
        },
        { onConflict: 'user_id,report_key' }
      )
      .select('id')
      .single();
    if (flrError) throw flrError;

    // 2) Note the rows saved before
    const { data: oldRows, error: oldError } = await supabase
      .from('Fund_Utilization')
      .select('id')
      .eq('flr_ID', flr.id);
    if (oldError) throw oldError;

    // 3) Insert the new rows first, so a failure never loses the old ones
    const newRows = [
      ...rows1.map((r) => ({ ...r, table_no: 1, flr_ID: flr.id })),
      ...rows2.map((r) => ({ ...r, table_no: 2, flr_ID: flr.id })),
    ];
    if (newRows.length) {
      const { error: insertError } = await supabase.from('Fund_Utilization').insert(newRows);
      if (insertError) throw insertError;
    }

    // 4) Remove the old rows
    if (oldRows.length) {
      const { error: deleteError } = await supabase
        .from('Fund_Utilization')
        .delete()
        .in('id', oldRows.map((r) => r.id));
      if (deleteError) throw deleteError;
    }

    res.json({ message: 'Report saved.', id: flr.id });
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error('Save report error:', err);
    res.status(500).json({ error: 'Could not save the report.' });
  }
});

// Vercel runs the exported app; locally we start our own server
module.exports = app;

if (!process.env.VERCEL) {
  app.listen(PORT, () => console.log(`API running on port ${PORT}`));
}