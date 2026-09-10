import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Search, Car, Bike, Train, Footprints, Leaf, Wind, Clock, Ruler, MapPin } from 'lucide-react';
import { fetchAllRoutes } from '../utils/routing';
import { useApp } from '../context/AppContext';
import { Link } from 'react-router-dom';
import LocationInput from '../components/LocationInput';

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
    const allPoints = routes.flatMap(r => r.polyline);
    if (allPoints.length) map.fitBounds(allPoints, { padding: [40, 40] });
  }, [routes, map]);
  return null;
}

const MODE_CONFIG = {
  drive:   { icon: Car,        color: '#ef4444', label: 'Drive',          bg: 'bg-red-50',    text: 'text-red-600',   border: 'border-red-400' },
  transit: { icon: Train,      color: '#f59e0b', label: 'Subway/Transit', bg: 'bg-amber-50',  text: 'text-amber-600', border: 'border-amber-400' },
  bike:    { icon: Bike,       color: '#22c55e', label: 'Bike',           bg: 'bg-green-50',  text: 'text-green-600', border: 'border-green-400' },
};

export default function MapPage() {
  const { profile, authFetch, session, updatePoints } = useApp();
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

  async function handleSearch(e) {
    e.preventDefault();
    if (!from.label || !to.label) return;
    setError('');
    setRoutes([]);
    setSelectedId(null);
    setSearching(true);
    try {
      const results = await fetchAllRoutes(from.label, to.label, from.coord, to.coord);
      setRoutes(results);
      if (results[0]?.polyline?.length) {
        const poly = results[0].polyline;
        setFromCoord(poly[0]);
        setToCoord(poly[poly.length - 1]);
      }
      setSelectedId(results[0]?.id || null);
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

  const selectedRoute = routes.find(r => r.id === selectedId);

  return (
    <div className="flex" style={{ height: 'calc(100vh - 56px)' }}>
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
        {/* Search */}
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Route</p>
          <form onSubmit={handleSearch} className="space-y-2">
            <LocationInput
              value={from.label}
              onChange={(label, coord) => setFrom({ label, coord: coord || null })}
              placeholder="From — e.g. Times Square, NYC"
              icon={MapPin}
              color="#22c55e"
            />
            <div className="w-px h-3 bg-gray-200 ml-4" />
            <LocationInput
              value={to.label}
              onChange={(label, coord) => setTo({ label, coord: coord || null })}
              placeholder="To — e.g. Brooklyn Bridge, NYC"
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

        {/* Preferred modes legend */}
        <div className="p-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Preferred Modes</p>
          <div className="flex flex-wrap gap-2">
            {[
              { icon: Footprints, label: 'Walk',    color: 'bg-green-100 text-green-700' },
              { icon: Bike,       label: 'Bike',    color: 'bg-green-700 text-white' },
              { icon: Train,      label: 'Subway',  color: 'bg-amber-100 text-amber-700' },
              { icon: Car,        label: 'Drive',   color: 'bg-red-100 text-red-600' },
            ].map(({ icon: Icon, label, color }) => (
              <span key={label} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${color}`}>
                <Icon size={12} /> {label}
              </span>
            ))}
          </div>
        </div>

        {/* Route options */}
        {routes.length > 0 && (
          <div className="p-4 flex-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Route Options</p>
            <div className="space-y-3">
              {routes.map(route => {
                const cfg = MODE_CONFIG[route.mode];
                const Icon = cfg.icon;
                const isSelected = selectedId === route.id;
                return (
                  <div
                    key={route.id}
                    onClick={() => setSelectedId(route.id)}
                    className={`rounded-xl border-2 p-3 cursor-pointer transition-all ${
                      isSelected ? `${cfg.border} ${cfg.bg}` : 'border-gray-100 bg-white hover:border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: cfg.color }} />
                        <Icon size={14} className={cfg.text} />
                        <span className="text-sm font-semibold text-gray-800">{cfg.label}</span>
                        {route.mode !== 'drive' && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex items-center gap-1 ${cfg.bg} ${cfg.text}`}>
                            <Leaf size={10} /> Eco
                          </span>
                        )}
                      </div>
                      {route.points_earned > 0 && (
                        <span className="text-green-600 font-bold text-xs">+{route.points_earned} pts</span>
                      )}
                    </div>

                    <div className="flex gap-3 text-xs text-gray-500 mb-2">
                      <span className="flex items-center gap-1"><Clock size={11} /> {route.duration_min} min</span>
                      <span className="flex items-center gap-1"><Ruler size={11} /> {route.distance_km} km</span>
                      <span className="flex items-center gap-1"><Wind size={11} /> {route.co2_emitted_kg} kg CO₂</span>
                    </div>

                    {route.mode !== 'drive' && route.co2_saved_kg > 0 && (
                      <p className="text-xs text-green-600">Saves {route.co2_saved_kg} kg CO₂ vs driving</p>
                    )}

                    {isSelected && (
                      session ? (
                        <button
                          onClick={e => { e.stopPropagation(); handleTakeRoute(route); }}
                          disabled={taking}
                          className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 transition-colors"
                        >
                          {taking ? 'Logging…' : 'Take this route'}
                        </button>
                      ) : (
                        <Link
                          to="/login"
                          className="mt-2 block w-full text-center border border-green-500 text-green-600 py-1.5 rounded-lg text-xs font-semibold hover:bg-green-50 transition-colors"
                        >
                          Sign in to log trip & earn points
                        </Link>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {routes.length === 0 && !searching && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
            <Leaf size={36} className="mb-3 text-green-200" />
            <p className="text-sm font-medium text-gray-500">Search a route to see eco-friendly options and earn climate points</p>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapContainer
          center={[40.7128, -74.006]}
          zoom={12}
          className="w-full h-full"
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {routes.map(route => (
            <Polyline
              key={route.id}
              positions={route.polyline}
              color={route.color}
              weight={selectedId === route.id ? 6 : 3}
              opacity={selectedId === route.id ? 0.95 : 0.4}
              eventHandlers={{ click: () => setSelectedId(route.id) }}
            />
          ))}
          {fromCoord && <Marker position={fromCoord} />}
          {toCoord && <Marker position={toCoord} />}
          <FitBounds routes={routes} />
        </MapContainer>

        {/* Map legend */}
        {routes.length > 0 && (
          <div className="absolute top-3 right-3 bg-white rounded-xl shadow-md p-3 z-[1000]">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mode</p>
            {routes.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                <span className="w-6 h-0.5 rounded-full inline-block" style={{ backgroundColor: r.color }} />
                {MODE_CONFIG[r.mode]?.label}
              </div>
            ))}
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-5 py-2.5 rounded-full text-sm font-semibold shadow-lg z-[1000] whitespace-nowrap">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}
