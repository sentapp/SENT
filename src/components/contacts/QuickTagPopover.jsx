import { useEffect, useRef, useState } from 'react';
import { categoryLabel, getCategoryTagColors, shouldShowCategoryTag } from '../../lib/contactCategories';
import { getRelationshipTagColors, relationshipLabel, RELATIONSHIP_TAG_OPTIONS } from '../../lib/contactRelationships';
import { fullContactPayloadFromQuickTag } from '../../lib/contactQuickTagSave';
import { STATUS_TAG_COLORS, normalizeStatusFromDb, statusLabel } from '../../lib/contactStatuses';

const PANEL_STYLE = {
  backgroundColor: '#ffffff',
  border: '1px solid #E5E2DD',
  borderRadius: 10,
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
  zIndex: 100,
  padding: 6,
  minWidth: 150,
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

const PILL_CLASS =
  'inline-flex max-w-full cursor-pointer items-center truncate rounded-full border px-2.5 py-0.5 text-left text-[11px] font-semibold transition hover:opacity-90';

const ADD_TAG_DETAIL_STYLE = {
  fontSize: 11,
  padding: '4px 10px',
  borderRadius: 20,
  border: '1px dashed #E5E2DD',
  background: 'transparent',
  color: '#9CA3AF',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
};

const ADD_TAG_COMPACT_STYLE = {
  fontSize: 9,
  padding: '2px 6px',
  borderRadius: 20,
  border: '1px dashed #D1D5DB',
  color: '#D1D5DB',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/**
 * Category + status + relationship tags with popover quick-edit (Contacts rows, detail modal, Partners).
 * @param {{
 *   contact: Record<string, unknown>,
 *   updateContact: (id: string, payload: Record<string, unknown>) => Promise<{ ok: boolean, error?: string }>,
 *   onAfterSave?: () => void,
 *   showPotentialAddTag?: boolean,
 *   addTagLabel?: string,
 *   addTagVariant?: 'compact' | 'detail',
 *   addTagWhen?: 'no-category' | 'empty-tags',
 *   className?: string,
 * }} props
 */
export function ContactQuickTagsRow({
  contact,
  updateContact,
  onAfterSave,
  showPotentialAddTag = false,
  addTagLabel = '+ tag',
  addTagVariant = 'compact',
  addTagWhen = 'no-category',
  className = 'flex flex-wrap items-center gap-1.5',
}) {
  const [catOpen, setCatOpen] = useState(false);
  const [stOpen, setStOpen] = useState(false);
  const [relOpen, setRelOpen] = useState(false);

  const runSave = async (field, value) => {
    const payload = fullContactPayloadFromQuickTag(contact, field, value);
    const res = await updateContact(contact.id, payload);
    if (res?.ok) onAfterSave?.();
  };

  const st = normalizeStatusFromDb(contact.status);
  const hasRel = Boolean(contact.relationship && String(contact.relationship).trim());
  const relSt = hasRel ? getRelationshipTagColors(contact.relationship) : null;
  const showCatPill = shouldShowCategoryTag(contact.category);
  const catSt = showCatPill ? getCategoryTagColors(contact.category) : null;
  const showStatusPill = Boolean(contact.status && st !== 'prospect');
  const showAddTagHint =
    showPotentialAddTag && !showCatPill && (addTagWhen === 'empty-tags' ? !hasRel : true);

  const relationshipPill = hasRel ? (
    <QuickTagPopover
      open={relOpen}
      onClose={() => setRelOpen(false)}
      items={QUICK_RELATIONSHIP_EDIT_OPTIONS}
      onPick={(v) => void runSave('relationship', v)}
    >
      <button
        type="button"
        className={PILL_CLASS}
        style={{
          backgroundColor: relSt.bg,
          color: relSt.text,
          borderColor: relSt.border,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setCatOpen(false);
          setStOpen(false);
          setRelOpen((o) => !o);
        }}
      >
        {relationshipLabel(contact.relationship)}
      </button>
    </QuickTagPopover>
  ) : null;

  const addTagControl = (
    <QuickTagPopover
      open={catOpen && !showCatPill}
      onClose={() => setCatOpen(false)}
      items={QUICK_CATEGORY_EDIT_OPTIONS}
      onPick={(v) => void runSave('category', v)}
    >
      {addTagVariant === 'detail' ? (
        <button
          type="button"
          style={ADD_TAG_DETAIL_STYLE}
          onClick={(e) => {
            e.stopPropagation();
            setCatOpen((o) => !o);
            setStOpen(false);
            setRelOpen(false);
          }}
        >
          {addTagLabel}
        </button>
      ) : (
        <span
          role="button"
          tabIndex={0}
          style={ADD_TAG_COMPACT_STYLE}
          onClick={(e) => {
            e.stopPropagation();
            setCatOpen((o) => !o);
            setStOpen(false);
            setRelOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();
            setCatOpen((o) => !o);
            setStOpen(false);
            setRelOpen(false);
          }}
        >
          {addTagLabel}
        </span>
      )}
    </QuickTagPopover>
  );

  if (st === 'partner') {
    const stSt = contactStatusTagStyle('partner');
    return (
      <div className={className}>
        {showAddTagHint ? addTagControl : null}
        {relationshipPill}
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
              setRelOpen(false);
            }}
          >
            {statusLabel('partner')}
          </button>
        </QuickTagPopover>
      </div>
    );
  }

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
              setRelOpen(false);
            }}
          >
            {categoryLabel(contact.category)}
          </button>
        </QuickTagPopover>
      ) : null}

      {showAddTagHint ? addTagControl : null}

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
              setRelOpen(false);
            }}
          >
            {statusLabel(contact.status)}
          </button>
        </QuickTagPopover>
      ) : null}

      {relationshipPill}
    </div>
  );
}
