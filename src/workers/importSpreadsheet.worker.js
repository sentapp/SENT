/* eslint-disable no-restricted-globals */
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

function postProgress(id, processed, total, note) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  self.postMessage({ type: 'progress', id, pct, processed, total, note });
}

self.onmessage = (e) => {
  const { id, kind, payload } = e.data || {};
  if (id == null) return;

  try {
    if (kind === 'csv') {
      const text = payload?.text ?? '';
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
      if (!parsed.data?.length) {
        self.postMessage({ id, ok: true, result: { headers: [], rows: [] } });
        return;
      }
      const headers = (parsed.meta.fields || Object.keys(parsed.data[0])).map((h) => String(h ?? ''));
      const rows = [];
      const total = parsed.data.length;
      for (let i = 0; i < total; i += 1) {
        const obj = parsed.data[i];
        rows.push(headers.map((h) => obj[h]));
        const done = i + 1;
        if (done % 10 === 0 || done === total) {
          postProgress(id, done, total, `Rows ${done} / ${total}`);
        }
      }
      self.postMessage({ id, ok: true, result: { headers, rows } });
      return;
    }

    if (kind === 'excel') {
      const buffer = payload?.buffer;
      if (!buffer) throw new Error('Missing file data');
      const wb = XLSX.read(buffer, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (!rawRows?.length) {
        self.postMessage({ id, ok: true, result: { headers: [], rows: [] } });
        return;
      }
      const headers = rawRows[0].map((c) => String(c ?? ''));
      const dataRows = rawRows.slice(1).filter((r) => r.some((c) => String(c ?? '').trim()));
      const total = dataRows.length;
      if (total === 0) {
        self.postMessage({ id, ok: true, result: { headers, rows: [] } });
        return;
      }
      const rows = [];
      for (let i = 0; i < total; i += 1) {
        rows.push(dataRows[i]);
        const done = i + 1;
        if (done % 10 === 0 || done === total) {
          postProgress(id, done, total, `Rows ${done} / ${total}`);
        }
      }
      self.postMessage({ id, ok: true, result: { headers, rows } });
      return;
    }

    self.postMessage({ id, ok: false, error: 'Unknown import type' });
  } catch (err) {
    self.postMessage({ id, ok: false, error: err?.message || String(err) });
  }
};
