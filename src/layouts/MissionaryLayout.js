import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import NotificationBell from '../components/layout/NotificationBell';
import { usePendingMeetingRequestsCount } from '../hooks/usePendingMeetingRequestsCount';
import { MISSIONARY_HOME_PATH, missionaryNavItems } from '../lib/missionaryNav';

function navLinkClass(isActive) {
  return `sent-body flex w-full items-center rounded-lg border-l-[3px] px-3 py-2.5 text-left font-medium transition-colors duration-200 ${
    isActive
      ? 'border-accent-bright bg-[#1a1a1a] font-semibold text-accent-bright'
      : 'border-transparent text-[#888888] hover:bg-[#1a1a1a] hover:text-white'
  }`;
}

function FullPageLoading() {
  return (
    <div className="flex min-h-full items-center justify-center bg-mission-canvas px-6">
      <p className="text-sm font-medium text-muted">Loading…</p>
    </div>
  );
}

function MeetingNavBadge({ count }) {
  if (!count) return null;
  return (
    <span
      className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white"
      aria-label={`${count} pending meeting requests`}
    >
      {count > 9 ? '9+' : count}
    </span>
  );
}

function SideNav({ pendingMeetingCount }) {
  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-[#222] bg-[#111] text-white md:flex md:flex-col">
      <div className="flex items-center justify-between border-b border-[#222] px-5 py-4">
        <div>
          <p className="font-display text-2xl tracking-wide text-white">SENT</p>
          <p className="mt-1 text-[11px] text-[#666]">For missionaries and the people who send them.</p>
        </div>
        <NotificationBell />
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {missionaryNavItems.map((it) => (
            <li key={it.to}>
              <NavLink
                to={it.to}
                end={it.to === MISSIONARY_HOME_PATH}
                className={({ isActive }) => `${navLinkClass(isActive)} flex items-center gap-2`}
              >
                <span>{it.label}</span>
                {it.to === '/missionary/meetings' ? <MeetingNavBadge count={pendingMeetingCount} /> : null}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function BottomNav({ pendingMeetingCount }) {
  const location = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 h-14 border-t border-[#222] bg-[#111] pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Missionary navigation"
    >
      <ul className="mx-auto grid h-14 max-w-mobile grid-cols-6 items-stretch px-0.5">
        {missionaryNavItems.map((it) => {
          const Icon = it.Icon;
          const isActive = it.match
            ? it.match(location.pathname)
            : location.pathname === it.to || location.pathname.startsWith(`${it.to}/`);
          return (
            <li key={it.to} className="flex min-h-0 items-stretch justify-center">
              <NavLink
                to={it.to}
                end={it.to === MISSIONARY_HOME_PATH}
                aria-label={it.ariaLabel}
                className={() =>
                  `relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 transition-colors duration-200 active:bg-white/5 ${
                    isActive ? 'text-accent-bright' : 'text-[#555555]'
                  }`
                }
              >
                <span className="relative">
                  <Icon className="h-[20px] w-[20px] shrink-0" />
                  {it.to === '/missionary/meetings' && pendingMeetingCount > 0 ? (
                    <span
                      className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white"
                      aria-hidden
                    >
                      {pendingMeetingCount > 9 ? '9+' : pendingMeetingCount}
                    </span>
                  ) : null}
                </span>
                <span className="sent-nav-label max-w-full truncate text-center">{it.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function MissionaryLayout() {
  const { profile, loading, user } = useAuth();
  const location = useLocation();
  const { count: pendingMeetingCount } = usePendingMeetingRequestsCount(user?.id);

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
    <div className="flex h-screen overflow-hidden bg-mission-canvas text-ink">
      <SideNav pendingMeetingCount={pendingMeetingCount} />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="mx-auto flex h-full min-h-0 w-full max-w-mobile flex-1 flex-col md:max-w-6xl">
          <div key={location.pathname} className="sent-outlet-enter flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </div>
      </main>
      <BottomNav pendingMeetingCount={pendingMeetingCount} />
    </div>
  );
}
