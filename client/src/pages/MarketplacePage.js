import { useState, useEffect } from 'react';
import { ShoppingBag, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';

const CATEGORY_EMOJI = { food: '🍃', grocery: '🛒', transport: '🚲', shopping: '🛍️' };

export default function MarketplacePage() {
  const { authFetch, profile, updatePoints } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    authFetch('/api/marketplace')
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch]);

  async function handleRedeem(item) {
    setRedeeming(item.id);
    try {
      const data = await authFetch('/api/marketplace/redeem', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.id }),
      });
      updatePoints(data.new_total_points, undefined);
      setToast(`Redeemed "${item.name}" at ${item.partner_name}! 🎉`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setRedeeming(null);
      setTimeout(() => setToast(''), 4000);
    }
  }

  const canAfford = item => (profile?.climate_points || 0) >= item.points_cost;

  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="bg-white border-b border-gray-200 p-4 pt-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="text-green-600" size={24} />
            <h1 className="text-xl font-bold text-gray-800">Marketplace</h1>
          </div>
          {profile && (
            <span className="bg-green-100 text-green-700 font-semibold text-sm px-3 py-1 rounded-full">
              {profile.climate_points} pts available
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-1">Redeem your climate points at partner cafes & stores</p>
      </div>

      {toast && (
        <div className="mx-4 mt-4 bg-green-600 text-white px-4 py-3 rounded-xl text-sm font-medium">
          {toast}
        </div>
      )}

      <div className="p-4 grid grid-cols-1 gap-3">
        {loading ? (
          <p className="text-center text-gray-400 py-8">Loading…</p>
        ) : items.map(item => {
          const affordable = canAfford(item);
          return (
            <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{CATEGORY_EMOJI[item.category] || '🌿'}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{item.name}</p>
                      <p className="text-xs text-gray-500">{item.partner_name}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-bold px-2 py-1 rounded-full flex-shrink-0 ${affordable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {item.points_cost} pts
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">{item.description}</p>
                <button
                  onClick={() => handleRedeem(item)}
                  disabled={!affordable || redeeming === item.id}
                  className={`mt-3 w-full py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
                    affordable
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  } disabled:opacity-60`}
                >
                  {redeeming === item.id ? (
                    'Redeeming…'
                  ) : affordable ? (
                    <><Check size={14} /> Redeem</>
                  ) : (
                    'Not enough points'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
