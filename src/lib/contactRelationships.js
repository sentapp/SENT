/**
 * Quick-select relationship tags (plain text stored on `contacts.relationship`).
 * Colors align with category/status accent palette.
 */
export const RELATIONSHIP_TAG_OPTIONS = [
  { value: 'friend', label: 'Friend', accent: '#185FA5' },
  { value: 'family', label: 'Family', accent: '#0F6E56' },
  { value: 'pastor', label: 'Pastor', accent: '#7C3AED' },
  { value: 'church_leader', label: 'Church leader', accent: '#854F0B' },
  { value: 'mission_team', label: 'Mission team', accent: '#0F766E' },
  { value: 'donor', label: 'Donor', accent: '#A16207' },
  { value: 'other', label: 'Other', accent: '#78716C' },
];

const VALUE_SET = new Set(RELATIONSHIP_TAG_OPTIONS.map((o) => o.value));

const REL_COLORS = Object.fromEntries(
  RELATIONSHIP_TAG_OPTIONS.map((o) => [o.value, { bg: '#F5F5F4', text: o.accent, border: `${o.accent}40` }]),
);

/** @param {unknown} value */
export function normalizeRelationshipFromDb(value) {
  if (value == null) return '';
  const s = String(value).trim();
  if (!s) return '';
  if (VALUE_SET.has(s)) return s;
  return s;
}

/** Persist: known quick values as-is; arbitrary text trimmed; empty → null. */
export function normalizeRelationshipForSave(value) {
  if (value == null) return null;
  if (value === '__none__' || value === 'none' || value === '') return null;
  const s = String(value).trim();
  if (!s) return null;
  if (VALUE_SET.has(s)) return s;
  return s;
}

export function relationshipLabel(value) {
  const id = String(value ?? '').trim();
  if (!id) return '';
  const opt = RELATIONSHIP_TAG_OPTIONS.find((o) => o.value === id);
  if (opt) return opt.label;
  return id;
}

export function getRelationshipTagColors(value) {
  const id = String(value ?? '').trim();
  if (!id) return null;
  if (REL_COLORS[id]) {
    const c = REL_COLORS[id];
    return { bg: c.bg, text: c.text, border: c.border };
  }
  return { bg: '#F5F5F4', text: '#44403C', border: 'rgba(68, 64, 60, 0.25)' };
}
