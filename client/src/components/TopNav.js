import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Map, ShoppingBag, Trophy, Leaf, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';

const tabs = [
  { to: '/', icon: Map, label: 'Routes' },
  { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
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
    <header className="bg-white border-b border-gray-200 flex items-center px-3 sm:px-4 h-14 z-50 relative shadow-sm">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-2 mr-2 sm:mr-6 flex-shrink-0">
        <div className="bg-green-600 text-white rounded-lg p-1.5">
          <Leaf size={18} />
        </div>
        <div className="hidden sm:block">
          <p className="font-bold text-gray-900 text-sm leading-tight">GreenRoute</p>
          <p className="text-gray-400 text-xs leading-tight">Multi-modal · Carbon-aware</p>
        </div>
      </Link>

      {/* Nav tabs */}
      <nav className="flex items-center gap-0.5 sm:gap-1 flex-1">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-label={label}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={16} />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Auth */}
      <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
        {session && profile ? (
          <>
            <span className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
              <Leaf size={11} /> {profile.climate_points}<span className="hidden sm:inline">&nbsp;pts</span>
            </span>
            <Link
              to="/profile"
              aria-label="Profile"
              className={`w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 transition-shadow ${
                pathname === '/profile' ? 'ring-2 ring-green-300 ring-offset-1' : 'hover:ring-2 hover:ring-green-200 hover:ring-offset-1'
              }`}
            >
              {profile.username[0].toUpperCase()}
            </Link>
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="text-gray-400 hover:text-gray-600 hover:bg-gray-50 flex-shrink-0 p-1.5 rounded-lg transition-colors"
            >
              <LogOut size={16} />
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="text-sm font-medium bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              Register
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
