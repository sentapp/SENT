import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPublicProfile } from '../../hooks/useMissionaryPublicProfile';
import { Button, Card } from '../../components/ui';

function slugify(s) {
  return (s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function SupporterRefer() {
  const { profile } = useAuth();
  const mid = profile?.connected_missionary_id;
  const { profile: missionaryDb } = useMissionaryPublicProfile(mid);

  const missionaryName = missionaryDb?.full_name?.trim() || 'your missionary';

  const shareLink = useMemo(() => {
    const slug = slugify(missionaryName) || 'missionary';
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/?ref=${encodeURIComponent(slug)}`;
    }
    return `https://example.com/?ref=${encodeURIComponent(slug)}`;
  }, [missionaryName]);

  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!linkCopied) return undefined;
    const t = window.setTimeout(() => setLinkCopied(false), 2500);
    return () => window.clearTimeout(t);
  }, [linkCopied]);

  const copyInviteLink = async () => {
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
        <p className="text-sm text-neutral-600">Share SENT with someone who might walk alongside a missionary.</p>
      </header>

      <Card className="p-5">
        <p className="text-sm font-semibold">Invite link</p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="break-all rounded-btn border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-ink">
            {shareLink}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="primary" onClick={() => void copyInviteLink()}>
              Copy invite link
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: 'SENT',
                      text: 'Check out SENT — for missionaries and the people who send them.',
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
          Friends who join as supporters will still need your missionary&apos;s SENT invite code to connect.
        </p>
      </Card>
    </div>
  );
}
