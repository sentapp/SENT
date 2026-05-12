import Papa from 'papaparse';

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
