// NYC metro bounding box for Nominatim (west,north,east,south).
// Covers the five boroughs plus Jersey City / Hoboken / Newark and lower Westchester.
const NYC_VIEWBOX = '-74.30,40.95,-73.65,40.45';

// Free OSM geocoding, biased and bounded to the NYC area so "Penn Station"
// resolves to Manhattan rather than a street in Pennsylvania.
export async function nominatimSearch(query, limit = 6) {
  if (!query || query.trim().length < 2) return [];
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    addressdetails: '1',
    dedupe: '1',
    limit: String(limit),
    countrycodes: 'us',
    viewbox: NYC_VIEWBOX,
    bounded: '1',
  });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'Accept-Language': 'en' },
  });
  if (!res.ok) return [];
  return res.json();
}
