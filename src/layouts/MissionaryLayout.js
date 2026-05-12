import { NavLink, Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const items = [
  { to: '/missionary', label: 'Overview' },
  { to: '/missionary/contacts', label: 'Contacts' },
  { to: '/missionary/pipeline', label: 'Pipeline' },
  { to: '/missionary/partners', label: 'Partners' },
  { to: '/missionary/updates', label: 'Updates' },
  { to: '/missionary/settings', label: 'Settings' },
];

/** Mobile bottom bar: 6 tabs — icons + labels; active #1C1917, inactive #A8A29E. */
const bottomNavItems = [
  {
    to: '/missionary',
    label: 'Overview',
    activeLabel: 'Overview',
    ariaLabel: 'Overview',
    Icon: IconHome,
  },
  {
    to: '/missionary/contacts',
    label: 'Contacts',
    activeLabel: 'Contacts',
    ariaLabel: 'Contacts',
    Icon: IconPerson,
  },
  {
    to: '/missionary/pipeline',
    label: 'Pipeline',
    activeLabel: 'Pipeline',
    ariaLabel: 'Pipeline',
    Icon: IconPipeline,
  },
  {
    to: '/missionary/partners',
    label: 'Partners',
    activeLabel: 'Partners',
    ariaLabel: 'Partners',
    Icon: IconPeople,
  },
  {
    to: '/missionary/updates',
    label: 'Updates',
    activeLabel: 'Updates',
    ariaLabel: 'Updates',
    Icon: IconPost,
  },
  {
    to: '/missionary/settings',
    label: 'Settings',
    activeLabel: 'Profile',
    ariaLabel: 'Profile and settings',
    Icon: IconGear,
  },
];

function IconHome({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
      />
    </svg>
  );
}

function IconPipeline({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
    </svg>
  );
}

function IconPerson({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function IconPeople({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}

function IconPost({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
      />
    </svg>
  );
}

function IconGear({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function FullPageLoading() {
  return (
    <div className="flex min-h-full items-center justify-center bg-mission-canvas px-6">
      <p className="text-sm font-medium text-muted">Loading…</p>
    </div>
  );
}

function SideNav() {
  return (
    <aside className="hidden w-[240px] shrink-0 border-r border-mission-line bg-surface md:flex md:flex-col">
      <div className="border-b border-mission-line px-6 py-5">
        <p className="sent-section-title">SENT</p>
        <p className="sent-caption mt-1">For missionaries and the people who send them.</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.to}>
              <NavLink
                to={it.to}
                end={it.to === '/missionary'}
                className={({ isActive }) =>
                  `sent-body flex w-full items-center rounded-btn px-3 py-2.5 text-left font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-[color:var(--color-bg)] font-semibold text-mission-ink ring-1 ring-mission-line'
                      : 'text-mission-muted hover:bg-[color:var(--color-bg)]'
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
    <nav
      className="fixed inset-x-0 bottom-0 z-40 h-14 border-t border-mission-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Missionary navigation"
    >
      <ul className="mx-auto grid h-14 max-w-mobile grid-cols-6 items-stretch px-0.5">
        {bottomNavItems.map((it) => {
          const Icon = it.Icon;
          return (
            <li key={it.to} className="flex min-h-0 items-stretch justify-center">
              <NavLink
                to={it.to}
                end={it.to === '/missionary'}
                aria-label={it.ariaLabel}
                className={({ isActive }) =>
                  `flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10px] font-medium leading-tight transition-colors duration-200 active:bg-[color:var(--color-bg)] ${
                    isActive ? 'text-[color:var(--sent-nav-active)]' : 'text-[color:var(--sent-nav-inactive)]'
                  }`
                }
              >
                <Icon className="h-[20px] w-[20px] shrink-0" />
                <span className="max-w-full truncate text-center">{it.label}</span>
              </NavLink>
            </li>
          );
        })}
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
    <div className="flex min-h-full bg-mission-canvas text-ink">
      <SideNav />
      <main className="flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto w-full max-w-mobile pb-[max(7rem,calc(4rem+env(safe-area-inset-bottom)))] md:max-w-6xl md:pb-0">
          <div key={location.pathname} className="sent-outlet-enter">
            <Outlet />
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
