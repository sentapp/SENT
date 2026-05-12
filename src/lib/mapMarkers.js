import L from 'leaflet';

/**
 * Circle pin: `L.divIcon` + inline HTML (no emoji, no raster assets).
 * @param {string} color CSS fill color
 * @param {number} size diameter in px
 */
export function createPin(color, size) {
  const d = Math.round(size);
  const stroke = '#ffffff';
  const strokeWidth = 2.5;
  const sw = strokeWidth;
  return L.divIcon({
    className: 'sent-map-pin',
    html: `<div style="width:${d}px;height:${d}px;border-radius:9999px;background:${color};border:${sw}px solid ${stroke};box-shadow:0 1px 3px rgba(0,0,0,0.22);cursor:pointer" aria-hidden="true"></div>`,
    iconSize: [d, d],
    iconAnchor: [d / 2, d],
    popupAnchor: [0, -d],
  });
}

/** Missionary home base */
export const homeMapIcon = createPin('#185FA5', 16);

/** Most recent post location */
export const mapPinCurrent = createPin('#0F6E56', 14);

/** Older post / past trip locations */
export const mapPinPast = createPin('#854F0B', 12);

/** Planned / upcoming (reserved for timeline use) */
export const mapPinUpcoming = createPin('#534AB7', 12);

/** @deprecated Use `mapPinCurrent` */
export const postMapIcon = mapPinCurrent;

/** @deprecated Use `mapPinCurrent` */
export const fireMapIcon = mapPinCurrent;

/** @deprecated Use `createPin` */
export function cleanPinIcon({ fill, size = 18, stroke: _stroke = '#ffffff', strokeWidth: _strokeWidth = 2.5 }) {
  return createPin(fill, size);
}
