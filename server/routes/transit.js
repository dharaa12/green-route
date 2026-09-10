const express = require('express');
const router = express.Router();

// Transitous — a free, community-run MOTIS routing service running on open
// GTFS feeds (incl. the MTA's). No API key.
const MOTIS_BASE = 'https://api.transitous.org/api/v1';

// Per-passenger-km CO2 (kg). Transit is grid/diesel powered; walking is zero.
const CO2_PER_KM = { subway: 0.04, tram: 0.04, rail: 0.05, bus: 0.10, ferry: 0.12, transit: 0.06 };
const TRANSIT_FALLBACK_CO2_PER_KM = 0.06;

const MODE_MAP = {
  WALK: 'walk', SUBWAY: 'subway', METRO: 'subway', TRAM: 'tram',
  BUS: 'bus', TROLLEYBUS: 'bus', COACH: 'bus',
  RAIL: 'rail', REGIONAL_RAIL: 'rail', HIGHSPEED_RAIL: 'rail', LONG_DISTANCE: 'rail',
  FERRY: 'ferry', GONDOLA: 'transit', CABLE_CAR: 'transit', FUNICULAR: 'transit',
};

// In-memory cache to stay light on the shared service.
const cache = new Map();
const TTL_MS = 10 * 60 * 1000;
const cacheKey = (...n) => n.map(x => Number(x).toFixed(4)).join(',');
function fromCache(k) {
  const hit = cache.get(k);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v;
  cache.delete(k);
  return null;
}
function toCache(k, v) {
  cache.set(k, { v, t: Date.now() });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
}

function decodePolyline(str, precision = 5) {
  const factor = Math.pow(10, precision);
  let index = 0, lat = 0, lng = 0;
  const out = [];
  while (index < str.length) {
    let shift = 0, result = 0, byte;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    out.push([lat / factor, lng / factor]);
  }
  return out;
}

function haversineKm(a, b) {
  const R = 6371, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function polylineKm(pts) {
  let km = 0;
  for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
  return km;
}

function buildFromItinerary(it) {
  const legs = [];
  let polyline = [];
  let co2 = 0;
  let distanceKm = 0;

  for (const l of it.legs) {
    const mode = MODE_MAP[l.mode] || 'transit';
    const pts = l.legGeometry?.points
      ? decodePolyline(l.legGeometry.points, l.legGeometry.precision || 5)
      : [];
    if (pts.length) polyline = polyline.concat(pts);

    const km = polylineKm(pts);
    distanceKm += km;
    if (mode !== 'walk') co2 += km * (CO2_PER_KM[mode] || CO2_PER_KM.transit);

    if (mode === 'walk') {
      legs.push({ mode: 'walk', label: 'Walk', duration_min: Math.round((l.duration || 0) / 60) });
    } else {
      legs.push({
        mode,
        label: l.routeShortName || l.routeLongName || mode,
        line: l.routeShortName || null,
        color: l.routeColor ? `#${l.routeColor}` : null,
        from: l.from?.name || null,
        duration_min: Math.round((l.duration || 0) / 60),
      });
    }
  }

  // Merge consecutive walk legs (a transfer often splits into two).
  const merged = legs.reduce((acc, leg) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.mode === 'walk' && leg.mode === 'walk') prev.duration_min += leg.duration_min;
    else acc.push(leg);
    return acc;
  }, []);

  return {
    source: 'transitous',
    duration_min: Math.round(it.duration / 60),
    distance_km: Number(distanceKm.toFixed(2)),
    co2_emitted_kg: Number(co2.toFixed(3)),
    transfers: it.transfers ?? Math.max(0, merged.filter(l => l.mode !== 'walk').length - 1),
    legs: merged,
    polyline,
  };
}

async function fetchTransitous(fromLat, fromLng, toLat, toLng) {
  const params = new URLSearchParams({
    fromPlace: `${fromLat},${fromLng}`,
    toPlace: `${toLat},${toLng}`,
    time: new Date().toISOString(),
  });
  const res = await fetch(`${MOTIS_BASE}/plan?${params}`, {
    headers: {
      accept: 'application/json',
      'User-Agent': 'GreenRoute/1.0 (https://github.com/dharaa12/green-route)',
    },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const withTransit = (data.itineraries || []).find(it =>
    (it.legs || []).some(l => l.mode !== 'WALK'));
  return withTransit ? buildFromItinerary(withTransit) : null;
}

function estimate({ driveKm, driveMin }) {
  const km = driveKm ? Number((driveKm * 0.95).toFixed(2)) : null;
  return {
    source: 'estimate',
    duration_min: driveMin ? Math.round(driveMin * 1.15) : null,
    distance_km: km,
    co2_emitted_kg: km != null ? Number((km * TRANSIT_FALLBACK_CO2_PER_KM).toFixed(3)) : null,
    transfers: null,
    legs: [{ mode: 'transit', label: 'Public transit', duration_min: null }],
    polyline: null,
  };
}

router.get('/', async (req, res) => {
  const { fromLat, fromLng, toLat, toLng, driveKm, driveMin } = req.query;
  if (!fromLat || !fromLng || !toLat || !toLng) {
    return res.status(400).json({ error: 'fromLat, fromLng, toLat, toLng are required' });
  }

  const k = cacheKey(fromLat, fromLng, toLat, toLng);
  const cached = fromCache(k);
  if (cached) return res.json(cached);

  let result = null;
  try {
    result = await fetchTransitous(fromLat, fromLng, toLat, toLng);
  } catch (e) {
    console.error('transitous error:', e.message);
  }
  if (!result) result = estimate({ driveKm: Number(driveKm), driveMin: Number(driveMin) });

  toCache(k, result);
  res.json(result);
});

module.exports = router;
