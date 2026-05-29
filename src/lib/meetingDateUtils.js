export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDay(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.getDate();
}

export function formatMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : MONTHS[d.getMonth()];
}

export function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  const h = Number.parseInt(parts[0], 10);
  const m = parts[1] ?? '00';
  if (Number.isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.slice(0, 2)} ${ampm}`;
}

export function formatMeetingDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** @returns {{ year: number, month: number }} month is 0-indexed */
export function parseYearMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isFinite(y) || !Number.isFinite(m)) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  return { year: y, month: m };
}

export function shiftMonth(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export function dateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Build a 6-row calendar grid for the given month.
 * @returns {Array<{ date: string | null, day: number | null, isCurrentMonth: boolean }>}
 */
export function buildCalendarCells(year, month) {
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];

  for (let i = 0; i < startPad; i += 1) {
    cells.push({ date: null, day: null, isCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: dateKey(year, month, day), day, isCurrentMonth: true });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, day: null, isCurrentMonth: false });
  }
  while (cells.length < 42) {
    cells.push({ date: null, day: null, isCurrentMonth: false });
  }
  return cells;
}
