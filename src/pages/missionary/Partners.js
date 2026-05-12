import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { supabase } from '../../lib/supabaseClient';
import { categoryLabel } from '../../lib/contactCategories';
import { Button, Card, EmptyState, Modal, Textarea } from '../../components/ui';

const COMM_TYPE_LABEL = {
  call: 'Call',
  text: 'Text',
  update: 'Update',
  prayer: 'Prayer',
  note: 'Note',
  email: 'Email',
  meeting: 'Meeting',
};

const QUICK_LOG_TYPES = ['call', 'text', 'email', 'meeting', 'note'];

const PAGE_SIZE = 1000;

/** Days since last contact; never contacted → large sentinel. */
function daysSince(isoOrNull) {
  if (!isoOrNull) return 999;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return 999;
  const diffMs = Date.now() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function Tabs({ tab, setTab }) {
  const tabs = ['Message', 'Prayer', 'Notes'];
  return (
    <div className="flex gap-2">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          className={`rounded-btn px-3 py-2 text-sm font-medium ${
            tab === t ? 'bg-mission-blue/10 text-mission-blue ring-1 ring-mission-blue/20' : 'text-mission-muted hover:bg-neutral-100'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function logMatchesTab(log, tab) {
  if (tab === 'Prayer') return log.comm_type === 'prayer';
  if (tab === 'Notes') return log.comm_type === 'note';
  return (
    log.comm_type === 'call' ||
    log.comm_type === 'text' ||
    log.comm_type === 'update' ||
    log.comm_type === 'email' ||
    log.comm_type === 'meeting'
  );
}

function partnerInitials(fullName) {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMonthly(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(0)}/mo` : '$0/mo';
}

function lastContactBadgeMeta(lastIso) {
  const d = lastIso ? daysSince(lastIso) : 999;
  if (!lastIso) {
    return { label: 'Never', className: 'text-[#A32D2D] font-semibold' };
  }
  const ms = Date.now() - new Date(lastIso).getTime();
  if (ms >= 0 && ms < 60 * 60 * 1000) {
    return { label: 'Just now', className: 'text-emerald-700 font-semibold' };
  }
  if (d >= 30) {
    return { label: `${d} days`, className: 'text-[#A32D2D] font-medium' };
  }
  if (d >= 14) {
    return { label: `${d} days`, className: 'text-[#854F0B] font-medium' };
  }
  if (d >= 7) {
    return { label: `${d} days`, className: 'text-neutral-500 font-medium' };
  }
  return { label: d <= 1 ? (d === 0 ? 'Today' : '1 day') : `${d} days`, className: 'text-emerald-700 font-medium' };
}

export default function MissionaryPartners() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { contacts } = useSupabaseContacts(user?.id, { authLoading });
  const [selectedId, setSelectedId] = useState(null);
  const [tab, setTab] = useState('Message');
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [commModal, setCommModal] = useState(null);
  const [commNotes, setCommNotes] = useState('');
  const [commSaving, setCommSaving] = useState(false);
  const [commError, setCommError] = useState('');

  const [lastContactById, setLastContactById] = useState({});
  const [lastContactLoading, setLastContactLoading] = useState(false);

  const [quickLog, setQuickLog] = useState(null);
  const [quickType, setQuickType] = useState('call');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');

  const partners = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.category === 'supporter' ||
        c.status === 'partner' ||
        Number(c.monthlyAmount) > 0,
    );
  }, [contacts]);

  const selected = partners.find((p) => p.id === selectedId) || null;

  const loadLastContacts = useCallback(async () => {
    if (!supabase || !user?.id || partners.length === 0) {
      setLastContactById({});
      return;
    }
    setLastContactLoading(true);
    const map = {};
    let from = 0;
    try {
      while (true) {
        const { data, error } = await supabase
          .from('communication_logs')
          .select('contact_id, created_at')
          .eq('missionary_id', user.id)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE_SIZE - 1);
        if (error) {
          console.error(error);
          break;
        }
        if (!data?.length) break;
        for (const row of data) {
          if (map[row.contact_id] === undefined) {
            map[row.contact_id] = row.created_at;
          }
        }
        from += PAGE_SIZE;
        if (data.length < PAGE_SIZE) break;
      }
      setLastContactById(map);
    } finally {
      setLastContactLoading(false);
    }
  }, [user?.id, partners.length]);

  useEffect(() => {
    void loadLastContacts();
  }, [loadLastContacts]);

  const needsTouchpoint = useMemo(() => {
    const withDays = partners.map((p) => {
      const last = lastContactById[p.id] ?? null;
      return { partner: p, days: daysSince(last), last };
    });
    return withDays
      .filter((x) => x.days >= 14)
      .sort((a, b) => b.days - a.days)
      .map((x) => x.partner);
  }, [partners, lastContactById]);

  const touchpointCount = needsTouchpoint.length;

  const sortedPartners = useMemo(() => {
    return [...partners].sort((a, b) => {
      const da = daysSince(lastContactById[a.id] ?? null);
      const db = daysSince(lastContactById[b.id] ?? null);
      return db - da;
    });
  }, [partners, lastContactById]);

  const loadLogs = useCallback(async () => {
    if (!supabase || !selected?.id) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('contact_id', selected.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setLogsLoading(false);
    if (error) {
      setLogs([]);
      return;
    }
    setLogs(data || []);
  }, [selected?.id]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => logs.filter((l) => logMatchesTab(l, tab)), [logs, tab]);

  const mergeLastContact = useCallback((contactId, createdAt) => {
    setLastContactById((prev) => {
      const prevAt = prev[contactId];
      if (!prevAt || new Date(createdAt) > new Date(prevAt)) {
        return { ...prev, [contactId]: createdAt };
      }
      return prev;
    });
  }, []);

  const submitCommLog = async () => {
    if (!supabase || !user?.id || !selected?.id || !commModal) return;
    setCommError('');
    setCommSaving(true);
    const notes = commNotes.trim();
    const row = {
      missionary_id: user.id,
      contact_id: selected.id,
      comm_type: commModal,
      notes,
      created_at: new Date().toISOString(),
    };
    try {
      const { data, error } = await supabase.from('communication_logs').insert(row).select('*').single();
      if (error) {
        setCommError(error.message || 'Could not save log.');
        setCommSaving(false);
        return;
      }
      if (data?.created_at) {
        mergeLastContact(selected.id, data.created_at);
      }
      if (data) {
        setLogs((prev) => {
          const next = [data, ...prev.filter((x) => x.id !== data.id)];
          return next.slice(0, 20);
        });
      } else {
        await loadLogs();
      }
      setCommModal(null);
      setCommNotes('');
    } catch (e) {
      setCommError(e?.message || 'Could not save log.');
    } finally {
      setCommSaving(false);
    }
  };

  const submitQuickLog = async () => {
    if (!supabase || !user?.id || !quickLog?.id) return;
    setQuickError('');
    setQuickSaving(true);
    const notes = quickNotes.trim();
    const createdAt = new Date().toISOString();
    const row = {
      missionary_id: user.id,
      contact_id: quickLog.id,
      comm_type: quickType,
      notes,
      created_at: createdAt,
    };
    try {
      const { data, error } = await supabase.from('communication_logs').insert(row).select('*').single();
      if (error) {
        setQuickError(error.message || 'Could not save log.');
        setQuickSaving(false);
        return;
      }
      const at = data?.created_at ?? createdAt;
      mergeLastContact(quickLog.id, at);
      if (selected?.id === quickLog.id && data) {
        setLogs((prev) => {
          const next = [data, ...prev.filter((x) => x.id !== data.id)];
          return next.slice(0, 20);
        });
      }
      setQuickLog(null);
      setQuickNotes('');
    } catch (e) {
      setQuickError(e?.message || 'Could not save log.');
    } finally {
      setQuickSaving(false);
    }
  };

  const openLogModal = (type) => {
    setCommError('');
    setCommNotes('');
    setCommModal(type);
  };

  const openQuickLog = (partner) => {
    setQuickError('');
    setQuickNotes('');
    setQuickType('call');
    setQuickLog(partner);
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="sent-page-title">Partners</h1>
        <p className="sent-body text-mission-muted">Monthly partners are derived from your contacts. Starts empty.</p>
      </header>

      {partners.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No partners yet — start asking"
          subtitle="Add contacts on the Contacts tab and mark monthly amounts or partner status — they’ll roll up here."
          action={
            <Button type="button" onClick={() => navigate('/missionary/contacts')}>
              Open contacts
            </Button>
          }
        />
      ) : (
        <>
          <p
            className={`text-sm font-semibold ${
              touchpointCount > 0 ? 'text-[#854F0B]' : 'text-emerald-700'
            }`}
          >
            {touchpointCount > 0
              ? touchpointCount === 1
                ? '1 partner needs a touchpoint'
                : `${touchpointCount} partners need a touchpoint`
              : 'All partners up to date'}
          </p>

          {needsTouchpoint.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink">Needs a touchpoint</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {needsTouchpoint.map((p) => {
                  const last = lastContactById[p.id] ?? null;
                  const d = daysSince(last);
                  const borderLeft =
                    d >= 30 ? '3px solid #A32D2D' : '3px solid #854F0B';
                  return (
                    <Card key={p.id} className="overflow-hidden p-4" style={{ borderLeft }}>
                      <p className="font-bold text-ink">{p.fullName || 'Unnamed partner'}</p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {last ? `No contact in ${d} days` : 'No contact yet'}
                      </p>
                      <p className="mt-2 text-sm text-neutral-700">{formatMonthly(p.monthlyAmount)}</p>
                      <Button type="button" className="mt-3 w-full sm:w-auto" onClick={() => openQuickLog(p)}>
                        Reach out
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-3 md:col-span-1">
              <h2 className="text-sm font-semibold text-ink">All partners</h2>
              {lastContactLoading ? (
                <p className="text-xs text-neutral-500">Loading touchpoints…</p>
              ) : null}
              <ul className="space-y-2">
                {sortedPartners.map((p) => {
                  const last = lastContactById[p.id] ?? null;
                  const badge = lastContactBadgeMeta(last);
                  const active = p.id === selectedId;
                  return (
                    <li key={p.id}>
                      <Card
                        className={`p-3 transition-colors ${
                          active ? 'ring-2 ring-mission-blue/30' : 'hover:bg-neutral-50'
                        }`}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 text-left"
                          onClick={() => setSelectedId(p.id)}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mission-blue/10 text-sm font-semibold text-mission-blue">
                            {partnerInitials(p.fullName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold text-ink">{p.fullName || 'Unnamed partner'}</span>
                            <span className="mt-0.5 block text-xs text-neutral-600">{formatMonthly(p.monthlyAmount)}</span>
                          </span>
                          <span className={`shrink-0 text-xs ${badge.className}`}>{badge.label}</span>
                        </button>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="md:col-span-2">
              {selected ? (
                <Card className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold">{selected.fullName || 'Unnamed partner'}</p>
                      <p className="mt-1 text-sm text-neutral-600">{categoryLabel(selected.category)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="secondary" onClick={() => openLogModal('call')}>
                        Log call
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => openLogModal('text')}>
                        Log text
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => openLogModal('update')}>
                        Log update
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => openLogModal('prayer')}>
                        Log prayer
                      </Button>
                      <Button type="button" variant="secondary" onClick={() => openLogModal('note')}>
                        Log note
                      </Button>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                    <Tabs tab={tab} setTab={setTab} />
                    <button
                      type="button"
                      className="text-xs font-semibold text-mission-blue hover:underline"
                      onClick={() => navigate(`/missionary/contacts?contact=${encodeURIComponent(selected.id)}`)}
                    >
                      Edit contact
                    </button>
                  </div>

                  <div className="mt-4">
                    {logsLoading ? (
                      <p className="text-sm text-neutral-500">Loading activity…</p>
                    ) : filteredLogs.length === 0 ? (
                      <EmptyState
                        icon="clipboard"
                        title="No activity in this tab"
                        subtitle="Log calls, texts, updates, prayers, or notes — they’ll show up here."
                      />
                    ) : (
                      <ul className="space-y-3">
                        {filteredLogs.map((log) => (
                          <li key={log.id} className="rounded-btn border border-neutral-200 px-4 py-3 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-mission-blue">
                                {COMM_TYPE_LABEL[log.comm_type] || log.comm_type}
                              </span>
                              <span className="text-xs text-neutral-500">
                                {log.created_at
                                  ? new Date(log.created_at).toLocaleString(undefined, {
                                      dateStyle: 'medium',
                                      timeStyle: 'short',
                                    })
                                  : ''}
                              </span>
                            </div>
                            {log.notes ? <p className="mt-2 whitespace-pre-wrap text-neutral-800">{log.notes}</p> : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              ) : (
                <EmptyState icon="compass" title="Select a partner" subtitle="Choose someone from the list to see details and log touchpoints." />
              )}
            </div>
          </div>
        </>
      )}

      <Modal
        open={Boolean(commModal)}
        title={commModal ? `Log ${COMM_TYPE_LABEL[commModal] || commModal}` : ''}
        onClose={() => !commSaving && setCommModal(null)}
        backdropClose={!commSaving}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={commSaving} onClick={() => setCommModal(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={commSaving} onClick={() => void submitCommLog()}>
              {commSaving ? 'Saving…' : 'Save log'}
            </Button>
          </div>
        }
      >
        {commError ? <p className="mb-3 text-sm text-red-700">{commError}</p> : null}
        <Textarea
          value={commNotes}
          onChange={(e) => setCommNotes(e.target.value)}
          placeholder="Notes (optional)…"
          rows={5}
        />
      </Modal>

      <Modal
        open={Boolean(quickLog)}
        title={quickLog ? `Log touchpoint — ${quickLog.fullName || 'Partner'}` : ''}
        onClose={() => !quickSaving && setQuickLog(null)}
        backdropClose={!quickSaving}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" disabled={quickSaving} onClick={() => setQuickLog(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={quickSaving} onClick={() => void submitQuickLog()}>
              {quickSaving ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        {quickError ? <p className="mb-3 text-sm text-red-700">{quickError}</p> : null}
        <p className="mb-2 text-xs font-medium text-neutral-600">Type</p>
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_LOG_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setQuickType(t)}
              className={`rounded-btn border px-3 py-1.5 text-sm font-medium ${
                quickType === t
                  ? 'border-mission-blue bg-mission-blue/10 text-mission-blue'
                  : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {COMM_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <Textarea
          value={quickNotes}
          onChange={(e) => setQuickNotes(e.target.value)}
          placeholder="Notes (optional)…"
          rows={4}
        />
      </Modal>
    </div>
  );
}
