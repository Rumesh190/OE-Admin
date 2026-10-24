"use client";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { getActiveAccessContext, isLegacyABCOperationalContext } from "@/features/five-s/administration/access-v4-context";
import { getOrganizationAccess } from "@/lib/module-entitlements";
import type { AccessCapabilityId } from "@/lib/modules";
import { hasPlatformLegacyOperationalAccess } from "@/lib/platform-operational-access";

/** Demo-MVP bridge for legacy browser-local stores. Backend tenant enforcement replaces this path. */
export function canWriteLegacyOperational(module: AccessCapabilityId) {
  try {
    const actor = getAuthenticatedDemoActor();
    const context = getActiveAccessContext();
    const legacyAccess = Boolean(actor && !actor.identity.isSuperAdmin && actor.user.accessModel !== "v3" && isLegacyABCOperationalContext(context) && getOrganizationAccess("abc-manufacturing")[module]);
    const factoryDemoAccess = Boolean(actor && !actor.identity.isSuperAdmin && context?.kind === "factory" && context.personId === actor.user.id && getOrganizationAccess(context.organizationId)[module]);
    return hasPlatformLegacyOperationalAccess(module) || legacyAccess || factoryDemoAccess;
  } catch { return false; }
}
export function requireLegacyOperationalWrite(module: AccessCapabilityId) {
  if (!canWriteLegacyOperational(module)) {
    throw new Error("Select an authorized factory where this module is enabled.");
  }
}
