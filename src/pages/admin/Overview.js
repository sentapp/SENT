import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [
        { data: profiles, error: profilesError },
        { data: feedback, error: feedbackError },
        { data: notifications, error: notifError },
      ] = await Promise.all([
        supabase.from('profiles').select('id, role, connected_missionary_id, monthly_goal, partner_goal'),
        supabase.from('feedback').select('id, message, created_at').order('created_at', { ascending: false }).limit(5),
        supabase.from('notifications').select('id, type, title, created_at').order('created_at', { ascending: false }).limit(6),
      ]);

      if (profilesError) console.error('Admin profiles query error:', profilesError);
      if (feedbackError) console.error('Admin feedback query error:', feedbackError);
      if (notifError) console.error('Admin notifications query error:', notifError);

      const missionaries = (profiles || []).filter((p) => p.role === 'missionary');
      const supporters = (profiles || []).filter((p) => p.role === 'supporter');
      const connected = supporters.filter((p) => p.connected_missionary_id);
      const totalRaised = missionaries.reduce((sum, m) => sum + (m.monthly_goal || 0), 0);
      const ratio = missionaries.length > 0 ? (supporters.length / missionaries.length).toFixed(1) : '—';

      setStats({
        missionaries: missionaries.length,
        supporters: supporters.length,
        connected: connected.length,
        ratio,
        totalRaised,
      });
      setRecentFeedback(feedback || []);
      setActivity(notifications || []);
      setLoading(false);
    }
    load();
  }, []);

  function activityIcon(type) {
    if (type?.includes('supporter')) return { color: '#4CAF7D', label: 'Supporter joined' };
    if (type?.includes('prayer')) return { color: '#185FA5', label: 'Prayer request' };
    if (type?.includes('meeting')) return { color: '#906010', label: 'Meeting request' };
    if (type?.includes('comment')) return { color: '#534AB7', label: 'Comment' };
    if (type?.includes('blast')) return { color: '#888', label: 'Blast sent' };
    return { color: '#888', label: type || 'Activity' };
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ background: '#111', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
          <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, color: '#fff', letterSpacing: 1 }}>Overview</div>
          <div style={{ fontSize: 10, color: '#555', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 2 }}>
            Platform at a glance · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#888' }}>Loading…</div>
        ) : (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Missionaries', value: stats.missionaries, sub: 'Active on SENT' },
                { label: 'Supporters', value: stats.supporters, sub: `${stats.connected} connected` },
                { label: 'Supporter ratio', value: `${stats.ratio}x`, sub: 'Per missionary', color: '#4CAF7D' },
                { label: 'Total raised', value: `$${stats.totalRaised.toLocaleString()}`, sub: 'Monthly across all' },
              ].map((m) => (
                <div key={m.label} style={{ background: '#FAFAFA', borderRadius: 8, padding: '12px 14px', border: '0.5px solid #EEEEEE' }}>
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: 28, color: m.color || '#111', letterSpacing: 0.5, lineHeight: 1 }}>{m.value}</div>
                  <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.08em', color: '#888', marginTop: 4, fontWeight: 500 }}>{m.label}</div>
                  <div style={{ fontSize: 10, color: '#BBB', marginTop: 2 }}>{m.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#888', marginBottom: 8, fontWeight: 500 }}>Missionary funding</div>
                <MissionaryFundingCard />
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#888', margin: '14px 0 8px', fontWeight: 500 }}>Recent feedback</div>
                <div style={{ background: '#fff', border: '0.5px solid #EEEEEE', borderRadius: 10, overflow: 'hidden' }}>
                  {recentFeedback.length === 0 ? (
                    <div style={{ padding: '16px 14px', fontSize: 12, color: '#BBB', textAlign: 'center' }}>No feedback yet</div>
                  ) : recentFeedback.map((f) => (
                    <div key={f.id} style={{ padding: '9px 14px', borderBottom: '0.5px solid #F5F5F5' }}>
                      <div style={{ fontSize: 12, color: '#111' }}>{f.message}</div>
                      <div style={{ fontSize: 10, color: '#BBB', marginTop: 2 }}>{new Date(f.created_at).toLocaleDateString()}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#888', marginBottom: 8, fontWeight: 500 }}>Recent activity</div>
                <div style={{ background: '#fff', border: '0.5px solid #EEEEEE', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
                  {activity.length === 0 ? (
                    <div style={{ padding: '16px 14px', fontSize: 12, color: '#BBB', textAlign: 'center' }}>No activity yet</div>
                  ) : activity.map((a) => {
                    const info = activityIcon(a.type);
                    return (
                      <div key={a.id} style={{ display: 'flex', gap: 10, padding: '9px 14px', borderBottom: '0.5px solid #F5F5F5', alignItems: 'flex-start' }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: info.color, marginTop: 4, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: '#111' }}>{a.title}</div>
                          <div style={{ fontSize: 10, color: '#BBB', marginTop: 1 }}>
                            {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <BlastQuickSend />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MissionaryFundingCard() {
  const [missionaries, setMissionaries] = useState([]);

  useEffect(() => {
    async function load() {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, monthly_goal, partner_goal, organization')
        .eq('role', 'missionary')
        .order('monthly_goal', { ascending: false });

      if (!profiles?.length) {
        setMissionaries([]);
        return;
      }

      const raised = await Promise.all(
        profiles.map((p) =>
          supabase
            .from('contacts')
            .select('monthly_amount')
            .eq('missionary_id', p.id)
            .eq('category', 'supporter')
        )
      );

      const enriched = profiles.map((p, i) => ({
        ...p,
        monthly_amount: (raised[i].data || []).reduce((sum, c) => sum + (Number(c.monthly_amount) || 0), 0),
        goal_amount: p.monthly_goal || 0,
      }));

      setMissionaries(enriched);
    }
    load();
  }, []);

  return (
    <div style={{ background: '#fff', border: '0.5px solid #EEEEEE', borderRadius: 10, overflow: 'hidden' }}>
      {missionaries.length === 0 ? (
        <div style={{ padding: '16px 14px', fontSize: 12, color: '#BBB', textAlign: 'center' }}>No missionaries yet</div>
      ) : missionaries.map((m) => {
        const pct = m.goal_amount > 0 ? Math.min(Math.round((m.monthly_amount / m.goal_amount) * 100), 100) : 0;
        const initials = m.full_name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
        return (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: '0.5px solid #F5F5F5' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EDFAF2', color: '#1A6B3C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 500, flexShrink: 0 }}>{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.full_name}</div>
              <div style={{ height: 3, background: '#EEEEEE', borderRadius: 2, marginTop: 4 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 80 ? '#2A9A58' : pct >= 50 ? '#D4A017' : '#E05050', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>${(m.monthly_amount || 0).toLocaleString()} · {pct}% funded</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BlastQuickSend() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function send() {
    if (!title.trim() || sending) return;
    setSending(true);

    const { data: missionaries } = await supabase.from('profiles').select('id').eq('role', 'missionary');

    if (missionaries?.length) {
      await supabase.from('notifications').insert(
        missionaries.map((m) => ({
          missionary_id: m.id,
          type: 'blast',
          title: title.trim(),
          body: body.trim() || null,
          is_read: false,
        })),
      );
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
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  }

  return (
    <div>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: '#888', marginBottom: 8, fontWeight: 500 }}>Send blast notification</div>
      <div style={{ background: '#fff', border: '0.5px solid #EEEEEE', borderRadius: 10, padding: '12px 14px' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (required)"
          style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #EEEEEE', borderRadius: 6, fontSize: 12, background: '#FAFAFA', marginBottom: 8 }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message (optional)"
          rows={2}
          style={{ width: '100%', padding: '7px 10px', border: '0.5px solid #EEEEEE', borderRadius: 6, fontSize: 12, background: '#FAFAFA', resize: 'none', marginBottom: 10 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 11, color: '#888' }}>{sent ? '✓ Sent!' : 'Sends to all missionaries'}</span>
          <button
            type="button"
            onClick={send}
            disabled={!title.trim() || sending}
            style={{ padding: '7px 14px', background: '#111', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', opacity: !title.trim() || sending ? 0.4 : 1 }}
          >
            {sending ? 'Sending…' : 'Send blast →'}
          </button>
        </div>
      </div>
    </div>
  );
}
