/** Shown when accent_color cannot be persisted (missing column / stale PostgREST schema). */
export const ACCENT_COLUMN_SKIP_MSG =
  'Saved. Accent color could not be stored yet — run the latest database migration when you can.';

/**
 * PostgREST / Postgres errors when `profiles.accent_color` is missing from schema or DB.
 * @param {{ message?: string, details?: string, hint?: string, code?: string } | null | undefined} error
 */
export function isProfilesAccentColumnUnavailable(error) {
  if (!error) return false;
  const combined = `${error.message || ''} ${error.details || ''} ${error.hint || ''} ${error.code || ''}`.toLowerCase();
  if (!/accent_color/i.test(combined)) return false;
  return (
    /schema cache/i.test(combined) ||
    /could not find/i.test(combined) ||
    /does not exist/i.test(combined) ||
    /42703/.test(combined)
  );
}
