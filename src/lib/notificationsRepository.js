import { supabase } from './supabaseClient';

/**
 * @param {string} missionaryId
 * @param {{ type: string, title: string, body?: string, related_id?: string }} payload
 */
export async function createNotification(missionaryId, { type, title, body, related_id }) {
  if (!supabase || !missionaryId || !type || !title) return { ok: false };

  const row = {
    missionary_id: missionaryId,
    type: String(type),
    title: String(title),
    body: body != null && String(body).trim() ? String(body).trim() : null,
    related_id: related_id || null,
  };

  const { data: sessionData } = await supabase.auth.getSession();
  const uid = sessionData?.session?.user?.id;

  if (uid === missionaryId) {
    const { error } = await supabase.from('notifications').insert(row);
    if (error) {
      console.warn('createNotification insert', error);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  const { error } = await supabase.rpc('create_notification_for_missionary', {
    p_missionary_id: missionaryId,
    p_type: row.type,
    p_title: row.title,
    p_body: row.body,
    p_related_id: row.related_id,
  });

  if (error) {
    console.warn('createNotification rpc', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function fetchNotificationsForMissionary(supabaseClient, missionaryId, { limit = 20 } = {}) {
  if (!supabaseClient || !missionaryId) return [];
  const { data, error } = await supabaseClient
    .from('notifications')
    .select('*')
    .eq('missionary_id', missionaryId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('fetchNotificationsForMissionary', error);
    return [];
  }
  return data || [];
}

export async function markAllNotificationsRead(supabaseClient, missionaryId) {
  if (!supabaseClient || !missionaryId) return { ok: false };
  const { error } = await supabaseClient
    .from('notifications')
    .update({ is_read: true })
    .eq('missionary_id', missionaryId)
    .eq('is_read', false);

  if (error) {
    console.warn('markAllNotificationsRead', error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
