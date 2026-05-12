/** Default matches design token `--color-accent` / DB `profiles.accent_color` default (#185FA5). */
export const DEFAULT_PROFILE_ACCENT = '#185FA5';

export const ACCENT_PRESETS = [
  { hex: '#185FA5', label: 'Blue' },
  { hex: '#0F6E56', label: 'Green' },
  { hex: '#534AB7', label: 'Purple' },
  { hex: '#854F0B', label: 'Amber' },
  { hex: '#A32D2D', label: 'Rose' },
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
