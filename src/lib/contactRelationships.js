/**
 * Quick-select relationship tags — stored as plain text on `contacts.relationship` (no DB enum).
 *
 * **Allowed quick-pick strings** (also accepted on save after trim): `friend`, `family`, `pastor`,
 * `church_leader`, `mission_team`, `donor`, `other`. Any other non-empty string is stored as-is for
 * legacy/custom values; the UI shows raw text with a neutral pill when not in this list.
 */
const MUTED = '#888888';
const INK = '#111111';
const GREEN = 'var(--accent)';
const AMBER = '#C17A00';

export const RELATIONSHIP_TAG_OPTIONS = [
  { value: 'friend', label: 'Friend', accent: AMBER },
  { value: 'family', label: 'Family', accent: GREEN },
  { value: 'pastor', label: 'Pastor', accent: AMBER },
  { value: 'church_leader', label: 'Church leader', accent: MUTED },
  { value: 'mission_team', label: 'Mission team', accent: GREEN },
  { value: 'donor', label: 'Donor', accent: AMBER },
  { value: 'other', label: 'Other', accent: MUTED },
];

const VALUE_SET = new Set(RELATIONSHIP_TAG_OPTIONS.map((o) => o.value));

/** Light surface pills for relationship row (Garden). */
const REL_COLORS = Object.fromEntries(
  RELATIONSHIP_TAG_OPTIONS.map((o) => [
    o.value,
    {
      bg: '#FAFAFA',
      text: o.accent,
      border:
        o.accent === GREEN
          ? 'color-mix(in srgb, var(--accent) 27%, transparent)'
          : `${o.accent}44`,
    },
  ]),
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
  return { bg: '#FAFAFA', text: INK, border: 'rgba(136, 136, 136, 0.28)' };
}
