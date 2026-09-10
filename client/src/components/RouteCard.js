import { Leaf, Clock, Ruler, Wind } from 'lucide-react';

export default function RouteCard({ route, selected, onSelect, onTake, taking }) {
  const isGreen = route.mode !== 'drive';
  return (
    <div
      onClick={() => onSelect(route.id)}
      className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
        selected
          ? 'border-green-500 bg-green-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: route.color }}
          />
          <span className="font-semibold text-gray-800">{route.label}</span>
          {isGreen && (
            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
              <Leaf size={11} /> Eco
            </span>
          )}
        </div>
        {isGreen && route.points_earned > 0 && (
          <span className="text-green-600 font-bold text-sm">+{route.points_earned} pts</span>
        )}
      </div>

      <div className="flex gap-4 text-sm text-gray-600 mb-3">
        <span className="flex items-center gap-1"><Clock size={13} /> {route.duration_min} min</span>
        <span className="flex items-center gap-1"><Ruler size={13} /> {route.distance_km} km</span>
        <span className="flex items-center gap-1"><Wind size={13} /> {route.co2_emitted_kg} kg CO₂</span>
      </div>

      {isGreen && route.co2_saved_kg > 0 && (
        <p className="text-xs text-green-600">
          Saves {route.co2_saved_kg} kg CO₂ vs driving
        </p>
      )}

      {selected && (
        <button
          onClick={e => { e.stopPropagation(); onTake(route); }}
          disabled={taking}
          className="mt-3 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg text-sm disabled:opacity-60 transition-colors"
        >
          {taking ? 'Logging trip…' : 'Take this route'}
        </button>
      )}
    </div>
  );
}
