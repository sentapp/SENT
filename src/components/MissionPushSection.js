import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  deactivateOtherMissionPushes,
  fetchMissionPushesForMissionary,
  insertMissionPush,
  updateMissionPush,
} from '../lib/missionPushesRepository';
import { Button, Card, Input, Label, Textarea } from './ui';

function num(v) {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export default function MissionPushSection({ missionaryId }) {
  const [loading, setLoading] = useState(true);
  const [pushes, setPushes] = useState([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [givingLink, setGivingLink] = useState('');
  const [saving, setSaving] = useState(false);

  const [raisedDraft, setRaisedDraft] = useState('');
  const [raisedSaving, setRaisedSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supabase || !missionaryId) {
      setPushes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error: e } = await fetchMissionPushesForMissionary(missionaryId);
    if (e) setError(e.message);
    else setPushes(data || []);
    setLoading(false);
  }, [missionaryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = pushes.find((p) => p.is_active) || null;

  useEffect(() => {
    if (active) setRaisedDraft(String(active.raised_amount ?? '0'));
  }, [active?.id, active?.raised_amount]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setGoalAmount('');
    setDeadline('');
    setGivingLink('');
    setShowForm(false);
  };

  const submitCreate = async () => {
    setError('');
    setMsg('');
    const g = num(goalAmount);
    if (!title.trim() || g <= 0) {
      setError('Title and a positive goal amount are required.');
      return;
    }
    if (!supabase || !missionaryId) return;
    setSaving(true);
    try {
      const { error: deactErr } = await deactivateOtherMissionPushes(missionaryId, null);
      if (deactErr) {
        setError(deactErr.message);
        return;
      }
      const row = {
        missionary_id: missionaryId,
        title: title.trim(),
        description: description.trim() || null,
        goal_amount: g,
        raised_amount: 0,
        deadline: deadline.trim() || null,
        giving_link: givingLink.trim() || null,
        is_active: true,
      };
      const { error: insErr } = await insertMissionPush(row);
      if (insErr) {
        setError(insErr.message);
        return;
      }
      setMsg('Mission push created.');
      resetForm();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const closePush = async (id) => {
    setError('');
    const { error: e } = await updateMissionPush(id, { is_active: false });
    if (e) setError(e.message);
    else {
      setMsg('Push closed.');
      await load();
    }
  };

  const saveRaised = async (id) => {
    setError('');
    setRaisedSaving(true);
    try {
      const { error: e } = await updateMissionPush(id, { raised_amount: num(raisedDraft) });
      if (e) setError(e.message);
      else {
        setMsg('Amount raised updated.');
        await load();
      }
    } finally {
      setRaisedSaving(false);
    }
  };

  const pct = active && Number(active.goal_amount) > 0
    ? Math.min(100, Math.round((Number(active.raised_amount || 0) / Number(active.goal_amount)) * 100))
    : 0;

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Mission push</p>
          <p className="mt-1 text-xs text-neutral-500">Fundraising goal supporters see on their feed.</p>
        </div>
        {!showForm ? (
          <Button type="button" variant="secondary" onClick={() => { setShowForm(true); setError(''); setMsg(''); }}>
            {active ? 'Start new push' : 'Create a push'}
          </Button>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      {msg ? (
        <p className="mt-3 rounded-btn border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</p>
      ) : null}

      {loading ? <p className="mt-4 text-sm text-neutral-500">Loading…</p> : null}

      {showForm ? (
        <div className="mt-4 space-y-4 rounded-card border border-neutral-200 bg-neutral-50/80 p-4">
          <Label title="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer outreach" />
          </Label>
          <Label title="Description">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What you’re raising for…" />
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label title="Goal amount ($)">
              <Input inputMode="decimal" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder="5000" />
            </Label>
            <Label title="Deadline (optional)">
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Label>
          </div>
          <Label title="Giving link (optional)">
            <Input value={givingLink} onChange={(e) => setGivingLink(e.target.value)} placeholder="https://…" />
          </Label>
          <p className="text-xs text-neutral-500">Creating a new push closes any other active push.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={submitCreate}>
              {saving ? 'Saving…' : 'Publish push'}
            </Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && active && !showForm ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-lg font-semibold text-neutral-900">{active.title}</p>
            {active.description ? <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{active.description}</p> : null}
          </div>
          <div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">
                ${Number(active.raised_amount || 0).toLocaleString()} raised of ${Number(active.goal_amount || 0).toLocaleString()}
              </span>
              <span className="font-semibold text-mission-blue">{pct}%</span>
            </div>
            <div className="mt-2 h-3 w-full rounded-full bg-neutral-200">
              <div className="h-3 rounded-full bg-mission-blue" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {active.deadline ? (
            <p className="text-xs text-neutral-500">Deadline: {new Date(`${active.deadline}T12:00:00`).toLocaleDateString()}</p>
          ) : null}
          <div className="flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-4">
            <Label title="Update amount raised ($)">
              <Input inputMode="decimal" value={raisedDraft} onChange={(e) => setRaisedDraft(e.target.value)} className="max-w-xs" />
            </Label>
            <Button type="button" disabled={raisedSaving} onClick={() => void saveRaised(active.id)}>
              {raisedSaving ? 'Saving…' : 'Update amount raised'}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" onClick={() => void closePush(active.id)}>
              Close push
            </Button>
          </div>
        </div>
      ) : !loading && !showForm ? (
        <p className="mt-4 text-sm text-neutral-500">No active mission push — create one so supporters can give toward a goal.</p>
      ) : null}
    </Card>
  );
}
