import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useEffect } from 'react';

function pinIcon(letter, color) {
  return L.divIcon({
    className: '',
    html: `<div style="background:${color || '#22c55e'};width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.3)">
             <span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:12px">${letter}</span>
           </div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -24],
  });
}

function Fit({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default function PartnerMap({ items }) {
  const pins = items.filter(i => Number.isFinite(i.lat) && Number.isFinite(i.lng));
  const points = pins.map(i => [i.lat, i.lng]);

  return (
    <MapContainer center={[40.735, -73.99]} zoom={13} className="h-full w-full" zoomControl>
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
