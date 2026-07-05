import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../auth/AuthContext';

export default function AdminBlast() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [missionaryCount, setMissionaryCount] = useState(0);
  const [pastBlasts, setPastBlasts] = useState([]);

  useEffect(() => {
    async function load() {
      const [{ count }, { data: blasts }] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'missionary'),
        supabase.from('blast_notifications').select('*').order('created_at', { ascending: false }).limit(10),
      ]);
      setMissionaryCount(count || 0);
      setPastBlasts(blasts || []);
    }
    load();
  }, [sent]);

  const sendBlast = useCallback(async () => {
    if (!title.trim() || sending) return;
    setSending(true);

    const { data: missionaries } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'missionary');

    if (missionaries?.length) {
      const notifications = missionaries.map((m) => ({
        missionary_id: m.id,
        type: 'blast',
        title: title.trim(),
        body: body.trim() || null,
        is_read: false,
      }));
      await supabase.from('notifications').insert(notifications);
    }

    await supabase.from('blast_notifications').insert({
      sent_by: user.id,
      title: title.trim(),
      body: body.trim() || null,
      recipient_count: missionaries?.length || 0,
    });

    setTitle('');
    setBody('');
    setSending(false);
    setSent((v) => !v);
  }, [title, body, sending, user]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div style={{ background: '#111', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, color: '#fff', letterSpacing: 1 }}>Blast Notification</div>
        <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>Send to all missionaries</div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="max-w-xl">
          <div className="rounded-xl border border-[#EEEEEE] bg-white p-6 space-y-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[#888]">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. New feature available"
                className="w-full rounded-lg border border-[#EEEEEE] px-4 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-[#888]">Message (optional)</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Additional details…"
                rows={4}
                className="w-full resize-none rounded-lg border border-[#EEEEEE] px-4 py-2.5 text-sm outline-none focus:border-[color:var(--accent)]"
              />
            </div>
            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-[#888]">Will send to {missionaryCount} missionaries</p>
              <button
                type="button"
                disabled={!title.trim() || sending}
                onClick={sendBlast}
                className="rounded-lg bg-[#111] px-5 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:bg-[#222]"
              >
                {sending ? 'Sending…' : 'Send blast →'}
              </button>
            </div>
          </div>

          {pastBlasts.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-[#888]">Past Blasts</h2>
              <div className="divide-y divide-[#EEEEEE] rounded-xl border border-[#EEEEEE] bg-white">
                {pastBlasts.map((b) => (
                  <div key={b.id} className="px-5 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-[#111]">{b.title}</p>
                        {b.body && <p className="mt-0.5 text-xs text-[#888]">{b.body}</p>}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-[#888]">{b.recipient_count} recipients</p>
                        <p className="mt-0.5 text-[10px] text-[#AAA]">{new Date(b.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
