import { Link, useLocation } from 'react-router-dom';
import { Route, Gift, Trophy } from 'lucide-react';
import { useApp } from '../context/AppContext';

const tabs = [
  { to: '/', icon: Route, label: 'Route' },
  { to: '/marketplace', icon: Gift, label: 'Marketplace' },
  { to: '/leaderboard', icon: Trophy, label: 'Leaderboard' },
];

// Phone navigation. On laptops the same links live in the top bar. Hidden
// during a trip so a stray tap can't walk away from it (see Shell).
export default function BottomNav() {
  const { pathname } = useLocation();
  const { hideTabBar } = useApp();
  if (hideTabBar) return null;

  return (
    // z-[1100] keeps it above Leaflet's panes and controls (up to 1000) when the map scrolls under it.
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-[1100] border-t border-gray-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <div className="flex h-16">
        {tabs.map(({ to, icon: Icon, label }) => {
          const active = pathname === to;
          return (
            <Link
              key={to}
              to={to}
              aria-current={active ? 'page' : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-1 text-[11px]"
            >
              <span
                className={`flex h-7 w-14 items-center justify-center rounded-lg transition-colors ${
                  active ? 'bg-green-100 text-green-700' : 'text-gray-500'
                }`}
              >
                <Icon size={20} />
              </span>
              <span className={active ? 'font-semibold text-green-700' : 'font-medium text-gray-500'}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
