import { supabase } from './supabaseClient';

function initialsFromFullName(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'SN';
  const a = parts[0]?.[0] ?? '';
  const b = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : parts[0]?.[1] ?? '';
  return `${a}${b}`.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'SN';
}

/**
 * Resolve missionary profile id from their public `supporter_code` (case-insensitive).
 */
export async function findMissionaryIdBySupporterCode(rawCode) {
  const want = String(rawCode ?? '').trim().toUpperCase();
  if (!want || !supabase) return null;

  const { data, error } = await supabase.from('profiles').select('id, supporter_code').eq('role', 'missionary');

  if (error || !data?.length) return null;
  const row = data.find((r) => String(r.supporter_code ?? '').trim().toUpperCase() === want);
  return row?.id ?? null;
}

/**
 * Ensures a missionary has a unique `supporter_code` (e.g. AB-2026) for invite linking.
 */
export async function ensureMissionarySupporterCode(userId, fullNameHint) {
  if (!supabase || !userId) return { ok: false, error: 'Not signed in.' };

  const { data: row, error: selErr } = await supabase
    .from('profiles')
    .select('supporter_code, full_name')
    .eq('id', userId)
    .maybeSingle();

  if (selErr) return { ok: false, error: selErr.message };
  if (String(row?.supporter_code ?? '').trim()) return { ok: true, code: row.supporter_code };

  const base = initialsFromFullName(fullNameHint || row?.full_name || '');
  const year = new Date().getFullYear();
  let code = `${base}-${year}`;
  for (let i = 0; i < 8; i += 1) {
    const tryCode = i === 0 ? code : `${base}-${year}-${i}`;
    const { error: upErr } = await supabase.from('profiles').update({ supporter_code: tryCode }).eq('id', userId);
    if (!upErr) return { ok: true, code: tryCode };
    if (!String(upErr.message || '').toLowerCase().includes('unique')) return { ok: false, error: upErr.message };
  }
  return { ok: false, error: 'Could not assign a unique supporter code.' };
}

/**
 * Sets `connected_missionary_id` on the supporter's profile when the invite code matches a missionary's `supporter_code`.
 */
export async function linkSupporterToMissionary(supporterUserId, inviteCodeUsed) {
  if (!supabase || !supporterUserId) return { ok: false, error: 'Not signed in.' };
  const code = String(inviteCodeUsed ?? '').trim();
  if (!code) return { ok: true, skipped: true };

  const { data: existing } = await supabase
    .from('profiles')
    .select('connected_missionary_id')
    .eq('id', supporterUserId)
    .maybeSingle();
  if (existing?.connected_missionary_id) return { ok: true, skipped: true };

  const missionaryId = await findMissionaryIdBySupporterCode(code);
  if (!missionaryId) {
    return { ok: false, error: 'Invite code not recognized. Check your code or ask your missionary for their SENT invite code.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ connected_missionary_id: missionaryId })
    .eq('id', supporterUserId)
    .eq('role', 'supporter');

  if (error) return { ok: false, error: error.message };
  return { ok: true, missionaryId };
}
