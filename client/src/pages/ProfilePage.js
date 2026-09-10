import { useState, useEffect } from 'react';
import { Leaf, Wind, MapPin, LogOut, UserPlus, Copy, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';

const MODE_LABELS = { drive: '🚗 Drive', transit: '🚇 Transit', bike: '🚲 Bike' };

export default function ProfilePage() {
  const { profile, authFetch, logout } = useApp();
  const navigate = useNavigate();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addFriend, setAddFriend] = useState('');
  const [friendMsg, setFriendMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    authFetch('/api/trips')
      .then(setTrips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  async function handleAddFriend(e) {
    e.preventDefault();
    try {
      await authFetch('/api/friends/add', {
        method: 'POST',
        body: JSON.stringify({ username: addFriend }),
      });
      setFriendMsg(`Added ${addFriend}!`);
      setAddFriend('');
    } catch (err) {
      setFriendMsg(err.message);
    }
    setTimeout(() => setFriendMsg(''), 3000);
  }

  function copyInvite() {
    navigator.clipboard.writeText(`Join me on GreenRoute and earn climate points! Use my code: ${profile?.username}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!profile) return <div className="p-8 text-center text-gray-500">Loading…</div>;

  return (
    <div className="max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white p-6 pt-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              {profile.username[0].toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-xl">{profile.username}</p>
              <p className="text-green-100 text-sm">Climate Rider</p>
            </div>
          </div>
          <button onClick={handleLogout} className="text-white/70 hover:text-white">
            <LogOut size={20} />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{profile.climate_points}</p>
            <p className="text-xs text-green-100 mt-1 flex items-center justify-center gap-1"><Leaf size={11} /> Points</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{(profile.co2_saved_kg || 0).toFixed(1)}</p>
            <p className="text-xs text-green-100 mt-1 flex items-center justify-center gap-1"><Wind size={11} /> kg CO₂</p>
          </div>
          <div className="bg-white/10 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{trips.length}</p>
            <p className="text-xs text-green-100 mt-1 flex items-center justify-center gap-1"><MapPin size={11} /> Trips</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Badges */}
        {profile.badges?.length > 0 && (
          <section>
            <h2 className="font-semibold text-gray-800 mb-3">Badges</h2>
            <div className="flex flex-wrap gap-3">
              {profile.badges.map(badge => (
                <div key={badge.id} className="flex flex-col items-center bg-white rounded-xl p-3 shadow-sm border border-gray-100 w-20">
                  <span className="text-2xl">{badge.icon}</span>
                  <span className="text-xs text-gray-600 mt-1 text-center leading-tight">{badge.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Friends */}
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Add Friend</h2>
          <form onSubmit={handleAddFriend} className="flex gap-2">
            <input
              value={addFriend}
              onChange={e => setAddFriend(e.target.value)}
              placeholder="Friend's username"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium">
              <UserPlus size={16} />
            </button>
          </form>
          {friendMsg && <p className="text-sm mt-1 text-gray-600">{friendMsg}</p>}

          <button
            onClick={copyInvite}
            className="mt-3 w-full border border-green-500 text-green-600 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-green-50"
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied!' : 'Copy Invite Link'}
          </button>
        </section>

        {/* Trip history */}
        <section>
          <h2 className="font-semibold text-gray-800 mb-3">Trip History</h2>
          {loading ? (
            <p className="text-gray-400 text-sm">Loading…</p>
          ) : trips.length === 0 ? (
            <p className="text-gray-400 text-sm">No trips yet. Search a route to get started!</p>
          ) : (
            <div className="space-y-2">
              {trips.map(trip => (
                <div key={trip.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800 truncate max-w-[220px]">
                        {trip.origin} → {trip.destination}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {MODE_LABELS[trip.route_type]} · {trip.distance_km} km · {new Date(trip.taken_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      {trip.points_earned > 0 && (
                        <p className="text-green-600 font-semibold text-sm">+{trip.points_earned} pts</p>
                      )}
                      <p className="text-xs text-gray-400">{trip.co2_saved_kg} kg saved</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
