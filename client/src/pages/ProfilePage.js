import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Leaf, TreePine, TrendingUp, Flame, Car, Train, Bike, UserPlus, Search } from 'lucide-react';
import { lbs, mi } from '../utils/units';
import WeeklyImpactChart from '../components/WeeklyImpactChart';

const MODE_ICON = { drive: Car, transit: Train, bike: Bike };

function StatTile({ icon: Icon, value, label, tone }) {
  const tones = {
    green: 'bg-green-50 text-green-700',
    blue: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`rounded-2xl p-3 ${tones[tone]}`}>
      <Icon size={16} />
      <p className="mt-1.5 text-xl font-bold leading-none text-gray-900">{value}</p>
      <p className="mt-1 text-[11px] leading-tight opacity-80">{label}</p>
    </div>
  );
}

function TripRow({ trip }) {
  const Icon = MODE_ICON[trip.route_type] || Car;
  const isDrive = trip.route_type === 'drive';
  const when = new Date(trip.taken_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-800">{trip.origin} → {trip.destination}</p>
        <p className="mt-0.5 text-xs text-gray-500">
          {trip.duration_min ? `${trip.duration_min}m · ` : ''}{mi(trip.distance_km)} mi · {when}
        </p>
      </div>
      <div className={`flex-shrink-0 text-right text-sm font-bold ${isDrive ? 'text-red-500' : 'text-green-600'}`}>
        {isDrive ? `+${lbs(trip.co2_emitted_kg)}` : `−${lbs(trip.co2_saved_kg)}`} lbs
        <span className="block text-[10px] font-normal text-gray-400">CO₂</span>
      </div>
    </div>
  );
}

function BadgeCard({ badge }) {
  return (
    <div className={`rounded-2xl border p-4 ${badge.earned ? 'border-gray-100 bg-white shadow-sm' : 'border-gray-100 bg-gray-50 opacity-60'}`}>
      <span className="text-2xl">{badge.icon}</span>
      <p className="mt-2 text-sm font-bold text-gray-900">{badge.name}</p>
      <p className="mt-0.5 text-xs text-gray-500">{badge.description}</p>
      {badge.earned ? (
        <span
          className="mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ color: badge.color || '#15803d', backgroundColor: (badge.color || '#15803d') + '22' }}
        >
          Earned
        </span>
      ) : (
        <span className="mt-2 inline-block rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
          Locked
        </span>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { profile, authFetch } = useApp();
  const [trips, setTrips] = useState([]);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('history');
  const [addName, setAddName] = useState('');
  const [addMsg, setAddMsg] = useState('');

  useEffect(() => {
    Promise.all([
      authFetch('/api/trips').catch(() => []),
      authFetch('/api/friends').catch(() => []),
    ]).then(([t, f]) => {
      setTrips(t);
      setFriends(f);
    }).finally(() => setLoading(false));
  }, [authFetch]);

  async function handleAddFriend(e) {
    e.preventDefault();
    if (!addName.trim()) return;
    try {
      await authFetch('/api/friends/add', { method: 'POST', body: JSON.stringify({ username: addName.trim() }) });
      setAddMsg(`Added ${addName.trim()}`);
      setAddName('');
      setFriends(await authFetch('/api/friends'));
    } catch (err) {
      setAddMsg(err.message);
    }
    setTimeout(() => setAddMsg(''), 3000);
  }

  if (!profile) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  const greenTrips = trips.filter(t => t.route_type !== 'drive').length;
  const since = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 pb-10">
      <div className="flex flex-col items-center pt-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-600 text-2xl font-bold text-white">
          {profile.username[0].toUpperCase()}
        </div>
        <h1 className="mt-3 text-xl font-bold text-gray-900">{profile.username}</h1>
        {since && <p className="text-sm text-gray-500">Member since {since}</p>}
        <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-green-600">
          <Leaf size={14} /> {profile.climate_points} Climate Points
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={TreePine} tone="green" value={lbs(profile.co2_saved_kg)} label="CO₂ saved (lbs)" />
        <StatTile icon={Leaf} tone="green" value={profile.climate_points} label="Climate Points" />
        <StatTile icon={TrendingUp} tone="blue" value={greenTrips} label="Green trips" />
        <StatTile icon={Flame} tone="amber" value={friends.length} label="Friends" />
      </div>

      <div className="mt-4">
        <WeeklyImpactChart trips={trips} />
      </div>

      <div className="mt-6 flex rounded-xl bg-gray-100 p-1">
        {['history', 'badges', 'friends'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {loading && <p className="py-8 text-center text-sm text-gray-400">Loading…</p>}

        {!loading && tab === 'history' && (
          trips.length === 0
            ? <p className="py-8 text-center text-sm text-gray-400">No trips yet. Search a route to get started.</p>
            : <div className="space-y-2">{trips.map(t => <TripRow key={t.id} trip={t} />)}</div>
        )}

        {!loading && tab === 'badges' && (
          <div className="grid grid-cols-2 gap-3">
            {(profile.badges || []).map(b => <BadgeCard key={b.id} badge={b} />)}
          </div>
        )}

        {!loading && tab === 'friends' && (
          <div>
            <form onSubmit={handleAddFriend} className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={addName}
                onChange={e => setAddName(e.target.value)}
                placeholder="Search people to add…"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-24 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button type="submit" className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
                <UserPlus size={13} /> Add
              </button>
            </form>
            {addMsg && <p className="mt-1.5 text-xs text-gray-500">{addMsg}</p>}

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {friends.length} {friends.length === 1 ? 'Friend' : 'Friends'}
            </p>
            <div className="mt-2 space-y-2">
              {friends.map(f => (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                    {f.username[0].toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">{f.username}</p>
                    <p className="text-xs text-gray-500">{f.climate_points} pts · {lbs(f.co2_saved_kg)} lbs saved</p>
                  </div>
                </div>
              ))}
              {friends.length === 0 && <p className="py-6 text-center text-sm text-gray-400">No friends yet — add someone above.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
