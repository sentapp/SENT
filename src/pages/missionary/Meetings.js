import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useContactDrawer } from '../../context/ContactDrawerContext';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { supabase } from '../../lib/supabaseClient';
import {
  createMeeting,
  fetchMeetingsForMissionary,
  saveMeetingOutcome,
} from '../../lib/meetingsRepository';
import {
  fetchMeetingRequestsForMissionary,
  updateMeetingRequestStatus,
} from '../../lib/meetingRequestsRepository';
import {
  MONTHS_FULL,
  WEEKDAYS,
  buildCalendarCells,
  formatDay,
  formatMeetingDate,
  formatMonth,
  formatTime,
  shiftMonth,
  todayStr,
} from '../../lib/meetingDateUtils';
import AddMeetingModal from '../../components/meetings/AddMeetingModal';
import DarkPageHeader from '../../components/DarkPageHeader';
import { Button, LoadingSpinner, Modal } from '../../components/ui';

export default function MissionaryMeetings() {
  const { openDrawer } = useContactDrawer();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { contacts, refetch: refetchContacts } = useSupabaseContacts(user?.id, { authLoading });

  const [meetings, setMeetings] = useState([]);
  const [meetingRequests, setMeetingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('calendar');
  const [showAdd, setShowAdd] = useState(false);
  const [addPrefill, setAddPrefill] = useState({ contactId: '', contactName: '', date: '' });

  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());

  const [detailMeeting, setDetailMeeting] = useState(null);
  const [outcome, setOutcome] = useState('');
  const [outcomeNotes, setOutcomeNotes] = useState('');
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [outcomeError, setOutcomeError] = useState('');
  const [requestBusyId, setRequestBusyId] = useState('');

  const loadMeetings = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMeetings([]);
      setMeetingRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [rows, requests] = await Promise.all([
      fetchMeetingsForMissionary(supabase, user.id),
      fetchMeetingRequestsForMissionary(supabase, user.id),
    ]);
    setMeetings(rows);
    setMeetingRequests(requests);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadMeetings();
  }, [loadMeetings]);

  useEffect(() => {
    const add = searchParams.get('add');
    const contactId = searchParams.get('contact');
    if (add === '1') {
      const c = contactId ? contacts.find((x) => String(x.id) === String(contactId)) : null;
      setAddPrefill({
        contactId: contactId || '',
        contactName: c?.fullName || '',
        date: todayStr(),
      });
      setShowAdd(true);
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
  const pendingRequests = useMemo(
    () => meetingRequests.filter((r) => r.status === 'pending'),
    [meetingRequests],
  );

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

  const meetingsByDate = useMemo(() => {
    const map = new Map();
    for (const m of meetings) {
      const key = m.meetingDate;
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    return map;
  }, [meetings]);

  const calendarCells = useMemo(
    () => buildCalendarCells(calendarYear, calendarMonth),
    [calendarYear, calendarMonth],
  );

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

  const handleRequestAction = async (request, action) => {
    if (!user?.id) return;
    setRequestBusyId(request.id);
    const status = action === 'accept' ? 'accepted' : 'declined';
    const res = await updateMeetingRequestStatus(supabase, {
      requestId: request.id,
      missionaryId: user.id,
      status,
    });
    if (!res.ok) {
      setRequestBusyId('');
      return;
    }
    if (action === 'accept') {
      await createMeeting(supabase, {
        missionaryId: user.id,
        contactId: null,
        contactName: request.requesterName || 'Supporter',
        meetingDate: request.requestedDate,
        meetingTime: null,
        meetingType: 'initial',
        notes: request.message || null,
      });
    }
    setRequestBusyId('');
    void loadMeetings();
  };

  const monthLabel = `${MONTHS_FULL[calendarMonth]} ${calendarYear}`;

  return (
    <div className="space-y-4">
      <DarkPageHeader title="Meetings" subtitle={`${upcomingMeetings.length} upcoming`} />
      <div className="space-y-0 overflow-hidden rounded-card border border-mission-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EEEEEE] px-4 py-3">
        <div className="sr-only">
          <h1>Meetings</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          <button
            type="button"
            onClick={() => {
              setAddPrefill({ contactId: '', contactName: '', date: todayStr() });
              setShowAdd(true);
            }}
            className="rounded-full border-0 bg-green px-3.5 py-1.5 text-[11px] font-medium text-white hover:bg-green/90"
          >
            + Add meeting
          </button>
        </div>
      </div>

      {pendingRequests.length > 0 ? (
        <div className="border-b border-[#EEEEEE] bg-[color:var(--accent-light,#E8F5EE)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Meeting requests ({pendingRequests.length})
          </p>
          <ul className="mt-2 space-y-2">
            {pendingRequests.map((req) => (
              <li
                key={req.id}
                className="flex flex-col gap-2 rounded-lg border border-[#EEEEEE] bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    {req.requesterName || 'Supporter'} · {formatMeetingDate(req.requestedDate)}
                  </p>
                  {req.message ? <p className="mt-1 text-xs text-muted">{req.message}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    disabled={requestBusyId === req.id}
                    onClick={() => void handleRequestAction(req, 'decline')}
                    className="rounded-btn border border-[#EEEEEE] px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-surface disabled:opacity-50"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={requestBusyId === req.id}
                    onClick={() => void handleRequestAction(req, 'accept')}
                    className="rounded-btn bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                  >
                    {requestBusyId === req.id ? '…' : 'Accept'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : viewMode === 'calendar' ? (
        <div className="px-4 py-4">
          <div className="mb-4 flex items-center justify-between">
            <button
              type="button"
              className="rounded-btn px-2 py-1 text-sm text-muted hover:bg-surface"
              onClick={() => {
                const next = shiftMonth(calendarYear, calendarMonth, -1);
                setCalendarYear(next.year);
                setCalendarMonth(next.month);
              }}
              aria-label="Previous month"
            >
              ‹
            </button>
            <p className="text-sm font-semibold text-ink">{monthLabel}</p>
            <button
              type="button"
              className="rounded-btn px-2 py-1 text-sm text-muted hover:bg-surface"
              onClick={() => {
                const next = shiftMonth(calendarYear, calendarMonth, 1);
                setCalendarYear(next.year);
                setCalendarMonth(next.month);
              }}
              aria-label="Next month"
            >
              ›
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-wide text-muted">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {calendarCells.map((cell, idx) => {
              if (!cell.date) {
                return <div key={`empty-${idx}`} className="min-h-[52px]" aria-hidden />;
              }
              const dayMeetings = meetingsByDate.get(cell.date) || [];
              const isToday = cell.date === today;
              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => {
                    if (dayMeetings.length === 1) openMeeting(dayMeetings[0]);
                    else if (dayMeetings.length === 0) {
                      setAddPrefill({ contactId: '', contactName: '', date: cell.date });
                      setShowAdd(true);
                    }
                  }}
                  className={`min-h-[52px] rounded-lg border p-1 text-left transition hover:bg-surface ${
                    isToday ? 'border-accent bg-[color:var(--accent-light,#E8F5EE)]' : 'border-[#EEEEEE]'
                  }`}
                >
                  <span className={`text-xs font-medium ${isToday ? 'text-accent' : 'text-ink'}`}>{cell.day}</span>
                  {dayMeetings.length > 0 ? (
                    <div className="mt-0.5 space-y-0.5">
                      {dayMeetings.slice(0, 2).map((m) => (
                        <div
                          key={m.id}
                          className="truncate rounded bg-white/80 px-0.5 text-[9px] font-medium text-ink"
                          title={m.contactName}
                        >
                          {m.contactName}
                        </div>
                      ))}
                      {dayMeetings.length > 2 ? (
                        <div className="text-[9px] text-muted">+{dayMeetings.length - 2}</div>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
          {meetings.length === 0 ? (
            <p className="mt-6 text-center text-sm text-muted">No meetings yet. Schedule your first one.</p>
          ) : null}
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
      </div>

      <AddMeetingModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        supabase={supabase}
        missionaryId={user?.id}
        contacts={contacts}
        initialContactId={addPrefill.contactId}
        initialContactName={addPrefill.contactName}
        initialDate={addPrefill.date}
        onSaved={() => void loadMeetings()}
      />

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
                  onClick={() => {
                    const c = contacts.find((x) => String(x.id) === String(detailMeeting.contactId));
                    if (c) openDrawer(c);
                  }}
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
                    className="mt-1 w-full rounded-btn border border-[#EEEEEE] px-3 py-2 text-sm"
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

function ViewToggle({ viewMode, onChange }) {
  return (
    <div className="flex rounded-full border border-[#EEEEEE] p-0.5 text-[11px]">
      {[
        { id: 'calendar', label: 'Calendar' },
        { id: 'list', label: 'List' },
      ].map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={`rounded-full px-3 py-1 font-medium transition ${
            viewMode === opt.id ? 'bg-green text-white' : 'text-muted hover:text-ink'
          }`}
        >
          {opt.label}
        </button>
      ))}
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
