import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../state/AppState';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { relinkSupporterToMissionary } from '../../lib/supporterConnection';
import { Button, Card, Input, Label } from '../../components/ui';
import FeedbackSection from '../../components/FeedbackSection';
import LocalPinSettingsSection from '../../components/LocalPinSettingsSection';

function ToggleRow({ title, subtitle, checked, onChange }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-card border border-neutral-200 bg-white p-4">
      <div>
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {subtitle ? <p className="mt-1 text-sm text-neutral-600">{subtitle}</p> : null}
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-6 w-11 rounded-full bg-neutral-200 transition peer-checked:bg-[#185FA5]" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </label>
    </div>
  );
}

export default function SupporterProfile() {
  const navigate = useNavigate();
  const { signOut, user, profile, refreshProfile } = useAuth();
  const { state, actions } = useAppState();
  const p = state.supporter.profile;

  const [connectedLabel, setConnectedLabel] = useState('');
  const [codeOpen, setCodeOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeOk, setCodeOk] = useState('');

  const loadConnectedMissionary = useCallback(async () => {
    const mid = profile?.connected_missionary_id;
    if (!mid || !supabase) {
      setConnectedLabel('');
      return;
    }
    const { data, error } = await supabase.from('profiles').select('full_name, organization').eq('id', mid).maybeSingle();
    if (error || !data) {
      setConnectedLabel('');
      return;
    }
    const org = String(data.organization ?? '').trim();
    setConnectedLabel(org ? `${data.full_name || 'Missionary'} — ${org}` : String(data.full_name || '').trim() || 'Connected');
  }, [profile?.connected_missionary_id]);

  useEffect(() => {
    void loadConnectedMissionary();
  }, [loadConnectedMissionary]);

  const submitNewCode = async (e) => {
    e.preventDefault();
    setCodeError('');
    setCodeOk('');
    if (!user?.id) {
      setCodeError('Not signed in.');
      return;
    }
    const trimmed = newCode.trim();
    if (!trimmed) {
      setCodeError('Enter a missionary code.');
      return;
    }
    setCodeBusy(true);
    try {
      const res = await relinkSupporterToMissionary(user.id, trimmed);
      if (!res.ok) {
        setCodeError(res.error || 'Could not update code.');
        return;
      }
      await refreshProfile();
      const org = String(res.missionary?.organization ?? '').trim();
      const name = String(res.missionary?.full_name ?? '').trim() || 'Your missionary';
      setCodeOk(org ? `Connected to ${name} — ${org}` : `Connected to ${name}`);
      setConnectedLabel(org ? `${name} — ${org}` : name);
      setNewCode('');
      setCodeOpen(false);
    } finally {
      setCodeBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center md:text-left">
        <p className="text-sm font-medium text-mission-blue">Profile</p>
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="text-sm text-neutral-600">Edit your details and notification preferences.</p>
      </header>

      <Card className="p-5">
        <p className="text-sm font-semibold">Connected missionary</p>
        <p className="mt-2 text-sm text-neutral-800">
          {profile?.connected_missionary_id
            ? connectedLabel || 'Loading…'
            : 'You are not linked to a missionary yet. Use an invite code from sign up, or update your code below.'}
        </p>
        {codeOk ? (
          <p className="mt-3 rounded-btn border border-mission-green/30 bg-mission-green/10 px-3 py-2 text-sm text-mission-green">
            {codeOk}
          </p>
        ) : null}
        {!codeOpen ? (
          <Button type="button" variant="secondary" className="mt-4" onClick={() => { setCodeOpen(true); setCodeError(''); }}>
            Update code
          </Button>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={submitNewCode}>
            <Label title="Missionary invite code">
              <Input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="e.g. HH-2026"
                autoComplete="off"
              />
            </Label>
            {codeError ? <p className="text-sm text-red-600">{codeError}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={codeBusy}>
                {codeBusy ? 'Saving…' : 'Save'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={codeBusy}
                onClick={() => {
                  setCodeOpen(false);
                  setNewCode('');
                  setCodeError('');
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold">Details</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Label title="Name">
            <Input value={p.name} onChange={(e) => actions.updateSupporterProfile({ name: e.target.value })} placeholder="Your name" />
          </Label>
          <Label title="Email">
            <Input value={p.email} onChange={(e) => actions.updateSupporterProfile({ email: e.target.value })} placeholder="you@example.com" />
          </Label>
          <Label title="Phone">
            <Input value={p.phone} onChange={(e) => actions.updateSupporterProfile({ phone: e.target.value })} placeholder="(555) 555‑5555" />
          </Label>
        </div>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-neutral-900">Notifications</p>
        <ToggleRow
          title="In-app"
          subtitle="Receive updates inside the app."
          checked={p.notifications.inApp}
          onChange={(v) => actions.updateSupporterNotifications({ inApp: v })}
        />
        <ToggleRow
          title="Email"
          subtitle="Get email updates."
          checked={p.notifications.email}
          onChange={(v) => actions.updateSupporterNotifications({ email: v })}
        />
        <ToggleRow
          title="Text"
          subtitle="SMS notifications."
          checked={p.notifications.text}
          onChange={(v) => actions.updateSupporterNotifications({ text: v })}
        />
        <ToggleRow
          title="Prayer notifications"
          subtitle="Notify me when new prayer requests are posted."
          checked={p.notifications.prayer}
          onChange={(v) => actions.updateSupporterNotifications({ prayer: v })}
        />
      </div>

      <FeedbackSection />

      <LocalPinSettingsSection userId={user?.id} />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Sign out</p>
            <p className="mt-1 text-xs text-neutral-500">Auth will be wired to Supabase later.</p>
          </div>
          <Button
            type="button"
            variant="danger"
            onClick={async () => {
              await signOut();
              actions.resetAll();
              navigate('/', { replace: true });
            }}
          >
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
