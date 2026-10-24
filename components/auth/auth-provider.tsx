"use client";

import * as React from "react";
import { bootstrapApprovedDemo } from "@/lib/demo/approved-demo-bootstrap";
import { requestDemoAccess } from "@/lib/demo/demo-access";
import { initializeCurrentAccessContext } from "@/features/five-s/administration/access-v4-context";
import { hasAuthenticatedDemoSession } from "@/lib/demo-session";
import { safeSetStorage, safeSetStorageString } from "@/lib/browser-storage";

const AUTH_KEY = "5s-auth-session";
const DEMO_PASSWORD_KEY = "ops-demo-password-v1";
interface DemoAuthSession { authenticated: true; username: "admin"; version: 1 }
interface PasswordChangeResult { success: boolean; message?: string }
interface AuthContextValue { authenticated: boolean; authReady: boolean; demoEnabled: boolean; initializationError: string; demoNotice: string; login: (username: string, password: string) => Promise<boolean>; logout: () => void; changePassword: (currentPassword: string, newPassword: string) => Promise<PasswordChangeResult> }
const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = React.useState(false); const [authReady, setAuthReady] = React.useState(false);
  const [demoEnabled, setDemoEnabled] = React.useState(false);
  const [initializationError, setInitializationError] = React.useState("");
  const [demoNotice, setDemoNotice] = React.useState("");
  React.useEffect(() => {
    let cancelled = false;
    async function initialize() {
      try {
        const enabled = await requestDemoAccess();
        const signedIn = hasAuthenticatedDemoSession();
        if (signedIn && enabled) {
          const result = await bootstrapApprovedDemo();
          if (!cancelled) setDemoNotice(result.notice);
        } else if (signedIn) {
          try { initializeCurrentAccessContext(); } catch { /* Existing access boundary reports invalid saved scope. */ }
        }
        if (!cancelled) { setDemoEnabled(enabled); setAuthenticated(signedIn); }
      } catch (error) {
        if (!cancelled) setInitializationError(error instanceof Error ? error.message : "Unable to initialize the workspace.");
      } finally { if (!cancelled) setAuthReady(true); }
    }
    void initialize();
    return () => { cancelled = true; };
  }, []);
  const login = React.useCallback(async (username: string, password: string) => {
    await new Promise(resolve => window.setTimeout(resolve, 280));
    const expectedPassword = window.localStorage.getItem(DEMO_PASSWORD_KEY) ?? "admin";
    if (username !== "admin" || password !== expectedPassword) return false;
    const result = safeSetStorage(AUTH_KEY, { authenticated: true, username: "admin", version: 1 } satisfies DemoAuthSession);
    if (!result.success) return false;
    try {
      if (demoEnabled) { const result = await bootstrapApprovedDemo(); setDemoNotice(result.notice); }
      else { try { initializeCurrentAccessContext(); } catch { /* Access boundary reports the preserved invalid scope. */ } }
      setAuthenticated(true);
    } catch (error) {
      setInitializationError(error instanceof Error ? error.message : "Unable to initialize the workspace.");
      return false;
    }
    return true;
  }, [demoEnabled]);
  const logout = React.useCallback(() => { localStorage.removeItem(AUTH_KEY); setAuthenticated(false); }, []);
  const changePassword = React.useCallback(async (currentPassword: string, newPassword: string): Promise<PasswordChangeResult> => {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    const expectedPassword = window.localStorage.getItem(DEMO_PASSWORD_KEY) ?? "admin";
    if (currentPassword !== expectedPassword) return { success: false, message: "Current password is incorrect." };
    const result = safeSetStorageString(DEMO_PASSWORD_KEY, newPassword);
    return result.success ? { success: true } : { success: false, message: result.message };
  }, []);
  const value = React.useMemo(() => ({ authenticated, authReady, demoEnabled, initializationError, demoNotice, login, logout, changePassword }), [authenticated, authReady, demoEnabled, initializationError, demoNotice, login, logout, changePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = React.useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
