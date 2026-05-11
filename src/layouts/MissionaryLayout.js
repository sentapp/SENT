import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const items = [
  { to: '/missionary', label: 'Overview' },
  { to: '/missionary/contacts', label: 'Contacts' },
  { to: '/missionary/partners', label: 'Partners' },
  { to: '/missionary/updates', label: 'Updates' },
  { to: '/missionary/map', label: 'Map' },
  { to: '/missionary/settings', label: 'Settings' },
];

function FullPageLoading() {
  return (
    <div className="flex min-h-full items-center justify-center bg-mission-canvas px-6">
      <p className="text-sm font-medium text-neutral-600">Loading…</p>
    </div>
  );
}

function SideNav() {
  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-neutral-200 bg-white md:flex md:flex-col">
      <div className="border-b border-neutral-200 px-6 py-5">
        <p className="text-lg font-semibold">SENT</p>
        <p className="mt-1 text-xs text-neutral-500">For missionaries and the people who send them.</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.to}>
              <NavLink
                to={it.to}
                end={it.to === '/missionary'}
                className={({ isActive }) =>
                  `flex w-full items-center rounded-card px-3 py-2.5 text-left text-sm font-medium ${
                    isActive
                      ? 'bg-mission-blue/10 text-mission-blue ring-1 ring-mission-blue/20'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`
                }
              >
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-mobile grid-cols-5 px-4 py-2 text-xs">
        {items.slice(0, 5).map((it) => (
          <li key={it.to} className="flex justify-center">
            <NavLink
              to={it.to}
              end={it.to === '/missionary'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-btn px-2 py-1.5 font-semibold ${
                  isActive ? 'text-mission-blue' : 'text-neutral-500'
                }`
              }
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
              <span>{it.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function MissionaryLayout() {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoading />;
  }

  if (profile?.role === 'missionary' && location.pathname !== '/missionary/onboarding') {
    const org = (profile.organization ?? '').trim();
    const ms = (profile.mission_statement ?? '').trim();
    const loc = (profile.location_name ?? '').trim();
    if (!org || !ms || !loc) {
      return <Navigate to="/missionary/onboarding" replace />;
    }
  }

  return (
    <div className="flex min-h-full bg-mission-canvas text-neutral-900">
      <SideNav />
      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto w-full max-w-mobile pb-24 md:max-w-6xl md:pb-0">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
