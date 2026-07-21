import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { fetchCommunityPosts } from '../../lib/postsRepository';
import { supabase } from '../../lib/supabaseClient';
import {
  fetchReactionCountsForPosts,
  fetchMyReactionsForPosts,
  togglePostReaction,
} from '../../lib/postReactionsRepository';
import { initialsFromDisplayName, normalizeProfileAccent } from '../../lib/profileAppearance';
import { postTypeBadgeClass } from '../../lib/postTypeStyles';
import DarkPageHeader from '../../components/DarkPageHeader';
import MissionaryPageShell from '../../components/MissionaryPageShell';
import ReactionButton from '../../components/ReactionButton';

const ALL_FILTER = 'All fields';
const FIELD_CATEGORIES = [
  'Universities',
  'High Schools',
  'Nations',
  'Cities',
  'Church Planting',
  'Unreached People Groups',
  'Marketplace',
  'Arts & Entertainment',
];
const FIELD_FILTERS = [ALL_FILTER, ...FIELD_CATEGORIES];

function TypeBadge({ children, typeKeyClass }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${typeKeyClass}`}>
      {children}
    </span>
  );
}

function FieldCategoryBadge({ category }) {
  if (!category) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/50">
      {category}
    </span>
  );
}

export default function MissionaryCommunity() {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fieldFilter, setFieldFilter] = useState(ALL_FILTER);
  const [counts, setCounts] = useState(() => new Map());
  const [mine, setMine] = useState(() => new Map());
  const [busy, setBusy] = useState(() => new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const list = await fetchCommunityPosts(supabase);
      if (!cancelled) {
        setPosts(list);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      fieldFilter === ALL_FILTER
        ? posts
        : posts.filter((p) => p.fieldCategory === fieldFilter),
    [posts, fieldFilter],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!filtered.length || !user?.id) {
        if (!cancelled) {
          setCounts(new Map());
          setMine(new Map());
        }
        return;
      }
      const ids = filtered.map((p) => p.id);
      const [c, m] = await Promise.all([fetchReactionCountsForPosts(ids), fetchMyReactionsForPosts(ids, user.id)]);
      if (!cancelled) {
        setCounts(c);
        setMine(m);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filtered, user?.id]);

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

    const ids = filtered.map((p) => p.id);
    const [c, m] = await Promise.all([fetchReactionCountsForPosts(ids), fetchMyReactionsForPosts(ids, user.id)]);
    setCounts(c);
    setMine(m);
  };

  return (
    <MissionaryPageShell
      header={
        <DarkPageHeader
          title="COMMUNITY"
          subtitle="What God is doing across the movement"
          className="sticky top-0 z-10"
        />
      }
    >
      <div className="space-y-5 pb-5 md:pb-8">
        <div className="-mx-5 overflow-x-auto px-5 py-4 md:-mx-8 md:px-8">
          <div className="flex w-max gap-2 pb-1">
            {FIELD_FILTERS.map((chip) => {
              const active = fieldFilter === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setFieldFilter(chip)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    active
                      ? 'bg-[#111] text-white'
                      : 'border border-mission-line bg-white text-mission-muted hover:border-mission-muted/50'
                  }`}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <p className="py-16 text-center text-sm text-mission-muted">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-mission-muted">
            No community posts yet. Be the first to share.
          </p>
        ) : (
          <div className="space-y-4">
            {filtered.map((p) => {
              const c = counts.get(p.id) || { heart: 0, pray: 0 };
              const my = mine.get(p.id);
              const heartActive = my?.has?.('heart');
              const prayActive = my?.has?.('pray');
              const accent = normalizeProfileAccent(p.authorAccent);
              const initials = initialsFromDisplayName(p.authorName);
              const orgLine = [p.authorOrg, p.authorLocation].filter(Boolean).join(' · ');

              return (
                <article
                  key={p.id}
                  className="overflow-hidden rounded-[14px] border border-[#333] bg-[#111]"
                >
                  <div className="bg-[#1A1A1A] px-4 pb-4 pt-4">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                        style={{ backgroundColor: accent }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{p.authorName}</p>
                        {orgLine ? <p className="mt-0.5 text-xs text-white/45">{orgLine}</p> : null}
                        <p className="mt-1 text-[11px] text-white/45">
                          {new Date(p.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <TypeBadge typeKeyClass={postTypeBadgeClass(p.type)}>{p.type}</TypeBadge>
                        <FieldCategoryBadge category={p.fieldCategory} />
                      </div>
                    </div>
                    {p.locationName ? (
                      <p className="mt-3 text-sm font-medium text-[#2A9A58]">
                        <span className="mr-1" aria-hidden>
                          📍
                        </span>
                        {p.locationName}
                      </p>
                    ) : null}
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white">{p.body}</p>
                  </div>
                  {p.imageUrl ? (
                    <img src={p.imageUrl} alt="" className="block max-h-[280px] w-full object-cover" />
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 border-t border-[#333] px-4 py-3">
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
                </article>
              );
            })}
          </div>
        )}
      </div>
    </MissionaryPageShell>
  );
}
