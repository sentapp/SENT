/** Canonical DB enum values for `public.contact_category` (order = filter / form order after "All"). */
export const CONTACT_CATEGORY_VALUES = ['supporter', 'church', 'former', 'potential'];

export const CONTACT_CATEGORY_FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'supporter', label: 'Supporters' },
  { id: 'church', label: 'Churches' },
  { id: 'former', label: 'Previous' },
  { id: 'potential', label: 'Potential' },
];

export const CONTACT_CATEGORY_FORM_OPTIONS = CONTACT_CATEGORY_FILTER_TABS.filter((t) => t.id !== 'all');

export const CATEGORY_LABELS = CONTACT_CATEGORY_FORM_OPTIONS.reduce((acc, { id, label }) => {
  acc[id] = label;
  return acc;
}, {});

const ALLOWED = new Set(CONTACT_CATEGORY_VALUES);

/** Map DB / legacy rows to a canonical category for UI. */
export function normalizeCategoryFromDb(value) {
  if (value === 'warm' || value === 'potential_partner') return 'potential';
  if (ALLOWED.has(value)) return value;
  return 'potential';
}

/** Coerce UI / import payloads to a valid DB enum before save. */
export function normalizeCategoryForSave(value) {
  if (ALLOWED.has(value)) return value;
  if (value === 'warm' || value === 'potential_partner') return 'potential';
  return 'potential';
}

export function categoryLabel(value) {
  return CATEGORY_LABELS[value] || value || '—';
}
