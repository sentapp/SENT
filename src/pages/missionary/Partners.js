import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ContactQuickTagsRow } from '../../components/contacts/QuickTagPopover';
import { stripOptionalContactColumnsFromRow, useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { supabase } from '../../lib/supabaseClient';
import { normalizeCategory, normalizeCategoryForSave } from '../../lib/contactCategories';
import { normalizeStatusForSave, normalizeStatusFromDb } from '../../lib/contactStatuses';
import { formatPhone } from '../../lib/phoneFormat';
import { Button, EmptyState, Modal, Textarea } from '../../components/ui';
import {
  PartnerInlineEditPanel,
  PARTNER_INLINE_STATUS_OPTIONS,
  partnerToDraft,
  serializeDraft,
} from './PartnerInlineEditPanel';

const partnerFilters = [
  { label: 'All', value: 'all' },
  { label: 'Individuals', value: 'individual' },
  { label: 'Churches', value: 'church' },
];

const COMM_TYPE_LABEL = {
  call: 'Call',
  text: 'Text',
  update: 'Update',
  prayer: 'Prayer',
  note: 'Note',
  email: 'Email',
  meeting: 'Meeting',
};

/** Quick log from "Reach out" — Call, Text, Meeting, Note (matches `communication_type` enum). */
const QUICK_LOG_TYPES = ['call', 'text', 'meeting', 'note'];

const PAGE_SIZE = 1000;

const PARTNER_STATUS_VALUE_SET = new Set(PARTNER_INLINE_STATUS_OPTIONS.map((o) => o.value));

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

/** Label for urgent rows — days since last `communication_logs` entry. */
function daysSinceContactLabel(lastIso) {
  if (!lastIso) return 'Never contacted';
  const d = daysSince(lastIso);
  if (d === 0) return 'Today';
  if (d === 1) return '1 day since contact';
  return `${d} days since contact`;
}

/** Badge for "All good" rows — `Xd ago` style with urgency colors (last contact within 30 days). */
function lastContactedBadgeFromIso(lastIso) {
  if (!lastIso) {
    return { label: 'Never', className: 'text-[#A32D2D] font-semibold' };
  }
  const ms = Date.now() - new Date(lastIso).getTime();
  if (ms >= 0 && ms < 60 * 60 * 1000) {
    return { label: 'Just now', className: 'text-emerald-700 font-semibold' };
  }
  const d = daysSince(lastIso);
  const dayLabel = d === 0 ? 'Today' : d === 1 ? '1d ago' : `${d}d ago`;
  if (d >= 30) {
    return { label: dayLabel, className: 'text-[#A32D2D] font-medium' };
  }
  if (d >= 14) {
    return { label: dayLabel, className: 'text-[#854F0B] font-medium' };
  }
  if (d >= 7) {
    return { label: dayLabel, className: 'text-neutral-500 font-medium' };
  }
  return { label: dayLabel, className: 'text-emerald-700 font-medium' };
}

function ExpandPanelShell({ open, children }) {
  return (
    <div
      className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ${
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
      }`}
    >
      <div className="min-h-0">{children}</div>
    </div>
  );
}

export default function MissionaryPartners() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { contacts, refetch, schemaPartial, updateContact } = useSupabaseContacts(user?.id, { authLoading });
  const [expandedPartnerId, setExpandedPartnerId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [draftSnapshot, setDraftSnapshot] = useState(null);
  const expandedDraftInitRef = useRef(null);

  const [tab, setTab] = useState('Message');
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [commModal, setCommModal] = useState(null);
  const [commNotes, setCommNotes] = useState('');
  const [commSaving, setCommSaving] = useState(false);
  const [commError, setCommError] = useState('');

  const [lastContactMap, setLastContactMap] = useState({});
  const [lastContactLoading, setLastContactLoading] = useState(false);

  const [quickLog, setQuickLog] = useState(null);
  const [quickType, setQuickType] = useState('call');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');

  const [inlineSaveError, setInlineSaveError] = useState('');
  const [inlineSaving, setInlineSaving] = useState(false);
  const [savedNoticeId, setSavedNoticeId] = useState(null);
  const savedNoticeTimerRef = useRef(null);

  const [partnerViewFilter, setPartnerViewFilter] = useState('all');

  const allPartners = useMemo(() => {
    return contacts.filter(
      (c) =>
        normalizeCategory(c.category) === 'supporter' ||
        normalizeStatusFromDb(c.status) === 'partner' ||
        Number(c.monthlyAmount) > 0,
    );
  }, [contacts]);

  const partners = useMemo(() => {
    if (partnerViewFilter === 'all') return allPartners;
    if (partnerViewFilter === 'individual') {
      return allPartners.filter((c) => {
        const cat = normalizeCategory(c.category);
        return cat === 'supporter' && cat !== 'church';
      });
    }
    if (partnerViewFilter === 'church') {
      return allPartners.filter((c) => normalizeCategory(c.category) === 'church');
    }
    return allPartners;
  }, [allPartners, partnerViewFilter]);

  useEffect(() => {
    if (expandedPartnerId && !partners.some((p) => p.id === expandedPartnerId)) {
      setExpandedPartnerId(null);
    }
  }, [expandedPartnerId, partners]);

  const expandedPartner = useMemo(
    () => (expandedPartnerId ? partners.find((p) => p.id === expandedPartnerId) ?? null : null),
    [partners, expandedPartnerId],
  );

  const isDraftDirty = Boolean(draft && draftSnapshot != null && serializeDraft(draft) !== draftSnapshot);

  const confirmDiscardIfNeeded = useCallback(() => {
    if (!isDraftDirty) return true;
    return window.confirm('Discard changes?');
  }, [isDraftDirty]);

  const collapseExpanded = useCallback(() => {
    setExpandedPartnerId(null);
  }, []);

  const handleToggleExpandRow = useCallback(
    (p) => {
      if (expandedPartnerId === p.id) {
        if (!confirmDiscardIfNeeded()) return;
        collapseExpanded();
        return;
      }
      setExpandedPartnerId(p.id);
    },
    [expandedPartnerId, confirmDiscardIfNeeded, collapseExpanded],
  );

  const handleInlineCancel = useCallback(() => {
    if (!confirmDiscardIfNeeded()) return;
    collapseExpanded();
  }, [confirmDiscardIfNeeded, collapseExpanded]);

  useEffect(() => {
    if (!expandedPartnerId) {
      expandedDraftInitRef.current = null;
      setDraft(null);
      setDraftSnapshot(null);
      setInlineSaveError('');
      return;
    }
    if (expandedDraftInitRef.current === expandedPartnerId) {
      return;
    }
    const p = partners.find((x) => x.id === expandedPartnerId);
    if (!p) return;
    expandedDraftInitRef.current = expandedPartnerId;
    const base = partnerToDraft({
      ...p,
      status: PARTNER_STATUS_VALUE_SET.has(p.status) ? p.status : 'partner',
    });
    setDraft(base);
    setDraftSnapshot(serializeDraft(base));
    setInlineSaveError('');
  }, [expandedPartnerId, partners]);

  const loadLastContacts = useCallback(async () => {
    if (!supabase || !user?.id) {
      setLastContactMap({});
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
      setLastContactMap(map);
    } finally {
      setLastContactLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void loadLastContacts();
  }, [loadLastContacts]);

  const totalMonthly = useMemo(() => {
    return partners.reduce((sum, p) => {
      const n = Number(p.monthlyAmount);
      return sum + (Number.isFinite(n) && n > 0 ? n : 0);
    }, 0);
  }, [partners]);

  const needsContact = useMemo(() => {
    return partners.filter((p) => daysSince(lastContactMap[p.id]) >= 30);
  }, [partners, lastContactMap]);

  const allGood = useMemo(() => {
    return partners.filter((p) => daysSince(lastContactMap[p.id]) < 30);
  }, [partners, lastContactMap]);

  const needsContactSorted = useMemo(() => {
    return [...needsContact].sort(
      (a, b) => daysSince(lastContactMap[b.id] ?? null) - daysSince(lastContactMap[a.id] ?? null),
    );
  }, [needsContact, lastContactMap]);

  const allGoodSorted = useMemo(() => {
    return [...allGood].sort((a, b) => {
      const da = daysSince(lastContactMap[a.id] ?? null);
      const db = daysSince(lastContactMap[b.id] ?? null);
      return db - da;
    });
  }, [allGood, lastContactMap]);

  const loadLogs = useCallback(async () => {
    if (!supabase || !expandedPartner?.id) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('contact_id', expandedPartner.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setLogsLoading(false);
    if (error) {
      setLogs([]);
      return;
    }
    setLogs(data || []);
  }, [expandedPartner?.id]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => logs.filter((l) => logMatchesTab(l, tab)), [logs, tab]);

  const mergeLastContact = useCallback((contactId, createdAt) => {
    setLastContactMap((prev) => {
      const prevAt = prev[contactId];
      if (!prevAt || new Date(createdAt) > new Date(prevAt)) {
        return { ...prev, [contactId]: createdAt };
      }
      return prev;
    });
  }, []);

  const flashSavedNotice = useCallback((id) => {
    if (savedNoticeTimerRef.current) {
      clearTimeout(savedNoticeTimerRef.current);
    }
    setSavedNoticeId(id);
    savedNoticeTimerRef.current = setTimeout(() => {
      setSavedNoticeId(null);
      savedNoticeTimerRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (savedNoticeTimerRef.current) {
        clearTimeout(savedNoticeTimerRef.current);
      }
    };
  }, []);

  const submitInlineSave = async () => {
    if (!supabase || !user?.id || !expandedPartner?.id || !draft) return;
    setInlineSaveError('');
    setInlineSaving(true);
    const monthlyNum = Number(String(draft.monthlyAmount).replace(/,/g, ''));
    const monthly_amount = Number.isFinite(monthlyNum) ? monthlyNum : 0;
    const isDonor = Boolean(draft.isOneTimeDonor);
    const oneAmtRaw = Number(String(draft.oneTimeDonationAmount).replace(/,/g, ''));
    const one_time_donation_amount = isDonor && Number.isFinite(oneAmtRaw) ? oneAmtRaw : 0;
    const one_time_donation_date =
      isDonor && draft.oneTimeDonationDate && String(draft.oneTimeDonationDate).trim() !== ''
        ? String(draft.oneTimeDonationDate).slice(0, 10)
        : null;

    let row = {
      full_name: String(draft.fullName ?? '').trim(),
      phone: String(draft.phone ?? '').trim(),
      email: String(draft.email ?? '').trim(),
      monthly_amount,
      category: normalizeCategoryForSave(draft.category),
      status: normalizeStatusForSave(draft.status),
      notes: String(draft.notes ?? '').trim(),
      address: String(draft.address ?? '').trim(),
      is_one_time_donor: isDonor,
      one_time_donation_amount,
      one_time_donation_date,
    };
    row = stripOptionalContactColumnsFromRow(row, schemaPartial);

    try {
      const { error } = await supabase
        .from('contacts')
        .update(row)
        .eq('id', expandedPartner.id)
        .eq('missionary_id', user.id);
      if (error) {
        setInlineSaveError(error.message || 'Could not save.');
        setInlineSaving(false);
        return;
      }
      expandedDraftInitRef.current = null;
      setExpandedPartnerId(null);
      await refetch();
      flashSavedNotice(expandedPartner.id);
    } catch (e) {
      setInlineSaveError(e?.message || 'Could not save.');
    } finally {
      setInlineSaving(false);
    }
  };

  const submitCommLog = async () => {
    if (!supabase || !user?.id || !expandedPartner?.id || !commModal) return;
    setCommError('');
    setCommSaving(true);
    const notes = commNotes.trim();
    const row = {
      missionary_id: user.id,
      contact_id: expandedPartner.id,
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
        mergeLastContact(expandedPartner.id, data.created_at);
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
      if (expandedPartner?.id === quickLog.id && data) {
        setLogs((prev) => {
          const next = [data, ...prev.filter((x) => x.id !== data.id)];
          return next.slice(0, 20);
        });
      }
      setQuickLog(null);
      setQuickNotes('');
      await Promise.all([refetch(), loadLastContacts()]);
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

  const invalidateExpandedDraft = useCallback(() => {
    expandedDraftInitRef.current = null;
  }, []);

  const renderActivitySection = () => {
    if (!expandedPartner) return null;
    return (
      <>
      <div className="flex flex-wrap items-start justify-between gap-3 border-t border-mission-line px-4 pb-2 pt-4 sm:px-5">
        <div>
          <p className="text-lg font-semibold text-ink">{expandedPartner.fullName || 'Unnamed partner'}</p>
          <ContactQuickTagsRow
            contact={expandedPartner}
            updateContact={updateContact}
            onAfterSave={invalidateExpandedDraft}
            showPotentialAddTag
            className="mt-1 flex flex-wrap items-center gap-1.5"
          />
          {expandedPartner.phone ? (
            <p className="mt-2 text-sm font-medium text-neutral-800">{formatPhone(expandedPartner.phone)}</p>
          ) : null}
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

      <div className="border-t border-mission-line px-4 py-3 sm:px-5">
        <Tabs tab={tab} setTab={setTab} />
      </div>

      <div className="px-4 pb-5 sm:px-5">
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
    </>
    );
  };

  const partnerCountLabel = partners.length === 1 ? '1 partner' : `${partners.length} partners`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h1 className="sent-page-title">Partners</h1>
          <p className="sent-body text-mission-muted">
            {partners.length === 0
              ? 'Monthly partners are derived from your contacts.'
              : `${formatMonthly(totalMonthly)} · ${partnerCountLabel}`}
          </p>
        </div>
        {needsContact.length > 0 ? (
          <span className="shrink-0 rounded-full bg-[#A32D2D]/12 px-3 py-1 text-xs font-semibold text-[#A32D2D] ring-1 ring-[#A32D2D]/25">
            {needsContact.length} overdue
          </span>
        ) : null}
      </header>

      {allPartners.length > 0 ? (
        <div
          className="flex w-full flex-wrap gap-2 rounded-lg border border-mission-line bg-neutral-100 p-1"
          role="tablist"
          aria-label="Filter partners"
        >
          {partnerFilters.map((f) => {
            const active = partnerViewFilter === f.value;
            return (
              <button
                key={f.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setPartnerViewFilter(f.value)}
                className={`min-h-[40px] flex-1 rounded-md px-3 py-2 text-center text-xs font-semibold transition sm:text-sm ${
                  active
                    ? 'border-b-2 border-[#185FA5] bg-white text-[#185FA5] shadow-sm'
                    : 'border-b-2 border-transparent text-neutral-600 hover:bg-white/70'
                }`}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {allPartners.length > 0 && partners.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No partners in this view"
          subtitle="Try a different filter — your partners are still saved under All."
        />
      ) : null}

      {allPartners.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No partners yet"
          subtitle="Add contacts on the Contacts tab and mark monthly amounts or partner status — they’ll roll up here."
          action={
            <Button type="button" onClick={() => navigate('/missionary/contacts')}>
              Open contacts
            </Button>
          }
        />
      ) : partners.length === 0 ? null : (
        <>
          {needsContact.length > 0 ? (
            <section className="space-y-3" aria-labelledby="reach-out-heading">
              <h2 id="reach-out-heading" className="text-base font-semibold text-ink">
                Reach out now{' '}
                <span className="font-normal text-mission-muted">({needsContact.length})</span>
              </h2>
              <ul className="space-y-2">
                {needsContactSorted.map((p) => {
                  const last = lastContactMap[p.id] ?? null;
                  const isExpanded = expandedPartnerId === p.id;
                  return (
                    <li
                      key={p.id}
                      className="group overflow-hidden rounded-card border border-mission-line border-l-[3px] border-l-[#A32D2D] bg-surface transition-shadow duration-200"
                    >
                      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                        <div
                          role="button"
                          tabIndex={0}
                          className={`flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-mission-blue/30 ${
                            isExpanded ? 'rounded-btn bg-mission-blue/[0.06] sm:bg-transparent' : ''
                          }`}
                          onClick={() => handleToggleExpandRow(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleToggleExpandRow(p);
                            }
                          }}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mission-blue/10 text-sm font-semibold text-mission-blue">
                            {partnerInitials(p.fullName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="block truncate font-semibold text-ink">{p.fullName || 'Unnamed partner'}</span>
                              {savedNoticeId === p.id ? (
                                <span className="text-xs font-semibold text-emerald-700">Saved</span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-xs text-neutral-600">{formatMonthly(p.monthlyAmount)}</span>
                            <span className="mt-0.5 block text-xs font-medium text-[#A32D2D]">{daysSinceContactLabel(last)}</span>
                            <div onClick={(e) => e.stopPropagation()} className="mt-2">
                              <ContactQuickTagsRow
                                contact={p}
                                updateContact={updateContact}
                                onAfterSave={invalidateExpandedDraft}
                                showPotentialAddTag
                                className="flex flex-wrap items-center gap-1.5"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-start sm:items-center">
                          <Button type="button" variant="danger" className="w-full min-w-[7.5rem] sm:w-auto" onClick={() => openQuickLog(p)}>
                            Reach out
                          </Button>
                        </div>
                      </div>
                      <ExpandPanelShell open={isExpanded}>
                        {isExpanded && draft ? (
                          <div className="border-t border-mission-line bg-[color:var(--color-bg)] transition-all duration-300 ease-out">
                            <PartnerInlineEditPanel
                              draft={draft}
                              onChange={setDraft}
                              saveError={inlineSaveError}
                              saving={inlineSaving}
                              onSave={() => void submitInlineSave()}
                              onCancel={handleInlineCancel}
                              schemaPartial={schemaPartial}
                            />
                            {renderActivitySection()}
                          </div>
                        ) : null}
                      </ExpandPanelShell>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3" aria-labelledby="all-good-heading">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="all-good-heading" className="text-base font-semibold text-ink">
                All good{' '}
                <span className="font-normal text-mission-muted">({allGood.length})</span>
              </h2>
              {needsContact.length === 0 ? (
                <p className="text-sm text-emerald-700">Everyone is on track.</p>
              ) : null}
            </div>
            {lastContactLoading ? <p className="text-xs text-neutral-500">Loading touchpoints…</p> : null}
            {allGood.length === 0 && needsContact.length > 0 ? (
              <div className="rounded-btn border border-dashed border-mission-line bg-[color:var(--color-bg)] px-4 py-6 text-center">
                <p className="text-sm font-semibold text-ink">All partners are up to date</p>
                <p className="mt-2 text-sm text-mission-muted">
                  In this section — after you log a touchpoint within the last 30 days, that partner moves here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {allGoodSorted.map((p) => {
                  const last = lastContactMap[p.id] ?? null;
                  const badge = lastContactedBadgeFromIso(last);
                  const isExpanded = p.id === expandedPartnerId;
                  return (
                    <li key={p.id} className="group overflow-hidden rounded-card border border-mission-line bg-surface transition-shadow duration-200">
                      <div
                        role="button"
                        tabIndex={0}
                        className={`flex w-full cursor-pointer flex-col gap-1.5 p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-mission-blue/30 ${
                          isExpanded ? 'bg-mission-blue/[0.06]' : 'hover:bg-neutral-50'
                        }`}
                        onClick={() => handleToggleExpandRow(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggleExpandRow(p);
                          }
                        }}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <ContactQuickTagsRow
                            contact={p}
                            updateContact={updateContact}
                            onAfterSave={invalidateExpandedDraft}
                            showPotentialAddTag
                          />
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mission-blue/10 text-sm font-semibold text-mission-blue">
                            {partnerInitials(p.fullName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="block truncate font-semibold text-ink">{p.fullName || 'Unnamed partner'}</span>
                              {savedNoticeId === p.id ? (
                                <span className="text-xs font-semibold text-emerald-700">Saved</span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-xs text-neutral-600">{formatMonthly(p.monthlyAmount)}</span>
                          </span>
                          <span className={`shrink-0 text-xs ${badge.className}`}>{badge.label}</span>
                        </div>
                      </div>
                      <ExpandPanelShell open={isExpanded}>
                        {isExpanded && draft ? (
                          <div className="border-t border-mission-line bg-[color:var(--color-bg)] transition-all duration-300 ease-out">
                            <PartnerInlineEditPanel
                              draft={draft}
                              onChange={setDraft}
                              saveError={inlineSaveError}
                              saving={inlineSaving}
                              onSave={() => void submitInlineSave()}
                              onCancel={handleInlineCancel}
                              schemaPartial={schemaPartial}
                            />
                            {renderActivitySection()}
                          </div>
                        ) : null}
                      </ExpandPanelShell>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
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
