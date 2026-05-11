import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { linkSupporterToMissionary } from '../../lib/supporterConnection';
import { useMissionaryPosts } from '../../hooks/useMissionaryPosts';
import { useMissionaryPublicProfile } from '../../hooks/useMissionaryPublicProfile';
import { useMissionaryMapPoints } from '../../hooks/useMissionaryMapPoints';
import { fetchActiveMissionPushForMissionary } from '../../lib/missionPushesRepository';
import MapView from '../../components/MapView';
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
  const readMoreHref = useCallback((p) => `/supporter#supporter-post-${p.id}`, []);
  const mapPoints = useMissionaryMapPoints(mapProfile, posts, { readMoreHref });

  const feed = useMemo(() => posts, [posts]);

  const [counts, setCounts] = useState(() => new Map());
  const [mine, setMine] = useState(() => new Map());
  const [busy, setBusy] = useState(() => new Map());

  const [missionPush, setMissionPush] = useState(null);

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
  const primaryGiveHref = taxUrl ? normalizeUrl(taxUrl) : normalizeUrl(nonTaxUrl);
  const showOtherGiving = Boolean(taxUrl && nonTaxUrl);

  const displayName = missionaryDb?.full_name?.trim() || 'Missionary';
  const orgLine = (missionaryDb?.organization || '').trim();
  const photoUrl = missionaryDb?.photo_url || '';

  const pushGoal = missionPush ? Number(missionPush.goal_amount || 0) : 0;
  const pushRaised = missionPush ? Number(missionPush.raised_amount || 0) : 0;
  const pushPct = pushGoal > 0 ? Math.min(100, Math.round((pushRaised / pushGoal) * 100)) : 0;
  const pushGiveUrl = normalizeUrl(missionPush?.giving_link || taxUrl || nonTaxUrl || '');
  const daysLeft = missionPush?.deadline ? daysUntilDeadline(missionPush.deadline) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-1 text-center sm:text-left">
        <p className="text-sm font-medium text-mission-blue">Feed</p>
        <p className="text-sm text-neutral-600">Map, giving, and updates from your missionary.</p>
      </header>

      {!missionaryId ? (
        <EmptyState title="Connect to a missionary" subtitle="Your SENT invite code links you to their updates." />
      ) : (
        <>
          {showGiving ? (
            <Card className="overflow-hidden border border-neutral-200/90 bg-gradient-to-b from-white to-neutral-50/70 p-6 shadow-sm">
              <div className="flex gap-4">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-white shadow ring-1 ring-neutral-200/80">
                  {photoUrl ? (
                    <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-xl font-semibold text-neutral-400">
                      {displayName.slice(0, 1).toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold tracking-tight text-neutral-900">{displayName}</p>
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
                className="mt-5 block w-full rounded-btn bg-mission-blue py-3.5 text-center text-[17px] font-semibold text-white shadow-sm transition hover:opacity-95"
              >
                Give to {displayName}
              </a>
              {showOtherGiving ? (
                <div className="mt-3 text-center">
                  <a
                    href={normalizeUrl(nonTaxUrl)}
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

          <div className="-mx-6 space-y-1 sm:mx-0">
            <p className="px-6 text-xs font-semibold uppercase tracking-wide text-neutral-500 sm:px-0">Mission map</p>
            <MapView points={mapPoints} route={true} height={380} rounded={false} className="border-x-0 sm:rounded-card sm:border" />
          </div>

          {missionPush && missionPush.is_active ? (
            <Card className="border-2 border-mission-blue/20 bg-mission-blue/[0.04] p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-mission-blue">Mission push</p>
              <h2 className="mt-2 text-xl font-semibold text-neutral-900">{missionPush.title}</h2>
              {missionPush.description ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">{missionPush.description}</p>
              ) : null}
              <div className="mt-4">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span className="text-neutral-700">
                    ${pushRaised.toLocaleString()} raised of ${pushGoal.toLocaleString()}
                  </span>
                  <span className="text-mission-blue">{pushPct}%</span>
                </div>
                <div className="mt-2 h-3 w-full rounded-full bg-neutral-200">
                  <div className="h-3 rounded-full bg-mission-blue" style={{ width: `${pushPct}%` }} />
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
                  className="mt-4 block w-full rounded-btn bg-mission-blue py-3.5 text-center text-[17px] font-semibold text-white shadow-sm hover:opacity-95"
                >
                  Give toward this
                </a>
              ) : null}
            </Card>
          ) : null}

          <div className="space-y-1">
            <p className="text-sm font-semibold text-neutral-900">Recent posts</p>
            <p className="text-sm text-neutral-600">Posts from your missionary appear below.</p>
          </div>

          {feed.length === 0 ? (
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
        </>
      )}
    </div>
  );
}
