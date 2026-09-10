import { nominatimSearch } from './geo';

const API = process.env.REACT_APP_API_URL;

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

// Real transit routing via our backend (Navitia), with an estimated fallback.
async function transitRoute(from, to, drive) {
  const params = new URLSearchParams({
    fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng,
    driveKm: drive.distance_km, driveMin: drive.duration_min,
  });
  try {
    const res = await fetch(`${API}/api/transit?${params}`);
    if (res.ok) return await res.json();
  } catch { /* fall through to estimate */ }
  return {
    source: 'estimate',
    distance_km: Number((drive.distance_km * 0.95).toFixed(2)),
    duration_min: Math.round(drive.duration_min * 1.15),
    co2_emitted_kg: Number((drive.distance_km * 0.95 * TRANSIT_CO2_PER_KM).toFixed(3)),
    legs: [{ mode: 'transit', label: 'Public transit' }],
    polyline: null,
  };
}

const DRIVE_CO2_PER_KM = 0.21;
const TRANSIT_CO2_PER_KM = 0.089;

const MODE_META = {
  drive:   { name: 'Direct Drive',     legs: [{ mode: 'drive', label: 'Drive' }] },
  transit: { name: 'Subway + Transit', legs: [{ mode: 'transit', label: 'Transit' }] },
  bike:    { name: 'Bike Route',        legs: [{ mode: 'bike', label: 'Bike' }] },
};

function reward(co2EmittedKg, driveCo2Kg) {
  const saved = Math.max(0, parseFloat((driveCo2Kg - co2EmittedKg).toFixed(3)));
  return { co2_saved_kg: saved, points_earned: Math.max(0, Math.floor(saved * 10)) };
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
    legs: r.legs?.length ? r.legs : MODE_META[r.mode].legs,
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

  const [drive, bike] = await Promise.all([
    osrmRoute('driving', from.lng, from.lat, to.lng, to.lat),
    osrmRoute('cycling', from.lng, from.lat, to.lng, to.lat),
  ]);
  const transit = await transitRoute(from, to, drive);

  const driveCo2 = parseFloat((drive.distance_km * DRIVE_CO2_PER_KM).toFixed(3));
  const transitCo2 = transit.co2_emitted_kg != null
    ? transit.co2_emitted_kg
    : parseFloat(((transit.distance_km ?? drive.distance_km) * TRANSIT_CO2_PER_KM).toFixed(3));

  return [
    {
      id: 'drive', label: 'Drive', mode: 'drive', color: '#ef4444',
      ...drive,
      co2_emitted_kg: driveCo2,
      ...reward(driveCo2, driveCo2),
    },
    {
      id: 'transit', label: 'Subway / Transit', mode: 'transit', color: '#f59e0b',
      distance_km: transit.distance_km ?? drive.distance_km,
      duration_min: transit.duration_min ?? Math.round(drive.duration_min * 1.15),
      polyline: transit.polyline?.length ? transit.polyline : drive.polyline,
      co2_emitted_kg: transitCo2,
      legs: transit.legs,
      source: transit.source,
      transfers: transit.transfers,
      ...reward(transitCo2, driveCo2),
    },
    {
      id: 'bike', label: 'Bike', mode: 'bike', color: '#22c55e',
      ...bike,
      co2_emitted_kg: 0,
      ...reward(0, driveCo2),
    },
  ];
}
