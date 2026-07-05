export const ALL_FIELDS_FILTER = 'All fields';

/** Distinct non-empty location names from community posts (profile + post). */
export function deriveLocationFiltersFromPosts(posts) {
  const seen = new Set();
  const locations = [];

  for (const post of posts) {
    for (const value of [post.authorLocation, post.locationName]) {
      const trimmed = (value || '').trim();
      if (!trimmed) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      locations.push(trimmed);
    }
  }

  locations.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  return [ALL_FIELDS_FILTER, ...locations];
}

export function matchesCommunityLocationFilter(post, filter) {
  if (filter === ALL_FIELDS_FILTER) return true;
  const needle = filter.toLowerCase();
  const haystack = `${post.locationName || ''} ${post.authorLocation || ''} ${post.authorOrg || ''}`.toLowerCase();
  return haystack.includes(needle);
}
