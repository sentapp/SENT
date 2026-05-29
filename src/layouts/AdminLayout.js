import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/missionaries', label: 'Missionaries' },
  { to: '/admin/supporters', label: 'Supporters' },
  { to: '/admin/feedback', label: 'Feedback & Reports' },
  { to: '/admin/blast', label: 'Blast Notification' },
];

function navClass(isActive) {
  return `flex w-full items-center rounded-lg border-l-[3px] px-3 py-2.5 text-left text-sm font-medium transition-colors ${
    isActive
      ? 'border-accent-bright bg-[#1a1a1a] text-accent-bright'
      : 'border-transparent text-[#888] hover:bg-[#1a1a1a] hover:text-white'
  }`;
}

export default function AdminLayout() {
  const { profile } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F5F2] text-[#111]">
      {/* Sidebar */}
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-[#222] bg-[#111] text-white">
        <div className="border-b border-[#222] px-5 py-4">
          <p className="font-display text-2xl tracking-wide text-white">SENT</p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-widest text-red-400">Admin</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => navClass(isActive)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-[#222] px-5 py-3">
          <p className="text-xs text-[#555]">Signed in as</p>
          <p className="mt-0.5 truncate text-sm text-white">{profile?.display_name || 'Admin'}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div key={location.pathname} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
