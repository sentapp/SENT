import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { initialsFromDisplayName } from '../../lib/profileAppearance';
import { formatPhone, phoneDigits } from '../../lib/phoneFormat';
import { formatMonthlyAmount } from '../../lib/currencies';
import { categoryLabel, normalizeCategory } from '../../lib/contactCategories';
import { ContactThreeQuickTagRows } from './QuickTagPopover';
import { PARTNER_DRAWER_BACKDROP_Z, PARTNER_DRAWER_PANEL_Z } from './quickViewOverlayZIndex';
import { lastContactBadgeFromIso } from './ContactQuickViewPopup';
import { getContactAvatarStyle } from '../../lib/contactAvatarStyles';

const SECTION_STRIP =
  'rounded-md bg-surface px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted';

const COMM_DOT = {
  call: 'bg-[#C17A00]',
  text: 'bg-emerald-500',
  meeting: 'bg-purple-500',
  note: 'bg-neutral-500',
  prayer: 'bg-amber-500',
  update: 'bg-neutral-400',
  email: 'bg-slate-500',
};

function InfoRow({ label, value, href, valueClassName = 'text-sm font-medium text-ink' }) {
  const text = value ?? '';
  const body =
    href && text ? (
      <a href={href} className={`mt-0.5 inline-block ${valueClassName} text-mission-ink underline`}>
        {text}
      </a>
    ) : (
      <p className={`mt-0.5 ${valueClassName}`}>{text || '—'}</p>
    );
  return (
    <div className="border-b border-[#EEEEEE] px-4 py-2.5 last:border-b-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      {body}
    </div>
  );
}

function useDrawerNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const fn = () => setNarrow(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return narrow;
}

function commDotClass(commType) {
  const k = String(commType || '').toLowerCase();
  return COMM_DOT[k] || COMM_DOT.note;
}

function commLabel(commType) {
  const k = String(commType || '').toLowerCase();
  const map = {
    call: 'Call',
    text: 'Text',
    meeting: 'Meeting',
    note: 'Note',
    prayer: 'Prayer',
    update: 'Update',
    email: 'Email',
  };
  return map[k] || (k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Log');
}

/**
 * HubSpot-style partner drawer (slides in from the right).
 */
export function PartnerSideDrawer({
  partner,
  onClose,
  lastContactIso,
  onCall,
  onText,
  onLog,
  onEditFullProfile,
  suppressEscape = false,
  actionError = '',
  saveQuickTag,
  patchContactInList,
  updateContact,
  onPatchContact,
  onAfterQuickTagSave,
}) {
  const { user } = useAuth();
  const narrow = useDrawerNarrow();
  const [entered, setEntered] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useLayoutEffect(() => {
    if (!partner) return undefined;
    setEntered(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntered(true));
    });
    return () => cancelAnimationFrame(id);
    // Slide-in when switching partners only (not whole `partner` object).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partner?.id]);

  const loadLogs = useCallback(async () => {
    if (!supabase || !partner?.id || !user?.id) {
      setLogs([]);
      return;
    }
    setLogsLoading(true);
    const { data, error } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('contact_id', partner.id)
      .eq('missionary_id', user.id)
      .order('created_at', { ascending: false });
    setLogsLoading(false);
    if (error) {
      console.error('PartnerSideDrawer communication_logs', error);
      setLogs([]);
      return;
    }
    setLogs(data || []);
  }, [partner?.id, user?.id]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!partner || suppressEscape) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [partner, suppressEscape, onClose]);

  if (!partner || typeof document === 'undefined') return null;

  const lastBadge = lastContactBadgeFromIso(lastContactIso ?? null);
  const phoneDisp = partner.phone ? formatPhone(partner.phone) : '—';
  const telHref = partner.phone ? `tel:${phoneDigits(partner.phone) || ''}` : null;
  const emailStr = partner.email ? String(partner.email).trim() : '';
  const emailHref = emailStr ? `mailto:${emailStr}` : '';
  const cat = normalizeCategory(partner.category);
  const categoryDisp = cat ? categoryLabel(partner.category) : '—';

  const deleteLog = async (logId) => {
    if (!window.confirm('Delete this activity log?')) return;
    if (!supabase || !user?.id) return;
    const { error } = await supabase.from('communication_logs').delete().eq('id', logId).eq('missionary_id', user.id);
    if (error) {
      console.error(error);
      return;
    }
    void loadLogs();
  };

  const drawerWidth = narrow ? '100%' : 380;
  const transform = entered ? 'translateX(0)' : 'translateX(100%)';

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 cursor-default border-0 p-0 transition-opacity duration-200"
        style={{
          zIndex: PARTNER_DRAWER_BACKDROP_Z,
          backgroundColor: 'rgba(0,0,0,0.15)',
          opacity: entered ? 1 : 0,
          pointerEvents: entered ? 'auto' : 'none',
        }}
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        className="fixed flex flex-col overflow-hidden bg-white"
        style={{
          top: 0,
          right: 0,
          bottom: 0,
          width: drawerWidth,
          zIndex: PARTNER_DRAWER_PANEL_Z,
          borderLeft: '1px solid #EEEEEE',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.08)',
          transform,
          transition: 'transform 0.25s ease-out',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="partner-drawer-name"
      >
        <div className="z-10 shrink-0 border-b border-border bg-white px-4 pb-3 pt-4">
          <div className="flex gap-3">
            <div
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-xs font-semibold"
              style={getContactAvatarStyle(partner.category)}
              aria-hidden
            >
              {initialsFromDisplayName(partner.fullName || '')}
            </div>
            <div className="min-w-0 flex-1">
              <p id="partner-drawer-name" className="truncate text-base font-semibold text-ink">
                {partner.fullName || 'Unnamed'}
              </p>
              <p className="mt-0.5 truncate text-xs text-neutral-600">
                {formatMonthlyAmount(partner.monthlyAmount, partner.currency)}
              </p>
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
            <div className="mt-3 border-t border-[#EEEEEE]/80 pt-3" onClick={(e) => e.stopPropagation()}>
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

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-2 border-b border-[#EEEEEE] px-3 py-3 text-center text-xs">
            <div>
              <p className="font-semibold uppercase tracking-wide text-mission-muted">Last contact</p>
              <p className={`mt-1 text-sm ${lastBadge.className}`}>{lastBadge.label}</p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wide text-mission-muted">Monthly</p>
              <p className="mt-1 text-sm font-medium text-ink">
                {formatMonthlyAmount(partner.monthlyAmount, partner.currency)}
              </p>
            </div>
            <div>
              <p className="font-semibold uppercase tracking-wide text-mission-muted">Logged</p>
              <p className="mt-1 text-sm font-medium text-ink">
                {logsLoading ? '…' : logs.length}
              </p>
            </div>
          </div>

          <div className="pt-3">
            <div className="px-4 pb-2">
              <div className={SECTION_STRIP}>Contact info</div>
            </div>
            <div className="pb-1">
              <InfoRow
                label="Phone"
                value={partner.phone ? phoneDisp : ''}
                href={telHref || undefined}
              />
              <InfoRow label="Email" value={emailStr} href={emailHref || undefined} />
              <InfoRow label="Address" value={partner.address ? String(partner.address) : ''} />
              <InfoRow label="Category" value={categoryDisp} />
            </div>
          </div>

          {actionError ? <p className="px-4 py-2 text-sm text-red-600">{actionError}</p> : null}

          <div className="grid grid-cols-3 gap-px border-y border-[#EEEEEE] bg-[#EEEEEE] px-0">
            <button
              type="button"
              className="min-h-[44px] bg-white text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={onCall}
            >
              Call
            </button>
            <button
              type="button"
              className="min-h-[44px] bg-white text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={onText}
            >
              Text
            </button>
            <button
              type="button"
              className="min-h-[44px] bg-white text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
              onClick={onLog}
            >
              Log
            </button>
          </div>

          <div className="border-b border-[#EEEEEE] px-4 py-3">
            <div className={SECTION_STRIP}>Activity</div>
            {logsLoading ? (
              <p className="mt-2 text-sm text-neutral-500">Loading…</p>
            ) : logs.length === 0 ? (
              <p className="mt-2 text-sm italic text-neutral-500">No activity logged yet</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {logs.map((log) => {
                  const dt = log.created_at ? new Date(log.created_at) : null;
                  const dateStr =
                    dt && !Number.isNaN(dt.getTime())
                      ? `${dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${dt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                      : '—';
                  const preview = String(log.notes ?? '')
                    .replace(/\s+/g, ' ')
                    .trim();
                  const notePrev = preview.length > 140 ? `${preview.slice(0, 140)}…` : preview || '—';
                  return (
                    <li
                      key={log.id}
                      className="flex items-start gap-2 rounded-lg border border-[#EEEEEE] bg-[#FAFAFA] p-2.5"
                    >
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${commDotClass(log.comm_type)}`} aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-semibold text-neutral-700">{commLabel(log.comm_type)}</span>
                          <span className="text-[11px] text-neutral-500">{dateStr}</span>
                        </div>
                        <p className="mt-0.5 text-sm text-neutral-800">{notePrev}</p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 rounded-md px-2 py-1 text-lg leading-none text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        aria-label="Delete log"
                        onClick={() => void deleteLog(log.id)}
                      >
                        ✕
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#EEEEEE] bg-white p-3">
          <button
            type="button"
            className="w-full rounded-md border border-[#EEEEEE] bg-white py-2.5 text-center text-sm font-semibold text-mission-ink hover:bg-mission-ink/5"
            onClick={onEditFullProfile}
          >
            Edit full profile
          </button>
        </div>
      </aside>
    </>,
    document.body,
  );
}
