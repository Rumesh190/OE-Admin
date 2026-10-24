"use client";

import * as React from "react";
import { initializeCurrentAccessContext } from "@/features/five-s/administration/access-v4-context";
import { hasAuthenticatedDemoSession } from "@/lib/demo-session";
import { safeSetStorage, safeSetStorageString } from "@/lib/browser-storage";

const AUTH_KEY = "5s-auth-session";
const DEMO_PASSWORD_KEY = "ops-demo-password-v1";
interface DemoAuthSession { authenticated: true; username: "admin"; version: 1 }
interface PasswordChangeResult { success: boolean; message?: string }
interface AuthContextValue { authenticated: boolean; authReady: boolean; login: (username: string, password: string) => Promise<boolean>; logout: () => void; changePassword: (currentPassword: string, newPassword: string) => Promise<PasswordChangeResult> }
const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = React.useState(false); const [authReady, setAuthReady] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    const isAuthenticated = hasAuthenticatedDemoSession();
    if (isAuthenticated) {
      try { initializeCurrentAccessContext(); }
      catch { /* Preserve invalid/unsupported data; the access boundary displays its error. */ }
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setAuthenticated(isAuthenticated);
      setAuthReady(true);
    });
    return () => { cancelled = true; };
  }, []);
  const login = React.useCallback(async (username: string, password: string) => { await new Promise((resolve) => window.setTimeout(resolve, 280)); const expectedPassword = window.localStorage.getItem(DEMO_PASSWORD_KEY) ?? "admin"; if (username !== "admin" || password !== expectedPassword) return false; const result = safeSetStorage(AUTH_KEY, { authenticated: true, username: "admin", version: 1 } satisfies DemoAuthSession); if (!result.success) return false; try { initializeCurrentAccessContext(); } catch { /* Access boundary reports the preserved invalid scope. */ } setAuthenticated(true); return true; }, []);
  const logout = React.useCallback(() => { localStorage.removeItem(AUTH_KEY); setAuthenticated(false); }, []);
  const changePassword = React.useCallback(async (currentPassword: string, newPassword: string): Promise<PasswordChangeResult> => {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const expectedPassword = window.localStorage.getItem(DEMO_PASSWORD_KEY) ?? "admin";
    if (currentPassword !== expectedPassword) return { success: false, message: "Current password is incorrect." };
    const result = safeSetStorageString(DEMO_PASSWORD_KEY, newPassword);
    return result.success ? { success: true } : { success: false, message: result.message };
  }, []);
  const value = React.useMemo(() => ({ authenticated, authReady, login, logout, changePassword }), [authenticated, authReady, login, logout, changePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = React.useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
