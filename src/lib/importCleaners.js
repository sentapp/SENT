/**
 * Sanitize free-text notes on spreadsheet/PDF/device import.
 * Strips spreadsheet junk (numeric-only cells, social handle + row id lines).
 */
export function cleanNotes(value) {
  if (!value) return '';
  const str = value.toString().trim();
  if (/^\d+$/.test(str)) return '';
  if (/^(instagram|facebook|twitter|fb|ig)\s*\|\s*\d+$/i.test(str)) return '';
  return str;
}

/** Digits-only phone for DB; drop obvious junk (too few digits). */
export function cleanPhone(value) {
  if (!value) return '';
  const digits = value.toString().replace(/\D/g, '');
  if (digits.length < 7) return '';
  return digits;
}
