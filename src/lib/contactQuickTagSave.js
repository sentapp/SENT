import { normalizeCategoryForSave, normalizeCategoryFromDb } from './contactCategories';
import { normalizeRelationshipForSave } from './contactRelationships';
import { normalizeStatusForSave, normalizeStatusFromDb } from './contactStatuses';

/**
 * Computes next category + status after a quick-tag edit (supporter category ↔ partner status).
 */
export function buildQuickTagCategoryStatusPayload(contact, field, value) {
  let category = normalizeCategoryFromDb(contact.category);
  let status = normalizeStatusFromDb(contact.status);
  if (field === 'category') {
    category = normalizeCategoryForSave(value);
    if (category === 'supporter') status = 'partner';
  } else if (field === 'status') {
    status = normalizeStatusForSave(value);
    if (status === 'partner') category = 'supporter';
  }
  return { category, status };
}

/** Full camelCase base for `useSupabaseContacts().updateContact` / `toRow`. */
export function baseContactPayloadForSave(contact) {
  return {
    fullName: contact.fullName ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    address: contact.address ?? '',
    monthlyAmount: contact.monthlyAmount ?? 0,
    isOneTimeDonor: Boolean(contact.isOneTimeDonor),
    oneTimeDonationAmount: contact.oneTimeDonationAmount ?? '',
    oneTimeDonationDate: contact.oneTimeDonationDate ?? '',
    notes: contact.notes ?? '',
    relationship:
      contact.relationship != null && String(contact.relationship).trim() !== ''
        ? String(contact.relationship).trim()
        : '',
  };
}

/** Full camelCase payload for `useSupabaseContacts().updateContact` (toRow needs complete row). */
export function fullContactPayloadFromQuickTag(contact, field, value) {
  if (field === 'relationship') {
    const saved = normalizeRelationshipForSave(value);
    return {
      ...baseContactPayloadForSave(contact),
      category: normalizeCategoryFromDb(contact.category),
      status: normalizeStatusFromDb(contact.status),
      relationship: saved == null ? '' : saved,
    };
  }
  const { category, status } = buildQuickTagCategoryStatusPayload(contact, field, value);
  return {
    ...baseContactPayloadForSave(contact),
    category,
    status,
  };
}

/** Merge quick-tag field into a list/detail `contact` row (camelCase) after a successful save. */
export function mergeContactAfterQuickTag(contact, field, value) {
  const next = { ...contact };
  if (field === 'relationship') {
    const saved = normalizeRelationshipForSave(value);
    next.relationship = saved == null ? '' : saved;
    return next;
  }
  const { category, status } = buildQuickTagCategoryStatusPayload(contact, field, value);
  next.category = category;
  next.status = status;
  return next;
}
