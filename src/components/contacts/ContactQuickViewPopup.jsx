import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { categoryLabel, normalizeCategory } from '../../lib/contactCategories';
import { formatPhone } from '../../lib/phoneFormat';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { Textarea } from '../../components/ui';
import { ContactThreeQuickTagRows } from './QuickTagPopover';

const COMM_TYPE_LABEL = {
  call: 'Call',
  text: 'Text',
  meeting: 'Meeting',
  note: 'Note',
};

export const QUICK_LOG_COMM_TYPES = ['call', 'text', 'meeting', 'note'];

function daysSince(isoOrNull) {
  if (!isoOrNull) return 999;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return 999;
  const diffMs = Date.now() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

/** Colored label for “last contacted” (matches Partners list badge styling). */
export function lastContactBadgeFromIso(lastIso) {
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

function formatMonthly(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(0)}/mo` : '$0/mo';
}

function subtitle(contact) {
  const monthly = formatMonthly(contact?.monthlyAmount);
  const cat = normalizeCategory(contact?.category);
  const lab = cat ? categoryLabel(contact.category) : '';
  return lab ? `${monthly} · ${lab}` : monthly;
}

/**
 * Small fixed-centered quick view (not full-screen). Backdrop z-[199], panel z-[200].
 */
export function ContactQuickViewPopup({
  open,
  contact,
  lastContactIso,
  onClose,
  onCall,
  onText,
  onLog,
  onViewFullProfile,
  suppressEscape = false,
  actionError = '',
  updateContact,
  onPatchContact,
  onAfterQuickTagSave,
}) {
  useEffect(() => {
    if (!open || suppressEscape) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, suppressEscape, onClose]);

  if (!open || typeof document === 'undefined' || !contact) return null;

  const badge = lastContactBadgeFromIso(lastContactIso ?? null);
  const phoneDisp = contact.phone ? formatPhone(contact.phone) : '—';

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[199] cursor-default border-0 bg-[rgba(0,0,0,0.2)] p-0"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 pointer-events-none"
        role="presentation"
      >
        <div
          className="pointer-events-auto w-full max-w-[min(360px,calc(100vw-2rem))] rounded-card border border-mission-line bg-surface shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-quick-view-name"
        >
          <div className="border-b border-mission-line p-4">
            <div className="flex gap-3">
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-mission-blue/10 text-xs font-semibold text-mission-blue"
                aria-hidden
              >
                {initialsFromDisplayName(contact.fullName || '')}
              </div>
              <div className="min-w-0 flex-1">
                <p id="contact-quick-view-name" className="truncate text-base font-semibold text-ink">
                  {contact.fullName || 'Unnamed'}
                </p>
                <p className="mt-0.5 truncate text-xs text-neutral-600">{subtitle(contact)}</p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-lg leading-none text-neutral-500 hover:bg-neutral-100"
                aria-label="Close"
                onClick={onClose}
              >
                ✕
              </button>
            </div>
          </div>

          {updateContact ? (
            <div className="border-b border-mission-line px-4 py-2" onClick={(e) => e.stopPropagation()}>
              <ContactThreeQuickTagRows
                contact={contact}
                updateContact={updateContact}
                onPatchContact={onPatchContact}
                onAfterSave={onAfterQuickTagSave}
              />
            </div>
          ) : null}

          <div className="space-y-3 px-4 py-3 text-sm">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Phone</span>
              <p className="mt-0.5 font-medium text-ink">{phoneDisp}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Last contact</span>
              <p className={`mt-0.5 text-sm ${badge.className}`}>{badge.label}</p>
            </div>
            {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
          </div>

          <div className="flex border-t border-mission-line px-2 py-2">
            <button
              type="button"
              className="min-h-[44px] flex-1 text-center text-sm font-semibold text-mission-blue hover:bg-mission-blue/5"
              onClick={onCall}
            >
              Call
            </button>
            <span className="self-center text-neutral-300" aria-hidden>
              |
            </span>
            <button
              type="button"
              className="min-h-[44px] flex-1 text-center text-sm font-semibold text-mission-blue hover:bg-mission-blue/5"
              onClick={onText}
            >
              Text
            </button>
            <span className="self-center text-neutral-300" aria-hidden>
              |
            </span>
            <button
              type="button"
              className="min-h-[44px] flex-1 text-center text-sm font-semibold text-mission-blue hover:bg-mission-blue/5"
              onClick={onLog}
            >
              Log
            </button>
          </div>

          <div className="border-t border-mission-line p-3">
            <button
              type="button"
              className="w-full py-2 text-center text-sm font-semibold text-mission-blue hover:underline"
              onClick={onViewFullProfile}
            >
              View full profile →
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/**
 * Second-layer quick log dialog. Backdrop z-[201], panel z-[202].
 */
export function ContactQuickLogPopup({
  open,
  title,
  selectedType,
  onSelectType,
  notes,
  onNotesChange,
  error,
  saving,
  onSave,
  onClose,
  types = QUICK_LOG_COMM_TYPES,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) {
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, saving, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[201] cursor-default border-0 bg-[rgba(0,0,0,0.2)] p-0"
        aria-label="Close"
        onClick={() => !saving && onClose?.()}
      />
      <div className="fixed inset-0 z-[202] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto w-full max-w-[min(360px,calc(100vw-2rem))] rounded-card border border-mission-line bg-surface p-4 shadow-lg"
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-log-title"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <p id="quick-log-title" className="text-base font-semibold text-ink">
              {title}
            </p>
            <button
              type="button"
              disabled={saving}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-btn text-lg leading-none text-neutral-500 hover:bg-neutral-100 disabled:opacity-50"
              aria-label="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          {error ? <p className="mb-2 text-sm text-red-700">{error}</p> : null}
          <p className="mb-2 text-xs font-medium text-neutral-600">Type</p>
          <div className="mb-3 flex flex-wrap gap-2">
            {types.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onSelectType(t)}
                className={`rounded-btn border px-3 py-1.5 text-sm font-medium ${
                  selectedType === t
                    ? 'border-mission-blue bg-mission-blue/10 text-mission-blue'
                    : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {COMM_TYPE_LABEL[t] || t}
              </button>
            ))}
          </div>
          <Textarea
            id="quick-log-notes"
            rows={4}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Notes (optional)…"
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              className="rounded-btn border border-neutral-200 bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-neutral-50 disabled:opacity-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              className="rounded-btn bg-mission-blue px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              onClick={onSave}
            >
              {saving ? 'Saving…' : 'Save log'}
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
