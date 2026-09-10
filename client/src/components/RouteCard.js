import { Link } from 'react-router-dom';
import { Leaf, Timer, Flame, Car, Bike, Train, Footprints } from 'lucide-react';
import { formatCo2 } from '../utils/impact';

const LEG_ICON = { Drive: Car, Bike: Bike, Subway: Train, Walk: Footprints };
const MODE_ACCENT = {
  drive:   { dot: '#ef4444', text: 'text-red-600' },
  transit: { dot: '#f59e0b', text: 'text-amber-600' },
  bike:    { dot: '#22c55e', text: 'text-green-600' },
};

export default function RouteCard({ route, selected, onSelect, onTake, taking, canLog }) {
  const accent = MODE_ACCENT[route.mode];
  return (
    <div
      onClick={() => onSelect(route.id)}
      className={`rounded-2xl border p-4 cursor-pointer transition-all ${
        selected
          ? 'border-green-500 ring-2 ring-green-200 bg-green-50/40 shadow-sm'
          : route.isGreenest
            ? 'border-green-300 bg-white hover:border-green-400'
            : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {(route.isGreenest || route.isFastest) && (
        <div className="flex flex-wrap gap-2 mb-2.5">
          {route.isGreenest && (
            <span className="inline-flex items-center gap-1 rounded-full border border-green-300 bg-green-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-green-700">
              <Leaf size={12} /> Greenest route
            </span>
          )}
          {route.isFastest && (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-red-600">
              <Timer size={12} /> Fastest route
            </span>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accent.dot }} />
          <h3 className="text-base font-bold text-gray-900">{route.name}</h3>
        </div>
        {route.points_earned > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700 flex-shrink-0">
            <Flame size={12} /> +{route.points_earned} pts
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {route.legs.map((leg, i) => {
          const Icon = LEG_ICON[leg] || Footprints;
          const isPrimary = leg === 'Drive' || leg === 'Bike' || leg === 'Subway';
          return (
            <span
              key={i}
              className={`inline-flex items-center gap-1 text-xs font-medium ${
                isPrimary ? accent.text : 'text-gray-400'
              }`}
            >
              <Icon size={13} /> {leg}
            </span>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-5">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <Timer size={15} className="text-gray-400" /> {route.duration_min} min
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <Leaf size={15} className={route.co2_emitted_kg === 0 ? 'text-green-500' : 'text-gray-400'} />
          {formatCo2(route.co2_emitted_kg)} CO₂
        </span>
      </div>

      {route.co2_saved_kg > 0 && (
        <p className="mt-2 text-xs font-medium text-green-600">
          Saves {formatCo2(route.co2_saved_kg)} CO₂ vs driving · {route.co2_reduction_pct}% less
        </p>
      )}

      {selected && (
        canLog ? (
          <button
            onClick={e => { e.stopPropagation(); onTake(route); }}
            disabled={taking}
            className="mt-3 w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
          >
            {taking ? 'Logging…' : 'Take this route'}
          </button>
        ) : (
          <Link
            to="/login"
            onClick={e => e.stopPropagation()}
            className="mt-3 block w-full rounded-xl border border-green-500 py-2.5 text-center text-sm font-semibold text-green-600 transition-colors hover:bg-green-50"
          >
            Sign in to log trip &amp; earn points
          </Link>
        )
      )}
    </div>
  );
}
