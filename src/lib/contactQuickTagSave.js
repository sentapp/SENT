import { normalizeCategoryForSave, normalizeCategoryFromDb } from './contactCategories';
import { safeCategoryValue } from './safeCategory';
import { normalizeRelationshipForSave } from './contactRelationships';
import { normalizeStatusForSave, normalizeStatusFromDb } from './contactStatuses';
import { addDaysFromNow } from './dateHelpers';

/**
 * Persist a single quick-tag field with a scoped partial `UPDATE` (category+status, or relationship only).
 * Prefer this over sending a full `contacts` row so optional-column stripping cannot drop the field being edited.
 */
export async function saveQuickTagToSupabase(supabase, { missionaryId, contact, field, value }) {
  if (!supabase || !missionaryId || !contact?.id) {
    return { ok: false, error: 'Missing Supabase context.' };
  }
  let patch = {};
  if (field === 'relationship') {
    patch = { relationship: normalizeRelationshipForSave(value) };
  } else if (field === 'category' || field === 'status') {
    const { category, status } = buildQuickTagCategoryStatusPayload(contact, field, value);
    const statusSaved = normalizeStatusForSave(status);
    patch = {
      category: safeCategoryValue(category),
      status: statusSaved,
    };
    if (field === 'status') {
      if (statusSaved === 'not_right_now') {
        const existing = contact.followUpDate || contact.follow_up_date;
        patch.follow_up_date =
          existing && String(existing).trim() ? String(existing).slice(0, 10) : addDaysFromNow(90);
      } else {
        patch.follow_up_date = null;
      }
    }
  } else {
    return { ok: false, error: 'Unknown quick-tag field.' };
  }

  const { error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', contact.id)
    .eq('missionary_id', missionaryId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

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
  return { category: safeCategoryValue(category), status };
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
      category: safeCategoryValue(normalizeCategoryFromDb(contact.category)),
      status: normalizeStatusFromDb(contact.status),
      relationship: saved == null ? '' : saved,
    };
  }
  const { category, status } = buildQuickTagCategoryStatusPayload(contact, field, value);
  const statusSaved = normalizeStatusForSave(status);
  const followUpDate =
    statusSaved === 'not_right_now'
      ? contact.followUpDate || contact.follow_up_date || addDaysFromNow(90)
      : null;
  return {
    ...baseContactPayloadForSave(contact),
    category,
    status: statusSaved,
    followUpDate,
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
  const statusSaved = normalizeStatusForSave(status);
  next.category = normalizeCategoryFromDb(category);
  next.status = statusSaved;
  if (field === 'status') {
    if (statusSaved === 'not_right_now') {
      next.followUpDate =
        contact.followUpDate || contact.follow_up_date || addDaysFromNow(90);
    } else {
      next.followUpDate = '';
    }
  }
  return next;
}
