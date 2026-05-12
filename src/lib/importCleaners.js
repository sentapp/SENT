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

/**
 * Pull a trailing US-style phone out of a free-text name cell; prefer an existing phone column when present.
 * @param {string} rawName
 * @param {string} [existingPhone]
 * @returns {{ name: string, phone: string }} phone is digits-only (may be empty)
 */
export function separatePhoneFromName(rawName, existingPhone = '') {
  const raw = String(rawName ?? '');
  const existing = existingPhone ?? '';
  const phonePattern = /\s+(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\s*$/;
  const match = raw.match(phonePattern);
  if (match) {
    const digits = match[0].replace(/\D/g, '');
    const phone = digits.length >= 10 ? digits.slice(-10) : '';
    const cleanName = raw.replace(match[0], '').trim();
    return { name: cleanName, phone: existing || phone };
  }
  return { name: raw, phone: existing };
}
