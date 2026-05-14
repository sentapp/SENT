/** @param {string | null | undefined} dueDateStr */
export function parseDueYmd(dueDateStr) {
  if (dueDateStr == null || String(dueDateStr).trim() === '') return null;
  const ymd = String(dueDateStr).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split('-').map((n) => Number(n));
  if (!y || !m || !d) return null;
  return { ymd, y, m, d };
}

/** Local calendar YYYY-MM-DD */
export function localTodayYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param {string | null | undefined} dueDateStr
 * @param {string} todayYmd
 */
export function isDueToday(dueDateStr, todayYmd) {
  const p = parseDueYmd(dueDateStr);
  if (!p) return false;
  return p.ymd === todayYmd;
}

/**
 * @param {string | null | undefined} dueDateStr
 * @param {string} todayYmd
 */
export function isOverdue(dueDateStr, todayYmd) {
  const p = parseDueYmd(dueDateStr);
  if (!p) return false;
  return p.ymd < todayYmd;
}

/**
 * @param {string | null | undefined} dueDateStr
 * @param {string} todayYmd
 */
export function daysOverdue(dueDateStr, todayYmd) {
  if (!isOverdue(dueDateStr, todayYmd)) return 0;
  const p = parseDueYmd(dueDateStr);
  if (!p) return 0;
  const due = new Date(p.y, p.m - 1, p.d);
  const [ty, tm, td] = todayYmd.split('-').map((n) => Number(n));
  const today = new Date(ty, tm - 1, td);
  const diffMs = today.getTime() - due.getTime();
  return Math.max(0, Math.round(diffMs / 86400000));
}

/**
 * @param {string | null | undefined} dueDateStr
 */
export function formatDate(dueDateStr) {
  const p = parseDueYmd(dueDateStr);
  if (!p) return '';
  const dt = new Date(p.y, p.m - 1, p.d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
