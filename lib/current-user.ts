"use client";

import { useSyncExternalStore } from "react";
import { getAdminUser, useAdminUsers } from "@/features/five-s/administration/store";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { getAllOrganizationConfiguration, useOrganizationConfiguration } from "@/lib/organization-store";
import { usePersonalSettings } from "@/lib/profile-settings";
import { resolveCanonicalProfileRole, resolveCanonicalProfile, type CanonicalProfileTarget } from "@/lib/demo/canonical-profiles";

export interface DemoUser {
  id: string;
  name: string;
  role: string;
  initials: string;
  plant: string;
  primaryZone: string;
  isSuperAdmin: boolean;
}

export const DEMO_USERS = {
  auditor: {
    id: "USR-LAKSHMAN",
    name: "Lakshman",
    role: "Zone A Leader · Auditor",
    initials: "LK",
    plant: "Egmore Plant",
    primaryZone: "Zone A",
    isSuperAdmin: false,
  },
  leader: {
    id: "USR-RUMESH",
    name: "Rumesh",
    role: "Zone B Leader",
    initials: "RU",
    plant: "Egmore Plant",
    primaryZone: "Zone B",
    isSuperAdmin: false,
  },
  responsible: {
    id: "USR-SIVA-KUMAR",
    name: "Siva Kumar",
    role: "Zone B Member",
    initials: "SK",
    plant: "Egmore Plant",
    primaryZone: "Zone B",
    isSuperAdmin: false,
  },
  superAdmin: {
    id: "USR-OPS-SUPER-ADMIN",
    name: "Metric Mind",
    role: "Platform Super Admin",
    initials: "MM",
    plant: "All organizations",
    primaryZone: "Platform",
    isSuperAdmin: true,
  },
} as const satisfies Record<string, DemoUser>;

export type DemoRole = keyof typeof DEMO_USERS;

/** Default identity used during server rendering and for the audit workflow. */
export const CURRENT_USER = DEMO_USERS.auditor;

export const ADMIN_DEMO_SUBJECT_KEY = "ops-administration-demo-person-v1";
const STORAGE_KEY = "five-s-demo-role";
let administrationIdentity: DemoUser | undefined;
let administrationIdentityKey = "";
const listeners = new Set<() => void>();
let activeRole: DemoRole = "auditor";
let storageLoaded = false;

function loadStoredRole() {
  if (storageLoaded || typeof window === "undefined") return;
  storageLoaded = true;
  const storedRole = window.localStorage.getItem(STORAGE_KEY);
  if (storedRole === "auditor" || storedRole === "leader" || storedRole === "responsible" || storedRole === "superAdmin") activeRole = storedRole;
}

function subscribe(listener: () => void) {
  loadStoredRole();
  listeners.add(listener);
  window.addEventListener("ops-access-context-changed", listener);
  return () => { listeners.delete(listener); window.removeEventListener("ops-access-context-changed", listener); };
}

function selectedTarget(personId: string): CanonicalProfileTarget | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem("ops-active-access-context-v1") ?? "null") as (CanonicalProfileTarget & { personId?: string }) | null;
    if (value?.personId !== personId) return null;
    if (value.kind === "platform") return value;
    if (value.kind === "client" && typeof value.organizationId === "string") return value;
    return value.kind === "factory" && typeof value.organizationId === "string" && typeof value.plantId === "string" ? value : null;
  } catch { return null; }
}

function getSnapshot(): DemoUser {
  loadStoredRole();
  const selected = typeof window !== "undefined" ? window.localStorage.getItem(ADMIN_DEMO_SUBJECT_KEY) : null;
  if (selected) {
    const person = getAdminUser(selected);
    const role = resolveCanonicalProfileRole(selected, selectedTarget(selected));
    const key = JSON.stringify([selected, person?.name, person?.status, role]);
    if (!administrationIdentity || key !== administrationIdentityKey) { administrationIdentityKey = key; administrationIdentity = { id: selected, name: person?.name ?? "Unavailable administration identity", role, initials: "AD", plant: person?.plant ?? "", primaryZone: "", isSuperAdmin: false }; }
    return administrationIdentity;
  }
  const identity = DEMO_USERS[activeRole];
  const person = getAdminUser(identity.id);
  const role = resolveCanonicalProfileRole(identity.id, selectedTarget(identity.id));
  const key = JSON.stringify([identity.id, person?.name ?? identity.name, role]);
  if (!administrationIdentity || key !== administrationIdentityKey) { administrationIdentityKey = key; administrationIdentity = { ...identity, name: person?.name ?? identity.name, role }; }
  return administrationIdentity;
}

function getServerSnapshot(): DemoUser {
  return CURRENT_USER;
}

export function setDemoRole(role: DemoRole) {
  window.localStorage.removeItem(ADMIN_DEMO_SUBJECT_KEY);
  window.localStorage.setItem(STORAGE_KEY, role);
  activeRole = role;
  storageLoaded = true;
  window.localStorage.removeItem("ops-active-access-context-v1");
  notifyDemoIdentityChanged();
  window.dispatchEvent(new Event("ops-access-context-changed"));
}

export function getCurrentDemoUser() {
  return getSnapshot();
}

export function useCurrentUser() {
  const identity = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const access = useAccessV3State();
  const independent = useAccessV4State();
  const configuration = useOrganizationConfiguration();
  const configured = useAdminUsers(true).find((user) => user.id === identity.id);
  const personal = usePersonalSettings(identity.id);
  const target = selectedTarget(identity.id);
  const profile = resolveCanonicalProfile(identity.id, target);
  const factory = target?.kind === "factory" && profile ? getAllOrganizationConfiguration().plants.find(item => item.id === target.plantId && (item.organizationId ?? "abc-manufacturing") === target.organizationId) : undefined;
  const zoneId = factory ? access.zoneAllocations.find(item => item.userId === identity.id && item.status === "Active" && item.plantId === factory.id && item.organizationId === (factory.organizationId ?? "abc-manufacturing"))?.zoneId
    ?? independent.assignments.find(item => item.personId === identity.id && item.status === "Active" && item.plantId === factory.id && item.organizationId === (factory.organizationId ?? "abc-manufacturing"))?.zoneId : undefined;
  const zone = zoneId ? configuration.zones.find(item => item.id === zoneId && item.plantId === factory?.id && item.status === "Active") : undefined;
  const name = personal.profile.fullName || configured?.name || identity.name;
  return {
    ...identity,
    name,
    initials: name.split(/\s+/).filter(Boolean).map((part: string) => part[0]).join("").slice(0, 2).toUpperCase() || identity.initials,
    responsibilities: profile?.responsibilities ?? [],
    plant: factory?.name ?? configured?.plant ?? identity.plant,
    primaryZone: factory ? zone?.name ?? "" : configured?.zoneMemberships[0]?.zone ?? identity.primaryZone,
    photo: personal.profile.photo,
  };
}

/** Demo identity selection only; commands still resolve and validate the current active directory subject. */
export function setAdministrationDemoIdentity(userId: string) {
  stageDemoIdentity(userId);
  window.localStorage.removeItem("ops-active-access-context-v1");
  notifyDemoIdentityChanged();
  window.dispatchEvent(new Event("ops-access-context-changed"));
}

/** Internal coordination primitive for an identity + access-context transaction. */
export function stageDemoIdentity(userId: string) {
  if (userId === DEMO_USERS.superAdmin.id) {
    window.localStorage.removeItem(ADMIN_DEMO_SUBJECT_KEY);
    window.localStorage.setItem(STORAGE_KEY, "superAdmin");
    activeRole = "superAdmin";
    storageLoaded = true;
    return;
  }
  const person = getAdminUser(userId);
  if (!person || person.status !== "Active") throw new Error("Select an active administration person.");
  window.localStorage.setItem(ADMIN_DEMO_SUBJECT_KEY, person.id);
}

export function notifyDemoIdentityChanged() {
  storageLoaded = false;
  administrationIdentityKey = "";
  listeners.forEach(listener => listener());
}
