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

// The product is NYC-first, so this is where we look when we don't know where
// the user is.
const NYC = { lat: 40.7128, lng: -74.006 };

// A ~85km box around a point: roughly the NYC / New Jersey metro area.
function viewboxAround({ lat, lng }, d = 0.75) {
  return `${lng - d},${lat + d},${lng + d},${lat - d}`;
}

async function nominatimRequest(query, limit, extra) {
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    dedupe: '1',
    limit: String(limit),
    ...extra,
  });
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

function kmBetween(a, b) {
  const dLat = (a.lat - b.lat) * 111;
  const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

// Nominatim orders matches by importance, not distance, so "Trader Joe's"
// would start in Brooklyn for someone in Newark. Keep the best match's name
// first, but order its same-named results (chains, street segments) by how
// close they are, then leave the rest in Nominatim's order.
function nearestFirst(items, center) {
  const nameOf = i => (i.name || i.display_name.split(',')[0]).toLowerCase();
  const best = items[0] && nameOf(items[0]);
  const distance = i => kmBetween(center, { lat: parseFloat(i.lat), lng: parseFloat(i.lon) });
  return [
    ...items.filter(i => nameOf(i) === best).sort((a, b) => distance(a) - distance(b)),
    ...items.filter(i => nameOf(i) !== best),
  ];
}

function ordinal(n) {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

// OSM spells numbered streets with ordinals ("West 106th Street") and
// Nominatim won't match "106" to "106th", so "157 W 106 Street" finds no
// building. Google bridges that gap; we add the suffix when a number is
// clearly a street name: before "Street"/"St", or before a bare "Avenue".
// A house number ("130 Court Street", "100 Avenue of the Americas") is left alone.
function ordinalizeStreets(query) {
  return query.replace(
    /\b(\d+)(?=\s+(?:street\b|st\s*(?:,|$)|(?:avenue|ave)\s*(?:,|$)))/gi,
    (_, n) => ordinal(Number(n)),
  );
}

// Free OSM geocoding, ranked nearest-first. A viewbox on its own is only a
// soft hint to Nominatim (the best text match anywhere still wins, so
// "106 Street" finds Yangon before Manhattan's "West 106th Street"), so the
// metro area around the user is searched first, restricted to that box. Only
// when it has nothing do we look everywhere else, with the US ahead of the rest
// of the world, which keeps a place abroad ("Eiffel Tower") findable.
// Nominatim's public API allows ~1 request/second, so this makes at most two.
export async function nominatimSearch(query, limit = 6) {
  const q = query?.trim();
  if (!q || q.length < 2) return [];
  const center = (await getUserCoord()) || NYC;
  const viewbox = viewboxAround(center);
  const seen = new Set();
  const results = [];
  const add = (items, max) => {
    let added = 0;
    for (const item of nearestFirst(items, center)) {
      if (added >= max || results.length >= limit) break;
      if (seen.has(item.display_name)) continue;
      seen.add(item.display_name);
      results.push(item);
      added++;
    }
  };

  // Ask for Nominatim's maximum so the nearest match isn't cut off before we
  // can order by distance (a limit of 15 missed Hoboken's Trader Joe's).
  add(await nominatimRequest(ordinalizeStreets(q), 40, { viewbox, bounded: '1' }), limit);
  if (results.length > 0) return results;

  const elsewhere = await nominatimRequest(q, 40, { viewbox, bounded: '0' });
  const isUS = item => item.address?.country_code === 'us';
  add(elsewhere.filter(isUS), Math.ceil((limit - results.length) / 2));
  add(elsewhere.filter(item => !isUS(item)), limit);
  add(elsewhere.filter(isUS), limit);
  return results;
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

// "Vessel, Chelsea District, New York" -> "Vessel". A bare house number
// ("123, Main Street, ...") keeps the street so the name is still useful.
export function shortPlaceName(label) {
  if (!label) return '';
  const parts = label.split(',').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return label;
  if (/^\d+[A-Za-z]?(-\d+)?$/.test(parts[0]) && parts[1]) return `${parts[0]} ${parts[1]}`;
  return parts[0];
}

const toFix = pos => ({
  lat: pos.coords.latitude,
  lng: pos.coords.longitude,
  accuracy: pos.coords.accuracy,
  t: pos.timestamp,
});

// The three ways the browser can fail to give us a position, in plain words.
function locationError(err) {
  if (err.code === 1) {
    return new Error('Location access is blocked for this site. Allow it in your browser or system settings to start a trip.');
  }
  if (err.code === 2) {
    return new Error("Your device couldn't work out where you are. Check that location services (and Wi-Fi) are on.");
  }
  return new Error('Finding your location took too long. Try again.');
}

// One fresh, high-accuracy position fix (with its accuracy in metres).
export function getCurrentFix({ timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This device can't share its location."));
    navigator.geolocation.getCurrentPosition(
      pos => resolve(toFix(pos)),
      err => reject(locationError(err)),
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    );
  });
}

// Follow the user's position. Returns a function that stops following.
export function watchFixes(onFix, onError) {
  if (!navigator.geolocation) {
    onError(new Error("This device can't share its location."));
    return () => {};
  }
  const id = navigator.geolocation.watchPosition(
    pos => onFix(toFix(pos)),
    err => onError(locationError(err)),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
  );
  return () => navigator.geolocation.clearWatch(id);
}
