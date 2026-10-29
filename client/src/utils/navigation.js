// Geometry and turn-by-turn helpers for following a route on foot or by bike.
// Points are {lat, lng}; a polyline is an array of [lat, lng].

const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LNG = 111320;

export function haversineM(a, b) {
  const R = 6371000, toRad = d => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a, b) {
  const toRad = d => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Precompute cumulative distances so we can say how far along a route we are.
export function prepareRoute(polyline) {
  const pts = (polyline || []).map(([lat, lng]) => ({ lat, lng }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversineM(pts[i - 1], pts[i]));
  return { pts, cum, total: cum[cum.length - 1] || 0 };
}

// Closest point on the route to p: how far away it is, how far along the route
// it sits, and which segment it is on. Flat-earth maths is fine at city scale.
export function project(route, p) {
  const { pts, cum } = route;
  if (!pts.length) return { distM: Infinity, along: 0, idx: 0 };
  if (pts.length === 1) return { distM: haversineM(p, pts[0]), along: 0, idx: 0 };
  const cosLat = Math.cos((p.lat * Math.PI) / 180);
  let best = { distM: Infinity, along: 0, idx: 0 };
  for (let i = 0; i < pts.length - 1; i++) {
    const ax = (pts[i].lng - p.lng) * M_PER_DEG_LNG * cosLat;
    const ay = (pts[i].lat - p.lat) * M_PER_DEG_LAT;
    const bx = (pts[i + 1].lng - p.lng) * M_PER_DEG_LNG * cosLat;
    const by = (pts[i + 1].lat - p.lat) * M_PER_DEG_LAT;
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
    const distM = Math.hypot(ax + t * dx, ay + t * dy);
    if (distM < best.distM) {
      best = { distM, along: cum[i] + t * (cum[i + 1] - cum[i]), idx: i };
    }
  }
  return best;
}

// The point (and heading) a given distance along the route.
export function pointAt(route, along) {
  const { pts, cum, total } = route;
  const d = Math.max(0, Math.min(total, along));
  let i = 0;
  while (i < pts.length - 2 && cum[i + 1] < d) i++;
  const segLen = cum[i + 1] - cum[i];
  const t = segLen === 0 ? 0 : (d - cum[i]) / segLen;
  const a = pts[i], b = pts[i + 1] || pts[i];
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lng: a.lng + (b.lng - a.lng) * t,
    bearing: bearingDeg(a, b),
  };
}

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const compass = bearing => COMPASS[Math.round(bearing / 45) % 8];

// OSRM gives a maneuver type and direction, not words.
export function describeStep(step) {
  const { type, modifier, exit, bearing_after: bearing } = step.maneuver || {};
  const road = step.name ? ` onto ${step.name}` : '';
  const turn = modifier || 'straight';
  switch (type) {
    case 'depart':
      return { text: `Head ${compass(bearing || 0)}${step.name ? ` on ${step.name}` : ''}`, icon: 'depart' };
    case 'arrive':
      return { text: modifier === 'left' || modifier === 'right'
        ? `Arrive at your destination, on the ${modifier}` : 'Arrive at your destination', icon: 'arrive' };
    case 'roundabout':
    case 'rotary':
    case 'roundabout turn':
      return { text: `At the roundabout, take ${exit ? `exit ${exit}` : 'the exit'}${road}`, icon: 'roundabout' };
    case 'fork':
      return { text: `Keep ${turn.includes('left') ? 'left' : 'right'} at the fork${road}`, icon: turn.includes('left') ? 'slight left' : 'slight right' };
    case 'merge':
      return { text: `Merge${modifier ? ` ${modifier}` : ''}${road}`, icon: modifier || 'straight' };
    case 'end of road':
      return { text: `At the end of the road, turn ${turn}${road}`, icon: turn };
    case 'new name':
    case 'continue':
      return modifier && modifier !== 'straight'
        ? { text: `Continue ${turn}${road}`, icon: turn }
        : { text: `Continue straight${road}`, icon: 'straight' };
    case 'turn':
    default:
      return turn === 'straight'
        ? { text: `Continue straight${road}`, icon: 'straight' }
        : turn === 'uturn'
          ? { text: 'Make a U-turn', icon: 'uturn' }
          : { text: `Turn ${turn}${road}`, icon: turn };
  }
}

// Turn an OSRM route (requested with steps=true&geometries=geojson) into
// something we can follow: the step-aligned polyline plus a list of steps that
// each know how far along the route they begin.
export function buildNav(osrmRoute) {
  const polyline = [];
  const steps = [];
  for (const leg of osrmRoute.legs) {
    for (const s of leg.steps) {
      const coords = s.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
      const startIdx = polyline.length ? polyline.length - 1 : 0;
      if (polyline.length) coords.shift(); // the previous step already ends here
      polyline.push(...coords);
      steps.push({ ...describeStep(s), name: s.name || '', distanceM: s.distance, startIdx });
    }
  }
  const route = prepareRoute(polyline);
  steps.forEach(st => { st.startAlong = route.cum[Math.min(st.startIdx, route.cum.length - 1)]; });
  return { polyline, route, steps };
}

// Where we are in the step list, and what to tell the rider next.
export function guidance(nav, along) {
  const { steps, route } = nav;
  if (!steps.length) return null;
  let cur = 0;
  while (cur < steps.length - 1 && steps[cur + 1].startAlong <= along + 1) cur++;
  const upcoming = steps[cur + 1];
  if (!upcoming) return { stepIdx: cur, text: steps[cur].text, icon: steps[cur].icon, inM: Math.max(0, route.total - along) };
  // Right at the start, say how to set off; after that, announce the next turn.
  if (cur === 0 && along < 15) {
    return { stepIdx: 0, text: steps[0].text, icon: steps[0].icon, inM: 0 };
  }
  return { stepIdx: cur, text: upcoming.text, icon: upcoming.icon, inM: Math.max(0, upcoming.startAlong - along) };
}

export function formatDistance(m) {
  if (m < 30) return 'now';
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
}
