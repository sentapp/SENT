import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button, Input, Label } from '../components/ui';

/**
 * Supabase sends users here from the password-reset email (PKCE: ?code=…, legacy: #access_token=…).
 * `detectSessionInUrl` on the client may already consume the URL; we still handle explicit exchange/setSession.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('checking');
  const [initError, setInitError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setInitError('Supabase is not configured.');
      setPhase('error');
      return undefined;
    }

    let cancelled = false;

    async function establishRecoverySession() {
      const href = typeof window !== 'undefined' ? window.location.href : '';
      const search = typeof window !== 'undefined' ? window.location.search : '';
      const hash = typeof window !== 'undefined' ? (window.location.hash || '').replace(/^#/, '') : '';

      try {
        const {
          data: { session: existing },
        } = await supabase.auth.getSession();
        if (!cancelled && existing?.user) {
          setPhase('form');
          return;
        }

        if (search.includes('code=')) {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(href);
          if (exErr) {
            if (!cancelled) {
              setInitError(exErr.message || 'Invalid or expired reset link.');
              setPhase('error');
            }
            return;
          }
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', `${window.location.pathname}`);
          }
        } else if (hash.includes('access_token')) {
          const hp = new URLSearchParams(hash);
          const access_token = hp.get('access_token');
          const refresh_token = hp.get('refresh_token');
          if (access_token && refresh_token) {
            const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
            if (sErr) {
              if (!cancelled) {
                setInitError(sErr.message || 'Invalid or expired reset link.');
                setPhase('error');
              }
              return;
            }
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', window.location.pathname);
            }
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session?.user) {
          setPhase('form');
          return;
        }
        setInitError('This reset link is invalid or has expired. Request a new one from Sign in.');
        setPhase('error');
      } catch (e) {
        if (!cancelled) {
          setInitError(e?.message || 'Could not validate reset link.');
          setPhase('error');
        }
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (event === 'PASSWORD_RECOVERY' && session?.user) {
        setPhase('form');
        setInitError('');
      }
    });

    void establishRecoverySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!supabase) return;
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const { error: uErr } = await supabase.auth.updateUser({ password });
      if (uErr) {
        setError(uErr.message || 'Could not update password.');
        return;
      }
      await supabase.auth.signOut();
      navigate('/signin', {
        replace: true,
        state: { passwordResetSuccess: 'Password updated — please sign in' },
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (phase === 'checking') {
    return (
      <div className="flex min-h-full items-center justify-center bg-white px-6 md:bg-mission-canvas">
        <p className="text-sm font-medium text-neutral-600">Verifying reset link…</p>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-full bg-white md:bg-mission-canvas">
        <div className="mx-auto flex min-h-full max-w-mobile flex-col px-6 py-8 md:my-8 md:max-w-lg md:rounded-card md:border md:border-neutral-200 md:bg-white md:shadow-sm">
          <h1 className="mb-4 text-center text-2xl font-semibold tracking-tight">Reset password</h1>
          <p className="mb-6 rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{initError}</p>
          <Link
            to="/signin"
            className="text-center text-sm font-semibold text-mission-blue hover:underline"
          >
            Back to Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white md:bg-mission-canvas">
      <div className="mx-auto flex min-h-full max-w-mobile flex-col px-6 py-8 md:my-8 md:max-w-lg md:rounded-card md:border md:border-neutral-200 md:bg-white md:shadow-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mb-6 text-center text-sm text-neutral-600">Enter and confirm your new password below.</p>

        {error ? (
          <p className="mb-4 rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
          <Label title="New password">
            <Input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </Label>
          <Label title="Confirm password">
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat new password"
            />
          </Label>
          <Button type="submit" disabled={submitting} className="w-full py-[14px] text-[17px]">
            {submitting ? 'Saving…' : 'Update password'}
          </Button>
        </form>

        <p className="mt-8 text-center text-sm text-neutral-600">
          <Link className="font-semibold text-mission-blue hover:underline" to="/signin">
            Cancel and return to Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
