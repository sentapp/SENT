/** Normalize email before Supabase import; phone is normalized via `cleanPhone` in `importCleaners.js`. */
export { cleanPhone } from './importCleaners';

export function cleanEmail(value) {
  if (!value) return '';
  const str = value.toString().trim();
  const atIdx = str.indexOf('@');
  if (atIdx === -1) return '';
  const afterAt = str.slice(atIdx + 1);
  if (!afterAt.includes('.')) return '';
  return str;
}

/**
 * Collect original phone/email values that were rejected so they can be preserved in notes.
 */
export function extrasFromRejectedContactFields(phone, email, originalPhone, originalEmail) {
  const extras = [];
  if (originalPhone && !phone) extras.push(originalPhone);
  if (originalEmail && !email) extras.push(originalEmail);
  return extras.join(' | ');
}

export function mergeImportNotes(existing, extrasJoined) {
  const e = String(existing || '').trim();
  const x = String(extrasJoined || '').trim();
  if (!x) return e;
  if (!e) return x;
  return `${e}\n${x}`;
}
