import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import * as pdfjsLib from 'pdfjs-dist';
import { normalizeFullName } from './contactDuplicates';

// CDN worker (version must match pdfjs-dist in package.json — Safari is picky about workers)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

function normalizeHeader(h) {
  return String(h || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function scoreColumn(name, keywords) {
  const n = normalizeHeader(name);
  return keywords.some((k) => n.includes(k)) ? 1 : 0;
}

/**
 * Ultra-flexible column detection: header keywords, first-row content heuristics, then 0/1/2 fallback.
 */
export function findBestColumns(headers, firstRow) {
  const h = headers.map((x) => (x || '').toString().toLowerCase().trim());

  let nameIdx = h.findIndex((x) => x.includes('name') || x.includes('full') || x.includes('contact'));

  let phoneIdx = h.findIndex(
    (x) =>
      x.includes('phone') ||
      x.includes('mobile') ||
      x.includes('cell') ||
      x.includes('tel') ||
      x.includes('number'),
  );

  let emailIdx = h.findIndex((x) => x.includes('email') || x.includes('mail'));

  if (nameIdx === -1 || phoneIdx === -1) {
    (firstRow || []).forEach((val, i) => {
      const v = (val || '').toString();
      if (phoneIdx === -1 && /\d{7,}/.test(v.replace(/\D/g, ''))) phoneIdx = i;
      if (emailIdx === -1 && v.includes('@')) emailIdx = i;
      if (nameIdx === -1 && /^[a-zA-Z\s]{3,}$/.test(v) && i !== phoneIdx && i !== emailIdx) nameIdx = i;
    });
  }

  if (nameIdx === -1) nameIdx = 0;
  /** Phone/email columns optional — callers treat `-1` as “no column”. */
  if (phoneIdx === -1) phoneIdx = -1;
  if (emailIdx === -1) emailIdx = -1;

  return { nameIdx, phoneIdx, emailIdx };
}

function padRowToWidth(row, width) {
  const a = Array.isArray(row) ? row.map((c) => c) : [];
  while (a.length < width) a.push('');
  return a;
}

function padRawRows(rawRows) {
  const filtered = (rawRows || []).filter(
    (r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== ''),
  );
  if (!filtered.length) return [];
  const width = Math.max(...filtered.map((r) => r.length), 0);
  if (width === 0) return [];
  return filtered.map((r) => padRowToWidth(r, width));
}

function rowLooksLikeHeaderRow(cells) {
  if (!cells?.length) return false;
  return cells.some((c) => {
    const s = (c || '').toString().toLowerCase().trim();
    if (!s) return false;
    if (s.includes('name') || s.includes('contact')) return true;
    if (s.includes('phone') || s.includes('mobile') || s.includes('cell') || s.includes('tel')) return true;
    if (s.includes('email') || s.includes('mail')) return true;
    return false;
  });
}

/** Spreadsheet / PDF header / section title — not a person name. */
export function isHeaderRow(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  return (
    t.includes('full name') ||
    t.includes('phone number') ||
    t.includes('contact collection') ||
    t.includes('netcasting phase') ||
    t.includes('dashboard') ||
    t === 'name' ||
    t === 'phone' ||
    t === 'email' ||
    /^[A-Z\s]{10,}$/.test(raw)
  );
}

/**
 * A row is importable if it has a real person name. Phone, email, and address are optional.
 */
export function isValidImportContactName(name) {
  const cleanName = String(name ?? '').trim();
  if (cleanName.length < 2) return false;
  if (/^\d+$/.test(cleanName)) return false;
  if (isHeaderRow(cleanName)) return false;
  if (shouldRejectImportName(cleanName)) return false;
  return true;
}

/** Reject placeholder / header / URL “names” — not real contacts. */
export function shouldRejectImportName(rawName) {
  const name = String(rawName || '').trim();
  if (!name) return true;
  if (/^\d+$/.test(name)) return true;
  if (name.length > 50) return true;
  const lower = name.toLowerCase();
  if (
    lower.includes('instagram') ||
    lower.includes('facebook') ||
    lower.includes('twitter') ||
    lower.includes('linkedin')
  ) {
    return true;
  }
  if (/\b(n\/a|none)\b/i.test(lower) || lower === 'n/a' || lower === 'none') return true;
  if (/https?:\/\//i.test(name) || /\bwww\./i.test(name)) return true;
  if (lower.includes('contact collection phase') || lower.includes('netcasting phase') || lower.includes('dashboard')) {
    return true;
  }
  const hasLower = /[a-z]/.test(name);
  if (/[A-Za-z]/.test(name) && !hasLower && name.length >= 8) return true;
  return false;
}

/** @deprecated use shouldRejectImportName */
export function shouldSkipImportNameCandidate(rawName) {
  return shouldRejectImportName(rawName);
}

function resolveImportColumnIndices(width, headerCells) {
  if (width <= 0) return { nameIdx: 0, phoneIdx: 0, emailIdx: 0 };
  const h = headerCells.map((x) => (x || '').toString().toLowerCase().trim());

  let nameIdx = -1;
  let phoneIdx = -1;
  let emailIdx = -1;

  for (let i = 0; i < h.length; i += 1) {
    const x = h[i];
    if (!x) continue;
    if (x.includes('email') || x === 'e-mail') emailIdx = i;
    else if (x.includes('phone') || x.includes('mobile') || x.includes('cell') || x.includes('tel')) phoneIdx = i;
    else if (x.includes('name') && !x.includes('company') && !x.includes('user name')) nameIdx = i;
  }

  const hinted = nameIdx >= 0 && phoneIdx >= 0 && nameIdx < phoneIdx;
  if (hinted) {
    if (emailIdx < 0) emailIdx = Math.min(phoneIdx + 1, width - 1);
    if (emailIdx <= phoneIdx) emailIdx = Math.min(width - 1, phoneIdx + 1);
    return {
      nameIdx: Math.min(nameIdx, width - 1),
      phoneIdx: Math.min(phoneIdx, width - 1),
      emailIdx: Math.min(Math.max(emailIdx, 0), width - 1),
    };
  }

  if (width >= 4) {
    return { nameIdx: 1, phoneIdx: 2, emailIdx: 3 };
  }
  if (width === 3) return { nameIdx: 0, phoneIdx: 1, emailIdx: 2 };
  if (width === 2) return { nameIdx: 0, phoneIdx: 1, emailIdx: 1 };
  return { nameIdx: 0, phoneIdx: 0, emailIdx: 0 };
}

/**
 * Find which column index has the most 10-digit phone numbers (US-style), scanning every data row.
 * @param {unknown[][]} rows
 * @returns {number | null}
 */
export function findPhoneColumnIndex(rows) {
  const counts = {};
  (rows || []).forEach((row) => {
    if (!Array.isArray(row)) return;
    row.forEach((cell, i) => {
      const digits = String(cell ?? '').replace(/\D/g, '');
      if (digits.length === 10) counts[i] = (counts[i] || 0) + 1;
    });
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) return null;
  return Number(sorted[0][0]);
}

function columnIsAllNumericRowIds(rows, colIdx, sampleSize = 80) {
  const slice = rows.slice(0, Math.min(sampleSize, rows.length));
  const vals = slice.map((r) => String(r[colIdx] ?? '').trim()).filter(Boolean);
  if (vals.length < Math.min(5, slice.length)) return false;
  return vals.every((v) => /^\d+$/.test(v));
}

/**
 * Prefer the first text column before the phone column; skip column 0 when it looks like row numbers.
 * If the phone column is first, pick the first name-like column after it.
 * @param {unknown[][]} rows
 */
function findNameColumnBeforePhone(rows, phoneIdx, width) {
  if (phoneIdx > 0) {
    let start = 0;
    if (rows.length && columnIsAllNumericRowIds(rows, 0)) start = 1;
    for (let j = start; j < phoneIdx; j += 1) {
      const hasNameLike = rows.some((r) => {
        const s = String(r[j] ?? '').trim();
        return s && /[a-zA-Z]/.test(s) && !shouldRejectImportName(s);
      });
      if (hasNameLike) return j;
    }
  }
  for (let j = phoneIdx + 1; j < width; j += 1) {
    const hasNameLike = rows.some((r) => {
      const s = String(r[j] ?? '').trim();
      return s && /[a-zA-Z]/.test(s) && !shouldRejectImportName(s);
    });
    if (hasNameLike) return j;
  }
  if (phoneIdx > 0) return Math.max(0, phoneIdx - 1);
  return 0;
}

function findBestEmailColumnIndex(rows, phoneIdx, nameIdx, width) {
  const counts = {};
  (rows || []).forEach((row) => {
    if (!Array.isArray(row)) return;
    for (let i = 0; i < width; i += 1) {
      if (i === phoneIdx || i === nameIdx) continue;
      const s = String(row[i] ?? '').trim();
      if (s.includes('@') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) {
        counts[i] = (counts[i] || 0) + 1;
      }
    }
  });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!sorted.length) {
    const fallback = phoneIdx + 1;
    if (fallback < width && fallback !== nameIdx) return fallback;
    return Math.max(0, width - 1);
  }
  return Number(sorted[0][0]);
}

function strictPhoneFromCell(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return { phone: '', extra: '' };
  if (/[a-zA-Z]/.test(raw)) return { phone: '', extra: raw };
  const digits = raw.replace(/\D/g, '');
  if (digits.length >= 7) return { phone: digits, extra: '' };
  return { phone: '', extra: raw };
}

function strictEmailFromCell(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return { email: '', extra: '' };
  if (!raw.includes('@')) return { email: '', extra: raw };
  return { email: raw, extra: '' };
}

function countRowsWithValidName(dataRows, nameIdx) {
  let n = 0;
  for (const row of dataRows) {
    const nameStr = String(row[nameIdx] ?? '').trim();
    if (isValidImportContactName(nameStr)) n += 1;
  }
  return n;
}

/** Pick the column whose cells look most like person names (when there is no phone column). */
function findBestNameColumnIndex(dataRows, headerCells, width) {
  const h = headerCells.map((x) => String(x ?? '').toLowerCase().trim());
  const headerHint = h.findIndex(
    (x) =>
      (x.includes('name') && !x.includes('company') && !x.includes('user name')) ||
      x.includes('full') ||
      (x.includes('contact') && !x.includes('phone')),
  );
  if (headerHint >= 0) return headerHint;

  let bestCol = 0;
  let bestScore = -1;
  for (let j = 0; j < width; j += 1) {
    let score = 0;
    for (const row of dataRows) {
      const nameStr = String(row[j] ?? '').trim();
      if (isValidImportContactName(nameStr)) score += 3;
      else if (nameStr.length >= 2 && /[a-zA-Z]/.test(nameStr) && !shouldRejectImportName(nameStr)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestCol = j;
    }
  }
  return bestCol;
}

/**
 * @returns {{ sheetName: string, validNameCount: number, drafts: object[] } | null}
 */
export function flexibleImportEvaluateRawSheet(rawRows, sheetName = 'Sheet') {
  const padded = padRawRows(rawRows);
  if (!padded.length) return null;

  let headerCells;
  let dataRows;
  if (rowLooksLikeHeaderRow(padded[0])) {
    headerCells = padded[0].map((c) => String(c ?? ''));
    dataRows = padded.slice(1);
  } else {
    headerCells = new Array(padded[0].length).fill('');
    dataRows = padded;
  }

  dataRows = dataRows.filter((r) => r.some((c) => String(c ?? '').trim() !== ''));
  if (!dataRows.length) return null;

  const width = padded[0].length;
  const clamp = (idx) => Math.min(Math.max(0, idx), Math.max(0, width - 1));

  /** Single-column sheet: names only. */
  if (width === 1) {
    const validNameCount = countRowsWithValidName(dataRows, 0);
    const drafts = [];
    for (let i = 0; i < dataRows.length; i += 1) {
      const row = dataRows[i];
      const nameRaw = String(row[0] ?? '').trim();
      if (!isValidImportContactName(nameRaw)) continue;
      drafts.push({
        id: `flex-${sheetName}-${i}`,
        full_name: nameRaw,
        phone: '',
        email: '',
        category: 'potential',
        status: 'prospect',
        monthly_amount: 0,
        notes: '',
      });
    }
    if (!drafts.length) return null;
    return { sheetName, validNameCount, drafts };
  }

  let phoneColumnDistinct = false;
  let phoneIdx = findPhoneColumnIndex(dataRows);
  let nameIdx;
  let emailIdx;

  if (phoneIdx != null && !Number.isNaN(phoneIdx) && phoneIdx >= 0 && phoneIdx < width) {
    phoneColumnDistinct = true;
    phoneIdx = clamp(phoneIdx);
    nameIdx = clamp(findNameColumnBeforePhone(dataRows, phoneIdx, width));
    emailIdx = clamp(findBestEmailColumnIndex(dataRows, phoneIdx, nameIdx, width));
  } else {
    const fixed = resolveImportColumnIndices(width, headerCells);
    nameIdx = clamp(findBestNameColumnIndex(dataRows, headerCells, width));
    if (nameIdx < 0 || Number.isNaN(nameIdx)) nameIdx = clamp(fixed.nameIdx);
    phoneIdx = clamp(nameIdx);
    emailIdx = clamp(findBestEmailColumnIndex(dataRows, nameIdx, nameIdx, width));
  }

  if (phoneColumnDistinct && nameIdx === phoneIdx && width > 1) {
    nameIdx = clamp(phoneIdx > 0 ? phoneIdx - 1 : phoneIdx + 1 < width ? phoneIdx + 1 : 0);
  }
  if (emailIdx === phoneIdx || emailIdx === nameIdx) {
    let found = false;
    for (let ei = 0; ei < width; ei += 1) {
      if (ei !== phoneIdx && ei !== nameIdx) {
        emailIdx = clamp(ei);
        found = true;
        break;
      }
    }
    if (!found) emailIdx = clamp(Math.min(width - 1, phoneIdx + 1));
  }
  if (phoneColumnDistinct && nameIdx >= phoneIdx) {
    const fixed = resolveImportColumnIndices(width, []);
    nameIdx = clamp(fixed.nameIdx);
    phoneIdx = clamp(fixed.phoneIdx);
    emailIdx = clamp(fixed.emailIdx);
  }

  console.log('[import] Sheet:', sheetName, { nameIdx, phoneIdx, emailIdx, phoneColumnDistinct });
  console.log('Raw headers:', headerCells);
  console.log('First 3 rows:', dataRows.slice(0, 3));

  const validNameCount = countRowsWithValidName(dataRows, nameIdx);

  const drafts = [];
  for (let i = 0; i < dataRows.length; i += 1) {
    const row = dataRows[i];
    const nameRaw = String(row[nameIdx] ?? '').trim();
    if (!isValidImportContactName(nameRaw)) continue;

    const phoneRaw = phoneIdx !== nameIdx ? String(row[phoneIdx] ?? '').trim() : '';
    const emailRaw = emailIdx !== nameIdx ? String(row[emailIdx] ?? '').trim() : '';
    const { phone: phoneOut, extra: phoneExtra } = strictPhoneFromCell(phoneRaw);
    const { email: emailOut, extra: emailExtra } = strictEmailFromCell(emailRaw);

    const notesParts = [];
    if (phoneExtra) notesParts.push(phoneExtra);
    if (emailExtra) notesParts.push(emailExtra);
    for (let j = 0; j < width; j += 1) {
      if (j === nameIdx || j === phoneIdx || j === emailIdx) continue;
      const cell = String(row[j] ?? '').trim();
      if (cell) notesParts.push(cell);
    }
    const notes = notesParts.join(' | ');

    drafts.push({
      id: `flex-${sheetName}-${i}`,
      full_name: nameRaw,
      phone: phoneOut,
      email: emailOut,
      category: 'potential',
      status: 'prospect',
      monthly_amount: 0,
      notes,
    });
  }

  if (!drafts.length) return null;
  return { sheetName, validNameCount, drafts };
}

/**
 * Build a raw grid from `{ headers, rows }` (e.g. Google Sheets API) and run flexible import.
 */
export function flexibleImportFromSplitMatrix(matrix, sheetName = 'Sheet') {
  const headers = matrix?.headers || [];
  const rows = matrix?.rows || [];
  if (!headers.length && !rows.length) return [];
  const width = Math.max(headers.length, ...rows.map((r) => (Array.isArray(r) ? r.length : 0)), 0);
  if (width === 0) return [];
  const rawGrid = [padRowToWidth(headers, width)];
  for (const r of rows) {
    rawGrid.push(padRowToWidth(r, width));
  }
  const evaluated = flexibleImportEvaluateRawSheet(rawGrid, sheetName);
  return evaluated?.drafts ?? [];
}

/**
 * Parse CSV / Excel to contact drafts: raw grids, flexible columns, multi-sheet Excel (skip dashboard tabs).
 */
export async function parseSpreadsheetFlexible(file, { onProgress, signal } = {}) {
  const name = (file?.name || '').toLowerCase();
  const ext = name.split('.').pop() || '';

  const sheetResults = [];

  if (ext === 'csv') {
    onProgress?.({ pct: 5, note: 'Reading CSV…' });
    const text = await file.text();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const parsed = Papa.parse(text, { header: false, skipEmptyLines: true });
    const rawRows = parsed.data || [];
    sheetResults.push({ name: 'CSV', rawRows });
  } else if (ext === 'xlsx' || ext === 'xls') {
    onProgress?.({ pct: 5, note: 'Reading workbook…' });
    const buf = await file.arrayBuffer();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const wb = XLSX.read(buf, { type: 'array' });
    for (let s = 0; s < wb.SheetNames.length; s += 1) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const sheetName = wb.SheetNames[s];
      const sheet = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      sheetResults.push({ name: sheetName, rawRows });
      onProgress?.({
        pct: Math.round(10 + (s / Math.max(1, wb.SheetNames.length)) * 40),
        note: `Scanning “${sheetName}”…`,
      });
    }
  } else {
    throw new Error('Use .csv, .xlsx, or .xls');
  }

  const evaluated = [];
  for (const { name: sheetName, rawRows } of sheetResults) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const ev = flexibleImportEvaluateRawSheet(rawRows, sheetName);
    if (ev) evaluated.push(ev);
  }

  let candidates = evaluated.filter((e) => e.validNameCount >= 1);
  if (!candidates.length) candidates = evaluated.slice();
  candidates.sort((a, b) => b.validNameCount - a.validNameCount || b.drafts.length - a.drafts.length);

  const best = candidates[0];
  if (!best?.drafts?.length) {
    console.log('[import] Flexible spreadsheet: total contacts to insert: 0');
    return [];
  }

  console.log(
    `[import] Using sheet “${best.sheetName}” (${best.validNameCount} rows with a valid name). Contacts found: ${best.drafts.length}`,
  );
  console.log('[import] Flexible spreadsheet: total contacts to insert:', best.drafts.length);
  onProgress?.({ pct: 100, note: 'Ready to save…' });
  return best.drafts;
}

/** Pick columns for name / phone / email from header row */
export function detectColumns(headers) {
  const list = headers.map((h, i) => ({ raw: h, index: i }));
  let fullNameIdx = list.findIndex((_, i) => scoreColumn(headers[i], ['name', 'fullname', 'full_name', 'contact']) >= 1);
  if (fullNameIdx < 0) fullNameIdx = 0;

  let phoneIdx = list.findIndex((_, i) => scoreColumn(headers[i], ['phone', 'tel', 'mobile', 'cell']) >= 1);
  let emailIdx = list.findIndex((_, i) => scoreColumn(headers[i], ['email', 'e-mail', 'mail']) >= 1);

  return { fullNameIdx, phoneIdx, emailIdx };
}

export function rowsToContacts(rows, headers) {
  const { fullNameIdx, phoneIdx, emailIdx } = detectColumns(headers);
  const out = [];
  for (const row of rows) {
    if (!Array.isArray(row) && typeof row !== 'object') continue;
    const arr = Array.isArray(row) ? row : headers.map((h) => row[h]);
    const fullName = String(arr[fullNameIdx] ?? '').trim();
    const phone = phoneIdx >= 0 ? String(arr[phoneIdx] ?? '').trim() : '';
    const email = emailIdx >= 0 ? String(arr[emailIdx] ?? '').trim() : '';
    if (!isValidImportContactName(fullName)) continue;
    out.push({
      full_name: fullName,
      phone,
      email,
      category: 'potential',
      status: 'prospect',
      monthly_amount: 0,
      notes: '',
    });
  }
  return out;
}

export function parseCsvText(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (!parsed.data?.length) return [];
  const headers = parsed.meta.fields || Object.keys(parsed.data[0]);
  const rows = parsed.data.map((obj) => headers.map((h) => obj[h]));
  return rowsToContacts(rows, headers);
}

/** Raw matrix: row 0 = headers (for mapping + preview). */
export function parseCsvTextToMatrix(text) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (!parsed.data?.length) return { headers: [], rows: [] };
  const headers = (parsed.meta.fields || Object.keys(parsed.data[0])).map((h) => String(h ?? ''));
  const rows = parsed.data.map((obj) => headers.map((h) => obj[h]));
  return { headers, rows };
}

/**
 * Build matrix row-by-row with progress every 10 rows (matches worker behavior).
 * Progress: (processed / totalRows) * 100
 */
export function parseCsvTextToMatrixWithProgress(text, onProgress, { signal } = {}) {
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  if (!parsed.data?.length) return { headers: [], rows: [] };
  const headers = (parsed.meta.fields || Object.keys(parsed.data[0])).map((h) => String(h ?? ''));
  const total = parsed.data.length;
  const rows = [];
  for (let i = 0; i < total; i += 1) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const obj = parsed.data[i];
    rows.push(headers.map((h) => obj[h]));
    const done = i + 1;
    if (done % 10 === 0 || done === total) {
      const pct = Math.round((done / total) * 100);
      onProgress?.({ pct, processed: done, total });
    }
  }
  return { headers, rows };
}

export async function parseExcelFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  if (!rows?.length) return [];
  const headers = rows[0].map((c) => String(c ?? ''));
  const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim()));
  return rowsToContacts(dataRows, headers);
}

export async function parseSpreadsheetFileToMatrix(file) {
  const name = (file?.name || '').toLowerCase();
  const ext = name.split('.').pop() || '';
  if (ext === 'csv') {
    const text = await file.text();
    return parseCsvTextToMatrix(text);
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rows?.length) return { headers: [], rows: [] };
    const headers = rows[0].map((c) => String(c ?? ''));
    const dataRows = rows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim()));
    return { headers, rows: dataRows };
  }
  throw new Error('Use .csv, .xlsx, or .xls');
}

/** Main-thread fallback with real row progress (every 10 rows). */
export async function parseSpreadsheetFileToMatrixWithProgress(file, onProgress, { signal } = {}) {
  const name = (file?.name || '').toLowerCase();
  const ext = name.split('.').pop() || '';
  if (ext === 'csv') {
    const text = await file.text();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return parseCsvTextToMatrixWithProgress(text, onProgress, { signal });
  }
  if (ext === 'xlsx' || ext === 'xls') {
    const buf = await file.arrayBuffer();
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (!rawRows?.length) return { headers: [], rows: [] };
    const headers = rawRows[0].map((c) => String(c ?? ''));
    const dataRows = rawRows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim()));
    const total = dataRows.length;
    if (total === 0) return { headers, rows: [] };
    const rows = [];
    for (let i = 0; i < total; i += 1) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      rows.push(dataRows[i]);
      const done = i + 1;
      if (done % 10 === 0 || done === total) {
        const pct = Math.round((done / total) * 100);
        onProgress?.({ pct, processed: done, total });
      }
    }
    return { headers, rows };
  }
  throw new Error('Use .csv, .xlsx, or .xls');
}

/** Email pattern for PDF text extraction */
const PDF_EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
/** North-American style phone (legacy fallback parser) */
const PDF_PHONE_RE = /(\+?1?\s?)?(\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g;

/**
 * NetCasting-style tracker: 10 digits or formatted US phone (PDF table rows).
 * @see parseNetCastingTrackerLines
 */
const NETCAST_PHONE_RE = /\b\d{10}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g;

function draftFromParts(full_name, phone, email) {
  return {
    full_name: full_name || email || phone || 'Imported contact',
    phone: phone || '',
    email: email || '',
    category: 'potential',
    status: 'prospect',
    monthly_amount: 0,
    notes: '',
  };
}

/** Join pdf.js text items with spaces / newlines so table rows stay line-separated. */
function extractPageTextWithLineBreaks(textContent) {
  let out = '';
  for (const item of textContent.items || []) {
    const s = typeof item.str === 'string' ? item.str : '';
    out += s;
    if (item.hasEOL) out += '\n';
    else out += ' ';
  }
  return out;
}

function normalizeUsPhoneDigits(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  return d.slice(-10);
}

/** Detect header like: # Full Name | Phone Number | Email (NetCasting Tracker). */
function isNetCastingHeaderLine(line) {
  const t = String(line || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!t.includes('full') || !t.includes('name')) return false;
  if (!t.includes('phone')) return false;
  return true;
}

function findNetCastPhoneOnLine(line) {
  const re = new RegExp(NETCAST_PHONE_RE.source, 'g');
  let last = null;
  let m;
  while ((m = re.exec(line)) !== null) {
    const raw = m[0];
    const digits = normalizeUsPhoneDigits(raw);
    if (digits.length === 10) {
      last = { raw, index: m.index, digits };
    }
  }
  return last;
}

function parseNetCastingDataLine(trimmedLine) {
  const trimmed = trimmedLine.trim();
  if (trimmed.length < 2) return null;

  const phoneInfo = findNetCastPhoneOnLine(trimmed);

  if (phoneInfo) {
    const beforePhone = trimmed.slice(0, phoneInfo.index).trim();
    const afterPhone = trimmed.slice(phoneInfo.index + phoneInfo.raw.length).trim();

    const rowMatch = beforePhone.match(/^(\d{1,5})\s+(.+)$/);
    let full_name = '';
    if (rowMatch) {
      full_name = rowMatch[2].trim().replace(/\s+/g, ' ');
    } else {
      full_name = beforePhone.replace(/\s+/g, ' ');
    }
    if (!isValidImportContactName(full_name)) return null;

    let email = '';
    const em = afterPhone.match(PDF_EMAIL_RE);
    if (em) email = em[0];

    return draftFromParts(full_name, phoneInfo.digits, email);
  }

  /** Name-only row (optional leading index / row number); optional email on the line. */
  let rest = trimmed.replace(/^\d+\s*/, '').trim();
  const emails = [...rest.matchAll(new RegExp(PDF_EMAIL_RE.source, 'gi'))].map((m) => m[0]);
  const email = emails[0] || '';
  if (email) {
    rest = rest.split(email).join(' ').trim();
  }
  rest = rest.replace(/\s+/g, ' ');
  if (!isValidImportContactName(rest)) return null;
  return draftFromParts(rest, '', email);
}

/**
 * Hannah's NetCasting Tracker–style tables: row index, full name, US phone, optional email.
 * Parses line-by-line after optional header row detection.
 */
export function parseNetCastingTrackerLines(lines) {
  const rawLines = Array.isArray(lines) ? lines : String(lines || '').split(/\r?\n/);
  const trimmed = rawLines.map((l) => l.trim()).filter(Boolean);

  let startIdx = 0;
  const headerIdx = trimmed.findIndex((l) => isNetCastingHeaderLine(l));
  if (headerIdx >= 0) startIdx = headerIdx + 1;

  const byKey = new Map();

  for (let i = startIdx; i < trimmed.length; i += 1) {
    const line = trimmed[i];
    if (isNetCastingHeaderLine(line)) continue;

    const draft = parseNetCastingDataLine(line);
    if (!draft) continue;

    const phoneDigits = normalizeUsPhoneDigits(draft.phone);
    const key =
      phoneDigits.length === 10 ? `p:${phoneDigits}` : `n:${normalizeFullName(draft.full_name)}`;
    if (!byKey.has(key)) byKey.set(key, draft);
  }

  return Array.from(byKey.values());
}

/**
 * Extract contacts from PDF plain text: NetCasting tracker tables first, then legacy heuristics.
 */
export function parsePdfContactsFromText(text) {
  const raw = String(text || '');
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const netCast = parseNetCastingTrackerLines(lines);

  const contacts = [];
  const seenEmail = new Set();

  for (const line of lines) {
    const cleaned = line.replace(/^\d+\s*/, '').trim();
    const emails = [...line.matchAll(new RegExp(PDF_EMAIL_RE.source, 'gi'))].map((m) => m[0]);
    const phones = [...line.matchAll(new RegExp(PDF_PHONE_RE.source, 'g'))].map((m) => m[0].trim());

    for (const email of emails) {
      const key = email.toLowerCase();
      if (seenEmail.has(key)) continue;
      seenEmail.add(key);

      const lowerLine = line.toLowerCase();
      const idx = lowerLine.indexOf(email.toLowerCase());
      let namePart = idx >= 0 ? line.slice(0, idx) : line;
      namePart = namePart.replace(new RegExp(PDF_PHONE_RE.source, 'g'), '').trim();
      namePart = namePart.replace(/^[-•*–—\t\s\d.)]+/, '').trim();
      namePart = namePart.replace(/^\d+\s*/, '').trim();
      const full_name = namePart || email.split('@')[0] || '';
      if (!isValidImportContactName(full_name)) continue;

      contacts.push(draftFromParts(full_name, phones[0] || '', email));
    }

    /** Name + optional phone, optional email — no email on line */
    if (!emails.length && cleaned) {
      let rest = cleaned;
      const phone = phones[0] || '';
      for (const p of phones) {
        rest = rest.replace(p, ' ');
      }
      rest = rest.replace(/^[-•*–—\t\s\d.)]+/, '').trim().replace(/\s+/g, ' ');
      if (isValidImportContactName(rest)) {
        contacts.push(draftFromParts(rest, phone, ''));
      }
    }
  }

  const merged = [...netCast, ...contacts];
  const uniq = [];
  const seen = new Set();
  for (const c of merged) {
    if (!isValidImportContactName(c.full_name)) continue;
    const k = `${normalizeFullName(c.full_name)}|${c.phone}|${(c.email || '').toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    uniq.push(c);
  }
  if (uniq.length > 0) return uniq;

  const emailsGlobal = [...raw.matchAll(new RegExp(PDF_EMAIL_RE.source, 'gi'))].map((m) => m[0]);
  const phonesGlobal = [...raw.matchAll(new RegExp(PDF_PHONE_RE.source, 'g'))].map((m) => m[0].trim());

  if (emailsGlobal.length === 0 && phonesGlobal.length === 0 && lines.length) {
    return lines
      .slice(0, 200)
      .map((line) => {
        const cleaned = line.replace(/^\d+\s*/, '').trim();
        const short = cleaned.length > 120 ? `${cleaned.slice(0, 117)}…` : cleaned;
        return isValidImportContactName(short) ? draftFromParts(short, '', '') : null;
      })
      .filter(Boolean);
  }

  const n = Math.max(emailsGlobal.length, phonesGlobal.length, 1);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const nm = lines[i] || '';
    const cleaned = nm.replace(/^\d+\s*/, '').trim();
    if (!isValidImportContactName(cleaned)) continue;
    out.push(draftFromParts(cleaned, phonesGlobal[i] || '', emailsGlobal[i] || ''));
  }
  return out.filter((c) => isValidImportContactName(c.full_name));
}

/**
 * If PDF.js / workers fail (e.g. Safari), scan decoded bytes for phone-like patterns.
 */
function parsePdfContactsFromRawBytesLatin1(arrayBuffer) {
  const raw = new TextDecoder('latin1').decode(arrayBuffer);
  const phones = [...raw.matchAll(new RegExp(PDF_PHONE_RE.source, 'g'))].map((m) => m[0].trim());
  const netcast = [...raw.matchAll(new RegExp(NETCAST_PHONE_RE.source, 'g'))].map((m) => m[0]);
  const combined = [...phones, ...netcast];
  const byDigits = new Map();
  for (const p of combined) {
    const digits = String(p || '').replace(/\D/g, '');
    const norm = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits.slice(-10);
    if (norm.length !== 10) continue;
    if (!byDigits.has(norm)) {
      byDigits.set(norm, draftFromParts('Imported contact', norm, ''));
    }
  }
  const emails = [...raw.matchAll(new RegExp(PDF_EMAIL_RE.source, 'gi'))].map((m) => m[0]);
  const out = Array.from(byDigits.values());
  for (const email of emails) {
    if (!out.some((c) => c.email === email)) {
      out.push(draftFromParts(email.split('@')[0] || 'Imported contact', '', email));
    }
  }
  return out.filter((c) => isValidImportContactName(c.full_name));
}

export async function parsePdfFile(file, { shouldCancel, onProgress } = {}) {
  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (e) {
    console.error('PDF error:', e);
    throw new Error(`PDF error: ${e?.message || String(e)}`);
  }

  try {
    onProgress?.({ pct: 2, note: 'Loading PDF…', processed: 0, total: 1 });
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages || 1;
    let fullText = '';
    for (let i = 1; i <= numPages; i += 1) {
      if (shouldCancel?.()) return [];
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      fullText += extractPageTextWithLineBreaks(content);
      fullText += '\n';
      const pct = Math.round((i / numPages) * 85);
      onProgress?.({ pct, note: `Reading page ${i} of ${numPages}…`, processed: i, total: numPages });
      if (shouldCancel?.()) return [];
      await new Promise((r) => setTimeout(r, 0));
    }
    onProgress?.({ pct: 92, note: 'Parsing contacts…', processed: numPages, total: numPages });
    const contacts = parsePdfContactsFromText(fullText);
    onProgress?.({ pct: 100, processed: numPages, total: numPages });
    return contacts;
  } catch (err) {
    console.error('PDF error:', err);
    onProgress?.({ pct: 40, note: 'PDF viewer unavailable — scanning file for phone numbers…', processed: 0, total: 1 });
    try {
      const fallback = parsePdfContactsFromRawBytesLatin1(arrayBuffer);
      if (fallback.length) {
        onProgress?.({ pct: 100, note: 'Imported from text scan', processed: 1, total: 1 });
        return fallback;
      }
    } catch (fallbackErr) {
      console.error('PDF fallback error:', fallbackErr);
    }
    throw new Error(`PDF error: ${err?.message || String(err)}`);
  }
}

/**
 * Prefer Web Worker + Papa/xlsx; fall back to main-thread parse if workers fail.
 */
export async function parseSpreadsheetFileToMatrixReliable(file, { onProgress, signal } = {}) {
  const { parseSpreadsheetFileWithWorker } = await import('./spreadsheetWorkerClient');
  try {
    return await parseSpreadsheetFileWithWorker(file, {
      onProgress,
      signal,
    });
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    console.warn('[import] Worker parse unavailable, using main-thread fallback', e);
    return parseSpreadsheetFileToMatrixWithProgress(file, onProgress, { signal });
  }
}

/** Returns spreadsheet ID or null (matches Google Sheets URL shape). */
export function extractGoogleSheetId(url) {
  const u = String(url || '').trim();
  const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}

/** Public CSV export URLs — try plain `format=csv` first, then `gid=0` for the first tab. */
export function buildGoogleSheetCsvExportUrls(sheetId) {
  const id = String(sheetId || '').trim();
  return [
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv`,
    `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=0`,
  ];
}

export const INVALID_GOOGLE_SHEET_LINK_MSG = 'Please paste a valid Google Sheets link';
export const SHEET_NOT_PUBLIC_MSG =
  'This sheet is not publicly accessible. Please change sharing settings to Anyone with the link';
export const NO_CONTACTS_IN_SHEET_MSG =
  'No contacts found in this sheet — make sure there is a column with each contact’s name (phone and email are optional)';

function looksLikeHtmlSignInPage(text) {
  const t = String(text || '').slice(0, 500).trim().toLowerCase();
  return t.startsWith('<!') || (t.startsWith('<html') && (t.includes('sign in') || t.includes('login')));
}

/**
 * Fetch CSV from `docs.google.com/.../export?format=csv`: direct fetch when CORS allows,
 * then corsproxy.io and allorigins for each export URL variant.
 */
export async function fetchGoogleSheetAsCsv(sheetUrl) {
  const sheetId = extractGoogleSheetId(sheetUrl);
  if (!sheetId) {
    throw new Error(INVALID_GOOGLE_SHEET_LINK_MSG);
  }

  const exportUrls = buildGoogleSheetCsvExportUrls(sheetId);

  async function fetchDirect(url) {
    try {
      const res = await fetch(url, { method: 'GET', mode: 'cors' });
      if (!res.ok) return null;
      let text = await res.text();
      text = text.replace(/^\uFEFF/, '');
      if (!text.trim() || looksLikeHtmlSignInPage(text)) return null;
      return text;
    } catch {
      return null;
    }
  }

  for (const url of exportUrls) {
    const direct = await fetchDirect(url);
    if (direct) return direct;
  }

  async function tryProxy(proxiedUrl) {
    try {
      const res = await fetch(proxiedUrl);
      const text = (await res.text()).replace(/^\uFEFF/, '');
      const ok = res.ok && Boolean(text?.trim()) && !looksLikeHtmlSignInPage(text);
      return { text, ok };
    } catch {
      return { text: '', ok: false };
    }
  }

  const proxies = [
    (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  ];

  for (const exportUrl of exportUrls) {
    for (const wrap of proxies) {
      const attempt = await tryProxy(wrap(exportUrl));
      if (attempt.ok && attempt.text?.trim()) return attempt.text;
    }
  }

  throw new Error(SHEET_NOT_PUBLIC_MSG);
}
