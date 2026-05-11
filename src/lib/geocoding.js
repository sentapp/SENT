/**
 * Geocode a place name via Nominatim (OpenStreetMap).
 * https://operations.osmfoundation.org/policies/nominatim/ — use REACT_APP_NOMINATIM_EMAIL for fair-use identification.
 */
export async function geocodePlaceName(query) {
  const q = (query || '').trim();
  if (!q) return null;

  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    addressdetails: '0',
  });
  const email = (process.env.REACT_APP_NOMINATIM_EMAIL || '').trim();
  if (email) params.set('email', email);

  const url = `https://nominatim.openstreetmap.org/search?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    mode: 'cors',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
    },
  });

  if (!res.ok) return null;
  const data = await res.json();
  const hit = data?.[0];
  if (!hit?.lat || !hit?.lon) return null;

  return {
    lat: parseFloat(hit.lat),
    lng: parseFloat(hit.lon),
    displayName: hit.display_name || q,
  };
}
