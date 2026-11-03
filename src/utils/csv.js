// src/utils/csv.js
// CSV export/import that follows the layout of the "Fund Liquidation Report" sheet.

// ---------- Edit these to change the fixed text on the form ----------
const COMPANY_NAME = 'SOUTHCREST HOTEL VENTURES, INC. (SEDA ABREEZA)';
const COMPANY_ADDRESS = 'J.P. Laurel Avenue, Bajada, Davao City, 8000 Philippines';
const PREPARED_BY = { name: 'RITCHLIE MAY P. CONA', title: 'FINANCE CASHIER' };
const APPROVED_BY = { name: 'JERRY V. SALEM', title: 'ASST. FINANCIAL CONTROLLER' };

// Labels used on the report. Import recognizes the same wording, so change both or neither.
const LABEL = {
  assigned: 'ASSIGNED FUND',
  balance: 'FUND BALANCE, Previous liquidation',
  replenishment: 'REPLENISHMENT OF PREVIOUS LIQUIDATION',
  available: '[A] AVAILABLE FUND FOR USE',
  utilization: '[B] FUND UTILIZATION',
  t1: '[B.1] PHP3,000 OR LESS CASH DISBURSEMENTS:',
  t2: '[B.2] MORE THAN PHP3,000 CASH DISBURSEMENTS:',
  subtotal: 'SUBTOTAL',
  totalUtilized: 'TOTAL FUND UTILIZED, As of report date [B.1+B.2]',
  endingBalance: 'FUND BALANCE, As of report period [A-B]',
};

const TABLE_HEADERS = ['DATE', 'REFERENCE NO', 'COST/PROFIT CENTER', '', 'DESCRIPTION', 'AMOUNT'];
const REF_PREFIX = 'PCDF NO. ';

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ---------- helpers ----------

// Wrap a cell in quotes when it contains commas, quotes or line breaks
function escapeCell(value) {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toLine = (...cells) => cells.map(escapeCell).join(',');

// 1234.5 -> "1,234.50", -1234.5 -> "(1,234.50)" (same style as the Excel sheet)
function fmt(value) {
  const n = parseFloat(value) || 0;
  const s = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `(${s})` : s;
}

const php = (value) => `Php ${fmt(value)}`;

const pad2 = (n) => String(n).padStart(2, '0');

// 2026-09-02 -> "02 September 2026"
function longDate(d) {
  return `${pad2(d.getDate())} ${LONG_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

// "2026-08-10" -> "10-Aug-26" (the format used in the DATE column of the sheet)
function formatRowDate(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ''));
  if (!m) return String(value ?? '');
  const month = SHORT_MONTHS[parseInt(m[2], 10) - 1];
  return month ? `${m[3]}-${month}-${m[1].slice(2)}` : String(value);
}

// "10-Aug-26" -> "2026-08-10". Anything else is kept as it is.
function parseRowDate(value) {
  const m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2}|\d{4})$/.exec(value);
  if (!m) return value;
  const idx = SHORT_MONTHS.findIndex((s) => s.toLowerCase() === m[2].toLowerCase());
  if (idx === -1) return value;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${pad2(idx + 1)}-${pad2(parseInt(m[1], 10))}`;
}

// Stops Excel from running text such as "=1+1" as a formula
const protect = (value) => {
  const s = String(value ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
};
const unprotect = (value) => (/^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value);

// ---------- export ----------

export function buildReportCSV({ summary, table1Rows, table2Rows, totals }) {
  const lines = [];
  const valueRow = (label, value) => toLine(label, '', '', '', '', value);

  const tableRows = (rows) => {
    lines.push(toLine(...TABLE_HEADERS));
    rows.forEach((r) => {
      lines.push(
        toLine(
          formatRowDate(protect(r.date)),
          `${REF_PREFIX}${r.refNum}`,
          protect(r.costCenterCode),
          protect(r.costCenterDesc),
          protect(r.description),
          fmt(r.amount)
        )
      );
    });
  };

  // Page header
  lines.push(toLine(COMPANY_NAME));
  lines.push(toLine(COMPANY_ADDRESS));
  lines.push('');
  lines.push(toLine('FUND LIQUIDATION REPORT'));
  lines.push(toLine('PETTY CASH FUND'));
  lines.push(valueRow('', longDate(new Date())));

  // Fund summary
  lines.push(valueRow(LABEL.assigned, php(summary.assignedFund)));
  lines.push(valueRow(LABEL.balance, php(summary.fundBalance)));
  lines.push(valueRow(LABEL.replenishment, fmt(summary.replenishment)));
  lines.push(valueRow(LABEL.available, php(totals.availableFund)));

  // Fund utilization
  lines.push(toLine(LABEL.utilization));
  lines.push(toLine(LABEL.t1));
  tableRows(table1Rows);
  lines.push('');
  lines.push(valueRow(LABEL.subtotal, php(totals.subtotal1)));
  lines.push('');
  lines.push(toLine(LABEL.t2));
  tableRows(table2Rows);
  lines.push('');
  lines.push(valueRow(LABEL.subtotal, php(totals.subtotal2)));
  lines.push(valueRow(LABEL.totalUtilized, php(totals.totalUtilized)));
  lines.push('');
  lines.push(valueRow(LABEL.endingBalance, php(totals.endingBalance)));

  // Signatures
  lines.push('');
  lines.push('');
  lines.push(toLine('PREPARED BY:', '', '', '', 'APPROVED BY:', ''));
  lines.push('');
  lines.push('');
  lines.push(toLine(PREPARED_BY.name, '', '', '', APPROVED_BY.name, ''));
  lines.push(toLine(PREPARED_BY.title, '', '', '', APPROVED_BY.title, ''));

  return lines.join('\r\n');
}

export function downloadCSV(csvText, filename) {
  // The BOM makes Excel read the file as UTF-8
  const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------- import ----------

// Small CSV parser that handles quotes, commas inside quotes, and CRLF/LF line endings
export function parseCSV(text) {
  const src = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

// Accepts "1,234.50", "Php 1,234.50", "(1,234.50)", "-" and plain numbers
function toAmount(value, rowNum) {
  let cleaned = String(value ?? '').replace(/PHP|₱|,|\s/gi, '');
  if (cleaned === '' || cleaned === '-') return '0.00';
  if (/^\(.*\)$/.test(cleaned)) cleaned = `-${cleaned.slice(1, -1)}`;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) {
    throw new Error(`Row ${rowNum}: "${value}" is not a valid amount.`);
  }
  return n.toFixed(2);
}

// The last filled cell after the label (the AMOUNT column)
function lastValue(cells) {
  for (let i = cells.length - 1; i > 0; i--) {
    if (cells[i] !== '') return cells[i];
  }
  return '';
}

const SUMMARY_FIELDS = {
  [LABEL.assigned.toLowerCase()]: 'assignedFund',
  [LABEL.balance.toLowerCase()]: 'fundBalance',
  [LABEL.replenishment.toLowerCase()]: 'replenishment',
};

// Reads a file made by buildReportCSV. Throws an Error with a readable message if it can't.
export function parseReportCSV(text, costCenters = {}) {
  const rows = parseCSV(text);
  const summary = {};
  const tables = { t1: [], t2: [] };
  let section = null; // null (summary area) | 't1' | 't2' | 'final'
  let recognized = false;

  rows.forEach((raw, index) => {
    const rowNum = index + 1;
    const r = raw.map((c) => c.trim());
    if (r.every((c) => c === '')) return; // blank line

    const first = r[0];
    const lower = first.toLowerCase();

    if (/^\[b\.1\]/i.test(first)) { section = 't1'; recognized = true; return; }
    if (/^\[b\.2\]/i.test(first)) { section = 't2'; recognized = true; return; }
    if (lower.startsWith('total fund utilized')) { section = 'final'; return; }

    if (section === null) {
      const field = SUMMARY_FIELDS[lower];
      if (field) summary[field] = toAmount(lastValue(r), rowNum);
      return;
    }

    if (section === 't1' || section === 't2') {
      if (lower === 'date') return; // column header row
      if (lower === 'subtotal') return; // subtotal row (recalculated by the app)

      const code = unprotect(r[2] || '');
      tables[section].push({
        refNum: (r[1] || '').replace(/^PCDF\s*NO\.?\s*/i, ''),
        date: parseRowDate(unprotect(first)),
        costCenterCode: code,
        costCenterDesc: costCenters[code] || (code ? 'Unknown Code' : ''),
        description: unprotect(r[4] || ''),
        amount: toAmount(r[5], rowNum),
      });
    }
    // 'final' values are calculated by the app, so they are not imported
  });

  if (!recognized) {
    throw new Error('This file is not an exported report. Please choose a CSV created with "Export CSV".');
  }

  return { summary, table1: tables.t1, table2: tables.t2 };
}