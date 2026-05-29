import { createNotification } from './notificationsRepository';

const PRAYER_AUTHOR_EMBED =
  'id, missionary_id, author_id, body, is_anonymous, prayed_count, created_at, author:profiles!prayer_requests_author_id_fkey(full_name)';

export function mapPrayerRow(row) {
  if (!row) return null;
  const author = row.author && typeof row.author === 'object' ? row.author : null;
  const authorFullName = author?.full_name != null ? String(author.full_name).trim() : '';
  return {
    id: row.id,
    body: row.body || '',
    createdAt: row.created_at,
    anonymous: Boolean(row.is_anonymous),
    prayedCount: Number(row.prayed_count ?? 0),
    authorId: row.author_id,
    missionaryId: row.missionary_id,
    authorFullName,
  };
}

/** @param {ReturnType<typeof mapPrayerRow>} row */
export function prayerAttributionLabel(row) {
  if (!row) return 'Anonymous';
  if (row.anonymous) return 'Anonymous';
  const name = (row.authorFullName || '').trim();
  if (!row.authorId || !name) return 'Anonymous';
  return `From ${name}`;
}

export async function fetchPrayerRequestsForMissionary(supabaseClient, missionaryId) {
  if (!supabaseClient || !missionaryId) return [];
  const { data, error } = await supabaseClient
    .from('prayer_requests')
    .select(PRAYER_AUTHOR_EMBED)
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
  if (!authorId) return { error: new Error('Missing author.') };

  const { data, error } = await supabaseClient
    .from('prayer_requests')
    .insert({
      missionary_id: missionaryId,
      author_id: authorId,
      body: text,
      is_anonymous: Boolean(anonymous),
      prayed_count: 0,
    })
    .select(PRAYER_AUTHOR_EMBED)
    .single();

  if (error) return { error };

  const mapped = mapPrayerRow(data);
  const authorName = mapped.anonymous ? 'Someone' : prayerAttributionLabel(mapped).replace(/^From /, '') || 'Someone';
  void createNotification(missionaryId, {
    type: 'prayer_request',
    title: `${authorName} submitted a prayer request`,
    body: text.slice(0, 80),
    related_id: mapped.id,
  });

  return { data: mapped };
}

export async function incrementPrayedCount(supabaseClient, requestId) {
  if (!supabaseClient || !requestId) return { error: new Error('Missing id.') };

  const { data, error } = await supabaseClient.rpc('increment_prayer_request_prayed_count', {
    p_id: requestId,
  });

  if (!error && data != null && Number.isFinite(Number(data))) {
    return { prayedCount: Number(data) };
  }

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

export async function updatePrayerRequestAsAuthor(supabaseClient, { id, authorId, body, anonymous }) {
  const text = String(body ?? '').trim();
  if (!supabaseClient || !id || !authorId || !text) return { error: new Error('Invalid update.') };

  const { data, error } = await supabaseClient
    .from('prayer_requests')
    .update({
      body: text,
      is_anonymous: Boolean(anonymous),
    })
    .eq('id', id)
    .eq('author_id', authorId)
    .select(PRAYER_AUTHOR_EMBED)
    .single();

  if (error) return { error };
  return { data: mapPrayerRow(data) };
}

export async function deletePrayerRequestAsMissionary(supabaseClient, id, missionaryId) {
  if (!supabaseClient || !id || !missionaryId) return { error: new Error('Missing id.') };
  const { error } = await supabaseClient.from('prayer_requests').delete().eq('id', id).eq('missionary_id', missionaryId);
  if (error) return { error };
  return { ok: true };
}

export async function deletePrayerRequestAsAuthor(supabaseClient, id, authorId) {
  if (!supabaseClient || !id || !authorId) return { error: new Error('Missing id.') };
  const { error } = await supabaseClient.from('prayer_requests').delete().eq('id', id).eq('author_id', authorId);
  if (error) return { error };
  return { ok: true };
}
