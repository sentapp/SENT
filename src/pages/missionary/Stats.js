import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { supabase } from '../../lib/supabaseClient';
import {
  computePartnerCurrencyTotals,
  normalizeCurrencyCode,
} from '../../lib/currencies';
import { Button, LoadingSpinner } from '../../components/ui';
import DarkPageHeader from '../../components/DarkPageHeader';
import MissionaryPageShell from '../../components/MissionaryPageShell';
import { initialsFromDisplayName } from '../../lib/profileAppearance';

const JOIN_BASE = 'https://sent-kohl.vercel.app/join';

const DAILY_GOAL = 16;
const GOALS = {
  contacts: 300,
  outreach: 1200,
  monthlySupport: 3000,
  partners: 34,
};

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function logLocalDate(createdAt) {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  return localDateStr(d);
}

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(localDateStr(d));
  }
  return days;
}

function normMatchKey(s) {
  return String(s ?? '').trim().toLowerCase();
}

function accountMatchesContact(account, contact) {
  const accEmail = normMatchKey(account.email);
  const accName = normMatchKey(account.full_name);
  const cEmail = normMatchKey(contact.email);
  const cName = normMatchKey(contact.fullName);
  if (accEmail && cEmail && accEmail === cEmail) return true;
  if (accName && cName && (accName.startsWith(cName) || cName.startsWith(accName))) return true;
  return false;
}

function pctConnected(current, total) {
  if (!total || total <= 0) return 0;
  return Math.min(Math.round((current / total) * 100), 100);
}

const goalIcons = {
  contacts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  outreach: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  ),
  monthlySupport: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  partners: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
};

export default function MissionaryStats({ embedded = false }) {
  const { user, profile, loading: authLoading } = useAuth();
  const { contacts, loading: contactsLoading } = useSupabaseContacts(user?.id, { authLoading });
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [supporterAccounts, setSupporterAccounts] = useState([]);
  const [contactsWithAccounts, setContactsWithAccounts] = useState(0);
  const [supportersLoading, setSupportersLoading] = useState(true);
  const [codeCopied, setCodeCopied] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!supabase || !user?.id) {
      setLogs([]);
      setLogsLoading(false);
      return;
    }
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('communication_logs')
      .select('id, created_at')
      .eq('missionary_id', user.id)
      .order('created_at', { ascending: false });
    if (error) console.error('MissionaryStats logs', error);
    setLogs(error ? [] : data || []);
    setLogsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!supabase || !user?.id) {
      setSupporterAccounts([]);
      setContactsWithAccounts(0);
      setSupportersLoading(false);
      return undefined;
    }

    let cancelled = false;
    setSupportersLoading(true);

    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, connected_missionary_id')
        .eq('connected_missionary_id', user.id)
        .eq('role', 'supporter');

      if (cancelled) return;

      if (error) {
        console.error('MissionaryStats supporter accounts', error);
        setSupporterAccounts([]);
        setContactsWithAccounts(0);
        setSupportersLoading(false);
        return;
      }

      const accounts = data || [];
      setSupporterAccounts(accounts);

      const matchedContacts = contacts.filter((c) =>
        accounts.some((a) => accountMatchesContact(a, c)),
      );
      setContactsWithAccounts(matchedContacts.length);
      setSupportersLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, contacts]);

  useEffect(() => {
    if (!codeCopied) return undefined;
    const t = window.setTimeout(() => setCodeCopied(false), 2500);
    return () => window.clearTimeout(t);
  }, [codeCopied]);

  const homeCurrency = normalizeCurrencyCode(profile?.home_currency);
  const partners = useMemo(
    () =>
      contacts.filter(
        (c) => c.category === 'supporter' || c.status === 'partner' || Number(c.monthlyAmount) > 0,
      ),
    [contacts],
  );
  const { homeCurrencyTotal } = useMemo(
    () => computePartnerCurrencyTotals(partners, homeCurrency),
    [partners, homeCurrency],
  );

  const logsByDate = useMemo(() => {
    const map = new Map();
    for (const log of logs) {
      const key = logLocalDate(log.created_at);
      if (!key) continue;
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [logs]);

  const weekDays = useMemo(() => lastNDays(7), []);
  const tableDays = useMemo(() => lastNDays(14), []);
  const weekMax = useMemo(() => {
    let max = 1;
    for (const d of weekDays) {
      max = Math.max(max, logsByDate.get(d) || 0);
    }
    return max;
  }, [weekDays, logsByDate]);

  const goalCards = useMemo(
    () => [
      {
        key: 'contacts',
        label: 'Contacts',
        current: contacts.length,
        goal: GOALS.contacts,
        color: '#EBF5FF',
        textColor: '#0C447C',
        icon: goalIcons.contacts,
      },
      {
        key: 'outreach',
        label: 'Outreach',
        current: logs.length,
        goal: GOALS.outreach,
        color: 'var(--accent-light)',
        textColor: 'var(--accent-dark)',
        icon: goalIcons.outreach,
      },
      {
        key: 'monthlySupport',
        label: 'Monthly support',
        current: homeCurrencyTotal,
        goal: GOALS.monthlySupport,
        color: '#FFF0F5',
        textColor: '#C03060',
        icon: goalIcons.monthlySupport,
        prefix: '$',
        formatValue: (v) => Math.round(v).toLocaleString(),
      },
      {
        key: 'partners',
        label: 'Partners',
        current: partners.length,
        goal: GOALS.partners,
        color: '#FFF8E8',
        textColor: '#906010',
        icon: goalIcons.partners,
      },
    ],
    [contacts.length, logs.length, homeCurrencyTotal, partners.length],
  );

  const supporterCode = String(profile?.supporter_code ?? '').trim();
  const shareLink = supporterCode
    ? `${JOIN_BASE}?code=${encodeURIComponent(supporterCode)}`
    : '';
  const supportersOnSent = supporterAccounts.length;
  const supportersPct = pctConnected(supportersOnSent, partners.length);
  const contactsOnSentPct = pctConnected(contactsWithAccounts, contacts.length);

  const copyInviteLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setCodeCopied(true);
    } catch {
      setCodeCopied(false);
    }
  };

  const loading = authLoading || contactsLoading || logsLoading || supportersLoading;

  const page = (
    <div className={`space-y-6 ${embedded ? '' : 'pb-5 md:pb-8'}`}>
      {!embedded ? (
        <div className="flex justify-end">
          <Link to="/missionary/overview" className="text-sm font-medium text-ink hover:underline">
            ← Overview
          </Link>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {goalCards.map((g) => {
              const pct = g.goal > 0 ? Math.min((g.current / g.goal) * 100, 100) : 0;
              const displayCurrent = g.formatValue ? g.formatValue(g.current) : g.current.toLocaleString();
              const displayGoal = g.formatValue ? g.formatValue(g.goal) : g.goal.toLocaleString();
              return (
                <div
                  key={g.key}
                  className="rounded-[10px] border border-[#EEEEEE] p-3.5"
                  style={{ background: g.color }}
                >
                  <div className="mb-1.5 flex items-center gap-1.5" style={{ color: g.textColor }}>
                    {g.icon}
                    <span className="text-[10px] font-medium uppercase tracking-wider">{g.label}</span>
                  </div>
                  <div className="text-[22px] font-medium tracking-tight text-ink">
                    {g.prefix || ''}
                    {displayCurrent}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    of {g.prefix || ''}
                    {displayGoal} goal
                  </div>
                  <div className="mt-2 h-[3px] rounded-sm bg-black/10">
                    <div
                      className="h-full rounded-sm"
                      style={{ width: `${pct}%`, background: g.textColor }}
                    />
                  </div>
                  <div className="mt-1 text-[10px] font-medium" style={{ color: g.textColor }}>
                    {Math.round(pct)}%
                  </div>
                </div>
              );
            })}
          </div>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-ink">SENT community</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[10px] border border-[#EEEEEE] p-4" style={{ background: '#E8F5EE' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#1A6B40]">
                  Supporters on SENT
                </p>
                <p className="mt-2 font-display text-[36px] leading-none tracking-wide text-ink">
                  {supportersOnSent}
                </p>
                <p className="mt-1 text-[11px] text-muted">of {partners.length} partners</p>
                <div className="mt-3 h-[4px] rounded-sm bg-black/10">
                  <div
                    className="h-full rounded-sm bg-[#1A6B40]"
                    style={{ width: `${supportersPct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] font-medium text-[#1A6B40]">{supportersPct}% connected</p>
              </div>
              <div className="rounded-[10px] border border-[#EEEEEE] p-4" style={{ background: '#EBF5FF' }}>
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#0C447C]">
                  Contacts on SENT
                </p>
                <p className="mt-2 font-display text-[36px] leading-none tracking-wide text-ink">
                  {contactsWithAccounts}
                </p>
                <p className="mt-1 text-[11px] text-muted">of {contacts.length} contacts</p>
                <div className="mt-3 h-[4px] rounded-sm bg-black/10">
                  <div
                    className="h-full rounded-sm bg-[#0C447C]"
                    style={{ width: `${contactsOnSentPct}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[10px] font-medium text-[#0C447C]">{contactsOnSentPct}% connected</p>
              </div>
            </div>

            {supporterAccounts.length > 0 ? (
              <div className="overflow-hidden rounded-card border border-mission-line bg-white">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold text-ink">Who&apos;s on SENT</p>
                </div>
                <ul className="divide-y divide-border/60">
                  {supporterAccounts.map((acc) => {
                    const name = String(acc.full_name ?? '').trim() || 'Supporter';
                    const email = String(acc.email ?? '').trim();
                    return (
                      <li key={acc.id} className="flex items-center gap-3 px-4 py-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green/15 font-display text-sm text-green"
                          aria-hidden
                        >
                          {initialsFromDisplayName(name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-ink">{name}</p>
                          {email ? <p className="truncate text-xs text-muted">{email}</p> : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-green/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-green">
                          Supporter
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="circuit-profile-code">
              <p className="sent-section-label text-white/60">Share your supporter code</p>
              <p className="circuit-profile-code-value">{supporterCode || '—'}</p>
              {supporterCode ? (
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="break-all text-sm text-white/80">{shareLink}</p>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="secondary" onClick={() => void copyInviteLink()}>
                      {codeCopied ? 'Copied!' : 'Copy link'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        if (navigator.share) {
                          try {
                            await navigator.share({
                              title: 'Join me on SENT',
                              text: 'Use my link to connect as a supporter on SENT.',
                              url: shareLink,
                            });
                            return;
                          } catch {
                            // cancelled or unavailable
                          }
                        }
                        await copyInviteLink();
                      }}
                    >
                      Share
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/70">
                  Your supporter code will appear here once it is set in Settings.
                </p>
              )}
            </div>
          </section>

          <div className="overflow-hidden rounded-card border border-mission-line bg-white p-4">
            <p className="text-sm font-semibold text-ink">Weekly outreach</p>
            <p className="mt-0.5 text-xs text-muted">Last 7 days</p>
            <div className="mt-4 flex items-end justify-between gap-2" style={{ minHeight: 120 }}>
              {weekDays.map((d) => {
                const count = logsByDate.get(d) || 0;
                const h = weekMax > 0 ? Math.max(4, Math.round((count / weekMax) * 100)) : 4;
                const label = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' });
                return (
                  <div key={d} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] tabular-nums text-muted">{count}</span>
                    <div
                      className="w-full max-w-[2.5rem] rounded-t-sm bg-green transition-all"
                      style={{ height: `${h}px` }}
                      title={`${count} on ${d}`}
                    />
                    <span className="truncate text-[9px] text-muted">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-mission-line bg-white">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-ink">Daily progress</p>
              <p className="text-xs text-muted">Last 14 days · goal {DAILY_GOAL}/day</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface text-[10px] font-semibold uppercase tracking-wider text-muted">
                    <th className="px-4 py-2">Day</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Outreach</th>
                    <th className="px-4 py-2">Goal</th>
                  </tr>
                </thead>
                <tbody>
                  {[...tableDays].reverse().map((d, idx) => {
                    const count = logsByDate.get(d) || 0;
                    const hit = count >= DAILY_GOAL;
                    const dayNum = tableDays.length - idx;
                    const dateLabel = new Date(`${d}T12:00:00`).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    });
                    return (
                      <tr key={d} className="border-b border-border/60 last:border-b-0">
                        <td className="px-4 py-2.5 tabular-nums text-muted">{dayNum}</td>
                        <td className="px-4 py-2.5 text-ink">{dateLabel}</td>
                        <td className="px-4 py-2.5 font-medium tabular-nums text-ink">{count}</td>
                        <td className="px-4 py-2.5">
                          {hit ? (
                            <span className="text-green" aria-label="Goal hit">
                              ✓
                            </span>
                          ) : (
                            <span className="text-muted" aria-label="Goal missed">
                              ✗
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return embedded ? (
    page
  ) : (
    <MissionaryPageShell header={<DarkPageHeader title="Stats" subtitle="Progress toward your goals" />}>
      {page}
    </MissionaryPageShell>
  );
}
