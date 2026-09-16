/** @param {string | null | undefined} role */
export function isAdminRole(role) {
  return role === 'admin';
}

/** Default post-sign-in / wrong-portal redirect for a profile role. */
export function homePathForRole(role) {
  if (role === 'missionary') return '/missionary/overview';
  if (role === 'admin') return '/admin';
  return '/supporter';
}

/**
 * Where to send someone who just signed up or signed in.
 * Only an explicit false goes to first-run onboarding; null/undefined stays on the dashboard
 * so existing accounts are not locked in.
 * @param {{ role?: string | null, onboarding_complete?: boolean | null } | null | undefined} profile
 * @param {string | null | undefined} [roleFallback]
 */
export function pathAfterAuth(profile, roleFallback) {
  const role = profile?.role || roleFallback;
  if (role !== 'admin' && profile && profile.onboarding_complete === false) {
    return '/onboarding';
  }
  return homePathForRole(role);
}
