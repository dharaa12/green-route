import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

const AppContext = createContext(null);
const API = process.env.REACT_APP_API_URL;

// The login lives in sessionStorage, so it ends with the tab: a new tab or
// browser opens the site signed out. Earlier versions kept it in localStorage;
// clear that copy so those logins don't linger.
try { localStorage.removeItem('gr_session'); } catch { /* storage unavailable */ }

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('gr_session')); } catch { return null; }
  });
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(!!sessionStorage.getItem('gr_session'));
  // The map page hides the phone tab bar while a trip is under way.
  const [hideTabBar, setHideTabBar] = useState(false);

  const token = session?.access_token;
  const refreshToken = session?.refresh_token;
  const refreshing = useRef(null);

  // Access tokens expire after an hour. Trade the refresh token for a new
  // session; concurrent callers share one request because a refresh token can
  // only be used once.
  const refreshSession = useCallback(() => {
    if (!refreshToken) return Promise.resolve(null);
    if (!refreshing.current) {
      refreshing.current = fetch(`${API}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
        .then(async res => {
          if (!res.ok) {
            // The refresh token itself is dead: stop pretending to be signed in.
            if (res.status === 401) {
              sessionStorage.removeItem('gr_session');
              setSession(null);
              setProfile(null);
            }
            return null;
          }
          const { session: fresh } = await res.json();
          sessionStorage.setItem('gr_session', JSON.stringify(fresh));
          setSession(fresh);
          return fresh;
        })
        .catch(() => null)
        .finally(() => { refreshing.current = null; });
    }
    return refreshing.current;
  }, [refreshToken]);

  const authFetch = useCallback(async (path, options = {}) => {
    const send = bearer => fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
        ...(options.headers || {}),
      },
    });
    let res = await send(token);
    if (res.status === 401 && token) {
      const fresh = await refreshSession();
      if (!fresh) throw new Error('Your session has expired. Please sign in again.');
      res = await send(fresh.access_token);
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, [token, refreshSession]);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    try {
      const data = await authFetch('/api/profile');
      setProfile(data);
    } catch {
      // token may be expired
      logout();
    }
  }, [token, authFetch]);

  useEffect(() => {
    if (token) {
      fetchProfile().finally(() => setLoading(false));
    }
  }, [token, fetchProfile]);

  function login(sessionData, profileData) {
    sessionStorage.setItem('gr_session', JSON.stringify(sessionData));
    setSession(sessionData);
    setProfile(profileData);
  }

  function logout() {
    sessionStorage.removeItem('gr_session');
    setSession(null);
    setProfile(null);
  }

  function updatePoints(newPoints, newCo2) {
    setProfile(p => p ? { ...p, climate_points: newPoints, co2_saved_kg: newCo2 } : p);
  }

  return (
    <AppContext.Provider value={{ session, profile, loading, authFetch, login, logout, updatePoints, fetchProfile, hideTabBar, setHideTabBar }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
