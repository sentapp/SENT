import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { stripOptionalContactColumnsFromRow, useSupabaseContacts } from '../../hooks/useSupabaseContacts';
import {
  NO_CONTACTS_IN_SHEET_MSG,
  flexibleImportFromSplitMatrix,
  parsePdfFile,
  parseSpreadsheetFlexible,
} from '../../lib/contactImport';
import { fetchGoogleSheetMatrix, userMessageForGoogleSheetImportFailure } from '../../lib/googleSheetsApi';
import { cleanEmail, extrasFromRejectedContactFields, mergeImportNotes } from '../../lib/contactImportClean';
import { cleanNotes, cleanPhone } from '../../lib/importCleaners';
import { formatPhone, phoneDigits } from '../../lib/phoneFormat';
import { phaseLabelFromPct } from '../../lib/importProgressText';
import {
  findEmailConflict,
  findPhoneConflict,
  isImportDuplicateByPhoneOrName,
  isImportDuplicateByPhoneOrNameAgainstRows,
} from '../../lib/contactDuplicates';
import {
  contactPickerResultsToDrafts,
  isContactPickerSupported,
} from '../../lib/phoneContacts';
import { supabase } from '../../lib/supabaseClient';
import { formatAmount, formatMonthlyAmount, normalizeCurrencyCode } from '../../lib/currencies';
import {
  CONTACT_CATEGORY_FILTER_TABS,
  normalizeCategory,
  normalizeCategoryForSave,
} from '../../lib/contactCategories';
import { safeCategoryValue } from '../../lib/safeCategory';
import { mergeNotesWithSocial, notesWithoutSocialBlock, splitSocialFromNotes } from '../../lib/contactSocialInNotes';
import { normalizeStatusForSave, normalizeStatusFromDb, statusLabel } from '../../lib/contactStatuses';
import { normalizeRelationshipForSave } from '../../lib/contactRelationships';
import {
  ContactQuickLogPopup,
} from '../../components/contacts/ContactQuickViewPopup';
import { ContactSideDrawer } from '../../components/contacts/ContactSideDrawer';
import {
  DRAWER_STACK_QUICK_LOG_BACKDROP_Z,
  DRAWER_STACK_QUICK_LOG_MODAL_Z,
} from '../../components/contacts/quickViewOverlayZIndex';
import { ContactThreeQuickTagRows } from '../../components/contacts/QuickTagPopover';
import { Button, EmptyState, Input, LoadingSpinner, Modal } from '../../components/ui';
import ContactEditFormLayout from './ContactEditFormLayout';

/** Pipeline strip: active outreach stages, excluding monthly supporters (shown under Partners). */
const PIPELINE_STRIP_VISIBLE_STATUSES = ['contacted', 'meeting_scheduled', 'committed'];
const PIPELINE_STRIP_SET = new Set(PIPELINE_STRIP_VISIBLE_STATUSES);
function isPipelineStripContact(c) {
  const st = normalizeStatusFromDb(c.status);
  return PIPELINE_STRIP_SET.has(st) && normalizeCategory(c.category) !== 'supporter';
}
const STRIP_DOT = {
  contacted: '#2A9A58',
  meeting_scheduled: '#C17A00',
  committed: '#6040B0',
};
const STRIP_STAGE_LABEL = {
  contacted: 'Contacted',
  meeting_scheduled: 'Meeting',
  committed: 'Committed',
};

const FILTERS = CONTACT_CATEGORY_FILTER_TABS;
const VALID_CONTACT_FILTER_VALUES = new Set(FILTERS.map((f) => f.value));

function filterContacts(contacts, activeFilter) {
  switch (activeFilter) {
    case 'all':
      return contacts;
    case 'supporter':
      return contacts.filter(
        (c) =>
          normalizeCategory(c.category) === 'supporter' ||
          normalizeStatusFromDb(c.status) === 'partner' ||
          (c.monthlyAmount != null && Number(c.monthlyAmount) > 0),
      );
    case 'church':
      return contacts.filter((c) => normalizeCategory(c.category) === 'church');
    case 'former':
      return contacts.filter((c) => normalizeCategory(c.category) === 'former');
    case 'connector':
      return contacts.filter((c) => normalizeCategory(c.category) === 'connector');
    case 'individual':
      return contacts.filter((c) => normalizeCategory(c.category) === 'individual');
    default:
      return contacts;
  }
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

function cleanDisplayNotes(notes) {
  const body = notesWithoutSocialBlock(notes);
  if (!body) return '';
  const trimmed = body.toString().trim();
  if (/^\d+$/.test(trimmed)) return '';
  return trimmed;
}

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

function ImportBlockingOverlay({ open, progress, onCancel }) {
  if (!open || typeof document === 'undefined') return null;

  const pctRaw = progress != null && typeof progress.pct === 'number' ? progress.pct : 0;
  const pct = Math.min(100, Math.max(0, pctRaw));
  const phaseTitle = phaseLabelFromPct(pct);
  const pctLabel = `${Math.round(pct)}%`;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[1000] bg-[rgba(0,0,0,0.5)]" aria-hidden />
      <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-[90%] max-w-[340px] rounded-[12px] bg-white p-8 text-center shadow-[0_4px_24px_rgba(0,0,0,0.15)]"
          style={{ backgroundColor: '#ffffff', opacity: 1 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-loading-title"
          aria-live="polite"
        >
          <div className="flex flex-col items-center gap-5">
            <LoadingSpinner className="!gap-0" />
            <p id="import-loading-title" className="text-base font-bold text-ink">
              {phaseTitle}
            </p>
            <div className="flex w-full items-center justify-between gap-3 text-sm font-semibold text-neutral-800">
              <span className="truncate">{pctLabel}</span>
              {progress?.processed != null && progress?.total != null ? (
                <span className="text-xs font-normal text-neutral-500">
                  {progress.processed} / {progress.total}
                </span>
              ) : null}
            </div>
            <div className="w-full space-y-2">
              <div className="garden-progress-track">
                <div className="garden-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              {progress?.note ? <p className="text-xs text-muted">{progress.note}</p> : null}
            </div>
            <Button type="button" variant="secondary" className="mt-1 w-full text-sm" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

export default function MissionaryContacts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const oneTimeDonorFilter = searchParams.get('filter') === 'one_time';

  const urlContactIntent = useMemo(() => {
    const edit = searchParams.get('edit');
    const contact = searchParams.get('contact');
    const id = edit || contact;
    return { id, forceEdit: Boolean(edit) };
  }, [searchParams]);

  const { user, profile, loading: authLoading } = useAuth();
  const defaultContactCurrency = normalizeCurrencyCode(profile?.home_currency);
  const {
    contacts,
    loading,
    error: loadError,
    schemaPartial,
    unexpectedEmptyWarning,
    acceptEmptyAsValid,
    refetch,
    insertContact,
    updateContact,
    saveQuickTag,
    patchContactInList,
    deleteContact,
    removeDuplicateContacts,
  } = useSupabaseContacts(user?.id, { authLoading });

  const [activeFilter, setActiveFilter] = useState('all');
  useEffect(() => {
    if (!VALID_CONTACT_FILTER_VALUES.has(activeFilter)) setActiveFilter('all');
  }, [activeFilter]);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saveError, setSaveError] = useState('');
  const [contactSaveSuccess, setContactSaveSuccess] = useState('');

  const [importOpen, setImportOpen] = useState(false);
  const [importTab, setImportTab] = useState('excel');
  const [sheetUrl, setSheetUrl] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileInputRef = useRef(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [importSummary, setImportSummary] = useState(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [bulkDeleteTargetCount, setBulkDeleteTargetCount] = useState(0);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState('');
  const [bulkDeleteBanner, setBulkDeleteBanner] = useState(null);
  const [dedupeLoading, setDedupeLoading] = useState(false);
  const [dedupeBanner, setDedupeBanner] = useState(null);

  const [drawerContact, setDrawerContact] = useState(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logType, setLogType] = useState('call');
  const [logText, setLogText] = useState('');
  const [logSaving, setLogSaving] = useState(false);
  const [logError, setLogError] = useState('');
  const [loggedSuccess, setLoggedSuccess] = useState(false);
  const [activityLogRefreshKey, setActivityLogRefreshKey] = useState(0);
  const [commActionError, setCommActionError] = useState('');

  const sessionRef = useRef(0);
  const contactUrlHandledRef = useRef(null);
  const importAbortRef = useRef(null);
  const [importReading, setImportReading] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

  const listRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const originalFormSnapshotRef = useRef('');
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);

  const captureListScroll = useCallback(() => {
    scrollPositionRef.current = listRef.current?.scrollTop ?? 0;
  }, []);

  const restoreListScroll = useCallback(() => {
    const y = scrollPositionRef.current;
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = y;
    });
  }, []);

  const closeDetail = useCallback(
    ({ restoreScroll = true } = {}) => {
      setDrawerContact(null);
      setShowLogModal(false);
      setLogText('');
      setLogError('');
      setLoggedSuccess(false);
      setCommActionError('');
      if (restoreScroll) restoreListScroll();
    },
    [restoreListScroll],
  );

  const handleOpenContact = useCallback(
    (c) => {
      if (!c) return;
      captureListScroll();
      setCommActionError('');
      setLoggedSuccess(false);
      setDrawerContact(c);
    },
    [captureListScroll],
  );

  const beginImportSession = useCallback(() => {
    sessionRef.current += 1;
    const sessionId = sessionRef.current;
    importAbortRef.current = new AbortController();
    return { sessionId, signal: importAbortRef.current.signal };
  }, []);

  const cancelImport = useCallback(() => {
    sessionRef.current += 1;
    importAbortRef.current?.abort();
    importAbortRef.current = null;
    setImportReading(false);
    setImportProgress(null);
    setImportBusy(false);
  }, []);

  useEffect(() => {
    if (!importSummary) return undefined;
    const t = setTimeout(() => setImportSummary(null), 10000);
    return () => clearTimeout(t);
  }, [importSummary]);

  useEffect(() => {
    if (!contactSaveSuccess) return undefined;
    const t = setTimeout(() => setContactSaveSuccess(''), 8000);
    return () => clearTimeout(t);
  }, [contactSaveSuccess]);

  useEffect(() => {
    if (!bulkDeleteBanner) return undefined;
    const t = setTimeout(() => setBulkDeleteBanner(null), 10000);
    return () => clearTimeout(t);
  }, [bulkDeleteBanner]);

  useEffect(() => {
    if (!dedupeBanner) return undefined;
    const t = setTimeout(() => setDedupeBanner(null), 10000);
    return () => clearTimeout(t);
  }, [dedupeBanner]);

  const resetImportWizard = () => {
    setImportTab('excel');
    setSheetUrl('');
    setImportMsg('');
    setImportReading(false);
    setImportProgress(null);
    setImportBusy(false);
  };

  const openImport = () => {
    cancelImport();
    setImportSummary(null);
    resetImportWizard();
    setImportOpen(true);
  };

  const closeImport = () => {
    cancelImport();
    setImportOpen(false);
    resetImportWizard();
  };

  const bulkInsertParsedContacts = useCallback(
    async (items, onProgress) => {
      if (!supabase) throw new Error('Supabase is not configured.');
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) throw new Error('Not signed in.');
      if (!items?.length) return { inserted: 0, skippedDuplicates: 0 };

      const { data: existingRows, error: existingErr } = await supabase
        .from('contacts')
        .select('full_name, phone')
        .eq('missionary_id', user.id);
      if (existingErr) throw existingErr;
      const existingContacts = (existingRows || []).map((r) => ({
        fullName: r.full_name || '',
        phone: r.phone || '',
      }));

      let skippedDuplicates = 0;
      const rows = [];

      for (const d of items) {
        const originalPhone = String(d.phone ?? '').trim();
        const originalEmail = String(d.email ?? '').trim();
        const phone = cleanPhone(originalPhone);
        const email = cleanEmail(originalEmail);
        const extras = extrasFromRejectedContactFields(phone, email, originalPhone, originalEmail);
        const notes = mergeImportNotes(cleanNotes(String(d.notes ?? '').trim()), extras);
        const row = {
          missionary_id: user.id,
          full_name: String(d.full_name ?? d.fullName ?? d.name ?? '').trim() || 'Imported contact',
          phone,
          email,
          address: String(d.address ?? '').trim(),
          category: safeCategoryValue(normalizeCategoryForSave(d.category)),
          status: normalizeStatusForSave(d.status),
          notes,
          monthly_amount: Number.isFinite(Number(d.monthly_amount)) ? Number(d.monthly_amount) : 0,
          currency: normalizeCurrencyCode(d.currency ?? defaultContactCurrency),
          is_one_time_donor: Boolean(d.is_one_time_donor ?? d.isOneTimeDonor),
          one_time_donation_amount: Number.isFinite(Number(d.one_time_donation_amount))
            ? Number(d.one_time_donation_amount)
            : 0,
          one_time_donation_date: d.one_time_donation_date
            ? String(d.one_time_donation_date).slice(0, 10)
            : null,
        };

        if (
          isImportDuplicateByPhoneOrName(row, existingContacts) ||
          isImportDuplicateByPhoneOrNameAgainstRows(row, rows)
        ) {
          skippedDuplicates += 1;
          continue;
        }
        rows.push(row);
      }

      if (!rows.length) {
        return { inserted: 0, skippedDuplicates };
      }

      const BATCH = 100;
      let inserted = 0;
      const total = rows.length;
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows
          .slice(i, i + BATCH)
          .map((r) => stripOptionalContactColumnsFromRow(r, schemaPartial));
        const { data, error } = await supabase.from('contacts').insert(chunk).select();
        if (error) throw error;
        inserted += data?.length ?? chunk.length;
        onProgress?.({ inserted, total });
      }
      if (skippedDuplicates > 0) {
        console.log('[import] Skipped duplicate contacts (same phone or normalized name):', skippedDuplicates);
      }
      return { inserted, skippedDuplicates };
    },
    [schemaPartial, defaultContactCurrency],
  );

  const finalizeImportSuccess = async (imported, skippedDuplicates = 0) => {
    await refetch();
    setImportSummary({ imported, skipped: skippedDuplicates, updated: 0 });
    setImportOpen(false);
    setImportBusy(false);
    setImportReading(false);
    setImportProgress(null);
    setImportMsg('');
    setSheetUrl('');
    setImportTab('excel');
  };

  const runSheetFetch = async () => {
    const { sessionId, signal } = beginImportSession();
    console.log('[import] Google Sheet fetch start', { sessionId });
    setImportBusy(true);
    setImportReading(true);
    setImportProgress({ pct: 0 });
    setImportMsg('');
    try {
      const m = await fetchGoogleSheetMatrix(sheetUrl.trim(), {
        signal,
        onProgress: (u) => {
          if (sessionId !== sessionRef.current) return;
          setImportProgress({
            pct: u.pct ?? 0,
            note: u.note,
            processed: u.processed,
            total: u.total,
          });
        },
      });
      if (sessionId !== sessionRef.current) return;
      console.log('[import] Google Sheet matrix loaded');
      const drafts = flexibleImportFromSplitMatrix(m, 'Google Sheet', { defaultCurrency: defaultContactCurrency });
      if (!drafts.length) {
        setImportMsg(NO_CONTACTS_IN_SHEET_MSG);
        return;
      }
      setImportProgress({ pct: 90, note: 'Saving contacts…' });
      const { inserted, skippedDuplicates } = await bulkInsertParsedContacts(drafts, ({ inserted: ins, total }) => {
        if (sessionId !== sessionRef.current) return;
        setImportProgress({
          pct: total ? 90 + Math.min(9, Math.round((ins / total) * 9)) : 95,
          note: `Importing… ${ins} of ${total}`,
          processed: ins,
          total,
        });
      });
      if (sessionId !== sessionRef.current) return;
      await finalizeImportSuccess(inserted, skippedDuplicates);
    } catch (e) {
      if (sessionId !== sessionRef.current) return;
      console.error('[import] Google Sheets import fetch failed', e);
      const msg = userMessageForGoogleSheetImportFailure(e);
      setImportMsg(msg || 'Could not load the sheet.');
    } finally {
      setImportBusy(false);
      setImportReading(false);
      setImportProgress(null);
    }
  };

  const onSpreadsheetFile = async (file) => {
    const { sessionId, signal } = beginImportSession();
    console.log('[import] spreadsheet file', file?.name, { sessionId });
    setImportBusy(true);
    setImportReading(true);
    setImportProgress({ pct: 0 });
    setImportMsg('');
    try {
      const drafts = await parseSpreadsheetFlexible(file, {
        defaultCurrency: defaultContactCurrency,
        signal,
        onProgress: ({ pct, note, processed, total }) => {
          if (sessionId !== sessionRef.current) return;
          setImportProgress({ pct: pct ?? 0, note, processed, total });
        },
      });
      if (sessionId !== sessionRef.current) return;
      if (!drafts.length) {
        setImportMsg(NO_CONTACTS_IN_SHEET_MSG);
        return;
      }
      setImportProgress({ pct: 90, note: 'Saving contacts…' });
      const { inserted, skippedDuplicates } = await bulkInsertParsedContacts(drafts, ({ inserted: ins, total }) => {
        if (sessionId !== sessionRef.current) return;
        setImportProgress({
          pct: total ? 90 + Math.min(9, Math.round((ins / total) * 9)) : 95,
          note: `Importing… ${ins} of ${total}`,
          processed: ins,
          total,
        });
      });
      if (sessionId !== sessionRef.current) return;
      await finalizeImportSuccess(inserted, skippedDuplicates);
    } catch (e) {
      if (e?.name === 'AbortError' || sessionId !== sessionRef.current) return;
      console.error('[import] spreadsheet parse failed', e);
      setImportMsg(e?.message || 'Could not read file.');
    } finally {
      setImportBusy(false);
      setImportReading(false);
      setImportProgress(null);
    }
  };

  const onPdfFile = async (file) => {
    const { sessionId } = beginImportSession();
    console.log('[import] PDF file', file?.name);
    setImportBusy(true);
    setImportReading(true);
    setImportProgress({ pct: 0 });
    setImportMsg('');
    try {
      const rows = await parsePdfFile(file, {
        shouldCancel: () => sessionId !== sessionRef.current,
        onProgress: ({ pct, note, processed, total }) => {
          if (sessionId !== sessionRef.current) return;
          setImportProgress({ pct: pct ?? 0, note, processed, total });
        },
      });
      if (sessionId !== sessionRef.current) return;
      console.log('[import] PDF parsed rows', rows?.length);
      if (!rows.length) {
        setImportMsg('No contacts detected in PDF.');
        return;
      }
      setImportProgress({ pct: 90, note: 'Saving contacts…' });
      const { inserted, skippedDuplicates } = await bulkInsertParsedContacts(rows, ({ inserted: ins, total }) => {
        if (sessionId !== sessionRef.current) return;
        setImportProgress({
          pct: total ? 90 + Math.min(9, Math.round((ins / total) * 9)) : 95,
          note: `Importing… ${ins} of ${total}`,
          processed: ins,
          total,
        });
      });
      if (sessionId !== sessionRef.current) return;
      await finalizeImportSuccess(inserted, skippedDuplicates);
    } catch (e) {
      if (sessionId !== sessionRef.current) return;
      console.error('[import] PDF failed', e);
      const msg = e?.message || String(e) || 'Could not read PDF.';
      setImportMsg(msg.startsWith('PDF error:') ? msg : `PDF error: ${msg}`);
    } finally {
      setImportBusy(false);
      setImportReading(false);
      setImportProgress(null);
    }
  };

  const runPhonePicker = async () => {
    if (!isContactPickerSupported()) return;
    const { sessionId } = beginImportSession();
    setImportBusy(true);
    setImportReading(true);
    setImportProgress({ pct: 50, note: 'Opening picker…' });
    setImportMsg('');
    try {
      const picked = await navigator.contacts.select(['name', 'tel', 'email'], { multiple: true });
      if (sessionId !== sessionRef.current) return;
      const list = contactPickerResultsToDrafts(picked || []);
      console.log('[import] phone picker contacts', list.length);
      if (!list.length) {
        setImportMsg('No contacts selected.');
        return;
      }
      setImportProgress({ pct: 90, note: 'Saving contacts…' });
      const { inserted, skippedDuplicates } = await bulkInsertParsedContacts(list, ({ inserted: ins, total }) => {
        if (sessionId !== sessionRef.current) return;
        setImportProgress({
          pct: total ? 90 + Math.min(9, Math.round((ins / total) * 9)) : 95,
          note: `Importing… ${ins} of ${total}`,
          processed: ins,
          total,
        });
      });
      if (sessionId !== sessionRef.current) return;
      await finalizeImportSuccess(inserted, skippedDuplicates);
    } catch (e) {
      if (sessionId !== sessionRef.current) return;
      if (e?.name === 'AbortError') setImportMsg('Cancelled.');
      else setImportMsg(e?.message || 'Could not read contacts.');
    } finally {
      setImportBusy(false);
      setImportReading(false);
      setImportProgress(null);
    }
  };

  const openAdd = () => {
    setEditingId(null);
    const next = { ...emptyForm, currency: defaultContactCurrency };
    setForm(next);
    originalFormSnapshotRef.current = contactFormSnapshot(next);
    setSaveError('');
    setContactSaveSuccess('');
    setDiscardConfirmOpen(false);
    setModalOpen(true);
  };

  const openEdit = useCallback((c) => {
    setContactSaveSuccess('');
    setEditingId(c.id);
    const nextForm = {
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      address: c.address || '',
      ...(() => {
        const { social, bodyNotes } = splitSocialFromNotes(c.notes);
        return { social, notes: cleanDisplayNotes(bodyNotes) };
      })(),
      // Map legacy categories into the current enum set for the form.
      category: normalizeCategoryForSave(c.category),
      status: normalizeStatusFromDb(c.status),
      relationship: c.relationship != null && String(c.relationship).trim() !== '' ? String(c.relationship).trim() : '',
      monthlyAmount: c.monthlyAmount ? String(c.monthlyAmount) : '',
      currency: normalizeCurrencyCode(c.currency),
      isOneTimeDonor: Boolean(c.isOneTimeDonor),
      oneTimeDonationAmount:
        c.oneTimeDonationAmount != null && Number(c.oneTimeDonationAmount) > 0
          ? String(c.oneTimeDonationAmount)
          : '',
      oneTimeDonationDate: c.oneTimeDonationDate || '',
    };
    originalFormSnapshotRef.current = contactFormSnapshot(nextForm);
    setForm(nextForm);
    setSaveError('');
    setDiscardConfirmOpen(false);
    setModalOpen(true);
  }, []);

  const stripContactParams = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('edit');
        next.delete('contact');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  const contactFromUrl = urlContactIntent.id;
  useEffect(() => {
    if (!contactFromUrl) {
      contactUrlHandledRef.current = null;
      return;
    }
    if (loading || authLoading) return;
    if (contactUrlHandledRef.current === contactFromUrl) return;
    const c = contacts.find((x) => String(x.id) === String(contactFromUrl));
    if (!c) {
      contactUrlHandledRef.current = null;
      stripContactParams();
      return;
    }
    contactUrlHandledRef.current = contactFromUrl;
    if (urlContactIntent.forceEdit) {
      captureListScroll();
      openEdit(c);
    } else {
      handleOpenContact(c);
    }
    stripContactParams();
  }, [
    contactFromUrl,
    urlContactIntent.forceEdit,
    loading,
    authLoading,
    contacts,
    openEdit,
    stripContactParams,
    captureListScroll,
    handleOpenContact,
  ]);

  useEffect(() => {
    if (!drawerContact?.id) return;
    const fresh = contacts.find((x) => String(x.id) === String(drawerContact.id));
    if (fresh) setDrawerContact(fresh);
  }, [contacts, drawerContact?.id]);

  const saveContact = async () => {
    setSaveError('');
    setContactSaveSuccess('');
    if (!form.fullName.trim()) {
      setSaveError('Name is required.');
      return;
    }

    const oneTimeAmt = Number.parseFloat(String(form.oneTimeDonationAmount ?? '').replace(/,/g, ''));
    const isOneTimeDonorEffective =
      Boolean(form.isOneTimeDonor) || (Number.isFinite(oneTimeAmt) && oneTimeAmt > 0);

    if (editingId) {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone,
        email: form.email,
        address: form.address,
        category: safeCategoryValue(normalizeCategoryForSave(form.category)),
        status: normalizeStatusForSave(form.status),
        relationship: normalizeRelationshipForSave(form.relationship) ?? '',
        monthlyAmount: form.monthlyAmount,
        currency: form.currency,
        isOneTimeDonor: isOneTimeDonorEffective,
        oneTimeDonationAmount: form.oneTimeDonationAmount,
        oneTimeDonationDate: form.oneTimeDonationDate,
        notes: mergeNotesWithSocial(form.notes, form.social),
      };
      const res = await updateContact(editingId, payload);
      if (!res.ok) {
        setSaveError(res.error || 'Could not save.');
        return;
      }
      await refetch();
      setModalOpen(false);
      restoreListScroll();
      setContactSaveSuccess('Contact saved');
      return;
    }

    const categorySaved = safeCategoryValue(normalizeCategoryForSave(form.category));
    const statusSaved = normalizeStatusForSave(form.status);

    const res = await insertContact({
      fullName: form.fullName.trim(),
      phone: form.phone,
      email: form.email,
      address: form.address,
      category: categorySaved,
      status: statusSaved,
      relationship: normalizeRelationshipForSave(form.relationship) ?? '',
      monthlyAmount: form.monthlyAmount,
      currency: form.currency,
      isOneTimeDonor: isOneTimeDonorEffective,
      oneTimeDonationAmount: form.oneTimeDonationAmount,
      oneTimeDonationDate: form.oneTimeDonationDate,
      notes: mergeNotesWithSocial(form.notes, form.social),
    });
    if (!res.ok) {
      setSaveError(res.error || 'Could not save contact.');
      return;
    }
    setModalOpen(false);
    restoreListScroll();
    setContactSaveSuccess('Contact saved');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteContact(deleteTarget.id);
    if (!res.ok) setImportMsg(res.error || 'Delete failed.');
    setDeleteTarget(null);
  };

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    return filterContacts(contacts, activeFilter)
      .filter((c) => {
        if (oneTimeDonorFilter && !c.isOneTimeDonor) return false;
        return true;
      })
      .filter((c) => {
        if (!q) return true;
        return (
          (c.fullName || '').toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.phone || '').toLowerCase().includes(q) ||
          (c.address || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', undefined, { sensitivity: 'base' }));
  }, [contacts, oneTimeDonorFilter, activeFilter, query]);

  const pipelineStripContacts = useMemo(
    () =>
      contacts
        .filter(isPipelineStripContact)
        .sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '', undefined, { sensitivity: 'base' })),
    [contacts],
  );

  const enterSelectMode = () => {
    setSelectMode(true);
    setSelectedIds(new Set());
    setBulkDeleteError('');
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBulkDeleteConfirmOpen(false);
    setBulkDeleteError('');
  };

  const toggleContactSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filteredSorted.map((c) => c.id)));
  };

  const openBulkDeleteModal = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteTargetCount(selectedIds.size);
    setBulkDeleteError('');
    setBulkDeleteConfirmOpen(true);
  };

  const runRemoveDuplicates = async () => {
    setDedupeLoading(true);
    try {
      const res = await removeDuplicateContacts();
      if (!res.ok) {
        setImportMsg(res.error || 'Could not remove duplicates.');
        return;
      }
      setDedupeBanner({ removed: res.removed ?? 0 });
    } finally {
      setDedupeLoading(false);
    }
  };

  const runBulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    if (!supabase) {
      setBulkDeleteError('Supabase is not configured.');
      return;
    }
    setBulkDeleteLoading(true);
    setBulkDeleteError('');
    try {
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();
      if (!authUser?.id) {
        // eslint-disable-next-line no-console
        console.error('[contacts] No user ID — aborting delete');
        setBulkDeleteError('Not signed in.');
        return;
      }
      // Safety: only delete rows owned by this missionary (never delete without missionary_id filter).
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', ids)
        .eq('missionary_id', authUser.id);
      if (error) {
        setBulkDeleteError(error.message);
        return;
      }
      await refetch({ trustEmpty: true });
      setBulkDeleteBanner({ count: ids.length });
      exitSelectMode();
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const selectedCount = selectedIds.size;

  const phoneDupWarn = useMemo(
    () => findPhoneConflict(form.phone, contacts, { excludeId: editingId }),
    [form.phone, contacts, editingId],
  );
  const emailDupWarn = useMemo(
    () => findEmailConflict(form.email, contacts, { excludeId: editingId }),
    [form.email, contacts, editingId],
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!modalOpen) return false;
    return contactFormSnapshot(form) !== originalFormSnapshotRef.current;
  }, [modalOpen, form]);

  const requestCloseAddEditModal = useCallback(() => {
    if (hasUnsavedChanges) {
      setDiscardConfirmOpen(true);
      return;
    }
    setModalOpen(false);
    setSaveError('');
    restoreListScroll();
  }, [hasUnsavedChanges, restoreListScroll]);

  const confirmDiscardAndCloseModal = useCallback(() => {
    setDiscardConfirmOpen(false);
    setModalOpen(false);
    setSaveError('');
    restoreListScroll();
  }, [restoreListScroll]);

  const scrollToContact = useCallback(
    (id) => {
      setModalOpen(false);
      closeDetail({ restoreScroll: false });
      requestAnimationFrame(() => {
        document.getElementById(`contact-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    },
    [closeDetail],
  );

  useEffect(() => {
    if (!loggedSuccess) return undefined;
    const t = setTimeout(() => setLoggedSuccess(false), 4000);
    return () => clearTimeout(t);
  }, [loggedSuccess]);

  const logCommunication = useCallback(
    async (type, notes = '') => {
      if (!supabase || !drawerContact?.id) {
        return { ok: false, error: 'No contact selected.' };
      }
      const {
        data: { user: authUser },
        error: userErr,
      } = await supabase.auth.getUser();
      const mid = !userErr && authUser?.id ? authUser.id : null;
      if (!mid) return { ok: false, error: 'Not signed in.' };
      const created_at = new Date().toISOString();
      const { error } = await supabase.from('communication_logs').insert({
        missionary_id: mid,
        contact_id: drawerContact.id,
        comm_type: type,
        notes: notes ?? '',
        created_at,
      });
      if (error) return { ok: false, error: error.message || 'Could not save log.' };
      await refetch();
      return { ok: true, created_at };
    },
    [drawerContact?.id, refetch],
  );

  const handleCall = useCallback(() => {
    const phone = drawerContact?.phone;
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
      const res = await logCommunication('call', '');
      if (!res.ok) {
        setCommActionError(res.error || 'Could not log call.');
      }
    })();
  }, [drawerContact?.phone, logCommunication]);

  const handleText = useCallback(() => {
    const phone = drawerContact?.phone;
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
      const res = await logCommunication('text', '');
      if (!res.ok) {
        setCommActionError(res.error || 'Could not log text.');
      }
    })();
  }, [drawerContact?.phone, logCommunication]);

  const openQuickLogFromDetail = useCallback(() => {
    setLogType('call');
    setLogText('');
    setLogError('');
    setShowLogModal(true);
  }, []);

  const submitQuickLog = useCallback(async () => {
    if (!logType) return;
    setLogError('');
    setLogSaving(true);
    try {
      const res = await logCommunication(logType, logText.trim());
      if (!res.ok) {
        setLogError(res.error || 'Could not save log.');
        return;
      }
      setShowLogModal(false);
      setLogText('');
      setLoggedSuccess(true);
      setActivityLogRefreshKey((k) => k + 1);
    } catch (e) {
      setLogError(e?.message || 'Could not save log.');
    } finally {
      setLogSaving(false);
    }
  }, [logCommunication, logType, logText]);

  const showEmpty = !loading && contacts.length === 0 && !unexpectedEmptyWarning;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="sent-page-title">
            Contacts <span className="text-lg font-semibold text-mission-muted">({contacts.length})</span>
          </h1>
        </div>
        {selectMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink">{selectedCount} selected</span>
            <Button variant="secondary" type="button" onClick={selectAllFiltered}>
              Select all
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={selectedCount === 0 || bulkDeleteLoading}
              onClick={openBulkDeleteModal}
            >
              Delete selected
            </Button>
            <Button variant="secondary" type="button" onClick={exitSelectMode}>
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" type="button" onClick={openImport}>
              Import
            </Button>
            <Button type="button" onClick={openAdd}>
              + Add
            </Button>
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center rounded-btn border border-mission-line bg-surface px-3 py-2 text-sm font-semibold text-ink marker:hidden [&::-webkit-details-marker]:hidden">
                More
              </summary>
              <div className="absolute right-0 z-30 mt-1 min-w-[220px] rounded-card border border-mission-line bg-surface p-2 shadow-lg">
                <Button
                  variant="ghost"
                  type="button"
                  className="w-full justify-start text-sm font-medium"
                  disabled={dedupeLoading || loading}
                  onClick={() => void runRemoveDuplicates()}
                >
                  {dedupeLoading ? 'Working…' : 'Remove duplicates'}
                </Button>
                <Button variant="ghost" type="button" className="w-full justify-start text-sm font-medium" onClick={enterSelectMode}>
                  Select contacts
                </Button>
              </div>
            </details>
          </div>
        )}
      </header>

      {importSummary ? (
        <div className="rounded-btn border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p>
            {importSummary.imported} contact{importSummary.imported === 1 ? '' : 's'} imported
          </p>
          {importSummary.skipped > 0 ? (
            <p className="mt-1 text-emerald-800">
              {importSummary.skipped} duplicate{importSummary.skipped === 1 ? '' : 's'} skipped (same phone or name
              already in your list)
            </p>
          ) : null}
        </div>
      ) : null}

      {bulkDeleteBanner ? (
        <div className="rounded-btn border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p>
            {bulkDeleteBanner.count} contact{bulkDeleteBanner.count === 1 ? '' : 's'} deleted
          </p>
        </div>
      ) : null}

      {dedupeBanner ? (
        <div className="rounded-btn border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <p>
            {dedupeBanner.removed === 0
              ? 'No duplicate contacts found.'
              : `${dedupeBanner.removed} duplicate${dedupeBanner.removed === 1 ? '' : 's'} removed`}
          </p>
        </div>
      ) : null}

      {contactSaveSuccess ? (
        <div className="rounded-btn border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {contactSaveSuccess}
        </div>
      ) : null}

      {loggedSuccess ? (
        <div className="rounded-btn border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900" role="status">
          Logged successfully
        </div>
      ) : null}

      {loadError ? (
        <p className="rounded-btn border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError}</p>
      ) : null}

      {unexpectedEmptyWarning ? (
        <div className="rounded-btn border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Something may have gone wrong loading your contacts — try refreshing</p>
          <p className="mt-1 text-amber-900/90">
            Your list is unchanged. This can happen with a session glitch or RLS. In Supabase, open{' '}
            <strong>Table Editor → contacts</strong> to confirm your rows still exist.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void refetch()}>
              Retry refresh
            </Button>
            <Button type="button" variant="secondary" onClick={() => void acceptEmptyAsValid()}>
              My list really is empty
            </Button>
          </div>
        </div>
      ) : null}

      {schemaPartial ? (
        <div className="rounded-btn border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Database upgrade suggested</p>
          <p className="mt-1 text-amber-900/90">
            Your contacts are loading with core fields only. Run the latest Supabase migrations for optional columns
            (address, one-time donor fields, relationship). Until then, those fields won&apos;t save.
          </p>
        </div>
      ) : null}

      {oneTimeDonorFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-btn border border-mission-ink/20 bg-mission-ink/5 px-4 py-3 text-sm text-neutral-800">
          <p>
            <span className="font-semibold">One-time donors</span> — showing contacts marked as one-time givers.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 text-sm"
            onClick={() => {
              setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete('filter');
                return next;
              });
            }}
          >
            Show all contacts
          </Button>
        </div>
      ) : null}

      <div className="rounded-card border border-mission-line bg-surface p-4 flex flex-col gap-4">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts…"
          className="py-3 text-sm"
        />
        <div
          className="grid w-full gap-1 rounded-lg border border-mission-line bg-neutral-100 p-1"
          style={{ gridTemplateColumns: `repeat(${FILTERS.length}, minmax(0, 1fr))` }}
          role="tablist"
          aria-label="Filter contacts by category"
        >
          {FILTERS.map((t) => {
            const active = activeFilter === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveFilter(t.value)}
                className={`min-h-[44px] rounded-md px-1 py-2 text-center text-xs font-semibold leading-tight transition sm:px-2 sm:text-sm ${
                  active
                    ? 'border-b-2 border-green bg-white text-green shadow-sm'
                    : 'border-b-2 border-transparent text-neutral-600 hover:bg-white/70'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={listRef}
        className="flex min-h-0 flex-col gap-4 overflow-y-auto [-webkit-overflow-scrolling:touch] max-h-[calc(100dvh-15rem)] md:max-h-[calc(100dvh-11rem)]"
      >
        {!loading && contacts.length > 0 && pipelineStripContacts.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-mission-muted">Pipeline</p>
            <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 pt-0.5 [-webkit-overflow-scrolling:touch]">
              {pipelineStripContacts.map((c) => {
                const st = normalizeStatusFromDb(c.status);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleOpenContact(c)}
                    className="w-[min(200px,72vw)] shrink-0 cursor-pointer rounded-card border border-mission-line bg-white p-3 text-left shadow-none transition-colors hover:border-green/30 hover:bg-surface"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: STRIP_DOT[st] || '#78716c' }}
                        aria-hidden
                      />
                      <span className="truncate text-[10px] font-bold uppercase tracking-wide text-mission-muted">
                        {STRIP_STAGE_LABEL[st] || statusLabel(c.status)}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold text-ink">{c.fullName || 'Unnamed'}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-600">{formatPhone(c.phone) || '—'}</p>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={openAdd}
                className="flex min-w-[100px] shrink-0 flex-col items-center justify-center rounded-card border border-dashed border-mission-line bg-[color:var(--color-bg)] px-4 py-3 text-sm font-semibold text-accent shadow-none"
              >
                + Add
              </button>
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="text-center text-sm text-neutral-500">Loading contacts…</p>
        ) : showEmpty ? (
          <EmptyState
            icon="compass"
            title="No contacts yet"
            subtitle="Import a spreadsheet or add someone you’re inviting to partner with your ministry."
            action={
              <Button type="button" onClick={openAdd}>
                Add contact
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col space-y-2">
            {filteredSorted.map((c) => (
              <div
                key={c.id}
                id={`contact-${c.id}`}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (selectMode) toggleContactSelected(c.id);
                  else handleOpenContact(c);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (selectMode) toggleContactSelected(c.id);
                    else handleOpenContact(c);
                  }
                }}
                className="scroll-mt-4 cursor-pointer rounded-[12px] border-[0.5px] border-border bg-white px-[14px] py-3 text-left shadow-none transition-colors duration-200 ease-out hover:bg-surface"
              >
                <div className="flex flex-row flex-nowrap items-start gap-3">
                  {selectMode ? (
                    <div className="flex shrink-0 items-start" onClick={(e) => e.stopPropagation()}>
                      <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center pr-1">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleContactSelected(c.id)}
                          className="h-6 w-6 min-h-[24px] min-w-[24px] shrink-0 cursor-pointer rounded border-neutral-300 accent-mission-ink"
                          aria-label={`Select ${c.fullName || 'contact'}`}
                        />
                      </label>
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1 flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-ink">{c.fullName || 'Unnamed contact'}</p>
                    </div>
                    <ContactThreeQuickTagRows
                      contact={c}
                      saveQuickTag={saveQuickTag}
                      patchContactInList={patchContactInList}
                      variant="compact"
                      className="flex flex-col gap-1"
                    />
                    {Number(c.monthlyAmount) > 0 ? (
                      <p className="text-xs text-neutral-500">
                        {formatMonthlyAmount(c.monthlyAmount, c.currency)}
                      </p>
                    ) : null}
                    {c.phone ? <p className="text-sm text-neutral-700">{formatPhone(c.phone)}</p> : null}
                    {c.email ? <p className="text-sm text-neutral-700">{c.email}</p> : null}
                    {c.address ? <p className="text-sm text-neutral-700">{c.address}</p> : null}
                    {c.isOneTimeDonor ? (
                      <p className="text-sm font-medium text-mission-ink">
                        One-time gift
                        {Number(c.oneTimeDonationAmount) > 0
                          ? `: ${formatAmount(c.oneTimeDonationAmount, c.currency)}`
                          : ''}
                        {c.oneTimeDonationDate
                          ? ` · ${new Date(`${c.oneTimeDonationDate}T12:00:00`).toLocaleDateString()}`
                          : ''}
                      </p>
                    ) : null}
                    {cleanDisplayNotes(c.notes) ? (
                      <p className="mt-1 text-sm text-neutral-600">{cleanDisplayNotes(c.notes)}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-2 self-start" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(c)}
                      className="rounded-btn border border-neutral-200 p-2 text-red-600 hover:bg-red-50"
                      aria-label="Delete contact"
                      title="Delete"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ContactSideDrawer
        contact={drawerContact}
        onClose={closeDetail}
        saveQuickTag={saveQuickTag}
        patchContactInList={patchContactInList}
        onAfterQuickTagSave={() => void refetch()}
        onPatchContact={(next) =>
          setDrawerContact((prev) =>
            prev && String(prev.id) === String(next.id) ? { ...prev, ...next } : prev,
          )
        }
        openEditForm={openEdit}
        onCall={handleCall}
        onText={handleText}
        onLog={openQuickLogFromDetail}
        actionError={commActionError}
        activityLogsRefreshKey={activityLogRefreshKey}
        suppressEscape={showLogModal}
      />

      <ContactQuickLogPopup
        open={showLogModal}
        backdropZIndex={DRAWER_STACK_QUICK_LOG_BACKDROP_Z}
        panelZIndex={DRAWER_STACK_QUICK_LOG_MODAL_Z}
        title={drawerContact ? `Quick log — ${drawerContact.fullName || 'Contact'}` : 'Quick log'}
        selectedType={logType}
        onSelectType={setLogType}
        notes={logText}
        onNotesChange={setLogText}
        error={logError}
        saving={logSaving}
        onSave={() => void submitQuickLog()}
        onClose={() => {
          if (logSaving) return;
          setShowLogModal(false);
          setLogText('');
          setLogError('');
        }}
      />

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit contact' : 'Add contact'}
        backdropClose={false}
        closeButtonLabel="✕"
        onClose={requestCloseAddEditModal}
        panelClassName="max-w-xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={requestCloseAddEditModal}>
              Cancel
            </Button>
            <Button type="button" onClick={saveContact}>
              Save
            </Button>
          </div>
        }
      >
        {saveError ? <p className="mb-3 text-sm text-red-600">{saveError}</p> : null}
        <ContactEditFormLayout
          form={form}
          setForm={setForm}
          phoneDupWarn={phoneDupWarn}
          emailDupWarn={emailDupWarn}
          scrollToContact={scrollToContact}
          deferQuickTags
          editingContactId={editingId}
        />
      </Modal>

      <Modal
        open={discardConfirmOpen}
        title="Unsaved changes"
        onClose={() => setDiscardConfirmOpen(false)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setDiscardConfirmOpen(false)}>
              Keep editing
            </Button>
            <Button type="button" variant="danger" onClick={confirmDiscardAndCloseModal}>
              Discard
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-700">You have unsaved changes — discard them?</p>
      </Modal>

      <Modal
        open={bulkDeleteConfirmOpen}
        title="Delete contacts?"
        onClose={() => {
          if (bulkDeleteLoading) return;
          setBulkDeleteConfirmOpen(false);
          setBulkDeleteError('');
        }}
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={bulkDeleteLoading}
              onClick={() => {
                setBulkDeleteConfirmOpen(false);
                setBulkDeleteError('');
              }}
            >
              Cancel
            </Button>
            <Button type="button" variant="danger" disabled={bulkDeleteLoading} onClick={() => void runBulkDelete()}>
              {bulkDeleteLoading ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-700">
          Delete {bulkDeleteTargetCount} contact{bulkDeleteTargetCount === 1 ? '' : 's'}? This cannot be undone.
        </p>
        {bulkDeleteError ? <p className="mt-3 text-sm text-red-600">{bulkDeleteError}</p> : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete contact?"
        onClose={() => setDeleteTarget(null)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={confirmDelete}>
              Delete
            </Button>
          </div>
        }
      >
        <p className="text-sm text-neutral-700">
          Are you sure you want to delete <strong>{deleteTarget?.fullName}</strong>? This cannot be undone.
        </p>
      </Modal>

      <Modal
        open={importOpen}
        title="Import contacts"
        onClose={closeImport}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" disabled={importBusy} onClick={closeImport}>
              Close
            </Button>
          </div>
        }
      >
        <ImportBlockingOverlay open={importReading} progress={importProgress} onCancel={cancelImport} />
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Import from a spreadsheet, Google Sheet, PDF, or your phone. All parsed contacts are saved to your account
            automatically.
          </p>
          <p className="rounded-card border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-[#854F0B]">
            For best results use Chrome or Firefox. Safari sometimes blocks PDF.js web workers; if a PDF fails, we try a
            basic phone-number scan as a fallback.
          </p>
          {importMsg ? <p className="text-sm text-red-600">{importMsg}</p> : null}

          <div className="grid grid-cols-2 gap-2">
            {['excel', 'pdf', 'sheet', 'phone'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setImportTab(tab);
                  setImportMsg('');
                }}
                className={`rounded-btn border px-3 py-3 text-left text-sm font-semibold capitalize ${
                  importTab === tab ? 'border-mission-ink ring-2 ring-mission-ink/20' : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                {tab === 'excel' ? 'Excel / CSV' : tab === 'sheet' ? 'Google Sheets' : tab === 'phone' ? 'Phone' : 'PDF'}
              </button>
            ))}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={
              importTab === 'pdf'
                ? 'application/pdf'
                : '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'
            }
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (importTab === 'pdf') void onPdfFile(f);
              else void onSpreadsheetFile(f);
            }}
          />

          {importTab === 'excel' ? (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">Choose a .csv, .xlsx, or .xls file. Rows are imported in one batch.</p>
              <Button type="button" variant="secondary" disabled={importBusy} onClick={() => fileInputRef.current?.click()}>
                {importBusy ? 'Working…' : 'Choose file'}
              </Button>
            </div>
          ) : null}

          {importTab === 'sheet' ? (
            <div className="space-y-3">
              <Input
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                placeholder="Paste your Google Sheets share link here"
                aria-label="Google Sheets share link"
              />
              <p className="text-sm text-neutral-600">
                Make sure your sheet is shared — click Share in Google Sheets, change to Anyone with the link, copy the link
                and paste it here
              </p>
              <Button type="button" disabled={importBusy || !sheetUrl.trim()} onClick={() => void runSheetFetch()}>
                {importBusy ? 'Working…' : 'Import from sheet'}
              </Button>
            </div>
          ) : null}

          {importTab === 'phone' ? (
            <div className="space-y-3">
              {!isContactPickerSupported() ? (
                <div className="rounded-card border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-[#854F0B]">
                  Open SENT on your iPhone or Android to import from your contacts app
                </div>
              ) : (
                <p className="text-sm text-neutral-600">Opens your device&apos;s contact list. Everyone you select is imported.</p>
              )}
              <Button type="button" disabled={importBusy || !isContactPickerSupported()} onClick={() => void runPhonePicker()}>
                {importBusy ? 'Working…' : 'Choose from contacts'}
              </Button>
            </div>
          ) : null}

          {importTab === 'pdf' ? (
            <div className="space-y-3">
              <p className="rounded-card border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-[#854F0B]">
                PDF import works best in Chrome or Firefox. If it fails try exporting your contacts as a CSV instead.
              </p>
              <p className="text-sm text-neutral-600">
                PDFs are scanned for contact info (e.g. names, phones, emails). All detected contacts are imported together.
              </p>
              <Button type="button" variant="secondary" disabled={importBusy} onClick={() => fileInputRef.current?.click()}>
                {importBusy ? 'Working…' : 'Choose PDF'}
              </Button>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  );
}
