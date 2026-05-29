import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useContactDrawer } from '../../context/ContactDrawerContext';
import {
  ContactQuickLogPopup,
  lastContactBadgeFromIso,
} from '../../components/contacts/ContactQuickViewPopup';
import { PartnerSideDrawer } from '../../components/contacts/PartnerSideDrawer';
import {
  DRAWER_STACK_QUICK_LOG_BACKDROP_Z,
  DRAWER_STACK_QUICK_LOG_MODAL_Z,
} from '../../components/contacts/quickViewOverlayZIndex';
import { Button, EmptyState, Modal } from '../../components/ui';
import NudgeCard from '../../components/partners/NudgeCard';
import { useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import { findEmailConflict, findPhoneConflict } from '../../lib/contactDuplicates';
import { normalizeCategory, normalizeCategoryForSave } from '../../lib/contactCategories';
import { safeCategoryValue } from '../../lib/safeCategory';
import { mergeNotesWithSocial } from '../../lib/contactSocialInNotes';
import { normalizeRelationshipForSave } from '../../lib/contactRelationships';
import { normalizeStatusForSave, normalizeStatusFromDb } from '../../lib/contactStatuses';
import { phoneDigits } from '../../lib/phoneFormat';
import { supabase } from '../../lib/supabaseClient';
import { getContactAvatarStyle } from '../../lib/contactAvatarStyles';
import ContactEditFormLayout from './ContactEditFormLayout';
import {
  computePartnerCurrencyTotals,
  formatAmount,
  formatMonthlyAmount,
  normalizeCurrencyCode,
} from '../../lib/currencies';

const PAGE_SIZE = 1000;
const OVERDUE_CONTACT_DAYS = 30;

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

/** Label for urgent rows — days since last `communication_logs` entry. */
function daysSinceContactLabel(lastIso) {
  if (!lastIso) return 'Never contacted';
  const d = daysSince(lastIso);
  if (d === 0) return 'Today';
  if (d === 1) return '1 day since contact';
  return `${d} days since contact`;
}

function partnerSubtitle(partner) {
  const monthly = Number(partner.monthlyAmount) > 0;
  const oneTime = partner.isOneTimeDonor && Number(partner.oneTimeDonationAmount) > 0;
  if (monthly && oneTime) {
    return `${formatMonthlyAmount(partner.monthlyAmount, partner.currency)} · ${formatAmount(partner.oneTimeDonationAmount, partner.currency)} one-time`;
  }
  if (monthly) return formatMonthlyAmount(partner.monthlyAmount, partner.currency);
  if (oneTime) return `${formatAmount(partner.oneTimeDonationAmount, partner.currency)} one-time gift`;
  return 'Partner';
}

function isMonthlyPartner(c) {
  return Number(c.monthlyAmount) > 0;
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
  currency: 'USD',
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
    currency: f.currency ?? 'USD',
    isOneTimeDonor: Boolean(f.isOneTimeDonor),
    oneTimeDonationAmount: f.oneTimeDonationAmount ?? '',
    oneTimeDonationDate: f.oneTimeDonationDate ?? '',
    notes: f.notes ?? '',
  });
}

export default function MissionaryPartners() {
  const { openDrawer } = useContactDrawer();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const homeCurrency = normalizeCurrencyCode(profile?.home_currency);
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

  const allPartners = useMemo(() => {
    return contacts.filter(
      (c) =>
        c.isOneTimeDonor ||
        normalizeCategory(c.category) === 'supporter' ||
        normalizeStatusFromDb(c.status) === 'partner' ||
        Number(c.monthlyAmount) > 0,
    );
  }, [contacts]);

  const monthlyPartners = useMemo(() => allPartners.filter(isMonthlyPartner), [allPartners]);

  const oneTimeDonors = useMemo(
    () => allPartners.filter((c) => c.isOneTimeDonor && Number(c.oneTimeDonationAmount) > 0),
    [allPartners],
  );

  const oneTimeTotal = useMemo(
    () => oneTimeDonors.reduce((sum, c) => sum + (Number(c.oneTimeDonationAmount) || 0), 0),
    [oneTimeDonors],
  );

  const { homeCurrencyTotal: monthlyTotal } = useMemo(
    () => computePartnerCurrencyTotals(monthlyPartners, homeCurrency),
    [monthlyPartners, homeCurrency],
  );

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

  const reachOutPartners = useMemo(
    () =>
      monthlyPartners.filter((p) => daysSince(lastContactMap[p.id]) >= OVERDUE_CONTACT_DAYS),
    [monthlyPartners, lastContactMap],
  );

  const overdueCount = reachOutPartners.length;

  const reachOutIds = useMemo(() => new Set(reachOutPartners.map((p) => p.id)), [reachOutPartners]);

  const allGoodPartners = useMemo(
    () => allPartners.filter((p) => !reachOutIds.has(p.id)),
    [allPartners, reachOutIds],
  );

  const reachOutSorted = useMemo(
    () =>
      [...reachOutPartners].sort(
        (a, b) => daysSince(lastContactMap[b.id] ?? null) - daysSince(lastContactMap[a.id] ?? null),
      ),
    [reachOutPartners, lastContactMap],
  );

  const allGoodSorted = useMemo(() => {
    return [...allGoodPartners].sort((a, b) => {
      const aMonthly = isMonthlyPartner(a);
      const bMonthly = isMonthlyPartner(b);
      if (aMonthly !== bMonthly) return aMonthly ? -1 : 1;
      const da = daysSince(lastContactMap[a.id] ?? null);
      const db = daysSince(lastContactMap[b.id] ?? null);
      return db - da;
    });
  }, [allGoodPartners, lastContactMap]);

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
    openDrawer(p);
  }, [popupPartner, openDrawer]);

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
      currency: fullProfileForm.currency,
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

  const scrollToContact = useCallback(() => {}, []);

  const openPartnerDrawer = useCallback((partner) => {
    setCommActionError('');
    setPopupPartner(partner);
  }, []);

  return (
    <div className="space-y-6">
      <header className="-mx-5 -mt-5 shrink-0 border-b border-[#222] bg-[#111] px-5 py-4 text-white md:-mx-8 md:-mt-8 md:px-8">
        <h1 className="font-display text-[26px] leading-none tracking-wide">Partners</h1>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-[#333] bg-[#1a1a1a] px-2.5 py-2.5">
            <p className="font-display text-[22px] leading-none tracking-wide">
              {formatAmount(monthlyTotal, homeCurrency)}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]">Monthly</p>
            <p className="mt-0.5 text-[10px] text-green">
              {monthlyPartners.length === 1 ? '1 partner' : `${monthlyPartners.length} partners`}
            </p>
          </div>
          <div className="rounded-lg border border-[#333] bg-[#1a1a1a] px-2.5 py-2.5">
            <p className="font-display text-[22px] leading-none tracking-wide">
              {formatAmount(oneTimeTotal, homeCurrency)}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]">One-time</p>
            <p className="mt-0.5 text-[10px] text-green">
              {oneTimeDonors.length === 1 ? '1 gift' : `${oneTimeDonors.length} gifts`}
            </p>
          </div>
          <div className="rounded-lg border border-[#333] bg-[#1a1a1a] px-2.5 py-2.5">
            <p
              className={`font-display text-[22px] leading-none tracking-wide ${
                overdueCount > 0 ? 'text-[#E57373]' : 'text-green'
              }`}
            >
              {overdueCount}
            </p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#888]">Overdue</p>
            <p className={`mt-0.5 text-[10px] ${overdueCount > 0 ? 'text-[#E57373]' : 'text-green'}`}>
              reach out
            </p>
          </div>
        </div>
      </header>

      {allPartners.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No partners yet"
          subtitle="Add contacts on the Contacts tab and mark monthly amounts, one-time gifts, or partner status — they’ll roll up here."
          action={
            <Button type="button" onClick={() => navigate('/missionary/contacts')}>
              Open contacts
            </Button>
          }
        />
      ) : (
        <>
          {reachOutPartners.length > 0 ? (
            <section className="space-y-3" aria-labelledby="reach-out-heading">
              <h2 id="reach-out-heading" className="text-base font-semibold text-ink">
                Reach out now{' '}
                <span className="font-normal text-mission-muted">({reachOutPartners.length})</span>
              </h2>
              <ul className="space-y-2">
                {reachOutSorted.map((p) => (
                  <li key={p.id} className="list-none">
                    <NudgeCard
                      partner={p}
                      initials={partnerInitials(p.fullName)}
                      lastContactIso={lastContactMap[p.id] ?? null}
                      daysSinceContactLabel={daysSinceContactLabel}
                      savedNoticeId={savedNoticeId}
                      onOpen={() => openPartnerDrawer(p)}
                      onReachOut={() => openQuickLog(p)}
                      saveQuickTag={saveQuickTag}
                      patchContactInList={patchContactInList}
                      onAfterSave={() => void refetch()}
                      onPatchContact={(next) =>
                        setPopupPartner((cur) =>
                          cur && String(cur.id) === String(next.id) ? { ...cur, ...next } : cur,
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="space-y-3" aria-labelledby="all-partners-heading">
            <h2 id="all-partners-heading" className="text-base font-semibold text-ink">
              All good{' '}
              <span className="font-normal text-mission-muted">({allGoodPartners.length})</span>
            </h2>
            {lastContactLoading ? <p className="text-xs text-neutral-500">Loading touchpoints…</p> : null}
            {allGoodSorted.length === 0 ? (
              <div className="rounded-btn border border-dashed border-mission-line bg-[color:var(--color-bg)] px-4 py-6 text-center">
                <p className="text-sm font-semibold text-ink">All monthly partners need outreach</p>
                <p className="mt-2 text-sm text-mission-muted">Log a touchpoint to move partners into this list.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {allGoodSorted.map((p) => {
                  const last = lastContactMap[p.id] ?? null;
                  const badge = isMonthlyPartner(p) ? lastContactBadgeFromIso(last) : null;
                  const showOneTimeBadge = p.isOneTimeDonor && Number(p.oneTimeDonationAmount) > 0;
                  return (
                    <li key={p.id} className="list-none">
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-[12px] border-[0.5px] border-border bg-white p-3 text-left outline-none transition-colors duration-200 ease-out hover:bg-surface focus-visible:ring-2 focus-visible:ring-green/25"
                        onClick={() => openPartnerDrawer(p)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openPartnerDrawer(p);
                          }
                        }}
                      >
                        <span
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                          style={getContactAvatarStyle(p.category)}
                        >
                          {partnerInitials(p.fullName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="block truncate font-semibold text-ink">{p.fullName || 'Unnamed partner'}</span>
                            {savedNoticeId === p.id ? (
                              <span className="text-xs font-semibold text-emerald-700">Saved</span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-xs text-neutral-600">{partnerSubtitle(p)}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {showOneTimeBadge ? (
                            <span className="rounded-full bg-[#4CAF7D]/12 px-2 py-0.5 text-[10px] font-semibold text-[#2d7a52]">
                              One-time
                            </span>
                          ) : null}
                          {badge ? (
                            <span className={`text-xs ${badge.className}`}>{badge.label}</span>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}

      <PartnerSideDrawer
        partner={popupPartner}
        onClose={() => {
          setPopupPartner(null);
          setCommActionError('');
        }}
        lastContactIso={popupPartner ? lastContactMap[popupPartner.id] ?? null : null}
        onCall={handlePopupCall}
        onText={handlePopupText}
        onLog={handlePopupLog}
        onEditFullProfile={openFullProfileFromPopup}
        suppressEscape={Boolean(quickLog)}
        actionError={commActionError}
        saveQuickTag={saveQuickTag}
        patchContactInList={patchContactInList}
        updateContact={updateContact}
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
        backdropZIndex={DRAWER_STACK_QUICK_LOG_BACKDROP_Z}
        panelZIndex={DRAWER_STACK_QUICK_LOG_MODAL_Z}
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
