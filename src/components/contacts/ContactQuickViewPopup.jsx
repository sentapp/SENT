import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { formatPhone, phoneDigits } from '../../lib/phoneFormat';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { Textarea } from '../../components/ui';
import { ContactThreeQuickTagRows } from './QuickTagPopover';
import {
  QUICK_LOG_BACKDROP_Z,
  QUICK_LOG_MODAL_Z,
  QUICK_VIEW_BACKDROP_BG,
  QUICK_VIEW_BACKDROP_Z,
  QUICK_VIEW_MODAL_Z,
} from './quickViewOverlayZIndex';
import { getContactAvatarStyle } from '../../lib/contactAvatarStyles';

const COMM_TYPE_LABEL = {
  call: 'Call',
  text: 'Text',
  meeting: 'Meeting',
  note: 'Note',
  prayer: 'Prayer',
};

export const QUICK_LOG_COMM_TYPES = ['call', 'text', 'meeting', 'note', 'prayer'];

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

function InfoRow({ label, children }) {
  return (
    <div>
      <span className="text-xs font-semibold uppercase tracking-wide text-mission-muted">{label}</span>
      <div className="mt-0.5 text-sm text-ink">{children}</div>
    </div>
  );
}

/**
 * Regular contact quick view (list row tap). Backdrop {@link QUICK_VIEW_BACKDROP_Z}, panel {@link QUICK_VIEW_MODAL_Z}.
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
  const telHref = contact.phone ? `tel:${phoneDigits(contact.phone) || ''}` : null;
  const emailRaw = String(contact.email ?? '').trim();
  const notesBody = String(contact.notes ?? '').trim();
  const showMonthly = Number(contact.monthlyAmount) > 0;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 cursor-default border-0 p-0"
        style={{ zIndex: QUICK_VIEW_BACKDROP_Z, backgroundColor: QUICK_VIEW_BACKDROP_BG }}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: QUICK_VIEW_MODAL_Z }}
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
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={getContactAvatarStyle(contact.category)}
                aria-hidden
              >
                {initialsFromDisplayName(contact.fullName || '')}
              </div>
              <div className="min-w-0 flex-1">
                <p id="contact-quick-view-name" className="truncate text-base font-semibold text-ink">
                  {contact.fullName || 'Unnamed'}
                </p>
                {showMonthly ? (
                  <p className="mt-0.5 truncate text-xs text-neutral-600">{formatMonthly(contact.monthlyAmount)}</p>
                ) : null}
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
            {updateContact ? (
              <div className="mt-3 border-t border-mission-line/80 pt-3" onClick={(e) => e.stopPropagation()}>
                <ContactThreeQuickTagRows
                  contact={contact}
                  updateContact={updateContact}
                  onPatchContact={onPatchContact}
                  onAfterSave={onAfterQuickTagSave}
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-3 px-4 py-3">
            <InfoRow label="Phone">
              {telHref ? (
                <a href={telHref} className="font-medium text-mission-ink underline">
                  {phoneDisp}
                </a>
              ) : (
                <span className="font-medium">{phoneDisp}</span>
              )}
            </InfoRow>
            <InfoRow label="Email">
              {emailRaw ? (
                <a href={`mailto:${emailRaw}`} className="break-all font-medium text-mission-ink underline">
                  {emailRaw}
                </a>
              ) : (
                <span className="font-medium text-neutral-500">—</span>
              )}
            </InfoRow>
            <InfoRow label="Last contact">
              <span className={badge.className}>{badge.label}</span>
            </InfoRow>
            <InfoRow label="Notes">
              {notesBody ? (
                <p className="whitespace-pre-wrap break-words text-neutral-800">{notesBody}</p>
              ) : (
                <span className="text-neutral-500">—</span>
              )}
            </InfoRow>
            {actionError ? <p className="text-sm text-red-600">{actionError}</p> : null}
          </div>

          <div className="flex border-t border-mission-line px-2 py-2">
            <button
              type="button"
              className="min-h-[44px] flex-1 text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={onCall}
            >
              Call
            </button>
            <span className="self-center text-neutral-300" aria-hidden>
              |
            </span>
            <button
              type="button"
              className="min-h-[44px] flex-1 text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={onText}
            >
              Text
            </button>
            <span className="self-center text-neutral-300" aria-hidden>
              |
            </span>
            <button
              type="button"
              className="min-h-[44px] flex-1 text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={onLog}
            >
              Log
            </button>
          </div>

          <div className="border-t border-mission-line p-3">
            <button
              type="button"
              className="w-full py-2 text-center text-sm font-semibold text-mission-ink hover:underline"
              onClick={onViewFullProfile}
            >
              Edit full profile →
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/**
 * Second-layer quick log dialog.
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
  backdropZIndex = QUICK_LOG_BACKDROP_Z,
  panelZIndex = QUICK_LOG_MODAL_Z,
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
        className="fixed inset-0 cursor-default border-0 p-0"
        style={{ zIndex: backdropZIndex, backgroundColor: QUICK_VIEW_BACKDROP_BG }}
        aria-label="Close"
        onClick={() => !saving && onClose?.()}
      />
      <div
        className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
        style={{ zIndex: panelZIndex }}
      >
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
                    ? 'border-green bg-green-light text-green'
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
              className="rounded-btn bg-mission-ink px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
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
