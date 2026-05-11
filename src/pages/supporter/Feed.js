import { useMemo, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useMissionaryPosts } from '../../hooks/useMissionaryPosts';
import { useMissionaryPublicProfile } from '../../hooks/useMissionaryPublicProfile';
import {
  fetchReactionCountsForPosts,
  fetchMyReactionsForPosts,
  togglePostReaction,
} from '../../lib/postReactionsRepository';
import { Card, EmptyState } from '../../components/ui';

function Badge({ children }) {
  return (
    <span className="inline-flex items-center rounded-full bg-mission-blue/10 px-2.5 py-1 text-xs font-semibold text-mission-blue">
      {children}
    </span>
  );
}

function ReactionButton({ active, label, emoji, disabled, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-btn border px-3 py-2 text-xs font-semibold transition ${
        active ? 'border-mission-blue bg-mission-blue/10 text-mission-blue' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
      } disabled:opacity-50`}
      aria-label={label}
      aria-pressed={active}
    >
      <span aria-hidden>{emoji}</span>
      <span>{label}</span>
    </button>
  );
}

function normalizeUrl(url) {
  const u = (url || '').trim();
  if (!u) return '';
  if (/^https?:\/\//i.test(u)) return u;
  return `https://${u}`;
}

export default function SupporterFeed() {
  const { profile: supporterProfile, user } = useAuth();
  const missionaryId = supporterProfile?.connected_missionary_id;

  const { profile: missionaryDb } = useMissionaryPublicProfile(missionaryId);
  const { posts } = useMissionaryPosts(missionaryId || null);

  const feed = useMemo(() => posts, [posts]);

  const [counts, setCounts] = useState(() => new Map());
  const [mine, setMine] = useState(() => new Map());
  const [busy, setBusy] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!feed.length || !user?.id) {
        setCounts(new Map());
        setMine(new Map());
        return;
      }
      const ids = feed.map((p) => p.id);
      const [c, m] = await Promise.all([fetchReactionCountsForPosts(ids), fetchMyReactionsForPosts(ids, user.id)]);
      if (!cancelled) {
        setCounts(c);
        setMine(m);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [feed, user?.id]);

  const toggle = async (postId, kind) => {
    if (!user?.id) return;
    setBusy((b) => new Map(b).set(`${postId}-${kind}`, true));
    const res = await togglePostReaction(postId, user.id, kind);
    setBusy((b) => {
      const n = new Map(b);
      n.delete(`${postId}-${kind}`);
      return n;
    });
    if (res.error) return;

    const ids = feed.map((p) => p.id);
    const [c, m] = await Promise.all([fetchReactionCountsForPosts(ids), fetchMyReactionsForPosts(ids, user.id)]);
    setCounts(c);
    setMine(m);
  };

  const taxUrl = (missionaryDb?.tax_deductible_url || '').trim();
  const nonTaxUrl = (missionaryDb?.non_tax_deductible_url || '').trim();
  const showGiving = Boolean(taxUrl || nonTaxUrl);
  const primaryGiveUrl = normalizeUrl(taxUrl || nonTaxUrl);
  const otherGiveUrl = normalizeUrl(nonTaxUrl);
  const showOtherGiving = Boolean(taxUrl && nonTaxUrl);

  const displayName = missionaryDb?.full_name?.trim() || 'Missionary';
  const photoUrl = missionaryDb?.photo_url || '';

  return (
    <div className="space-y-6">
      {showGiving ? (
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-card border border-neutral-200 bg-neutral-50">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-neutral-400">
                  {displayName.slice(0, 1).toUpperCase() || '?'}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900">{displayName}</p>
              <p className="mt-0.5 text-sm text-neutral-600">Supporting {displayName}&apos;s mission</p>
            </div>
          </div>
          <a
            href={primaryGiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 block w-full rounded-btn bg-mission-blue py-3.5 text-center text-[17px] font-semibold text-white shadow-sm hover:opacity-95"
          >
            Give monthly
          </a>
          {showOtherGiving ? (
            <div className="mt-3 text-center">
              <a
                href={otherGiveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-mission-blue underline-offset-4 hover:underline"
              >
                Other giving options
              </a>
            </div>
          ) : null}
        </Card>
      ) : null}

      <header className="space-y-1 text-center sm:text-left">
        <p className="text-sm font-medium text-mission-blue">Updates</p>
        <p className="text-sm text-neutral-600">Posts from your missionary appear below.</p>
      </header>

      {!missionaryId ? (
        <EmptyState title="Connect to a missionary" subtitle="Your SENT invite code links you to their updates." />
      ) : feed.length === 0 ? (
        <EmptyState title="No updates yet — your missionary will post here soon" />
      ) : (
        <div className="space-y-4">
          {feed.map((p) => {
            const c = counts.get(p.id) || { heart: 0, pray: 0 };
            const my = mine.get(p.id);
            const heartActive = my?.has?.('heart');
            const prayActive = my?.has?.('pray');
            return (
              <Card key={p.id} id={`supporter-post-${p.id}`} className="scroll-mt-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 overflow-hidden rounded-card border border-neutral-200 bg-neutral-50">
                      {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : null}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{displayName}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">{new Date(p.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <Badge>{p.type}</Badge>
                </div>

                {p.locationName ? <p className="mt-3 text-sm font-medium text-neutral-700">{p.locationName}</p> : null}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">{p.body}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <ReactionButton
                    emoji="♥"
                    label={`Heart (${c.heart})`}
                    active={heartActive}
                    disabled={busy.get(`${p.id}-heart`)}
                    onClick={() => toggle(p.id, 'heart')}
                  />
                  <ReactionButton
                    emoji="🙏"
                    label={`Pray (${c.pray})`}
                    active={prayActive}
                    disabled={busy.get(`${p.id}-pray`)}
                    onClick={() => toggle(p.id, 'pray')}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
