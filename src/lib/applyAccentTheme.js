import { DEFAULT_PROFILE_ACCENT, normalizeProfileAccent } from './profileAppearance';

function parseHex(hex) {
  const s = normalizeProfileAccent(hex).slice(1);
  return {
    r: parseInt(s.slice(0, 2), 16),
    g: parseInt(s.slice(2, 4), 16),
    b: parseInt(s.slice(4, 6), 16),
  };
}

function toHex({ r, g, b }) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Mix accent toward white (0 = accent, 1 = white). */
function mixWithWhite(hex, whiteWeight) {
  const { r, g, b } = parseHex(hex);
  const w = whiteWeight;
  return toHex({
    r: r + (255 - r) * w,
    g: g + (255 - g) * w,
    b: b + (255 - b) * w,
  });
}

function darken(hex, amount) {
  const f = 1 - amount;
  const { r, g, b } = parseHex(hex);
  return toHex({ r: r * f, g: g * f, b: b * f });
}

export function computeAccentPalette(hex) {
  const accent = normalizeProfileAccent(hex);
  return {
    accent,
    accentLight: mixWithWhite(accent, 0.915),
    accentBorder: mixWithWhite(accent, 0.58),
    accentDark: darken(accent, 0.32),
  };
}

export function applyAccentColor(hex) {
  const palette = computeAccentPalette(hex || DEFAULT_PROFILE_ACCENT);
  const root = document.documentElement;
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-light', palette.accentLight);
  root.style.setProperty('--accent-border', palette.accentBorder);
  root.style.setProperty('--accent-dark', palette.accentDark);
  root.style.setProperty('--green', palette.accent);
  root.style.setProperty('--green-light', palette.accentLight);
  root.style.setProperty('--green-border', palette.accentBorder);
  root.style.setProperty('--color-accent', palette.accent);
  root.style.setProperty('--color-success', palette.accent);
  root.style.setProperty('--sent-nav-active', palette.accent);
  root.style.setProperty('--sent-primary', palette.accent);
  root.style.setProperty('--sent-success', palette.accent);
  return palette;
}

export function clearAccentColor() {
  return applyAccentColor(DEFAULT_PROFILE_ACCENT);
}
