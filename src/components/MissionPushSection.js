import { useCallback, useEffect, useState } from 'react';
import {
  deactivateOtherMissionPushes,
  fetchMissionPushesForMissionary,
  insertMissionPush,
  updateMissionPush,
} from '../lib/missionPushesRepository';
import { isMissingMissionPushesTableError } from '../lib/supabaseRelationErrors';
import { Button, Input, Label, Modal, Textarea } from './ui';

const ghostBtnClass =
  'rounded-btn border border-ink/20 bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink hover:bg-ink/[0.05]';

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
  const [raisedModalOpen, setRaisedModalOpen] = useState(false);

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
        setRaisedModalOpen(false);
        await load();
      }
    } finally {
      setRaisedSaving(false);
    }
  };

  const goalAmt = active ? Number(active.goal_amount) || 0 : 0;
  const raisedAmt = active ? Number(active.raised_amount) || 0 : 0;
  const pctFunded = goalAmt > 0 ? Math.min(100, Math.round((raisedAmt / goalAmt) * 100)) : 0;

  const daysLine = active ? daysRemainingLabel(active.deadline) : null;

  const confirmClosePush = async () => {
    if (!active?.id) return;
    if (!window.confirm('Close this mission push?')) return;
    await closePush(active.id);
  };

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

      <Modal
        open={raisedModalOpen}
        title="Update amount raised"
        onClose={() => {
          if (!raisedSaving) setRaisedModalOpen(false);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={raisedSaving} onClick={() => setRaisedModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={raisedSaving || !active}
              onClick={() => active && void saveRaised(active.id)}
            >
              {raisedSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <Label title="Amount raised ($)">
          <Input inputMode="decimal" value={raisedDraft} onChange={(e) => setRaisedDraft(e.target.value)} />
        </Label>
      </Modal>

      {!showForm && active ? (
        <div className="overflow-hidden rounded-card border border-mission-line bg-surface">
          <div className="border-b border-mission-line px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted">Mission push</p>
                <p className="mt-1 text-[13px] font-medium leading-snug text-ink">{active.title}</p>
                {active.description ? (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted">{active.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-2">
                <button type="button" className={ghostBtnClass} onClick={() => setRaisedModalOpen(true)}>
                  Update
                </button>
                <button type="button" className={ghostBtnClass} onClick={() => void confirmClosePush()}>
                  Close
                </button>
              </div>
            </div>
          </div>

          {!loading ? (
            <div className="space-y-2 px-4 py-4">
              <p
                className="text-[22px] font-normal leading-tight text-ink"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {goalAmt > 0 ? `${pctFunded}% funded` : '—'}
              </p>
              <div className="h-[2px] w-full rounded-none bg-[#E2DAD0]">
                <div
                  className="h-[2px] rounded-none bg-[#181208]"
                  style={{ width: `${goalAmt > 0 ? pctFunded : 0}%` }}
                />
              </div>
              <p className="text-[12px] leading-snug text-muted">
                ${raisedAmt.toLocaleString()} raised of ${goalAmt.toLocaleString()}
                {daysLine ? ` · ${daysLine}` : ''}
              </p>
            </div>
          ) : (
            <div className="px-4 py-6">
              <p className="text-sm text-muted">Loading…</p>
            </div>
          )}
        </div>
      ) : null}

      {!showForm && !active ? (
        <div className="flex items-center justify-between gap-3 rounded-card border border-mission-line bg-surface px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="shrink-0 text-[15px] leading-none text-muted" aria-hidden>
              ⚑
            </span>
            {loading ? (
              <p className="text-sm text-muted">Loading…</p>
            ) : (
              <p className="truncate text-sm font-medium text-ink">No active mission push</p>
            )}
          </div>
          {!loading ? (
            <button type="button" className={`shrink-0 ${ghostBtnClass}`} onClick={openCreate}>
              Create push
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
