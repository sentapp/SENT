/** Values must match `public.contact_status` enum (plus legacy `followup` mapped on read). */
export const CONTACT_STATUS_VALUES = [
  'prospect',
  'contacted',
  'asked',
  'meeting_scheduled',
  'committed',
  'partner',
  'declined',
];

const ALLOWED = new Set(CONTACT_STATUS_VALUES);

/** Add / Edit contact form — order matches product copy. */
export const CONTACT_STATUS_FORM_OPTIONS = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'asked', label: 'Asked' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { value: 'committed', label: 'Committed' },
  { value: 'partner', label: 'Partner' },
  { value: 'declined', label: 'Declined' },
];

const LABEL_BY_VALUE = CONTACT_STATUS_FORM_OPTIONS.reduce((acc, { value, label }) => {
  acc[value] = label;
  return acc;
}, {});

/** Map legacy DB value for UI + saves. */
export function normalizeStatusFromDb(value) {
  const s = String(value ?? '').trim();
  if (s === 'followup') return 'contacted';
  if (ALLOWED.has(s)) return s;
  return 'prospect';
}

/** Coerce any UI / payload value to a valid enum before insert/update. */
export function normalizeStatusForSave(value) {
  const s = String(value ?? '').trim();
  if (s === 'followup') return 'contacted';
  if (ALLOWED.has(s)) return s;
  return 'prospect';
}

export function statusLabel(value) {
  const v = normalizeStatusFromDb(value);
  return LABEL_BY_VALUE[v] || v || '—';
}
