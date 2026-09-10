import { Leaf, TreePine, Zap, Car, Lightbulb } from 'lucide-react';
import { ecoEquivalents, formatCount, formatCo2 } from '../utils/impact';

const TILE = {
  trees: { icon: TreePine,  className: 'bg-green-50 text-green-700' },
  phone: { icon: Zap,       className: 'bg-amber-50 text-amber-700' },
  drive: { icon: Car,       className: 'bg-sky-50 text-sky-700' },
  led:   { icon: Lightbulb, className: 'bg-violet-50 text-violet-700' },
};

export default function EcoImpact({ route }) {
  if (!route || route.co2_saved_kg <= 0) return null;
  const items = ecoEquivalents(route.co2_saved_kg);

  return (
    <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 rounded-lg bg-white p-1.5 text-green-600 shadow-sm">
          <Leaf size={16} />
        </span>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Eco-Impact</h3>
          <p className="text-xs text-gray-600">
            Choosing <span className="font-semibold text-green-700">{route.name}</span> saves{' '}
            <span className="font-semibold text-green-700">{formatCo2(route.co2_saved_kg)} CO₂</span>
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {items.map(item => {
          const t = TILE[item.key];
          const Icon = t.icon;
          return (
            <div key={item.key} className={`rounded-xl p-3 ${t.className}`}>
              <Icon size={15} />
              <p className="mt-1 text-base font-bold leading-none">{formatCount(item.value)}</p>
              <p className="mt-1 text-[11px] leading-tight opacity-80">{item.label}</p>
            </div>
          );
        })}
      </div>

      {route.co2_reduction_pct > 0 && (
        <p className="mt-3 rounded-xl bg-green-100 py-2 text-center text-sm font-bold text-green-800">
          {route.co2_reduction_pct}% less CO₂ than driving
        </p>
      )}
    </div>
  );
}
