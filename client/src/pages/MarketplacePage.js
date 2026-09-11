import { useState, useEffect, useMemo } from 'react';
import { ShoppingBag, Leaf, Check, List, Map as MapIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import PartnerMap from '../components/PartnerMap';

const CATEGORIES = ['all', 'food', 'transit', 'retail', 'wellness'];

function initials(name) {
  const w = name.trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[1][0] : name.slice(0, 2)).toUpperCase();
}

function ItemCard({ item, affordable, redeeming, onRedeem }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: item.color || '#22c55e' }}>
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-sm font-bold text-white">
          {initials(item.partner_name)}
        </span>
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-semibold capitalize text-white">
          {item.category}
        </span>
      </div>
      <div className="p-4">
        <p className="text-xs text-gray-500">{item.partner_name}</p>
        <p className="font-bold text-gray-900">{item.name}</p>
        <p className="mt-1 text-sm text-gray-600">{item.description}</p>
        <p className="mt-2 flex items-center gap-1 text-sm">
          <Leaf size={13} className="text-green-600" />
          <span className="font-semibold text-green-700">{item.points_cost} pts</span>
          {item.value_usd && <span className="text-gray-400"> · worth {item.value_usd}</span>}
        </p>
        <button
          onClick={() => onRedeem(item)}
          disabled={!affordable || redeeming}
          className={`mt-3 w-full rounded-xl py-2 text-sm font-semibold transition-colors ${
            affordable ? 'bg-green-600 text-white hover:bg-green-700' : 'cursor-not-allowed bg-gray-100 text-gray-400'
          } disabled:opacity-60`}
        >
          {redeeming ? 'Redeeming…' : affordable ? (
            <span className="flex items-center justify-center gap-1.5"><Check size={14} /> Redeem</span>
          ) : 'Not enough points'}
        </button>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  const { authFetch, profile, updatePoints } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('all');
  const [redeeming, setRedeeming] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    authFetch('/api/marketplace').then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, [authFetch]);

  async function handleRedeem(item) {
    setRedeeming(item.id);
    try {
      const data = await authFetch('/api/marketplace/redeem', {
        method: 'POST',
        body: JSON.stringify({ item_id: item.id }),
      });
      updatePoints(data.new_total_points, undefined);
      setToast(`Redeemed "${item.name}" at ${item.partner_name}`);
    } catch (err) {
      setToast(err.message);
    } finally {
      setRedeeming(null);
      setTimeout(() => setToast(''), 4000);
    }
  }

  const shown = useMemo(
    () => (cat === 'all' ? items : items.filter(i => i.category === cat)),
    [items, cat],
  );
  const points = profile?.climate_points || 0;

  const hasMap = shown.some(i => Number.isFinite(i.lat));
  const [mobileView, setMobileView] = useState('list');

  return (
    <div className="mx-auto max-w-7xl px-4 pb-6">
      <div className="flex items-center justify-between pt-5">
        <div className="flex items-center gap-2">
          <ShoppingBag size={22} className="text-green-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Marketplace</h1>
            <p className="text-sm text-gray-500">Spend climate points at NYC partners</p>
          </div>
        </div>
        <span className="flex flex-shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
          <Leaf size={13} /> {points} pts
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize transition-colors ${
              cat === c ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {toast && (
        <div className="mt-3 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white">{toast}</div>
      )}

      {hasMap && (
        <div className="mt-3 flex rounded-xl bg-gray-100 p-1 lg:hidden">
          {[['list', List, 'List'], ['map', MapIcon, 'Map']].map(([v, Icon, label]) => (
            <button
              key={v}
              onClick={() => setMobileView(v)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors ${
                mobileView === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 lg:flex lg:items-start lg:gap-5">
        <div
          className={`space-y-3 lg:block lg:w-[380px] lg:flex-shrink-0 lg:overflow-y-auto lg:pr-1 ${
            mobileView === 'map' ? 'hidden' : ''
          }`}
          style={{ maxHeight: 'calc(100vh - 150px)' }}
        >
          {loading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Nothing in this category yet.</p>
          ) : (
            shown.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                affordable={points >= item.points_cost}
                redeeming={redeeming === item.id}
                onRedeem={handleRedeem}
              />
            ))
          )}
        </div>

        {hasMap && (
          <div
            className={`mt-4 overflow-hidden rounded-2xl border border-gray-200 lg:sticky lg:top-[68px] lg:mt-0 lg:block lg:flex-1 ${
              mobileView === 'map' ? 'block' : 'hidden'
            }`}
            style={{ height: 'calc(100vh - 150px)' }}
          >
            <PartnerMap items={shown} />
          </div>
        )}
      </div>
    </div>
  );
}
