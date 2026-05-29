import { supabase } from './supabaseClient';
import { syncSupporterToContacts } from './supporterContactSync';

/**
 * @deprecated use syncSupporterToContacts from supporterContactSync.js
 */
export async function addSupporterAsContact(missionaryId, supporterProfile) {
  return syncSupporterToContacts(missionaryId, supporterProfile);
}

/**
 * After a supporter is linked to a missionary, sync CRM contact + notifications.
 */
export async function maybeLinkSupporterContactAfterLink(missionaryId, supporterUserId) {
  if (!supabase || !missionaryId || !supporterUserId) return;

  const { data: p, error: profErr } = await supabase
    .from('profiles')
    .select('email, full_name, phone')
    .eq('id', supporterUserId)
    .maybeSingle();

  if (profErr) {
    console.warn('maybeLinkSupporterContactAfterLink profile', profErr);
    return;
  }

  await syncSupporterToContacts(missionaryId, {
    email: p?.email,
    full_name: p?.full_name,
    phone: p?.phone,
  });
}
