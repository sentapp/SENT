import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deletePrayerRequestAsMissionary, prayerAttributionLabel } from '../../lib/prayerRequestsRepository';
import { useAuth } from '../../auth/AuthContext';
import { useContactDrawer } from '../../context/ContactDrawerContext';
import { useMissionaryPrayerRequests } from '../../hooks/useMissionaryPrayerRequests';
import { useMissionaryPipelineContacts } from '../../hooks/useMissionaryPipelineContacts';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { useMissionaryTasks } from '../../hooks/useMissionaryTasks';
import { useAppState } from '../../state/AppState';
import { supabase } from '../../lib/supabaseClient';
import { createTask } from '../../lib/tasksRepository';
import { daysOverdue, formatDate, isDueToday, isOverdue } from '../../lib/taskDateHelpers';
import MissionPushSection from '../../components/MissionPushSection';
import MissionaryFullscreenOverlay from '../../components/MissionaryFullscreenOverlay';
import MissionaryPipelineSection from '../../components/MissionaryPipelineSection';
import MissionaryPipeline from './Pipeline';
import MissionaryStats from './Stats';
import { Button, Card, EmptyState, Input, Modal } from '../../components/ui';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { computePartnerCurrencyTotals, formatAmount, normalizeCurrencyCode } from '../../lib/currencies';
import { daysUntilFollowUp } from '../../lib/dateHelpers';
import { fetchMeetingsForMissionary } from '../../lib/meetingsRepository';
import { formatMeetingDate, formatTime } from '../../lib/meetingDateUtils';
import { normalizeStatusFromDb } from '../../lib/contactStatuses';
import { usePendingMeetingRequestsCount } from '../../hooks/usePendingMeetingRequestsCount';
import PendingMeetingRequestsBanner from '../../components/meetings/PendingMeetingRequestsBanner';
import MissionaryPageShell from '../../components/MissionaryPageShell';

function MissionaryPrayerRequestMenu({ open, onOpenChange, onDelete }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) onOpenChange(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open, onOpenChange]);

  return (
    <div className="relative shrink-0" ref={wrapRef}>
      <button
        type="button"
        className="rounded-btn px-2 py-1 text-lg leading-none text-neutral-600 hover:bg-neutral-100"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Request options"
        onClick={() => onOpenChange(!open)}
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
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50"
            onClick={() => {
              onOpenChange(false);
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

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeDayOfMission(profile) {
  const raw = profile?.mission_start_date || profile?.created_at;
  if (!raw) return null;
  const start = new Date(raw);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(1, Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

function TaskCompleteCircle({ onComplete, variant, ariaLabel }) {
  const ring =
    variant === 'onDark'
      ? 'border-white/55 hover:border-white hover:bg-white/10'
      : 'border-ink/30 hover:border-ink/50';
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        onComplete();
      }}
      className={`mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-2 bg-transparent ${ring}`}
      aria-label={ariaLabel || 'Mark complete'}
    />
  );
}

export default function MissionaryOverview() {
  const { profile, user, loading: authLoading } = useAuth();
  const { openDrawer } = useContactDrawer();
  const { contacts, refetch: refetchContacts } = useSupabaseContacts(user?.id, {
    authLoading,
  });
  const { pipelineInProgressCount, pipelineLoading } = useMissionaryPipelineContacts(user?.id, {
    authLoading,
    onAfterMutation: () => void refetchContacts(),
  });
  const {
    prayerRequests: prayer,
    loading: prayerLoading,
    refetch: refetchPrayer,
    setPrayerRequests,
  } = useMissionaryPrayerRequests(user?.id);
  const { state } = useAppState();
  const { tasks, loading: tasksLoading, refetch: refetchTasks, completeTask } = useMissionaryTasks(user?.id);
  const { pending: pendingMeetingRequests } = usePendingMeetingRequestsCount(user?.id);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState('');
  const [addTaskContactId, setAddTaskContactId] = useState('');
  const [addTaskDue, setAddTaskDue] = useState('');
  const [addTaskSaving, setAddTaskSaving] = useState(false);
  const [addTaskError, setAddTaskError] = useState('');
  const [contactPickQuery, setContactPickQuery] = useState('');
  const [prayerBusyId, setPrayerBusyId] = useState(null);
  const [openPrayerRequestMenuId, setOpenPrayerRequestMenuId] = useState(null);

  const deleteMissionaryPrayer = useCallback(
    async (id) => {
      if (!supabase || !user?.id) return;
      if (!window.confirm('Delete this prayer request from your wall?')) return;
      setPrayerBusyId(id);
      const { error } = await deletePrayerRequestAsMissionary(supabase, id, user.id);
      setPrayerBusyId(null);
      if (error) {
        console.error(error);
        window.alert(error.message || 'Could not delete this prayer request.');
        setOpenPrayerRequestMenuId(null);
        return;
      }
      setOpenPrayerRequestMenuId(null);
      setPrayerRequests((prev) => prev.filter((r) => r.id !== id));
      void refetchPrayer();
    },
    [user?.id, refetchPrayer, setPrayerRequests],
  );
  const [showPipeline, setShowPipeline] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [meetings, setMeetings] = useState([]);
  const [meetingsLoading, setMeetingsLoading] = useState(true);
  const [todayOutreachCount, setTodayOutreachCount] = useState(0);
  const [todayOutreachLoading, setTodayOutreachLoading] = useState(true);

  const dailyGoal = 16;

  const loadTodayOutreach = useCallback(async () => {
    if (!supabase || !user?.id) {
      setTodayOutreachCount(0);
      setTodayOutreachLoading(false);
      return;
    }
    setTodayOutreachLoading(true);
    const day = localDateStr();
    const start = `${day}T00:00:00.000`;
    const end = `${day}T23:59:59.999`;
    const { count, error } = await supabase
      .from('communication_logs')
      .select('id', { count: 'exact', head: true })
      .eq('missionary_id', user.id)
      .gte('created_at', start)
      .lte('created_at', end);
    if (error) console.error('Overview today outreach', error);
    setTodayOutreachCount(error ? 0 : count ?? 0);
    setTodayOutreachLoading(false);
  }, [user?.id]);

  const loadMeetings = useCallback(async () => {
    if (!supabase || !user?.id) {
      setMeetings([]);
      setMeetingsLoading(false);
      return;
    }
    setMeetingsLoading(true);
    const rows = await fetchMeetingsForMissionary(supabase, user.id);
    setMeetings(rows);
    setMeetingsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadTodayOutreach();
    void loadMeetings();
  }, [loadTodayOutreach, loadMeetings]);

  useEffect(() => {
    const onFocus = () => void loadTodayOutreach();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadTodayOutreach]);

  const partners = useMemo(
    () =>
      contacts.filter(
        (c) =>
          c.category === 'supporter' ||
          c.status === 'partner' ||
          Number(c.monthlyAmount) > 0,
      ),
    [contacts],
  );
  const homeCurrency = normalizeCurrencyCode(profile?.home_currency);

  const { homeCurrencyTotal } = useMemo(
    () => computePartnerCurrencyTotals(partners, homeCurrency),
    [partners, homeCurrency],
  );

  const oneTimeTotal = useMemo(
    () =>
      contacts
        .filter((c) => c.isOneTimeDonor && Number(c.oneTimeDonationAmount) > 0)
        .reduce((sum, c) => sum + (Number(c.oneTimeDonationAmount) || 0), 0),
    [contacts],
  );

  const goal = Number(profile?.monthly_goal ?? state.missionary.profile.monthlyGoal ?? 0) || 0;
  const gap = Math.max(goal - homeCurrencyTotal, 0);
  const pct = goal > 0 ? Math.min(100, Math.round((homeCurrencyTotal / goal) * 100)) : 0;
  const dayOfMission = computeDayOfMission(profile);
  const displayName = (profile?.full_name || '').trim() || 'Missionary';
  const orgLine = (profile?.organization || '').trim();
  const avatarInitials = initialsFromDisplayName(displayName);
  const photoUrl = profile?.photo_url || '';

  const todayStr = localDateStr();
  const incompleteTasks = useMemo(() => tasks.filter((t) => !t.isComplete), [tasks]);
  const urgentTasks = useMemo(() => {
    const u = incompleteTasks.filter(
      (t) => t.dueDate && (isOverdue(t.dueDate, todayStr) || isDueToday(t.dueDate, todayStr)),
    );
    return [...u].sort((a, b) => {
      const ao = isOverdue(a.dueDate, todayStr);
      const bo = isOverdue(b.dueDate, todayStr);
      if (ao !== bo) return ao ? -1 : 1;
      return String(a.dueDate).localeCompare(String(b.dueDate));
    });
  }, [incompleteTasks, todayStr]);
  const upcomingTasks = useMemo(
    () =>
      incompleteTasks
        .filter((t) => !isOverdue(t.dueDate, todayStr) && !isDueToday(t.dueDate, todayStr))
        .sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return String(a.dueDate).localeCompare(String(b.dueDate));
        }),
    [incompleteTasks, todayStr],
  );

  const contactNameById = useMemo(() => {
    const m = new Map();
    for (const c of contacts) {
      m.set(c.id, c.fullName || 'Unnamed');
    }
    return m;
  }, [contacts]);

  const contactPickList = useMemo(() => {
    const q = contactPickQuery.trim().toLowerCase();
    const base = q
      ? contacts.filter((c) => (c.fullName || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
      : contacts;
    return base.slice(0, 12);
  }, [contacts, contactPickQuery]);

  const circleBackSoon = useMemo(
    () =>
      contacts
        .filter((c) => {
          if (normalizeStatusFromDb(c.status) !== 'not_right_now' || !c.followUpDate) return false;
          const days = daysUntilFollowUp(c.followUpDate);
          return days >= 0 && days <= 7;
        })
        .sort((a, b) => String(a.followUpDate).localeCompare(String(b.followUpDate))),
    [contacts],
  );

  const upcomingMeetingsPreview = useMemo(() => {
    const upcoming = meetings
      .filter((m) => !m.isComplete && m.meetingDate && m.meetingDate >= todayStr)
      .sort((a, b) => {
        const d = String(a.meetingDate).localeCompare(String(b.meetingDate));
        if (d !== 0) return d;
        return String(a.meetingTime || '').localeCompare(String(b.meetingTime || ''));
      });
    return upcoming.slice(0, 2);
  }, [meetings, todayStr]);

  const resetAddTaskForm = () => {
    setAddTaskTitle('');
    setAddTaskContactId('');
    setAddTaskDue('');
    setAddTaskError('');
    setContactPickQuery('');
  };

  const saveNewTask = async () => {
    if (!user?.id) return;
    setAddTaskError('');
    const title = addTaskTitle.trim();
    if (!title) {
      setAddTaskError('Title is required.');
      return;
    }
    setAddTaskSaving(true);
    const res = await createTask(supabase, {
      missionaryId: user.id,
      contactId: addTaskContactId || null,
      title,
      notes: null,
      dueDate: addTaskDue || null,
    });
    setAddTaskSaving(false);
    if (!res.ok) {
      setAddTaskError(res.error || 'Could not save.');
      return;
    }
    setAddTaskOpen(false);
    resetAddTaskForm();
    void refetchTasks();
  };

  return (
    <MissionaryPageShell
      header={
        <header className="shrink-0 border-b border-[#222] bg-[#111] px-5 py-5 text-white md:px-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-white/20 bg-[#222]">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-lg text-white">
                  {avatarInitials.slice(0, 2)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              {dayOfMission != null ? (
                <p className="font-display text-[22px] leading-none text-accent-bright">DAY {dayOfMission}</p>
              ) : (
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666]">Overview</p>
              )}
              <h1 className="mt-1 truncate font-display text-[26px] leading-none tracking-wide">{displayName}</h1>
              {orgLine ? (
                <p className="mt-1 truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-[#666]">{orgLine}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3">
          <p className="font-display text-[48px] leading-none tracking-wide">
            {formatAmount(homeCurrencyTotal, homeCurrency)}
          </p>
          <p className="circuit-progress-pct pb-1">{pct}% funded</p>
        </div>
        <div className="circuit-progress-track mt-3">
          <div className="circuit-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {goal > 0 ? (
          <div
            className="mt-2 flex items-center justify-between gap-3"
            style={{ fontSize: 10, color: '#555' }}
          >
            <span className="min-w-0">
              {gap.toLocaleString()} to {goal.toLocaleString()} goal
              {oneTimeTotal > 0 ? (
                <>
                  {' · '}
                  <span style={{ color: '#4CAF7D' }}>
                    One-time: {formatAmount(oneTimeTotal, homeCurrency)}
                  </span>
                </>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => setShowStats(true)}
              className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#888] transition-colors hover:text-white"
            >
              Stats →
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-white/60">Set your monthly goal in Settings</p>
            <button
              type="button"
              onClick={() => setShowStats(true)}
              className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#888] transition-colors hover:text-white"
            >
              Stats →
            </button>
          </div>
        )}
        </header>
      }
    >
    <div className="flex flex-col gap-6 pb-5 md:pb-8">
      <PendingMeetingRequestsBanner pending={pendingMeetingRequests} />

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-ink">Today&apos;s outreach</span>
          <span
            className={`text-xs font-medium ${todayOutreachCount >= dailyGoal ? 'text-green' : 'text-ink'}`}
          >
            {todayOutreachLoading ? '…' : `${todayOutreachCount} / ${dailyGoal}`}
          </span>
        </div>
        <div className="mt-1.5 h-1 rounded-sm bg-[#EEEEEE]">
          <div
            className="h-full rounded-sm bg-green transition-[width] duration-300"
            style={{
              width: `${Math.min((todayOutreachCount / dailyGoal) * 100, 100)}%`,
            }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>
            {todayOutreachLoading
              ? 'Loading…'
              : todayOutreachCount >= dailyGoal
                ? 'Daily goal reached! 🎉'
                : `${Math.max(dailyGoal - todayOutreachCount, 0)} more to hit your daily goal`}
          </span>
          <span>{todayOutreachLoading ? '' : `${Math.round(Math.min((todayOutreachCount / dailyGoal) * 100, 100))}%`}</span>
        </div>
      </Card>

      {meetingsLoading ? (
        <Card className="p-4">
          <p className="text-sm text-muted">Loading meetings…</p>
        </Card>
      ) : upcomingMeetingsPreview.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-4 py-3">
            <p className="sent-section-label">Upcoming meetings</p>
          </div>
          <ul className="divide-y divide-border/60">
            {upcomingMeetingsPreview.map((m) => (
              <li key={m.id} className="px-4 py-3">
                <p className="text-sm font-medium text-ink">{m.contactName || 'Meeting'}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatMeetingDate(m.meetingDate)}
                  {m.meetingTime ? ` · ${formatTime(m.meetingTime)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="overflow-hidden rounded-card border border-mission-line bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
          <p className="sent-section-label">Tasks</p>
          <button
            type="button"
            className="rounded-btn border border-ink/20 bg-transparent px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink hover:bg-ink/[0.04]"
            onClick={() => setAddTaskOpen(true)}
          >
            + Add
          </button>
        </div>

        <div className="px-4 py-4">
          {tasksLoading ? (
            <p className="text-sm text-muted">Loading tasks…</p>
          ) : (
            <>
              <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 pt-1 [scrollbar-width:thin]">
                {urgentTasks.length === 0 ? (
                  <div className="min-h-[72px] min-w-[120px] shrink-0 rounded-btn border border-dashed border-mission-line/80 px-3 py-2 text-[11px] text-muted">
                    Nothing urgent
                  </div>
                ) : (
                  urgentTasks.map((t) => {
                    const overdue = isOverdue(t.dueDate, todayStr);
                    const dOver = overdue ? daysOverdue(t.dueDate, todayStr) : 0;
                    const sub = overdue
                      ? `${dOver} day${dOver === 1 ? '' : 's'} overdue`
                      : 'Due today';
                    return (
                      <div
                        key={t.id}
                        className={`w-[min(260px,78vw)] shrink-0 rounded-btn px-3 py-3 ${
                          overdue
                            ? 'text-surface'
                            : 'border border-border bg-surface text-ink'
                        }`}
                        style={overdue ? { backgroundColor: '#111111' } : undefined}
                      >
                        <div className="flex items-start gap-2.5">
                          <TaskCompleteCircle
                            variant={overdue ? 'onDark' : 'onLight'}
                            ariaLabel={`Complete ${t.title}`}
                            onComplete={() => void completeTask(t)}
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-medium leading-snug ${overdue ? 'text-surface' : 'text-ink'}`}>
                              {t.title}
                            </p>
                            <p
                              className={`mt-1 text-[11px] leading-snug ${
                                overdue ? 'text-white/75' : 'text-muted'
                              }`}
                            >
                              {sub}
                              {t.contactId ? ` · ${contactNameById.get(t.contactId) || 'Contact'}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {upcomingTasks.length > 0 ? (
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Upcoming · {upcomingTasks.length}
                  </p>
                  <ul className="mt-2 divide-y divide-border/60">
                    {upcomingTasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 py-2.5 first:pt-0">
                        <TaskCompleteCircle
                          variant="onLight"
                          ariaLabel={`Complete ${t.title}`}
                          onComplete={() => void completeTask(t)}
                        />
                        <p className="min-w-0 flex-1 text-[12px] leading-snug text-muted">{t.title}</p>
                        <span className="shrink-0 text-right text-[11px] tabular-nums text-muted">
                          {t.dueDate ? formatDate(t.dueDate) : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          )}
        </div>

        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 border-t border-border px-4 py-3 text-left text-[12px] font-medium text-muted hover:bg-surface"
          onClick={() => setAddTaskOpen(true)}
        >
          <span className="text-base leading-none text-muted" aria-hidden>
            +
          </span>
          <span>Add a task</span>
        </button>
      </div>

      <Modal
        open={addTaskOpen}
        title="Add task"
        onClose={() => {
          if (!addTaskSaving) {
            setAddTaskOpen(false);
            resetAddTaskForm();
          }
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={addTaskSaving}
              onClick={() => {
                setAddTaskOpen(false);
                resetAddTaskForm();
              }}
            >
              Cancel
            </Button>
            <Button type="button" disabled={addTaskSaving} onClick={() => void saveNewTask()}>
              {addTaskSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        {addTaskError ? <p className="mb-3 text-sm text-red-600">{addTaskError}</p> : null}
        <label className="block">
          <span className="text-xs font-semibold text-neutral-600">Title</span>
          <Input
            value={addTaskTitle}
            onChange={(e) => setAddTaskTitle(e.target.value)}
            className="mt-1"
            placeholder="What needs to happen?"
          />
        </label>
        <label className="mt-4 block">
          <span className="text-xs font-semibold text-neutral-600">Due date (optional)</span>
          <Input type="date" value={addTaskDue} onChange={(e) => setAddTaskDue(e.target.value)} className="mt-1" />
        </label>
        <div className="mt-4">
          <span className="text-xs font-semibold text-neutral-600">Contact (optional)</span>
          <Input
            value={contactPickQuery}
            onChange={(e) => setContactPickQuery(e.target.value)}
            placeholder="Search contacts…"
            className="mt-1"
          />
          {addTaskContactId ? (
            <p className="mt-2 text-xs text-neutral-600">
              Selected:{' '}
              <span className="font-medium text-ink">{contactNameById.get(addTaskContactId) || 'Contact'}</span>{' '}
              <button
                type="button"
                className="font-semibold text-mission-ink hover:underline"
                onClick={() => setAddTaskContactId('')}
              >
                Clear
              </button>
            </p>
          ) : null}
          {!addTaskContactId && contactPickQuery.trim() ? (
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
                        setAddTaskContactId(c.id);
                        setContactPickQuery('');
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
      </Modal>

      {circleBackSoon.length > 0 ? (
        <div
          className="overflow-hidden rounded-card border border-[#E8E0F0] bg-[#F5F0FF]"
          style={{ borderBottom: '0.5px solid #E8E0F0' }}
        >
          <div className="px-4 py-2.5">
            <p className="text-[11px] font-medium text-[#6040B0]">
              {circleBackSoon.length} contact{circleBackSoon.length > 1 ? 's' : ''} ready to circle back
            </p>
            <ul className="mt-1.5">
              {circleBackSoon.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => openDrawer(c)}
                    className="flex w-full cursor-pointer items-center gap-2 py-1 text-left"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#6040B0]" aria-hidden />
                    <span className="truncate text-xs text-[#1A1A1A]">{c.fullName || 'Unnamed'}</span>
                    <span className="ml-auto shrink-0 text-[10px] text-neutral-500">
                      {new Date(`${c.followUpDate}T12:00:00`).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <MissionaryPipelineSection
        pipelineInProgressCount={pipelineInProgressCount}
        pipelineLoading={pipelineLoading}
        onOpenPipeline={() => setShowPipeline(true)}
      />

      <MissionaryFullscreenOverlay
        open={showPipeline}
        title="Pipeline"
        subtitle={
          pipelineInProgressCount === 1
            ? '1 contact in progress'
            : `${pipelineInProgressCount} contacts in progress`
        }
        onClose={() => setShowPipeline(false)}
      >
        <MissionaryPipeline embedded />
      </MissionaryFullscreenOverlay>

      <MissionaryFullscreenOverlay
        open={showStats}
        title="Stats"
        subtitle="Progress toward your goals"
        onClose={() => setShowStats(false)}
      >
        <MissionaryStats embedded />
      </MissionaryFullscreenOverlay>

      <div className="flex justify-center pb-2">
        <button
          type="button"
          onClick={() => setShowStats(true)}
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#888] transition-colors hover:text-ink"
        >
          View full stats →
        </button>
      </div>

      {user?.id ? <MissionPushSection missionaryId={user.id} /> : null}

      <Card className="p-5">
        <p className="text-sm font-semibold text-ink">Supporter prayer requests</p>
        <p className="mt-1 text-xs text-neutral-500">Requests shared by supporters on their prayer wall.</p>
        <div className="mt-4">
          {prayerLoading ? (
            <p className="text-sm text-neutral-500">Loading prayer wall…</p>
          ) : prayer.length === 0 ? (
            <EmptyState
              icon="sparkles"
              title="No prayer requests yet"
              subtitle="When supporters share requests on their prayer wall, they’ll land here for you."
            />
          ) : (
            <div className="space-y-3">
              {prayer.map((r) => (
                <Card key={r.id} className="border-neutral-100 p-4 shadow-none">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-neutral-800">{r.body}</p>
                      <p className="mt-2 text-xs font-medium text-neutral-600">{prayerAttributionLabel(r)}</p>
                      <p className="mt-1 text-xs text-neutral-500">{(r.prayedCount ?? 0).toString()} prayers</p>
                    </div>
                    <MissionaryPrayerRequestMenu
                      open={openPrayerRequestMenuId === r.id}
                      onOpenChange={(next) => setOpenPrayerRequestMenuId(next ? r.id : null)}
                      onDelete={() => {
                        if (prayerBusyId) return;
                        void deleteMissionaryPrayer(r.id);
                      }}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>

    </div>
    </MissionaryPageShell>
  );
}

