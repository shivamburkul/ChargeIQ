
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/endpoints';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('ev_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ev_token');
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem('ev_user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        localStorage.removeItem('ev_token');
        localStorage.removeItem('ev_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email, password) => {
    const res = await authApi.login({ email, password });
    localStorage.setItem('ev_token', res.data.token);
    localStorage.setItem('ev_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const adminLogin = useCallback(async (username, password) => {
    const res = await authApi.adminLogin({ username, password });
    localStorage.setItem('ev_token', res.data.token);
    localStorage.setItem('ev_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const res = await authApi.register(payload);
    localStorage.setItem('ev_token', res.data.token);
    localStorage.setItem('ev_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('ev_token');
    localStorage.removeItem('ev_user');
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    await authApi.deleteAccount();
    localStorage.removeItem('ev_token');
    localStorage.removeItem('ev_user');
    setUser(null);
  }, []);

  const updateUser = useCallback((partial) => {
    setUser((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem('ev_user', JSON.stringify(next));
      return next;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, adminLogin, register, logout, deleteAccount, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

