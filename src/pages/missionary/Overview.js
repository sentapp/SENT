import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPrayerRequests } from '../../hooks/useMissionaryPrayerRequests';
import { useMissionaryPipelineContacts } from '../../hooks/useMissionaryPipelineContacts';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { useAppState } from '../../state/AppState';
import { supabase } from '../../lib/supabaseClient';
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
      className={`relative cursor-pointer overflow-hidden transition-colors duration-200 ease-out hover:bg-mission-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-blue/25 ${tint}`}
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

export default function MissionaryOverview() {
  const navigate = useNavigate();
  const { profile, user, loading: authLoading } = useAuth();
  const { contacts, refetch: refetchContacts } = useSupabaseContacts(user?.id, {
    authLoading,
  });
  const { pipelineContacts, pipelineLoading, updatePipelineContactStatus } = useMissionaryPipelineContacts(
    user?.id,
    { authLoading, onAfterMutation: () => void refetchContacts() },
  );
  const { prayerRequests: prayer, loading: prayerLoading } = useMissionaryPrayerRequests(user?.id);
  const { state, actions } = useAppState();
  const [newTask, setNewTask] = useState('');
  const [pipelineSavingId, setPipelineSavingId] = useState(null);
  const [pipelineError, setPipelineError] = useState('');
  const taskInputRef = useRef(null);
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

  const tasks = state.missionary.tasks;

  const changePipelineStatus = async (contact, nextStatus) => {
    if (!contact?.id || nextStatus === contact.status) return;
    setPipelineError('');
    setPipelineSavingId(contact.id);
    const res = await updatePipelineContactStatus(contact.id, nextStatus);
    setPipelineSavingId(null);
    if (!res.ok) setPipelineError(res.error || 'Could not update status.');
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
          tint="bg-mission-blue/[0.07]"
          Icon={<span className="text-mission-blue">{metricIconPeople}</span>}
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
            <p className="mt-1 text-xs text-neutral-500">
              {goal > 0 ? `$${monthlySupport.toFixed(0)} of $${goal.toFixed(0)}` : 'Set your monthly goal in Settings'}
            </p>
          </div>
          <p className="text-sm font-semibold text-mission-blue">{pct}%</p>
        </div>
        <div className="mt-4 h-3 w-full rounded-full bg-neutral-200">
          <div className="h-3 rounded-full bg-mission-blue" style={{ width: `${pct}%` }} />
        </div>
      </Card>

      <MissionaryPipelineSection
        pipelineContacts={pipelineContacts}
        pipelineLoading={pipelineLoading}
        pipelineError={pipelineError}
        pipelineSavingId={pipelineSavingId}
        onChangeStatus={changePipelineStatus}
      />

      {user?.id ? <MissionPushSection missionaryId={user.id} /> : null}

      <Modal open={oneTimeModalOpen} title="One-time gifts" onClose={() => setOneTimeModalOpen(false)}>
        <p className="text-base font-semibold text-neutral-900">
          Total one-time gifts:{' '}
          <span className="text-mission-blue">${oneTimeModalTotal.toFixed(2)}</span>
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
                <span className="font-medium text-neutral-900">{r.full_name || 'Unnamed'}</span>
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
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">This week’s tasks</p>
            <p className="mt-1 text-xs text-neutral-500">Empty by default — add what matters this week.</p>
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <Input
              ref={taskInputRef}
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a task…"
              className="py-2.5 text-sm md:w-[320px]"
            />
            <Button
              type="button"
              variant="accent"
              onClick={() => {
                actions.addTask(newTask);
                setNewTask('');
              }}
            >
              Add
            </Button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="mt-5">
            <EmptyState
              icon="clipboard"
              title="Nothing on your list yet"
              subtitle="Add a few concrete tasks for this week — small steps keep momentum."
              action={
                <Button type="button" variant="accent" onClick={() => taskInputRef.current?.focus()}>
                  Add a task
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-5 space-y-2">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 rounded-btn border border-neutral-200 px-4 py-3">
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(t.done)}
                    onChange={() => actions.toggleTask(t.id)}
                    className="h-4 w-4 accent-[color:var(--color-accent)]"
                  />
                  <span className={`text-sm ${t.done ? 'text-neutral-400 line-through' : 'text-neutral-800'}`}>
                    {t.text}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => actions.deleteTask(t.id)}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-800"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold text-neutral-900">Supporter prayer requests</p>
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
                  <p className="text-sm text-neutral-800">{r.body}</p>
                  <p className="mt-2 text-xs text-neutral-500">{(r.prayedCount ?? 0).toString()} prayers</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

