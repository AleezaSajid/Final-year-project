import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await api("/api/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  /** JWT is issued by the server in an HTTP-only cookie; credentials: include sends it on /api/* */
  const login = useCallback(async (email, password) => {
    const data = await api("/api/login", { method: "POST", json: { email, password } });
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const data = await api("/api/register", { method: "POST", json: payload });
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    await api("/api/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, refreshUser, login, register, logout }),
    [user, loading, refreshUser, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
