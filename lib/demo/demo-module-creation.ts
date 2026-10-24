"use client";

import { getActiveAccessContext } from "@/features/five-s/administration/access-v4-context";
import { resolveFactoryPerson } from "@/features/five-s/administration/factory-authorization";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { getOrganizationAccess } from "@/lib/module-entitlements";
import type { AccessCapabilityId } from "@/lib/modules";
import { getPlatformOperationalScope } from "@/lib/platform-operational-access";

/** Frontend-demo creation rule. Backend authorization replaces this compatibility path. */
export function canCreateDemoModuleRecord(module: AccessCapabilityId, expectedPersonId?: string) {
  try {
    const actor = getAuthenticatedDemoActor(expectedPersonId);
    if (!actor) return false;
    if (actor.identity.isSuperAdmin) return Boolean(getPlatformOperationalScope(module));
    const context = getActiveAccessContext();
    if (!context) return Boolean(actor.user.status === "Active" && getOrganizationAccess()[module]);
    if (context.kind !== "factory" || context.personId !== actor.user.id || !getOrganizationAccess(context.organizationId)[module]) return false;
    const factoryActor = resolveFactoryPerson(actor.user.id, { organizationId: context.organizationId, plantId: context.plantId });
    return Boolean(factoryActor.valid && (factoryActor.clientAdmin || factoryActor.factoryAdmin || factoryActor.membership));
  } catch {
    return false;
  }
}
