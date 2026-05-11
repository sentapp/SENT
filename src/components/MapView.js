import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { fireMapIcon, homeMapIcon } from '../lib/mapMarkers';

export default function MapView({
  points = [],
  route = false,
  className = '',
  height = 360,
  rounded = true,
}) {
  const positions = points
    .map((p) => p.coords)
    .filter(Boolean)
    .map((c) => [c.lat, c.lng]);

  const hasPins = positions.length > 0;
  const centerLat = hasPins ? positions[0][0] : 20;
  const centerLng = hasPins ? positions[0][1] : 0;
  const zoom = hasPins ? 4 : 2;

  const roundedClass = rounded ? 'rounded-card' : 'rounded-none';

  return (
    <div
      className={`overflow-hidden border border-neutral-200 bg-white shadow-sm ${roundedClass} ${className}`}
    >
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={zoom}
        style={{ height, width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer attribution="" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {points.map((p) =>
          p.coords ? (
            <Marker
              key={p.id}
              position={[p.coords.lat, p.coords.lng]}
              icon={p.isHome ? homeMapIcon : fireMapIcon}
            >
              {p.popup ? (
                <Popup>
                  <div className="space-y-2">{p.popup}</div>
                </Popup>
              ) : null}
            </Marker>
          ) : null,
        )}
        {route && positions.length >= 2 ? (
          <Polyline positions={positions} pathOptions={{ color: '#185FA5', weight: 3, dashArray: '6 8' }} />
        ) : null}
      </MapContainer>
    </div>
  );
}
