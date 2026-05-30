import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

const STATUS_COLORS = {
  open: { bg: '#FFF8E8', text: '#906010' },
  resolved: { bg: '#EDFAF2', text: '#2A9A58' },
  dismissed: { bg: '#F5F5F5', text: '#888' },
};

export default function AdminFeedback() {
  const [feedback, setFeedback] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('feedback');

  useEffect(() => {
    async function load() {
      const [{ data: fb }, { data: rp }] = await Promise.all([
        supabase.from('feedback').select('*').order('created_at', { ascending: false }),
        supabase.from('reports').select('*').order('created_at', { ascending: false }),
      ]);
      setFeedback(fb || []);
      setReports(rp || []);
      setLoading(false);
    }
    load();
  }, []);

  async function updateReportStatus(id, status) {
    await supabase.from('reports').update({ status }).eq('id', id);
    setReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  }

  const items = tab === 'feedback' ? feedback : reports;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div style={{ background: '#111', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, color: '#fff', letterSpacing: 1 }}>Feedback & Reports</div>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>User submitted</div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5">
        <div className="mb-5 flex gap-2">
          {['feedback', 'reports'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === t ? 'bg-[#111] text-white' : 'bg-[#EEEEEE] text-[#666] hover:bg-[#E0E0E0]'
              }`}
            >
              {t === 'feedback' ? `Feedback (${feedback.length})` : `Reports (${reports.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-[#AAA]">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-[#AAA]">Nothing here yet.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="rounded-xl border border-[#EEEEEE] bg-white px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {item.type && (
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-[#888]">{item.type}</p>
                    )}
                    <p className="text-sm text-[#111]">{item.message}</p>
                    <p className="mt-1 text-xs text-[#AAA]">{new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  {tab === 'reports' && (
                    <div className="flex shrink-0 gap-2">
                      {['open', 'resolved', 'dismissed'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateReportStatus(item.id, s)}
                          style={item.status === s ? { background: STATUS_COLORS[s].bg, color: STATUS_COLORS[s].text } : {}}
                          className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                            item.status === s ? '' : 'bg-[#F5F5F5] text-[#888] hover:bg-[#EEEEEE]'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
