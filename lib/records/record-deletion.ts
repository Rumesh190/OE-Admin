"use client";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { getOrganizationAccess } from "@/lib/module-entitlements";
import { DEMO_ORGANIZATION } from "@/lib/organizations";
import { inferActionSourceModule } from "@/lib/actions/action-config";
import { getRelationshipsForRecord } from "@/lib/relationships/relationship-store";
import type { AccessCapabilityId } from "@/lib/modules";
import type { OpsRecordRef } from "@/lib/relationships/types";
import { commitOperationalDeletion, getDeletionRecord, getRecordTombstone, readDeletionActions, registerDeletionPolicy, type DeletionModule, type DeletionRecord } from "./record-tombstones";

function capability(module: DeletionModule): AccessCapabilityId { return module === "action" ? "actions" : module === "gembaObservation" ? "gemba" : module === "vmBoard" || module === "vmMeeting" ? "visualManagement" : module; }
export function canDeleteOperationalRecord(module: DeletionModule, id: string) {
  const actor = getAuthenticatedDemoActor();
  const record = getDeletionRecord(module, id);
  return Boolean(actor && !actor.identity.isSuperAdmin && actor.user.roles.includes("Admin") && record && record.plant === actor.user.plant && (!record.organizationId || record.organizationId === DEMO_ORGANIZATION.id) && getOrganizationAccess()[capability(module)] && !getRecordTombstone(module, id));
}
export function getDeletionLinkedActionIds(module: DeletionModule, record: DeletionRecord) {
  if (module === "action") return [];
  const ids = new Set(record.linkedActionIds ?? []);
  const aliases = new Set([record.id, ...(record.aliases ?? []), ...(record.childIds ?? [])]);
  for (const action of readDeletionActions()) {
    const source = inferActionSourceModule(action);
    const expected = capability(module);
    const matches = module === "gembaObservation" ? source === "gemba" && action.sourceObservationId === record.id
      : module === "vmBoard" ? source === "visualManagement" && (action.visualManagementSource?.boardId === record.id || aliases.has(action.sourceId ?? ""))
      : module === "vmMeeting" ? source === "visualManagement" && (action.visualManagementSource?.meetingId === record.id || aliases.has(action.sourceId ?? ""))
      : (source === expected || (module === "redTag" && source === "redFlag")) && [action.sourceId, action.auditId, action.sourceTitle, action.sourceObservationId].some(id => id && aliases.has(id));
    if (matches) ids.add(action.id);
  }
  const ref: OpsRecordRef = module === "gembaObservation" ? { module: "gemba", recordId: record.parentId!, childId: record.id } : module === "vmMeeting" ? { module: "visualManagement", recordId: record.parentId!, childId: record.id } : { module: capability(module) as OpsRecordRef["module"], recordId: record.id };
  for (const edge of getRelationshipsForRecord(ref)) for (const target of [edge.relationship.from, edge.relationship.to]) if (target.module === "action") ids.add(target.recordId);
  const existing = new Set(readDeletionActions().map(action => action.id));
  return [...ids].filter(id => existing.has(id) && !getRecordTombstone("action", id));
}
registerDeletionPolicy((module, id) => {
  if (!canDeleteOperationalRecord(module, id)) throw new Error("An authenticated Admin in this organization with module access is required to delete this record.");
  const actor = getAuthenticatedDemoActor()!;
  const record = getDeletionRecord(module, id)!;
  return { record: { ...record, linkedActionIds: getDeletionLinkedActionIds(module, record) }, actorId: actor.user.id, actorName: actor.user.name };
});
export function deleteOperationalRecord(module: DeletionModule, id: string, confirmed = false) { return commitOperationalDeletion(module, id, confirmed); }
