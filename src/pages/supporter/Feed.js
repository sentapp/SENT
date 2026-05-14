import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { linkSupporterToMissionary } from '../../lib/supporterConnection';
import { useMissionaryPosts } from '../../hooks/useMissionaryPosts';
import { useMissionaryPublicProfile } from '../../hooks/useMissionaryPublicProfile';
import { useMissionaryMapPoints } from '../../hooks/useMissionaryMapPoints';
import { fetchActiveMissionPushForMissionary } from '../../lib/missionPushesRepository';
import { DEFAULT_PROFILE_ACCENT, initialsFromDisplayName, normalizeProfileAccent } from '../../lib/profileAppearance';
import MapView from '../../components/MapView';
import {
  fetchReactionCountsForPosts,
  fetchMyReactionsForPosts,
  togglePostReaction,
} from '../../lib/postReactionsRepository';
import { supabase } from '../../lib/supabaseClient';
import { deleteOwnPostComment, fetchCommentsForPosts, insertPostComment } from '../../lib/postCommentsRepository';
import { Card, EmptyState } from '../../components/ui';
import { postTypeBadgeClass, postTypePostCardClass } from '../../lib/postTypeStyles';

function TypeBadge({ children, typeKeyClass }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeKeyClass}`}
    >
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
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium transition-colors duration-200 ${
        active
          ? 'feed-accent-reaction-active'
          : 'border-mission-line bg-white text-mission-muted hover:border-mission-line hover:bg-[color:var(--color-bg)]'
      } disabled:opacity-50`}
      aria-label={label}
      aria-pressed={active}
    >
      <span aria-hidden className="text-[13px] leading-none">
        {emoji}
      </span>
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

function mapProfileForPins(dbProfile) {
  if (!dbProfile) return null;
  const lat = dbProfile.latitude != null ? Number(dbProfile.latitude) : null;
  const lng = dbProfile.longitude != null ? Number(dbProfile.longitude) : null;
  return {
    ...dbProfile,
    location_name: dbProfile.location_name,
    latitude: dbProfile.latitude,
    longitude: dbProfile.longitude,
    locationCoords: lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng) ? { lat, lng } : null,
  };
}

function daysUntilDeadline(deadlineStr) {
  if (!deadlineStr) return null;
  const d = new Date(`${deadlineStr}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

function PostCommentsBlock({ userId, comments, draft, onDraftChange, onSubmit, onDelete, busySubmit, deletingCommentId }) {
  const list = comments || [];
  return (
    <div className="mt-4 border-t border-mission-line/80 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-mission-muted">Comments</p>
      {list.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {list.map((c) => (
            <li key={c.id} className="rounded-md bg-[color:var(--color-bg)] px-3 py-2 text-sm text-mission-ink">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-mission-muted">
                    {c.authorDisplayName || 'Anonymous'} ·{' '}
                    {c.createdAt ? new Date(c.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
                {userId && c.authorId && String(c.authorId) === String(userId) ? (
                  <button
                    type="button"
                    disabled={Boolean(deletingCommentId)}
                    className="shrink-0 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
                    onClick={() => onDelete(c.id)}
                  >
                    {deletingCommentId === c.id ? '…' : 'Delete'}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-mission-muted">No comments yet.</p>
      )}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-xs font-medium text-mission-muted">
          <span className="sr-only">Add a comment</span>
          <input
            type="text"
            value={draft}
            disabled={!userId || busySubmit}
            onChange={(e) => onDraftChange(e.target.value)}
            placeholder={userId ? 'Add a comment…' : 'Sign in to comment'}
            className="mt-1 w-full rounded-btn border border-mission-line bg-white px-3 py-2 text-sm text-ink placeholder:text-neutral-400"
          />
        </label>
        <button
          type="button"
          disabled={!userId || busySubmit || !draft.trim()}
          onClick={onSubmit}
          className="feed-accent-bg shrink-0 rounded-btn px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busySubmit ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  );
}

export default function SupporterFeed() {
  const { profile: supporterProfile, user, refreshProfile } = useAuth();
  const missionaryId = supporterProfile?.connected_missionary_id;
  const inviteCodeUsed = supporterProfile?.invite_code_used;
  const lastLinkAttemptCode = useRef('');

  useEffect(() => {
    if (missionaryId || !user?.id) return;
    const code = inviteCodeUsed?.trim();
    if (!code) return;
    if (lastLinkAttemptCode.current === code) return;
    lastLinkAttemptCode.current = code;
    let cancelled = false;
    (async () => {
      const res = await linkSupporterToMissionary(user.id, code);
      if (cancelled) return;
      if (res.ok && !res.skipped && res.missionary) {
        await refreshProfile();
        lastLinkAttemptCode.current = '';
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, missionaryId, inviteCodeUsed, refreshProfile]);

  const { profile: missionaryDb } = useMissionaryPublicProfile(missionaryId);
  const { posts } = useMissionaryPosts(missionaryId || null);

  const mapProfile = useMemo(() => mapProfileForPins(missionaryDb), [missionaryDb]);
  const mapPoints = useMissionaryMapPoints(mapProfile, posts);

  const feed = useMemo(() => posts, [posts]);

  const [counts, setCounts] = useState(() => new Map());
  const [mine, setMine] = useState(() => new Map());
  const [busy, setBusy] = useState(() => new Map());

  const [missionPush, setMissionPush] = useState(null);

  const [commentsByPost, setCommentsByPost] = useState(() => new Map());
  const [commentDraftByPost, setCommentDraftByPost] = useState({});
  const [commentBusyKey, setCommentBusyKey] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!missionaryId) {
        setMissionPush(null);
        return;
      }
      const { data } = await fetchActiveMissionPushForMissionary(missionaryId);
      if (!cancelled) setMissionPush(data || null);
    })();
    return () => {
      cancelled = true;
    };
  }, [missionaryId]);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!feed.length || !supabase) {
        if (!cancelled) setCommentsByPost(new Map());
        return;
      }
      const m = await fetchCommentsForPosts(
        supabase,
        feed.map((p) => p.id),
      );
      if (!cancelled) setCommentsByPost(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [feed]);

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

  const submitPostComment = useCallback(async (postId, draftText) => {
    if (!supabase || !user?.id) return;
    const text = String(draftText ?? '').trim();
    if (!text) return;
    setCommentBusyKey(`s:${postId}`);
    const { data, error } = await insertPostComment(supabase, { postId, authorId: user.id, body: text });
    setCommentBusyKey('');
    if (error || !data) return;
    setCommentDraftByPost((prev) => ({ ...prev, [postId]: '' }));
    setCommentsByPost((prev) => {
      const m = new Map(prev);
      m.set(postId, [...(m.get(postId) || []), data]);
      return m;
    });
  }, [user?.id]);

  const deletePostComment = useCallback(async (postId, commentId) => {
    if (!supabase || !user?.id) return;
    setCommentBusyKey(`d:${commentId}`);
    const { error } = await deleteOwnPostComment(supabase, commentId, user.id);
    setCommentBusyKey('');
    if (error) return;
    setCommentsByPost((prev) => {
      const m = new Map(prev);
      m.set(
        postId,
        (m.get(postId) || []).filter((c) => c.id !== commentId),
      );
      return m;
    });
  }, [user?.id]);

  const taxUrl = (missionaryDb?.tax_deductible_url || '').trim();
  const nonTaxUrl = (missionaryDb?.non_tax_deductible_url || '').trim();
  const showGiving = Boolean(taxUrl || nonTaxUrl);
  const primaryGiveHref = taxUrl ? normalizeUrl(taxUrl) : normalizeUrl(nonTaxUrl);
  const showOtherGiving = Boolean(taxUrl && nonTaxUrl);

  const displayName = missionaryDb?.full_name?.trim() || 'Missionary';
  const orgLine = (missionaryDb?.organization || '').trim();
  const photoUrl = missionaryDb?.photo_url || '';
  const feedAccent = missionaryId ? normalizeProfileAccent(missionaryDb?.accent_color) : DEFAULT_PROFILE_ACCENT;
  const avatarInitials = initialsFromDisplayName(displayName);

  const pushGoal = missionPush ? Number(missionPush.goal_amount || 0) : 0;
  const pushRaised = missionPush ? Number(missionPush.raised_amount || 0) : 0;
  const pushPct = pushGoal > 0 ? Math.min(100, Math.round((pushRaised / pushGoal) * 100)) : 0;
  const pushGiveUrl = normalizeUrl(missionPush?.giving_link || taxUrl || nonTaxUrl || '');
  const daysLeft = missionPush?.deadline ? daysUntilDeadline(missionPush.deadline) : null;

  return (
    <div className="space-y-6" style={missionaryId ? { '--feed-accent': feedAccent } : undefined}>
      <header className="space-y-1 text-center sm:text-left">
        <h1 className={`sent-page-title ${missionaryId ? 'feed-accent-text' : 'text-mission-ink'}`}>Feed</h1>
        <p className="sent-body text-mission-muted">Map, giving, and updates from your missionary.</p>
      </header>

      {!missionaryId ? (
        <EmptyState
          icon="link"
          title="Connect to a missionary"
          subtitle="Your SENT invite code links you to their updates. Add it from your profile if you haven’t yet."
        />
      ) : (
        <>
          {showGiving ? (
            <Card className="overflow-hidden p-6">
              <div className="flex gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white shadow ring-1 ring-neutral-200/80">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="feed-accent-bg flex h-full w-full items-center justify-center text-xl font-semibold text-white">
                      {avatarInitials}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold tracking-tight text-ink">{displayName}</p>
                  {orgLine ? <p className="mt-0.5 text-sm text-neutral-600">{orgLine}</p> : null}
                  <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                    Partner with {displayName} through a gift that sends the Gospel further.
                  </p>
                </div>
              </div>
              <a
                href={primaryGiveHref}
                target="_blank"
                rel="noopener noreferrer"
                className="feed-accent-bg mt-5 block w-full rounded-btn py-3.5 text-center text-[17px] font-semibold text-white shadow-sm transition hover:opacity-95"
              >
                Give to {displayName}
              </a>
              {showOtherGiving ? (
                <div className="mt-3 text-center">
                  <a
                    href={normalizeUrl(nonTaxUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="feed-accent-text text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Other giving options
                  </a>
                </div>
              ) : null}
            </Card>
          ) : null}

          <div className="-mx-6 space-y-1 sm:mx-0">
            <p className="sent-section-label px-6 sm:px-0">Mission map</p>
            <MapView points={mapPoints} height={380} rounded={false} className="border-x-0 sm:rounded-card sm:border" />
          </div>

          {missionPush && missionPush.is_active ? (
            <Card className="feed-accent-card border-2 p-5">
              <p className="feed-accent-text text-xs font-semibold uppercase tracking-wide">Mission push</p>
              <h2 className="mt-2 text-xl font-semibold text-ink">{missionPush.title}</h2>
              {missionPush.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{missionPush.description}</p>
              ) : null}
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-neutral-700">
                    ${pushRaised.toLocaleString()} raised of ${pushGoal.toLocaleString()}
                  </span>
                  <span className="feed-accent-text">{pushPct}%</span>
                </div>
                <div className="garden-progress-track mt-2">
                  <div className="garden-progress-fill" style={{ width: `${pushPct}%` }} />
                </div>
              </div>
              {daysLeft != null ? (
                <p className="mt-3 text-sm text-neutral-600">
                  {daysLeft < 0 ? 'Deadline passed' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} remaining`}
                </p>
              ) : null}
              {pushGiveUrl ? (
                <a
                  href={pushGiveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="feed-accent-bg mt-4 block w-full rounded-btn py-3.5 text-center text-[17px] font-semibold text-white shadow-sm hover:opacity-95"
                >
                  Give toward this
                </a>
              ) : null}
            </Card>
          ) : null}

          <div className="space-y-1">
            <p className="sent-section-title">Recent posts</p>
            <p className="sent-body text-mission-muted">Posts from your missionary appear below.</p>
          </div>

          {feed.length === 0 ? (
            <EmptyState
              icon="globe"
              title="No updates yet"
              subtitle="When your missionary shares field stories, prayer requests, and wins — they’ll show up here."
            />
          ) : (
            <div className="space-y-4">
              {feed.map((p) => {
                const c = counts.get(p.id) || { heart: 0, pray: 0 };
                const my = mine.get(p.id);
                const heartActive = my?.has?.('heart');
                const prayActive = my?.has?.('pray');
                return (
                  <Card
                    key={p.id}
                    id={`supporter-post-${p.id}`}
                    className={`relative scroll-mt-4 overflow-hidden p-5 ${postTypePostCardClass(p.type)}`}
                  >
                    <div className="absolute left-5 top-5 z-10">
                      <TypeBadge typeKeyClass={postTypeBadgeClass(p.type)}>{p.type}</TypeBadge>
                    </div>
                    <div className="flex items-start gap-3 pt-10">
                      <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-mission-line bg-white">
                        {photoUrl ? (
                          <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="feed-accent-bg flex h-full w-full items-center justify-center text-xs font-semibold text-white">
                            {avatarInitials.slice(0, 2)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="sent-card-title">{displayName}</p>
                        <p className="sent-caption mt-0.5">{new Date(p.createdAt).toLocaleString()}</p>

                    {p.locationName ? (
                      <p className="sent-body mt-3 font-medium text-mission-ink">
                        <span className="mr-1" aria-hidden>
                          📍
                        </span>
                        {p.locationName}
                      </p>
                    ) : null}
                    <p className="sent-body mt-3 whitespace-pre-wrap text-mission-ink">{p.body}</p>

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
                    <PostCommentsBlock
                      userId={user?.id}
                      comments={commentsByPost.get(p.id)}
                      draft={commentDraftByPost[p.id] || ''}
                      onDraftChange={(v) =>
                        setCommentDraftByPost((prev) => ({
                          ...prev,
                          [p.id]: v,
                        }))
                      }
                      onSubmit={() => void submitPostComment(p.id, commentDraftByPost[p.id] || '')}
                      onDelete={(commentId) => void deletePostComment(p.id, commentId)}
                      busySubmit={commentBusyKey === `s:${p.id}`}
                      deletingCommentId={commentBusyKey.startsWith('d:') ? commentBusyKey.slice(2) : null}
                    />
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
