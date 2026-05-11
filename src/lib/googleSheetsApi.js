import {
  extractGoogleSheetId,
  fetchGoogleSheetAsCsv,
  INVALID_GOOGLE_SHEET_LINK_MSG,
  NO_CONTACTS_IN_SHEET_MSG,
  parseCsvTextToMatrixWithProgress,
  SHEET_NOT_PUBLIC_MSG,
} from './contactImport';

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

/**
 * Returns { headers: string[], rows: any[][] } from first sheet's data (row 0 = header).
 */
export async function fetchSheetMatrixViaGoogleApi(spreadsheetId, apiKey, { onProgress } = {}) {
  if (!apiKey) throw new Error('Missing Google Sheets API key.');
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${encodeURIComponent(apiKey)}&fields=sheets(properties(title,sheetId))`;
  const meta = await fetchJson(metaUrl);
  const title = meta.sheets?.[0]?.properties?.title;
  if (!title) throw new Error('No sheets found in this spreadsheet.');

  const quoted = `'${String(title).replace(/'/g, "''")}'`;
  const range = `${quoted}!A1:Z10000`;
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(apiKey)}`;
  const data = await fetchJson(valuesUrl);
  const values = data.values || [];
  if (!values.length) throw new Error('The sheet appears empty.');
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
