import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { formatPhone, phoneDigits } from '../../lib/phoneFormat';
import { ContactThreeQuickTagRows } from './QuickTagPopover';
import { QUICK_VIEW_BACKDROP_BG, QUICK_VIEW_BACKDROP_Z, QUICK_VIEW_MODAL_Z } from './quickViewOverlayZIndex';
import { lastContactBadgeFromIso } from './ContactQuickViewPopup';

function daysSince(isoOrNull) {
  if (!isoOrNull) return 999;
  const d = new Date(isoOrNull);
  if (Number.isNaN(d.getTime())) return 999;
  const diffMs = Date.now() - d.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

function formatMonthly(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 ? `$${n.toFixed(0)}/mo` : '$0/mo';
}

/**
 * Partner-focused quick view (Option A): urgency, stats, quick tags, actions.
 */
export function PartnerQuickViewPopup({
  open,
  partner,
  lastContactIso,
  onClose,
  onCall,
  onText,
  onLog,
  onViewFullProfile,
  suppressEscape = false,
  actionError = '',
  saveQuickTag,
  patchContactInList,
  updateContact,
  onPatchContact,
  onAfterQuickTagSave,
}) {
  const { user } = useAuth();
  const [logCount, setLogCount] = useState(null);

  useEffect(() => {
    if (!open || !partner?.id || !supabase || !user?.id) {
      setLogCount(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { count, error } = await supabase
        .from('communication_logs')
        .select('id', { count: 'exact', head: true })
        .eq('contact_id', partner.id)
        .eq('missionary_id', user.id);
      if (!cancelled && !error) setLogCount(count ?? 0);
      else if (!cancelled) setLogCount(0);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, partner?.id, user?.id]);

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

  if (!open || typeof document === 'undefined' || !partner) return null;

  const d = daysSince(lastContactIso ?? null);
  const showUrgent = d >= 30;
  const urgentCopy = !lastContactIso
    ? 'Never contacted — time to reach out.'
    : d >= 30
      ? `${d} days since last contact — consider following up.`
      : '';

  const lastBadge = lastContactBadgeFromIso(lastContactIso ?? null);
  const phoneDisp = partner.phone ? formatPhone(partner.phone) : '—';
  const telHref = partner.phone ? `tel:${phoneDigits(partner.phone) || ''}` : null;

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
          aria-labelledby="partner-quick-view-name"
        >
          {showUrgent ? (
            <div className="border-b border-[#A32D2D]/25 bg-[#FEF2F2] px-4 py-2.5 text-sm font-medium text-[#7F1D1D]">
              {urgentCopy}
            </div>
          ) : null}

          <div className="border-b border-mission-line p-4">
            <div className="flex gap-3">
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-mission-blue/10 text-xs font-semibold text-mission-blue"
                aria-hidden
              >
                {initialsFromDisplayName(partner.fullName || '')}
              </div>
              <div className="min-w-0 flex-1">
                <p id="partner-quick-view-name" className="truncate text-base font-semibold text-ink">
                  {partner.fullName || 'Unnamed'}
                </p>
                {Number(partner.monthlyAmount) > 0 ? (
                  <p className="mt-0.5 truncate text-xs text-neutral-600">{formatMonthly(partner.monthlyAmount)}</p>
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
            {saveQuickTag || updateContact ? (
              <div className="mt-3 border-t border-mission-line/80 pt-3" onClick={(e) => e.stopPropagation()}>
                <ContactThreeQuickTagRows
                  contact={partner}
                  saveQuickTag={saveQuickTag}
                  patchContactInList={patchContactInList}
                  updateContact={updateContact}
                  onPatchContact={onPatchContact}
                  onAfterSave={onAfterQuickTagSave}
                  variant="compact"
                  className="flex flex-col gap-1"
                />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-2 border-b border-mission-line px-3 py-3 text-center text-xs">
            <div>
              <p className="font-semibold uppercase tracking-wide text-mission-muted">Last</p>
              <p className={`mt-1 text-sm ${lastBadge.className}`}>{lastBadge.label}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wide text-mission-muted">Monthly</p>
              <p className="mt-1 text-sm font-medium text-ink">{formatMonthly(partner.monthlyAmount)}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wide text-mission-muted">Logged</p>
              <p className="mt-1 text-sm font-medium text-ink">{logCount == null ? '…' : logCount}</p>
            </div>
          </div>

          <div className="space-y-2 px-4 py-3 text-sm">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Phone</span>
              <p className="mt-0.5 font-medium text-ink">
                {telHref ? (
                  <a href={telHref} className="text-mission-blue underline">
                    {phoneDisp}
                  </a>
                ) : (
                  phoneDisp
                )}
              </p>
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
