import { normalizeCategoryFromDb } from './contactCategories';

/** Initials circle colors — Garden multicolor by category. */
export function getContactAvatarStyle(category) {
  const id = normalizeCategoryFromDb(category);
  switch (id) {
    case 'supporter':
      return { backgroundColor: '#2A9A58', color: '#FFFFFF' };
    case 'church':
      return { backgroundColor: '#FDE8EE', color: '#C43D5E' };
    case 'former':
      return { backgroundColor: '#FDF6E8', color: '#C17A00' };
    case 'connector':
      return { backgroundColor: '#EBF5FF', color: '#1060A0' };
    case 'individual':
      return { backgroundColor: '#F5F0FF', color: '#6040B0' };
    default:
      return { backgroundColor: '#FAFAFA', color: '#111111' };
  }
}
