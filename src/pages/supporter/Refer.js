import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { supabase } from '../../lib/supabaseClient';

const JOIN_BASE = 'https://sent-kohl.vercel.app/join';

export default function SupporterRefer() {
  const { profile } = useAuth();
  const [missionary, setMissionary] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function loadMissionaryCode() {
      if (!profile?.connected_missionary_id) {
        setMissionary(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('supporter_code, full_name')
        .eq('id', profile.connected_missionary_id)
        .maybeSingle();

      if (error) {
        console.warn('Refer loadMissionaryCode', error);
        setMissionary(null);
        return;
      }

      setMissionary(data || null);
    }

    void loadMissionaryCode();
  }, [profile?.connected_missionary_id]);

  const code = String(missionary?.supporter_code ?? '').trim();
  const inviteUrl = code ? `${JOIN_BASE}?code=${encodeURIComponent(code)}` : '';
  const missionaryName = missionary?.full_name?.trim() || 'your missionary';

  useEffect(() => {
    if (!copied) return undefined;
    const t = window.setTimeout(() => setCopied(false), 2500);
    return () => window.clearTimeout(t);
  }, [copied]);

  async function copyLink() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      const el = document.createElement('textarea');
      el.value = inviteUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center md:text-left">
        <p className="text-sm font-medium text-mission-ink">Refer</p>
        <h1 className="text-2xl font-semibold tracking-tight">Invite a friend</h1>
        <p className="text-sm text-neutral-600">
          Share your join link so friends can sign up as supporters connected to {missionaryName}.
        </p>
      </header>

      <div className="rounded-card border border-neutral-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-ink">Join link</p>

        <div className="mt-4 break-all rounded-lg bg-neutral-100 px-3 py-2.5 font-mono text-xs text-neutral-600">
          {inviteUrl || 'Connect to a missionary to get your refer link'}
        </div>

        <button
          type="button"
          onClick={() => void copyLink()}
          disabled={!inviteUrl}
          className={`mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-medium transition ${
            inviteUrl
              ? 'cursor-pointer bg-green text-white hover:bg-green/90'
              : 'cursor-default bg-neutral-200 text-neutral-500'
          }`}
        >
          {copied ? 'Link copied! ✓' : 'Copy invite link'}
        </button>

        {code ? (
          <p className="mt-3 text-xs text-neutral-500">
            Friends open this link, create a supporter account, and enter code{' '}
            <span className="font-semibold text-ink">{code}</span> to connect.
          </p>
        ) : null}
      </div>
    </div>
  );
}
