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

/** WHERE row popover — same values as {@link CONTACT_STATUS_FORM_OPTIONS}, with accent stripes. */
export const QUICK_STATUS_EDIT_OPTIONS = [
  { value: 'prospect', label: 'Not contacted', accent: '#78716C' },
  { value: 'contacted', label: 'In conversation', accent: '#185FA5' },
  { value: 'meeting_scheduled', label: 'Meeting set', accent: '#0F6E56' },
  { value: 'committed', label: 'Committed', accent: '#7C3AED' },
  { value: 'partner', label: 'Partner', accent: '#185FA5' },
  { value: 'declined', label: 'Not interested', accent: '#A32D2D' },
];

const LABEL_BY_VALUE = CONTACT_STATUS_FORM_OPTIONS.reduce((acc, { value, label }) => {
  acc[value] = label;
  return acc;
}, {});

/** Pill colors for WHERE (status) tags on contact rows — aligns with pipeline strip palette. */
export const STATUS_TAG_COLORS = {
  prospect: { bg: '#F4F4F5', text: '#52525B', border: 'rgba(82, 82, 91, 0.25)' },
  contacted: { bg: '#E8F4FC', text: '#185FA5', border: 'rgba(24, 95, 165, 0.35)' },
  meeting_scheduled: { bg: '#ECFDF5', text: '#0F6E56', border: 'rgba(15, 110, 86, 0.3)' },
  committed: { bg: '#F5F3FF', text: '#7C3AED', border: 'rgba(124, 58, 237, 0.3)' },
  partner: { bg: '#E8F4FC', text: '#185FA5', border: 'rgba(24, 95, 165, 0.35)' },
  declined: { bg: '#FEF2F2', text: '#A32D2D', border: 'rgba(163, 45, 45, 0.25)' },
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
