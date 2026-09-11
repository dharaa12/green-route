import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import TopNav from './components/TopNav';
import ProfilePage from './pages/ProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// MapLibre GL is a large dependency — split into its own chunk so it's
// only fetched when a route that actually renders a map is visited.
const MapPage = lazy(() => import('./pages/MapPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));

function PageLoading() {
  return (
    <div className="flex items-center justify-center py-24 text-sm text-gray-400">
      Loading…
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <>
              <TopNav />
              <Suspense fallback={<PageLoading />}>
                <MapPage />
              </Suspense>
            </>
          }
        />
        <Route path="/profile" element={<><TopNav /><ProfilePage /></>} />
        <Route path="/leaderboard" element={<><TopNav /><LeaderboardPage /></>} />
        <Route
          path="/marketplace"
          element={
            <>
              <TopNav />
              <Suspense fallback={<PageLoading />}>
                <MarketplacePage />
              </Suspense>
            </>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProvider>
  );
}
