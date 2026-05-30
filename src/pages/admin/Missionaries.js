import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { formatAmount } from '../../lib/currencies';

function MissionaryDrawer({ missionary, onClose }) {
  if (!missionary) return null;

  const funded = missionary.goal_amount > 0
    ? Math.round((missionary.monthly_amount / missionary.goal_amount) * 100)
    : 0;

  return (
    <div className="flex h-full w-[320px] shrink-0 flex-col border-l border-[#EEEEEE] bg-white">
      <div className="flex items-center justify-between border-b border-[#EEEEEE] px-5 py-4">
        <h2 className="font-semibold text-[#111]">{missionary.full_name}</h2>
        <button type="button" onClick={onClose} className="text-[#AAA] hover:text-[#111]">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#888]">Organization</p>
          <p className="mt-1 text-sm text-[#111]">{missionary.organization || '—'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#888]">Location</p>
          <p className="mt-1 text-sm text-[#111]">{missionary.location_name || '—'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#888]">Funding</p>
          <p className="mt-1 font-display text-2xl text-[#111]">{funded}%</p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-[#EEEEEE]">
            <div className="h-1.5 rounded-full bg-[#4CAF7D]" style={{ width: `${Math.min(funded, 100)}%` }} />
          </div>
          <p className="mt-1 text-xs text-[#888]">
            {formatAmount(missionary.monthly_amount || 0, 'USD')} / {formatAmount(missionary.goal_amount || 0, 'USD')} goal
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#888]">Supporters</p>
          <p className="mt-1 text-sm text-[#111]">{missionary.supporter_count ?? 0} connected</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#888]">Supporter Code</p>
          <p className="mt-1 font-mono text-sm text-[#111]">{missionary.supporter_code || '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminMissionaries() {
  const [missionaries, setMissionaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, organization, location_name, monthly_amount, goal_amount, supporter_code, home_currency')
        .eq('role', 'missionary')
        .order('full_name');

      if (!profiles) { setLoading(false); return; }

      const counts = await Promise.all(
        profiles.map((p) =>
          supabase.from('profiles').select('id', { count: 'exact', head: true })
            .eq('role', 'supporter')
            .eq('connected_missionary_id', p.id)
        )
      );

      const enriched = profiles.map((p, i) => ({ ...p, supporter_count: counts[i].count ?? 0 }));
      setMissionaries(enriched);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = missionaries.filter((m) =>
    m.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div style={{ background: '#111', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, color: '#fff', letterSpacing: 1 }}>Missionaries</div>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>{missionaries.length} total</div>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-5">
          <input
            type="text"
            placeholder="Search missionaries…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 w-full max-w-sm rounded-lg border border-[#EEEEEE] bg-white px-4 py-2 text-sm outline-none focus:border-[#4CAF7D]"
          />

          {loading ? (
            <p className="text-sm text-[#AAA]">Loading…</p>
          ) : (
            <div className="rounded-xl border border-[#EEEEEE] bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#EEEEEE] bg-[#FAFAFA] text-left">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Name</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Org</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Funded</th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Supporters</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEEEEE]">
                  {filtered.map((m) => {
                    const funded = m.goal_amount > 0 ? Math.round((m.monthly_amount / m.goal_amount) * 100) : 0;
                    return (
                      <tr
                        key={m.id}
                        className="cursor-pointer hover:bg-[#FAFAFA]"
                        onClick={() => setSelected(m)}
                      >
                        <td className="px-5 py-3 font-medium text-[#111]">{m.full_name}</td>
                        <td className="px-5 py-3 text-[#666]">{m.organization || '—'}</td>
                        <td className="px-5 py-3">
                          <span className={funded >= 80 ? 'text-[#2A9A58]' : funded >= 50 ? 'text-[#906010]' : 'text-[#C03060]'}>
                            {funded}%
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#666]">{m.supporter_count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selected && (
          <MissionaryDrawer missionary={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}
