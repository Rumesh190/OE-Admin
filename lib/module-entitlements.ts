"use client";

import { useSyncExternalStore } from "react";
import { getActiveAccessContext, useAccessContext } from "@/features/five-s/administration/access-v4-context";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { isActivePlatformSuperAdmin } from "@/features/settings/audit-configuration-permissions";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
import { safeSetStorage } from "@/lib/browser-storage";
import { DEFAULT_MODULE_ENTITLEMENTS, OPERATIONAL_MODULES, type AccessCapabilityId } from "@/lib/modules";
import { DEMO_ORGANIZATION, ORGANIZATIONS, getOrganizations } from "@/lib/organizations";
export { DEMO_ORGANIZATION, ORGANIZATIONS, type Organization } from "@/lib/organizations";

export type OrganizationAccess = Record<AccessCapabilityId, boolean>;
export interface FactoryAccessState { version: 2; factories: Record<string, OrganizationAccess> }

export const DENIED_ORGANIZATION_ACCESS: OrganizationAccess = Object.fromEntries(Object.keys(DEFAULT_MODULE_ENTITLEMENTS).map(key => [key, false])) as OrganizationAccess;
export const NEW_FACTORY_ACCESS: OrganizationAccess = { ...DENIED_ORGANIZATION_ACCESS, actions: true };
export const FACTORY_MODULE_ACCESS_KEY = "ops-organization-modules-v1";

const DEFAULT_STATE: FactoryAccessState = { version: 2, factories: {} };
let state = DEFAULT_STATE;
let loaded = false;
let lastPayload: string | null | undefined;
const listeners = new Set<() => void>();

function complete(value: unknown, fallback: OrganizationAccess): OrganizationAccess {
  if (!value || typeof value !== "object") return { ...fallback };
  const input = value as Record<string, unknown>;
  return Object.fromEntries(Object.keys(DEFAULT_MODULE_ENTITLEMENTS).map(key => [key, typeof input[key] === "boolean" ? input[key] : fallback[key as AccessCapabilityId]])) as OrganizationAccess;
}

/** One-way projection of legacy client settings. Explicit v2 factory records always win. */
export function normalizeFactoryAccess(value: unknown): FactoryAccessState {
  if (value && typeof value === "object" && !Array.isArray(value) && (value as { version?: unknown }).version === 2) {
    const factories = (value as { factories?: unknown }).factories;
    if (!factories || typeof factories !== "object" || Array.isArray(factories)) return DEFAULT_STATE;
    const normalized = Object.fromEntries(Object.entries(factories as Record<string, unknown>).map(([plantId, access]) => [plantId, complete(access, NEW_FACTORY_ACCESS)]));
    for (const plant of getAllOrganizationConfiguration().plants) normalized[plant.id] ??= { ...NEW_FACTORY_ACCESS };
    return { version: 2, factories: normalized };
  }
  const parsed = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const singleOrganization = Object.keys(DEFAULT_MODULE_ENTITLEMENTS).some(key => typeof parsed[key] === "boolean");
  const legacy: Record<string, unknown> = singleOrganization ? { [DEMO_ORGANIZATION.id]: parsed } : parsed;
  const factories = Object.fromEntries(getAllOrganizationConfiguration().plants.map(plant => {
    const organizationId = plant.organizationId ?? DEMO_ORGANIZATION.id;
    const previous = legacy[organizationId];
    const fallback = organizationId === DEMO_ORGANIZATION.id ? DEFAULT_MODULE_ENTITLEMENTS : NEW_FACTORY_ACCESS;
    return [plant.id, complete(previous, fallback)];
  }));
  return { version: 2, factories };
}

function load() {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(FACTORY_MODULE_ACCESS_KEY);
  if (loaded && raw === lastPayload) return;
  loaded = true; lastPayload = raw;
  try {
    const parsed: unknown = JSON.parse(raw ?? "null");
    state = normalizeFactoryAccess(parsed);
    const normalizedPayload = JSON.stringify(state);
    const objectPayload = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
    const invalidV2 = objectPayload && (parsed as { version?: unknown }).version === 2 && (!(parsed as { factories?: unknown }).factories || typeof (parsed as { factories?: unknown }).factories !== "object" || Array.isArray((parsed as { factories?: unknown }).factories));
    if ((parsed === null || (objectPayload && !invalidV2)) && normalizedPayload !== raw) {
      const result = safeSetStorage(FACTORY_MODULE_ACCESS_KEY, state);
      if (result.success) lastPayload = normalizedPayload;
    }
  }
  catch { state = DEFAULT_STATE; }
}

function subscribe(listener: () => void) { load(); listeners.add(listener); window.addEventListener?.("storage", listener); window.addEventListener?.("ops-access-context-changed", listener); return () => { listeners.delete(listener); window.removeEventListener?.("storage", listener); window.removeEventListener?.("ops-access-context-changed", listener); }; }
function snapshot() { load(); return state; }
function validFactory(organizationId: string, plantId: string) { return getAllOrganizationConfiguration().plants.some(plant => plant.id === plantId && (plant.organizationId ?? DEMO_ORGANIZATION.id) === organizationId && plant.status === "Active"); }
function clientStaged(organizationId: string) { return getOrganizations().some(client => client.id === organizationId && client.operationalState === "Staged"); }

export function getFactoryAccess(organizationId: string, plantId: string) {
  load();
  if (!validFactory(organizationId, plantId) || clientStaged(organizationId)) return { ...DENIED_ORGANIZATION_ACCESS };
  return { ...(state.factories[plantId] ?? NEW_FACTORY_ACCESS), redFlag: false };
}

export function useFactoryAccess(organizationId: string, plantId: string) {
  const current = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_STATE);
  if (!validFactory(organizationId, plantId) || clientStaged(organizationId)) return { ...DENIED_ORGANIZATION_ACCESS };
  return { ...(current.factories[plantId] ?? NEW_FACTORY_ACCESS), redFlag: false };
}

/** Compatibility reader for canonical commands. Access is always resolved from the active factory. */
export function getOrganizationAccess(organizationId?: string) {
  const context = typeof window === "undefined" ? null : getActiveAccessContext();
  const resolvedOrganizationId = organizationId ?? (context?.kind === "factory" ? context.organizationId : DEMO_ORGANIZATION.id);
  if (context?.kind === "factory" && context.organizationId === resolvedOrganizationId) return getFactoryAccess(resolvedOrganizationId, context.plantId);
  if (!context && resolvedOrganizationId === DEMO_ORGANIZATION.id) return getFactoryAccess(resolvedOrganizationId, "PLANT-EGM");
  return { ...DENIED_ORGANIZATION_ACCESS };
}

/** Compatibility hook retained for read-only callers; client scope no longer grants operational modules. */
export function useOrganizationAccess(organizationId?: string) {
  const { context } = useAccessContext();
  const resolvedOrganizationId = organizationId ?? (context?.kind === "factory" ? context.organizationId : DEMO_ORGANIZATION.id);
  const plantId = context?.kind === "factory" && context.organizationId === resolvedOrganizationId ? context.plantId : (!context && resolvedOrganizationId === DEMO_ORGANIZATION.id ? "PLANT-EGM" : "");
  return useFactoryAccess(resolvedOrganizationId, plantId);
}

export function useModuleEntitlements() {
  const { context } = useAccessContext();
  const actor = getAuthenticatedDemoActor(); const legacyABC = Boolean(!context && actor && actor.user.accessModel !== "v3");
  const organizationId = context?.kind === "factory" ? context.organizationId : legacyABC ? DEMO_ORGANIZATION.id : "__no-operational-context__";
  const plantId = context?.kind === "factory" ? context.plantId : legacyABC ? "PLANT-EGM" : "__no-factory-context__";
  return useFactoryAccess(organizationId, plantId);
}

export function saveFactoryAccess(organizationId: string, plantId: string, access: OrganizationAccess) {
  const actor = getAuthenticatedDemoActor();
  if (!actor || !isActivePlatformSuperAdmin(actor.identity, actor.user) || !validFactory(organizationId, plantId)) return false;
  if (Object.keys(DEFAULT_MODULE_ENTITLEMENTS).some(key => typeof access[key as AccessCapabilityId] !== "boolean")) return false;
  if (!access.actions) return false;
  load(); const previous = state;
  state = { version: 2, factories: { ...state.factories, [plantId]: complete(access, NEW_FACTORY_ACCESS) } };
  const result = safeSetStorage(FACTORY_MODULE_ACCESS_KEY, state);
  if (!result.success) { state = previous; return false; }
  lastPayload = window.localStorage.getItem(FACTORY_MODULE_ACCESS_KEY); listeners.forEach(listener => listener());
  return true;
}

export function createFactoryAccessPayload(plantId: string, access: OrganizationAccess = NEW_FACTORY_ACCESS) {
  load(); return { version: 2 as const, factories: { ...state.factories, [plantId]: complete(access, NEW_FACTORY_ACCESS) } };
}

export function removeFactoryAccessPayload(plantId: string) {
  load(); const factories = { ...state.factories }; delete factories[plantId]; return { version: 2 as const, factories };
}

export function notifyFactoryAccessChanged() { loaded = false; load(); listeners.forEach(listener => listener()); }

export function enabledFactoryModuleCount(access: OrganizationAccess) {
  return OPERATIONAL_MODULES.filter(module => access[module.id]).length;
}
