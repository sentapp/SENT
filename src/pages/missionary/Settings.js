import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../state/AppState';
import { useAuth } from '../../auth/AuthContext';
import { geocodePlaceName } from '../../lib/geocoding';
import { supabase } from '../../lib/supabaseClient';
import { ensureMissionarySupporterCode } from '../../lib/supporterConnection';
import { DEFAULT_PROFILE_ACCENT, normalizeProfileAccent } from '../../lib/profileAppearance';
import { applyAccentColor } from '../../lib/applyAccentTheme';
import { isProfilesAccentColumnUnavailable } from '../../lib/profileAccentPersistence';
import { ProfileAvatarAccentSection } from '../../components/ProfileAvatarAccentSection';
import { Button, Card, Input, Label, Textarea } from '../../components/ui';
import FeedbackSection from '../../components/FeedbackSection';
import LocalPinSettingsSection from '../../components/LocalPinSettingsSection';
import { CURRENCIES, getCurrencySymbol, normalizeCurrencyCode } from '../../lib/currencies';

function applyRowToForm(row, setters) {
  if (!row) return;
  const {
    setFullName,
    setOrganization,
    setMissionStatement,
    setLocationName,
    setTaxUrl,
    setNonTaxUrl,
    setMonthlyGoal,
    setPartnerGoal,
    setHomeCurrency,
  } = setters;
  setFullName(row.full_name || '');
  setOrganization(row.organization || '');
  setMissionStatement(row.mission_statement || '');
  setLocationName(row.location_name || '');
  setTaxUrl(row.tax_deductible_url || '');
  setNonTaxUrl(row.non_tax_deductible_url || '');
  setMonthlyGoal(Number(row.monthly_goal ?? 0) || 0);
  setPartnerGoal(Number(row.partner_goal ?? 0) || 0);
  setHomeCurrency(normalizeCurrencyCode(row.home_currency));
}

/**
 * Settings: exactly one `useEffect` on mount — loads `profiles` row once, no `refreshProfile`, no auth `profile` sync.
 * Saves update Supabase then refresh local `profile` state only inside save handlers.
 */
export default function MissionarySettings() {
  const navigate = useNavigate();
  const { user, signOut, refreshProfile } = useAuth();
  const { actions } = useAppState();

  const [profile, setProfile] = useState(null);
  /** True until the first profiles fetch finishes (form stays visible; optional subtle dimming). */
  const [profileHydrating, setProfileHydrating] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [missionStatement, setMissionStatement] = useState('');
  const [locationName, setLocationName] = useState('');
  const [taxUrl, setTaxUrl] = useState('');
  const [nonTaxUrl, setNonTaxUrl] = useState('');
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [partnerGoal, setPartnerGoal] = useState(0);
  const [homeCurrency, setHomeCurrency] = useState('USD');

  const [accentColor, setAccentColor] = useState(DEFAULT_PROFILE_ACCENT);
  const [locSaving, setLocSaving] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const formSetters = {
    setFullName,
    setOrganization,
    setMissionStatement,
    setLocationName,
    setTaxUrl,
    setNonTaxUrl,
    setMonthlyGoal,
    setPartnerGoal,
    setHomeCurrency,
  };

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!supabase) {
        if (mounted) {
          setLoadError('Supabase is not configured.');
          setProfileHydrating(false);
        }
        return;
      }

      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (userErr || !user?.id) {
        setLoadError('Not signed in.');
        setProfileHydrating(false);
        return;
      }

      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      if (!mounted) return;

      if (error) {
        setLoadError(error.message || 'Could not load profile.');
        setProfileHydrating(false);
        return;
      }

      if (!data) {
        setLoadError('No profile row found.');
        setProfileHydrating(false);
        return;
      }

      let row = data;
      const ens = await ensureMissionarySupporterCode(user.id, row.full_name);
      if (mounted && ens.ok && ens.code) {
        row = { ...row, supporter_code: ens.code };
      }

      if (!mounted) return;

      setProfile(row);
      applyRowToForm(row, formSetters);
      setAccentColor(normalizeProfileAccent(row.accent_color));
      setProfileHydrating(false);
    }

    loadProfile();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: run once on mount only
  }, []);

  async function refetchProfileRow(userId) {
    if (!supabase || !userId) return null;
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    return data ?? null;
  }

  const saveHomeLocationFromText = async (textRaw) => {
    const text = (textRaw || '').trim();
    if (!supabase) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return;

    setLocSaving(true);
    let lat = null;
    let lng = null;
    if (text) {
      const geo = await geocodePlaceName(text);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    const { data: updated, error } = await supabase
      .from('profiles')
      .update({
        location_name: text,
        latitude: lat,
        longitude: lng,
      })
      .eq('id', user.id)
      .select('*')
      .maybeSingle();

    setLocSaving(false);

    if (error) return;

    if (updated) {
      setProfile(updated);
      setLocationName(updated.location_name || '');
    }
  };

  const saveProfile = async () => {
    setProfileErr('');
    setProfileMsg('');

    if (!supabase) {
      setProfileErr('Supabase is not configured.');
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      setProfileErr('Not signed in.');
      return;
    }

    setProfileSaving(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        organization: organization.trim(),
        mission_statement: missionStatement.trim(),
        tax_deductible_url: taxUrl.trim(),
        non_tax_deductible_url: nonTaxUrl.trim(),
        monthly_goal: monthlyGoal,
        partner_goal: partnerGoal,
        home_currency: normalizeCurrencyCode(homeCurrency),
        accent_color: normalizeProfileAccent(accentColor),
      };

      let { data: updated, error } = await supabase.from('profiles').update(payload).eq('id', user.id).select('*').maybeSingle();

      if (error && isProfilesAccentColumnUnavailable(error)) {
        const { accent_color: _a, ...withoutAccent } = payload;
        ({ data: updated, error } = await supabase
          .from('profiles')
          .update(withoutAccent)
          .eq('id', user.id)
          .select('*')
          .maybeSingle());
      }

      if (error) {
        setProfileErr(error.message);
        return;
      }

      await ensureMissionarySupporterCode(user.id, fullName.trim());
      const latest = (await refetchProfileRow(user.id)) || updated;

      if (latest) {
        setProfile(latest);
        applyRowToForm(latest, formSetters);
        applyAccentColor(latest.accent_color);
      }

      setProfileMsg('Profile saved.');
      await refreshProfile();
    } catch (e) {
      setProfileErr(e?.message || 'Could not save.');
    } finally {
      setProfileSaving(false);
    }
  };

  const persistAccent = async (hex) => {
    const h = normalizeProfileAccent(hex);
    setAccentColor(h);
    applyAccentColor(h);
    setProfileErr('');
    setProfileMsg('');
    if (!supabase || !profile?.id) return;
    try {
      const { error } = await supabase.from('profiles').update({ accent_color: h }).eq('id', profile.id);
      if (error) {
        if (isProfilesAccentColumnUnavailable(error)) {
          return;
        }
        setProfileErr(error.message);
        return;
      }
      setProfile((p) => (p ? { ...p, accent_color: h } : p));
      setProfileMsg('Color saved.');
      await refreshProfile();
    } catch (e) {
      if (isProfilesAccentColumnUnavailable(e)) {
        return;
      }
      setProfileErr(e?.message || 'Could not save color.');
    }
  };

  const onAvatarUploaded = async (url) => {
    setProfileErr('');
    setProfile((p) => (p ? { ...p, photo_url: url } : p));
    setProfileMsg('Photo updated.');
    await refreshProfile();
  };

  const supporterCodeDisplay = String(profile?.supporter_code ?? '').trim() || '—';

  return (
    <div
      className="space-y-6"
      style={{ '--profile-accent': normalizeProfileAccent(accentColor) }}
    >
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-neutral-600">Profile, goals, security, and your SENT supporter invite code.</p>
      </header>

      {loadError ? (
        <p className="rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
      ) : null}

      <div className={`space-y-6 ${profileHydrating ? 'opacity-60 transition-opacity' : ''}`}>
        <Card className="p-5 md:p-6">
          <ProfileAvatarAccentSection
            userId={profile?.id || user?.id}
            fullName={fullName || profile?.full_name}
            photoUrl={profile?.photo_url || ''}
            accentColor={accentColor}
            onPhotoUrlChange={(url) => void onAvatarUploaded(url)}
            onAccentChange={(hex) => void persistAccent(hex)}
            disabled={profileSaving}
          />
        </Card>

        <Card className="border-2 border-[color:color-mix(in_srgb,var(--profile-accent)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--profile-accent)_10%,white)] p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide profile-accent-text">Your missionary / supporter code</p>
          <p className="mt-3 break-all font-mono text-2xl font-bold tracking-wide text-ink md:text-3xl">
            {supporterCodeDisplay}
          </p>
          <p className="mt-3 text-sm text-neutral-700">
            Share this code so supporters can link their SENT account to you. It’s unique to your ministry — keep it handy on
            mobile from this Profile tab.
          </p>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold">Edit profile</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Label title="Name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
            </Label>
            <Label title="Organization">
              <Input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Organization" />
            </Label>
            <div className="md:col-span-2">
              <Label title="Mission statement">
                <Textarea
                  value={missionStatement}
                  onChange={(e) => setMissionStatement(e.target.value)}
                  placeholder="Why you’re on mission…"
                  rows={4}
                />
              </Label>
            </div>
            <Label title="Home location (plain text)">
              <Input
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
                onBlur={(e) => saveHomeLocationFromText(e.target.value)}
                placeholder="e.g. Dublin, Ireland"
              />
              <p className="mt-2 text-xs text-neutral-500">
                {locSaving ? 'Finding your location on the map…' : 'We look up the map position automatically — coordinates are never shown.'}
              </p>
            </Label>
          </div>
          <div className="mt-6 flex justify-end">
            <Button
              type="button"
              className="profile-accent-btn-primary"
              disabled={profileSaving || !fullName.trim()}
              onClick={saveProfile}
            >
              {profileSaving ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold">Giving links</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Label title="Tax-deductible URL">
              <Input value={taxUrl} onChange={(e) => setTaxUrl(e.target.value)} placeholder="https://…" />
            </Label>
            <Label title="Non-tax-deductible URL">
              <Input value={nonTaxUrl} onChange={(e) => setNonTaxUrl(e.target.value)} placeholder="https://…" />
            </Label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" className="profile-accent-btn-primary" disabled={profileSaving} onClick={saveProfile}>
              Save links
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold">Home currency</p>
          <p className="mt-1 text-xs text-neutral-500">
            Used for dashboard monthly totals and as the default when you add or import contacts.
          </p>
          <div className="mt-4 max-w-md">
            <Label title="Currency">
              <select
                className="w-full rounded-btn border border-neutral-200 bg-white px-3 py-2.5 text-sm text-ink"
                value={homeCurrency}
                onChange={(e) => setHomeCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} {c.label} ({c.code})
                  </option>
                ))}
              </select>
            </Label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" className="profile-accent-btn-primary" disabled={profileSaving} onClick={saveProfile}>
              Save currency
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold">Goals</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Label title={`Monthly goal (${getCurrencySymbol(homeCurrency)})`}>
              <Input inputMode="numeric" value={monthlyGoal} onChange={(e) => setMonthlyGoal(Number(e.target.value || 0))} placeholder="0" />
            </Label>
            <Label title="Partner goal">
              <Input inputMode="numeric" value={partnerGoal} onChange={(e) => setPartnerGoal(Number(e.target.value || 0))} placeholder="0" />
            </Label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" className="profile-accent-btn-primary" disabled={profileSaving} onClick={saveProfile}>
              Save goals
            </Button>
          </div>
        </Card>
      </div>

      {profileErr ? <p className="rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{profileErr}</p> : null}
      {profileMsg ? (
        <p className="rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{profileMsg}</p>
      ) : null}

      <FeedbackSection />

      <LocalPinSettingsSection userId={profile?.id} />

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
