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

/** Left accent bar + subtle tint for feed-style post cards */
export function postTypePostCardClass(type) {
  switch (normalizePostTypeKey(type)) {
    case 'field_story':
      return 'border-l-[4px] border-l-mission-green bg-gradient-to-r from-mission-green/[0.06] to-white';
    case 'prayer':
      return 'border-l-[4px] border-l-mission-purple bg-gradient-to-r from-mission-purple/[0.07] to-white';
    case 'monthly':
      return 'border-l-[4px] border-l-mission-blue bg-gradient-to-r from-mission-blue/[0.06] to-white';
    case 'win':
      return 'border-l-[4px] border-l-amber-500 bg-gradient-to-r from-amber-500/[0.08] to-white';
    default:
      return 'border-l-[4px] border-l-neutral-200 bg-white';
  }
}

/** Compact pill label for post type */
export function postTypeBadgeClass(type) {
  switch (normalizePostTypeKey(type)) {
    case 'field_story':
      return 'bg-mission-green/12 text-mission-green';
    case 'prayer':
      return 'bg-mission-purple/12 text-mission-purple';
    case 'monthly':
      return 'bg-mission-blue/12 text-mission-blue';
    case 'win':
      return 'bg-amber-500/15 text-amber-800';
    default:
      return 'bg-neutral-100 text-mission-muted';
  }
}
