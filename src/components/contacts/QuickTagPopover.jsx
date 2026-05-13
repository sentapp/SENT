import { useEffect, useRef, useState } from 'react';
import { categoryLabel, getCategoryTagColors, shouldShowCategoryTag } from '../../lib/contactCategories';
import { getRelationshipTagColors, relationshipLabel, RELATIONSHIP_TAG_OPTIONS } from '../../lib/contactRelationships';
import { fullContactPayloadFromQuickTag, mergeContactAfterQuickTag } from '../../lib/contactQuickTagSave';
import { QUICK_STATUS_EDIT_OPTIONS, STATUS_TAG_COLORS, normalizeStatusFromDb, statusLabel } from '../../lib/contactStatuses';

const PANEL_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #E5E2DD',
  borderRadius: 10,
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
  zIndex: 260,
  padding: 6,
  minWidth: 150,
};

export const QUICK_CATEGORY_EDIT_OPTIONS = [
  { value: 'supporter', label: 'Partner', accent: '#0F6E56' },
  { value: 'church', label: 'Church / Org', accent: '#7C3AED' },
  { value: 'former', label: 'Previous Partner', accent: '#A32D2D' },
  { value: 'connector', label: 'Connector', accent: '#C2410C' },
  { value: 'individual', label: 'Individual', accent: '#0369A1' },
  { value: 'none', label: 'None', accent: '#78716C' },
];

export const QUICK_RELATIONSHIP_EDIT_OPTIONS = [
  ...RELATIONSHIP_TAG_OPTIONS,
  { value: '__none__', label: 'Clear', accent: '#78716C' },
];

function contactStatusTagStyle(status) {
  const id = normalizeStatusFromDb(status);
  return STATUS_TAG_COLORS[id] || STATUS_TAG_COLORS.prospect;
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   items: { value: string, label: string, accent?: string }[],
 *   onPick: (value: string) => void | Promise<void>,
 *   children: import('react').ReactNode,
 * }} props
 */
export function QuickTagPopover({ open, onClose, items, onPick, children }) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <span ref={rootRef} className="relative inline-flex max-w-full items-center">
      {children}
      {open ? (
        <div
          className="absolute left-0 top-[calc(100%+4px)]"
          style={PANEL_STYLE}
          role="menu"
          aria-label="Choose an option"
        >
          <div className="flex flex-col gap-0.5">
            {items.map((item) => (
              <button
                key={item.value}
                type="button"
                role="menuitem"
                className="w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-ink transition hover:bg-neutral-50"
                style={
                  item.accent
                    ? { borderLeft: `3px solid ${item.accent}`, marginLeft: 0, paddingLeft: 9 }
                    : undefined
                }
                onClick={() => {
                  onClose();
                  void onPick(item.value);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </span>
  );
}

const PILL_DEFAULT =
  'inline-flex max-w-full cursor-pointer items-center truncate rounded-full border px-2.5 py-0.5 text-left text-[11px] font-semibold transition';
const PILL_COMPACT =
  'inline-flex max-w-full cursor-pointer items-center truncate rounded-full border px-2 py-0.5 text-left text-[9px] font-semibold leading-tight transition';

const PH_DEFAULT =
  'inline-flex min-h-[28px] cursor-pointer items-center rounded-full border border-dashed border-neutral-200 bg-transparent px-2.5 py-0.5 text-[11px] font-medium text-neutral-400';
const PH_COMPACT =
  'inline-flex min-h-[24px] cursor-pointer items-center rounded-full border border-dashed border-neutral-200 bg-transparent px-2 py-0.5 text-[9px] font-medium text-neutral-400';

/**
 * Three stacked rows: WHO (category), RELATIONSHIP, WHERE (status). Placeholders always visible when unset.
 * @param {{
 *   contact: Record<string, unknown>,
 *   updateContact?: (id: string, payload: Record<string, unknown>) => Promise<{ ok: boolean, error?: string }>,
 *   saveQuickTag?: (contact: Record<string, unknown>, field: string, value: string) => Promise<{ ok: boolean, error?: string }>,
 *   onAfterSave?: () => void,
 *   onPatchContact?: (next: Record<string, unknown>) => void,
 *   patchContactInList?: (id: string, partial: Record<string, unknown>) => void,
 *   variant?: 'default' | 'compact',
 *   className?: string,
 *   deferSave?: boolean,
 *   setForm?: (fn: (prev: Record<string, unknown>) => Record<string, unknown>) => void,
 * }} props
 */
export function ContactThreeQuickTagRows({
  contact,
  updateContact,
  saveQuickTag,
  onAfterSave,
  onPatchContact,
  patchContactInList,
  variant = 'default',
  className = 'flex flex-col gap-1',
  deferSave = false,
  setForm,
}) {
  const [catOpen, setCatOpen] = useState(false);
  const [stOpen, setStOpen] = useState(false);
  const [relOpen, setRelOpen] = useState(false);

  const pillClass = variant === 'compact' ? PILL_COMPACT : PILL_DEFAULT;
  const phClass = variant === 'compact' ? PH_COMPACT : PH_DEFAULT;

  const closeOthers = (keep) => {
    if (keep !== 'cat') setCatOpen(false);
    if (keep !== 'st') setStOpen(false);
    if (keep !== 'rel') setRelOpen(false);
  };

  const runSave = async (field, value) => {
    if (deferSave && setForm) {
      setForm((f) => {
        const base = { ...contact, category: f.category, status: f.status, relationship: f.relationship ?? '' };
        const merged = mergeContactAfterQuickTag(base, field, value);
        return {
          ...f,
          category: merged.category,
          status: merged.status,
          relationship: merged.relationship ?? '',
        };
      });
      return;
    }
    if (!updateContact && !saveQuickTag) return;
    const merged = mergeContactAfterQuickTag(contact, field, value);
    let res;
    if (saveQuickTag) {
      res = await saveQuickTag(contact, field, value);
    } else {
      const payload = fullContactPayloadFromQuickTag(contact, field, value);
      res = await updateContact(contact.id, payload);
    }
    if (res?.ok) {
      patchContactInList?.(contact.id, merged);
      onPatchContact?.(merged);
      onAfterSave?.();
    } else if (import.meta.env.DEV && res?.error) {
      // eslint-disable-next-line no-console
      console.error('[ContactThreeQuickTagRows] save failed:', res.error);
    }
  };

  const st = normalizeStatusFromDb(contact.status);
  const hasRel = Boolean(contact.relationship && String(contact.relationship).trim());
  const relSt = hasRel ? getRelationshipTagColors(contact.relationship) : null;
  const showCatPill = shouldShowCategoryTag(contact.category);
  const catSt = showCatPill ? getCategoryTagColors(contact.category) : null;
  const showWherePill = st !== 'prospect';

  const whoTrigger = showCatPill ? (
    <QuickTagPopover
      open={catOpen}
      onClose={() => setCatOpen(false)}
      items={QUICK_CATEGORY_EDIT_OPTIONS}
      onPick={(v) => void runSave('category', v)}
    >
      <button
        type="button"
        className={pillClass}
        style={{
          backgroundColor: catSt.bg,
          color: catSt.text,
          borderColor: catSt.border,
        }}
        onClick={(e) => {
          e.stopPropagation();
          closeOthers('cat');
          setCatOpen((o) => !o);
        }}
      >
        {categoryLabel(contact.category)}
      </button>
    </QuickTagPopover>
  ) : (
    <QuickTagPopover
      open={catOpen}
      onClose={() => setCatOpen(false)}
      items={QUICK_CATEGORY_EDIT_OPTIONS}
      onPick={(v) => void runSave('category', v)}
    >
      <button
        type="button"
        className={phClass}
        onClick={(e) => {
          e.stopPropagation();
          closeOthers('cat');
          setCatOpen((o) => !o);
        }}
      >
        + Who are they?
      </button>
    </QuickTagPopover>
  );

  const relTrigger = hasRel ? (
    <QuickTagPopover
      open={relOpen}
      onClose={() => setRelOpen(false)}
      items={QUICK_RELATIONSHIP_EDIT_OPTIONS}
      onPick={(v) => void runSave('relationship', v)}
    >
      <button
        type="button"
        className={pillClass}
        style={{
          backgroundColor: relSt.bg,
          color: relSt.text,
          borderColor: relSt.border,
        }}
        onClick={(e) => {
          e.stopPropagation();
          closeOthers('rel');
          setRelOpen((o) => !o);
        }}
      >
        {relationshipLabel(contact.relationship)}
      </button>
    </QuickTagPopover>
  ) : (
    <QuickTagPopover
      open={relOpen}
      onClose={() => setRelOpen(false)}
      items={QUICK_RELATIONSHIP_EDIT_OPTIONS}
      onPick={(v) => void runSave('relationship', v)}
    >
      <button
        type="button"
        className={phClass}
        onClick={(e) => {
          e.stopPropagation();
          closeOthers('rel');
          setRelOpen((o) => !o);
        }}
      >
        + Relationship
      </button>
    </QuickTagPopover>
  );

  const whereSt = contactStatusTagStyle(contact.status);
  const whereTrigger = showWherePill ? (
    <QuickTagPopover
      open={stOpen}
      onClose={() => setStOpen(false)}
      items={QUICK_STATUS_EDIT_OPTIONS}
      onPick={(v) => void runSave('status', v)}
    >
      <button
        type="button"
        className={pillClass}
        style={{
          backgroundColor: whereSt.bg,
          color: whereSt.text,
          borderColor: whereSt.border,
        }}
        onClick={(e) => {
          e.stopPropagation();
          closeOthers('st');
          setStOpen((o) => !o);
        }}
      >
        {statusLabel(contact.status)}
      </button>
    </QuickTagPopover>
  ) : (
    <QuickTagPopover
      open={stOpen}
      onClose={() => setStOpen(false)}
      items={QUICK_STATUS_EDIT_OPTIONS}
      onPick={(v) => void runSave('status', v)}
    >
      <button
        type="button"
        className={phClass}
        onClick={(e) => {
          e.stopPropagation();
          closeOthers('st');
          setStOpen((o) => !o);
        }}
      >
        + Where are they?
      </button>
    </QuickTagPopover>
  );

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">{whoTrigger}</div>
      <div className="flex flex-wrap items-center gap-1.5">{relTrigger}</div>
      <div className="flex flex-wrap items-center gap-1.5">{whereTrigger}</div>
    </div>
  );
}
