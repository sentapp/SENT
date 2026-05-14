/** Values must match `public.contact_status` enum (plus legacy `followup` / `asked` mapped on read). */
export const CONTACT_STATUS_VALUES = [
  'prospect',
  'contacted',
  'meeting_scheduled',
  'committed',
  'partner',
  'declined',
];

const ALLOWED = new Set(CONTACT_STATUS_VALUES);

/** Labels for status (lists, popovers, `statusLabel`). */
export const CONTACT_STATUS_FORM_OPTIONS = [
  { value: 'prospect', label: 'Not contacted' },
  { value: 'contacted', label: 'In conversation' },
  { value: 'meeting_scheduled', label: 'Meeting set' },
  { value: 'committed', label: 'Committed' },
  { value: 'partner', label: 'Partner' },
  { value: 'declined', label: 'Not interested' },
];

const MUTED = '#888888';
const GREEN = '#2A9A58';
const AMBER = '#C17A00';
const AMBER_LIGHT = '#FDF6E8';
const GREEN_LIGHT = '#E8F5ED';
const SURFACE = '#FAFAFA';
const ROSE = '#C43D5E';
const ROSE_LIGHT = '#FDE8EE';

/** WHERE row popover — same values as {@link CONTACT_STATUS_FORM_OPTIONS}, with accent stripes. */
export const QUICK_STATUS_EDIT_OPTIONS = [
  { value: 'prospect', label: 'Not contacted', accent: MUTED },
  { value: 'contacted', label: 'In conversation', accent: AMBER },
  { value: 'meeting_scheduled', label: 'Meeting set', accent: GREEN },
  { value: 'committed', label: 'Committed', accent: AMBER },
  { value: 'partner', label: 'Partner', accent: GREEN },
  { value: 'declined', label: 'Not interested', accent: ROSE },
];

const LABEL_BY_VALUE = CONTACT_STATUS_FORM_OPTIONS.reduce((acc, { value, label }) => {
  acc[value] = label;
  return acc;
}, {});

/** Pill colors for WHERE (status) tags — Garden multicolor. */
export const STATUS_TAG_COLORS = {
  prospect: { bg: SURFACE, text: MUTED, border: 'rgba(136, 136, 136, 0.35)' },
  contacted: { bg: AMBER_LIGHT, text: AMBER, border: 'rgba(193, 122, 0, 0.35)' },
  meeting_scheduled: { bg: GREEN_LIGHT, text: GREEN, border: 'rgba(42, 154, 88, 0.35)' },
  committed: { bg: AMBER_LIGHT, text: AMBER, border: 'rgba(193, 122, 0, 0.3)' },
  partner: { bg: GREEN, text: '#FFFFFF', border: 'rgba(42, 154, 88, 0.35)' },
  declined: { bg: ROSE_LIGHT, text: ROSE, border: 'rgba(196, 61, 94, 0.28)' },
};

/** Map legacy DB value for UI + saves. */
export function normalizeStatusFromDb(value) {
  const s = String(value ?? '').trim();
  if (s === 'followup' || s === 'asked') return 'contacted';
  if (ALLOWED.has(s)) return s;
  return 'prospect';
}

/** Coerce any UI / payload value to a valid enum before insert/update. */
export function normalizeStatusForSave(value) {
  const s = String(value ?? '').trim();
  if (s === 'followup' || s === 'asked') return 'contacted';
  if (ALLOWED.has(s)) return s;
  return 'prospect';
}

export function statusLabel(value) {
  const v = normalizeStatusFromDb(value);
  return LABEL_BY_VALUE[v] || v || '—';
}
