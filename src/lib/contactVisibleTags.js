import { normalizeCategoryFromDb, shouldShowCategoryTag } from './contactCategories';
import { normalizeStatusFromDb } from './contactStatuses';

/**
 * Which contact tags to render (avoids duplicate Partner on category + status).
 * @param {Record<string, unknown> | null | undefined} contact
 * @returns {{ showCategory: boolean, showRelationship: boolean, showStatus: boolean }}
 */
export function getVisibleTags(contact) {
  const category = normalizeCategoryFromDb(contact?.category);
  const status = normalizeStatusFromDb(contact?.status);
  const relationship =
    contact?.relationship != null && String(contact.relationship).trim() !== ''
      ? String(contact.relationship).trim()
      : null;

  const showCategory =
    shouldShowCategoryTag(contact?.category) && !(category === 'supporter' && status === 'partner');
  const showRelationship = Boolean(relationship);
  const showStatus = status !== 'prospect';

  return { showCategory, showRelationship, showStatus };
}
