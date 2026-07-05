const MIGRATION_COUNT = 41;

function envConfigured() {
  return Boolean(process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY);
}

export default function AdminSystem() {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || '';
  const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || null;
  const dashboardUrl = projectRef
    ? `https://supabase.com/dashboard/project/${projectRef}`
    : 'https://supabase.com/dashboard';

  return (
    <div>
      <div style={{ background: '#111', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, color: '#fff', letterSpacing: 1 }}>System</div>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>Settings and platform health</div>
      </div>
      <div className="p-8">
        <div className="divide-y divide-[#EEEEEE] rounded-xl border border-[#EEEEEE] bg-white">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-[#111]">Supabase dashboard</p>
              <p className="mt-0.5 text-xs text-[#888]">Database, auth, logs, and storage</p>
            </div>
            <a
              href={dashboardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm font-medium text-[color:var(--accent)] hover:underline"
            >
              Open dashboard →
            </a>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-[#111]">Database migrations</p>
              <p className="mt-0.5 text-xs text-[#888]">SQL files in supabase/migrations/</p>
            </div>
            <span className="font-display text-2xl text-[#111]">{MIGRATION_COUNT}</span>
          </div>
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-[#111]">Environment</p>
              <p className="mt-0.5 text-xs text-[#888]">REACT_APP_SUPABASE_URL and ANON_KEY</p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-medium ${
                envConfigured() ? 'bg-[color:var(--accent-light)] text-[color:var(--accent)]' : 'bg-[#FFF8E8] text-[#906010]'
              }`}
            >
              {envConfigured() ? 'Configured' : 'Missing keys'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
