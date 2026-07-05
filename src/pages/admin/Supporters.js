import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

export default function AdminSupporters() {
  const [supporters, setSupporters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, email, connected_missionary_id')
        .eq('role', 'supporter')
        .order('full_name');

      if (!data) { setLoading(false); return; }

      const missionaryIds = [...new Set(data.map((s) => s.connected_missionary_id).filter(Boolean))];
      let missionaryMap = {};
      if (missionaryIds.length > 0) {
        const { data: missionaries } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', missionaryIds);
        (missionaries || []).forEach((m) => { missionaryMap[m.id] = m.full_name; });
      }

      setSupporters(data.map((s) => ({ ...s, missionary_name: missionaryMap[s.connected_missionary_id] || null })));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = supporters.filter((s) =>
    s.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div style={{ background: '#111', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, color: '#fff', letterSpacing: 1 }}>Supporters</div>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>{supporters.length} total</div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5">
        <input
          type="text"
          placeholder="Search supporters…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full max-w-sm rounded-lg border border-[#EEEEEE] bg-white px-4 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
        />

        {loading ? (
          <p className="text-sm text-[#AAA]">Loading…</p>
        ) : (
          <div className="rounded-xl border border-[#EEEEEE] bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#EEEEEE] bg-[#FAFAFA] text-left">
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Name</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Connected to</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE]">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAFAFA]">
                    <td className="px-5 py-3 font-medium text-[#111]">{s.full_name || '—'}</td>
                    <td className="px-5 py-3 text-[#666]">{s.missionary_name || <span className="text-[#AAA]">Not connected</span>}</td>
                    <td className="px-5 py-3">
                      {s.connected_missionary_id ? (
                        <span className="rounded-full bg-[color:var(--accent-light)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--accent)]">Connected</span>
                      ) : (
                        <span className="rounded-full bg-[#F5F5F5] px-2 py-0.5 text-[11px] font-medium text-[#AAA]">Unconnected</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
