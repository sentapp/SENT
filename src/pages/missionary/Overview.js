import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deletePrayerRequestAsMissionary, prayerAttributionLabel } from '../../lib/prayerRequestsRepository';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPrayerRequests } from '../../hooks/useMissionaryPrayerRequests';
import { useMissionaryPipelineContacts } from '../../hooks/useMissionaryPipelineContacts';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { useMissionaryTasks } from '../../hooks/useMissionaryTasks';
import { useAppState } from '../../state/AppState';
import { supabase } from '../../lib/supabaseClient';
import { createTask } from '../../lib/tasksRepository';
import { daysOverdue, formatDate, isDueToday, isOverdue } from '../../lib/taskDateHelpers';
import MissionPushSection from '../../components/MissionPushSection';
import MissionaryPipelineSection from '../../components/MissionaryPipelineSection';
import { Button, Card, EmptyState, Input, Modal } from '../../components/ui';

function MetricCard({ label, value, onActivate, ariaLabel, tint, Icon }) {
  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={ariaLabel || label}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate?.();
        }
      }}
      className={`relative cursor-pointer overflow-hidden transition-colors duration-200 ease-out hover:bg-mission-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-ink/20 ${tint}`}
    >
      <div className="pointer-events-none absolute right-4 top-4 opacity-95 [&>svg]:h-6 [&>svg]:w-6">{Icon}</div>
      <p className="sent-section-label relative max-w-[70%]">{label}</p>
      <p className="sent-metric relative mt-2">{value}</p>
    </Card>
  );
}

const metricIconMonthly = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
  </svg>
);
const metricIconGift = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
  </svg>
);
const metricIconPeople = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const metricIconTarget = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);
const metricIconBook = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);

function MissionaryPrayerRequestMenu({ onDelete }) {
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
        className="rounded-btn px-2 py-1 text-lg leading-none text-neutral-600 hover:bg-neutral-100"
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

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  const navigate = useNavigate();
  const { profile, user, loading: authLoading } = useAuth();
  const { contacts, refetch: refetchContacts } = useSupabaseContacts(user?.id, {
    authLoading,
  });
  const { pipelineContacts, pipelineInProgressCount, pipelineLoading } = useMissionaryPipelineContacts(
    user?.id,
    { authLoading, onAfterMutation: () => void refetchContacts() },
  );
  const { prayerRequests: prayer, loading: prayerLoading, refetch: refetchPrayer } = useMissionaryPrayerRequests(user?.id);
  const { state } = useAppState();
  const { tasks, loading: tasksLoading, refetch: refetchTasks, completeTask } = useMissionaryTasks(user?.id);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskTitle, setAddTaskTitle] = useState('');
  const [addTaskContactId, setAddTaskContactId] = useState('');
  const [addTaskDue, setAddTaskDue] = useState('');
  const [addTaskSaving, setAddTaskSaving] = useState(false);
  const [addTaskError, setAddTaskError] = useState('');
  const [contactPickQuery, setContactPickQuery] = useState('');
  const [prayerBusyId, setPrayerBusyId] = useState(null);

  const deleteMissionaryPrayer = useCallback(
    async (id) => {
      if (!supabase || !user?.id) return;
      if (!window.confirm('Delete this prayer request from your wall?')) return;
      setPrayerBusyId(id);
      const { error } = await deletePrayerRequestAsMissionary(supabase, id, user.id);
      setPrayerBusyId(null);
      if (error) {
        console.error(error);
        return;
      }
      void refetchPrayer();
    },
    [user?.id, refetchPrayer],
  );
  const [oneTimeModalOpen, setOneTimeModalOpen] = useState(false);
  const [oneTimeModalRows, setOneTimeModalRows] = useState([]);
  const [oneTimeModalLoading, setOneTimeModalLoading] = useState(false);

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
  const monthlySupport = useMemo(
    () => partners.reduce((sum, p) => sum + (Number(p.monthlyAmount) || 0), 0),
    [partners],
  );

  const oneTimeDonors = useMemo(() => contacts.filter((c) => c.isOneTimeDonor), [contacts]);
  const totalOneTimeGifts = useMemo(
    () => oneTimeDonors.reduce((sum, c) => sum + (Number(c.oneTimeDonationAmount) || 0), 0),
    [oneTimeDonors],
  );

  const oneTimeModalTotal = useMemo(
    () => oneTimeModalRows.reduce((sum, r) => sum + (Number(r.one_time_donation_amount) || 0), 0),
    [oneTimeModalRows],
  );

  useEffect(() => {
    if (!oneTimeModalOpen || !user?.id) return undefined;
    let cancelled = false;
    const fallbackRows = () =>
      oneTimeDonors.map((c) => ({
        id: c.id,
        full_name: c.fullName,
        one_time_donation_amount: c.oneTimeDonationAmount,
        one_time_donation_date: c.oneTimeDonationDate || null,
      }));

    if (!supabase) {
      setOneTimeModalRows(fallbackRows());
      setOneTimeModalLoading(false);
      return undefined;
    }

    setOneTimeModalLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, one_time_donation_amount, one_time_donation_date')
        .eq('missionary_id', user.id)
        .eq('is_one_time_donor', true)
        .order('one_time_donation_date', { ascending: false });
      if (cancelled) return;
      if (error) {
        setOneTimeModalRows(fallbackRows());
      } else {
        setOneTimeModalRows(data || []);
      }
      setOneTimeModalLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [oneTimeModalOpen, user?.id, oneTimeDonors]);

  const goal = Number(profile?.monthly_goal ?? state.missionary.profile.monthlyGoal ?? 0) || 0;
  const gap = Math.max(goal - monthlySupport, 0);
  const pct = goal > 0 ? Math.min(100, Math.round((monthlySupport / goal) * 100)) : 0;

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
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="sent-page-title">Overview</h1>
        <p className="sent-body text-mission-muted">Your ministry at a glance on SENT.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard
          label="Monthly Support"
          value={`$${monthlySupport.toFixed(0)}`}
          ariaLabel="Monthly support — open partners"
          onActivate={() => navigate('/missionary/partners')}
          tint="bg-mission-green/[0.07]"
          Icon={<span className="text-[color:var(--color-success)]">{metricIconMonthly}</span>}
        />
        <MetricCard
          label="One-time gifts"
          value={`$${totalOneTimeGifts.toFixed(0)}`}
          ariaLabel="One-time gifts — open details"
          onActivate={() => setOneTimeModalOpen(true)}
          tint="bg-amber-500/[0.08]"
          Icon={<span className="text-amber-700">{metricIconGift}</span>}
        />
        <MetricCard
          label="Partners"
          value={`${partners.length}`}
          ariaLabel="Partners — open partners list"
          onActivate={() => navigate('/missionary/partners')}
          tint="bg-mission-ink/[0.06]"
          Icon={<span className="text-mission-ink">{metricIconPeople}</span>}
        />
        <MetricCard
          label="Gap to Goal"
          value={`$${gap.toFixed(0)}`}
          ariaLabel="Gap to goal — open partners"
          onActivate={() => navigate('/missionary/partners')}
          tint="bg-rose-500/[0.07]"
          Icon={<span className="text-rose-600">{metricIconTarget}</span>}
        />
        <MetricCard
          label="Total Contacts"
          value={`${contacts.length}`}
          ariaLabel="Total contacts — open contacts"
          onActivate={() => navigate('/missionary/contacts')}
          tint="bg-neutral-500/[0.08]"
          Icon={<span className="text-neutral-600">{metricIconBook}</span>}
        />
      </div>

      <Card className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Funding progress</p>
            <p className="mt-1 text-xs text-muted">
              {goal > 0 ? `$${monthlySupport.toFixed(0)} of $${goal.toFixed(0)}` : 'Set your monthly goal in Settings'}
            </p>
          </div>
          <p className="text-sm font-semibold text-mission-ink">{pct}%</p>
        </div>
        <div className="mt-4 h-[2px] w-full rounded-none bg-[#E2DAD0]">
          <div className="h-[2px] rounded-none bg-[#181208]" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <div className="overflow-hidden rounded-card border border-mission-line bg-surface">
        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ backgroundColor: '#F2EDE4', borderBottom: '1px solid #E2DAD0' }}
        >
          <p
            className="font-semibold uppercase text-muted"
            style={{ fontSize: 9, letterSpacing: '0.12em' }}
          >
            Tasks
          </p>
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
                            : 'border border-[#E2DAD0] bg-surface text-ink'
                        }`}
                        style={overdue ? { backgroundColor: '#181208' } : undefined}
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
                  <ul className="mt-2 divide-y divide-[#E2DAD0]/60">
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
          className="flex w-full items-center justify-center gap-2 px-4 py-3 text-left text-[12px] font-medium text-muted hover:bg-[#F9F7F2]"
          style={{ borderTop: '1px solid #F0EAE0' }}
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

      <MissionaryPipelineSection
        pipelineContacts={pipelineContacts}
        pipelineInProgressCount={pipelineInProgressCount}
        pipelineLoading={pipelineLoading}
      />

      {user?.id ? <MissionPushSection missionaryId={user.id} /> : null}

      <Modal open={oneTimeModalOpen} title="One-time gifts" onClose={() => setOneTimeModalOpen(false)}>
        <p className="text-base font-semibold text-ink">
          Total one-time gifts:{' '}
          <span className="text-mission-ink">${oneTimeModalTotal.toFixed(2)}</span>
        </p>
        {oneTimeModalLoading ? (
          <p className="mt-4 text-sm text-neutral-500">Loading…</p>
        ) : oneTimeModalRows.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-600">
            No one-time gifts yet — mark a contact as a one-time donor in Contacts
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100 rounded-card border border-neutral-200">
            {oneTimeModalRows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <span className="font-medium text-ink">{r.full_name || 'Unnamed'}</span>
                <span className="shrink-0 text-right font-semibold text-neutral-800">
                  $
                  {Number(r.one_time_donation_amount || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                  {r.one_time_donation_date ? (
                    <span className="ml-2 block font-normal text-neutral-500 sm:ml-2 sm:inline">
                      · {new Date(`${String(r.one_time_donation_date).slice(0, 10)}T12:00:00`).toLocaleDateString()}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Modal>

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
  );
}

