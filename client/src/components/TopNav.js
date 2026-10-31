import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Route, Gift, Trophy, Leaf, Sprout, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

// Laptop navigation. On phones the same links are in the bottom tab bar.
const tabs = [
  { to: '/', icon: Route, label: 'Route' },
  { to: '/marketplace', icon: Gift, label: 'Marketplace' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
];

export default function TopNav() {
  const { pathname } = useLocation();
  const { profile, session, logout } = useApp();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header className="relative z-50 grid h-14 grid-cols-[1fr_auto] items-center border-b border-gray-200 bg-white px-3 shadow-sm sm:px-4 lg:grid-cols-[1fr_auto_1fr]">
      {/* Wordmark */}
      <Link to="/" className="flex items-center gap-2 justify-self-start">
        <div className="flex-shrink-0 rounded-lg bg-green-600 p-1.5 text-white">
          <Leaf size={18} />
        </div>
        <div>
          <p className="text-base font-bold leading-tight text-gray-900">GreenRoute</p>
          <p className="hidden text-[11px] leading-tight text-gray-400 lg:block">Multi-modal · Carbon-aware</p>
        </div>
      </Link>

      {/* Nav tabs (laptop) */}
      <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Account */}
      <div className="flex flex-shrink-0 items-center gap-2 justify-self-end sm:gap-3">
        {session && profile ? (
          <>
            <span className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-green-700">
              <Sprout size={18} className="flex-shrink-0" />
              <span className="leading-none">
                <span className="block text-base font-bold">{profile.climate_points}</span>
                <span className="block text-[10px] font-medium">climate points</span>
              </span>
            </span>
            <Link
              to="/profile"
              aria-label="Profile"
              className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white transition-shadow ${
                pathname === '/profile' ? 'ring-2 ring-green-300 ring-offset-1' : 'hover:ring-2 hover:ring-green-200 hover:ring-offset-1'
              }`}
            >
              {profile.username[0].toUpperCase()}
            </Link>
            {/* On phones, Sign out lives at the bottom of the Profile page. */}
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="hidden flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 lg:block"
            >
              <LogOut size={18} />
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-green-700"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
