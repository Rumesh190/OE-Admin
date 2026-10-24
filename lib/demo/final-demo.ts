"use client";

/** Launcher metadata for presentation only. Canonical memberships/commands grant all authority. */
export const FINAL_DEMO_KEY = "ops-final-role-demo-v1";
export const FINAL_DEMO_ROLES = ["Platform Super Admin", "Client Administrator", "Factory Administrator", "Zone Champion", "Zone Leader", "Department Leader", "Department Member", "Standard User"] as const;
export interface FinalDemoManifest {
  version: 1;
  isolated: true;
  organizationId: string;
  plantId: string;
  personas: Array<{ personId: string; name: string; role: typeof FINAL_DEMO_ROLES[number]; organizationId?: string; plantId?: string }>;
}
export function getFinalDemoManifest(): FinalDemoManifest | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(FINAL_DEMO_KEY) ?? "null") as FinalDemoManifest | null;
    if (!value || value.version !== 1 || value.isolated !== true || !value.organizationId || !value.plantId || value.personas?.length < 11 || new Set(value.personas.map(p => p.personId)).size !== value.personas.length || value.personas.some(p => !p.personId || !p.name || !(FINAL_DEMO_ROLES as readonly string[]).includes(p.role))) return null;
    if (value.personas.filter(p => p.role === "Platform Super Admin").length !== 1 || value.personas.filter(p => p.role === "Client Administrator").length < 4) return null;
    const administration = JSON.parse(window.localStorage.getItem("ops-access-v3-administration-v1") ?? "null");
    if (!value.personas.filter(p => p.role === "Client Administrator").every(p => p.organizationId === "abc-manufacturing" || (p.organizationId && administration?.clients?.some((c: { id: string }) => c.id === p.organizationId)))) return null;
    return value;
  } catch { return null; }
}
