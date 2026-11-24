import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('apex_token');
    if (!token) {
      setReady(true);
      return undefined;
    }
    let live = true;
    api('/api/auth/me')
      .then((data) => {
        if (live) setUser(data.user);
      })
      .catch(() => localStorage.removeItem('apex_token'))
      .finally(() => {
        if (live) setReady(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      async login(email, password) {
        const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
        localStorage.setItem('apex_token', data.token);
        setUser(data.user);
        return data.user;
      },
      logout() {
        localStorage.removeItem('apex_token');
        setUser(null);
      },
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
