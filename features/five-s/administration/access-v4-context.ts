"use client";
import { useSyncExternalStore } from "react";
import { readAdministrationPayload } from "@/lib/administration-storage";
import { getAdminUsers } from "./store";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { getOrganizations } from "@/lib/organizations";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
import { getAccessV3State } from "./access-v3-state";
import { getAccessV4State } from "./access-v4-state";
import { resolveFactoryPerson } from "./factory-authorization";
export const ACCESS_CONTEXT_KEY = "ops-active-access-context-v1";
export type AccessContext = { version: 1; personId: string; selectionId: string } & (
  { kind: "platform"; organizationId?: never; plantId?: never } |
  { kind: "client"; organizationId: string; plantId?: never } |
  { kind: "factory"; organizationId: string; plantId: string }
);
export function validateAccessContext(c: AccessContext): AccessContext {
  if (!c || typeof c.personId !== "string" || typeof c.selectionId !== "string") throw new Error("Invalid access context. Select an authorized scope.");
  const actor = getAuthenticatedDemoActor(c.personId);
  const rawPeople = readAdministrationPayload("five-s-administration-users-v1");
  const directory = rawPeople ? JSON.parse(rawPeople) as ReturnType<typeof getAdminUsers> : getAdminUsers();
  if (!Array.isArray(directory) || (directory.filter(p => p.id === c.personId).length !== 1 || directory.find(p => p.id === c.personId)?.status !== "Active")) throw new Error("Context identity is inactive or ambiguous.");
  if (!actor || c.version !== 1 || !c.selectionId) throw new Error("Select an active access context for the current identity.");
  if (c.kind === "platform") {
    if (!actor.identity.isSuperAdmin || actor.user.id !== "USR-OPS-SUPER-ADMIN" || c.organizationId !== undefined || c.plantId !== undefined) throw new Error("Platform context requires Metric Mind Super Admin.");
    return c;
  }
  const clients = getOrganizations().filter(o => o.id === c.organizationId && o.status === "Active");
  if (clients.length !== 1) throw new Error("Client context is inactive or ambiguous.");
  const memberships = getAccessV3State().clientMemberships.filter(m => m.userId === c.personId && m.organizationId === c.organizationId);
  if (c.kind === "client") {
    const sa = actor.identity.isSuperAdmin && actor.user.id === "USR-OPS-SUPER-ADMIN";
    if (c.plantId !== undefined || (!sa && !(memberships.length === 1 && memberships[0].status === "Active" && memberships[0].clientAdmin))) throw new Error("An explicit Client Admin assignment is required.");
    return c;
  }
  if (c.kind !== "factory") throw new Error("Active client membership is required for factory context.");
  const plant = getAllOrganizationConfiguration().plants.find(p => p.id === c.plantId && (p.organizationId ?? "abc-manufacturing") === c.organizationId && p.status === "Active");
  if (actor.identity.isSuperAdmin && actor.user.id === "USR-OPS-SUPER-ADMIN") {
    if (!plant) throw new Error("Select an active factory owned by this client.");
    return c;
  }
  if (memberships.length !== 1 || memberships[0].status !== "Active") throw new Error("Active client membership is required for factory context.");
  const p = resolveFactoryPerson(c.personId, c);
  if (!p.valid || (!p.clientAdmin && !p.factoryAdmin && !p.membership)) throw new Error("An explicit client or factory administration assignment is required.");
  return c;
}
export function getActiveAccessContext(): AccessContext | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ACCESS_CONTEXT_KEY);
  if (!raw) return null;
  return validateAccessContext(JSON.parse(raw));
}
/** Restore only an unambiguous scope for the already authenticated identity. Never change people or repair saved selections. */
export function initializeCurrentAccessContext() {
  const selected = getActiveAccessContext(); // Invalid saved selections fail closed and remain intact.
  if (selected) return selected;
  const options = authorizedContextOptions();
  const administrative = options.filter(option => option.kind === "platform" || option.kind === "client");
  const factories = options.filter(option => option.kind === "factory");
  const initial = administrative.length === 1 ? administrative[0] : administrative.length === 0 && factories.length === 1 ? factories[0] : null;
  if (!initial) return null;
  selectAccessContext(initial);
  return getActiveAccessContext();
}
export function requireAccessContext(expectedSelectionId: string, scope: { organizationId: string; plantId?: string }, kind: AccessContext["kind"]) {
  const c = getActiveAccessContext();
  if (!c || c.selectionId !== expectedSelectionId || c.kind !== kind || (kind !== "platform" && (c.organizationId !== scope.organizationId || (kind === "factory" && c.plantId !== scope.plantId)))) throw new Error("Access context changed or does not match this operation. Reopen the form.");
  return c;
}
export function authorizedContextOptions(): AccessContext[] {
  const a = getAuthenticatedDemoActor();
  if (!a) return [];
  const options: AccessContext[] = [];
  const base = { version: 1 as const, personId: a.user.id, selectionId: "candidate" };
  if (a.identity.isSuperAdmin && a.user.id === "USR-OPS-SUPER-ADMIN") options.push({ ...base, kind: "platform" });
  for (const o of getOrganizations()) {
    try { options.push(validateAccessContext({ ...base, kind: "client", organizationId: o.id })); } catch { /* Not authorized. */ }
    for (const p of getAllOrganizationConfiguration().plants.filter(p => (p.organizationId ?? "abc-manufacturing") === o.id)) {
      try { options.push(validateAccessContext({ ...base, kind: "factory", organizationId: o.id, plantId: p.id })); } catch { /* Not authorized. */ }
    }
  }
  return options;
}
export function selectAccessContext(c: AccessContext, notify = true) {
  const next = validateAccessContext({ ...c, selectionId: crypto.randomUUID() });
  window.localStorage.setItem(ACCESS_CONTEXT_KEY, JSON.stringify(next));
  if (notify) notifyAccessContextChanged();
}
export function notifyAccessContextChanged() { window.dispatchEvent(new Event("ops-access-context-changed")); }
function subscribe(l: () => void) {
  window.addEventListener("storage", l); window.addEventListener("ops-access-context-changed", l);
  return () => { window.removeEventListener("storage", l); window.removeEventListener("ops-access-context-changed", l); };
}
function rawSnapshot() {
  if (typeof window === "undefined") return null;
  return JSON.stringify([ACCESS_CONTEXT_KEY, "ops-access-v3-administration-v1", "ops-access-v4-administration-v1", "five-s-administration-users-v1", "ops-organization-configuration-v1", "ops-access-v3-pending-transaction-v1", "5s-auth-session", "five-s-demo-role", "ops-administration-demo-person-v1"].map(k => window.localStorage.getItem(k)));
}
export function useAccessContext() {
  const raw = useSyncExternalStore(subscribe, rawSnapshot, () => null);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  try {
    const selected = raw ? (JSON.parse(raw) as (string | null)[])[0] : null;
    return { ready, context: selected ? validateAccessContext(JSON.parse(selected)) : null, error: "" };
  } catch (e) { return { ready, context: null, error: e instanceof Error ? e.message : "Invalid context" }; }
}
/** DL authority is independent, active and constrained to an exact Department. */
export function isDepartmentLeader(personId: string, departmentId: string, organizationId: string, plantId: string) {
  const p = resolveFactoryPerson(personId, { organizationId, plantId });
  const s = getAccessV4State();
  const d = s.departments.find(d => d.id === departmentId && d.organizationId === organizationId && d.plantId === plantId && d.status === "Active");
  return Boolean(p.valid && p.membership && d && s.assignments.some(a => a.role === "Department Leader" && a.personId === personId && a.status === "Active" && a.departmentId === d.id && a.zoneId === d.zoneId && a.organizationId === organizationId && a.plantId === plantId));
}

/** Compatibility scope only; callers must validate the context and actual subject first. */
export function isLegacyABCOperationalContext(context: AccessContext | null) {
  return context === null || (context.kind === "factory" && context.organizationId === "abc-manufacturing" && context.plantId === "PLANT-EGM");
}
