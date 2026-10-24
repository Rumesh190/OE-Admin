"use client";

import { ADMIN_DEMO_SUBJECT_KEY, DEMO_USERS, getCurrentDemoUser } from "@/lib/current-user";
import { getAdminUser } from "@/features/five-s/administration/store";

/** The existing browser demo login format, not a server authentication boundary. */
export function hasAuthenticatedDemoSession() {
  if (typeof window === "undefined") return false;
  try {
    const session = JSON.parse(window.localStorage.getItem("5s-auth-session") ?? "null");
    return session?.authenticated === true && session.username === "admin" && session.version === 1;
  } catch { return false; }
}

/** Resolve identity from the current demo session and active directory, never a caller's roles. */
export function getAuthenticatedDemoActor(expectedId?: string) {
  if (!hasAuthenticatedDemoSession()) return undefined;
  const role = window.localStorage.getItem("five-s-demo-role");
  if (role !== null && !Object.hasOwn(DEMO_USERS, role)) return undefined;
  const identity = getCurrentDemoUser();
  if ((expectedId !== undefined && expectedId !== identity.id) || (!window.localStorage.getItem(ADMIN_DEMO_SUBJECT_KEY) && role && DEMO_USERS[role as keyof typeof DEMO_USERS].id !== identity.id)) return undefined;
  const user = getAdminUser(identity.id);
  if (user?.status !== "Active") return undefined;
  return { user, identity: { ...identity, name: user.name, plant: user.plant, primaryZone: user.zoneMemberships[0]?.zone ?? identity.primaryZone } };
}
