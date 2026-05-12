import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { homeMapIcon, mapPinCurrent, mapPinPast, mapPinUpcoming } from '../lib/mapMarkers';

function iconForPoint(p) {
  if (p.isHome) return homeMapIcon;
  if (p.mapPinVariant === 'past') return mapPinPast;
  if (p.mapPinVariant === 'upcoming') return mapPinUpcoming;
  return mapPinCurrent;
}

export default function MapView({ points = [], className = '', height = 360, rounded = true }) {
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
    <div className={`overflow-hidden border border-mission-line bg-surface ${roundedClass} ${className}`}>
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
              icon={iconForPoint(p)}
              eventHandlers={{
                click: (e) => {
                  e.target.openPopup();
                },
              }}
            >
              {p.popup ? (
                <Popup keepInView autoPan maxWidth={560}>
                  <div className="space-y-2">{p.popup}</div>
                </Popup>
              ) : null}
            </Marker>
          ) : null,
        )}
      </MapContainer>
    </div>
  );
}
