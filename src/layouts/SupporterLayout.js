import { NavLink, Outlet } from 'react-router-dom';

const tabs = [
  { to: '/supporter', label: 'Feed' },
  { to: '/supporter/map', label: 'Map' },
  { to: '/supporter/prayer', label: 'Prayer' },
  { to: '/supporter/give', label: 'Give' },
  { to: '/supporter/refer', label: 'Refer' },
  { to: '/supporter/profile', label: 'Profile' },
];

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 backdrop-blur">
      <ul className="mx-auto grid max-w-6xl grid-cols-6 px-1 py-2 text-[10px] sm:grid-cols-6 sm:px-2 sm:text-xs">
        {tabs.map((t) => (
          <li key={t.to} className="flex justify-center">
            <NavLink
              to={t.to}
              end={t.to === '/supporter'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-btn px-2 py-1.5 font-semibold ${
                  isActive ? 'text-mission-blue' : 'text-neutral-500'
                }`
              }
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
              <span>{t.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export default function SupporterLayout() {
  return (
    <div className="min-h-full bg-mission-canvas text-neutral-900">
      <main className="mx-auto w-full max-w-6xl px-6 py-8 pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

