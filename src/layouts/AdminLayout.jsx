import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/missionaries', label: 'Missionaries' },
  { to: '/admin/supporters', label: 'Supporters' },
  { to: '/admin/feedback', label: 'Feedback' },
  { to: '/admin/blasts', label: 'Blasts' },
  { to: '/admin/system', label: 'System' },
];

function navClass(isActive) {
  return `flex w-full items-center rounded-md border-l-[3px] px-3 py-2 text-left text-[13px] font-medium transition-colors ${
    isActive
      ? 'border-[#4CAF7D] bg-[#1a1a1a] text-[#4CAF7D]'
      : 'border-transparent text-[#888] hover:bg-[#1a1a1a] hover:text-white'
  }`;
}

export default function AdminLayout() {
  const { profile } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[#F7F5F2] text-[#111]">
      <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#222] bg-[#111] text-white">
        <div className="border-b border-[#222] px-4 py-3">
          <p className="font-display text-xl tracking-wide text-white">SENT</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#4CAF7D]">Admin</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="space-y-0.5">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => navClass(isActive)}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-[#222] px-4 py-2.5">
          <p className="text-[10px] text-[#555]">Signed in as</p>
          <p className="mt-0.5 truncate text-xs text-white">{profile?.display_name || 'Admin'}</p>
        </div>
      </aside>

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div key={location.pathname} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
