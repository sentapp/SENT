import { normalizeCategoryForSave, normalizeCategoryFromDb } from './contactCategories';
import { normalizeStatusForSave, normalizeStatusFromDb } from './contactStatuses';

/**
 * Computes next category + status after a quick-tag edit, matching
 * {@link ContactEditFormLayout}: supporter category ↔ partner status.
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

/** Full camelCase payload for `useSupabaseContacts().updateContact` (toRow needs complete row). */
export function fullContactPayloadFromQuickTag(contact, field, value) {
  const { category, status } = buildQuickTagCategoryStatusPayload(contact, field, value);
  return {
    fullName: contact.fullName ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    address: contact.address ?? '',
    category,
    status,
    monthlyAmount: contact.monthlyAmount ?? 0,
    isOneTimeDonor: Boolean(contact.isOneTimeDonor),
    oneTimeDonationAmount: contact.oneTimeDonationAmount ?? '',
    oneTimeDonationDate: contact.oneTimeDonationDate ?? '',
    notes: contact.notes ?? '',
  };
}
