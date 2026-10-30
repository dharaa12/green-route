import { useState, useEffect, useRef, useCallback } from 'react';
import { Polyline, CircleMarker, Marker, useMap } from 'react-leaflet';
import {
  ArrowUp, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight, CornerUpLeft, CornerUpRight,
  RotateCcw, Flag, Navigation, Undo2, Leaf, LoaderCircle, TriangleAlert, CircleCheck, Shuffle,
} from 'lucide-react';
import { getCurrentFix, watchFixes } from '../utils/geo';
import { fetchBikeRoute } from '../utils/routing';
import { createSimulator } from '../utils/tripSim';
import { prepareRoute, project, guidance, haversineM, formatDistance } from '../utils/navigation';

// Following a route: turn-by-turn guidance, rerouting when you stray, and
// points only once you arrive. Live trips are started and completed through the
// server (which checks where you are and how long it took); demo trips replay
// the route as fake GPS and never touch the server or earn points.

const OFF_ROUTE_MIN_M = 50;      // further than this from the route counts as off it...
const OFF_ROUTE_MAX_M = 120;     // ...widened by GPS inaccuracy, but never past this
const OFF_ROUTE_FIXES = 2;       // in a row, so one noisy reading doesn't reroute
const REROUTE_COOLDOWN_MS = 8000;
const ARRIVE_M = 50;

export function useTrip({ authFetch, onCompleted }) {
  const [trip, setTrip] = useState(null);
  const tripRef = useRef(null);
  const authFetchRef = useRef(authFetch);
  const onCompletedRef = useRef(onCompleted);
  authFetchRef.current = authFetch;
  onCompletedRef.current = onCompleted;

  const stopFollowing = useRef(() => {});
  const simRef = useRef(null);
  const wakeLock = useRef(null);
  const offCount = useRef(0);
  const lastReroute = useRef(0);

  const patch = useCallback(changes => {
    tripRef.current = { ...tripRef.current, ...changes };
    setTrip(tripRef.current);
  }, []);

  const stopTracking = useCallback(() => {
    stopFollowing.current();
    stopFollowing.current = () => {};
    if (simRef.current) simRef.current.stop();
    simRef.current = null;
  }, []);

  const end = useCallback(() => {
    stopTracking();
    if (wakeLock.current) wakeLock.current.release().catch(() => {});
    wakeLock.current = null;
    tripRef.current = null;
    setTrip(null);
  }, [stopTracking]);

  useEffect(() => end, [end]);

  const arrive = useCallback(async fix => {
    const t = tripRef.current;
    if (!t) return;
    stopTracking();
    if (t.mode === 'demo') {
      patch({ status: 'done', result: { demo: true, points_earned: t.route.points_earned } });
      return;
    }
    patch({ status: 'completing', fix, error: '' });
    try {
      const data = await authFetchRef.current('/api/trips/complete', {
        method: 'POST',
        body: JSON.stringify({
          trip_token: t.token,
          position: { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy },
        }),
      });
      patch({ status: 'done', result: data });
      if (onCompletedRef.current) onCompletedRef.current(data);
    } catch (err) {
      patch({ status: 'arrived', error: err.message, fix });
    }
  }, [patch, stopTracking]);

  const reroute = useCallback(async fix => {
    const t = tripRef.current;
    lastReroute.current = Date.now();
    patch({ status: 'rerouting' });
    try {
      const fresh = await fetchBikeRoute(fix, t.dest);
      if (!tripRef.current || tripRef.current.status !== 'rerouting') return;
      offCount.current = 0;
      // The payout stays what was promised at the start; only the way there changes.
      patch({ status: 'active', nav: fresh.nav, notice: '' });
    } catch {
      if (tripRef.current) patch({ status: 'active', notice: "Couldn't reroute. Head back toward the route." });
    }
  }, [patch]);

  const onFix = useCallback(fix => {
    const t = tripRef.current;
    if (!t || (t.status !== 'active' && t.status !== 'rerouting')) return;

    const proj = project(t.nav.route, fix);
    const threshold = Math.min(OFF_ROUTE_MAX_M, Math.max(OFF_ROUTE_MIN_M, fix.accuracy || 0));
    const off = proj.distM > threshold;
    offCount.current = off ? offCount.current + 1 : 0;

    patch({
      fix,
      offRoute: off,
      weakGps: (fix.accuracy || 0) > 100,
      remainingM: Math.max(0, t.nav.route.total - proj.along),
      distToDestM: haversineM(fix, t.dest),
      guide: guidance(t.nav, proj.along),
      remaining: t.nav.polyline.slice(proj.idx + 1),
    });

    if (haversineM(fix, t.dest) <= Math.max(ARRIVE_M, Math.min(fix.accuracy || 0, 100))) {
      arrive(fix);
      return;
    }
    if (
      off && offCount.current >= OFF_ROUTE_FIXES && t.status === 'active' &&
      t.route.mode === 'bike' && Date.now() - lastReroute.current > REROUTE_COOLDOWN_MS
    ) {
      reroute(fix);
    }
  }, [patch, arrive, reroute]);

  const start = useCallback(async (route, { demo = false } = {}) => {
    end();
    offCount.current = 0;
    lastReroute.current = 0;
    const pts = route.polyline || [];
    if (pts.length < 2) {
      patch({ mode: demo ? 'demo' : 'live', route, status: 'error', error: 'This route has no path to follow.' });
      return;
    }
    const nav = route.nav || { polyline: pts, route: prepareRoute(pts), steps: [] };
    const [lat, lng] = pts[pts.length - 1];
    patch({
      mode: demo ? 'demo' : 'live', route, nav, dest: { lat, lng },
      status: 'starting', error: '', notice: '', fix: null, guide: null, remaining: pts,
      remainingM: nav.route.total, distToDestM: null, offRoute: false, weakGps: false,
    });

    if (demo) {
      patch({ status: 'active' });
      simRef.current = createSimulator({ getRoute: () => tripRef.current?.nav.route, onFix });
      return;
    }

    try {
      const fix = await getCurrentFix();
      const [oLat, oLng] = pts[0];
      const { trip_token: token } = await authFetchRef.current('/api/trips/start', {
        method: 'POST',
        body: JSON.stringify({
          route_type: route.mode,
          origin: route.origin,
          destination: route.destination,
          origin_coord: { lat: oLat, lng: oLng },
          dest_coord: { lat, lng },
          distance_km: route.distance_km,
          // The figures the route card showed. The server caps them and pays
          // out exactly these.
          co2_saved_kg: route.co2_saved_kg,
          co2_emitted_kg: route.co2_emitted_kg,
          position: { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy },
        }),
      });
      if (!tripRef.current) return; // ended while we were waiting
      patch({ token, status: 'active', fix });
      stopFollowing.current = watchFixes(onFix, err => patch({ notice: err.message }));
      onFix(fix);
      try {
        if (navigator.wakeLock) wakeLock.current = await navigator.wakeLock.request('screen');
      } catch { /* keeping the screen on is a nicety */ }
    } catch (err) {
      if (tripRef.current) patch({ status: 'error', error: err.message });
    }
  }, [end, patch, onFix]);

  const retryArrival = useCallback(() => {
    const t = tripRef.current;
    if (t && t.fix) arrive(t.fix);
  }, [arrive]);

  const wrongTurn = useCallback(() => { if (simRef.current) simRef.current.wrongTurn(); }, []);

  return { trip, start, end, retryArrival, wrongTurn };
}

const ICONS = {
  depart: Navigation, arrive: Flag, roundabout: RotateCcw, uturn: Undo2,
  left: ArrowLeft, right: ArrowRight, straight: ArrowUp,
  'slight left': ArrowUpLeft, 'slight right': ArrowUpRight,
  'sharp left': CornerUpLeft, 'sharp right': CornerUpRight,
};

function Chip({ tone, children }) {
  const tones = {
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
    red: 'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ActiveTripPanel({ ctl }) {
  const { trip, start, end, retryArrival, wrongTurn } = ctl;
  if (!trip) return null;

  const { route, status, mode } = trip;
  const demo = mode === 'demo';
  const points = route.points_earned;

  if (status === 'starting') {
    return (
      <div className="flex items-center gap-3 p-5 text-sm text-gray-600">
        <LoaderCircle size={18} className="animate-spin text-green-600" /> Finding your location…
      </div>
    );
  }

  if (status === 'error') {
    // A real trip can only start with location access, standing at the start.
    // Anyone else (a visitor, a laptop) can still see how it works.
    const canDemo = (route.polyline || []).length >= 2;
    return (
      <div className="p-5">
        <p className="flex items-start gap-2 text-sm font-medium text-red-600">
          <TriangleAlert size={16} className="mt-0.5 flex-shrink-0" /> {trip.error}
        </p>
        {canDemo && (
          <>
            <button
              onClick={() => start(route, { demo: true })}
              className="mt-4 w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700"
            >
              Try a simulated trip instead
            </button>
            <p className="mt-1.5 text-center text-xs text-gray-500">
              Replays this route with fake location. No points are earned.
            </p>
          </>
        )}
        <button onClick={end} className="mt-3 w-full rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Back to routes
        </button>
      </div>
    );
  }

  if (status === 'completing') {
    return (
      <div className="flex items-center gap-3 p-5 text-sm text-gray-600">
        <LoaderCircle size={18} className="animate-spin text-green-600" /> Checking your trip…
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="p-5 text-center">
        <CircleCheck size={40} className="mx-auto text-green-600" />
        <h2 className="mt-2 text-lg font-bold text-gray-900">You made it!</h2>
        {demo ? (
          <p className="mt-1 text-sm text-gray-600">
            That was a simulated trip, so no points were added. A real trip like this earns <strong>+{points} pts</strong>.
          </p>
        ) : (
          <p className="mt-1 text-sm text-gray-600">
            {trip.result.points_earned > 0 ? <><strong>+{trip.result.points_earned} climate points</strong> added.</> : 'Trip logged.'}
          </p>
        )}
        {!demo && trip.result.new_badges && trip.result.new_badges.length > 0 && (
          <p className="mt-2 text-sm font-semibold text-amber-600">
            Badge unlocked: {trip.result.new_badges.map(b => b.name).join(', ')}
          </p>
        )}
        <button onClick={end} className="mt-4 w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
          Done
        </button>
      </div>
    );
  }

  if (status === 'arrived') {
    return (
      <div className="p-5">
        <p className="flex items-start gap-2 text-sm font-medium text-red-600">
          <TriangleAlert size={16} className="mt-0.5 flex-shrink-0" /> {trip.error}
        </p>
        <div className="mt-4 flex gap-2">
          <button onClick={retryArrival} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700">
            Try again
          </button>
          <button onClick={end} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            End trip
          </button>
        </div>
      </div>
    );
  }

  // active / rerouting
  const guide = trip.guide;
  const GuideIcon = guide ? ICONS[guide.icon] || ArrowUp : Navigation;
  const remainingM = trip.remainingM ?? trip.nav.route.total;
  const totalM = trip.nav.route.total || 1;
  const etaMin = Math.max(1, Math.round(route.duration_min * (remainingM / totalM)));

  return (
    <div>
      <div className="bg-green-600 px-5 py-4 text-white">
        {guide ? (
          <div className="flex items-center gap-4">
            <GuideIcon size={34} className="flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xl font-bold leading-tight">{formatDistance(guide.inM)}</p>
              <p className="text-sm text-green-50">{guide.text}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Navigation size={30} className="flex-shrink-0" />
            <div>
              <p className="text-lg font-bold leading-tight">Head to your destination</p>
              <p className="text-sm text-green-50">We&apos;ll check you in when you arrive.</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-800">{formatDistance(remainingM)} left</span>
          <span className="text-gray-500">~{etaMin} min</span>
          <span className="inline-flex items-center gap-1 font-semibold text-green-700">
            <Leaf size={14} /> +{points} pts on arrival
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {demo && <Chip tone="blue">Demo · simulated location · no points</Chip>}
          {trip.status === 'rerouting' && <Chip tone="amber"><LoaderCircle size={12} className="animate-spin" /> Rerouting…</Chip>}
          {trip.status === 'active' && trip.offRoute && <Chip tone="amber">Off route</Chip>}
          {trip.weakGps && <Chip tone="red">Weak GPS signal</Chip>}
        </div>

        {trip.notice && <p className="text-xs font-medium text-amber-700">{trip.notice}</p>}

        {demo && (
          <button onClick={wrongTurn} className="flex w-full items-center justify-center gap-2 rounded-xl border border-blue-300 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
            <Shuffle size={14} /> Simulate a wrong turn
          </button>
        )}
        <button onClick={end} className="w-full rounded-xl border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          End trip
        </button>
      </div>
    </div>
  );
}

// The part of a trip that lives on the map: the route, you, and where you're going.
export function ActiveTripMap({ trip }) {
  const map = useMap();
  const fix = trip && trip.fix;
  useEffect(() => {
    if (fix) map.setView([fix.lat, fix.lng], Math.max(map.getZoom(), 16), { animate: true });
  }, [fix, map]);

  if (!trip || !trip.nav) return null;
  return (
    <>
      <Polyline positions={trip.nav.polyline} pathOptions={{ color: '#22c55e', weight: 6, opacity: 0.3 }} />
      {trip.remaining && trip.remaining.length > 1 && (
        <Polyline positions={trip.remaining} pathOptions={{ color: '#16a34a', weight: 6, opacity: 0.95 }} />
      )}
      {fix && (
        <CircleMarker
          center={[fix.lat, fix.lng]}
          radius={9}
          pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}
        />
      )}
      {trip.dest && <Marker position={[trip.dest.lat, trip.dest.lng]} />}
    </>
  );
}
