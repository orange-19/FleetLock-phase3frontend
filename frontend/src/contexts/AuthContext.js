import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { authApi, formatApiError } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const { data } = await authApi.me();
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const { data } = await authApi.login({ email, password });
      setUser(data);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const register = async (formData) => {
    try {
      const { data } = await authApi.register(formData);
      setUser(data);
      return { success: true, data };
    } catch (e) {
      return { success: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch { /* ignore */ }
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
