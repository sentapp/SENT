/** Normalize for duplicate comparison */
export function normalizePhone(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d;
}

export function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

export function normalizeFullName(n) {
  return String(n || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const MIN_PHONE_DIGITS = 7;

/**
 * Find first existing contact that matches incoming row (same phone OR email OR full name).
 * Phone match requires at least MIN_PHONE_DIGITS digits.
 */
export function findDuplicateMatch(incoming, existingContacts) {
  if (!existingContacts?.length) return null;

  const inPhone = normalizePhone(incoming.phone);
  const inEmail = normalizeEmail(incoming.email);
  const inName = normalizeFullName(incoming.full_name ?? incoming.fullName ?? incoming.name);

  for (const ex of existingContacts) {
    const exPhone = normalizePhone(ex.phone);
    if (inPhone.length >= MIN_PHONE_DIGITS && exPhone.length >= MIN_PHONE_DIGITS && inPhone === exPhone) {
      return { id: ex.id, fullName: ex.fullName || '' };
    }
    if (inEmail && normalizeEmail(ex.email) === inEmail) {
      return { id: ex.id, fullName: ex.fullName || '' };
    }
    if (inName.length > 0 && normalizeFullName(ex.fullName ?? ex.full_name) === inName) {
      return { id: ex.id, fullName: ex.fullName || '' };
    }
  }
  return null;
}

/**
 * Annotate import drafts: duplicateOf, default selected false if duplicate.
 */
export function annotateDraftsWithDuplicates(drafts, existingContacts) {
  return drafts.map((d) => {
    const match = findDuplicateMatch(d, existingContacts);
    const duplicateOf = match ? { id: match.id, fullName: match.fullName } : null;
    return {
      ...d,
      duplicateOf,
      selected: duplicateOf ? false : d.selected !== undefined ? d.selected : true,
    };
  });
}

export function findPhoneConflict(phone, contacts, { excludeId } = {}) {
  const p = normalizePhone(phone);
  if (p.length < MIN_PHONE_DIGITS) return null;
  return (
    contacts.find((c) => c.id !== excludeId && normalizePhone(c.phone) === p && normalizePhone(c.phone).length >= MIN_PHONE_DIGITS) ||
    null
  );
}

export function findEmailConflict(email, contacts, { excludeId } = {}) {
  const e = normalizeEmail(email);
  if (!e) return null;
  return contacts.find((c) => c.id !== excludeId && normalizeEmail(c.email) === e) || null;
}

/** Strip UI-only fields for Supabase insert/update */
export function draftToInsertPayload(d) {
  const full_name = String(d.full_name ?? d.fullName ?? d.name ?? '').trim();
  return {
    full_name,
    phone: d.phone || '',
    email: d.email || '',
    category: d.category === 'warm' ? 'potential_partner' : d.category || 'potential_partner',
    status: d.status || 'prospect',
    monthly_amount: Number.isFinite(Number(d.monthly_amount)) ? Number(d.monthly_amount) : 0,
    notes: d.notes || '',
  };
}
