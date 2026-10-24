"use client";

import { getActiveAccessContext } from "@/features/five-s/administration/access-v4-context";
import type { MyAction } from "@/features/five-s/types/my-actions";
import { getAdminUser } from "@/features/five-s/administration/store";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { DEMO_ORGANIZATION, getOrganizationAccess } from "@/lib/module-entitlements";
import { getOrganizationPlant, getOrganizationZone } from "@/lib/organization-store";
import { getActionSourceDefinition, inferActionSourceModule } from "./action-config";
import { getActionCreationSourceAccess, type ActionCreationContext } from "./action-source-access";
import { hasPlatformLegacyOperationalAccess } from "@/lib/platform-operational-access";
import { canCreateDemoModuleRecord } from "@/lib/demo/demo-module-creation";

/** Canonical creation authorization; all checks precede allocation, persistence and notifications. */
export function authorizeActionCreation(input: ActionCreationContext, existing: readonly MyAction[]) {
  const context = getActiveAccessContext();
  if (context && context.kind !== "factory") throw new Error("Select a factory before creating an Action.");
  if (input.policyVersion !== undefined || input.v4 !== undefined || input.plantId !== undefined || input.departmentId !== undefined) throw new Error("Use the protected Audit-question Action service for versioned records.");
  const actor = getAuthenticatedDemoActor(input.createdByUserId);
  const denied = () => { throw new Error("You are not authorized to create this Action or its source is unavailable."); };
  if (!actor || (actor.identity.isSuperAdmin && !hasPlatformLegacyOperationalAccess("actions", input.plant))) return denied();
  const { user, identity } = actor;
  const demoCreation = canCreateDemoModuleRecord("actions", user.id);
  if (!["Open", "Assigned", "Awaiting Assignment"].includes(input.status ?? "") || input.actionType !== undefined) return denied();
  if ([input.submittedForReviewAt, input.reviewedAt, input.reviewedBy, input.completedAt, input.completedByUserId, input.completedByName, input.closedAt, input.closedByUserId, input.closedBy, input.closureRemark, input.reviewHistory, input.reassignmentHistory, input.submissionRevisions].some(value => value !== undefined)) return denied();
  if (input.assignedByUserId && input.assignedByUserId !== user.id) return denied();
  const organization = context?.kind === "factory" ? context.organizationId : DEMO_ORGANIZATION.id;
  if (input.organizationId !== undefined && input.organizationId !== organization) return denied();
  const plant = getOrganizationPlant(input.plant), zone = getOrganizationZone(input.area);
  if (!plant || plant.status !== "Active" || !zone || zone.status !== "Active" || zone.plantId !== plant.id || user.plant !== plant.name) return denied();
  const inZone = user.roles.includes("Admin") || user.zoneMemberships.some(membership => membership.zone === zone.name);
  const broadAuditor = user.roles.includes("Auditor") && user.permissions.includes("actions.create");
  if (!demoCreation && !inZone && !broadAuditor) return denied();
  if (input.zoneId && input.zoneId !== zone.id && input.zoneId !== zone.name) return denied();
  if (input.zoneLeaderId && input.zoneLeaderId !== zone.leaderId) return denied();
  const owner = input.responsiblePersonId ? getAdminUser(input.responsiblePersonId) : undefined;
  if (input.responsiblePersonId && (!owner || owner.status !== "Active" || owner.plant !== input.plant || !owner.zoneMemberships.some(membership => membership.zone === zone.name))) return denied();
  if (input.reviewerId) {
    const reviewer = getAdminUser(input.reviewerId);
    if (!reviewer || reviewer.status !== "Active" || reviewer.id === owner?.id || (reviewer.plant !== input.plant && reviewer.plant !== "All organizations") || !reviewer.permissions.includes("actions.review") || !reviewer.permissions.includes("actions.close")) return denied();
  }
  const sourceModule = inferActionSourceModule(input), definition = getActionSourceDefinition(input);
  if (definition.id !== sourceModule || inferActionSourceModule({ source: input.source }) !== sourceModule) return denied();
  const access = getOrganizationAccess();
  if (!access.actions || (sourceModule === "redFlag" && !access.redFlag) || (definition.entitlement && !access[definition.entitlement])) return denied();
  const sourceId = input.sourceId ?? (sourceModule === "audit" ? input.auditId : undefined);
  const childId = input.sourceObservationId ?? input.questionId;
  if (sourceModule === "audit" && input.auditId && input.sourceId && input.auditId !== input.sourceId) return denied();
  const source = sourceModule === "manual" ? undefined : getActionCreationSourceAccess(sourceModule, { ...input, sourceId, sourceObservationId: childId }, user, identity);
  const permitted = sourceModule === "manual"
    ? (demoCreation || user.permissions.includes("actions.create")) && !input.auditId
    : Boolean(source?.permitted && source.record && source.record.plant === input.plant && source.zone === input.area
      && (!source.record.organizationId || source.record.organizationId === organization));
  const alreadyLinked = source?.alreadyLinked;
  if (!permitted || alreadyLinked) return denied();
  if (["gemba", "audit", "visualImprovement", "visualManagement", "redFlag"].includes(sourceModule) && existing.some(action => inferActionSourceModule(action) === sourceModule && (action.sourceId ?? action.auditId) === sourceId && (action.sourceObservationId ?? action.questionId) === childId)) return denied();
  return { user, owner, sourceModule, sourceId };
}
