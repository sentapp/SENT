import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { supabase } from '../../lib/supabaseClient';
import {
  createMeeting,
  fetchMeetingsForMissionary,
  saveMeetingOutcome,
} from '../../lib/meetingsRepository';
import { Button, Input, LoadingSpinner, Modal } from '../../components/ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDay(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '—' : d.getDate();
}

function formatMonth(dateStr) {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T12:00:00`);
  return Number.isNaN(d.getTime()) ? '' : MONTHS[d.getMonth()];
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const parts = String(timeStr).split(':');
  const h = Number.parseInt(parts[0], 10);
  const m = parts[1] ?? '00';
  if (Number.isNaN(h)) return timeStr;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m.slice(0, 2)} ${ampm}`;
}

function formatMeetingDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MissionaryMeetings() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { contacts, refetch: refetchContacts } = useSupabaseContacts(user?.id, { authLoading });

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addContactId, setAddContactId] = useState('');
  const [addContactQuery, setAddContactQuery] = useState('');
  const [addDate, setAddDate] = useState(todayStr());
  const [addTime, setAddTime] = useState('');
  const [addType, setAddType] = useState('initial');
  const [addNotes, setAddNotes] = useState('');
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState('');

  const [detailMeeting, setDetailMeeting] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [outcomeError, setOutcomeError] = useState('');

  const loadMeetings = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMeetings([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchMeetingsForMissionary(supabase, user.id);
    setMeetings(rows);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    const add = searchParams.get('add');
    const contactId = searchParams.get('contact');
    if (add === '1') {
      setShowAdd(true);
      if (contactId) {
        setAddContactId(contactId);
        const c = contacts.find((x) => String(x.id) === String(contactId));
        if (c) setAddContactQuery(c.fullName || '');
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('add');
          next.delete('contact');
          return next;
        },
        { replace: true },
      );
    }
  }, [searchParams, contacts, setSearchParams]);

  const today = todayStr();
  const { upcomingMeetings, pastMeetings } = useMemo(() => {
    const upcoming = [];
    const past = [];
    for (const m of meetings) {
      const date = m.meetingDate || '';
      if (!m.isComplete && date >= today) upcoming.push(m);
      else past.push(m);
    }
    upcoming.sort((a, b) => {
      const d = String(a.meetingDate).localeCompare(String(b.meetingDate));
      if (d !== 0) return d;
      return String(a.meetingTime || '').localeCompare(String(b.meetingTime || ''));
    });
    past.sort((a, b) => {
      const d = String(b.meetingDate).localeCompare(String(a.meetingDate));
      if (d !== 0) return d;
      return String(b.meetingTime || '').localeCompare(String(a.meetingTime || ''));
    });
    return { upcomingMeetings: upcoming, pastMeetings: past };
  }, [meetings, today]);

  const contactPickList = useMemo(() => {
    const q = addContactQuery.trim().toLowerCase();
    const base = q
      ? contacts.filter(
          (c) =>
            (c.fullName || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q) ||
            (c.phone || '').toLowerCase().includes(q),
        )
      : contacts;
    return base.slice(0, 12);
  }, [contacts, addContactQuery]);

  const resetAddForm = () => {
    setAddContactId('');
    setAddContactQuery('');
    setAddDate(todayStr());
    setAddTime('');
    setAddType('initial');
    setAddNotes('');
    setAddError('');
  };

  const handleCreateMeeting = async () => {
    if (!user?.id) return;
    setAddError('');
    if (!addDate) {
      setAddError('Date is required.');
      return;
    }
    const contact = addContactId ? contacts.find((c) => String(c.id) === String(addContactId)) : null;
    const contactName = contact?.fullName || addContactQuery.trim() || 'Meeting';

    setAddSaving(true);
    const res = await createMeeting(supabase, {
      missionaryId: user.id,
      contactId: addContactId || null,
      contactName,
      meetingDate: addDate,
      meetingTime: addTime || null,
      meetingType: addType,
      notes: addNotes,
    });
    setAddSaving(false);
    if (!res.ok) {
      setAddError(res.error || 'Could not save.');
      return;
    }
    setShowAdd(false);
    resetAddForm();
    void loadMeetings();
  };

  const openMeeting = (meeting) => {
    setDetailMeeting(meeting);
    setOutcome(meeting.outcome || '');
    setOutcomeNotes(meeting.notes || '');
    setOutcomeError('');
  };

  const closeDetail = () => {
    if (outcomeSaving) return;
    setDetailMeeting(null);
    setOutcome('');
    setOutcomeNotes('');
    setOutcomeError('');
  };

  const handleSaveOutcome = async () => {
    if (!user?.id || !detailMeeting) return;
    setOutcomeError('');
    if (!outcome) {
      setOutcomeError('Select an outcome.');
      return;
    }
    setOutcomeSaving(true);
    const res = await saveMeetingOutcome(supabase, {
      meetingId: detailMeeting.id,
      missionaryId: user.id,
      contactId: detailMeeting.contactId,
      contactName: detailMeeting.contactName,
      outcome,
      notes: outcomeNotes,
    });
    setOutcomeSaving(false);
    if (!res.ok) {
      setOutcomeError(res.error || 'Could not save.');
      return;
    }
    closeDetail();
    void loadMeetings();
    void refetchContacts();
  };

  return (
    <div className="space-y-0 overflow-hidden rounded-card border border-mission-line bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-[#EEEEEE] px-4 py-3">
        <div>
          <h1 className="text-base font-medium text-ink">Meetings</h1>
          <p className="text-[11px] text-muted">{upcomingMeetings.length} upcoming</p>
        </div>
        <button
          type="button"
          onClick={() => {
            resetAddForm();
            setShowAdd(true);
          }}
          className="rounded-full border-0 bg-green px-3.5 py-1.5 text-[11px] font-medium text-white hover:bg-green/90"
        >
          + Add meeting
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          {upcomingMeetings.length === 0 && pastMeetings.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No meetings yet. Schedule your first one.</p>
          ) : null}

          {upcomingMeetings.length > 0 ? (
            <div>
              <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Upcoming</p>
              {upcomingMeetings.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} onOpen={() => openMeeting(meeting)} />
              ))}
            </div>
          ) : null}

          {pastMeetings.length > 0 ? (
            <div className="border-t border-[#EEEEEE]">
              <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted">Past</p>
              {pastMeetings.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} onOpen={() => openMeeting(meeting)} />
              ))}
            </div>
          ) : null}
        </>
      )}

      <Modal
        open={showAdd}
        title="Add meeting"
        onClose={() => {
          if (!addSaving) {
            setShowAdd(false);
            resetAddForm();
          }
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" disabled={addSaving} onClick={() => { setShowAdd(false); resetAddForm(); }}>
              Cancel
            </Button>
            <Button type="button" disabled={addSaving} onClick={() => void handleCreateMeeting()}>
              {addSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        {addError ? <p className="mb-3 text-sm text-red-600">{addError}</p> : null}
        <div className="space-y-4">
          <div>
            <span className="text-xs font-semibold text-neutral-600">Contact</span>
            <Input
              value={addContactQuery}
              onChange={(e) => {
                setAddContactQuery(e.target.value);
                setAddContactId('');
              }}
              placeholder="Search contacts…"
              className="mt-1"
            />
            {addContactId ? (
              <p className="mt-2 text-xs text-neutral-600">
                Selected:{' '}
                <span className="font-medium text-ink">
                  {contacts.find((c) => String(c.id) === String(addContactId))?.fullName || 'Contact'}
                </span>{' '}
                <button
                  type="button"
                  className="font-semibold text-mission-ink hover:underline"
                  onClick={() => {
                    setAddContactId('');
                    setAddContactQuery('');
                  }}
                >
                  Clear
                </button>
              </p>
            ) : null}
            {!addContactId && addContactQuery.trim() ? (
              <ul className="mt-2 max-h-40 overflow-y-auto rounded-md border border-neutral-200 bg-white text-sm">
                {contactPickList.length === 0 ? (
                  <li className="px-3 py-2 text-neutral-500">No matches</li>
                ) : (
                  contactPickList.map((c) => (
                    <li key={c.id} className="border-b border-neutral-100 last:border-b-0">
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left hover:bg-neutral-50"
                        onClick={() => {
                          setAddContactId(c.id);
                          setAddContactQuery(c.fullName || '');
                        }}
                      >
                        {c.fullName || 'Unnamed'}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Date</span>
            <Input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)} className="mt-1" required />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Time (optional)</span>
            <Input type="time" value={addTime} onChange={(e) => setAddTime(e.target.value)} className="mt-1" />
          </label>
          <div>
            <span className="text-xs font-semibold text-neutral-600">Type</span>
            <div className="mt-2 flex gap-2">
              {[
                { value: 'initial', label: 'Initial meeting' },
                { value: 'followup', label: 'Follow up' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAddType(opt.value)}
                  className={`rounded-btn border px-3 py-1.5 text-xs font-medium ${
                    addType === opt.value
                      ? 'border-green bg-green-light text-green'
                      : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-semibold text-neutral-600">Notes (optional)</span>
            <textarea
              value={addNotes}
              onChange={(e) => setAddNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-btn border border-neutral-200 px-3 py-2 text-sm"
              placeholder="Anything to remember…"
            />
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(detailMeeting)}
        title={detailMeeting?.contactName || 'Meeting'}
        onClose={closeDetail}
        footer={
          detailMeeting?.isComplete ? (
            <div className="flex justify-end">
              <Button variant="secondary" type="button" onClick={closeDetail}>
                Close
              </Button>
            </div>
          ) : (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" type="button" disabled={outcomeSaving} onClick={closeDetail}>
                Cancel
              </Button>
              <Button type="button" disabled={outcomeSaving} onClick={() => void handleSaveOutcome()}>
                {outcomeSaving ? 'Saving…' : 'Save outcome'}
              </Button>
            </div>
          )
        }
      >
        {detailMeeting ? (
          <div className="space-y-4">
            <div className="text-sm text-neutral-700">
              <p className="font-medium text-ink">{formatMeetingDate(detailMeeting.meetingDate)}</p>
              <p className="mt-1 text-xs text-muted">
                {detailMeeting.meetingTime ? `${formatTime(detailMeeting.meetingTime)} · ` : ''}
                {detailMeeting.meetingType === 'followup' ? 'Follow up' : 'Initial meeting'}
              </p>
              {detailMeeting.contactId ? (
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-mission-ink hover:underline"
                  onClick={() => navigate(`/missionary/contacts?contact=${encodeURIComponent(detailMeeting.contactId)}`)}
                >
                  View contact →
                </button>
              ) : null}
            </div>

            {detailMeeting.isComplete ? (
              <div className="rounded-lg bg-surface px-3 py-2 text-sm">
                <p className="font-medium text-ink">
                  Outcome:{' '}
                  {detailMeeting.outcome === 'yes'
                    ? 'Yes — partnering!'
                    : detailMeeting.outcome === 'no'
                      ? 'Not yet'
                      : detailMeeting.outcome === 'followup'
                        ? 'Follow up scheduled'
                        : 'Completed'}
                </p>
                {detailMeeting.notes ? <p className="mt-1 text-neutral-600">{detailMeeting.notes}</p> : null}
              </div>
            ) : (
              <>
                <p className="text-xs font-medium text-ink">Did they say yes to partnering?</p>
                <div className="grid grid-cols-3 gap-2">
                  <OutcomeButton
                    selected={outcome === 'yes'}
                    onClick={() => setOutcome('yes')}
                    borderColor="var(--accent)"
                    bg="var(--accent-light)"
                    label="Yes!"
                    icon="✓"
                    labelColor="var(--accent)"
                  />
                  <OutcomeButton
                    selected={outcome === 'no'}
                    onClick={() => setOutcome('no')}
                    borderColor="#E05050"
                    bg="#FEF2F2"
                    label="Not yet"
                    icon="✗"
                    labelColor="#E05050"
                  />
                  <OutcomeButton
                    selected={outcome === 'followup'}
                    onClick={() => setOutcome('followup')}
                    borderColor="#906010"
                    bg="#FFF8E8"
                    label="Follow up"
                    icon="↻"
                    labelColor="#906010"
                  />
                </div>
                <label className="block">
                  <span className="text-xs font-semibold text-neutral-600">Notes</span>
                  <textarea
                    value={outcomeNotes}
                    onChange={(e) => setOutcomeNotes(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-btn border border-neutral-200 px-3 py-2 text-sm"
                  />
                </label>
                {outcomeError ? <p className="text-sm text-red-600">{outcomeError}</p> : null}
              </>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function MeetingRow({ meeting, onOpen }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full cursor-pointer items-center gap-3 border-b border-[#F5F5F5] px-4 py-3 text-left hover:bg-surface"
    >
      <div className="w-11 shrink-0 text-center">
        <div className="text-lg font-medium text-ink">{formatDay(meeting.meetingDate)}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted">{formatMonth(meeting.meetingDate)}</div>
      </div>
      <div className="h-9 w-px shrink-0 bg-[#EEEEEE]" aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-ink">{meeting.contactName}</div>
        <div className="mt-0.5 text-[11px] text-muted">
          {meeting.meetingTime ? `${formatTime(meeting.meetingTime)} · ` : ''}
          {meeting.meetingType === 'followup' ? 'Follow up' : 'Initial meeting'}
        </div>
      </div>
      {meeting.isComplete ? (
        <span className="shrink-0 rounded-full bg-green-light px-2 py-0.5 text-[10px] text-accent-dark">Done</span>
      ) : (
        <span className="shrink-0 rounded-full bg-[#FFF8E8] px-2 py-0.5 text-[10px] text-[#906010]">Upcoming</span>
      )}
    </button>
  );
}

function OutcomeButton({ selected, onClick, borderColor, bg, label, icon, labelColor }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border-[1.5px] p-2.5 text-center"
      style={{
        borderColor: selected ? borderColor : '#EEEEEE',
        background: selected ? bg : 'transparent',
      }}
    >
      <div className="text-base">{icon}</div>
      <div className="mt-0.5 text-[11px] font-medium" style={{ color: labelColor }}>
        {label}
      </div>
    </button>
  );
}
