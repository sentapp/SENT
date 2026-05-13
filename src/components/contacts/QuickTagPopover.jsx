import { useEffect, useRef, useState } from 'react';
import { categoryLabel, getCategoryTagColors, normalizeCategory } from '../../lib/contactCategories';
import { fullContactPayloadFromQuickTag } from '../../lib/contactQuickTagSave';
import { STATUS_TAG_COLORS, normalizeStatusFromDb, statusLabel } from '../../lib/contactStatuses';

const PANEL_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #E5E2DD',
  borderRadius: 10,
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
  zIndex: 100,
  padding: 6,
  minWidth: 140,
};

export const QUICK_CATEGORY_EDIT_OPTIONS = [
  { value: 'supporter', label: 'Partner', accent: '#0F6E56' },
  { value: 'church', label: 'Church / Org', accent: '#7C3AED' },
  { value: 'former', label: 'Previous Partner', accent: '#A32D2D' },
  { value: 'none', label: 'None', accent: '#78716C' },
];

export const QUICK_STATUS_EDIT_OPTIONS = [
  { value: 'prospect', label: 'Not contacted', accent: '#78716C' },
  { value: 'contacted', label: 'In conversation', accent: '#185FA5' },
  { value: 'meeting_scheduled', label: 'Meeting set', accent: '#0F6E56' },
  { value: 'committed', label: 'Committed', accent: '#7C3AED' },
  { value: 'partner', label: 'Partner', accent: '#185FA5' },
  { value: 'declined', label: 'Not interested', accent: '#A32D2D' },
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

const PILL_CLASS =
  'inline-flex max-w-full cursor-pointer items-center truncate rounded-full border px-2.5 py-0.5 text-left text-[11px] font-semibold transition hover:opacity-90';

/**
 * Category + status tags with popover quick-edit (Contacts rows, detail modal, Partners).
 * @param {{
 *   contact: Record<string, unknown>,
 *   updateContact: (id: string, payload: Record<string, unknown>) => Promise<{ ok: boolean, error?: string }>,
 *   onAfterSave?: () => void,
 *   showPotentialAddTag?: boolean,
 *   className?: string,
 * }} props
 */
export function ContactQuickTagsRow({
  contact,
  updateContact,
  onAfterSave,
  showPotentialAddTag = false,
  className = 'flex flex-wrap items-center gap-1.5',
}) {
  const [catOpen, setCatOpen] = useState(false);
  const [stOpen, setStOpen] = useState(false);

  const runSave = async (field, value) => {
    const payload = fullContactPayloadFromQuickTag(contact, field, value);
    const res = await updateContact(contact.id, payload);
    if (res?.ok) onAfterSave?.();
  };

  const st = normalizeStatusFromDb(contact.status);
  const showAddTagHint = showPotentialAddTag && normalizeCategory(contact.category) == null;

  if (st === 'partner') {
    const stSt = contactStatusTagStyle('partner');
    return (
      <div className={className}>
        <QuickTagPopover
          open={stOpen}
          onClose={() => setStOpen(false)}
          items={QUICK_STATUS_EDIT_OPTIONS}
          onPick={(v) => void runSave('status', v)}
        >
          <button
            type="button"
            className={PILL_CLASS}
            style={{
              backgroundColor: stSt.bg,
              color: stSt.text,
              borderColor: stSt.border,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setStOpen((o) => !o);
              setCatOpen(false);
            }}
          >
            {statusLabel('partner')}
          </button>
        </QuickTagPopover>
      </div>
    );
  }

  const catSt = getCategoryTagColors(contact.category);
  const showCatPill = Boolean(catSt);
  const showStatusPill = Boolean(contact.status && st !== 'prospect');

  return (
    <div className={className}>
      {showCatPill ? (
        <QuickTagPopover
          open={catOpen}
          onClose={() => setCatOpen(false)}
          items={QUICK_CATEGORY_EDIT_OPTIONS}
          onPick={(v) => void runSave('category', v)}
        >
          <button
            type="button"
            className={PILL_CLASS}
            style={{
              backgroundColor: catSt.bg,
              color: catSt.text,
              borderColor: catSt.border,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setCatOpen((o) => !o);
              setStOpen(false);
            }}
          >
            {categoryLabel(contact.category)}
          </button>
        </QuickTagPopover>
      ) : null}

      {showAddTagHint ? (
        <QuickTagPopover
          open={catOpen && !showCatPill}
          onClose={() => setCatOpen(false)}
          items={QUICK_CATEGORY_EDIT_OPTIONS}
          onPick={(v) => void runSave('category', v)}
        >
          <button
            type="button"
            className="text-[11px] font-medium text-neutral-400 opacity-0 transition-opacity hover:text-neutral-500 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              setCatOpen((o) => !o);
              setStOpen(false);
            }}
          >
            + tag
          </button>
        </QuickTagPopover>
      ) : null}

      {showStatusPill ? (
        <QuickTagPopover
          open={stOpen}
          onClose={() => setStOpen(false)}
          items={QUICK_STATUS_EDIT_OPTIONS}
          onPick={(v) => void runSave('status', v)}
        >
          <button
            type="button"
            className={PILL_CLASS}
            style={{
              backgroundColor: contactStatusTagStyle(contact.status).bg,
              color: contactStatusTagStyle(contact.status).text,
              borderColor: contactStatusTagStyle(contact.status).border,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setStOpen((o) => !o);
              setCatOpen(false);
            }}
          >
            {statusLabel(contact.status)}
          </button>
        </QuickTagPopover>
      ) : null}
    </div>
  );
}
