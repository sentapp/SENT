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
  { value: 'prospect', label: 'Not contacted', accent: '#9C8C78' },
  { value: 'contacted', label: 'In conversation', accent: '#6B5D50' },
  { value: 'meeting_scheduled', label: 'Meeting set', accent: '#181208' },
  { value: 'committed', label: 'Committed', accent: '#6B5D50' },
  { value: 'partner', label: 'Partner', accent: '#181208' },
  { value: 'declined', label: 'Not interested', accent: '#A32D2D' },
];

const LABEL_BY_VALUE = CONTACT_STATUS_FORM_OPTIONS.reduce((acc, { value, label }) => {
  acc[value] = label;
  return acc;
}, {});

const STONE = '#9C8C78';
const BROWN = '#6B5D50';
const INK = '#181208';
const TAN_BG = '#EAE3D8';
const TAN_DEEP = '#D4C9BA';

/** Pill colors for WHERE (status) tags — tan / stone palette (Theme 3). */
export const STATUS_TAG_COLORS = {
  prospect: { bg: '#F2EDE4', text: STONE, border: 'rgba(156, 140, 120, 0.35)' },
  contacted: { bg: TAN_BG, text: BROWN, border: 'rgba(107, 93, 80, 0.35)' },
  meeting_scheduled: { bg: TAN_DEEP, text: INK, border: 'rgba(24, 18, 8, 0.22)' },
  committed: { bg: TAN_BG, text: BROWN, border: 'rgba(107, 93, 80, 0.35)' },
  partner: { bg: TAN_DEEP, text: INK, border: 'rgba(24, 18, 8, 0.25)' },
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
