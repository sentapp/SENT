import { normalizeCategoryForSave } from './contactCategories';
import { normalizeStatusForSave } from './contactStatuses';

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
 * Import duplicate rule: skip if same phone (7+ digits) OR same full name as an existing contact.
 * Does not use email (import spec).
 */
export function isImportDuplicateByPhoneOrName(candidate, existingContacts) {
  if (!existingContacts?.length) return false;
  const inPhone = normalizePhone(candidate.phone);
  const inName = normalizeFullName(candidate.full_name ?? candidate.fullName ?? candidate.name);
  for (const ex of existingContacts) {
    const exPhone = normalizePhone(ex.phone);
    if (inPhone.length >= MIN_PHONE_DIGITS && exPhone.length >= MIN_PHONE_DIGITS && inPhone === exPhone) {
      return true;
    }
    if (inName.length > 0) {
      const exName = normalizeFullName(ex.fullName ?? ex.full_name);
      if (exName.length > 0 && exName === inName) return true;
    }
  }
  return false;
}

/** Same rules as {@link isImportDuplicateByPhoneOrName} but against already-built insert rows (same import batch). */
export function isImportDuplicateByPhoneOrNameAgainstRows(candidate, rows) {
  if (!rows?.length) return false;
  const inPhone = normalizePhone(candidate.phone);
  const inName = normalizeFullName(candidate.full_name);
  for (const r of rows) {
    const exPhone = normalizePhone(r.phone);
    if (inPhone.length >= MIN_PHONE_DIGITS && exPhone.length >= MIN_PHONE_DIGITS && inPhone === exPhone) {
      return true;
    }
    if (inName.length > 0) {
      const exName = normalizeFullName(r.full_name);
      if (exName.length > 0 && exName === inName) return true;
    }
  }
  return false;
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
    category: normalizeCategoryForSave(d.category),
    status: normalizeStatusForSave(d.status),
    monthly_amount: Number.isFinite(Number(d.monthly_amount)) ? Number(d.monthly_amount) : 0,
    notes: d.notes || '',
    address: String(d.address ?? '').trim(),
    is_one_time_donor: Boolean(d.is_one_time_donor ?? d.isOneTimeDonor),
    one_time_donation_amount: Number.isFinite(Number(d.one_time_donation_amount))
      ? Number(d.one_time_donation_amount)
      : 0,
    one_time_donation_date: d.one_time_donation_date ? String(d.one_time_donation_date).slice(0, 10) : null,
  };
}
