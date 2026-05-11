import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppState } from '../../state/AppState';
import { useAuth } from '../../auth/AuthContext';
import { geocodePlaceName } from '../../lib/geocoding';
import { supabase } from '../../lib/supabaseClient';
import { ensureMissionarySupporterCode } from '../../lib/supporterConnection';
import { Button, Card, Input, Label, Textarea } from '../../components/ui';
import FeedbackSection from '../../components/FeedbackSection';
import LocalPinSettingsSection from '../../components/LocalPinSettingsSection';

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
  } = setters;
  setFullName(row.full_name || '');
  setOrganization(row.organization || '');
  setMissionStatement(row.mission_statement || '');
  setLocationName(row.location_name || '');
  setTaxUrl(row.tax_deductible_url || '');
  setNonTaxUrl(row.non_tax_deductible_url || '');
  setMonthlyGoal(Number(row.monthly_goal ?? 0) || 0);
  setPartnerGoal(Number(row.partner_goal ?? 0) || 0);
}

/**
 * Settings: exactly one `useEffect` on mount — loads `profiles` row once, no `refreshProfile`, no auth `profile` sync.
 * Saves update Supabase then refresh local `profile` state only inside save handlers.
 */
export default function MissionarySettings() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { actions } = useAppState();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [fullName, setFullName] = useState('');
  const [organization, setOrganization] = useState('');
  const [missionStatement, setMissionStatement] = useState('');
  const [locationName, setLocationName] = useState('');
  const [taxUrl, setTaxUrl] = useState('');
  const [nonTaxUrl, setNonTaxUrl] = useState('');
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [partnerGoal, setPartnerGoal] = useState(0);

  const [photoErr, setPhotoErr] = useState('');
  const [localPhotoPreview, setLocalPhotoPreview] = useState('');
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
  };

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      if (!supabase) {
        if (mounted) {
          setLoadError('Supabase is not configured.');
          setLoading(false);
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
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

      if (!mounted) return;

      if (error) {
        setLoadError(error.message || 'Could not load profile.');
        setLoading(false);
        return;
      }

      if (!data) {
        setLoadError('No profile row found.');
        setLoading(false);
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
      setLoading(false);
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
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          organization: organization.trim(),
          mission_statement: missionStatement.trim(),
          tax_deductible_url: taxUrl.trim(),
          non_tax_deductible_url: nonTaxUrl.trim(),
          monthly_goal: monthlyGoal,
          partner_goal: partnerGoal,
        })
        .eq('id', user.id)
        .select('*')
        .maybeSingle();

      if (error) {
        setProfileErr(error.message);
        return;
      }

      await ensureMissionarySupporterCode(user.id, fullName.trim());
      const latest = (await refetchProfileRow(user.id)) || updated;

      if (latest) {
        setProfile(latest);
        applyRowToForm(latest, formSetters);
      }

      setProfileMsg('Profile saved.');
    } catch (e) {
      setProfileErr(e?.message || 'Could not save.');
    } finally {
      setProfileSaving(false);
    }
  };

  const onPhoto = (file) => {
    setPhotoErr('');
    setProfileMsg('');
    if (!file) return;
    if (file.size > 3_000_000) {
      setPhotoErr('Please choose a photo under 3MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setLocalPhotoPreview(String(reader.result || ''));
      actions.updateMissionaryProfile({ photoDataUrl: String(reader.result || '') });
    };
    reader.readAsDataURL(file);
  };

  const supporterCodeDisplay = String(profile?.supporter_code ?? '').trim() || '—';
  const photoSrc = localPhotoPreview || profile?.photo_url || '';

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-6">
        <p className="text-sm font-medium text-neutral-600">Loading...</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-neutral-600">Profile, goals, security, and your SENT supporter invite code.</p>
      </header>

      {profileErr ? <p className="rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{profileErr}</p> : null}
      {profileMsg ? <p className="rounded-btn border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{profileMsg}</p> : null}

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
          <div className="md:col-span-2">
            <Label title="Profile photo">
              <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} className="w-full text-sm" />
              {photoErr ? <p className="mt-2 text-sm text-red-600">{photoErr}</p> : null}
              <p className="mt-2 text-xs text-neutral-500">Preview only on this device unless you add cloud storage later.</p>
              {photoSrc ? (
                <img src={photoSrc} alt="Profile" className="mt-3 h-20 w-20 rounded-card border border-neutral-200 object-cover" />
              ) : null}
            </Label>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="button" disabled={profileSaving || !fullName.trim()} onClick={saveProfile}>
            {profileSaving ? 'Saving…' : 'Save profile'}
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">SENT supporter invite code</p>
            <p className="mt-1 text-xs text-neutral-500">Share this code so supporters can link their account to you.</p>
          </div>
          <p className="rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold tracking-wide text-neutral-900">{supporterCodeDisplay}</p>
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
          <Button type="button" variant="secondary" disabled={profileSaving} onClick={saveProfile}>
            Save links
          </Button>
        </div>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold">Goals</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Label title="Monthly goal">
            <Input inputMode="numeric" value={monthlyGoal} onChange={(e) => setMonthlyGoal(Number(e.target.value || 0))} placeholder="0" />
          </Label>
          <Label title="Partner goal">
            <Input inputMode="numeric" value={partnerGoal} onChange={(e) => setPartnerGoal(Number(e.target.value || 0))} placeholder="0" />
          </Label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button type="button" variant="secondary" disabled={profileSaving} onClick={saveProfile}>
            Save goals
          </Button>
        </div>
      </Card>

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
