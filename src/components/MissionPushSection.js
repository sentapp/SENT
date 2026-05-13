import { useCallback, useEffect, useState } from 'react';
import {
  deactivateOtherMissionPushes,
  fetchMissionPushesForMissionary,
  insertMissionPush,
  updateMissionPush,
} from '../lib/missionPushesRepository';
import { isMissingMissionPushesTableError } from '../lib/supabaseRelationErrors';
import { Button, Card, EmptyState, Input, Label, Modal, Textarea } from './ui';

function num(v) {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function daysRemainingLabel(deadlineStr) {
  if (!deadlineStr) return null;
  const end = new Date(`${String(deadlineStr).slice(0, 10)}T23:59:59`);
  const now = new Date();
  const diffMs = end.getTime() - now.getTime();
  const days = Math.ceil(diffMs / 86400000);
  if (Number.isNaN(days)) return null;
  if (days < 0) return 'Past deadline';
  if (days === 0) return 'Last day';
  if (days === 1) return '1 day remaining';
  return `${days} days remaining`;
}

export default function MissionPushSection({ missionaryId }) {
  const [loading, setLoading] = useState(true);
  const [pushes, setPushes] = useState([]);
  const [formError, setFormError] = useState('');
  const [msg, setMsg] = useState('');
  const [mutedNote, setMutedNote] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [deadline, setDeadline] = useState('');
  const [givingLink, setGivingLink] = useState('');
  const [saving, setSaving] = useState(false);

  const [raisedDraft, setRaisedDraft] = useState('');
  const [raisedSaving, setRaisedSaving] = useState(false);

  const clearFeedback = () => {
    setFormError('');
    setMsg('');
    setMutedNote('');
  };

  const load = useCallback(async () => {
    if (!missionaryId) {
      setPushes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMutedNote('');
    const { data, error: e } = await fetchMissionPushesForMissionary(missionaryId);
    if (e) {
      if (isMissingMissionPushesTableError(e)) {
        setPushes([]);
      } else {
        setPushes([]);
        setMutedNote('Could not load mission pushes. Try again later.');
      }
    } else {
      setPushes(data || []);
    }
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
    clearFeedback();
  };

  const openCreate = () => {
    clearFeedback();
    setShowForm(true);
  };

  const submitCreate = async () => {
    clearFeedback();
    const g = num(goalAmount);
    if (!title.trim() || g <= 0) {
      setFormError('Title and a positive goal amount are required.');
      return;
    }
    if (!missionaryId) return;
    setSaving(true);
    try {
      const { error: deactErr } = await deactivateOtherMissionPushes(missionaryId, null);
      if (deactErr) {
        if (isMissingMissionPushesTableError(deactErr)) {
          resetForm();
        } else {
          setMutedNote('Could not prepare a new push. Try again later.');
        }
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
        if (isMissingMissionPushesTableError(insErr)) {
          resetForm();
        } else {
          setMutedNote('Could not save your push. Try again later.');
        }
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
    clearFeedback();
    const { error: e } = await updateMissionPush(id, { is_active: false });
    if (e) {
      if (!isMissingMissionPushesTableError(e)) {
        setMutedNote('Could not close this push. Try again later.');
      }
    } else {
      setMsg('Push closed.');
      await load();
    }
  };

  const saveRaised = async (id) => {
    clearFeedback();
    setRaisedSaving(true);
    try {
      const { error: e } = await updateMissionPush(id, { raised_amount: num(raisedDraft) });
      if (e) {
        if (!isMissingMissionPushesTableError(e)) {
          setMutedNote('Could not update amount raised. Try again later.');
        }
      } else {
        setMsg('Amount raised updated.');
        await load();
      }
    } finally {
      setRaisedSaving(false);
    }
  };

  const pct =
    active && Number(active.goal_amount) > 0
      ? Math.min(100, Math.round((Number(active.raised_amount || 0) / Number(active.goal_amount)) * 100))
      : 0;

  const daysLine = active ? daysRemainingLabel(active.deadline) : null;

  return (
    <div className="space-y-3">
      {formError ? <p className="text-sm text-amber-800">{formError}</p> : null}
      {msg ? (
        <p className="rounded-btn border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {msg}
        </p>
      ) : null}
      {mutedNote ? (
        <p className="rounded-btn border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
          {mutedNote}
        </p>
      ) : null}

      <Modal
        open={showForm}
        title="Create mission push"
        onClose={() => {
          if (!saving) resetForm();
        }}
        footer={
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={saving} onClick={() => void submitCreate()}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="secondary" disabled={saving} onClick={resetForm}>
              Cancel
            </Button>
          </div>
        }
      >
        <p className="text-xs text-neutral-500">Supporters will see this goal on their feed.</p>
        <div className="mt-4 space-y-4">
          <Label title="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer outreach" />
          </Label>
          <Label title="Description">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What you’re raising for…"
            />
          </Label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Label title="Goal ($)">
              <Input inputMode="decimal" value={goalAmount} onChange={(e) => setGoalAmount(e.target.value)} placeholder="5000" />
            </Label>
            <Label title="Deadline (optional)">
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </Label>
          </div>
          <Label title="Giving link (optional)">
            <Input value={givingLink} onChange={(e) => setGivingLink(e.target.value)} placeholder="https://…" />
          </Label>
          <p className="text-xs text-neutral-500">Saving closes any other active push for your account.</p>
        </div>
      </Modal>

      {!showForm && active ? (
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Mission push</p>
              <p className="mt-1 text-xs text-neutral-500">Fundraising goal supporters see on their feed.</p>
            </div>
            <Button type="button" variant="secondary" onClick={openCreate}>
              Start new push
            </Button>
          </div>

          {!loading ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-lg font-semibold text-ink">{active.title}</p>
                {active.description ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{active.description}</p>
                ) : null}
              </div>
              <div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-600">
                    ${Number(active.raised_amount || 0).toLocaleString()} raised of $
                    {Number(active.goal_amount || 0).toLocaleString()}
                  </span>
                  <span className="font-semibold text-mission-blue">{pct}%</span>
                </div>
                <div className="mt-2 h-3 w-full rounded-full bg-neutral-200">
                  <div className="h-3 rounded-full bg-mission-blue" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {daysLine ? <p className="text-sm font-medium text-neutral-700">{daysLine}</p> : null}
              {active.deadline ? (
                <p className="text-xs text-neutral-500">Deadline: {new Date(`${active.deadline}T12:00:00`).toLocaleDateString()}</p>
              ) : null}
              <div className="flex flex-wrap items-end gap-2 border-t border-neutral-100 pt-4">
                <Label title="Update amount raised ($)">
                  <Input
                    inputMode="decimal"
                    value={raisedDraft}
                    onChange={(e) => setRaisedDraft(e.target.value)}
                    className="max-w-xs"
                  />
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
          ) : (
            <p className="mt-4 text-sm text-neutral-500">Loading…</p>
          )}
        </Card>
      ) : null}

      {!showForm && !active ? (
        <Card className="p-5">
          <div className="mb-4">
            <p className="text-sm font-semibold text-ink">Mission push</p>
            <p className="mt-1 text-xs text-neutral-500">Fundraising goal supporters see on their feed.</p>
          </div>
          {loading ? (
            <p className="text-sm text-neutral-500">Loading…</p>
          ) : (
            <EmptyState
              icon="compass"
              title="No active mission push"
              subtitle="Create a push to share a goal, deadline, and giving link with supporters on their feed."
              action={
                <Button type="button" className="min-h-[52px] px-8 text-base font-semibold shadow-sm" onClick={openCreate}>
                  Create a push
                </Button>
              }
            />
          )}
        </Card>
      ) : null}
    </div>
  );
}
