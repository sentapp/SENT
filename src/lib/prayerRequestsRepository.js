export function mapPrayerRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    body: row.body || '',
    createdAt: row.created_at,
    anonymous: Boolean(row.is_anonymous),
    prayedCount: Number(row.prayed_count ?? 0),
    authorId: row.author_id,
    missionaryId: row.missionary_id,
  };
}

export async function fetchPrayerRequestsForMissionary(supabaseClient, missionaryId) {
  if (!supabaseClient || !missionaryId) return [];
  const { data, error } = await supabaseClient
    .from('prayer_requests')
    .select('id, missionary_id, author_id, body, is_anonymous, prayed_count, created_at')
    .eq('missionary_id', missionaryId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchPrayerRequestsForMissionary', error);
    return [];
  }
  return (data || []).map(mapPrayerRow);
}

export async function insertPrayerRequest(supabaseClient, { missionaryId, authorId, body, anonymous }) {
  const text = String(body ?? '').trim();
  if (!text || !supabaseClient || !missionaryId) return { error: new Error('Invalid prayer request.') };

  const { data, error } = await supabaseClient
    .from('prayer_requests')
    .insert({
      missionary_id: missionaryId,
      author_id: anonymous ? null : authorId,
      body: text,
      is_anonymous: Boolean(anonymous),
    })
    .select('*')
    .single();

  if (error) return { error };
  return { data: mapPrayerRow(data) };
}

export async function incrementPrayedCount(supabaseClient, requestId) {
  if (!supabaseClient || !requestId) return { error: new Error('Missing id.') };

  const { data: row, error: selErr } = await supabaseClient
    .from('prayer_requests')
    .select('prayed_count')
    .eq('id', requestId)
    .maybeSingle();

  if (selErr) return { error: selErr };
  const next = Number(row?.prayed_count ?? 0) + 1;

  const { error: upErr } = await supabaseClient.from('prayer_requests').update({ prayed_count: next }).eq('id', requestId);

  if (upErr) return { error: upErr };
  return { prayedCount: next };
}
