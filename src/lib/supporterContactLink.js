import { supabase } from './supabaseClient';

/**
 * After link: match CRM contact by email or ilike full_name, else insert supporter/partner with auto-add note.
 * Uses SECURITY DEFINER RPC — supporters cannot write `contacts` directly under RLS.
 * @param {string} missionaryId
 * @param {{ email?: string, full_name?: string, fullName?: string }} supporterProfile
 */
export async function addSupporterAsContact(missionaryId, supporterProfile) {
  if (!supabase || !missionaryId) return { ok: false, skipped: true };

  const email = String(supporterProfile?.email ?? '').trim();
  const fullName = String(supporterProfile?.full_name ?? supporterProfile?.fullName ?? '').trim();

  const { data, error } = await supabase.rpc('link_supporter_to_contact_for_missionary', {
    p_missionary_id: missionaryId,
    p_email: email,
    p_full_name: fullName,
  });

  if (error) {
    console.warn('addSupporterAsContact', error);
    return { ok: false, error: error.message };
  }

  return { ok: true, result: data };
}

/**
 * After a supporter is linked to a missionary, upgrade an existing CRM contact (same email or name) to supporter/partner.
 * Uses SECURITY DEFINER RPC — supporters cannot UPDATE `contacts` directly under RLS.
 */
export async function maybeLinkSupporterContactAfterLink(missionaryId, supporterUserId) {
  if (!supabase || !missionaryId || !supporterUserId) return;

  const { data: p, error: profErr } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', supporterUserId)
    .maybeSingle();

  if (profErr) {
    console.warn('maybeLinkSupporterContactAfterLink profile', profErr);
    return;
  }

  await addSupporterAsContact(missionaryId, {
    email: p?.email,
    full_name: p?.full_name,
  });
}
