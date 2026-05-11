import { geocodePlaceName } from './geocoding';

const UI_TO_DB = {
  'Field story': 'field_story',
  'Prayer request': 'prayer_request',
  'Monthly update': 'monthly_update',
  'Win/testimony': 'win_testimony',
};

const DB_TO_UI = Object.fromEntries(Object.entries(UI_TO_DB).map(([k, v]) => [v, k]));

export function postTypeUiToDb(ui) {
  return UI_TO_DB[ui] || 'field_story';
}

export function postTypeDbToUi(db) {
  return DB_TO_UI[db] || 'Field story';
}

export function mapPostRow(row) {
  if (!row) return null;
  const lat = row.latitude != null ? Number(row.latitude) : null;
  const lng = row.longitude != null ? Number(row.longitude) : null;
  return {
    id: row.id,
    type: postTypeDbToUi(row.post_type),
    body: row.body || '',
    locationName: row.location_name || '',
    locationCoords:
      lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng) ? { lat, lng } : null,
    createdAt: row.created_at,
    _raw: row,
  };
}

export async function fetchMissionaryPosts(supabase, missionaryId) {
  if (!supabase || !missionaryId) return [];
  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .eq('missionary_id', missionaryId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchMissionaryPosts', error);
    return [];
  }
  return (data || []).map(mapPostRow);
}

export async function createMissionaryPost(supabase, missionaryId, { typeUi, locationName, body }) {
  const bodyText = (body || '').trim();
  if (!bodyText) return { error: new Error('Post body is required.') };

  let latitude = null;
  let longitude = null;
  const loc = (locationName || '').trim();
  if (loc) {
    const geo = await geocodePlaceName(loc);
    if (geo) {
      latitude = geo.lat;
      longitude = geo.lng;
    }
  }

  const row = {
    missionary_id: missionaryId,
    post_type: postTypeUiToDb(typeUi),
    location_name: loc,
    latitude,
    longitude,
    body: bodyText,
  };

  const hadLocation = Boolean(loc);
  const geocoded = hadLocation && latitude != null && longitude != null;

  const { data, error } = await supabase.from('posts').insert(row).select('*').single();
  if (error) return { error };
  return {
    data: mapPostRow(data),
    locationWarning: hadLocation && !geocoded,
  };
}

export async function updateMissionaryPost(supabase, missionaryId, postId, { typeUi, locationName, body }, existingPost) {
  const bodyText = (body || '').trim();
  if (!bodyText) return { error: new Error('Post body is required.') };

  const loc = (locationName || '').trim();
  const prevLoc = (existingPost?.locationName || '').trim();

  let latitude;
  let longitude;

  if (loc !== prevLoc) {
    if (!loc) {
      latitude = null;
      longitude = null;
    } else {
      const geo = await geocodePlaceName(loc);
      latitude = geo?.lat ?? null;
      longitude = geo?.lng ?? null;
    }
  } else if (!loc) {
    latitude = null;
    longitude = null;
  } else {
    const raw = existingPost?._raw;
    latitude = raw?.latitude != null ? Number(raw.latitude) : null;
    longitude = raw?.longitude != null ? Number(raw.longitude) : null;
    if (latitude != null && Number.isNaN(latitude)) latitude = null;
    if (longitude != null && Number.isNaN(longitude)) longitude = null;
  }

  const hadLocation = Boolean(loc);
  const geocoded = hadLocation && latitude != null && longitude != null;

  const { data, error } = await supabase
    .from('posts')
    .update({
      post_type: postTypeUiToDb(typeUi),
      body: bodyText,
      location_name: loc,
      latitude,
      longitude,
    })
    .eq('id', postId)
    .eq('missionary_id', missionaryId)
    .select('*')
    .single();

  if (error) return { error };
  return {
    data: mapPostRow(data),
    locationWarning: hadLocation && !geocoded,
  };
}

export async function deleteMissionaryPost(supabase, missionaryId, postId) {
  const { error } = await supabase.from('posts').delete().eq('id', postId).eq('missionary_id', missionaryId);
  return { error };
}
