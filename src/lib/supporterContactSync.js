import { supabase } from './supabaseClient';

/**
 * After supporter links via invite code: match CRM contact (email, then name), update or create, notify missionary.
 * Uses SECURITY DEFINER RPC — supporters cannot write `contacts` or `notifications` directly under RLS.
 *
 * @param {string} missionaryId
 * @param {{ email?: string, full_name?: string, fullName?: string, phone?: string }} supporterProfile
 */
export async function syncSupporterToContacts(missionaryId, supporterProfile) {
  if (!supabase || !missionaryId) return { ok: false, skipped: true };

  const email = String(supporterProfile?.email ?? '').trim();
  const fullName = String(supporterProfile?.full_name ?? supporterProfile?.fullName ?? '').trim();
  const phone = String(supporterProfile?.phone ?? '').trim();

  const { data, error } = await supabase.rpc('sync_supporter_to_contacts_for_missionary', {
    p_missionary_id: missionaryId,
    p_email: email,
    p_full_name: fullName,
    p_phone: phone,
  });

  if (error) {
    console.warn('syncSupporterToContacts', error);
    return { ok: false, error: error.message };
  }

  return { ok: true, result: data };
}
