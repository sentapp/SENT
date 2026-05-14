/** Default matches Garden primary / DB `profiles.accent_color` when unset. */
export const DEFAULT_PROFILE_ACCENT = '#2A9A58';

export const ACCENT_PRESETS = [
  { hex: '#2A9A58', label: 'Green' },
  { hex: '#1060A0', label: 'Blue' },
  { hex: '#6040B0', label: 'Purple' },
  { hex: '#C17A00', label: 'Amber' },
  { hex: '#C43D5E', label: 'Rose' },
  { hex: '#0D7377', label: 'Teal' },
  { hex: '#3730A3', label: 'Indigo' },
  { hex: '#334155', label: 'Slate' },
];

export function normalizeProfileAccent(hex) {
  const s = String(hex || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toUpperCase();
  return DEFAULT_PROFILE_ACCENT;
}

export function initialsFromDisplayName(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase() || '?';
}
