import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../state/AppState';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { relinkSupporterToMissionary, linkSupporterToMissionary } from '../../lib/supporterConnection';
import { fetchConnectedMissionaryPublic } from '../../lib/connectedMissionary';
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
  const { signOut, user, refreshProfile } = useAuth();
  const { actions } = useAppState();

  const [loadError, setLoadError] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [notifyText, setNotifyText] = useState(false);
  const [notifyPrayer, setNotifyPrayer] = useState(true);
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState('');

  const [linkedMissionaryId, setLinkedMissionaryId] = useState(null);
  const [connectedMissionary, setConnectedMissionary] = useState(null);

  const [codeOpen, setCodeOpen] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeError, setCodeError] = useState('');
  const [codeOk, setCodeOk] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!supabase) {
        if (mounted) {
          setLoadError('Supabase is not configured.');
          setProfileLoading(false);
        }
        return;
      }
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!mounted) return;
      if (!authUser?.id) {
        setLoadError('Not signed in.');
        setProfileLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'full_name, email, phone, connected_missionary_id, invite_code_used, notify_in_app, notify_email, notify_text, notify_prayer',
        )
        .eq('id', authUser.id)
        .single();
      if (!mounted) return;
      if (error) {
        setLoadError(error.message || 'Could not load profile.');
        setProfileLoading(false);
        return;
      }
      if (data) {
        setFullName(String(data.full_name ?? '').trim());
        setEmail(String(data.email ?? authUser.email ?? '').trim());
        setPhone(String(data.phone ?? '').trim());
        setNotifyInApp(Boolean(data.notify_in_app));
        setNotifyEmail(Boolean(data.notify_email));
        setNotifyText(Boolean(data.notify_text));
        setNotifyPrayer(data.notify_prayer !== false);

        let mid = data.connected_missionary_id || null;
        const inviteUsed = String(data.invite_code_used ?? '').trim();

        if (inviteUsed && !mid) {
          const linked = await linkSupporterToMissionary(authUser.id, inviteUsed);
          if (linked.ok && linked.missionary?.id) {
            mid = linked.missionary.id;
            if (mounted) await refreshProfile();
            const { data: refreshed } = await supabase
              .from('profiles')
              .select('connected_missionary_id')
              .eq('id', authUser.id)
              .maybeSingle();
            if (mounted && refreshed?.connected_missionary_id) {
              mid = refreshed.connected_missionary_id;
            }
          }
        }

        setLinkedMissionaryId(mid);
        if (mid) {
          const { data: missionary, error: mErr } = await supabase
            .from('profiles')
            .select('full_name, organization')
            .eq('id', mid)
            .maybeSingle();
          if (mounted && missionary && !mErr) {
            setConnectedMissionary(missionary);
          } else if (mounted) {
            const rpc = await fetchConnectedMissionaryPublic();
            if (rpc?.id === mid) {
              setConnectedMissionary({
                full_name: rpc.full_name,
                organization: rpc.organization,
              });
            } else {
              setConnectedMissionary(null);
            }
          }
        } else if (mounted) {
          setConnectedMissionary(null);
        }
      }
      if (mounted) setProfileLoading(false);
    }
    void load();
    return () => {
      mounted = false;
    };
    // Intentionally run once on mount — details are saved explicitly to Supabase.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectedDisplayText = (() => {
    if (!linkedMissionaryId) return null;
    if (!connectedMissionary) return 'Could not load missionary details.';
    const org = String(connectedMissionary.organization ?? '').trim();
    const name = String(connectedMissionary.full_name ?? '').trim() || 'Missionary';
    return org ? `${name} — ${org}` : name;
  })();

  const saveDetails = async () => {
    if (!supabase || !user?.id) return;
    setDetailsMsg('');
    setLoadError('');
    setDetailsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          notify_in_app: notifyInApp,
          notify_email: notifyEmail,
          notify_text: notifyText,
          notify_prayer: notifyPrayer,
        })
        .eq('id', user.id);
      if (error) {
        setLoadError(error.message);
        return;
      }
      actions.updateSupporterProfile({
        name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      actions.updateSupporterNotifications({
        inApp: notifyInApp,
        email: notifyEmail,
        text: notifyText,
        prayer: notifyPrayer,
      });
      await refreshProfile();
      setDetailsMsg('Saved.');
    } finally {
      setDetailsSaving(false);
    }
  };

  const persistNotifs = async ({ inApp, email, text, prayer }) => {
    if (!supabase || !user?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({
        notify_in_app: inApp,
        notify_email: email,
        notify_text: text,
        notify_prayer: prayer,
      })
      .eq('id', user.id);
    if (!error) {
      actions.updateSupporterNotifications({ inApp, email, text, prayer });
      await refreshProfile();
    }
  };

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
      setLinkedMissionaryId(res.missionary?.id ?? null);
      if (res.missionary) {
        setConnectedMissionary({
          full_name: res.missionary.full_name,
          organization: res.missionary.organization,
        });
      }
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

      {loadError ? <p className="rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p> : null}

      <Card className="p-5">
        <p className="text-sm font-semibold">Connected missionary</p>
        <p className="mt-2 text-sm text-neutral-800">
          {linkedMissionaryId
            ? connectedDisplayText
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
                placeholder="e.g. AB-2025"
                autoComplete="off"
              />
            </Label>
            <p className="text-xs text-neutral-500">Your missionary can find their code in Settings.</p>
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
        {profileLoading ? (
          <p className="mt-4 text-sm text-neutral-500">Loading your profile…</p>
        ) : (
          <>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Label title="Name">
                <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
              </Label>
              <Label title="Email">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </Label>
              <Label title="Phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555‑5555" />
              </Label>
            </div>
            {detailsMsg ? <p className="mt-3 text-sm text-emerald-800">{detailsMsg}</p> : null}
            <div className="mt-4 flex justify-end">
              <Button type="button" disabled={detailsSaving || !fullName.trim()} onClick={() => void saveDetails()}>
                {detailsSaving ? 'Saving…' : 'Save details'}
              </Button>
            </div>
          </>
        )}
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-neutral-900">Notifications</p>
        <ToggleRow
          title="In-app"
          subtitle="Receive updates inside the app."
          checked={notifyInApp}
          onChange={(v) => {
            setNotifyInApp(v);
            void persistNotifs({ inApp: v, email: notifyEmail, text: notifyText, prayer: notifyPrayer });
          }}
        />
        <ToggleRow
          title="Email"
          subtitle="Get email updates."
          checked={notifyEmail}
          onChange={(v) => {
            setNotifyEmail(v);
            void persistNotifs({ inApp: notifyInApp, email: v, text: notifyText, prayer: notifyPrayer });
          }}
        />
        <ToggleRow
          title="Text"
          subtitle="SMS notifications."
          checked={notifyText}
          onChange={(v) => {
            setNotifyText(v);
            void persistNotifs({ inApp: notifyInApp, email: notifyEmail, text: v, prayer: notifyPrayer });
          }}
        />
        <ToggleRow
          title="Prayer notifications"
          subtitle="Notify me when new prayer requests are posted."
          checked={notifyPrayer}
          onChange={(v) => {
            setNotifyPrayer(v);
            void persistNotifs({ inApp: notifyInApp, email: notifyEmail, text: notifyText, prayer: v });
          }}
        />
      </div>

      <FeedbackSection />

      <LocalPinSettingsSection userId={user?.id} />

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Sign out</p>
            <p className="mt-1 text-xs text-neutral-500">Ends your session on this device.</p>
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
