import { nominatimSearch } from './geo';

// Geocode a free-text place to a coordinate (results near the user preferred).
export async function geocode(query) {
  const data = await nominatimSearch(query, 1);
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

const MODE_META = {
  drive:   { name: 'Direct Drive',    legs: ['Drive'] },
  transit: { name: 'Subway + Transit', legs: ['Walk', 'Subway', 'Walk'] },
  bike:    { name: 'Bike Route',       legs: ['Bike'] },
};

function calcCo2(distKm, mode) {
  const emitted = parseFloat((distKm * CO2_PER_KM[mode]).toFixed(3));
  const saved = parseFloat((distKm * CO2_PER_KM.drive - emitted).toFixed(3));
  const points = Math.floor(saved * 10);
  return { co2_emitted_kg: emitted, co2_saved_kg: Math.max(0, saved), points_earned: Math.max(0, points) };
}

// Tag the option set so the UI can show which route is fastest / greenest.
export function annotateRoutes(routes) {
  if (!routes.length) return routes;
  const fastestId = routes.reduce((a, b) => (b.duration_min < a.duration_min ? b : a)).id;
  const greenestId = routes.reduce((a, b) => (b.co2_emitted_kg < a.co2_emitted_kg ? b : a)).id;
  const driveCo2 = routes.find(r => r.mode === 'drive')?.co2_emitted_kg ?? 0;
  return routes.map(r => ({
    ...r,
    name: MODE_META[r.mode].name,
    legs: MODE_META[r.mode].legs,
    isFastest: r.id === fastestId,
    isGreenest: r.id === greenestId,
    co2_reduction_pct: driveCo2 > 0
      ? Math.round(((driveCo2 - r.co2_emitted_kg) / driveCo2) * 100)
      : 0,
  }));
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
      color: '#f59e0b',
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
