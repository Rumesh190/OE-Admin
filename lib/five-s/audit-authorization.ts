"use client";
import { getActiveAccessContext, requireAccessContext } from "@/features/five-s/administration/access-v4-context";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { ADMINISTRATION_JOURNAL_KEY } from "@/lib/administration-storage";
import type { FiveSAudit } from "@/features/five-s/types/five-s";
import { resolveCurrentFactoryActor, resolveFactoryPerson, type FactoryContext } from "@/features/five-s/administration/factory-authorization";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
import { getOrganizationAccess } from "@/lib/module-entitlements";
import { DEMO_ORGANIZATION } from "@/lib/organizations";
import { getCurrentDemoUser } from "@/lib/current-user";
import { getAdminUser, getAdminUsers } from "@/features/five-s/administration/store";
import { getPlatformOperationalScope } from "@/lib/platform-operational-access";
export interface V4AuditExpectation { selectionId: string; revision: number }
export function isV4Audit(audit: Pick<FiveSAudit, "policyVersion" | "organizationId" | "revision">) { return audit.policyVersion !== undefined || audit.revision !== undefined; }
export function requireV4AuditContext(audit: Pick<FiveSAudit, "organizationId" | "plantId" | "zoneId" | "policyVersion" | "revision">, expected?: V4AuditExpectation) {
  const c = getActiveAccessContext();
  if (audit.policyVersion !== "ops-access-v4" || !audit.organizationId || !audit.plantId || !audit.zoneId || !c || c.kind !== "factory" || c.organizationId !== audit.organizationId || c.plantId !== audit.plantId) throw new Error("Select the exact canonical Audit factory context.");
  if (expected) { requireAccessContext(expected.selectionId, { organizationId: audit.organizationId, plantId: audit.plantId }, "factory"); if (audit.revision !== expected.revision) throw new Error("Audit revision conflict. Refresh before retrying."); }
  return c;
}
function selectedAuditScope(audit: FiveSAudit) {
  try {
    const c = getActiveAccessContext();
    if (isV4Audit(audit)) { requireV4AuditContext(audit); return true; }
    return !c || (c.kind === "factory" && (audit.organizationId ? c.organizationId === audit.organizationId && c.plantId === audit.plantId : c.organizationId === DEMO_ORGANIZATION.id && c.plantId === "PLANT-EGM"));
  } catch { return false; }
}
export function isScopedAudit(audit: Pick<FiveSAudit, "organizationId" | "plantId" | "zoneId">) { return Boolean(audit.organizationId || audit.plantId || audit.zoneId); }
export function auditContext(audit: Pick<FiveSAudit, "organizationId" | "plantId" | "zoneId">): FactoryContext | undefined {
    return audit.organizationId && audit.plantId && audit.zoneId ? { organizationId: audit.organizationId, plantId: audit.plantId, zoneId: audit.zoneId } : undefined;
}
export function requiresScopedAuditPolicy(audit?: Pick<FiveSAudit, "organizationId" | "plantId" | "zoneId">) { return Boolean((audit && isScopedAudit(audit)) || getAdminUser(getCurrentDemoUser().id)?.accessModel === "v3"); }
export function eligibleAuditAssignees(context: FactoryContext) { return getAdminUsers().filter(user => resolveFactoryPerson(user.id, context).canAuditZone); }
export function canReadScopedAudit(audit: FiveSAudit) {
    if (!selectedAuditScope(audit)) return false;
    const platform = getPlatformOperationalScope("audit");
    if (platform && (!audit.organizationId || (audit.organizationId === platform.context.organizationId && audit.plantId === platform.context.plantId))) return true;
    if (!requiresScopedAuditPolicy(audit))
        return true;
    const context = auditContext(audit);
    if (!context) {
        const selected = getActiveAccessContext();
        if (!selected || selected.kind !== "factory" || selected.organizationId !== DEMO_ORGANIZATION.id || selected.plantId !== "PLANT-EGM" || !getOrganizationAccess(selected.organizationId).audit) return false;
        const resolved = resolveCurrentFactoryActor({ organizationId: selected.organizationId, plantId: selected.plantId });
        return Boolean(resolved?.valid && (resolved.clientAdmin || resolved.factoryAdmin));
    }
    const resolved = resolveCurrentFactoryActor(context);
    return Boolean(getOrganizationAccess(context.organizationId).audit && resolved?.valid && (resolved.clientAdmin || resolved.factoryAdmin || (resolved.membership && audit.assignedAuditorId === resolved.actor.user.id)));
}
export function canExecuteScopedAudit(audit: FiveSAudit, expectedActorId?: string, operation: "start" | "edit" = "edit") {
    if (typeof window !== "undefined" && window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY)) return false;
    if (!selectedAuditScope(audit)) return false;
    const context = auditContext(audit);
    if (!context)
        return false;
    const platform = getPlatformOperationalScope("audit");
    const platformActor = getAuthenticatedDemoActor(expectedActorId);
    const lifecycle = operation === "start" ? audit.status === "Scheduled" : audit.status === "In Progress" || audit.status === "Draft";
    if (platform && platformActor?.identity.isSuperAdmin && audit.assignedAuditorId === platformActor.user.id && platform.context.organizationId === context.organizationId && platform.context.plantId === context.plantId) return lifecycle;
    const resolved = resolveCurrentFactoryActor(context, expectedActorId);
    return Boolean(getOrganizationAccess(context.organizationId).audit && lifecycle && resolved && (resolved.factoryAdmin || (resolved.membership && audit.assignedAuditorId === resolved.actor.user.id)));
}
export function requireAuditExecution(audit: FiveSAudit, expectedActorId?: string, operation: "start" | "edit" = "edit") {
    if (requiresScopedAuditPolicy(audit) && !canExecuteScopedAudit(audit, expectedActorId, operation))
        throw new Error("Audit execution denied. Check the selected factory, active membership and assigned executor.");
}
export function canScheduleAnyScopedAudit() { const c = getActiveAccessContext(); if (getPlatformOperationalScope("audit")) return true; return getAllOrganizationConfiguration().plants.some(p => (!c || (c.kind === "factory" && c.plantId === p.id && c.organizationId === (p.organizationId ?? DEMO_ORGANIZATION.id))) && getOrganizationAccess(p.organizationId ?? DEMO_ORGANIZATION.id).audit && resolveCurrentFactoryActor({ organizationId: p.organizationId ?? DEMO_ORGANIZATION.id, plantId: p.id })?.factoryAdmin); }

/** Demo MVP: any active factory member may start an Audit directly. Scheduling remains administrative. */
export function canStartAnyScopedAudit() {
    const c = getActiveAccessContext();
    if (getPlatformOperationalScope("audit")) return true;
    if (!c || c.kind !== "factory" || !getOrganizationAccess(c.organizationId).audit) return false;
    const resolved = resolveCurrentFactoryActor({ organizationId: c.organizationId, plantId: c.plantId });
    return Boolean(resolved?.valid && (resolved.clientAdmin || resolved.factoryAdmin || resolved.membership));
}

/** Audit shell visibility follows the selected factory entitlement and canonical viewer scope. */
export function canOpenScopedAuditModule() {
    const actor = getAuthenticatedDemoActor(); if (!actor) return false;
    if (actor.identity.isSuperAdmin) return Boolean(getPlatformOperationalScope("audit"));
    let selected; try { selected = getActiveAccessContext(); } catch { return false; }
    if (!selected || selected.kind !== "factory" || !getOrganizationAccess(selected.organizationId).audit) return false;
    const resolved = resolveFactoryPerson(actor.user.id, { organizationId: selected.organizationId, plantId: selected.plantId });
    return Boolean(resolved.valid && (resolved.clientAdmin || resolved.factoryAdmin || resolved.membership));
}
