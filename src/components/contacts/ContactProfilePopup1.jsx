import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { categoryLabel, normalizeCategory } from '../../lib/contactCategories';
import { formatPhone, phoneDigits } from '../../lib/phoneFormat';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { relationshipLabel } from '../../lib/contactRelationships';
import { notesWithoutSocialBlock, splitSocialFromNotes } from '../../lib/contactSocialInNotes';
import { statusLabel } from '../../lib/contactStatuses';
import { ContactThreeQuickTagRows } from './QuickTagPopover';
import { lastContactBadgeFromIso } from './ContactQuickViewPopup';

function cleanDisplayNotesBody(rawNotes) {
  const body = notesWithoutSocialBlock(rawNotes);
  if (!body) return '';
  const trimmed = body.toString().trim();
  if (/^\d+$/.test(trimmed)) return '';
  return trimmed;
}

/**
 * @param {{
 *   label: string,
 *   value?: string,
 *   href?: string,
 *   valueClassName?: string,
 *   children?: import('react').ReactNode,
 * }} props
 */
function InfoRow({ label, value, href, valueClassName = 'text-sm font-medium text-ink', children }) {
  const text = value ?? '';
  const body =
    children ??
    (href && text ? (
      <a href={href} className={`mt-0.5 inline-block ${valueClassName} text-mission-blue underline`}>
        {text}
      </a>
    ) : (
      <p className={`mt-0.5 ${valueClassName}`}>{text || '—'}</p>
    ));
  return (
    <div className="border-b border-[#E5E2DD] px-4 py-2.5 last:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      {body}
    </div>
  );
}

const SECTION_STRIP =
  'rounded-md bg-[#F4F2EE] px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-600';

const BTN_BORDERED =
  'flex min-h-[44px] items-center justify-center border border-[#E5E2DD] bg-white text-sm font-semibold text-mission-blue hover:bg-mission-blue/5';

/**
 * Full profile-style popup for the Contacts page (Layout A).
 *
 * @param {{
 *   contact: Record<string, unknown> | null,
 *   onClose: () => void,
 *   updateContact?: (id: string, payload: Record<string, unknown>) => Promise<{ ok?: boolean }>,
 *   onAfterQuickTagSave?: () => void,
 *   onPatchContact?: (next: Record<string, unknown>) => void,
 *   openEditForm: (c: Record<string, unknown>) => void,
 *   lastContactIso?: string | null,
 *   showLog: boolean,
 *   setShowLog?: (v: boolean) => void,
 *   onCall: () => void,
 *   onText: () => void,
 *   onLog: () => void,
 *   actionError?: string,
 * }} props
 */
export function ContactProfilePopup1({
  contact,
  onClose,
  updateContact,
  onAfterQuickTagSave,
  onPatchContact,
  openEditForm,
  lastContactIso,
  showLog,
  setShowLog: _setShowLog,
  onCall,
  onText,
  onLog,
  actionError = '',
}) {
  useEffect(() => {
    if (!contact || showLog) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [contact, showLog, onClose]);

  if (!contact || typeof document === 'undefined') return null;

  const badge = lastContactBadgeFromIso(lastContactIso ?? null);
  const { social } = splitSocialFromNotes(contact.notes);
  const notesDisplay = cleanDisplayNotesBody(contact.notes);
  const phoneDigitsRaw = contact.phone ? phoneDigits(contact.phone) : '';
  const phoneHref = phoneDigitsRaw ? `tel:${phoneDigitsRaw}` : undefined;
  const emailStr = contact.email ? String(contact.email).trim() : '';
  const emailHref = emailStr ? `mailto:${emailStr}` : undefined;

  const cat = normalizeCategory(contact.category);
  const categoryDisp = cat ? categoryLabel(contact.category) : '—';
  const statusDisp = statusLabel(contact.status);
  const rel = contact.relationship != null && String(contact.relationship).trim() !== '';
  const relationshipDisp = rel ? relationshipLabel(contact.relationship) : '—';

  const monthly = Number(contact.monthlyAmount);
  const monthlyDisp = Number.isFinite(monthly) && monthly > 0 ? `$${monthly.toFixed(0)}/mo` : '—';

  const socialStr = social ? String(social).trim() : '';
  const socialHref =
    socialStr && /^https?:\/\//i.test(socialStr)
      ? socialStr
      : socialStr && /^www\./i.test(socialStr)
        ? `https://${socialStr}`
        : undefined;

  const handleEdit = () => {
    onClose();
    openEditForm(contact);
  };

  return createPortal(
    <div
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 300, backgroundColor: 'rgba(0,0,0,0.25)' }}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="w-full overflow-y-auto overflow-x-hidden bg-white shadow-lg"
        style={{
          maxWidth: 380,
          maxHeight: '85vh',
          borderRadius: 16,
          border: '1px solid #E5E2DD',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-profile-popup-1-name"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-[#E5E2DD] p-4">
          <div className="flex gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-mission-blue/10 text-sm font-semibold text-mission-blue"
              aria-hidden
            >
              {initialsFromDisplayName(contact.fullName || '')}
            </div>
            <div className="min-w-0 flex-1">
              <p id="contact-profile-popup-1-name" className="text-base font-medium leading-tight text-ink">
                {contact.fullName || 'Unnamed'}
              </p>
              <p className="mt-1 text-sm">
                <span className="text-neutral-600">Last contacted: </span>
                <span className={badge.className}>{badge.label}</span>
              </p>
            </div>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg leading-none text-neutral-500 hover:bg-neutral-100"
              aria-label="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>

        {updateContact ? (
          <div className="border-b border-[#E5E2DD] px-4 py-3">
            <ContactThreeQuickTagRows
              contact={contact}
              updateContact={updateContact}
              onPatchContact={onPatchContact}
              onAfterSave={onAfterQuickTagSave}
            />
          </div>
        ) : null}

        <div className="pt-3">
          <div className="px-4 pb-2">
            <div className={SECTION_STRIP}>Contact info</div>
          </div>
          <div className="pb-1">
            <InfoRow
              label="Phone"
              value={contact.phone ? formatPhone(contact.phone) : ''}
              href={phoneHref}
              valueClassName="text-sm font-medium text-ink"
            />
            <InfoRow label="Email" value={emailStr} href={emailHref} />
            <InfoRow label="Address" value={contact.address ? String(contact.address) : ''} />
            <InfoRow label="Category" value={categoryDisp} valueClassName="text-sm font-medium text-ink" />
            <InfoRow label="Status" value={statusDisp} valueClassName="text-sm font-medium text-ink" />
            <InfoRow label="Relationship" value={relationshipDisp} valueClassName="text-sm font-medium text-ink" />
            <InfoRow label="Monthly" value={monthlyDisp} valueClassName="text-sm font-medium text-ink" />
            <InfoRow
              label="Social"
              value={socialStr}
              href={socialHref}
              valueClassName="text-sm font-medium text-ink break-all"
            />
          </div>
        </div>

        <div className="border-t border-[#E5E2DD] px-4 py-3">
          <div className={SECTION_STRIP}>Notes</div>
          {notesDisplay ? (
            <p className="mt-2 whitespace-pre-wrap px-1 text-sm text-neutral-800">{notesDisplay}</p>
          ) : (
            <p className="mt-2 px-1 text-sm italic text-neutral-500">No notes yet</p>
          )}
        </div>

        {actionError ? (
          <p className="border-t border-[#E5E2DD] px-4 py-2 text-sm text-red-600">{actionError}</p>
        ) : null}

        <div className="grid grid-cols-2 gap-px border-t border-[#E5E2DD] bg-[#E5E2DD]">
          <button type="button" className={`${BTN_BORDERED} rounded-none`} onClick={onCall}>
            Call
          </button>
          <button type="button" className={`${BTN_BORDERED} rounded-none`} onClick={onText}>
            Text
          </button>
          <button
            type="button"
            className="flex min-h-[44px] items-center justify-center bg-mission-blue text-sm font-semibold text-white hover:opacity-90"
            onClick={onLog}
          >
            Log
          </button>
          <button
            type="button"
            className="flex min-h-[44px] items-center justify-center bg-neutral-900 text-sm font-semibold text-white hover:opacity-90"
            onClick={handleEdit}
          >
            Edit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
