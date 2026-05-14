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

const GREEN = '#2A9A58';
const ON_GREEN = '#FFFFFF';
const ROSE_LIGHT = '#FDE8EE';
const ROSE_TEXT = '#C43D5E';
const AMBER_LIGHT = '#FDF6E8';
const AMBER_TEXT = '#C17A00';
const CONN_BG = '#EBF5FF';
const CONN_TEXT = '#1060A0';
const IND_BG = '#F5F0FF';
const IND_TEXT = '#6040B0';

/** Pill styles — Garden multicolor. */
export const CATEGORY_TAG_COLORS = {
  supporter: { bg: GREEN, text: ON_GREEN, border: 'rgba(42, 154, 88, 0.35)' },
  church: { bg: ROSE_LIGHT, text: ROSE_TEXT, border: 'rgba(196, 61, 94, 0.28)' },
  former: { bg: AMBER_LIGHT, text: AMBER_TEXT, border: 'rgba(193, 122, 0, 0.3)' },
  connector: { bg: CONN_BG, text: CONN_TEXT, border: 'rgba(16, 96, 160, 0.25)' },
  individual: { bg: IND_BG, text: IND_TEXT, border: 'rgba(96, 64, 176, 0.25)' },
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
