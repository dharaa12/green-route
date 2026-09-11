import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

function pinIcon(letter, color) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color || '#22c55e'};width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 2px 5px rgba(0,0,0,.35);border:2px solid #fff">
             <span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:12px">${letter}</span>
           </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -26],
  });
}

function Fit({ points }) {
  const map = useMap();
  useEffect(() => {
    // The map may have mounted inside a hidden container (mobile List/Map toggle).
    const apply = () => {
      map.invalidateSize();
      if (points.length > 1) map.fitBounds(points, { padding: [50, 50], maxZoom: 14 });
      else if (points.length === 1) map.setView(points[0], 14);
    };
    apply();
    const t = setTimeout(apply, 250);
    return () => clearTimeout(t);
  }, [points, map]);
  return null;
}

export default function PartnerMap({ items }) {
  const pins = items.filter(i => Number.isFinite(i.lat) && Number.isFinite(i.lng));
  const points = pins.map(i => [i.lat, i.lng]);

  return (
    <MapContainer center={[40.735, -73.98]} zoom={12} className="h-full w-full" zoomControl>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map(i => (
        <Marker key={i.id} position={[i.lat, i.lng]} icon={pinIcon(i.partner_name[0].toUpperCase(), i.color)}>
          <Popup>
            <span className="font-semibold">{i.partner_name}</span><br />
            {i.name} · {i.points_cost} pts
          </Popup>
        </Marker>
      ))}
      <Fit points={points} />
    </MapContainer>
  );
}
