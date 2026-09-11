import { useState, useEffect } from 'react';
import { MapContainer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import BaseMap from '../components/BaseMap';
import { Search, Leaf, MapPin, LocateFixed } from 'lucide-react';
import { fetchAllRoutes, annotateRoutes } from '../utils/routing';
import { getUserCoord, reverseGeocode } from '../utils/geo';
import { useApp } from '../context/AppContext';
import LocationInput from '../components/LocationInput';
import RouteCard from '../components/RouteCard';
import EcoImpact from '../components/EcoImpact';

function shortPlace(displayName) {
  return displayName ? displayName.split(',').slice(0, 3).join(', ').trim() : 'My location';
}

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function FitBounds({ routes }) {
  const map = useMap();
  useEffect(() => {
    if (!routes.length) return;
    const pts = routes
      .flatMap(r => r.polyline || [])
      .filter(p => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]));
    if (pts.length >= 2) map.fitBounds(pts, { padding: [50, 50], maxZoom: 15 });
  }, [routes, map]);
  return null;
}

function Recenter({ coord }) {
  const map = useMap();
  useEffect(() => {
    if (coord) map.setView([coord.lat, coord.lng], 13);
  }, [coord, map]);
  return null;
}

const MODE_LABEL = { drive: 'Drive', transit: 'Subway / Transit', bike: 'Bike' };

function useIsDesktop() {
  const query = '(min-width: 1024px)';
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = e => setIsDesktop(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isDesktop;
}

export default function MapPage() {
  const { authFetch, session, updatePoints } = useApp();
  const isDesktop = useIsDesktop();
  const [from, setFrom] = useState({ label: '', coord: null });
  const [to, setTo] = useState({ label: '', coord: null });
  const [routes, setRoutes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [fromCoord, setFromCoord] = useState(null);
  const [toCoord, setToCoord] = useState(null);
  const [searching, setSearching] = useState(false);
  const [taking, setTaking] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [userCoord, setUserCoord] = useState(null);
  const [locating, setLocating] = useState(false);

  async function locateMe({ refresh = false, prefill = true } = {}) {
    setLocating(true);
    try {
      const coord = await getUserCoord({ refresh });
      if (!coord) {
        if (refresh) setError('Location unavailable. Enable location access for this site and try again.');
        return;
      }
      setError('');
      setUserCoord(coord);
      if (prefill) {
        const rev = await reverseGeocode(coord);
        setFrom(f => ({ label: shortPlace(rev?.display_name), coord }));
      }
    } finally {
      setLocating(false);
    }
  }

  // On first load, offer to use the visitor's location to bias search + prefill origin.
  useEffect(() => {
    let cancelled = false;
    getUserCoord().then(async (coord) => {
      if (cancelled || !coord) return;
      setUserCoord(coord);
      const rev = await reverseGeocode(coord);
      if (cancelled) return;
      setFrom(f => (f.label ? f : { label: shortPlace(rev?.display_name), coord }));
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!from.label || !to.label) return;
    setError('');
    setRoutes([]);
    setSelectedId(null);
    setSearching(true);
    try {
      const results = annotateRoutes(await fetchAllRoutes(from.label, to.label, from.coord, to.coord));
      setRoutes(results);
      const anyPoly = results.find(r => r.polyline?.length)?.polyline;
      if (anyPoly) {
        setFromCoord(anyPoly[0]);
        setToCoord(anyPoly[anyPoly.length - 1]);
      }
      // Default to the route we're actually recommending.
      const recommended = results.find(r => r.isGreenest) || results[0];
      setSelectedId(recommended?.id || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setSearching(false);
    }
  }

  async function handleTakeRoute(route) {
    if (!session) return;
    setTaking(true);
    try {
      const data = await authFetch('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          origin: from.label,
          destination: to.label,
          route_type: route.mode,
          distance_km: route.distance_km,
        }),
      });
      updatePoints(data.new_total_points, undefined);
      const msg = route.mode === 'drive'
        ? 'Trip logged!'
        : `Trip logged! +${data.points_earned} climate points 🌱`;
      setToast(msg);
      if (data.new_badges?.length) {
        setTimeout(() => setToast(`🏆 Badge unlocked: ${data.new_badges.map(b => b.name).join(', ')}!`), 2500);
      }
      setTimeout(() => setToast(''), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setTaking(false);
    }
  }

  const searchPanel = (
    <div className="p-4 border-b border-gray-100 bg-white">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Route</p>
      <form onSubmit={handleSearch} className="space-y-2">
        <LocationInput
          value={from.label}
          onChange={(label, coord) => setFrom({ label, coord: coord || null })}
          placeholder="From — address, place, or station"
          icon={MapPin}
          color="#22c55e"
        />
        <button
          type="button"
          onClick={() => locateMe({ refresh: true })}
          disabled={locating}
          className="flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50 ml-1"
        >
          <LocateFixed size={12} />
          {locating ? 'Locating…' : 'Use my current location'}
        </button>
        <div className="w-px h-3 bg-gray-200 ml-4" />
        <LocationInput
          value={to.label}
          onChange={(label, coord) => setTo({ label, coord: coord || null })}
          placeholder="To — address, place, or station"
          icon={MapPin}
          color="#ef4444"
        />
        <button
          type="submit"
          disabled={searching || !from.label || !to.label}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          <Search size={14} />
          {searching ? 'Finding routes…' : 'Get Routes'}
        </button>
      </form>
      {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
    </div>
  );

  const resultsPanel = routes.length > 0 ? (
    <div className="p-4 space-y-4">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Route Options</p>
        <div className="space-y-3">
          {routes.map(route => (
            <RouteCard
              key={route.id}
              route={route}
              selected={selectedId === route.id}
              onSelect={setSelectedId}
              onTake={handleTakeRoute}
              taking={taking}
              canLog={!!session}
            />
          ))}
        </div>
      </div>
      <EcoImpact route={routes.find(r => r.isGreenest)} />
    </div>
  ) : !searching ? (
    <div className="flex flex-col items-center justify-center p-8 text-center text-gray-400">
      <Leaf size={36} className="mb-3 text-green-200" />
      <p className="text-sm font-medium text-gray-500">Search a route to see eco-friendly options and earn climate points</p>
    </div>
  ) : null;

  const mapPanel = (
    <div className="relative h-full w-full">
      <MapContainer center={[40.7128, -74.006]} zoom={12} className="w-full h-full" zoomControl>
        <BaseMap />
        {routes.map(route => (
          <Polyline
            key={`${route.id}-${selectedId === route.id}`}
            positions={route.polyline}
            pathOptions={{
              color: route.color,
              weight: selectedId === route.id ? 6 : 3,
              opacity: selectedId === route.id ? 0.95 : 0.4,
              dashArray: route.source === 'estimate' ? '6 8' : undefined,
            }}
            eventHandlers={{ click: () => setSelectedId(route.id) }}
          />
        ))}
        {fromCoord && <Marker position={fromCoord} />}
        {toCoord && <Marker position={toCoord} />}
        {routes.length === 0 && <Recenter coord={userCoord} />}
        <FitBounds routes={routes} />
      </MapContainer>

      {routes.length > 0 && (
        <div className="absolute top-3 right-3 bg-white rounded-xl shadow-md p-2.5 z-[1000]">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Mode</p>
          {routes.map(r => (
            <div key={r.id} className="flex items-center gap-2 text-xs text-gray-600 mb-1 last:mb-0">
              <span className="w-5 h-0.5 rounded-full inline-block" style={{ backgroundColor: r.color }} />
              {MODE_LABEL[r.mode]}
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg z-[1000] whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <div className="flex" style={{ height: 'calc(100vh - 56px)' }}>
        <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
          {searchPanel}
          {resultsPanel}
        </div>
        <div className="flex-1">{mapPanel}</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {searchPanel}
      <div className="h-[42vh] flex-shrink-0">{mapPanel}</div>
      {resultsPanel}
    </div>
  );
}
