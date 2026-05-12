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
import { cleanEmail, cleanNotes, cleanPhone, mergeImportNotes } from '../../lib/contactImportClean';
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
import {
  CONTACT_CATEGORY_FILTER_TABS,
  CONTACT_CATEGORY_FORM_OPTIONS,
  categoryLabel,
  normalizeCategoryForSave,
} from '../../lib/contactCategories';
import { CONTACT_STATUS_FORM_OPTIONS, normalizeStatusForSave, normalizeStatusFromDb, statusLabel } from '../../lib/contactStatuses';
import { Button, Card, EmptyState, Input, Label, LoadingSpinner, Modal, Textarea } from '../../components/ui';

const FILTERS = CONTACT_CATEGORY_FILTER_TABS;
const VALID_CONTACT_FILTER_IDS = new Set(FILTERS.map((f) => f.id));
const CATEGORY_OPTIONS = CONTACT_CATEGORY_FORM_OPTIONS.map(({ id, label }) => ({ value: id, label }));

const emptyForm = {
  fullName: '',
  phone: '',
  email: '',
  address: '',
  category: 'supporter',
  status: 'partner',
  monthlyAmount: '',
  isOneTimeDonor: false,
  oneTimeDonationAmount: '',
  oneTimeDonationDate: '',
  notes: '',
};

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-btn px-3 py-2 text-sm font-semibold transition ${
        active ? 'bg-mission-blue/10 text-mission-blue ring-1 ring-mission-blue/20' : 'text-neutral-600 hover:bg-neutral-100'
      }`}
    >
      {children}
    </button>
  );
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
            <p id="import-loading-title" className="text-base font-bold text-neutral-900">
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
              <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-mission-blue transition-[width] duration-200"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {progress?.note ? <p className="text-xs text-neutral-500">{progress.note}</p> : null}
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

  const { user, loading: authLoading } = useAuth();
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
    deleteContact,
    removeDuplicateContacts,
  } = useSupabaseContacts(user?.id, { authLoading });

  const [filter, setFilter] = useState('all');
  useEffect(() => {
    if (!VALID_CONTACT_FILTER_IDS.has(filter)) setFilter('all');
  }, [filter]);
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

  const sessionRef = useRef(0);
  const contactUrlHandledRef = useRef(null);
  const importAbortRef = useRef(null);
  const [importReading, setImportReading] = useState(false);
  const [importProgress, setImportProgress] = useState(null);

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
        const extras = cleanNotes(phone, email, originalPhone, originalEmail);
        const notes = mergeImportNotes(String(d.notes ?? '').trim(), extras);
        const row = {
          missionary_id: user.id,
          full_name: String(d.full_name ?? d.fullName ?? d.name ?? '').trim() || 'Imported contact',
          phone,
          email,
          address: String(d.address ?? '').trim(),
          category: normalizeCategoryForSave(d.category),
          status: normalizeStatusForSave(d.status),
          notes,
          monthly_amount: Number.isFinite(Number(d.monthly_amount)) ? Number(d.monthly_amount) : 0,
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
      return { inserted, skippedDuplicates };
    },
    [schemaPartial],
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
      const { fetchGoogleSheetMatrix } = await import('../../lib/googleSheetsApi');
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
      const drafts = flexibleImportFromSplitMatrix(m, 'Google Sheet');
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
      const msg = e?.message || String(e);
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
    setForm(emptyForm);
    setSaveError('');
    setContactSaveSuccess('');
    setModalOpen(true);
  };

  const openEdit = useCallback((c) => {
    setContactSaveSuccess('');
    setEditingId(c.id);
    setForm({
      fullName: c.fullName,
      phone: c.phone,
      email: c.email,
      address: c.address || '',
      // Map legacy categories into the current enum set for the form.
      category: normalizeCategoryForSave(c.category),
      status: normalizeStatusFromDb(c.status),
      monthlyAmount: c.monthlyAmount ? String(c.monthlyAmount) : '',
      isOneTimeDonor: Boolean(c.isOneTimeDonor),
      oneTimeDonationAmount:
        c.oneTimeDonationAmount != null && Number(c.oneTimeDonationAmount) > 0
          ? String(c.oneTimeDonationAmount)
          : '',
      oneTimeDonationDate: c.oneTimeDonationDate || '',
      notes: c.notes,
    });
    setSaveError('');
    setModalOpen(true);
  }, []);

  const editFromUrl = searchParams.get('edit') ?? searchParams.get('contact');
  useEffect(() => {
    if (!editFromUrl) {
      contactUrlHandledRef.current = null;
      return;
    }
    if (loading || authLoading) return;
    if (contactUrlHandledRef.current === editFromUrl) return;
    const c = contacts.find((x) => String(x.id) === String(editFromUrl));
    const stripEditParams = () => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('edit');
          next.delete('contact');
          return next;
        },
        { replace: true },
      );
    };
    if (!c) {
      contactUrlHandledRef.current = null;
      stripEditParams();
      return;
    }
    contactUrlHandledRef.current = editFromUrl;
    openEdit(c);
    stripEditParams();
  }, [editFromUrl, loading, authLoading, contacts, openEdit, setSearchParams]);

  const saveContact = async () => {
    setSaveError('');
    setContactSaveSuccess('');
    if (!form.fullName.trim()) {
      setSaveError('Name is required.');
      return;
    }

    if (editingId) {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone,
        email: form.email,
        address: form.address,
        category: normalizeCategoryForSave(form.category),
        status: normalizeStatusForSave(form.status),
        monthlyAmount: form.monthlyAmount,
        isOneTimeDonor: form.isOneTimeDonor,
        oneTimeDonationAmount: form.oneTimeDonationAmount,
        oneTimeDonationDate: form.oneTimeDonationDate,
        notes: form.notes,
      };
      const res = await updateContact(editingId, payload);
      if (!res.ok) {
        setSaveError(res.error || 'Could not save.');
        return;
      }
      await refetch();
      setModalOpen(false);
      setContactSaveSuccess('Contact saved');
      return;
    }

    const categorySaved = normalizeCategoryForSave(form.category);
    const statusSaved = normalizeStatusForSave(form.status);

    const res = await insertContact({
      fullName: form.fullName.trim(),
      phone: form.phone,
      email: form.email,
      address: form.address,
      category: categorySaved,
      status: statusSaved,
      monthlyAmount: form.monthlyAmount,
      isOneTimeDonor: form.isOneTimeDonor,
      oneTimeDonationAmount: form.oneTimeDonationAmount,
      oneTimeDonationDate: form.oneTimeDonationDate,
      notes: form.notes,
    });
    if (!res.ok) {
      setSaveError(res.error || 'Could not save contact.');
      return;
    }
    setModalOpen(false);
    setContactSaveSuccess('Contact saved');
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const res = await deleteContact(deleteTarget.id);
    if (!res.ok) setImportMsg(res.error || 'Delete failed.');
    setDeleteTarget(null);
  };

  const filtered = contacts
    .filter((c) => {
      if (oneTimeDonorFilter && !c.isOneTimeDonor) return false;
      if (filter === 'all') return true;
      return (c.category || '') === filter;
    })
    .filter((c) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        (c.fullName || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.address || '').toLowerCase().includes(q)
      );
    });

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
    setSelectedIds(new Set(filtered.map((c) => c.id)));
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

  const scrollToContact = useCallback((id) => {
    setModalOpen(false);
    requestAnimationFrame(() => {
      document.getElementById(`contact-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }, []);

  const showEmpty = !loading && contacts.length === 0 && !unexpectedEmptyWarning;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="sent-page-title">Contacts</h1>
          <p className="sent-body text-mission-muted">CRM contacts saved to your account.</p>
        </div>
        {selectMode ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-neutral-900">{selectedCount} selected</span>
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
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={openImport}>
              Import
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={dedupeLoading || loading}
              onClick={() => void runRemoveDuplicates()}
            >
              {dedupeLoading ? 'Working…' : 'Remove duplicates'}
            </Button>
            <Button variant="secondary" type="button" onClick={enterSelectMode}>
              Select
            </Button>
            <Button type="button" onClick={openAdd}>
              + Add Contact
            </Button>
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
            (address, one-time donor fields). Until then, those fields won&apos;t save.
          </p>
        </div>
      ) : null}

      {oneTimeDonorFilter ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-btn border border-mission-blue/20 bg-mission-blue/5 px-4 py-3 text-sm text-neutral-800">
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

      <Card className="p-4">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((t) => (
            <Tab key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>
              {t.label}
            </Tab>
          ))}
        </div>
        <div className="mt-4">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts…" className="py-3 text-sm" />
        </div>
      </Card>

      {loading ? (
        <p className="text-center text-sm text-neutral-500">Loading contacts…</p>
      ) : showEmpty ? (
        <EmptyState
          icon="compass"
          title="Your network starts here"
          subtitle="Import a spreadsheet or add one person you’re inviting to partner with your ministry."
          action={
            <Button type="button" onClick={openAdd}>
              Add contact
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <Card
              key={c.id}
              id={`contact-${c.id}`}
              onClick={() => {
                if (selectMode) toggleContactSelected(c.id);
                else openEdit(c);
              }}
              className={`scroll-mt-4 p-4 text-left cursor-pointer`}
            >
              <div className="flex flex-row flex-nowrap items-start gap-3">
                {selectMode ? (
                  <div className="flex shrink-0 items-start" onClick={(e) => e.stopPropagation()}>
                    <label className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center pr-1">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(c.id)}
                        onChange={() => toggleContactSelected(c.id)}
                        className="h-6 w-6 min-h-[24px] min-w-[24px] shrink-0 cursor-pointer rounded border-neutral-300 accent-mission-blue"
                        aria-label={`Select ${c.fullName || 'contact'}`}
                      />
                    </label>
                  </div>
                ) : null}
                <div className="min-w-0 flex-1 flex flex-col gap-1">
                  <p className="text-base font-semibold text-neutral-900">{c.fullName || 'Unnamed contact'}</p>
                  <p className="text-xs text-neutral-500">
                    {categoryLabel(c.category)} · {statusLabel(c.status)}
                    {Number(c.monthlyAmount) > 0 ? ` · $${Number(c.monthlyAmount).toFixed(0)}/mo` : ''}
                  </p>
                  {c.phone ? <p className="text-sm text-neutral-700">{c.phone}</p> : null}
                  {c.email ? <p className="text-sm text-neutral-700">{c.email}</p> : null}
                  {c.address ? <p className="text-sm text-neutral-700">{c.address}</p> : null}
                  {c.isOneTimeDonor ? (
                    <p className="text-sm font-medium text-mission-blue">
                      One-time gift
                      {Number(c.oneTimeDonationAmount) > 0
                        ? `: $${Number(c.oneTimeDonationAmount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                        : ''}
                      {c.oneTimeDonationDate
                        ? ` · ${new Date(`${c.oneTimeDonationDate}T12:00:00`).toLocaleDateString()}`
                        : ''}
                    </p>
                  ) : null}
                  {c.notes ? <p className="mt-1 text-sm text-neutral-600">{c.notes}</p> : null}
                </div>
                <div className="flex shrink-0 gap-2 self-start" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled={selectMode}
                    onClick={() => openEdit(c)}
                    className="rounded-btn border border-neutral-200 p-2 text-neutral-600 hover:bg-neutral-50 disabled:pointer-events-none disabled:opacity-40"
                    aria-label="Edit contact"
                    title="Edit"
                  >
                    ✎
                  </button>
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
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        title={editingId ? 'Edit contact' : 'Add contact'}
        onClose={() => setModalOpen(false)}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveContact}>
              Save
            </Button>
          </div>
        }
      >
        {saveError ? <p className="mb-3 text-sm text-red-600">{saveError}</p> : null}
        <div className="space-y-4">
          <Label title="Full name">
            <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Full name" />
          </Label>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label title="Phone">
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(555) 555‑5555" />
              </Label>
              {phoneDupWarn ? (
                <p className="mt-2 text-xs leading-snug text-amber-800">
                  A contact with this phone number already exists — {phoneDupWarn.fullName || 'Unnamed'}{' '}
                  <button
                    type="button"
                    className="font-semibold text-mission-blue underline"
                    onClick={() => scrollToContact(phoneDupWarn.id)}
                  >
                    View contact
                  </button>
                </p>
              ) : null}
            </div>
            <div>
              <Label title="Email">
                <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="name@example.com" />
              </Label>
              {emailDupWarn ? (
                <p className="mt-2 text-xs leading-snug text-amber-800">
                  A contact with this email already exists — {emailDupWarn.fullName || 'Unnamed'}{' '}
                  <button
                    type="button"
                    className="font-semibold text-mission-blue underline"
                    onClick={() => scrollToContact(emailDupWarn.id)}
                  >
                    View contact
                  </button>
                </p>
              ) : null}
            </div>
          </div>
          <Label title="Address">
            <Input
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="Street, city, state, ZIP"
            />
          </Label>
          <div className="grid gap-3 md:grid-cols-2">
            <Label title="Category">
              <select
                value={form.category}
                onChange={(e) => {
                  const nextCat = e.target.value;
                  setForm((f) => ({
                    ...f,
                    category: nextCat,
                    ...(nextCat === 'supporter' ? { status: 'partner' } : {}),
                  }));
                }}
                className="w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[16px] outline-none focus:border-mission-blue"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Label>
            <Label title="Status">
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-btn border border-neutral-200 px-4 py-[14px] text-[16px] outline-none focus:border-mission-blue"
              >
                {CONTACT_STATUS_FORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </Label>
          </div>
          {form.status === 'partner' ? (
            <Label title="Monthly amount">
              <Input
                inputMode="numeric"
                value={form.monthlyAmount}
                onChange={(e) => setForm((f) => ({ ...f, monthlyAmount: e.target.value }))}
                placeholder="0"
              />
            </Label>
          ) : null}

          <label className="flex cursor-pointer items-center gap-3 rounded-card border border-neutral-200 bg-white px-4 py-3">
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 accent-[#185FA5]"
              checked={form.isOneTimeDonor}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  isOneTimeDonor: e.target.checked,
                  ...(!e.target.checked ? { oneTimeDonationAmount: '', oneTimeDonationDate: '' } : {}),
                }))
              }
            />
            <span className="text-sm font-semibold text-neutral-900">One-time donor</span>
          </label>
          {form.isOneTimeDonor ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Label title="Donation amount">
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-neutral-500">
                    $
                  </span>
                  <Input
                    inputMode="decimal"
                    value={form.oneTimeDonationAmount}
                    onChange={(e) => setForm((f) => ({ ...f, oneTimeDonationAmount: e.target.value }))}
                    placeholder="0"
                    className="pl-8"
                  />
                </div>
              </Label>
              <Label title="Donation date">
                <Input
                  type="date"
                  value={form.oneTimeDonationDate}
                  onChange={(e) => setForm((f) => ({ ...f, oneTimeDonationDate: e.target.value }))}
                />
              </Label>
            </div>
          ) : null}

          <Label title="Notes">
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes…" rows={4} />
          </Label>
        </div>
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
                  importTab === tab ? 'border-mission-blue ring-2 ring-mission-blue/20' : 'border-neutral-200 hover:border-neutral-300'
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
