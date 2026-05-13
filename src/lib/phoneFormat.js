/** Pretty-print a stored phone for UI only. `tel:` / `sms:` links should use {@link phoneDigits}. */
export function formatPhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  const local = digits.length === 11 && digits[0] === '1' ? digits.slice(1) : digits;
  if (local.length === 10) {
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return String(phone);
}

/** Digits only — use for `tel:` and `sms:` hrefs. */
export function phoneDigits(raw) {
  return String(raw ?? '').replace(/\D/g, '');
}
