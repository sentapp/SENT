import { supabase } from './supabaseClient';

/**
 * @param {{ email: string; password: string; fullName: string; role: 'missionary' | 'supporter'; inviteCode?: string }} params
 */
export async function signUpWithEmail({ email, password, fullName, role, inviteCode }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') };
  }
  return supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        role,
        invite_code: (inviteCode || '').trim(),
      },
      emailRedirectTo: typeof window !== 'undefined' ? `${window.location.origin}/` : undefined,
    },
  });
}

export async function signInWithEmail({ email, password }) {
  if (!supabase) {
    return { data: null, error: new Error('Supabase is not configured.') };
  }
  return supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
}

export async function requestPasswordReset(email) {
  if (!supabase) {
    return { error: new Error('Supabase is not configured.') };
  }
  return supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/signin` : undefined,
  });
}

/** Supabase returns various messages when the email is already registered. */
export function isDuplicateSignupError(error) {
  if (!error) return false;
  const msg = String(error.message || '').toLowerCase();
  const code = String(error.code || '').toLowerCase();
  return (
    msg.includes('already registered') ||
    msg.includes('already been registered') ||
    msg.includes('user already registered') ||
    msg.includes('already exists') ||
    code.includes('user_already') ||
    code === 'signup_disabled'
  );
}

/** Wait for DB trigger to create `profiles` row after signup. */
export async function waitForProfileRow(userId, { attempts = 12, delayMs = 250 } = {}) {
  if (!supabase || !userId) return null;
  for (let i = 0; i < attempts; i += 1) {
    const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
    if (!error && data?.role) return data;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

/**
 * Ensures a `profiles` row exists (upsert). Requires an authenticated session as that user.
 * Use when the `handle_new_user` trigger is slow or missing — RLS must allow self-insert (see migration).
 */
export async function upsertOwnProfile({ userId, email, fullName, role, inviteCodeUsed }) {
  if (!supabase || !userId) {
    return { ok: false, error: 'Supabase is not configured.' };
  }
  const r = role === 'missionary' || role === 'supporter' ? role : 'supporter';
  const invite =
    inviteCodeUsed && String(inviteCodeUsed).trim() ? String(inviteCodeUsed).trim() : null;

  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      email: email?.trim() || null,
      full_name: (fullName || '').trim(),
      role: r,
      invite_code_used: invite,
    },
    { onConflict: 'id' },
  );

  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * After sign-in, guarantee we can read `role`: fetch, or upsert from `auth.users` JWT metadata if missing.
 */
export async function ensureProfileRole(user) {
  if (!supabase || !user?.id) {
    return { role: null, error: 'No user session.' };
  }

  const { data: row, error: selErr } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!selErr && row?.role) {
    return { role: row.role, error: null };
  }

  const meta = user.user_metadata || {};
  let r = meta.role === 'missionary' || meta.role === 'supporter' ? meta.role : null;
  if (!r) r = 'supporter';

  const saved = await upsertOwnProfile({
    userId: user.id,
    email: user.email,
    fullName: meta.full_name || '',
    role: r,
    inviteCodeUsed: meta.invite_code || null,
  });

  if (!saved.ok) {
    const waited = await waitForProfileRow(user.id);
    if (waited?.role) return { role: waited.role, error: null };
    return { role: null, error: saved.error || 'Could not load or create your profile.' };
  }

  const { data: after } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return { role: after?.role || r, error: null };
}

/** Human-readable auth errors for sign-in. */
export function formatSignInError(error) {
  if (!error) return 'Could not sign in.';
  const msg = String(error.message || '').toLowerCase();
  const code = String(error.status || error.code || '');

  if (msg.includes('invalid login credentials') || msg.includes('invalid_grant')) {
    return 'Wrong email or password. Try again or reset your password.';
  }
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return 'Confirm your email first, then sign in. Check your inbox for the link from Supabase.';
  }
  if (msg.includes('too many requests') || code === '429') {
    return 'Too many attempts. Wait a minute and try again.';
  }
  return error.message || 'Could not sign in.';
}
