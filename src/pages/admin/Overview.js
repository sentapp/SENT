import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

function StatCard({ label, value, sub, color }) {
  return (
    <div className="rounded-xl border border-[#EEEEEE] bg-white p-5">
      <p className={`font-display text-[32px] leading-none tracking-wide ${color || 'text-[#111]'}`}>{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[#888]">{label}</p>
      {sub ? <p className="mt-1 text-xs text-[#AAA]">{sub}</p> : null}
    </div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: profiles }, { data: feedback }, { count: feedbackCount }] = await Promise.all([
        supabase.from('profiles').select('id, role, connected_missionary_id'),
        supabase.from('feedback').select('id, message, created_at, user_id').order('created_at', { ascending: false }).limit(5),
        supabase.from('feedback').select('id', { count: 'exact', head: true }),
      ]);

      const missionaries = (profiles || []).filter((p) => p.role === 'missionary');
      const supporters = (profiles || []).filter((p) => p.role === 'supporter');
      const connected = supporters.filter((p) => p.connected_missionary_id);
      const ratio = missionaries.length > 0 ? (supporters.length / missionaries.length).toFixed(1) : '—';

      setStats({
        missionaries: missionaries.length,
        supporters: supporters.length,
        connected: connected.length,
        ratio,
        feedbackCount: feedbackCount ?? 0,
      });
      setRecentFeedback(feedback || []);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div>
      <header className="border-b border-[#222] bg-[#111] px-8 py-5 text-white">
        <h1 className="font-display text-[28px] leading-none tracking-wide">Overview</h1>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[#666]">Platform at a glance</p>
      </header>

      <div className="px-8 py-6">
        {loading ? (
          <p className="text-sm text-[#AAA]">Loading…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <StatCard label="Missionaries" value={stats.missionaries} />
              <StatCard label="Supporters" value={stats.supporters} sub={`${stats.connected} connected`} />
              <StatCard label="Supporter Ratio" value={`${stats.ratio}x`} sub="per missionary" color="text-accent-bright" />
              <StatCard label="Feedback" value={stats.feedbackCount} sub="submissions" />
            </div>

            <div className="mt-8">
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-widest text-[#888]">Recent Feedback</h2>
              {recentFeedback.length === 0 ? (
                <p className="text-sm text-[#AAA]">No feedback yet.</p>
              ) : (
                <div className="divide-y divide-[#EEEEEE] rounded-xl border border-[#EEEEEE] bg-white">
                  {recentFeedback.map((f) => (
                    <div key={f.id} className="px-5 py-3">
                      <p className="text-sm text-[#111]">{f.message}</p>
                      <p className="mt-0.5 text-xs text-[#AAA]">{new Date(f.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
