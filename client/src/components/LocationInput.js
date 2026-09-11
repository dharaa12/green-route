import { useState, useEffect, useRef } from 'react';
import { MapPin, X } from 'lucide-react';
import { nominatimSearch } from '../utils/geo';

function formatSuggestion(item) {
  const a = item.address || {};
  const primary = item.name || a.amenity || a.shop || a.tourism || a.building ||
    a.railway || a.road;
  const parts = [
    primary,
    a.neighbourhood || a.suburb || a.city_district,
    a.city || a.town || a.village,
    a.state,
  ].filter(Boolean);
  return [...new Set(parts)].join(', ') || item.display_name.split(',').slice(0, 3).join(',');
}

export default function LocationInput({ value, onChange, placeholder, icon: Icon, color }) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Keep in sync when the parent sets a value from outside (e.g. "Use my
  // current location"), not just when it's cleared.
  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (!containerRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val);
    onChange(val); // keep parent in sync while typing

    clearTimeout(debounceRef.current);
    if (!val) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await nominatimSearch(val, 6);
        setSuggestions(results);
        setOpen(results.length > 0);
      } finally {
        setLoading(false);
      }
    }, 300);
  }

  function handleSelect(item) {
    const label = formatSuggestion(item);
    setQuery(label);
    onChange(label, { lat: parseFloat(item.lat), lng: parseFloat(item.lon) });
    setSuggestions([]);
    setOpen(false);
  }

  function handleClear() {
    setQuery('');
    onChange('');
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative flex items-center">
        <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color }}>
          <Icon size={14} />
        </span>
        <input
          value={query}
          onChange={handleChange}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full border border-gray-200 rounded-xl pl-8 pr-8 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 bg-gray-50 focus:bg-white transition-colors"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={13} />
          </button>
        )}
        {loading && !query && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 text-xs">…</span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-[2000] left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
          {suggestions.map((item, i) => {
            const label = formatSuggestion(item);
            const a = item.address || {};
            const sub = [a.city || a.town || a.village, a.state].filter(Boolean).join(', ');
            return (
              <li
                key={item.place_id}
                onMouseDown={() => handleSelect(item)}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-green-50 transition-colors ${i > 0 ? 'border-t border-gray-100' : ''}`}
              >
                <MapPin size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">{label}</p>
                  {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
