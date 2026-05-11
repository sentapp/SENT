import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPrayerRequests } from '../../hooks/useMissionaryPrayerRequests';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { useAppState } from '../../state/AppState';
import { Button, Card, EmptyState, Input } from '../../components/ui';

function Metric({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{value}</p>
    </Card>
  );
}

export default function MissionaryOverview() {
  const { profile, user } = useAuth();
  const { contacts } = useSupabaseContacts(user?.id);
  const { prayerRequests: prayer, loading: prayerLoading } = useMissionaryPrayerRequests(user?.id);
  const { state, actions } = useAppState();
  const [newTask, setNewTask] = useState('');

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
  const goal = Number(profile?.monthly_goal ?? state.missionary.profile.monthlyGoal ?? 0) || 0;
  const gap = Math.max(goal - monthlySupport, 0);
  const pct = goal > 0 ? Math.min(100, Math.round((monthlySupport / goal) * 100)) : 0;

  const tasks = state.missionary.tasks;
  const pipeline = state.missionary.pipeline;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="text-sm text-neutral-600">Your ministry at a glance on SENT.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Monthly Support" value={`$${monthlySupport.toFixed(0)}`} />
        <Metric label="Partners" value={`${partners.length}`} />
        <Metric label="Gap to Goal" value={`$${gap.toFixed(0)}`} />
        <Metric label="Total Contacts" value={`${contacts.length}`} />
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
          {pipeline.length === 0 ? (
            <EmptyState title="No active pipeline — start making calls" />
          ) : (
            <div className="space-y-3">
              {pipeline.map((p) => (
                <Card key={p.id} className="p-4">
                  <p className="text-sm font-semibold">{p.title}</p>
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

