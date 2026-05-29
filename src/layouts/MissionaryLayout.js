import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const HOME_PATH = '/missionary/overview';

const primarySideItems = [
  { to: HOME_PATH, label: 'Overview' },
  { to: '/missionary/contacts', label: 'Contacts' },
  { to: '/missionary/partners', label: 'Partners' },
  { to: '/missionary/updates', label: 'Updates' },
];

const secondarySideItems = [
  { to: '/missionary/pipeline', label: 'Pipeline' },
  { to: '/missionary/meetings', label: 'Meetings' },
  { to: '/missionary/stats', label: 'Stats' },
  { to: '/missionary/settings', label: 'Settings' },
];

const MORE_PATHS = secondarySideItems.map((it) => it.to);

/** Mobile bottom bar: Home, Contacts, Partners, Updates, More */
const bottomNavItems = [
  {
    to: HOME_PATH,
    label: 'Home',
    ariaLabel: 'Home',
    Icon: IconHome,
    match: (pathname) => pathname === HOME_PATH || pathname === '/missionary',
  },
  {
    to: '/missionary/contacts',
    label: 'Contacts',
    ariaLabel: 'Contacts',
    Icon: IconPerson,
  },
  {
    to: '/missionary/partners',
    label: 'Partners',
    ariaLabel: 'Partners',
    Icon: IconPeople,
  },
  {
    to: '/missionary/updates',
    label: 'Updates',
    ariaLabel: 'Updates',
    Icon: IconSend,
  },
];

const moreSheetItems = [
  { to: '/missionary/pipeline', label: 'Pipeline', Icon: IconPipeline },
  { to: '/missionary/meetings', label: 'Meetings', Icon: IconCalendar },
  { to: '/missionary/stats', label: 'Stats', Icon: IconStats },
  { to: '/missionary/settings', label: 'Settings', Icon: IconGear },
];

function isMoreRoute(pathname) {
  return MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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

function IconSend({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
      />
    </svg>
  );
}

function IconMore({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h.01M12 12h.01M19 12h.01" />
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

function IconCalendar({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

function IconStats({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
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

function navLinkClass(isActive) {
  return `sent-body flex w-full items-center rounded-lg border-l-[3px] px-3 py-2.5 text-left font-medium transition-colors duration-200 ${
    isActive
      ? 'border-green bg-white font-semibold text-green shadow-sm'
      : 'border-transparent text-muted hover:bg-white'
  }`;
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
    <aside className="hidden w-[240px] shrink-0 border-r border-border bg-surface md:flex md:flex-col">
      <div className="border-b border-border px-6 py-5">
        <p className="sent-section-title">SENT</p>
        <p className="sent-caption mt-1">For missionaries and the people who send them.</p>
      </div>
      <nav className="flex-1 overflow-y-auto p-4">
        <ul className="space-y-1">
          {primarySideItems.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} end className={({ isActive }) => navLinkClass(isActive)}>
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="sent-caption mb-2 mt-6 px-3 text-muted">More</p>
        <ul className="space-y-1">
          {secondarySideItems.map((it) => (
            <li key={it.to}>
              <NavLink to={it.to} className={({ isActive }) => navLinkClass(isActive)}>
                {it.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}

function MoreSheet({ open, onClose, onNavigate }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface pb-[max(1rem,env(safe-area-inset-bottom))] shadow-lg"
        role="dialog"
        aria-label="More navigation"
      >
        <div className="flex justify-center py-3">
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden />
        </div>
        <ul className="px-2 pb-2">
          {moreSheetItems.map((it) => {
            const Icon = it.Icon;
            return (
              <li key={it.to}>
                <button
                  type="button"
                  className="sent-body flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-left font-medium text-ink transition-colors hover:bg-[color:var(--color-bg)] active:bg-[color:var(--color-bg)]"
                  onClick={() => onNavigate(it.to)}
                >
                  <Icon className="h-5 w-5 shrink-0 text-muted" />
                  {it.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreActive = isMoreRoute(location.pathname) || moreOpen;

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  const closeMore = () => setMoreOpen(false);

  const handleMoreNavigate = (to) => {
    closeMore();
    navigate(to);
  };

  return (
    <>
      <MoreSheet open={moreOpen} onClose={closeMore} onNavigate={handleMoreNavigate} />
      <nav
        className="fixed inset-x-0 bottom-0 z-40 h-14 border-t border-[#222] bg-[#111] pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Missionary navigation"
      >
        <ul className="mx-auto grid h-14 max-w-mobile grid-cols-5 items-stretch px-0.5">
          {bottomNavItems.map((it) => {
            const Icon = it.Icon;
            const isActive = it.match
              ? it.match(location.pathname)
              : location.pathname === it.to || location.pathname.startsWith(`${it.to}/`);
            return (
              <li key={it.to} className="flex min-h-0 items-stretch justify-center">
                <NavLink
                  to={it.to}
                  aria-label={it.ariaLabel}
                  className={() =>
                    `flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 transition-colors duration-200 active:bg-white/5 ${
                      isActive ? 'text-accent-bright' : 'text-[#555555]'
                    }`
                  }
                >
                  <Icon className="h-[20px] w-[20px] shrink-0" />
                  <span className="sent-nav-label max-w-full truncate text-center">{it.label}</span>
                </NavLink>
              </li>
            );
          })}
          <li className="flex min-h-0 items-stretch justify-center">
            <button
              type="button"
              aria-label="More"
              aria-expanded={moreOpen}
              onClick={() => setMoreOpen((v) => !v)}
              className={`flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 transition-colors duration-200 active:bg-white/5 ${
                moreActive ? 'text-accent-bright' : 'text-[#555555]'
              }`}
            >
              <IconMore className="h-[20px] w-[20px] shrink-0" />
              <span className="sent-nav-label max-w-full truncate text-center">More</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
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
      <main className="flex-1 px-5 py-5 md:px-8 md:py-8 lg:px-10">
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
