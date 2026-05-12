/** True when PostgREST reports a missing table/relation or stale schema cache (e.g. PGRST205). */
export function isMissingDbRelationError(err) {
  if (!err) return false;
  const code = String(err.code ?? '');
  const msg = String(err.message ?? err.details ?? '').toLowerCase();
  if (code === 'PGRST205' || code === '42P01') return true;
  if (msg.includes('schema cache') && msg.includes('mission_pushes')) return true;
  if (msg.includes('could not find the table')) return true;
  if (msg.includes('relation') && msg.includes('does not exist')) return true;
  if (msg.includes('undefined table')) return true;
  return false;
}
