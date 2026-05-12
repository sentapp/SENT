import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPrayerRequests } from '../../hooks/useMissionaryPrayerRequests';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { useAppState } from '../../state/AppState';
import MissionPushSection from '../../components/MissionPushSection';
import { CONTACT_STATUS_FORM_OPTIONS, statusLabel } from '../../lib/contactStatuses';
import { Button, Card, EmptyState, Input } from '../../components/ui';

const FOLLOW_UP_STATUSES = new Set(['asked', 'contacted', 'meeting_scheduled']);

function contactPayloadForUpdate(c) {
  return {
    fullName: c.fullName,
    phone: c.phone,
    email: c.email,
    address: c.address,
    category: c.category,
    status: c.status,
    monthlyAmount: c.monthlyAmount,
    notes: c.notes,
    isOneTimeDonor: c.isOneTimeDonor,
    oneTimeDonationAmount: c.oneTimeDonationAmount,
    oneTimeDonationDate: c.oneTimeDonationDate,
  };
}

function MetricCard({ label, value, onActivate, ariaLabel }) {
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
      className="cursor-pointer p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mission-blue/30"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
    </Card>
  );
}

export default function MissionaryOverview() {
  const navigate = useNavigate();
  const { profile, user, loading: authLoading } = useAuth();
  const { contacts, updateContact, loading: contactsLoading } = useSupabaseContacts(user?.id, { authLoading });
  const { prayerRequests: prayer, loading: prayerLoading } = useMissionaryPrayerRequests(user?.id);
  const { state, actions } = useAppState();
  const [newTask, setNewTask] = useState('');
  const [pipelineSavingId, setPipelineSavingId] = useState(null);
  const [pipelineError, setPipelineError] = useState('');

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
  const recentOneTimeDonors = useMemo(() => {
    return [...oneTimeDonors]
      .sort((a, b) => {
        const da = a.oneTimeDonationDate || '';
        const db = b.oneTimeDonationDate || '';
        if (db !== da) return db.localeCompare(da);
        return (a.fullName || '').localeCompare(b.fullName || '');
      })
      .slice(0, 12);
  }, [oneTimeDonors]);

  const goal = Number(profile?.monthly_goal ?? state.missionary.profile.monthlyGoal ?? 0) || 0;
  const gap = Math.max(goal - monthlySupport, 0);
  const pct = goal > 0 ? Math.min(100, Math.round((monthlySupport / goal) * 100)) : 0;

  const tasks = state.missionary.tasks;

  const pipelineContacts = useMemo(
    () =>
      [...contacts]
        .filter((c) => FOLLOW_UP_STATUSES.has(c.status))
        .sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return tb - ta;
        })
        .slice(0, 10),
    [contacts],
  );

  const changePipelineStatus = async (contact, nextStatus) => {
    if (!contact?.id || nextStatus === contact.status) return;
    setPipelineError('');
    setPipelineSavingId(contact.id);
    const res = await updateContact(contact.id, {
      ...contactPayloadForUpdate(contact),
      status: nextStatus,
    });
    setPipelineSavingId(null);
    if (!res.ok) setPipelineError(res.error || 'Could not update status.');
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-neutral-600">Your ministry at a glance on SENT.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard
          label="Monthly Support"
          value={`$${monthlySupport.toFixed(0)}`}
          ariaLabel="Monthly support — open partners"
          onActivate={() => navigate('/missionary/partners')}
        />
        <MetricCard
          label="One-time gifts"
          value={`$${totalOneTimeGifts.toFixed(0)}`}
          ariaLabel="One-time gifts — open one-time donors on contacts"
          onActivate={() => navigate('/missionary/contacts?filter=one_time')}
        />
        <MetricCard
          label="Partners"
          value={`${partners.length}`}
          ariaLabel="Partners — open partners list"
          onActivate={() => navigate('/missionary/partners')}
        />
        <MetricCard
          label="Gap to Goal"
          value={`$${gap.toFixed(0)}`}
          ariaLabel="Gap to goal — open partners"
          onActivate={() => navigate('/missionary/partners')}
        />
        <MetricCard
          label="Total Contacts"
          value={`${contacts.length}`}
          ariaLabel="Total contacts — open contacts"
          onActivate={() => navigate('/missionary/contacts')}
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

      {user?.id ? <MissionPushSection missionaryId={user.id} /> : null}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">One-time gifts</p>
            <p className="mt-1 text-xs text-neutral-500">
              Separate from recurring monthly support — track single gifts here.
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Total received</p>
            <p className="text-2xl font-semibold tracking-tight text-neutral-900">${totalOneTimeGifts.toFixed(2)}</p>
          </div>
        </div>

        {recentOneTimeDonors.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">
            No one-time donors yet — mark contacts as one-time donors on the Contacts tab.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100 rounded-card border border-neutral-200">
            {recentOneTimeDonors.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span className="font-medium text-neutral-900">{c.fullName || 'Unnamed'}</span>
                <span className="shrink-0 font-semibold text-neutral-800">
                  ${Number(c.oneTimeDonationAmount || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                  {c.oneTimeDonationDate ? (
                    <span className="ml-2 font-normal text-neutral-500">
                      ·{' '}
                      {new Date(`${c.oneTimeDonationDate}T12:00:00`).toLocaleDateString()}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-neutral-900">Supporter prayer requests</p>
          {prayerLoading ? (
            <p className="text-sm text-neutral-500">Loading prayer wall…</p>
          ) : prayer.length === 0 ? (
            <EmptyState title="No prayer requests yet — be the first to submit one" />
          ) : (
            <div className="space-y-3">
              {prayer.map((r) => (
                <Card key={r.id} className="p-4">
                  <p className="text-sm text-neutral-800">{r.body}</p>
                  <p className="mt-2 text-xs text-neutral-500">{(r.prayedCount ?? 0).toString()} prayers</p>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-neutral-900">Pipeline</p>
          <p className="text-xs text-neutral-500">Contacts in asked, contacted, or meeting scheduled — newest first.</p>
          {pipelineError ? <p className="text-xs font-medium text-red-600">{pipelineError}</p> : null}
          {contactsLoading ? (
            <p className="text-sm text-neutral-500">Loading contacts…</p>
          ) : pipelineContacts.length === 0 ? (
            <EmptyState title="No contacts need follow-up right now" subtitle="Statuses Asked, Contacted, and Meeting scheduled appear here." />
          ) : (
            <div className="space-y-3">
              {pipelineContacts.map((c) => (
                <Card key={c.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-semibold text-neutral-900">{c.fullName || 'Unnamed'}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold text-neutral-700">
                          {statusLabel(c.status)}
                        </span>
                        {Number(c.monthlyAmount) > 0 ? (
                          <span className="text-xs font-medium text-neutral-600">
                            ${Number(c.monthlyAmount).toFixed(0)}/mo
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <label className="shrink-0 text-xs font-medium text-neutral-600">
                      <span className="sr-only">Update status for {c.fullName || 'contact'}</span>
                      <select
                        className="mt-0.5 max-w-[200px] rounded-btn border border-neutral-200 bg-white py-2 pl-2 pr-8 text-sm font-semibold text-neutral-800"
                        value={c.status}
                        disabled={pipelineSavingId === c.id}
                        onChange={(e) => void changePipelineStatus(c, e.target.value)}
                      >
                        {CONTACT_STATUS_FORM_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">This week’s tasks</p>
            <p className="mt-1 text-xs text-neutral-500">Empty by default — add what matters this week.</p>
          </div>
          <div className="flex w-full gap-2 md:w-auto">
            <Input
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Add a task…"
              className="py-2.5 text-sm md:w-[320px]"
            />
            <Button
              type="button"
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
            <EmptyState title="Tasks: empty checklist" />
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
                    className="h-4 w-4 accent-[#185FA5]"
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
    </div>
  );
}

