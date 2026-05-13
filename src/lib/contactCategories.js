/** Canonical DB enum values for `public.contact_category` (includes `potential` = uncategorized in UI). */
export const CONTACT_CATEGORY_VALUES = ['supporter', 'church', 'former', 'potential'];

/** List filters: first tab is All; `potential` has no tab (only appears under All). */
export const CONTACT_CATEGORY_FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'supporter', label: 'Partners' },
  { id: 'church', label: 'Churches / Orgs' },
  { id: 'former', label: 'Previous Partners' },
];

/** "Who are they?" pills — None saves `potential` in DB. */
export const CONTACT_CATEGORY_FORM_OPTIONS = [
  { id: 'supporter', label: 'Partner' },
  { id: 'church', label: 'Church / Org' },
  { id: 'former', label: 'Previous Partner' },
  { id: 'potential', label: 'None' },
];

/** Labels for selects and saves; `potential` is shown as "None", never as a category tag in lists. */
const CATEGORY_FORM_LABELS = CONTACT_CATEGORY_FORM_OPTIONS.reduce((acc, { id, label }) => {
  acc[id] = label;
  return acc;
}, {});

/** Tailwind-friendly pill styles — only for categories that show a tag in list/detail. */
export const CATEGORY_TAG_COLORS = {
  supporter: { bg: '#E8F4FC', text: '#185FA5', border: 'rgba(24, 95, 165, 0.35)' },
  church: { bg: '#FFFBEB', text: '#854F0B', border: 'rgba(133, 79, 11, 0.25)' },
  former: { bg: '#F4F4F5', text: '#52525B', border: 'rgba(82, 82, 91, 0.35)' },
};

const ALLOWED = new Set(CONTACT_CATEGORY_VALUES);

/** Map DB / legacy rows to a canonical category for UI and filters. */
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

/** True when a category tag should appear in list rows, detail header, pipeline, etc. */
export function shouldShowCategoryTag(value) {
  const id = normalizeCategoryFromDb(value);
  return id === 'supporter' || id === 'church' || id === 'former';
}

/** Style object for a visible category tag, or null when uncategorized (`potential`). */
export function getCategoryTagColors(value) {
  const id = normalizeCategoryFromDb(value);
  return CATEGORY_TAG_COLORS[id] ?? null;
}

/** Form / select label (includes "None" for `potential`). */
export function categoryLabel(value) {
  const id = normalizeCategoryFromDb(value);
  return CATEGORY_FORM_LABELS[id] ?? '';
}
