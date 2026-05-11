import { supabase } from './supabaseClient';

function initialsFromFullName(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'SN';
  if (parts.length === 1) {
    const w = parts[0].toUpperCase().replace(/[^A-Z]/g, '');
    const a = w[0] ?? 'S';
    const b = w[1] ?? w[0] ?? 'N';
    return `${a}${b}`.slice(0, 2);
  }
  const first = (parts[0][0] ?? '').toUpperCase();
  const last = (parts[parts.length - 1][0] ?? '').toUpperCase();
  const pair = `${first}${last}`.replace(/[^A-Z]/g, '');
  return pair.slice(0, 2) || 'SN';
}

/**
 * Resolve missionary by public `supporter_code` (case-insensitive) via SECURITY DEFINER RPC
 * so supporters are not blocked by RLS on `profiles`.
 */
export async function lookupMissionaryBySupporterCode(rawCode) {
  const code = String(rawCode ?? '').trim();
  if (!code || !supabase) return null;

  const { data, error } = await supabase.rpc('lookup_missionary_by_supporter_code', { p_code: code });
  if (error) {
    console.warn('lookup_missionary_by_supporter_code', error);
    return null;
  }
  const row = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
  if (!row || !row.id) return null;
  return {
    id: row.id,
    full_name: String(row.full_name ?? ''),
    organization: String(row.organization ?? ''),
    supporter_code: String(row.supporter_code ?? ''),
  };
}

/** @deprecated use lookupMissionaryBySupporterCode */
export async function findMissionaryIdBySupporterCode(rawCode) {
  const m = await lookupMissionaryBySupporterCode(rawCode);
  return m?.id ?? null;
}

/**
 * Ensures a missionary has a unique `supporter_code` (initials + year, e.g. HH-2025) for invite linking.
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
 * Link supporter profile to missionary matched by `supporter_code`.
 * Updates `connected_missionary_id` and normalizes `invite_code_used`.
 * @returns {{ ok: true, missionary?: object } | { ok: true, skipped: true } | { ok: false, error: string }}
 */
export async function linkSupporterToMissionary(supporterUserId, inviteCodeUsed) {
  if (!supabase || !supporterUserId) return { ok: false, error: 'Not signed in.' };
  const normalized = String(inviteCodeUsed ?? '').trim().toUpperCase();
  if (!normalized) return { ok: true, skipped: true };

  const { data: existing } = await supabase
    .from('profiles')
    .select('connected_missionary_id')
    .eq('id', supporterUserId)
    .maybeSingle();
  if (existing?.connected_missionary_id) return { ok: true, skipped: true };

  const missionary = await lookupMissionaryBySupporterCode(normalized);
  if (!missionary?.id) {
    return { ok: false, error: 'Code not found — check with your missionary' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      connected_missionary_id: missionary.id,
      invite_code_used: normalized,
    })
    .eq('id', supporterUserId)
    .eq('role', 'supporter');

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    missionary: {
      id: missionary.id,
      full_name: missionary.full_name,
      organization: missionary.organization,
    },
  };
}

/**
 * Replace `connected_missionary_id` (and `invite_code_used`) even when already linked.
 * @returns {{ ok: true, missionary: object } | { ok: false, error: string }}
 */
export async function relinkSupporterToMissionary(supporterUserId, inviteCodeUsed) {
  if (!supabase || !supporterUserId) return { ok: false, error: 'Not signed in.' };
  const normalized = String(inviteCodeUsed ?? '').trim().toUpperCase();
  if (!normalized) return { ok: false, error: 'Enter a missionary code.' };

  const missionary = await lookupMissionaryBySupporterCode(normalized);
  if (!missionary?.id) {
    return { ok: false, error: 'Code not found — check with your missionary' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({
      connected_missionary_id: missionary.id,
      invite_code_used: normalized,
    })
    .eq('id', supporterUserId)
    .eq('role', 'supporter');

  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    missionary: {
      id: missionary.id,
      full_name: missionary.full_name,
      organization: missionary.organization,
    },
  };
}
