/**
 * Coerce any UI/import value to a DB-safe `contacts.category` enum.
 * Some deployments keep NOT NULL on `category`; use `potential` instead of null/invalid.
 */
export function safeCategoryValue(cat) {
  const valid = ['supporter', 'church', 'former', 'potential'];
  return valid.includes(cat) ? cat : 'potential';
}
