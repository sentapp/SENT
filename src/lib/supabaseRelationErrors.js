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

/** True when the error is about the `mission_pushes` table missing or not exposed (PostgREST / Postgres). */
export function isMissingMissionPushesTableError(err) {
  if (!err) return false;
  const blob = `${err.message ?? ''} ${err.details ?? ''} ${err.hint ?? ''}`.toLowerCase();
  if (!blob.includes('mission_pushes')) return false;
  if (isMissingDbRelationError(err)) return true;
  if (blob.includes('does not exist') || blob.includes('could not find') || blob.includes('not found')) return true;
  if (blob.includes('schema cache')) return true;
  return false;
}
