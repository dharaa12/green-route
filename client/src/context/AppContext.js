import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AppContext = createContext(null);
const API = process.env.REACT_APP_API_URL;

export function AppProvider({ children }) {
  const [session, setSession] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gr_session')); } catch { return null; }
  });
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(!!localStorage.getItem('gr_session'));

  const token = session?.access_token;

  const authFetch = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }, [token]);

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
    localStorage.setItem('gr_session', JSON.stringify(sessionData));
    setSession(sessionData);
    setProfile(profileData);
  }

  function logout() {
    localStorage.removeItem('gr_session');
    setSession(null);
    setProfile(null);
  }

  function updatePoints(newPoints, newCo2) {
    setProfile(p => p ? { ...p, climate_points: newPoints, co2_saved_kg: newCo2 } : p);
  }

  return (
    <AppContext.Provider value={{ session, profile, loading, authFetch, login, logout, updatePoints, fetchProfile }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
