/**
 * Canonical category values stored in `public.contacts.category`.
 *
 * Legacy enum labels (`warm`, `potential_partner`, `potential`) may still exist in Postgres;
 * `normalizeCategoryFromDb` maps those to `null` where appropriate so the UI stays consistent.
 *
 * See `supabase/migrations/20260623100000_contact_category_optional_null.sql`.
 */
export const CONTACT_CATEGORY_VALUES = ['supporter', 'church', 'former', 'connector', 'individual'];

/** Filter tabs above the contacts list. "All" shows everyone (including uncategorized). */
export const CONTACT_CATEGORY_FILTER_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Partners', value: 'supporter' },
  { label: 'Churches / Orgs', value: 'church' },
  { label: 'Previous Partners', value: 'former' },
  { label: 'Connectors', value: 'connector' },
  { label: 'Individuals', value: 'individual' },
];

/**
 * "Who are they?" pills on the add/edit form. The `none` option clears the category back to `null`.
 */
export const CONTACT_CATEGORY_FORM_OPTIONS = [
  { id: 'supporter', label: 'Partner' },
  { id: 'church', label: 'Church / Org' },
  { id: 'former', label: 'Previous Partner' },
  { id: 'connector', label: 'Connector' },
  { id: 'individual', label: 'Individual' },
  { id: 'none', label: 'None' },
];

/** Display labels for category pills. Uncategorized contacts render no label. */
export const CATEGORY_LABELS = {
  supporter: 'Partner',
  church: 'Church / Org',
  former: 'Previous Partner',
  connector: 'Connector',
  individual: 'Individual',
};

const INK = '#181208';
const ON_INK = '#F9F7F2';
const TAN_BG = '#EAE3D8';
const TAN_TEXT = '#6B5D50';
const TAN_BORDER = 'rgba(107, 93, 80, 0.35)';

/** Pill styles — Partner = ink on cream; other categories = tan field + brown text (Theme 3). */
export const CATEGORY_TAG_COLORS = {
  supporter: { bg: INK, text: ON_INK, border: 'rgba(24, 18, 8, 0.35)' },
  church: { bg: TAN_BG, text: TAN_TEXT, border: TAN_BORDER },
  former: { bg: TAN_BG, text: TAN_TEXT, border: TAN_BORDER },
  connector: { bg: TAN_BG, text: TAN_TEXT, border: TAN_BORDER },
  individual: { bg: TAN_BG, text: TAN_TEXT, border: TAN_BORDER },
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
 * `null`, `'none'`, or any unknown / legacy value collapses to `null` so the column can be cleared.
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
