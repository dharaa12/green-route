import { useState, useEffect } from 'react';
import { Trophy } from 'lucide-react';
import { useApp } from '../context/AppContext';

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' };

function Row({ entry, isMe }) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-green-50 border-2 border-green-400' : 'bg-white border border-gray-100'} shadow-sm`}>
      <span className="w-8 text-center text-lg font-bold text-gray-500">
        {MEDAL[entry.rank] || `#${entry.rank}`}
      </span>
      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold text-sm flex-shrink-0">
        {entry.username[0].toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">
          {entry.username} {isMe && <span className="text-green-600 font-normal">(you)</span>}
        </p>
        <p className="text-xs text-gray-500">{(entry.co2_saved_kg || 0).toFixed(1)} kg CO₂ saved</p>
      </div>
      <div className="text-right">
        <p className="font-bold text-green-600">{entry.climate_points}</p>
        <p className="text-xs text-gray-400">pts</p>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const { authFetch, profile } = useApp();
  const [tab, setTab] = useState('global');
  const [data, setData] = useState({ global: [], friends: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch('/api/leaderboard'),
      authFetch('/api/leaderboard/friends'),
    ]).then(([global, friends]) => {
      setData({ global, friends });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [authFetch]);

  const entries = data[tab];

  return (
    <div className="max-w-lg mx-auto pb-8">
      <div className="bg-white border-b border-gray-200 p-4 pt-10">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="text-yellow-500" size={24} />
          <h1 className="text-xl font-bold text-gray-800">Leaderboard</h1>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {['global', 'friends'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-2">
        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-center text-gray-400 py-8">
            {tab === 'friends' ? 'Add friends to see their ranking!' : 'No data yet.'}
          </p>
        ) : (
          entries.map(entry => (
            <Row key={entry.id} entry={entry} isMe={entry.id === profile?.id} />
          ))
        )}
      </div>
    </div>
  );
}
