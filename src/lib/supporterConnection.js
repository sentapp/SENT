import { supabase } from './supabaseClient';

function parseLinkInviteRpcPayload(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string') {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return payload;
}

/**
 * Canonical form for invite code entry: trim, Unicode dashes → ASCII hyphen, remove spaces, uppercase.
 * Keeps supporter typing (hh 2026, HH–2026, etc.) aligned with DB + RPC comparison.
 */
export function normalizeMissionaryInviteCode(raw) {
  let s = String(raw ?? '').trim();
  s = s.replace(/\u2013/g, '-').replace(/\u2014/g, '-').replace(/\u2212/g, '-');
  s = s.replace(/\s+/g, '');
  return s.toUpperCase();
}

/** One letter per word, e.g. Hannah Holt → HH; Mary Kay Jones → MKJ */
function initialsFromFullName(name) {
  const initials = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => String(w[0] ?? '').toUpperCase().replace(/[^A-Z]/g, ''))
    .filter(Boolean)
    .join('');
  const base = initials.slice(0, 16);
  return base || 'XX';
}

/**
 * Resolve missionary by public `supporter_code` (case-insensitive) via SECURITY DEFINER RPC
 * so supporters are not blocked by RLS on `profiles`.
 */
export async function lookupMissionaryBySupporterCode(rawCode) {
  const cleanCode = normalizeMissionaryInviteCode(rawCode);
  if (!cleanCode || !supabase) return null;

  const { data, error } = await supabase.rpc('lookup_missionary_by_supporter_code', { code: cleanCode });
  if (error) {
    console.warn('lookup_missionary_by_supporter_code', error);
    return null;
  }
  const rows = Array.isArray(data) ? data : data != null ? [data] : [];
  if (rows.length === 0 || !rows[0]?.id) return null;
  const missionary = rows[0];
  return {
    id: missionary.id,
    full_name: String(missionary.full_name ?? ''),
    organization: String(missionary.organization ?? ''),
    supporter_code: cleanCode,
  };
}

/** @deprecated use lookupMissionaryBySupporterCode */
export async function findMissionaryIdBySupporterCode(rawCode) {
  const m = await lookupMissionaryBySupporterCode(rawCode);
  return m?.id ?? null;
}

/**
 * Ensures a missionary has a unique `supporter_code`: initials from each name word + calendar year
 * (e.g. Hannah Holt → HH-2026). If taken: HH-2026-1, HH-2026-2, …
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

  const initialsBase = initialsFromFullName(fullNameHint || row?.full_name || '');
  const year = new Date().getFullYear();
  let code = `${initialsBase}-${year}`;
  let counter = 1;

  while (true) {
    const { data: taken, error: qErr } = await supabase
      .from('profiles')
      .select('id')
      .eq('supporter_code', code)
      .maybeSingle();
    if (qErr) return { ok: false, error: qErr.message };
    if (!taken) break;
    code = `${initialsBase}-${year}-${counter}`;
    counter += 1;
    if (counter > 10000) return { ok: false, error: 'Could not assign a unique supporter code.' };
  }

  const { error: upErr } = await supabase.from('profiles').update({ supporter_code: code }).eq('id', userId);
  if (upErr) return { ok: false, error: upErr.message };

  if (process.env.NODE_ENV === 'development') {
    const { data: verify } = await supabase
      .from('profiles')
      .select('supporter_code, full_name')
      .eq('id', userId)
      .maybeSingle();
    // eslint-disable-next-line no-console
    console.log('[missionary] supporter_code saved; profile row:', verify);
  }

  return { ok: true, code };
}

/**
 * Link supporter profile to missionary matched by `supporter_code`.
 * Prefers SECURITY DEFINER `link_supporter_by_invite_code` (atomic update under RLS), then falls back to
 * `lookup_missionary_by_supporter_code` + client `profiles` update.
 * @returns {{ ok: true, missionary: object } | { ok: true, skipped: true } | { ok: false, error: string }}
 */
export async function linkSupporterToMissionary(supporterUserId, inviteCodeUsed) {
  if (!supabase || !supporterUserId) return { ok: false, error: 'Not signed in.' };
  const normalized = normalizeMissionaryInviteCode(inviteCodeUsed);
  if (!normalized) return { ok: true, skipped: true };

  const { data: rpcPayload, error: rpcError } = await supabase.rpc('link_supporter_by_invite_code', {
    p_code: normalized,
  });
  const rpc = parseLinkInviteRpcPayload(rpcPayload);

  if (!rpcError && rpc && typeof rpc === 'object') {
    if (rpc.ok === true) {
      if (rpc.skipped) return { ok: true, skipped: true };
      const m = rpc.missionary;
      if (m?.id) {
        return {
          ok: true,
          missionary: {
            id: m.id,
            full_name: String(m.full_name ?? ''),
            organization: String(m.organization ?? ''),
          },
        };
      }
    }
    if (rpc.ok === false && rpc.error) {
      return { ok: false, error: String(rpc.error) };
    }
  }
  if (rpcError) {
    console.warn('link_supporter_by_invite_code', rpcError);
  }

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
    .eq('id', supporterUserId);

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
 * If the profile has a stored invite code but no missionary link, complete the link (e.g. after partial signup or DB drift).
 * Optionally pass `inviteMetadataFallback` (e.g. `user.user_metadata.invite_code`) when `invite_code_used` is empty in DB.
 */
export async function repairSupporterMissionaryLink(userId, inviteMetadataFallback = null) {
  if (!supabase || !userId) return { ok: false, error: 'Not signed in.' };

  const { data: prof } = await supabase
    .from('profiles')
    .select('invite_code_used, connected_missionary_id')
    .eq('id', userId)
    .maybeSingle();

  if (prof?.connected_missionary_id) return { ok: true, skipped: true };

  const raw =
    (prof?.invite_code_used && String(prof.invite_code_used).trim()) ||
    (inviteMetadataFallback && String(inviteMetadataFallback).trim()) ||
    '';

  if (!raw) return { ok: true, skipped: true };

  return linkSupporterToMissionary(userId, raw);
}

/**
 * Replace `connected_missionary_id` (and `invite_code_used`) even when already linked.
 * @returns {{ ok: true, missionary: object } | { ok: false, error: string }}
 */
export async function relinkSupporterToMissionary(supporterUserId, inviteCodeUsed) {
  if (!supabase || !supporterUserId) return { ok: false, error: 'Not signed in.' };
  const normalized = normalizeMissionaryInviteCode(inviteCodeUsed);
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
    .eq('id', supporterUserId);

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
