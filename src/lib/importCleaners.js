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

function normalizeUsPhoneDigitsEmbed(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) return d.slice(1);
  if (d.length >= 10) return d.slice(-10);
  return d;
}

const PHONE_EMBEDDED_IN_NAME_RE = /(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;

/**
 * Pull a US-style phone out of a free-text name cell; prefer digits already captured from a phone column.
 * @param {string} rawName
 * @param {string} [existingPhone]
 * @returns {{ name: string, phone: string }} phone is digits-only (may be empty)
 */
export function separatePhoneFromName(rawName, existingPhone = '') {
  const raw = String(rawName ?? '').trim();
  const existingDigits = String(existingPhone ?? '').replace(/\D/g, '');
  if (!raw) {
    return { name: '', phone: existingDigits };
  }
  const m = raw.match(PHONE_EMBEDDED_IN_NAME_RE);
  if (!m) {
    return { name: raw.replace(/\s+/g, ' ').trim(), phone: existingDigits };
  }
  const matched = m[0];
  let extracted = normalizeUsPhoneDigitsEmbed(matched);
  if (extracted.length !== 10) {
    extracted = matched.replace(/\D/g, '');
    if (extracted.length === 11 && extracted.startsWith('1')) extracted = extracted.slice(1);
    if (extracted.length > 10) extracted = extracted.slice(-10);
  }
  const name = raw.replace(matched, ' ').replace(/\s+/g, ' ').trim();
  const phone = existingDigits.length >= 7 ? existingDigits : extracted;
  return { name, phone };
}
