// Ask the browser for the user's location once, cache the result (or the denial).
let coordPromise = null;

export function getUserCoord({ refresh = false } = {}) {
  if (coordPromise && !refresh) return coordPromise;
  coordPromise = new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
  return coordPromise;
}

// A ~85km box around a point, for biasing (not restricting) search results.
function viewboxAround({ lat, lng }, d = 0.75) {
  return `${lng - d},${lat + d},${lng + d},${lat - d}`;
}

// Free OSM geocoding. Results near the user's location are preferred, but
// searches anywhere in the world still work (bounded=0). Falls back to an
// unbiased global search when location permission is denied or unavailable.
export async function nominatimSearch(query, limit = 6) {
  if (!query || query.trim().length < 2) return [];
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    dedupe: '1',
    limit: String(limit),
  });
  const coord = await getUserCoord();
  if (coord) {
    params.set('viewbox', viewboxAround(coord));
    params.set('bounded', '0');
  }
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en' },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// Turn the user's coordinate into a readable place name to prefill the origin.
export async function reverseGeocode({ lat, lng }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    addressdetails: '1',
    zoom: '16',
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: { 'Accept-Language': 'en' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
