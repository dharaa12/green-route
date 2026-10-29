import { pointAt, project } from './navigation';

// Replays a trip as fake GPS so the whole flow (guidance, rerouting, arrival)
// can be tried without moving. Used by demo mode, which never earns points.
//
// getRoute() returns the prepared route to follow right now; when it changes
// (a reroute) the simulated rider picks up the new one. wrongTurn() sends the
// rider off in a perpendicular direction until the route is replaced.
export function createSimulator({ getRoute, onFix, speedMps = 110, tickMs = 1000 }) {
  let pos = null;
  let astrayHeading = null;
  let routeSeen = getRoute();

  function tick() {
    const route = getRoute();
    if (!route || !route.pts.length) return;
    if (route !== routeSeen) { routeSeen = route; astrayHeading = null; }
    const step = (speedMps * tickMs) / 1000;

    if (!pos) {
      const p = pointAt(route, 0);
      pos = { lat: p.lat, lng: p.lng };
    } else if (astrayHeading !== null) {
      const rad = (astrayHeading * Math.PI) / 180;
      pos = {
        lat: pos.lat + (Math.cos(rad) * step) / 110540,
        lng: pos.lng + (Math.sin(rad) * step) / (111320 * Math.cos((pos.lat * Math.PI) / 180)),
      };
    } else {
      const { along } = project(route, pos);
      const p = pointAt(route, along + step);
      pos = { lat: p.lat, lng: p.lng };
    }
    onFix({ lat: pos.lat, lng: pos.lng, accuracy: 8, t: Date.now() });
  }

  const timer = setInterval(tick, tickMs);
  tick();

  return {
    wrongTurn() {
      const route = getRoute();
      if (!pos || !route) return;
      astrayHeading = (pointAt(route, project(route, pos).along).bearing + 90) % 360;
    },
    stop() { clearInterval(timer); },
  };
}
