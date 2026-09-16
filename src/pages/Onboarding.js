import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { homePathForRole } from '../lib/roles';
import { ensureMissionarySupporterCode, linkSupporterToMissionary } from '../lib/supporterConnection';

const GOAL_PRESETS = [
  { amount: 500, label: 'Starting out' },
  { amount: 1500, label: 'Part time' },
  { amount: 3000, label: 'Full time' },
  { amount: 5000, label: 'Team lead' },
];

const MISSIONARY_CHECKLIST = [
  'Share your invite code with people who want to send you',
  'Add contacts and move them through your pipeline',
  'Track monthly support against your goal',
  'Post field updates your supporters will see',
  'Schedule meetings and follow up',
];

const SUPPORTER_CHECKLIST = [
  'Read updates from the field in your feed',
  'Pray when requests come in',
  'Give toward the mission',
  'Refer friends who want to send',
  'Join the community conversation',
];

function knownRole(role) {
  return role === 'missionary' || role === 'supporter' ? role : null;
}

function splitName(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function isMissingColumnError(error, column) {
  if (!error) return false;
  const combined = `${error.message || ''} ${error.details || ''} ${error.hint || ''} ${error.code || ''}`;
  if (!combined.toLowerCase().includes(String(column).toLowerCase())) return false;
  return /schema cache|could not find|does not exist|42703/i.test(combined);
}

function leftCopy(role, step) {
  if (!role || step === 0) {
    return {
      kicker: 'Welcome',
      title: 'For missionaries and the people who send them.',
      subtitle: 'A few minutes to set up your SENT home.',
    };
  }
  if (role === 'missionary') {
    return [
      { kicker: 'Step 1', title: 'Your details', subtitle: 'Tell supporters who you are and where you serve.' },
      { kicker: 'Step 2', title: 'Your goal', subtitle: 'Set what you’re raising and how many partners you need.' },
      { kicker: 'Step 3', title: "You're all set", subtitle: 'Your dashboard is ready when you are.' },
    ][step - 1];
  }
  return [
    { kicker: 'Step 1', title: 'Invite code', subtitle: 'Connect with the missionary who invited you.' },
    { kicker: 'Step 2', title: "You're connected", subtitle: 'Your feed is ready when you are.' },
  ][step - 1];
}

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, markOnboardingCompleteLocally } = useAuth();

  const synced = useRef(false);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState(null);
  const [roleLocked, setRoleLocked] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [organization, setOrganization] = useState('');
  const [missionField, setMissionField] = useState('');
  const [locationName, setLocationName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [partnerGoal, setPartnerGoal] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [connectedName, setConnectedName] = useState('');
  const [skippedCode, setSkippedCode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!profile || synced.current) return;
    synced.current = true;
    const preset = knownRole(profile.role);
    setRole(preset);
    setRoleLocked(Boolean(preset));
    setStep(preset ? 1 : 0);
    const names = splitName(profile.full_name);
    setFirstName(names.first);
    setLastName(names.last);
    setOrganization(profile.organization || '');
    setMissionField(profile.mission_field || '');
    setLocationName(profile.location_name || '');
    setStartDate(profile.mission_start_date ? String(profile.mission_start_date).slice(0, 10) : '');
    if (profile.monthly_goal) setMonthlyAmount(String(Number(profile.monthly_goal)));
    if (profile.partner_goal) setPartnerGoal(String(profile.partner_goal));
    if (profile.invite_code_used) setInviteCode(String(profile.invite_code_used));
  }, [profile]);

  useEffect(() => {
    let cancelled = false;
    const missionaryId = profile?.connected_missionary_id;
    if (!missionaryId || !supabase) return undefined;
    (async () => {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', missionaryId).maybeSingle();
      if (!cancelled && data?.full_name) setConnectedName(String(data.full_name));
    })();
    return () => {
      cancelled = true;
    };
  }, [profile?.connected_missionary_id]);

  const totalSteps = role === 'missionary' ? 3 : role === 'supporter' ? 2 : 1;
  const currentStep = step === 0 ? 1 : step;
  const progress = Math.round((currentStep / totalSteps) * 100);
  const copy = leftCopy(role, step) || leftCopy(null, 0);
  const displayName = firstName.trim() || splitName(profile?.full_name).first || 'there';
  const selectedAmount = Number(monthlyAmount);

  const homePath = useMemo(() => homePathForRole(role || profile?.role), [role, profile?.role]);

  async function updateProfile(payload) {
    if (!supabase || !user?.id) return 'Not signed in.';
    let { error: upErr } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (upErr && Object.prototype.hasOwnProperty.call(payload, 'mission_field') && isMissingColumnError(upErr, 'mission_field')) {
      const { mission_field: _omit, ...rest } = payload;
      ({ error: upErr } = await supabase.from('profiles').update(rest).eq('id', user.id));
    }
    return upErr ? upErr.message : '';
  }

  async function finish() {
    if (!user?.id) {
      setError('Not signed in.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (supabase) {
        const { error: upErr } = await supabase.from('profiles').update({ onboarding_complete: true }).eq('id', user.id);
        if (upErr && !isMissingColumnError(upErr, 'onboarding_complete')) {
          setError(upErr.message);
          setSaving(false);
          return;
        }
      }
      if (role === 'missionary') {
        await ensureMissionarySupporterCode(user.id, `${firstName} ${lastName}`.trim() || profile?.full_name);
      }
      markOnboardingCompleteLocally?.();
      await refreshProfile?.();
      markOnboardingCompleteLocally?.();
      navigate(homePath, { replace: true });
    } catch (e) {
      setError(e?.message || 'Could not finish setup.');
      setSaving(false);
    }
  }

  async function chooseRole(nextRole) {
    setError('');
    setSaving(true);
    try {
      if (!roleLocked) {
        const message = await updateProfile({ role: nextRole });
        if (message) {
          setError(message);
          setSaving(false);
          return;
        }
        await refreshProfile?.();
      }
      setRole(nextRole);
      setStep(1);
    } catch (e) {
      setError(e?.message || 'Could not save your role.');
    } finally {
      setSaving(false);
    }
  }

  async function saveDetails() {
    setError('');
    setSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const message = await updateProfile({
        full_name: fullName || profile?.full_name || '',
        organization: organization.trim(),
        location_name: locationName.trim(),
        mission_field: missionField.trim(),
        mission_start_date: startDate || null,
      });
      if (message) {
        setError(message);
        return;
      }
      await refreshProfile?.();
      setStep(2);
    } catch (e) {
      setError(e?.message || 'Could not save your details.');
    } finally {
      setSaving(false);
    }
  }

  async function saveGoal() {
    setError('');
    const amount = Number(monthlyAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Choose a goal or enter a custom amount.');
      return;
    }
    const partners = partnerGoal.trim() === '' ? 0 : Number.parseInt(partnerGoal, 10);
    if (!Number.isFinite(partners) || partners < 0) {
      setError('Enter a partner goal of 0 or more.');
      return;
    }
    setSaving(true);
    try {
      const message = await updateProfile({
        monthly_goal: amount,
        partner_goal: partners,
      });
      if (message) {
        setError(message);
        return;
      }
      await refreshProfile?.();
      setStep(3);
    } catch (e) {
      setError(e?.message || 'Could not save your goal.');
    } finally {
      setSaving(false);
    }
  }

  async function connectCode() {
    setError('');
    if (!user?.id) {
      setError('Not signed in.');
      return;
    }
    setSaving(true);
    try {
      const result = await linkSupporterToMissionary(user.id, inviteCode);
      if (!result.ok) {
        setError(result.error || 'Code not found — check with your missionary');
        return;
      }
      if (result.skipped) {
        setSkippedCode(true);
      } else {
        setSkippedCode(false);
        if (result.missionary?.full_name) setConnectedName(result.missionary.full_name);
      }
      await refreshProfile?.();
      setStep(2);
    } catch (e) {
      setError(e?.message || 'Could not connect that code.');
    } finally {
      setSaving(false);
    }
  }

  function skipCode() {
    setError('');
    setSkippedCode(true);
    setStep(2);
  }

  function goBack() {
    setError('');
    if (step <= 1) {
      if (!roleLocked) setStep(0);
      return;
    }
    setStep((n) => n - 1);
  }

  const showBack = step > 1 || (step === 1 && !roleLocked);

  return (
    <div className="ob-shell">
      <style>{ONBOARDING_CSS}</style>
      <aside className="ob-left">
        <div className="ob-logo">SENT</div>
        <div className="ob-left-mid">
          <p className="ob-kicker">{copy.kicker}</p>
          <h1 className="ob-left-title">{copy.title}</h1>
          <p className="ob-left-sub">{copy.subtitle}</p>
        </div>
        <div className="ob-progress">
          <div className="ob-bar" aria-hidden="true">
            <div className="ob-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="ob-dots" aria-hidden="true">
            {Array.from({ length: totalSteps }, (_, i) => (
              <span key={i} className={i < currentStep ? 'ob-dot active' : 'ob-dot'} />
            ))}
          </div>
        </div>
      </aside>

      <section className="ob-right">
        <button type="button" className="ob-skip" onClick={finish} disabled={saving}>
          Skip setup
        </button>

        <div className="ob-mobile-head">
          <div className="ob-logo">SENT</div>
          <p className="ob-kicker">{copy.kicker}</p>
          <h1 className="ob-left-title">{copy.title}</h1>
        </div>

        <div className="ob-card">
          {error ? <p className="ob-error">{error}</p> : null}

          {step === 0 ? (
            <>
              <div className="ob-emoji" aria-hidden="true">✉️</div>
              <h2 className="ob-card-title">Welcome to SENT</h2>
              <p className="ob-welcome-sub">Are you on the field, or sending someone who is?</p>
              <button type="button" className="ob-btn-missionary" disabled={saving} onClick={() => chooseRole('missionary')}>
                I'm a missionary →
              </button>
              <button type="button" className="ob-btn-supporter" disabled={saving} onClick={() => chooseRole('supporter')}>
                I'm a supporter →
              </button>
            </>
          ) : null}

          {role === 'missionary' && step === 1 ? (
            <>
              <div className="ob-fields">
                <div className="ob-row">
                  <label className="ob-field">
                    <span className="ob-label">First name</span>
                    <input className="ob-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
                  </label>
                  <label className="ob-field">
                    <span className="ob-label">Last name</span>
                    <input className="ob-input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
                  </label>
                </div>
                <label className="ob-field">
                  <span className="ob-label">Organisation</span>
                  <input className="ob-input" value={organization} onChange={(e) => setOrganization(e.target.value)} autoComplete="organization" />
                </label>
                <div className="ob-row">
                  <label className="ob-field">
                    <span className="ob-label">Mission field</span>
                    <input className="ob-input" value={missionField} onChange={(e) => setMissionField(e.target.value)} />
                  </label>
                  <label className="ob-field">
                    <span className="ob-label">Location</span>
                    <input className="ob-input" value={locationName} onChange={(e) => setLocationName(e.target.value)} />
                  </label>
                </div>
                <label className="ob-field">
                  <span className="ob-label">Mission start date</span>
                  <input className="ob-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
              </div>
              <div className="ob-btn-row">
                {showBack ? (
                  <button type="button" className="ob-btn-back" onClick={goBack} disabled={saving}>
                    Back
                  </button>
                ) : null}
                <button type="button" className="ob-btn-continue" onClick={saveDetails} disabled={saving}>
                  {saving ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </>
          ) : null}

          {role === 'missionary' && step === 2 ? (
            <>
              <div className="ob-goal-grid">
                {GOAL_PRESETS.map((preset) => (
                  <button
                    key={preset.amount}
                    type="button"
                    className={selectedAmount === preset.amount ? 'ob-goal-card selected' : 'ob-goal-card'}
                    onClick={() => setMonthlyAmount(String(preset.amount))}
                  >
                    <div className="ob-goal-amount">${preset.amount.toLocaleString()}</div>
                    <div className="ob-goal-label">{preset.label}</div>
                  </button>
                ))}
              </div>
              <div className="ob-fields" style={{ marginTop: 16 }}>
                <label className="ob-field">
                  <span className="ob-label">Custom amount</span>
                  <input
                    className="ob-input"
                    inputMode="decimal"
                    value={monthlyAmount}
                    onChange={(e) => setMonthlyAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="Monthly goal"
                  />
                </label>
                <label className="ob-field">
                  <span className="ob-label">Partner goal</span>
                  <input
                    className="ob-input"
                    inputMode="numeric"
                    value={partnerGoal}
                    onChange={(e) => setPartnerGoal(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Number of partners"
                  />
                </label>
              </div>
              <div className="ob-btn-row">
                <button type="button" className="ob-btn-back" onClick={goBack} disabled={saving}>
                  Back
                </button>
                <button type="button" className="ob-btn-continue" onClick={saveGoal} disabled={saving}>
                  {saving ? 'Saving…' : 'Continue'}
                </button>
              </div>
            </>
          ) : null}

          {role === 'missionary' && step === 3 ? (
            <>
              <div className="ob-emoji" aria-hidden="true">🚀</div>
              <h2 className="ob-card-title">You're all set {displayName}!</h2>
              <ul className="ob-check">
                {MISSIONARY_CHECKLIST.map((item) => (
                  <li key={item}>
                    <span className="ob-check-mark">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="ob-btn-row">
                <button type="button" className="ob-btn-back" onClick={goBack} disabled={saving}>
                  Back
                </button>
                <button type="button" className="ob-btn-continue" onClick={finish} disabled={saving}>
                  {saving ? 'Saving…' : 'Take me to my dashboard →'}
                </button>
              </div>
            </>
          ) : null}

          {role === 'supporter' && step === 1 ? (
            <>
              <div className="ob-code-wrap">
                <input
                  className="ob-code-input"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="CODE"
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Invite code"
                  style={{ letterSpacing: inviteCode.length > 7 ? 4 : 10 }}
                />
              </div>
              <div className="ob-btn-row">
                {showBack ? (
                  <button type="button" className="ob-btn-back" onClick={goBack} disabled={saving}>
                    Back
                  </button>
                ) : null}
                <button type="button" className="ob-btn-continue" onClick={connectCode} disabled={saving}>
                  {saving ? 'Connecting…' : 'Connect'}
                </button>
              </div>
              <button type="button" className="ob-ghost" onClick={skipCode} disabled={saving}>
                I don't have a code
              </button>
            </>
          ) : null}

          {role === 'supporter' && step === 2 ? (
            <>
              <div className="ob-heart" aria-hidden="true">♥</div>
              <h2 className="ob-card-title">
                {connectedName && (!skippedCode || profile?.connected_missionary_id)
                  ? `You're connected to ${connectedName}`
                  : "You can connect whenever you're ready"}
              </h2>
              <ul className="ob-check">
                {SUPPORTER_CHECKLIST.map((item) => (
                  <li key={item}>
                    <span className="ob-check-mark">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="ob-btn-row">
                <button type="button" className="ob-btn-back" onClick={goBack} disabled={saving}>
                  Back
                </button>
                <button type="button" className="ob-btn-continue" onClick={finish} disabled={saving}>
                  {saving ? 'Saving…' : 'Go to my feed →'}
                </button>
              </div>
            </>
          ) : null}
        </div>

        <div className="ob-mobile-progress">
          <div className="ob-bar" aria-hidden="true">
            <div className="ob-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="ob-dots" aria-hidden="true">
            {Array.from({ length: totalSteps }, (_, i) => (
              <span key={i} className={i < currentStep ? 'ob-dot active' : 'ob-dot'} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

const ONBOARDING_CSS = `
.ob-shell {
  min-height: 100vh;
  background: #111;
  display: flex;
  flex-direction: column;
  font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif;
  color: #fff;
}
.ob-left { display: none; }
.ob-right {
  position: relative;
  flex: 1;
  background: #111;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
}
.ob-skip {
  position: absolute;
  top: 24px;
  right: 32px;
  font-size: 13px;
  color: #AAA;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  z-index: 2;
}
.ob-skip:disabled { opacity: 0.5; cursor: default; }
.ob-logo {
  font-family: 'Bebas Neue', sans-serif !important;
  font-size: 28px;
  color: #fff;
  letter-spacing: 4px;
  line-height: 1;
}
.ob-mobile-head { margin-top: 8px; margin-bottom: 28px; }
.ob-kicker {
  margin: 18px 0 10px;
  color: #4CAF7D;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.ob-left-title {
  margin: 0;
  font-size: 32px;
  font-weight: 900;
  color: #fff;
  line-height: 1.12;
  letter-spacing: -0.02em;
}
.ob-card {
  width: 100%;
  max-width: 480px;
  background: transparent;
  color: #fff;
}
.ob-card-title {
  margin: 0 0 8px;
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  line-height: 1.25;
}
.ob-welcome-sub {
  margin: 0 0 22px;
  font-size: 15px;
  color: #AAA;
  line-height: 1.5;
}
.ob-emoji { font-size: 36px; line-height: 1; margin-bottom: 14px; }
.ob-heart {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #EDFAF2;
  color: #4CAF7D;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  margin-bottom: 14px;
}
.ob-fields { display: flex; flex-direction: column; gap: 14px; }
.ob-row { display: flex; gap: 12px; }
.ob-row > .ob-field { flex: 1; min-width: 0; }
.ob-field { display: block; }
.ob-label {
  font-size: 11px;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  display: block;
  margin-bottom: 6px;
}
.ob-input {
  width: 100%;
  padding: 13px 16px;
  border-radius: 12px;
  border: none;
  background: #1A1A1A;
  color: #fff;
  font-size: 15px;
  font-family: inherit;
}
.ob-input:focus { outline: none; }
.ob-btn-row { display: flex; gap: 12px; margin-top: 24px; }
.ob-btn-back {
  padding: 13px 20px;
  border-radius: 12px;
  background: none;
  border: 1px solid #333;
  color: #AAA;
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
}
.ob-btn-continue, .ob-btn-missionary, .ob-btn-supporter {
  padding: 15px;
  border-radius: 14px;
  background: #4CAF7D;
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  font-family: inherit;
  border: none;
  cursor: pointer;
}
.ob-btn-continue { flex: 1; }
.ob-btn-missionary, .ob-btn-supporter { width: 100%; display: block; }
.ob-btn-supporter { margin-top: 10px; }
.ob-btn-continue:disabled, .ob-btn-back:disabled, .ob-btn-missionary:disabled, .ob-btn-supporter:disabled, .ob-ghost:disabled {
  opacity: 0.55;
  cursor: default;
}
.ob-ghost {
  display: block;
  width: 100%;
  margin-top: 14px;
  background: none;
  border: none;
  color: #888;
  font-size: 14px;
  font-family: inherit;
  cursor: pointer;
  text-align: center;
}
.ob-goal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.ob-goal-card {
  background: #F9F9F9;
  border-radius: 12px;
  padding: 16px;
  text-align: center;
  border: 2px solid transparent;
  cursor: pointer;
  font-family: inherit;
}
.ob-goal-card.selected {
  border-color: #4CAF7D;
  background: #F0FBF5;
}
.ob-goal-amount {
  font-size: 24px;
  font-weight: 800;
  color: #111;
}
.ob-goal-label {
  font-size: 11px;
  color: #888;
  margin-top: 3px;
}
.ob-code-wrap {
  background: #F9F9F9;
  border-radius: 16px;
  padding: 32px;
  text-align: center;
}
.ob-code-input {
  font-size: 32px;
  font-weight: 900;
  color: #111;
  background: none;
  border: none;
  border-bottom: 2px solid #DDD;
  width: 200px;
  max-width: 100%;
  text-align: center;
  letter-spacing: 10px;
  font-family: inherit;
}
.ob-code-input:focus {
  outline: none;
  border-bottom-color: #4CAF7D;
}
.ob-code-input::placeholder { color: #CCC; letter-spacing: 10px; }
.ob-check {
  list-style: none;
  margin: 18px 0 0;
  padding: 20px 24px;
  background: #F9F9F9;
  border-radius: 14px;
}
.ob-check li {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 7px 0;
  font-size: 14px;
  color: #444;
}
.ob-check-mark {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #EDFAF2;
  color: #4CAF7D;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ob-error {
  margin: 0 0 14px;
  color: #ff8a8a;
  font-size: 13px;
}
.ob-mobile-progress { margin-top: 28px; }
.ob-bar {
  height: 3px;
  background: #222;
  border-radius: 999px;
  overflow: hidden;
}
.ob-bar-fill { height: 100%; background: #4CAF7D; }
.ob-dots { display: flex; gap: 8px; margin-top: 14px; }
.ob-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #222;
}
.ob-dot.active { background: #4CAF7D; }

@media (min-width: 768px) {
  .ob-shell {
    flex-direction: row;
    height: 100vh;
    min-height: 100vh;
    overflow: hidden;
  }
  .ob-left {
    display: flex;
    flex-direction: column;
    width: 420px;
    flex-shrink: 0;
    height: 100vh;
    background: #111;
    padding: 48px;
    box-sizing: border-box;
  }
  .ob-left-mid {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .ob-left .ob-kicker { margin-top: 0; }
  .ob-left-sub {
    margin: 12px 0 0;
    font-size: 15px;
    color: #444;
    line-height: 1.5;
  }
  .ob-progress { margin-top: 0; }
  .ob-right {
    flex: 1;
    background: #F7F7F7;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 60px 80px;
    position: relative;
    overflow: auto;
  }
  .ob-mobile-head, .ob-mobile-progress { display: none; }
  .ob-card {
    background: #fff;
    border-radius: 20px;
    padding: 36px 40px;
    width: 100%;
    max-width: 480px;
    box-shadow: 0 4px 40px rgba(0,0,0,0.06);
    color: #111;
  }
  .ob-card-title { color: #111; }
  .ob-welcome-sub { color: #444; }
  .ob-error { color: #C43D5E; }
  .ob-input {
    border: 1px solid #EEE;
    background: #F9F9F9;
    color: #111;
  }
  .ob-input:focus {
    border-color: #4CAF7D;
    background: #fff;
    outline: none;
  }
  .ob-btn-missionary {
    background: #111;
    color: #fff;
    padding: 16px;
    border-radius: 14px;
    border: none;
  }
  .ob-btn-supporter {
    background: #fff;
    color: #111;
    border: 1px solid #EEE;
    padding: 14px;
    border-radius: 14px;
  }
  .ob-btn-back {
    border: 1px solid #EEE;
    color: #888;
    background: none;
  }
  .ob-btn-continue {
    background: #4CAF7D;
    color: #fff;
  }
}
`;
