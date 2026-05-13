/**
 * Canonical category values stored in `public.contacts.category` (3 optional values + NULL).
 *
 * Most contacts have NO category — saved as `null` in the database and rendered with no pill in
 * lists, detail headers, or tag rows. The Postgres enum `public.contact_category` still carries
 * the legacy `potential` / `warm` / `potential_partner` labels because enum values cannot be
 * removed in place; the app simply stops writing them and `normalizeCategoryFromDb` maps any
 * surviving legacy rows to `null` so the UI is consistent.
 *
 * See `supabase/migrations/20260623100000_contact_category_optional_null.sql`.
 */
export const CONTACT_CATEGORY_VALUES = ['supporter', 'church', 'former'];

/** Filter tabs above the contacts list. "All" shows everyone (including uncategorized). */
export const CONTACT_CATEGORY_FILTER_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Partners', value: 'supporter' },
  { label: 'Churches / Orgs', value: 'church' },
  { label: 'Previous Partners', value: 'former' },
];

/**
 * "Who are they?" pills on the add/edit form. The `none` option clears the category back to `null`.
 */
export const CONTACT_CATEGORY_FORM_OPTIONS = [
  { id: 'supporter', label: 'Partner' },
  { id: 'church', label: 'Church / Org' },
  { id: 'former', label: 'Previous Partner' },
  { id: 'none', label: 'None' },
];

/** Display labels for the three real categories. Uncategorized contacts render no label. */
export const CATEGORY_LABELS = {
  supporter: 'Partner',
  church: 'Church / Org',
  former: 'Previous Partner',
};

/** Tailwind-friendly pill styles — uncategorized contacts have no entry on purpose. */
export const CATEGORY_TAG_COLORS = {
  supporter: { bg: '#ECFDF5', text: '#0F6E56', border: 'rgba(15, 110, 86, 0.3)' },
  church: { bg: '#F5F3FF', text: '#7C3AED', border: 'rgba(124, 58, 237, 0.3)' },
  former: { bg: '#FEF2F2', text: '#A32D2D', border: 'rgba(163, 45, 45, 0.25)' },
};

const ALLOWED = new Set(CONTACT_CATEGORY_VALUES);

/**
 * Map a row's DB value to a canonical UI category.
 * Legacy enum labels (`warm`, `potential_partner`, `potential`) and any unknown value become `null`
 * (uncategorized — no pill).
 */
export function normalizeCategoryFromDb(value) {
  if (value == null) return null;
  if (value === 'supporters') return 'supporter';
  if (ALLOWED.has(value)) return value;
  return null;
}

/** Same as {@link normalizeCategoryFromDb} — use for list filters and pill matching. */
export function normalizeCategory(cat) {
  return normalizeCategoryFromDb(cat);
}

/**
 * Coerce UI / import payloads to a valid DB value before save.
 * `null`, `'none'`, or any unknown / legacy value collapses to `null` so the column drops to its
 * NULL default and uncategorized contacts truly have no category.
 */
export function normalizeCategoryForSave(value) {
  if (value == null) return null;
  if (value === 'none') return null;
  if (value === 'supporters') return 'supporter';
  if (ALLOWED.has(value)) return value;
  return null;
}

/** True when a contact has a real category that should render as a pill. */
export function shouldShowCategoryTag(value) {
  return normalizeCategoryFromDb(value) != null;
}

/**
 * Resolve pill color styles for a contact category, or `null` when uncategorized so callers can
 * skip the WHO pill entirely instead of rendering a placeholder style.
 */
export function getCategoryTagColors(value) {
  const id = normalizeCategoryFromDb(value);
  if (!id) return null;
  return CATEGORY_TAG_COLORS[id] || null;
}

/** Display label for a category value. `null` / unknown returns empty string so callers can hide pills. */
export function categoryLabel(value) {
  const id = normalizeCategoryFromDb(value);
  if (!id) return '';
  return CATEGORY_LABELS[id] || '';
}
