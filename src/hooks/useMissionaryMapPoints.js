import { useMemo } from 'react';
import { normalizePostTypeKey } from '../lib/postTypeStyles';

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
  switch (normalizePostTypeKey(type)) {
    case 'prayer':
      return 'bg-violet-100 text-violet-900';
    case 'monthly':
      return 'bg-emerald-100 text-emerald-900';
    case 'win':
      return 'bg-amber-100 text-amber-900';
    case 'field_story':
    default:
      return 'bg-[#185FA5]/15 text-[#185FA5]';
  }
}

/**
 * Build pins: home base (profile) first, then posts with coords in chronological order (route order).
 * profile: Supabase profiles row (latitude, longitude, location_name) or legacy shape with locationCoords.
 * Post markers use a Leaflet popup with type, location, date, and full body (scrollable when long).
 */
export function useMissionaryMapPoints(profile, posts) {
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
      const typeLabel = (p.type || 'Update').trim();

      points.push({
        id: p.id,
        isHome: false,
        coords: p.locationCoords,
        title: `${typeLabel} — ${cityLabel}`,
        popup: (
          <div className="max-w-[min(92vw,22rem)] space-y-2">
            <span
              className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${postTypeBadgeClass(p.type)}`}
            >
              {typeLabel}
            </span>
            <p className="text-base font-bold leading-snug text-neutral-900">{cityLabel}</p>
            <p className="text-[11px] text-neutral-500">{fmtDate(p.createdAt)}</p>
            <div className="max-h-64 overflow-y-auto rounded-btn border border-neutral-100 bg-neutral-50/80 p-2">
              <p className="text-sm leading-relaxed text-neutral-800 whitespace-pre-wrap">{p.body || ''}</p>
            </div>
          </div>
        ),
      });
    }

    return points;
  }, [profile, posts]);
}
