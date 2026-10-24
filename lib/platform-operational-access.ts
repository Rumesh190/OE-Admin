"use client";

import { getActiveAccessContext } from "@/features/five-s/administration/access-v4-context";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
import type { AccessCapabilityId } from "@/lib/modules";

export const METRIC_MIND_ID = "USR-OPS-SUPER-ADMIN";

/** Explicit platform authority. Operational work still requires one selected factory. */
export function getPlatformOperationalScope(module: AccessCapabilityId) {
  try {
    const actor = getAuthenticatedDemoActor();
    const context = getActiveAccessContext();
    if (!actor?.identity.isSuperAdmin || actor.user.id !== METRIC_MIND_ID || context?.kind !== "factory") return null;
    const plant = getAllOrganizationConfiguration().plants.find(item => item.id === context.plantId && (item.organizationId ?? "abc-manufacturing") === context.organizationId && item.status === "Active");
    if (!plant) return null;
    void module; // Callers name the capability so the policy remains explicit and auditable.
    return { context, plant };
  } catch { return null; }
}

export function hasPlatformOperationalAccess(module: AccessCapabilityId, plantName?: string) {
  const scope = getPlatformOperationalScope(module);
  return Boolean(scope && (!plantName || scope.plant.name === plantName));
}

/** Legacy records have no tenant ID and can only be operated in the explicit ABC factory. */
export function hasPlatformLegacyOperationalAccess(module: AccessCapabilityId, plantName?: string) {
  const scope = getPlatformOperationalScope(module);
  return Boolean(scope && scope.context.organizationId === "abc-manufacturing" && scope.context.plantId === "PLANT-EGM" && (!plantName || scope.plant.name === plantName));
}
