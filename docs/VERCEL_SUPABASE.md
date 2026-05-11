# Deploying SENT on Vercel with Supabase Auth

If sign-up or email confirmation fails on production (e.g. `https://sent-kohl.vercel.app`), configure both **Supabase** and **Vercel**.

## 1. Supabase — Authentication → URL Configuration

In the [Supabase Dashboard](https://supabase.com/dashboard) for your project:

1. Open **Authentication** → **URL Configuration**.
2. **Site URL:** set to your production app root, e.g. `https://sent-kohl.vercel.app`
3. **Redirect URLs:** add (one per line or as allowed patterns, depending on your Supabase UI):
   - `https://sent-kohl.vercel.app`
   - `https://sent-kohl.vercel.app/**`

Save. This allows magic links, email confirmations, and OAuth redirects to return to your Vercel host.

## 2. Vercel — Environment variables

In [Vercel](https://vercel.com) → your project → **Settings** → **Environment Variables** (Production):

| Name | Value |
|------|--------|
| `REACT_APP_SUPABASE_URL` | Project URL from Supabase → Settings → API |
| `REACT_APP_SUPABASE_ANON_KEY` | `anon` `public` key from the same page |
| `REACT_APP_SITE_URL` *(optional)* | `https://sent-kohl.vercel.app` (same as Site URL; used by the client auth config) |

Redeploy after saving variables.

## 3. Repo client (`src/lib/supabaseClient.js`)

The app reads `REACT_APP_SUPABASE_*` at build time. `REACT_APP_SITE_URL` is optional and passed as `auth.redirectTo` when set, in addition to whatever you configure in the Supabase dashboard.

There is **no substitute** for adding your Vercel URL in the Supabase dashboard; the browser cannot bypass Supabase’s allowed redirect list.
