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

/** Pill label colors per product spec */
export function postTypeBadgeClass(type) {
  switch (normalizePostTypeKey(type)) {
    case 'field_story':
      return 'bg-green-light text-green';
    case 'prayer':
      return 'bg-rose-light text-[color:var(--rose)]';
    case 'monthly':
      return 'bg-[#F3F4F6] text-[#57534E]';
    case 'win':
      return 'bg-[#FEF9C3] text-[#A16207]';
    default:
      return 'bg-[#F3F4F6] text-mission-muted';
  }
}
