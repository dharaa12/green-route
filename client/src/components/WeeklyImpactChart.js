import { kgToLbs } from '../utils/units';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Monday-based index (0 = Mon … 6 = Sun)
function dayIndex(date) {
  return (date.getDay() + 6) % 7;
}

export default function WeeklyImpactChart({ trips }) {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dayIndex(now));

  const week = DAYS.map(() => ({ saved: 0, emitted: 0 }));
  for (const t of trips) {
    const d = new Date(t.taken_at);
    if (d < monday) continue;
    const i = dayIndex(d);
    week[i].saved += kgToLbs(t.co2_saved_kg);
    week[i].emitted += kgToLbs(t.co2_emitted_kg);
  }

  const max = Math.max(1, ...week.flatMap(d => [d.saved, d.emitted]));

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-bold text-gray-900">This Week — CO₂ Impact (lbs)</h3>
      <div className="mt-4 flex items-end justify-between gap-2" style={{ height: 120 }}>
        {week.map((d, i) => {
          const show = d.emitted > d.saved ? d.emitted : d.saved;
          const isEmit = d.emitted > d.saved && d.emitted > 0;
          return (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full flex-1 items-end justify-center">
                <div
                  className={`w-5 rounded-t ${isEmit ? 'bg-red-400' : 'bg-green-500'}`}
                  style={{ height: `${(show / max) * 100}%`, minHeight: show > 0 ? 4 : 0 }}
                  title={`${show.toFixed(1)} lbs`}
                />
              </div>
              <span className="text-[11px] text-gray-400">{DAYS[i]}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-4 text-[11px] text-gray-500">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> CO₂ saved</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> CO₂ emitted</span>
      </div>
    </div>
  );
}
