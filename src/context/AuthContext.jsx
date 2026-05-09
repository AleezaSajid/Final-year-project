import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api/client.js";

const AuthContext = createContext(null);
const CURRENT_USER_KEY = "currentUser";

function readStoredUser() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.email || !parsed.id) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeStoredUser(user) {
  if (typeof window === "undefined") return;
  try {
    if (!user) {
      localStorage.removeItem(CURRENT_USER_KEY);
      return;
    }
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    // Fallback-only: show stored user while we verify with backend.
    const stored = readStoredUser();
    if (stored) setUser(stored);
    setLoading(true);
    try {
      const data = await api("/api/auth/me");
      setUser(data.user);
      writeStoredUser(data.user);
    } catch (e) {
      // Backend is final authority: if session invalid, clear any fake persistence.
      setUser(null);
      writeStoredUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  /** JWT is issued by the server in an HTTP-only cookie; credentials: include sends it on /api/* */
  const login = useCallback(async (email, password) => {
    const data = await api("/api/login", {
      method: "POST",
      json: { email: String(email || "").trim().toLowerCase(), password },
    });
    setUser(data.user);
    writeStoredUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (payload) => {
    const isFormData = typeof FormData !== "undefined" && payload instanceof FormData;
    const data = await api("/api/register", {
      method: "POST",
      ...(isFormData ? { body: payload } : { json: payload }),
    });
    if (data && data.needsVerification) {
      return data;
    }
    setUser(data.user);
    writeStoredUser(data.user);
    return data;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/logout", { method: "POST" });
    } catch {
      // ignore network errors; clear local state regardless
    }
    setUser(null);
    writeStoredUser(null);
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
