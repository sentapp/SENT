import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { fetchPrayerRequestsForMissionary, insertPrayerRequest, incrementPrayedCount } from '../../lib/prayerRequestsRepository';
import { Button, Card, EmptyState, Label, Textarea } from '../../components/ui';

export default function SupporterPrayer() {
  const { user, profile } = useAuth();
  const missionaryId = profile?.connected_missionary_id;

  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitErr, setSubmitErr] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    if (!supabase || !missionaryId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const rows = await fetchPrayerRequestsForMissionary(supabase, missionaryId);
    setRequests(rows);
    setLoading(false);
  }, [missionaryId]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async () => {
    setSubmitErr('');
    const text = body.trim();
    if (!text || !supabase || !user?.id) return;

    const { data: myProfile, error: profErr } = await supabase
      .from('profiles')
      .select('connected_missionary_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profErr) {
      setSubmitErr(profErr.message || 'Could not load your profile.');
      return;
    }

    const mid = myProfile?.connected_missionary_id || missionaryId;
    if (!mid) {
      setSubmitErr('Connect to a missionary before submitting a request.');
      return;
    }

    const { data, error } = await insertPrayerRequest(supabase, {
      missionaryId: mid,
      authorId: user.id,
      body: text,
      anonymous,
    });

    if (error) {
      setSubmitErr(error.message || 'Could not submit.');
      return;
    }
    setBody('');
    setAnonymous(false);
    if (data) setRequests((prev) => [data, ...prev]);
    else load();
  };

  const pray = async (id) => {
    if (!supabase) return;
    setBusyId(id);
    const { error, prayedCount } = await incrementPrayedCount(supabase, id);
    setBusyId(null);
    if (error) return;
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, prayedCount: prayedCount ?? r.prayedCount } : r)));
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center md:text-left">
        <p className="text-sm font-medium text-mission-blue">Prayer</p>
        <h1 className="text-2xl font-semibold tracking-tight">Prayer wall</h1>
        <p className="text-sm text-neutral-600">Share a request and pray together.</p>
      </header>

      {!missionaryId ? (
        <EmptyState
          icon="link"
          title="Connect to a missionary"
          subtitle="Use your SENT invite code so your requests appear on their wall."
        />
      ) : (
        <>
          <Card className="p-5">
            <p className="text-sm font-semibold">Submit a prayer request</p>
            {submitErr ? <p className="mt-2 text-sm text-red-600">{submitErr}</p> : null}
            <div className="mt-4 space-y-4">
              <Label title="Request">
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="How can we pray?" rows={4} />
              </Label>
              <label className="flex items-center gap-3 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="h-4 w-4 accent-[#185FA5]"
                />
                Submit anonymously
              </label>
              <div className="flex justify-end">
                <Button type="button" disabled={!body.trim()} onClick={submit}>
                  Submit
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">Requests</p>
            {loading ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : requests.length === 0 ? (
              <EmptyState
                icon="sparkles"
                title="No prayer requests yet"
                subtitle="Be the first to share how we can pray with you."
              />
            ) : (
              <div className="space-y-3">
                {requests.map((r) => (
                  <Card key={r.id} className="p-5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{r.body}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs text-neutral-500">
                        {r.anonymous ? 'Anonymous' : 'Supporter'} · {new Date(r.createdAt).toLocaleString()}
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busyId === r.id}
                        onClick={() => pray(r.id)}
                      >
                        Pray ({(r.prayedCount ?? 0).toString()})
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
