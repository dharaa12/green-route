// Nominatim geocoding (OSM, free, no key)
export async function geocode(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data.length) throw new Error(`Location not found: ${query}`);
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
}

// OSRM routing (free, no key) — profiles: driving, cycling, foot
async function osrmRoute(profile, originLng, originLat, destLng, destLat) {
  const coords = `${originLng},${originLat};${destLng},${destLat}`;
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes.length) throw new Error('Route not found');
  const route = data.routes[0];
  return {
    distance_km: parseFloat((route.distance / 1000).toFixed(2)),
    duration_min: Math.round(route.duration / 60),
    // GeoJSON coords are [lng, lat], Leaflet needs [lat, lng]
    polyline: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}

const CO2_PER_KM = { drive: 0.21, transit: 0.089, bike: 0.0 };

function calcCo2(distKm, mode) {
  const emitted = parseFloat((distKm * CO2_PER_KM[mode]).toFixed(3));
  const saved = parseFloat((distKm * CO2_PER_KM.drive - emitted).toFixed(3));
  const points = Math.floor(saved * 10);
  return { co2_emitted_kg: emitted, co2_saved_kg: Math.max(0, saved), points_earned: Math.max(0, points) };
}

export async function fetchAllRoutes(origin, destination, fromCoord, toCoord) {
  const [from, to] = await Promise.all([
    fromCoord ? Promise.resolve({ ...fromCoord, display: origin }) : geocode(origin),
    toCoord   ? Promise.resolve({ ...toCoord,   display: destination }) : geocode(destination),
  ]);

  // Fetch driving and cycling routes; simulate transit from driving distance
  const [drive, bike] = await Promise.all([
    osrmRoute('driving', from.lng, from.lat, to.lng, to.lat),
    osrmRoute('cycling', from.lng, from.lat, to.lng, to.lat),
  ]);

  // Transit: use driving polyline but apply transit CO2 rate and ~0.8x duration
  const transit = {
    distance_km: parseFloat((drive.distance_km * 0.9).toFixed(2)),
    duration_min: Math.round(drive.duration_min * 0.85),
    polyline: drive.polyline,
  };

  return [
    {
      id: 'drive',
      label: 'Drive',
      mode: 'drive',
      color: '#ef4444',
      ...drive,
      ...calcCo2(drive.distance_km, 'drive'),
    },
    {
      id: 'transit',
      label: 'Subway / Transit',
      mode: 'transit',
      color: '#3b82f6',
      ...transit,
      ...calcCo2(transit.distance_km, 'transit'),
    },
    {
      id: 'bike',
      label: 'Bike',
      mode: 'bike',
      color: '#22c55e',
      ...bike,
      ...calcCo2(bike.distance_km, 'bike'),
    },
  ];
}
