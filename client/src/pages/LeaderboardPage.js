import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Crown, Leaf, UserPlus } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { lbs } from '../utils/units';

function Avatar({ name, size = 'md', highlight }) {
  const dims = size === 'lg' ? 'h-14 w-14 text-lg' : 'h-10 w-10 text-sm';
  return (
    <span className={`flex ${dims} items-center justify-center rounded-full font-bold ${
      highlight ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
    }`}>
      {name[0].toUpperCase()}
    </span>
  );
}

function PodiumCard({ entry, isMe }) {
  const first = entry.rank === 1;
  return (
    <div className={`flex flex-col items-center rounded-2xl border p-4 ${
      first ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'
    }`}>
      {first && <Crown size={18} className="mb-1 text-amber-500" />}
      <Avatar name={entry.username} size={first ? 'lg' : 'md'} highlight={first} />
      <p className="mt-2 truncate text-sm font-bold text-gray-900">{entry.username}</p>
      <p className="text-xs text-gray-500">{lbs(entry.co2_saved_kg)} lbs</p>
      <span className={`mt-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        first ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
      }`}>
        #{entry.rank}
      </span>
      {isMe && <span className="mt-1 text-[10px] font-medium text-green-600">you</span>}
    </div>
  );
}

function Row({ entry, isMe, onAdd }) {
  const tint = entry.rank === 1 ? 'bg-amber-50 border-amber-200'
    : entry.rank === 2 ? 'bg-gray-50 border-gray-200'
    : entry.rank === 3 ? 'bg-orange-50 border-orange-200'
    : 'bg-white border-gray-100';
  return (
    <div className={`flex items-center gap-3 rounded-xl border p-3 shadow-sm ${tint}`}>
      <span className="w-7 flex-shrink-0 text-center text-sm font-bold text-gray-400">#{entry.rank}</span>
      <Avatar name={entry.username} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-gray-900">
          {entry.username}{isMe && <span className="ml-1 font-normal text-green-600">(you)</span>}
        </p>
        {entry.badge_icons?.length > 0 && (
          <p className="text-xs leading-none">{entry.badge_icons.slice(0, 4).join(' ')}</p>
        )}
      </div>
      <div className="flex-shrink-0 text-right">
        <p className="text-sm font-bold text-gray-900">{lbs(entry.co2_saved_kg)} lbs</p>
        <p className="flex items-center justify-end gap-0.5 text-xs text-green-600">
          <Leaf size={11} /> {entry.climate_points} pts
        </p>
      </div>
      {!isMe && onAdd && (
        <button
          onClick={() => onAdd(entry.username)}
          title={`Add ${entry.username}`}
          className="flex-shrink-0 rounded-full p-1.5 text-gray-400 hover:bg-green-50 hover:text-green-600"
        >
          <UserPlus size={15} />
        </button>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  const { authFetch, session, profile } = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('global');
  const [data, setData] = useState({ global: [], friends: [] });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');

  useEffect(() => {
    Promise.all([
      authFetch('/api/leaderboard').catch(() => []),
      session ? authFetch('/api/leaderboard/friends').catch(() => []) : Promise.resolve([]),
    ]).then(([global, friends]) => setData({ global, friends })).finally(() => setLoading(false));
  }, [authFetch, session]);

  async function addFriend(username) {
    if (!session) return navigate('/login');
    try {
      await authFetch('/api/friends/add', { method: 'POST', body: JSON.stringify({ username }) });
      setToast(`Added ${username}`);
    } catch (err) {
      setToast(err.message);
    }
    setTimeout(() => setToast(''), 3000);
  }

  const entries = data[tab] || [];
  const podium = tab === 'global' ? entries.slice(0, 3) : [];
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  const mid = Math.ceil(entries.length / 2);
  const columns = [entries.slice(0, mid), entries.slice(mid)];

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10">
      <div className="flex items-center gap-2 pt-8">
        <Trophy size={22} className="text-amber-500" />
        <div>
          <h1 className="text-xl font-bold text-gray-900">Leaderboard</h1>
          <p className="text-sm text-gray-500">Ranked by total CO₂ saved</p>
        </div>
      </div>

      {toast && (
        <div className="mt-4 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white">{toast}</div>
      )}

      {podiumOrder.length === 3 && (
        <div className="mx-auto mt-6 grid max-w-xl grid-cols-3 items-end gap-3">
          {podiumOrder.map(e => (
            <PodiumCard key={e.id} entry={e} isMe={e.id === profile?.id} />
          ))}
        </div>
      )}

      <div className="mx-auto mt-6 flex max-w-md rounded-xl bg-gray-100 p-1">
        {['global', 'friends'].map(t => (
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

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
      ) : tab === 'friends' && !session ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-gray-400">Sign in to see how your friends stack up.</p>
          <button
            onClick={() => navigate('/login')}
            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Sign in
          </button>
        </div>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">
          {tab === 'friends' ? 'Add friends to see their ranking.' : 'No data yet.'}
        </p>
      ) : (
        <div className="mt-4 sm:grid sm:grid-cols-2 sm:gap-x-4">
          {columns.map((col, i) => (
            <div key={i} className="space-y-2">
              {col.map(e => (
                <Row key={e.id} entry={e} isMe={e.id === profile?.id} onAdd={tab === 'global' ? addFriend : null} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
