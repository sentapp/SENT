import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import {
  deletePrayerRequestAsAuthor,
  fetchPrayerRequestsForMissionary,
  insertPrayerRequest,
  incrementPrayedCount,
  prayerAttributionLabel,
  updatePrayerRequestAsAuthor,
} from '../../lib/prayerRequestsRepository';
import { Button, Card, EmptyState, Label, Modal, Textarea } from '../../components/ui';

function SupporterPrayerCardMenu({ onEdit, onDelete, disabled }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        disabled={disabled}
        className="rounded-btn px-2 py-1 text-lg leading-none text-neutral-600 hover:bg-neutral-100 disabled:opacity-50"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Request options"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[10rem] rounded-btn border border-neutral-200 bg-white py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-ink hover:bg-neutral-50"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
          >
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function SupporterPrayer() {
  const { user, profile } = useAuth();
  const missionaryId = profile?.connected_missionary_id;

  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitErr, setSubmitErr] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editAnonymous, setEditAnonymous] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !missionaryId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchPrayerRequestsForMissionary(supabase, missionaryId);
    setRequests(rows);
    setLoading(false);
  }, [missionaryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    setSubmitErr('');
    const text = body.trim();
    if (!text || !supabase || !user?.id) return;

    const { data: myProfile, error: profErr } = await supabase
      .from('profiles')
      .select('connected_missionary_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr) {
      setSubmitErr(profErr.message || 'Could not load your profile.');
      return;
    }

    const mid = myProfile?.connected_missionary_id || missionaryId;
    if (!mid) {
      setSubmitErr('Connect to a missionary before submitting a request.');
      return;
    }

    const { data, error } = await insertPrayerRequest(supabase, {
      missionaryId: mid,
      authorId: user.id,
      body: text,
      anonymous,
    });

    if (error) {
      setSubmitErr(error.message || 'Could not submit.');
      return;
    }
    setBody('');
    setAnonymous(false);
    if (data) setRequests((prev) => [data, ...prev]);
    else void load();
  };

  const pray = async (id) => {
    if (!supabase) return;
    setBusyId(id);
    const { error, prayedCount } = await incrementPrayedCount(supabase, id);
    setBusyId(null);
    if (error) return;
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, prayedCount: prayedCount ?? r.prayedCount } : r)));
  };

  const openEdit = (r) => {
    setEditErr('');
    setEditId(r.id);
    setEditBody(r.body || '');
    setEditAnonymous(Boolean(r.anonymous));
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditId(null);
    setEditBody('');
    setEditAnonymous(false);
    setEditErr('');
  };

  const saveEdit = async () => {
    if (!supabase || !user?.id || !editId) return;
    setEditErr('');
    setEditSaving(true);
    const { data, error } = await updatePrayerRequestAsAuthor(supabase, {
      id: editId,
      authorId: user.id,
      body: editBody,
      anonymous: editAnonymous,
    });
    setEditSaving(false);
    if (error) {
      setEditErr(error.message || 'Could not save.');
      return;
    }
    if (data) {
      setRequests((prev) => prev.map((r) => (r.id === editId ? data : r)));
    } else void load();
    closeEdit();
  };

  const deleteOwn = async (id) => {
    if (!supabase || !user?.id) return;
    if (!window.confirm('Delete your prayer request?')) return;
    setBusyId(id);
    const { error } = await deletePrayerRequestAsAuthor(supabase, id, user.id);
    setBusyId(null);
    if (error) {
      console.error(error);
      window.alert(error.message || 'Could not delete your prayer request.');
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== id));
    void load();
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center md:text-left">
        <p className="text-sm font-medium text-mission-ink">Prayer</p>
        <h1 className="text-2xl font-semibold tracking-tight">Prayer wall</h1>
        <p className="text-sm text-neutral-600">Share a request and pray together.</p>
      </header>

      {!missionaryId ? (
        <EmptyState
          icon="link"
          title="Connect to a missionary"
          subtitle="Use your SENT invite code so your requests appear on their wall."
        />
      ) : (
        <>
          <Card className="p-5">
            <p className="text-sm font-semibold">Submit a prayer request</p>
            {submitErr ? <p className="mt-2 text-sm text-red-600">{submitErr}</p> : null}
            <div className="mt-4 space-y-4">
              <Label title="Request">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="How can we pray?" rows={4} />
              </Label>
              <label className="flex items-center gap-3 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="h-4 w-4 accent-green"
                />
                Submit anonymously
              </label>
              <div className="flex justify-end">
                <Button type="button" disabled={!body.trim()} onClick={submit}>
                  Submit
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">Requests</p>
            {loading ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : requests.length === 0 ? (
              <EmptyState
                icon="sparkles"
                title="No prayer requests yet"
                subtitle="Be the first to share how we can pray with you."
              />
            ) : (
              <div className="space-y-3">
                {requests.map((r) => {
                  const isMine =
                    Boolean(user?.id) && r.authorId != null && String(r.authorId) === String(user.id);
                  return (
                    <Card key={r.id} className="p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{r.body}</p>
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs text-neutral-500">
                              {prayerAttributionLabel(r)} · {new Date(r.createdAt).toLocaleString()}
                            </p>
                            <Button
                              type="button"
                              variant="secondary"
                              disabled={busyId === r.id}
                              onClick={() => pray(r.id)}
                            >
                              Pray ({(r.prayedCount ?? 0).toString()})
                            </Button>
                          </div>
                        </div>
                        {isMine ? (
                          <SupporterPrayerCardMenu
                            disabled={busyId === r.id}
                            onEdit={() => openEdit(r)}
                            onDelete={() => void deleteOwn(r.id)}
                          />
                        ) : null}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <Modal
            open={editOpen}
            title="Edit prayer request"
            backdropClose={false}
            onClose={() => !editSaving && closeEdit()}
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="secondary" type="button" disabled={editSaving} onClick={closeEdit}>
                  Cancel
                </Button>
                <Button type="button" disabled={editSaving || !editBody.trim()} onClick={() => void saveEdit()}>
                  {editSaving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            }
          >
            {editErr ? <p className="mb-3 text-sm text-red-600">{editErr}</p> : null}
            <Label title="Request">
              <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={5} />
            </Label>
            <label className="mt-4 flex items-center gap-3 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={editAnonymous}
                onChange={(e) => setEditAnonymous(e.target.checked)}
                className="h-4 w-4 accent-green"
              />
              Submit anonymously
            </label>
          </Modal>
        </>
      )}
    </div>
  );
}
