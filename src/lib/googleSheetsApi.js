import {
  extractGoogleSheetId,
  fetchGoogleSheetAsCsv,
  INVALID_GOOGLE_SHEET_LINK_MSG,
  NO_CONTACTS_IN_SHEET_MSG,
  parseCsvTextToMatrixWithProgress,
  SHEET_NOT_PUBLIC_MSG,
} from './contactImport';
import { pickBestSheet } from './spreadsheetSheetPick';

/**
 * Reads spreadsheet values via Google Sheets API v4.
 * Set REACT_APP_GOOGLE_SHEETS_API_KEY in .env (restrict key to Sheets API + HTTP referrers in Cloud Console).
 */
export function getGoogleSheetsApiKey() {
  return (process.env.REACT_APP_GOOGLE_SHEETS_API_KEY || '').trim();
}

function mapGoogleSheetsApiError(status, message) {
  const m = String(message || '').toLowerCase();
  if (status === 403 || status === 401 || m.includes('permission') || m.includes('forbidden')) {
    return new Error(SHEET_NOT_PUBLIC_MSG);
  }
  if (status === 404 || m.includes('not found')) {
    return new Error('We couldn’t find that spreadsheet. Check the link or make sure the file still exists.');
  }
  if (m.includes('api key')) {
    return new Error('Google Sheets API key is missing or not allowed. Check REACT_APP_GOOGLE_SHEETS_API_KEY in .env or use link sharing + CSV import.');
  }
  return new Error(message || 'Could not load the sheet from Google.');
}

async function fetchJson(url) {
  const res = await fetch(url);
  let json = {};
  try {
    json = await res.json();
  } catch {
    json = {};
  }
  if (!res.ok) {
    const msg = json?.error?.message || res.statusText || 'Request failed';
    throw mapGoogleSheetsApiError(res.status, msg);
  }
  return json;
}

function parseRangeSheetTitle(rangeStr) {
  const r = String(rangeStr || '');
  const bang = r.indexOf('!');
  if (bang <= 0) return r.trim();
  let t = r.slice(0, bang).trim();
  if (t.startsWith("'") && t.endsWith("'")) t = t.slice(1, -1).replace(/''/g, "'");
  return t;
}

/**
 * Returns { headers: string[], rows: any[][] } from the best tab's data (row 0 = header).
 */
export async function fetchSheetMatrixViaGoogleApi(spreadsheetId, apiKey, { onProgress } = {}) {
  if (!apiKey) throw new Error('Missing Google Sheets API key.');
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${encodeURIComponent(apiKey)}&fields=sheets(properties(title,sheetId))`;
  const meta = await fetchJson(metaUrl);
  const sheetList = meta.sheets || [];
  if (!sheetList.length) throw new Error('No sheets found in this spreadsheet.');

  const maxSheets = Math.min(sheetList.length, 12);
  const rangeParams = [];
  for (let i = 0; i < maxSheets; i += 1) {
    const title = sheetList[i]?.properties?.title;
    if (!title) continue;
    const quoted = `'${String(title).replace(/'/g, "''")}'`;
    rangeParams.push(`${quoted}!A1:Z10000`);
  }
  if (!rangeParams.length) throw new Error('No sheets found in this spreadsheet.');

  const qs = rangeParams.map((rng) => `ranges=${encodeURIComponent(rng)}`).join('&');
  const batchUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet?key=${encodeURIComponent(apiKey)}&${qs}`;
  const batch = await fetchJson(batchUrl);
  const valueRanges = batch.valueRanges || [];

  const descriptors = valueRanges.map((vr) => ({
    name: parseRangeSheetTitle(vr.range),
    rawRows: vr.values && Array.isArray(vr.values) ? vr.values : [],
  }));

  const nonEmptyDescriptors = descriptors.filter((d) => d.rawRows.some((row) => Array.isArray(row) && row.some((c) => String(c ?? '').trim())));
  const pool = nonEmptyDescriptors.length ? nonEmptyDescriptors : descriptors;
  const best = pickBestSheet(pool) || pool[0];
  if (!best?.rawRows?.length) throw new Error('The sheet appears empty.');

  const values = best.rawRows;
  const headers = values[0].map((c) => String(c ?? ''));
  const rawRows = values.slice(1).filter((r) => Array.isArray(r) && r.some((c) => String(c ?? '').trim()));
  const total = rawRows.length;
  const rows = [];
  if (total === 0) {
    onProgress?.({ pct: 100 });
    return { headers, rows: [] };
  }
  for (let i = 0; i < total; i += 1) {
    rows.push(rawRows[i]);
    const done = i + 1;
    if (done % 10 === 0 || done === total) {
      const pct = Math.round((done / total) * 100);
      onProgress?.({ pct, processed: done, total });
    }
  }
  return { headers, rows };
}

/** Fallback: CSV export via direct/proxy fetch + Papa Parse (same path as file CSV in contactImport). */
export async function fetchGoogleSheetMatrixViaCsvExport(sheetUrl, { onProgress, signal } = {}) {
  onProgress?.({ pct: 5, note: 'Downloading sheet…' });
  const csv = await fetchGoogleSheetAsCsv(sheetUrl);
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  onProgress?.({ pct: 15, note: 'Parsing CSV…' });
  const { headers, rows } = parseCsvTextToMatrixWithProgress(
    csv,
    ({ pct: rowPct, processed, total }) => {
      const pct = Math.round(15 + rowPct * 0.85);
      onProgress?.({ pct, processed, total, note: `Rows ${processed} / ${total}` });
    },
    { signal },
  );
  if (!headers?.length || !rows?.length) {
    throw new Error(NO_CONTACTS_IN_SHEET_MSG);
  }
  onProgress?.({ pct: 100 });
  return { headers, rows };
}

export async function fetchGoogleSheetMatrix(sheetUrl, { onProgress, signal } = {}) {
  const id = extractGoogleSheetId(sheetUrl);
  if (!id) {
    throw new Error(INVALID_GOOGLE_SHEET_LINK_MSG);
  }
  const key = getGoogleSheetsApiKey();
  if (key) {
    try {
      const result = await fetchSheetMatrixViaGoogleApi(id, key, { onProgress });
      onProgress?.({ pct: 100 });
      return result;
    } catch (e) {
      console.warn('Google Sheets API failed, trying CSV export:', e);
    }
  }
  return fetchGoogleSheetMatrixViaCsvExport(sheetUrl, { onProgress, signal });
}
