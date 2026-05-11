/**
 * Status text tied to real progress percentage (matches progress bar).
 */
export function phaseLabelFromPct(pct) {
  const p = Math.min(100, Math.max(0, Number(pct) || 0));
  if (p >= 100) return 'Done!';
  if (p >= 75) return 'Finishing up...';
  if (p >= 50) return 'Almost there...';
  if (p >= 25) return 'Parsing contacts...';
  return 'Reading your file...';
}
