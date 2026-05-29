/** @param {string | null | undefined} role */
export function isAdminRole(role) {
  return role === 'admin';
}

/** Default post-sign-in / wrong-portal redirect for a profile role. */
export function homePathForRole(role) {
  if (role === 'missionary') return '/missionary';
  if (role === 'admin') return '/admin';
  return '/supporter';
}
