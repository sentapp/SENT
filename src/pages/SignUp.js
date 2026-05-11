import { useNavigate, Link } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  deleteOrphanProfilesByEmailForSignup,
  ensureProfileRole,
  isDuplicateSignupError,
  signUpWithEmail,
  upsertOwnProfile,
  waitForProfileRow,
} from '../lib/authApi';
import { useAuth } from '../auth/AuthContext';
import { ensureMissionarySupporterCode, linkSupporterToMissionary } from '../lib/supporterConnection';
import { saveLocalPin } from '../lib/localPin';
import { PinDots, PinKeypad } from '../components/PinEntry';

function Progress({ step }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-live="polite">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-2 w-10 rounded-full transition-colors ${
            n <= step ? 'bg-mission-blue' : 'bg-neutral-200'
          }`}
        />
      ))}
    </div>
  );
}

function RoleCard({ title, subtitle, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full flex-col items-start rounded-card border px-5 py-4 text-left shadow-sm transition ${
        selected
          ? 'border-mission-blue ring-2 ring-mission-blue/25'
          : 'border-neutral-200 hover:border-neutral-300'
      }`}
    >
      <span className="text-[17px] font-semibold text-neutral-900">{title}</span>
      <span className="mt-1 text-sm leading-snug text-neutral-600">{subtitle}</span>
    </button>
  );
}

function SignUp() {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  const [step3Sub, setStep3Sub] = useState('menu');
  const [pinBuf, setPinBuf] = useState('');
  const [firstPin, setFirstPin] = useState('');

  const goBack = () => {
    if (step === 3 && step3Sub !== 'menu') {
      setStep3Sub('menu');
      setPinBuf('');
      setFirstPin('');
      setError('');
      return;
    }
    if (step <= 1) {
      navigate(-1);
      return;
    }
    setStep((s) => s - 1);
    setError('');
    setInfo('');
    setAlreadyRegistered(false);
  };

  const canProceedStep1 = Boolean(role);

  const canProceedStep2 =
    name.trim() && email.trim() && password.length >= 6 && (role !== 'supporter' || inviteCode.trim());

  const confirmSubmitLock = useRef(false);

  const completeSignup = useCallback(async (pinToSave = null) => {
    setError('');
    setInfo('');
    setAlreadyRegistered(false);
    if (!supabase) {
      setError('Supabase is not configured. Check your .env file.');
      return;
    }
    setSubmitting(true);
    try {
      const inviteForRole = role === 'supporter' ? inviteCode : '';
      let { data, error: signErr } = await signUpWithEmail({
        email,
        password,
        fullName: name,
        role,
        inviteCode: inviteForRole,
      });

      if (signErr && isDuplicateSignupError(signErr)) {
        await deleteOrphanProfilesByEmailForSignup(email);
        ({ data, error: signErr } = await signUpWithEmail({
          email,
          password,
          fullName: name,
          role,
          inviteCode: inviteForRole,
        }));
      }

      if (signErr) {
        if (isDuplicateSignupError(signErr)) {
          setAlreadyRegistered(true);
          setSubmitting(false);
          return;
        }
        setError(signErr.message || 'Could not create account.');
        setSubmitting(false);
        return;
      }

      if (data.session?.user?.id) {
        const uid = data.session.user.id;
        const userEmail = data.session.user.email ?? email.trim();

        const saved = await upsertOwnProfile({
          userId: uid,
          email: userEmail,
          fullName: name,
          role,
          inviteCodeUsed: role === 'supporter' ? inviteCode : null,
        });

        if (!saved.ok) {
          const fallback = await waitForProfileRow(uid);
          if (!fallback?.role) {
            setError(
              saved.error
                ? `Could not save your profile: ${saved.error}. In Supabase, run the migration that adds the "Users can insert own profile" policy, then try again.`
                : 'Could not save your profile. Try again or sign in.',
            );
            setSubmitting(false);
            return;
          }
          const retry = await upsertOwnProfile({
            userId: uid,
            email: userEmail,
            fullName: name,
            role,
            inviteCodeUsed: role === 'supporter' ? inviteCode : null,
          });
          if (!retry.ok) {
            setError(
              retry.error
                ? `Could not update your profile: ${retry.error}. Try signing in if you already have an account.`
                : 'Could not update your profile. Try signing in.',
            );
            setSubmitting(false);
            return;
          }
        }

        const { role: resolvedRole } = await ensureProfileRole(data.session.user);
        const navRole = resolvedRole || role;

        if (navRole === 'missionary') {
          await ensureMissionarySupporterCode(uid, name);
        } else if (navRole === 'supporter') {
          const linked = await linkSupporterToMissionary(uid, inviteCode.trim());
          if (!linked.ok && !linked.skipped) {
            setError(linked.error || 'Could not link invite code.');
            setSubmitting(false);
            return;
          }
          if (linked.ok && linked.missionary) {
            const m = linked.missionary;
            const org = String(m.organization || '').trim();
            setInfo(
              org
                ? `Connected to ${m.full_name || 'your missionary'} — ${org}`
                : `Connected to ${m.full_name || 'your missionary'}`,
            );
            await new Promise((r) => setTimeout(r, 2200));
          }
        }

        if (pinToSave && String(pinToSave).length === 4) {
          saveLocalPin(uid, String(pinToSave));
        }

        await refreshProfile();
        navigate(navRole === 'missionary' ? '/missionary' : '/supporter', { replace: true });
        return;
      }

      setInfo('Check your email to confirm your account, then sign in.');
    } catch (e) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
      confirmSubmitLock.current = false;
    }
  }, [email, password, name, role, inviteCode, navigate, refreshProfile]);

  useEffect(() => {
    if (step !== 3 || step3Sub !== 'first' || pinBuf.length < 4) return;
    setFirstPin(pinBuf);
    setPinBuf('');
    setStep3Sub('confirm');
  }, [step, step3Sub, pinBuf]);

  const handleSignupPinKey = (k) => {
    setError('');
    if (k === 'enter') {
      if (step3Sub === 'first' && pinBuf.length === 4) {
        setFirstPin(pinBuf);
        setPinBuf('');
        setStep3Sub('confirm');
        return;
      }
      if (step3Sub === 'confirm' && pinBuf.length === 4) {
        if (pinBuf !== firstPin) {
          setError('PINs do not match. Start again.');
          setStep3Sub('first');
          setFirstPin('');
          confirmSubmitLock.current = false;
          setPinBuf('');
          return;
        }
        if (!confirmSubmitLock.current) {
          confirmSubmitLock.current = true;
          void completeSignup(pinBuf);
        }
      }
      return;
    }
    if (step3Sub === 'menu') return;
    if (k === 'back') {
      setPinBuf((p) => p.slice(0, -1));
      return;
    }
    setPinBuf((p) => {
      if (p.length >= 4) return p;
      const next = p + k;
      if (next.length === 4 && step3Sub === 'confirm') {
        if (next !== firstPin) {
          setError('PINs do not match. Start again.');
          setStep3Sub('first');
          setFirstPin('');
          confirmSubmitLock.current = false;
          return '';
        }
        if (!confirmSubmitLock.current) {
          confirmSubmitLock.current = true;
          void completeSignup(next);
        }
        return next;
      }
      return next;
    });
  };

  return (
    <div className="min-h-full bg-white md:bg-mission-canvas">
      <div className="mx-auto flex min-h-full max-w-mobile flex-col px-6 py-6 md:min-h-[100dvh] md:max-w-lg md:bg-white md:shadow-sm md:rounded-card md:border md:border-neutral-200 md:my-8">
        <header className="mb-8 flex shrink-0 items-center gap-4">
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 items-center justify-center rounded-btn border border-neutral-200 bg-white text-lg text-neutral-700 hover:bg-neutral-50"
            aria-label="Go back"
          >
            ←
          </button>
          <div className="flex-1 space-y-2">
            <Progress step={step} />
            <p className="text-center text-xs text-neutral-500">Step {step} of 3</p>
          </div>
          <span className="w-10" aria-hidden />
        </header>

        {alreadyRegistered ? (
          <div className="mb-4 rounded-btn border border-mission-blue/25 bg-mission-blue/5 px-4 py-4 text-center text-sm text-neutral-800">
            <p className="font-medium">This email is already registered. Try signing in instead.</p>
            <Link className="mt-3 inline-block font-semibold text-mission-blue underline-offset-2 hover:underline" to="/signin">
              Sign in
            </Link>
          </div>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}
        {info ? (
          <p className="mb-4 rounded-btn border border-mission-green/30 bg-mission-green/10 px-4 py-3 text-sm text-mission-green">
            {info}
          </p>
        ) : null}

        {step === 1 && (
          <form
            className="flex flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (canProceedStep1) setStep(2);
            }}
          >
            <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">Who are you?</h1>
            <div className="flex flex-col gap-4">
              <RoleCard
                title="Missionary"
                subtitle="Raise support, post updates, and grow your ministry."
                selected={role === 'missionary'}
                onSelect={() => setRole('missionary')}
              />
              <RoleCard
                title="Supporter"
                subtitle="Pray, give monthly, and follow your missionary privately."
                selected={role === 'supporter'}
                onSelect={() => setRole('supporter')}
              />
            </div>
            <div className="mt-auto pt-10">
              <button
                type="submit"
                disabled={!canProceedStep1}
                className="block w-full rounded-btn bg-mission-blue py-[14px] text-center font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                Continue
              </button>
              <p className="mt-6 text-center text-sm text-neutral-600">
                Already have an account?{' '}
                <Link className="font-medium text-mission-blue underline-offset-2 hover:underline" to="/signin">
                  Sign in
                </Link>
              </p>
            </div>
          </form>
        )}

        {step === 2 && (
          <form
            className="flex flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (canProceedStep2) setStep(3);
            }}
          >
            <h1 className="mb-8 text-center text-2xl font-semibold tracking-tight">Tell us about you</h1>
            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[17px] outline-none ring-mission-blue/30 focus:border-mission-blue focus:ring"
                placeholder="Your name"
              />
            </label>
            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setAlreadyRegistered(false);
                }}
                autoComplete="email"
                className="w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[17px] outline-none ring-mission-blue/30 focus:border-mission-blue focus:ring"
                placeholder="you@example.com"
              />
            </label>
            <label className="mb-5 block">
              <span className="mb-2 block text-sm font-medium text-neutral-700">Password</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[17px] outline-none ring-mission-blue/30 focus:border-mission-blue focus:ring"
                placeholder="••••••••"
              />
            </label>
            {role === 'supporter' && (
              <label className="mb-8 block">
                <span className="mb-2 block text-sm font-medium text-neutral-700">Invite code</span>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  className="w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[17px] outline-none ring-mission-blue/30 focus:border-mission-blue focus:ring"
                  placeholder="e.g. AB-2025"
                  autoComplete="off"
                />
                <p className="mt-2 text-xs text-neutral-500">Your missionary can find their code in Settings.</p>
              </label>
            )}
            <div className="mt-auto">
              <button
                type="submit"
                disabled={!canProceedStep2}
                className="block w-full rounded-btn bg-mission-blue py-[14px] text-center font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 3 && step3Sub === 'menu' && (
          <form
            className="flex flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              if (!submitting) {
                setError('');
                void completeSignup(null);
              }
            }}
          >
            <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight">Quick unlock (optional)</h1>
            <p className="mx-auto mb-8 max-w-sm text-center text-sm leading-relaxed text-neutral-600">
              You&apos;ll always sign in with email and password. On this device only, you can add a 4-digit PIN to get
              back in faster next time (stored locally — not on our servers).
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setError('');
                  setStep3Sub('first');
                  setPinBuf('');
                  setFirstPin('');
                }}
                className="rounded-btn border border-neutral-200 bg-white px-4 py-[14px] text-left shadow-sm hover:bg-neutral-50 disabled:opacity-60"
              >
                <span className="block text-[17px] font-semibold">Set up a PIN</span>
                <span className="text-sm text-neutral-600">4-digit shortcut on this device after you create your account.</span>
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-btn border border-transparent bg-transparent py-3 text-center text-[17px] font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-60"
              >
                {submitting ? 'Creating account…' : 'Skip for now'}
              </button>
              <p className="text-center text-xs text-neutral-500">Press Enter to skip and finish. Skip uses email and password every time.</p>
            </div>
          </form>
        )}

        {step === 3 && step3Sub === 'first' && (
          <section className="flex flex-1 flex-col">
            <h2 className="mb-2 text-center text-xl font-semibold">Create a 4-digit PIN</h2>
            <p className="mb-6 text-center text-sm text-neutral-600">This stays on this device only.</p>
            <PinDots digits={pinBuf} />
            <PinKeypad onKey={handleSignupPinKey} />
          </section>
        )}

        {step === 3 && step3Sub === 'confirm' && (
          <section className="flex flex-1 flex-col">
            <h2 className="mb-2 text-center text-xl font-semibold">Confirm your PIN</h2>
            <p className="mb-6 text-center text-sm text-neutral-600">Enter the same PIN again.</p>
            <PinDots digits={pinBuf} />
            <PinKeypad onKey={handleSignupPinKey} />
            {submitting ? <p className="mt-6 text-center text-sm text-neutral-500">Creating account…</p> : null}
          </section>
        )}
      </div>
    </div>
  );
}

export default SignUp;
