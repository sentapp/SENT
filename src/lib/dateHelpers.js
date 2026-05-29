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
