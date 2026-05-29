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
        .select('id, display_name, email, connected_missionary_id')
        .eq('role', 'supporter')
        .order('display_name');

      if (!data) { setLoading(false); return; }

      const missionaryIds = [...new Set(data.map((s) => s.connected_missionary_id).filter(Boolean))];
      let missionaryMap = {};
      if (missionaryIds.length > 0) {
        const { data: missionaries } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', missionaryIds);
        (missionaries || []).forEach((m) => { missionaryMap[m.id] = m.display_name; });
      }

      setSupporters(data.map((s) => ({ ...s, missionary_name: missionaryMap[s.connected_missionary_id] || null })));
      setLoading(false);
    }
    load();
  }, []);

  const filtered = supporters.filter((s) =>
    s.display_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="border-b border-[#222] bg-[#111] px-8 py-5 text-white">
        <h1 className="font-display text-[28px] leading-none tracking-wide">Supporters</h1>
        <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-[#666]">{supporters.length} total</p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-5">
        <input
          type="text"
          placeholder="Search supporters…"
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
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Connected to</th>
                  <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEEEEE]">
                {filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-[#FAFAFA]">
                    <td className="px-5 py-3 font-medium text-[#111]">{s.display_name || '—'}</td>
                    <td className="px-5 py-3 text-[#666]">{s.missionary_name || <span className="text-[#AAA]">Not connected</span>}</td>
                    <td className="px-5 py-3">
                      {s.connected_missionary_id ? (
                        <span className="rounded-full bg-[#EDFAF2] px-2 py-0.5 text-[11px] font-medium text-[#2A9A58]">Connected</span>
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
