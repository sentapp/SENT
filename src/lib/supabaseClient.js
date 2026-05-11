import { createClient } from '@supabase/supabase-js';

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

/**
 * Production (e.g. https://sent-kohl.vercel.app):
 * 1) Supabase Dashboard → Authentication → URL Configuration — set Site URL + Redirect URLs for that host.
 * 2) Vercel env: REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY (optional: REACT_APP_SITE_URL).
 *
 * `redirectTo` uses REACT_APP_SITE_URL when set; otherwise the browser’s current origin at load time
 * (so the deployed hostname is used on Vercel without extra env). See docs/VERCEL_SUPABASE.md.
 */
function resolveAuthSiteUrl() {
  const fromEnv = (process.env.REACT_APP_SITE_URL || '').trim();
  if (fromEnv) return fromEnv;
  if (typeof window !== 'undefined' && window.location?.origin && /^https?:\/\//i.test(window.location.origin)) {
    return window.location.origin;
  }
  return undefined;
}

const authSiteUrl = resolveAuthSiteUrl();

/** Ready once you add `REACT_APP_SUPABASE_URL` and `REACT_APP_SUPABASE_ANON_KEY` to `.env` / `.env.local` (or Vercel env). */
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          flowType: 'pkce',
          storage: typeof window !== 'undefined' ? window.localStorage : undefined,
          ...(authSiteUrl ? { redirectTo: authSiteUrl } : {}),
        },
      })
    : null;
