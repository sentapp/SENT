import L from 'leaflet';

/**
 * Minimal circle pin (L.divIcon + HTML circle) — no emoji, no raster assets.
 * @param {{ fill: string; size?: number; stroke?: string; strokeWidth?: number }} opts
 */
export function cleanPinIcon({ fill, size = 18, stroke = '#ffffff', strokeWidth = 2.5 }) {
  const d = Math.round(size);
  const sw = strokeWidth;
  return L.divIcon({
    className: 'sent-map-pin',
    html: `<div style="width:${d}px;height:${d}px;border-radius:9999px;background:${fill};border:${sw}px solid ${stroke};box-shadow:0 1px 3px rgba(0,0,0,0.22);cursor:pointer" aria-hidden="true"></div>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d],
    popupAnchor: [0, -d],
  });
}

/** Missionary home base — larger, accent blue. */
export const homeMapIcon = cleanPinIcon({ fill: '#185FA5', size: 26, strokeWidth: 3 });

/** Most recent post location on the route timeline. */
export const mapPinCurrent = cleanPinIcon({ fill: '#0F6E56', size: 18 });

/** Older post locations. */
export const mapPinPast = cleanPinIcon({ fill: '#854F0B', size: 18 });

/** @deprecated Use `mapPinCurrent` */
export const postMapIcon = mapPinCurrent;

/** @deprecated Use `mapPinCurrent` */
export const fireMapIcon = mapPinCurrent;
