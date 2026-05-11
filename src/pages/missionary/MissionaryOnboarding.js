import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { geocodePlaceName } from '../../lib/geocoding';
import { ensureMissionarySupporterCode } from '../../lib/supporterConnection';
import { Button, Card, Input, Label, Textarea } from '../../components/ui';

export default function MissionaryOnboarding() {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [organization, setOrganization] = useState('');
  const [missionStatement, setMissionStatement] = useState('');
  const [locationName, setLocationName] = useState('');

  useEffect(() => {
    if (!profile) return;
    setOrganization(profile.organization ?? '');
    setMissionStatement(profile.mission_statement ?? '');
    setLocationName(profile.location_name ?? '');
  }, [profile]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    const org = organization.trim();
    const ms = missionStatement.trim();
    const loc = locationName.trim();
    if (!org || !ms || !loc) {
      setError('Please fill in organization, mission statement, and home location.');
      return;
    }
    if (!supabase || !user?.id) {
      setError('Not signed in.');
      return;
    }

    setSaving(true);
    try {
      let lat = null;
      let lng = null;
      const geo = await geocodePlaceName(loc);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }

      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          organization: org,
          mission_statement: ms,
          location_name: loc,
          latitude: lat,
          longitude: lng,
        })
        .eq('id', user.id);

      if (upErr) {
        setError(upErr.message);
        setSaving(false);
        return;
      }

      await ensureMissionarySupporterCode(user.id, profile?.full_name);
      await refreshProfile();
      navigate('/missionary', { replace: true });
    } catch (e) {
      setError(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-medium text-mission-blue">Welcome to SENT</p>
        <h1 className="text-2xl font-semibold">Finish your profile</h1>
        <p className="text-sm text-neutral-600">
          For missionaries and the people who send them. Add a few details so supporters know who you are.
        </p>
      </header>

      {error ? <p className="rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      <Card className="p-5">
        <div className="grid gap-4">
          <Label title="Organization">
            <Input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="Your ministry or organization" />
          </Label>
          <Label title="Mission statement">
            <Textarea
              value={missionStatement}
              onChange={(e) => setMissionStatement(e.target.value)}
              placeholder="Why you’re on mission…"
              rows={4}
            />
          </Label>
          <Label title="Home location (plain text)">
            <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder="e.g. Dublin, Ireland" />
            <p className="mt-2 text-xs text-neutral-500">We use this to place your home pin on the map.</p>
          </Label>
        </div>
        <div className="mt-6 flex justify-end">
          <Button type="button" disabled={saving} onClick={save}>
            {saving ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
