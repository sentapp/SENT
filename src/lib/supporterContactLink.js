import { supabase } from './supabaseClient';

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

  const email = String(p?.email ?? '').trim();
  const fullName = String(p?.full_name ?? '').trim();

  const { error } = await supabase.rpc('link_supporter_to_contact_for_missionary', {
    p_missionary_id: missionaryId,
    p_email: email,
    p_full_name: fullName,
  });

  if (error) {
    console.warn('link_supporter_to_contact_for_missionary', error);
  }
}
