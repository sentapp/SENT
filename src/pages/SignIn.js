import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { ensureProfileRole, formatSignInError, requestPasswordReset, signInWithEmail } from '../lib/authApi';
import { useAuth } from '../auth/AuthContext';
import { ensureMissionarySupporterCode, repairSupporterMissionaryLink } from '../lib/supporterConnection';
import { hasLocalPin, verifyLocalPin } from '../lib/localPin';
import { PinDots, PinKeypad } from '../components/PinEntry';

function SignIn() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const { refreshProfile } = useAuth();

  const [view, setView] = useState('checking');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const pinUnlockInFlight = useRef(false);
  const prevPinLen = useRef(0);

  const runAfterSignIn = useCallback(
    async (user) => {
      if (!user?.id) return false;

      const { role, error: profileErr } = await ensureProfileRole(user);
      if (!role) {
        setError(profileErr || 'Could not load your profile. Check RLS policies on `profiles` or try again.');
        return false;
      }

      if (role === 'supporter') {
        await repairSupporterMissionaryLink(user.id, user.user_metadata?.invite_code);
      }
      if (role === 'missionary') {
        const { data: mn } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
        await ensureMissionarySupporterCode(user.id, mn?.full_name);
      }
      await refreshProfile();

      if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) {
        navigate(from, { replace: true });
      } else {
        navigate(role === 'missionary' ? '/missionary' : '/supporter', { replace: true });
      }
      return true;
    },
    [from, navigate, refreshProfile],
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!supabase) {
        if (mounted) setView('form');
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const u = data.session?.user;
      if (u?.id && hasLocalPin(u.id)) {
        setView('pin');
      } else {
        setView('form');
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const msg = location.state?.passwordResetSuccess;
    if (typeof msg === 'string' && msg.trim()) {
      setInfo(msg.trim());
      navigate('.', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const attemptPinUnlock = useCallback(async () => {
    if (view !== 'pin' || pin.length < 4 || pinUnlockInFlight.current) return;
    pinUnlockInFlight.current = true;
    const pinSnapshot = pin;
    try {
      const { data } = await supabase.auth.getSession();
      const u = data.session?.user;
      if (!u?.id) return;
      if (!verifyLocalPin(u.id, pinSnapshot)) {
        setError('Incorrect PIN. Try again or use email and password.');
        setPin('');
        return;
      }
      setSubmitting(true);
      const ok = await runAfterSignIn(u);
      if (!ok) setSubmitting(false);
    } finally {
      pinUnlockInFlight.current = false;
    }
  }, [pin, view, runAfterSignIn]);

  const handlePinKey = (k) => {
    setError('');
    if (k === 'enter') {
      void attemptPinUnlock();
      return;
    }
    if (k === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => {
      if (p.length >= 4) return p;
      return p + k;
    });
  };

  useEffect(() => {
    if (view !== 'pin') {
      prevPinLen.current = pin.length;
      return;
    }
    const prev = prevPinLen.current;
    prevPinLen.current = pin.length;
    if (pin.length !== 4 || prev >= 4) return;
    void attemptPinUnlock();
  }, [pin, view, attemptPinUnlock]);

  const onSubmitEmail = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    if (!supabase) {
      setError('Supabase is not configured. Check your .env file.');
      return;
    }
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error: signErr } = await signInWithEmail({ email, password });
      if (signErr) {
        setError(formatSignInError(signErr));
        return;
      }

      const session = data?.session;
      const user = session?.user ?? data?.user;
      if (!user?.id) {
        setError(
          'No active session. If email confirmation is required in Supabase, open the link in your confirmation email first.',
        );
        return;
      }

      await runAfterSignIn(user);
    } catch (err) {
      setError(err?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const onForgotPassword = async () => {
    setError('');
    setInfo('');
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }
    const addr = window.prompt('Enter your email address and we will send a reset link.');
    if (!addr?.trim()) return;
    const { error: resetErr } = await requestPasswordReset(addr);
    if (resetErr) {
      setError(resetErr.message || 'Could not send reset email.');
      return;
    }
    setInfo('If an account exists for that email, you will receive a reset link shortly.');
  };

  const switchToEmailPassword = async () => {
    setError('');
    setPin('');
    if (supabase) await supabase.auth.signOut();
    setView('form');
  };

  if (view === 'checking') {
    return (
      <div className="flex min-h-full items-center justify-center bg-background md:bg-mission-canvas px-6">
        <p className="text-sm font-medium text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-background md:bg-mission-canvas">
      <div className="mx-auto flex min-h-full max-w-mobile flex-col px-6 py-8 md:min-h-[100dvh] md:max-w-lg md:bg-surface md:shadow-sm md:rounded-card md:border md:border-border md:my-8">
        {view === 'form' && (
          <>
            <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">Welcome back</h1>
            <p className="mb-6 text-center text-sm text-neutral-600">
              Sign in with your email and password. You can optionally set a 4-digit PIN on this device after signing in
              (Settings) for quicker unlock when you already have an active session.
            </p>

            {error ? (
              <p className="mb-4 rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : null}
            {info ? (
              <p className="mb-4 rounded-btn border border-mission-green/30 bg-mission-green/10 px-4 py-3 text-sm text-mission-green">
                {info}
              </p>
            ) : null}

            <form onSubmit={onSubmitEmail}>
              <label className="mb-4 block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-btn border border-border px-4 py-[14px] text-[17px] outline-none ring-accent/30 focus:border-accent focus:ring"
                  placeholder="you@example.com"
                />
              </label>
              <label className="mb-2 block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-btn border border-border px-4 py-[14px] text-[17px] outline-none ring-accent/30 focus:border-accent focus:ring"
                  placeholder="••••••••"
                />
              </label>
              <div className="mb-8 text-right">
                <button type="button" onClick={onForgotPassword} className="text-sm font-medium text-mission-blue hover:underline">
                  Forgot password?
                </button>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="mb-6 w-full rounded-btn bg-mission-blue py-[14px] text-center text-[17px] font-medium text-white shadow-sm hover:opacity-95 disabled:opacity-60"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <details className="mb-8 rounded-card border border-border bg-neutral-50/80 px-4 py-3 text-sm text-neutral-600">
              <summary className="cursor-pointer font-semibold text-neutral-800">Testing: remove a test account</summary>
              <p className="mt-2 leading-relaxed">
                In the{' '}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-mission-blue underline-offset-2 hover:underline"
                >
                  Supabase Dashboard
                </a>
                , open your project → <strong>Authentication</strong> → <strong>Users</strong> → select the user → delete.
                There is no safe way to delete another user’s auth record from this app without a server admin key.
              </p>
            </details>

            <p className="mt-auto text-center text-sm text-neutral-600">
              Don&apos;t have an account?{' '}
              <Link className="font-medium text-mission-blue underline-offset-2 hover:underline" to="/signup">
                Sign up
              </Link>
            </p>
          </>
        )}

        {view === 'pin' && (
          <div className="flex flex-1 flex-col">
            <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight">Enter your PIN</h1>
            <p className="mb-6 text-center text-sm text-neutral-600">Quick unlock on this device — your account stays signed in.</p>

            {error ? (
              <p className="mb-4 rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : null}

            <PinDots digits={pin} />
            <PinKeypad onKey={handlePinKey} />

            <button
              type="button"
              onClick={switchToEmailPassword}
              className="mt-8 text-center text-sm font-semibold text-mission-blue hover:underline"
            >
              Use email &amp; password instead
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default SignIn;
