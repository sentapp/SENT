import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { repairSupporterMissionaryLink } from '../lib/supporterConnection';

const tabs = [
  { to: '/supporter', label: 'Feed', ariaLabel: 'Feed', Icon: IconFeed },
  { to: '/supporter/prayer', label: 'Prayer', ariaLabel: 'Prayer', Icon: IconPray },
  { to: '/supporter/give', label: 'Give', ariaLabel: 'Give', Icon: IconGive },
  { to: '/supporter/refer', label: 'Refer', ariaLabel: 'Refer', Icon: IconRefer },
  { to: '/supporter/profile', label: 'Profile', ariaLabel: 'Profile', Icon: IconProfile },
];

function IconFeed({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
      />
    </svg>
  );
}

function IconPray({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

function IconGive({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function IconRefer({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  );
}

function IconProfile({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.85} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function BottomNav() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 h-14 border-t border-mission-line bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Supporter navigation"
    >
      <ul className="mx-auto grid h-14 max-w-6xl grid-cols-5 items-stretch px-1">
        {tabs.map((t) => {
          const Icon = t.Icon;
          return (
            <li key={t.to} className="flex items-stretch justify-center">
              <NavLink
                to={t.to}
                end={t.to === '/supporter'}
                aria-label={t.ariaLabel}
                className={({ isActive }) =>
                  `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium leading-tight transition-colors duration-200 active:bg-[color:var(--color-bg)] ${
                    isActive ? 'text-[color:var(--sent-nav-active)]' : 'text-[color:var(--sent-nav-inactive)]'
                  }`
                }
              >
                <Icon className="h-[20px] w-[20px] shrink-0" />
                <span className="max-w-full truncate text-center">{t.label}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function SupporterLayout() {
  const { user, refreshProfile } = useAuth();
  const location = useLocation();

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    (async () => {
      await repairSupporterMissionaryLink(user.id, user.user_metadata?.invite_code);
      if (!cancelled) await refreshProfile();
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.user_metadata?.invite_code, refreshProfile]);

  return (
    <div className="min-h-full bg-mission-canvas text-ink">
      <main className="mx-auto w-full max-w-6xl px-5 py-5 pb-28 md:px-8 md:py-8">
        <div key={location.pathname} className="sent-outlet-enter">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
