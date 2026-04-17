import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  authApi,
  workerApi,
  formatApiError,
  setAccessToken,
  clearAccessToken,
  TOKEN_STORAGE_KEY,
} from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kycVerified, setKycVerified] = useState(null);

  const refreshKycStatus = useCallback(async () => {
    if (!user || user === false || user.role !== "worker") {
      setKycVerified(true);
      return { verified: true };
    }

    try {
      await workerApi.kycStatus();
      setKycVerified(true);
      return { verified: true };
    } catch (e) {
      if (e?.response?.status === 404) {
        setKycVerified(false);
        return { verified: false };
      }

      // On transient failures, keep worker in KYC-required state for safety.
      setKycVerified(false);
      return { verified: false, error: formatApiError(e) };
    }
  }, [user]);

  const checkAuth = useCallback(async () => {
    // Try to restore token from localStorage
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (savedToken) {
      setAccessToken(savedToken);
      try {
        const { data } = await authApi.me();
        setUser(data);
        if (data?.role === "worker") {
          try {
            await workerApi.kycStatus();
            setKycVerified(true);
          } catch (e) {
            setKycVerified(e?.response?.status === 404 ? false : false);
          }
        } else {
          setKycVerified(true);
        }
      } catch {
        clearAccessToken();
        setUser(false);
        setKycVerified(false);
      }
    } else {
      setUser(false);
      setKycVerified(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const login = async (email, password) => {
    try {
      const { data } = await authApi.login({ email, password });
      if (data.access_token) {
        setAccessToken(data.access_token);
      }
      const userData = data.user || data;
      setUser(userData);

      let requiresKyc = false;
      if (userData?.role === "worker") {
        try {
          await workerApi.kycStatus();
          setKycVerified(true);
        } catch (e) {
          requiresKyc = true;
          setKycVerified(false);
        }
      } else {
        setKycVerified(true);
      }

      return { success: true, data: userData, requiresKyc };
    } catch (e) {
      return { success: false, error: formatApiError(e) || e.message };
    }
  };

  const register = async (formData) => {
    try {
      const { data } = await authApi.register(formData);
      if (data.access_token) {
        setAccessToken(data.access_token);
      }
      const userData = data.user || data;
      setUser(userData);

      let requiresKyc = false;
      if (userData?.role === "worker") {
        try {
          await workerApi.kycStatus();
          setKycVerified(true);
        } catch (e) {
          requiresKyc = true;
          setKycVerified(false);
        }
      } else {
        setKycVerified(true);
      }

      return { success: true, data: userData, requiresKyc };
    } catch (e) {
      return { success: false, error: formatApiError(e) || e.message };
    }
  };

  const logout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    clearAccessToken();
    setUser(false);
    setKycVerified(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        checkAuth,
        kycVerified,
        refreshKycStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
