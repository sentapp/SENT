import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ContactThreeQuickTagRows } from '../../components/contacts/QuickTagPopover';
import {
  ContactQuickLogPopup,
  lastContactBadgeFromIso,
} from '../../components/contacts/ContactQuickViewPopup';
import { PartnerQuickViewPopup } from '../../components/contacts/PartnerQuickViewPopup';
import { Button, EmptyState, Modal } from '../../components/ui';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { findEmailConflict, findPhoneConflict } from '../../lib/contactDuplicates';
import { normalizeCategory, normalizeCategoryForSave } from '../../lib/contactCategories';
import { safeCategoryValue } from '../../lib/safeCategory';
import { mergeNotesWithSocial, notesWithoutSocialBlock, splitSocialFromNotes } from '../../lib/contactSocialInNotes';
import { normalizeRelationshipForSave } from '../../lib/contactRelationships';
import { normalizeStatusForSave, normalizeStatusFromDb } from '../../lib/contactStatuses';
import { phoneDigits } from '../../lib/phoneFormat';
import { supabase } from '../../lib/supabaseClient';
import ContactEditFormLayout from './ContactEditFormLayout';

const partnerFilters = [
  { label: 'All', value: 'all' },
  { label: 'Individuals', value: 'individual' },
  { label: 'Churches', value: 'church' },
];

const PAGE_SIZE = 1000;

/** Days since last contact; never contacted → large sentinel. */
function daysSince(isoOrNull) {
  if (!isoOrNull) return 999;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return 999;
  const diffMs = Date.now() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
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

function cleanDisplayNotes(notes) {
  const body = notesWithoutSocialBlock(notes);
  if (!body) return '';
  const trimmed = body.toString().trim();
  if (/^\d+$/.test(trimmed)) return '';
  return trimmed;
}

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  social: '',
  category: null,
  status: 'prospect',
  relationship: '',
  monthlyAmount: '',
  isOneTimeDonor: false,
  oneTimeDonationAmount: '',
  oneTimeDonationDate: '',
  notes: '',
};

function contactFormSnapshot(f) {
  return JSON.stringify({
    fullName: f.fullName ?? '',
    phone: f.phone ?? '',
    email: f.email ?? '',
    address: f.address ?? '',
    social: f.social ?? '',
    category: f.category ?? '',
    status: f.status ?? '',
    relationship: f.relationship ?? '',
    monthlyAmount: f.monthlyAmount ?? '',
    isOneTimeDonor: Boolean(f.isOneTimeDonor),
    oneTimeDonationAmount: f.oneTimeDonationAmount ?? '',
    oneTimeDonationDate: f.oneTimeDonationDate ?? '',
    notes: f.notes ?? '',
  });
}

function contactRowToForm(c) {
  const { social, bodyNotes } = splitSocialFromNotes(c.notes);
  return {
    fullName: c.fullName,
    phone: c.phone,
    email: c.email,
    address: c.address || '',
    social,
    notes: cleanDisplayNotes(bodyNotes),
    category: normalizeCategoryForSave(c.category),
    status: normalizeStatusFromDb(c.status),
    relationship: c.relationship != null && String(c.relationship).trim() !== '' ? String(c.relationship).trim() : '',
    monthlyAmount: c.monthlyAmount ? String(c.monthlyAmount) : '',
    isOneTimeDonor: Boolean(c.isOneTimeDonor),
    oneTimeDonationAmount:
      c.oneTimeDonationAmount != null && Number(c.oneTimeDonationAmount) > 0
        ? String(c.oneTimeDonationAmount)
        : '',
    oneTimeDonationDate: c.oneTimeDonationDate || '',
  };
}

export default function MissionaryPartners() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { contacts, refetch, updateContact, saveQuickTag, patchContactInList } = useSupabaseContacts(user?.id, {
    authLoading,
  });

  const [popupPartner, setPopupPartner] = useState(null);
  const [quickLog, setQuickLog] = useState(null);
  const [quickType, setQuickType] = useState('call');
  const [quickNotes, setQuickNotes] = useState('');
  const [quickSaving, setQuickSaving] = useState(false);
  const [quickError, setQuickError] = useState('');

  const [commActionError, setCommActionError] = useState('');

  const [fullProfileOpen, setFullProfileOpen] = useState(false);
  const [fullProfileId, setFullProfileId] = useState(null);
  const [fullProfileForm, setFullProfileForm] = useState(emptyForm);
  const [fullProfileSaveError, setFullProfileSaveError] = useState('');
  const [fullProfileDiscardOpen, setFullProfileDiscardOpen] = useState(false);
  const fullProfileSnapshotRef = useRef('');

  const [lastContactMap, setLastContactMap] = useState({});
  const [lastContactLoading, setLastContactLoading] = useState(false);

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
        return cat === 'individual' || (cat !== 'church' && cat !== 'connector');
      });
    }
    if (partnerViewFilter === 'church') {
      return allPartners.filter((c) => normalizeCategory(c.category) === 'church');
    }
    return allPartners;
  }, [allPartners, partnerViewFilter]);

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

  const openQuickLog = (partner) => {
    setQuickError('');
    setQuickNotes('');
    setQuickType('call');
    setQuickLog(partner);
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
      setQuickLog(null);
      setQuickNotes('');
      await Promise.all([refetch(), loadLastContacts()]);
    } catch (e) {
      setQuickError(e?.message || 'Could not save log.');
    } finally {
      setQuickSaving(false);
    }
  };

  const logCommunication = useCallback(
    async (contactId, type, notes = '') => {
      if (!supabase || !user?.id || !contactId) {
        return { ok: false, error: 'Missing contact.' };
      }
      const created_at = new Date().toISOString();
      const { data, error } = await supabase
        .from('communication_logs')
        .insert({
          missionary_id: user.id,
          contact_id: contactId,
          comm_type: type,
          notes: notes ?? '',
          created_at,
        })
        .select('*')
        .single();
      if (error) return { ok: false, error: error.message || 'Could not save log.' };
      const at = data?.created_at ?? created_at;
      mergeLastContact(contactId, at);
      await refetch();
      await loadLastContacts();
      return { ok: true, created_at: at };
    },
    [user?.id, mergeLastContact, refetch, loadLastContacts],
  );

  const handlePopupCall = useCallback(() => {
    const p = popupPartner;
    if (!p) return;
    const phone = p.phone;
    if (!phone) {
      alert('No phone number on file');
      return;
    }
    const digits = phoneDigits(phone);
    if (!digits) {
      alert('No phone number on file');
      return;
    }
    setCommActionError('');
    window.open(`tel:${digits}`, '_self');
    void (async () => {
      const res = await logCommunication(p.id, 'call', '');
      if (!res.ok) setCommActionError(res.error || 'Could not log call.');
    })();
  }, [popupPartner, logCommunication]);

  const handlePopupText = useCallback(() => {
    const p = popupPartner;
    if (!p) return;
    const phone = p.phone;
    if (!phone) {
      alert('No phone number on file');
      return;
    }
    const digits = phoneDigits(phone);
    if (!digits) {
      alert('No phone number on file');
      return;
    }
    setCommActionError('');
    window.open(`sms:${digits}`, '_self');
    void (async () => {
      const res = await logCommunication(p.id, 'text', '');
      if (!res.ok) setCommActionError(res.error || 'Could not log text.');
    })();
  }, [popupPartner, logCommunication]);

  const handlePopupLog = useCallback(() => {
    if (!popupPartner) return;
    openQuickLog(popupPartner);
  }, [popupPartner]);

  const openFullProfileFromPopup = useCallback(() => {
    if (!popupPartner) return;
    const p = popupPartner;
    setPopupPartner(null);
    setCommActionError('');
    setFullProfileId(p.id);
    const next = contactRowToForm(p);
    fullProfileSnapshotRef.current = contactFormSnapshot(next);
    setFullProfileForm(next);
    setFullProfileSaveError('');
    setFullProfileDiscardOpen(false);
    setFullProfileOpen(true);
  }, [popupPartner]);

  const phoneDupWarn = useMemo(
    () => findPhoneConflict(fullProfileForm.phone, contacts, { excludeId: fullProfileId }),
    [fullProfileForm.phone, contacts, fullProfileId],
  );
  const emailDupWarn = useMemo(
    () => findEmailConflict(fullProfileForm.email, contacts, { excludeId: fullProfileId }),
    [fullProfileForm.email, contacts, fullProfileId],
  );

  const hasUnsavedFullProfile = useMemo(() => {
    if (!fullProfileOpen) return false;
    return contactFormSnapshot(fullProfileForm) !== fullProfileSnapshotRef.current;
  }, [fullProfileOpen, fullProfileForm]);

  const requestCloseFullProfile = useCallback(() => {
    if (hasUnsavedFullProfile) {
      setFullProfileDiscardOpen(true);
      return;
    }
    setFullProfileOpen(false);
    setFullProfileSaveError('');
    setFullProfileId(null);
  }, [hasUnsavedFullProfile]);

  const confirmDiscardFullProfile = useCallback(() => {
    setFullProfileDiscardOpen(false);
    setFullProfileOpen(false);
    setFullProfileSaveError('');
    setFullProfileId(null);
  }, []);

  const saveFullProfile = async () => {
    setFullProfileSaveError('');
    if (!fullProfileForm.fullName.trim()) {
      setFullProfileSaveError('Name is required.');
      return;
    }
    if (!fullProfileId) return;

    const oneTimeAmt = Number.parseFloat(String(fullProfileForm.oneTimeDonationAmount ?? '').replace(/,/g, ''));
    const isOneTimeDonorEffective =
      Boolean(fullProfileForm.isOneTimeDonor) || (Number.isFinite(oneTimeAmt) && oneTimeAmt > 0);

    const payload = {
      fullName: fullProfileForm.fullName.trim(),
      phone: fullProfileForm.phone,
      email: fullProfileForm.email,
      address: fullProfileForm.address,
      category: safeCategoryValue(normalizeCategoryForSave(fullProfileForm.category)),
      status: normalizeStatusForSave(fullProfileForm.status),
      relationship: normalizeRelationshipForSave(fullProfileForm.relationship) ?? '',
      monthlyAmount: fullProfileForm.monthlyAmount,
      isOneTimeDonor: isOneTimeDonorEffective,
      oneTimeDonationAmount: fullProfileForm.oneTimeDonationAmount,
      oneTimeDonationDate: fullProfileForm.oneTimeDonationDate,
      notes: mergeNotesWithSocial(fullProfileForm.notes, fullProfileForm.social),
    };
    const res = await updateContact(fullProfileId, payload);
    if (!res.ok) {
      setFullProfileSaveError(res.error || 'Could not save.');
      return;
    }
    const savedId = fullProfileId;
    setFullProfileOpen(false);
    setFullProfileId(null);
    flashSavedNotice(savedId);
  };

  const partnerCountLabel = partners.length === 1 ? '1 partner' : `${partners.length} partners`;

  const scrollToContact = useCallback(() => {}, []);

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
                  return (
                    <li
                      key={p.id}
                      className="group overflow-hidden rounded-card border border-mission-line border-l-[3px] border-l-[#A32D2D] bg-surface transition-shadow duration-200"
                    >
                      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4">
                        <div
                          role="button"
                          tabIndex={0}
                          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-mission-blue/30"
                          onClick={() => {
                            setCommActionError('');
                            setPopupPartner(p);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setCommActionError('');
                              setPopupPartner(p);
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
                              <ContactThreeQuickTagRows
                                contact={p}
                                saveQuickTag={saveQuickTag}
                                patchContactInList={patchContactInList}
                                onAfterSave={() => void refetch()}
                                onPatchContact={(next) =>
                                  setPopupPartner((cur) =>
                                    cur && String(cur.id) === String(next.id) ? { ...cur, ...next } : cur,
                                  )
                                }
                                variant="compact"
                                className="flex flex-col gap-1"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-start sm:items-center">
                          <Button
                            type="button"
                            variant="danger"
                            className="w-full min-w-[7.5rem] sm:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              openQuickLog(p);
                            }}
                          >
                            Reach out
                          </Button>
                        </div>
                      </div>
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
                  const badge = lastContactBadgeFromIso(last);
                  return (
                    <li
                      key={p.id}
                      className="overflow-hidden rounded-card border border-mission-line bg-surface transition-shadow duration-200"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex w-full cursor-pointer flex-col gap-1.5 p-3 text-left outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-mission-blue/30"
                        onClick={() => {
                          setCommActionError('');
                          setPopupPartner(p);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setCommActionError('');
                            setPopupPartner(p);
                          }
                        }}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <ContactThreeQuickTagRows
                            contact={p}
                            saveQuickTag={saveQuickTag}
                            patchContactInList={patchContactInList}
                            onAfterSave={() => void refetch()}
                            onPatchContact={(next) =>
                              setPopupPartner((cur) =>
                                cur && String(cur.id) === String(next.id) ? { ...cur, ...next } : cur,
                              )
                            }
                            variant="compact"
                            className="mb-1 flex flex-col gap-1"
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
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <PartnerQuickViewPopup
        open={Boolean(popupPartner)}
        partner={popupPartner}
        lastContactIso={popupPartner ? lastContactMap[popupPartner.id] ?? null : null}
        onClose={() => {
          setPopupPartner(null);
          setCommActionError('');
        }}
        onCall={handlePopupCall}
        onText={handlePopupText}
        onLog={handlePopupLog}
        onViewFullProfile={openFullProfileFromPopup}
        suppressEscape={Boolean(quickLog)}
        actionError={commActionError}
        saveQuickTag={saveQuickTag}
        patchContactInList={patchContactInList}
        onPatchContact={(next) =>
          setPopupPartner((cur) => (cur && String(cur.id) === String(next.id) ? { ...cur, ...next } : cur))
        }
        onAfterQuickTagSave={() => void refetch()}
      />

      <ContactQuickLogPopup
        open={Boolean(quickLog)}
        title={quickLog ? `Quick log — ${quickLog.fullName || 'Partner'}` : ''}
        selectedType={quickType}
        onSelectType={setQuickType}
        notes={quickNotes}
        onNotesChange={setQuickNotes}
        error={quickError}
        saving={quickSaving}
        onSave={() => void submitQuickLog()}
        onClose={() => !quickSaving && setQuickLog(null)}
      />

      <Modal
        open={fullProfileOpen}
        title="Edit contact"
        backdropClose={false}
        closeButtonLabel="✕"
        onClose={requestCloseFullProfile}
        panelClassName="max-w-xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={requestCloseFullProfile}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void saveFullProfile()}>
              Save
            </Button>
          </div>
        }
      >
        {fullProfileSaveError ? <p className="mb-3 text-sm text-red-600">{fullProfileSaveError}</p> : null}
        <ContactEditFormLayout
          form={fullProfileForm}
          setForm={setFullProfileForm}
          phoneDupWarn={phoneDupWarn}
          emailDupWarn={emailDupWarn}
          scrollToContact={scrollToContact}
          deferQuickTags
          editingContactId={fullProfileId}
        />
      </Modal>

      <Modal
        open={fullProfileDiscardOpen}
        title="Unsaved changes"
        onClose={() => setFullProfileDiscardOpen(false)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setFullProfileDiscardOpen(false)}>
              Keep editing
            </Button>
            <Button type="button" variant="danger" onClick={confirmDiscardFullProfile}>
              Discard
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-700">You have unsaved changes — discard them?</p>
      </Modal>
    </div>
  );
}
