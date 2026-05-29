import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPublicProfile } from '../../hooks/useMissionaryPublicProfile';
import { Button, Card } from '../../components/ui';

const JOIN_BASE = 'https://sent-kohl.vercel.app/join';

export default function SupporterRefer() {
  const { profile } = useAuth();
  const mid = profile?.connected_missionary_id;
  const { profile: missionaryDb } = useMissionaryPublicProfile(mid);

  const missionaryName = missionaryDb?.full_name?.trim() || 'your missionary';
  const supporterCode = String(missionaryDb?.supporter_code ?? '').trim();

  const shareLink = useMemo(() => {
    if (!supporterCode) return '';
    return `${JOIN_BASE}?code=${encodeURIComponent(supporterCode)}`;
  }, [supporterCode]);

  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!linkCopied) return undefined;
    const t = window.setTimeout(() => setLinkCopied(false), 2500);
    return () => window.clearTimeout(t);
  }, [linkCopied]);

  const copyInviteLink = async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      setLinkCopied(true);
    } catch {
      setLinkCopied(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center md:text-left">
        <p className="text-sm font-medium text-mission-ink">Refer</p>
        <h1 className="text-2xl font-semibold tracking-tight">Invite a friend</h1>
        <p className="text-sm text-neutral-600">
          Share your join link so friends can sign up as supporters connected to {missionaryName}.
        </p>
      </header>

      <Card className="p-5">
        <p className="text-sm font-semibold">Join link</p>
        {!supporterCode ? (
          <p className="mt-3 text-sm text-neutral-600">
            Connect to a missionary first — their invite code will appear here.
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="break-all rounded-btn border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-ink">
                {shareLink}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="primary" onClick={() => void copyInviteLink()}>
                  {linkCopied ? 'Copied!' : 'Copy link'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={async () => {
                    if (navigator.share) {
                      try {
                        await navigator.share({
                          title: 'Join me on SENT',
                          text: `Use my link to join as a supporter for ${missionaryName} on SENT.`,
                          url: shareLink,
                        });
                        return;
                      } catch {
                        // user cancelled or share failed
                      }
                    }
                    await copyInviteLink();
                  }}
                >
                  Share
                </Button>
              </div>
            </div>
            {linkCopied ? (
              <p className="mt-3 rounded-btn border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900">
                Link copied!
              </p>
            ) : null}
            <p className="mt-3 text-xs text-neutral-500">
              Friends open this link, create a supporter account, and enter code{' '}
              <span className="font-semibold text-ink">{supporterCode}</span> to connect.
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
