const MIGRATION_COUNT = 40;

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
      <header className="border-b border-[#222] bg-[#111] px-8 py-5 text-white">
        <h1 className="font-display text-2xl tracking-wide">System</h1>
        <p className="mt-1 text-sm text-[#888]">Settings and platform health</p>
      </header>
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
              className="shrink-0 text-sm font-medium text-[#4CAF7D] hover:underline"
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
                envConfigured() ? 'bg-[#EDFAF2] text-[#2A9A58]' : 'bg-[#FFF8E8] text-[#906010]'
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
