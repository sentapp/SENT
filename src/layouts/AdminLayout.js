import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const navItems = [
  { label: 'Overview', path: '/admin' },
  { label: 'Missionaries', path: '/admin/missionaries' },
  { label: 'Supporters', path: '/admin/supporters' },
  { label: 'Feedback', path: '/admin/feedback' },
  { label: 'Blast', path: '/admin/blasts' },
  { label: 'System', path: '/admin/system' },
];

export default function AdminLayout() {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F9F9F9' }}>
      <div style={{ width: 220, background: '#111', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: '20px', borderBottom: '0.5px solid #222' }}>
          <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 24, color: '#fff', letterSpacing: 2 }}>SENT</div>
          <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>Admin panel</div>
        </div>
        <nav style={{ flex: 1, padding: '10px 0' }}>
          {navItems.map(item => (
            <NavLink key={item.path} to={item.path} end={item.path === '/admin'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', padding: '9px 20px', fontSize: 13,
                color: isActive ? 'var(--accent)' : '#666',
                background: isActive ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                textDecoration: 'none', transition: 'all .15s',
              })}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '16px 20px', borderTop: '0.5px solid #222' }}>
          <button
            onClick={async () => { await signOut(); navigate('/'); }}
            style={{
              width: '100%', padding: '8px 12px',
              background: 'transparent', border: '0.5px solid #333',
              borderRadius: 6, color: '#666', fontSize: 12,
              cursor: 'pointer', textAlign: 'left', letterSpacing: '.03em',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#666'}
          >
            Sign out →
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
