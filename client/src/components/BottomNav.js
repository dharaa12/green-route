import { Link, useLocation } from 'react-router-dom';
import { MapPin, Trophy, ShoppingBag, User } from 'lucide-react';

const tabs = [
  { to: '/', icon: MapPin, label: 'Map' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
  { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-50">
      {tabs.map(({ to, icon: Icon, label }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-1 transition-colors ${
              active ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
