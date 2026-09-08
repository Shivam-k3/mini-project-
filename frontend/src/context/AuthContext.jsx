import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authAPI } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Hydrate the app user from /api/auth/me using the current session token.
  const hydrate = useCallback(async () => {
    const token =
      (isSupabaseConfigured() && (await supabase.auth.getSession())?.data?.session?.access_token) ||
      localStorage.getItem('token');
    if (!token) return null;
    try {
      const { data } = await authAPI.getMe();
      setUser(data);
      return data;
    } catch {
      return null;
    }
  }, []);

  // Bootstrapping.
  useEffect(() => {
    let mounted = true;
    const boot = async () => {
      let hasSession = false;
      if (isSupabaseConfigured()) {
        const { data } = await supabase.auth.getSession();
        hasSession = !!data.session;
      } else if (localStorage.getItem('token')) {
        hasSession = true;
      }

      if (hasSession) {
        const hydrated = await hydrate();
        if (mounted) {
          setUser(hydrated);
          setLoading(false);
        }
      } else if (mounted) {
        setLoading(false);
      }
    };
    boot();

    // Keep client state in sync: clear the app user when the Supabase session ends.
    const { data: sub } = isSupabaseConfigured()
      ? supabase.auth.onAuthStateChange((event) => {
          if (event === 'SIGNED_OUT' && mounted) {
            localStorage.removeItem('token');
            setUser(null);
          }
        })
      : { data: {} };

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (emailOrUserId, password) => {
    const { data } = await authAPI.login({ emailOrUserId, password });
    const appUser = { ...data };
    delete appUser.session;
    delete appUser.refresh_token;

    // Bootstrap the browser Supabase client with the server-issued session so
    // client-side auth state, token refresh, and signOut all stay consistent.
    if (data.session?.access_token && data.session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    } else {
      localStorage.setItem('token', data.token);
    }
    setUser(appUser);
    return appUser;
  };

  const register = async (name, email, password) => {
    const { data } = await authAPI.register({ name, email, password });
    const appUser = { ...data };
    delete appUser.session;
    delete appUser.refresh_token;

    if (data.session?.access_token && data.session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });
    } else {
      localStorage.setItem('token', data.token);
    }
    setUser(appUser);
    return appUser;
  };

  const logout = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut().catch(() => {});
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (data) => setUser((prev) => ({ ...prev, ...data }));

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
