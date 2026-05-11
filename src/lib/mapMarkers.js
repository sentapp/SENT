import L from 'leaflet';

/** Fire emoji pin for post locations (avoids broken default Leaflet image URLs). */
export const fireMapIcon = L.divIcon({
  className: '',
  html: `<div style="
    font-size: 24px;
    line-height: 1;
    filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.3));
    cursor: pointer;
  ">🔥</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -32],
});

/** House emoji for missionary home base. */
export const homeMapIcon = L.divIcon({
  className: '',
  html: `<div style="
    font-size: 24px;
    line-height: 1;
    filter: drop-shadow(0px 2px 3px rgba(0,0,0,0.3));
    cursor: pointer;
  ">🏠</div>`,
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -32],
});
