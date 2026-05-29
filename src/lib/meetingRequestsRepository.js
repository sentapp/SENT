/**
 * @param {Record<string, unknown>} row
 */
export function mapMeetingRequestRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    missionaryId: row.missionary_id,
    requesterId: row.requester_id ?? null,
    requesterName: row.requester_name ?? '',
    requestedDate: row.requested_date ?? null,
    message: row.message ?? '',
    status: row.status ?? 'pending',
    createdAt: row.created_at ?? null,
  };
}

export async function fetchMeetingRequestsForMissionary(supabaseClient, missionaryId, { status } = {}) {
  if (!supabaseClient || !missionaryId) return [];
  let q = supabaseClient
    .from('meeting_requests')
    .select('*')
    .eq('missionary_id', missionaryId)
    .order('requested_date', { ascending: true })
    .order('created_at', { ascending: true });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) {
    console.error('fetchMeetingRequestsForMissionary', error);
    return [];
  }
  return (data || []).map(mapMeetingRequestRow);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @param {{
 *   missionaryId: string,
 *   requesterId: string,
 *   requesterName?: string,
 *   requestedDate: string,
 *   message?: string,
 * }} payload
 */
export async function submitMeetingRequest(supabaseClient, payload) {
  const { missionaryId, requesterId, requesterName, requestedDate, message } = payload;
  if (!supabaseClient || !missionaryId || !requesterId || !requestedDate) {
    return { ok: false, error: 'Date and missionary are required.' };
  }

  const row = {
    missionary_id: missionaryId,
    requester_id: requesterId,
    requester_name: String(requesterName ?? '').trim() || null,
    requested_date: String(requestedDate).slice(0, 10),
    message: message != null && String(message).trim() ? String(message).trim() : null,
    status: 'pending',
  };

  const { data, error } = await supabaseClient.from('meeting_requests').insert(row).select('*').single();
  if (error) return { ok: false, error: error.message || 'Could not send request.' };
  return { ok: true, request: mapMeetingRequestRow(data) };
}

export async function updateMeetingRequestStatus(supabaseClient, { requestId, missionaryId, status }) {
  if (!supabaseClient || !requestId || !missionaryId) {
    return { ok: false, error: 'Missing request.' };
  }
  const { error } = await supabaseClient
    .from('meeting_requests')
    .update({ status })
    .eq('id', requestId)
    .eq('missionary_id', missionaryId);
  if (error) return { ok: false, error: error.message || 'Could not update request.' };
  return { ok: true };
}
