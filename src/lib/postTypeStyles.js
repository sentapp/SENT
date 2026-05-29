/**
 * Normalize missionary post `type` strings for styling (case-insensitive, slug-friendly).
 * @param {string} type
 * @returns {'field_story'|'prayer'|'monthly'|'win'|'default'}
 */
export function normalizePostTypeKey(type) {
  const s = String(type ?? '')
    .trim()
    .toLowerCase()
    .replace(/[/]+/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (!s) return 'default';
  if (s.includes('prayer')) return 'prayer';
  if (s.includes('field') && s.includes('story')) return 'field_story';
  if (s.includes('monthly')) return 'monthly';
  if (s.includes('win') || s.includes('testimony')) return 'win';
  return 'default';
}

/** Flat white card; type is shown via top-left pill badge. */
export function postTypePostCardClass() {
  return '';
}

/** Type label on dark update cards — green accent text, no pill fill */
export function postTypeBadgeClass(type) {
  switch (normalizePostTypeKey(type)) {
    case 'field_story':
    case 'prayer':
    case 'monthly':
    case 'win':
    default:
      return 'bg-transparent text-accent-bright uppercase tracking-wide';
  }
}
