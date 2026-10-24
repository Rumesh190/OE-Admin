"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { AuthLoginScreen } from "./login-screen";
import { useAuth } from "./auth-provider";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { authenticated, authReady, initializationError, demoNotice } = useAuth();
  if (!authReady) return <div className="min-h-screen bg-muted/35 dark:bg-background" aria-label="Loading OPS" />;
  if (initializationError) return <main className="grid min-h-screen place-items-center p-6"><section className="max-w-xl"><h1 className="text-xl font-semibold">Workspace initialization unavailable</h1><p role="alert" className="mt-3 text-sm">{initializationError}</p><Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>Retry initialization</Button></section></main>;
  return authenticated ? <>{demoNotice && <p role="status" className="border-b bg-amber-50 p-3 text-sm text-amber-950">{demoNotice}</p>}{children}</> : <AuthLoginScreen />;
}
