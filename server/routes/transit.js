const express = require('express');
const router = express.Router();

const NAVITIA_TOKEN = process.env.NAVITIA_TOKEN;
const TRANSIT_CO2_PER_KM = 0.089; // fallback factor (kg/km), ~US transit average

// Small in-memory cache so we stay well under the free-tier rate limit.
const cache = new Map();
const TTL_MS = 10 * 60 * 1000;
const key = (a, b, c, d) => [a, b, c, d].map(n => Number(n).toFixed(4)).join(',');

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

const PHYSICAL_MODE = {
  Metro: 'subway', Subway: 'subway', Tramway: 'tram', 'Local Train': 'rail',
  'Long Distance Train': 'rail', Train: 'rail', 'Rail Replacement Bus': 'bus',
  Bus: 'bus', 'Bus Rapid Transit': 'bus', Coach: 'bus', Ferry: 'ferry',
  'Suspended Cable Car': 'gondola', Funicular: 'rail', Shuttle: 'bus',
};

function navitiaLegs(sections) {
  const legs = [];
  for (const s of sections) {
    if (s.type === 'street_network' || s.type === 'transfer' || s.type === 'crow_fly') {
      if (s.mode === 'walking' || s.type === 'transfer') {
        legs.push({ mode: 'walk', label: 'Walk', duration_min: Math.round((s.duration || 0) / 60) });
      }
    } else if (s.type === 'public_transport') {
      const di = s.display_informations || {};
      const mode = PHYSICAL_MODE[di.physical_mode] || PHYSICAL_MODE[di.commercial_mode] || 'transit';
      legs.push({
        mode,
        label: di.label || di.commercial_mode || 'Transit',
        line: di.label || null,
        duration_min: Math.round((s.duration || 0) / 60),
      });
    }
  }
  // Merge consecutive walk legs (transfer + street network)
  return legs.reduce((acc, leg) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.mode === 'walk' && leg.mode === 'walk') {
      prev.duration_min += leg.duration_min;
    } else {
      acc.push(leg);
    }
    return acc;
  }, []);
}

function navitiaPolyline(sections) {
  const pts = [];
  for (const s of sections) {
    const coords = s.geojson?.coordinates;
    if (Array.isArray(coords)) {
      for (const [lng, lat] of coords) pts.push([lat, lng]);
    }
  }
  return pts;
}

async function fetchNavitia(fromLat, fromLng, toLat, toLng) {
  if (!NAVITIA_TOKEN) return null;
  const params = new URLSearchParams({
    from: `${fromLng};${fromLat}`,
    to: `${toLng};${toLat}`,
    data_freshness: 'base_schedule',
    max_nb_journeys: '1',
    'first_section_mode[]': 'walking',
    'last_section_mode[]': 'walking',
  });
  const url = `https://api.navitia.io/v1/journeys?${params}`;
  const auth = Buffer.from(`${NAVITIA_TOKEN}:`).toString('base64');

  const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
  if (!res.ok) return null;
  const data = await res.json();

  const journey = (data.journeys || []).find(j => (j.sections || []).some(s => s.type === 'public_transport'));
  if (!journey) return null;

  const polyline = navitiaPolyline(journey.sections);
  const distance_km = journey.distances
    ? Number(((Object.values(journey.distances).reduce((a, b) => a + b, 0)) / 1000).toFixed(2))
    : null;

  return {
    source: 'navitia',
    duration_min: Math.round(journey.duration / 60),
    distance_km,
    co2_emitted_kg: journey.co2_emission
      ? Number((journey.co2_emission.value / 1000).toFixed(3))
      : null,
    transfers: journey.nb_transfers ?? 0,
    legs: navitiaLegs(journey.sections),
    polyline,
  };
}

function estimate({ driveKm, driveMin }) {
  const km = driveKm ? Number((driveKm * 0.95).toFixed(2)) : null;
  return {
    source: 'estimate',
    duration_min: driveMin ? Math.round(driveMin * 1.15) : null,
    distance_km: km,
    co2_emitted_kg: km != null ? Number((km * TRANSIT_CO2_PER_KM).toFixed(3)) : null,
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

  const k = key(fromLat, fromLng, toLat, toLng);
  const cached = fromCache(k);
  if (cached) return res.json(cached);

  let result = null;
  try {
    result = await fetchNavitia(fromLat, fromLng, toLat, toLng);
  } catch (e) {
    console.error('navitia error:', e.message);
  }
  if (!result) result = estimate({ driveKm: Number(driveKm), driveMin: Number(driveMin) });

  toCache(k, result);
  res.json(result);
});

module.exports = router;
