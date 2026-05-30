/** Local calendar date `YYYY-MM-DD`. */
export function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Whole days between two dates (absolute difference). */
export function daysBetween(a, b) {
  const t0 = new Date(a).setHours(0, 0, 0, 0);
  const t1 = new Date(b).setHours(0, 0, 0, 0);
  if (Number.isNaN(t0) || Number.isNaN(t1)) return Infinity;
  return Math.abs(Math.round((t1 - t0) / (24 * 60 * 60 * 1000)));
}

/** Days since an ISO timestamp, or `null` if missing/invalid. */
export function daysSince(isoOrNull) {
  if (!isoOrNull) return null;
  const t = new Date(isoOrNull).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
}

/** Quick-pick offsets for follow-up scheduling. */
export function getDateFromNow(opt) {
  const d = new Date();
  if (opt === '1 month') d.setMonth(d.getMonth() + 1);
  else if (opt === '3 months') d.setMonth(d.getMonth() + 3);
  else if (opt === '6 months') d.setMonth(d.getMonth() + 6);
  return localDateStr(d);
}

/** Calendar date N days from today. */
export function addDaysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

/** Inclusive mission day number (1 on start date), or null if missing/invalid. */
export function computeDayOfMission(startDateStr) {
  if (!startDateStr) return null;
  const start = new Date(`${String(startDateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((today - start) / (24 * 60 * 60 * 1000)) + 1);
}

/** Inclusive total mission days from start to end, or null if missing/invalid. */
export function computeTotalMissionDays(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return null;
  const start = new Date(`${String(startDateStr).slice(0, 10)}T12:00:00`);
  const end = new Date(`${String(endDateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  if (end < start) return null;
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

/** Whole days until a follow-up date (negative if overdue). */
export function daysUntilFollowUp(followUpDateStr) {
  if (!followUpDateStr) return Infinity;
  const target = new Date(`${String(followUpDateStr).slice(0, 10)}T12:00:00`);
  if (Number.isNaN(target.getTime())) return Infinity;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target - today) / (24 * 60 * 60 * 1000));
}
