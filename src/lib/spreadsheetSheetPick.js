/** Pure helpers for choosing a workbook tab (Excel / Google multi-sheet). No xlsx / network deps. */

export const SHEET_SKIP_NAME_SUBSTRINGS = ['dashboard', 'summary', 'overview', 'instructions', 'readme'];

export const SHEET_PREFER_NAME_SUBSTRINGS = [
  'netcasting',
  'contacts',
  'list',
  'people',
  'donors',
  'supporters',
];

function normSheetTitle(name) {
  return String(name ?? '')
    .trim()
    .toLowerCase();
}

function titleContainsAny(name, substrings) {
  const n = normSheetTitle(name);
  return substrings.some((k) => n.includes(String(k).toLowerCase()));
}

/** First trimmed non-empty cell scanning rows left-to-right, top-to-bottom. */
export function firstNonEmptyCellValue(rawRows) {
  for (const row of rawRows || []) {
    if (!Array.isArray(row)) continue;
    for (const c of row) {
      const s = String(c ?? '').trim();
      if (s) return s;
    }
  }
  return '';
}

/**
 * Dashboard-style lead cell: labels or standalone numeric summary cells.
 */
export function firstCellIndicatesDashboardLead(val) {
  const s = String(val ?? '').trim();
  if (!s) return false;
  const low = s.toLowerCase();
  if (low.includes('dashboard') || low.includes('total') || s.includes('%')) return true;
  const numProbe = s.replace(/[$€£,\s]/g, '');
  if (/^-?\d*\.?\d+$/.test(numProbe)) return true;
  return false;
}

export function rowIsAllNumbersOrEmpty(row) {
  if (!Array.isArray(row) || !row.length) return true;
  return row.every((c) => {
    const s = String(c ?? '').trim();
    if (!s) return true;
    const compact = s.replace(/[$€£,\s%]/g, '');
    return /^-?\d*\.?\d+$/.test(compact) || /^-?\d*\.?\d+%$/.test(s.replace(/\s/g, ''));
  });
}

/** Name field-only guards (row may still be skipped for other reasons). */
export function importNameFieldShouldSkip(nameStr) {
  const s = String(nameStr ?? '').trim();
  if (!s) return true;
  if (s.startsWith('%')) return true;
  if (/^[\d\s]+$/.test(s)) return true;
  return false;
}

function quickPlausibleContactRowCount(rawRows) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  if (!rows.length) return 0;
  let start = 0;
  const first = rows[0] || [];
  const headerish = first.some((c) => {
    const t = String(c ?? '')
      .toLowerCase()
      .trim();
    return t && (t.includes('name') || t.includes('phone') || t.includes('email'));
  });
  if (headerish) start = 1;

  let count = 0;
  for (let i = start; i < rows.length; i += 1) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    if (rowIsAllNumbersOrEmpty(row)) continue;
    let hit = false;
    for (const cell of row) {
      const t = String(cell ?? '').trim();
      if (!t || importNameFieldShouldSkip(t)) continue;
      if (/[a-zA-Z]{2,}/.test(t) && !/^[\d\s]+$/.test(t)) {
        hit = true;
        break;
      }
    }
    if (hit) count += 1;
  }
  return count;
}

/**
 * @param {{ name: string, rawRows: any[][] }[]} sheets
 * @returns {{ name: string, rawRows: any[][] } | null}
 */
export function pickBestSheet(sheets) {
  if (!sheets?.length) return null;
  const list = sheets.filter((s) => s && Array.isArray(s.rawRows));

  for (const s of list) {
    if (titleContainsAny(s.name, SHEET_PREFER_NAME_SUBSTRINGS)) return s;
  }

  for (const s of list) {
    if (titleContainsAny(s.name, SHEET_SKIP_NAME_SUBSTRINGS)) continue;
    if (firstCellIndicatesDashboardLead(firstNonEmptyCellValue(s.rawRows))) continue;
    return s;
  }

  for (const s of list) {
    if (titleContainsAny(s.name, SHEET_SKIP_NAME_SUBSTRINGS)) continue;
    return s;
  }

  let best = list[0];
  let bestScore = quickPlausibleContactRowCount(best?.rawRows);
  for (let i = 1; i < list.length; i += 1) {
    const sc = quickPlausibleContactRowCount(list[i].rawRows);
    if (sc > bestScore) {
      best = list[i];
      bestScore = sc;
    }
  }
  return best || list[0] || null;
}

/**
 * True for empty rows, numeric-only grids, or rows with no usable name-like text.
 * Use before building import drafts.
 */
export function isJunkRow(row) {
  if (!Array.isArray(row) || row.length === 0) return true;
  if (!row.some((cell) => String(cell ?? '').trim() !== '')) return true;
  if (rowIsAllNumbersOrEmpty(row)) return true;
  const cells = row.map((c) => String(c ?? '').trim()).filter(Boolean);
  if (!cells.length) return true;
  if (cells.length === 1 && importNameFieldShouldSkip(cells[0])) return true;
  return false;
}

/**
 * Pick the best worksheet from an XLSX workbook (multi-tab).
 * @param {{ SheetNames: string[], Sheets: Record<string, unknown> }} workbook
 * @param {(sheet: unknown) => unknown[][]} sheetToRows e.g. (sh) => XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' })
 * @returns {{ name: string, rawRows: unknown[][] } | null}
 */
export function pickBestSheetFromWorkbook(workbook, sheetToRows) {
  const names = workbook?.SheetNames;
  if (!Array.isArray(names) || names.length === 0) return null;
  const sheetMetas = names.map((name) => ({
    name,
    rawRows: sheetToRows(workbook.Sheets[name]),
  }));
  return pickBestSheet(sheetMetas) || sheetMetas[0] || null;
}
