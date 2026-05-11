import { useMemo } from 'react';

const PREVIEW_CHARS = 150;

function ProfileCoords(profile) {
  if (!profile) return null;
  const lat = profile.latitude != null ? Number(profile.latitude) : null;
  const lng = profile.longitude != null ? Number(profile.longitude) : null;
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

function fmtDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return '';
  }
}

/** Tailwind classes for post-type badge in map popups */
export function postTypeBadgeClass(type) {
  switch (type) {
    case 'Prayer request':
      return 'bg-violet-100 text-violet-900';
    case 'Monthly update':
      return 'bg-emerald-100 text-emerald-900';
    case 'Win/testimony':
      return 'bg-amber-100 text-amber-900';
    default:
      return 'bg-[#185FA5]/15 text-[#185FA5]';
  }
}

function truncateBody(body) {
  const raw = (body || '').trim();
  if (raw.length <= PREVIEW_CHARS) return { preview: raw, truncated: false };
  const slice = raw.slice(0, PREVIEW_CHARS).trimEnd();
  return { preview: `${slice}…`, truncated: true };
}

/**
 * Build pins: home base (profile) first, then posts with coords in chronological order (route order).
 * profile: Supabase profiles row (latitude, longitude, location_name) or legacy shape with locationCoords.
 * @param options.readMoreHref Optional `(post) => string` deep link for truncated popup body (e.g. updates feed anchor).
 */
export function useMissionaryMapPoints(profile, posts, options = {}) {
  const readMoreHref = typeof options.readMoreHref === 'function' ? options.readMoreHref : null;

  return useMemo(() => {
    let homeCoords = ProfileCoords(profile);
    const locationName = profile?.location_name ?? profile?.locationName ?? '';

    if (!homeCoords && profile?.locationCoords) {
      homeCoords = profile.locationCoords;
    }

    const postsWithCoords = (posts || [])
      .filter((p) => p.locationCoords)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const points = [];

    if (homeCoords) {
      points.push({
        id: 'home',
        isHome: true,
        coords: homeCoords,
        title: 'Home base',
        popup: (
          <div className="max-w-[260px] space-y-2">
            <span className="inline-flex rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-800">
              Home base
            </span>
            <p className="text-base font-bold leading-snug text-neutral-900">{locationName || 'Mission base'}</p>
            <p className="text-[11px] text-neutral-500">Your home location on the map</p>
          </div>
        ),
      });
    }

    for (const p of postsWithCoords) {
      const cityLabel = (p.locationName || '').trim() || 'Location';
      const { preview, truncated } = truncateBody(p.body);
      const moreHref = truncated && readMoreHref ? readMoreHref(p) : null;

      points.push({
        id: p.id,
        isHome: false,
        coords: p.locationCoords,
        title: cityLabel,
        popup: (
          <div className="max-w-[260px] space-y-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${postTypeBadgeClass(p.type)}`}
            >
              {p.type}
            </span>
            <p className="text-base font-bold leading-snug text-neutral-900">{cityLabel}</p>
            <p className="text-[11px] text-neutral-500">{fmtDate(p.createdAt)}</p>
            <p className="text-sm leading-snug text-neutral-800 whitespace-pre-wrap">{preview}</p>
            {truncated && moreHref ? (
              <a href={moreHref} className="inline-block text-sm font-semibold text-[#185FA5] hover:underline">
                Read more
              </a>
            ) : truncated ? (
              <p className="text-xs font-medium text-neutral-500">Read more in your updates list</p>
            ) : null}
          </div>
        ),
      });
    }

    return points;
  }, [profile, posts, readMoreHref]);
}
