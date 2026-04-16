import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, formatApiError, setAccessToken, clearAccessToken } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // Try to restore token from localStorage
    const savedToken = localStorage.getItem("fleetlock_token");
    if (savedToken) {
      setAccessToken(savedToken);
      try {
        const { data } = await authApi.me();
        setUser(data);
      } catch {
        localStorage.removeItem("fleetlock_token");
        clearAccessToken();
        setUser(false);
      }
    } else {
      setUser(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const { data } = await authApi.login({ email, password });
      if (data.access_token) {
        setAccessToken(data.access_token);
        localStorage.setItem("fleetlock_token", data.access_token);
      }
      setUser(data.user || data);
      return { success: true, data: data.user || data };
    } catch (e) {
      return { success: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (formData) => {
    try {
      const { data } = await authApi.register(formData);
      if (data.access_token) {
        setAccessToken(data.access_token);
        localStorage.setItem("fleetlock_token", data.access_token);
      }
      setUser(data.user || data);
      return { success: true, data: data.user || data };
    } catch (e) {
      return { success: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAccessToken();
    localStorage.removeItem("fleetlock_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
