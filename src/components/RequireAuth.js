import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { homePathForRole } from '../lib/roles';

function FullPageLoading() {
  return (
    <div className="flex min-h-full items-center justify-center bg-mission-canvas px-6">
      <p className="text-sm font-medium text-neutral-600">Loading…</p>
    </div>
  );
}

/**
 * @param {{ children: React.ReactNode; role?: 'missionary' | 'supporter' | 'admin' }} props
 */
export default function RequireAuth({ children, role }) {
  const { supabaseReady, user, profile, loading } = useAuth();
  const location = useLocation();

  if (!supabaseReady) {
    return (
      <div className="flex min-h-full items-center justify-center bg-mission-canvas px-6">
        <p className="text-sm text-neutral-600">
          Add <code className="text-xs">REACT_APP_SUPABASE_URL</code> and{' '}
          <code className="text-xs">REACT_APP_SUPABASE_ANON_KEY</code> to your <code className="text-xs">.env</code> file.
        </p>
      </div>
    );
  }

  if (loading) {
    return <FullPageLoading />;
  }

  if (!user) {
    return <Navigate to="/signin" replace state={{ from: location.pathname + location.search }} />;
  }

  if (role && profile && profile.role !== role) {
    return <Navigate to={homePathForRole(profile.role)} replace />;
  }

  if (role && !profile) {
    return <FullPageLoading />;
  }

  return children;
}
