import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPublicProfile } from '../../hooks/useMissionaryPublicProfile';
import { Button, Card, Input, Label } from '../../components/ui';

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

  const [friendName, setFriendName] = useState('');
  const [friendContact, setFriendContact] = useState('');

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center md:text-left">
        <p className="text-sm font-medium text-mission-blue">Refer</p>
        <h1 className="text-2xl font-semibold tracking-tight">Invite a friend</h1>
        <p className="text-sm text-neutral-600">Share SENT with someone who might walk alongside a missionary.</p>
      </header>

      <Card className="p-5">
        <p className="text-sm font-semibold">Share link</p>
        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="break-all rounded-btn border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold text-neutral-900">
            {shareLink}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareLink);
                } catch {
                  // ignore
                }
              }}
            >
              Copy link
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({ title: 'SENT', text: 'Check out SENT — for missionaries and the people who send them.', url: shareLink });
                    return;
                  } catch {
                    // ignore
                  }
                }
                try {
                  await navigator.clipboard.writeText(shareLink);
                } catch {
                  // ignore
                }
              }}
            >
              Share
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Friends who join as supporters will still need your missionary&apos;s SENT invite code to connect.
        </p>
      </Card>

      <Card className="p-5">
        <p className="text-sm font-semibold">Send directly</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Label title="Friend’s name">
            <Input value={friendName} onChange={(e) => setFriendName(e.target.value)} placeholder="Name" />
          </Label>
          <Label title="Phone or email">
            <Input value={friendContact} onChange={(e) => setFriendContact(e.target.value)} placeholder="Phone or email" />
          </Label>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            disabled={!friendName.trim() || !friendContact.trim()}
            onClick={() => {
              setFriendName('');
              setFriendContact('');
            }}
          >
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}
