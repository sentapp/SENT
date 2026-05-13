/** Canonical DB enum values for `public.contact_category` (order = filter / form order after "All"). */
export const CONTACT_CATEGORY_VALUES = ['supporter', 'church', 'former', 'potential'];

export const CONTACT_CATEGORY_FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'supporter', label: 'Partners' },
  { id: 'church', label: 'Church/Org' },
  { id: 'former', label: 'Previous' },
  { id: 'potential', label: 'My Network' },
];

export const CONTACT_CATEGORY_FORM_OPTIONS = CONTACT_CATEGORY_FILTER_TABS.filter((t) => t.id !== 'all');

export const CATEGORY_LABELS = CONTACT_CATEGORY_FORM_OPTIONS.reduce((acc, { id, label }) => {
  acc[id] = label;
  return acc;
}, {});

/** Category `supporter` is stored in DB; display as Partner everywhere. */
CATEGORY_LABELS.supporter = 'Partner';

/** Tailwind-friendly pill styles (WHO tag) — border + text use accent #185FA5 for partner cohort. */
export const CATEGORY_TAG_COLORS = {
  supporter: { bg: '#E8F4FC', text: '#185FA5', border: 'rgba(24, 95, 165, 0.35)' },
  church: { bg: '#FFFBEB', text: '#854F0B', border: 'rgba(133, 79, 11, 0.25)' },
  former: { bg: '#F4F4F5', text: '#52525B', border: 'rgba(82, 82, 91, 0.35)' },
  potential: { bg: '#F4F4F5', text: '#404040', border: 'rgba(163, 163, 163, 0.8)' },
};

const ALLOWED = new Set(CONTACT_CATEGORY_VALUES);

/** Map DB / legacy rows to a canonical category for UI. */
export function normalizeCategoryFromDb(value) {
  if (value === 'supporters') return 'supporter';
  if (value === 'warm' || value === 'potential_partner') return 'potential';
  if (ALLOWED.has(value)) return value;
  return 'potential';
}

/** Same as {@link normalizeCategoryFromDb} — use for list filters and pill matching. */
export function normalizeCategory(cat) {
  return normalizeCategoryFromDb(cat);
}

/** Coerce UI / import payloads to a valid DB enum before save. */
export function normalizeCategoryForSave(value) {
  if (value === 'supporters') return 'supporter';
  if (ALLOWED.has(value)) return value;
  if (value === 'warm' || value === 'potential_partner') return 'potential';
  return 'potential';
}

export function categoryLabel(value) {
  const id = normalizeCategoryFromDb(value);
  return CATEGORY_LABELS[id] || CATEGORY_LABELS[value] || value || '—';
}
