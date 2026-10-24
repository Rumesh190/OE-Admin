"use client";
import { assertV4EvidenceReferences } from "./action-v4-assets";
import { canReadScopedAudit } from "@/lib/five-s/audit-authorization";
import type { MyAction } from "@/features/five-s/types/my-actions";
import type { FiveSAudit } from "@/features/five-s/types/five-s";
import type { WorkCapacitySnapshot, VerifierSelectionSnapshot } from "@/features/five-s/administration/access-v4-models";
import { getAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { getAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { getActiveAccessContext, requireAccessContext } from "@/features/five-s/administration/access-v4-context";
import { resolveFactoryPerson } from "@/features/five-s/administration/factory-authorization";
import { getCanonicalAdminUsers } from "@/features/five-s/administration/store";
import { matchesRecordedWorkCapacity } from "@/features/five-s/administration/access-v4-compatibility";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { getOrganizationAccess } from "@/lib/module-entitlements";
import { ADMINISTRATION_JOURNAL_KEY, readAdministrationPayload } from "@/lib/administration-storage";
import { commitAdministrationV4, withAdministrationLock } from "@/lib/administration-v4-storage";
import { getRecordTombstone } from "@/lib/records/record-tombstones";
import { getPlatformOperationalScope } from "@/lib/platform-operational-access";
export const ACTIONS_KEY = "standalone-5s-actions";
export const AUDITS_KEY = "manufacturing-qms-five-s-audits-v1";
export interface V4ActionActor { id: string; name: string; v4Expectation?: { selectionId: string; revision: number } }
export function isV4Action(a: MyAction) { return a.policyVersion !== undefined || a.v4 !== undefined || a.plantId !== undefined || a.departmentId !== undefined || Boolean(a.organizationId && a.organizationId !== "abc-manufacturing"); }
export function readCanonicalActions(): MyAction[] {
  const raw = readAdministrationPayload(ACTIONS_KEY); const values: MyAction[] = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(values) || values.some(a => !a || typeof a.id !== "string") || new Set(values.map(a => a.id)).size !== values.length) throw new Error("Invalid canonical Action payload. Preserve storage.");
  return values;
}
export function readCanonicalAudits(): FiveSAudit[] {
  const raw = readAdministrationPayload(AUDITS_KEY); const values: FiveSAudit[] = raw === null ? [] : JSON.parse(raw);
  if (!Array.isArray(values) || values.some(a => !a || typeof a.id !== "string") || new Set(values.map(a => a.id)).size !== values.length) throw new Error("Invalid canonical Audit payload. Preserve storage.");
  return values;
}
export function requireV4ActionBase(a: MyAction, expectedPersonId?: string) {
  if (a.policyVersion !== "ops-access-v4" || a.v4?.version !== 1 || !Number.isSafeInteger(a.v4.revision) || a.v4.revision < 1 || !a.organizationId || !a.plantId || !a.zoneId || !a.departmentId || a.sourceModule !== "audit" || a.sourceId !== a.auditId || !a.questionId || a.sourceObservationId !== a.questionId || !a.createdByUserId || !a.responsiblePersonId || !Array.isArray(a.v4.actualCompleterIds)) throw new Error("Unsupported or incomplete v4 Action scope.");
  if (a.v4.workCapacity.actionId !== a.id || a.v4.workCapacity.personId !== a.responsiblePersonId) throw new Error("Work-capacity snapshot identity conflict.");
  const actor = getAuthenticatedDemoActor(expectedPersonId); const c = getActiveAccessContext();
  if (!actor || !c || c.kind !== "factory" || c.personId !== actor.user.id || c.organizationId !== a.organizationId || c.plantId !== a.plantId || !getOrganizationAccess(a.organizationId).audit || !getOrganizationAccess(a.organizationId).actions) throw new Error("Select the entitled, active Action factory context.");
  const member = resolveFactoryPerson(actor.user.id, { organizationId: a.organizationId, plantId: a.plantId, zoneId: a.zoneId });
  if (!member.valid || (!member.membership && !member.factoryAdmin) || getRecordTombstone("action", a.id) || getRecordTombstone("audit", a.auditId!)) throw new Error("Action membership or source is unavailable.");
  const source = readCanonicalAudits().find(v => v.id === a.auditId);
  const questions = source?.sections.flatMap(s => s.questions).filter(q => q.id === a.questionId) ?? [];
  if (!source || source.policyVersion !== "ops-access-v4" || source.organizationId !== a.organizationId || source.plantId !== a.plantId || source.zoneId !== a.zoneId || questions.length !== 1 || questions[0].departmentId !== a.departmentId || questions[0].actionId !== a.id) throw new Error("Canonical Audit/question linkage is unavailable.");
  return { actor, context: c, member, source };
}
export function eligibleWorkCapacity(a: Pick<MyAction, "organizationId" | "plantId" | "zoneId" | "departmentId">, snapshot: WorkCapacitySnapshot) {
  const scope = { organizationId: a.organizationId!, plantId: a.plantId!, zoneId: a.zoneId! };
  const p = resolveFactoryPerson(snapshot.personId, scope); const state = getAccessV4State();
  const d = state.departments.find(d => d.id === a.departmentId && d.organizationId === a.organizationId && d.plantId === a.plantId && d.zoneId === a.zoneId && d.status === "Active");
  if (!p.valid || !p.membership || !d) return false;
  // Department-origin DM/DL and exact same-Zone ZL facts only. Factory work remains unsupported.
  const assignment = state.assignments.find(r => r.id === snapshot.roleAssignmentId && r.status === "Active");
  return Boolean(assignment && matchesRecordedWorkCapacity(snapshot, assignment) && assignment.organizationId === a.organizationId && assignment.plantId === a.plantId && assignment.zoneId === a.zoneId && (assignment.role === "Zone Leader" || ((assignment.role === "Department Member" || assignment.role === "Department Leader") && assignment.departmentId === a.departmentId)));
}
function independent(a: MyAction, id: string) { return id !== a.createdByUserId && id !== a.responsiblePersonId && !a.v4!.actualCompleterIds.includes(id); }
export function eligibleV4Verifier(a: MyAction, personId: string) {
  if (!a.v4 || !independent(a, personId)) return false;
  const p = resolveFactoryPerson(personId, { organizationId: a.organizationId!, plantId: a.plantId!, zoneId: a.zoneId });
  if (!p.valid || (!p.membership && !p.factoryAdmin)) return false;
  const capacity = a.v4.workCapacity.capacity;
  if (capacity === "Zone Leader") return p.factoryAdmin;
  if (capacity === "Factory Admin") return false; // Explicit qualification facts are not approved; no invented designation.
  const role = capacity === "Department Member" ? "Department Leader" : "Zone Leader";
  return getAccessV4State().assignments.some(r => r.role === role && r.personId === personId && r.status === "Active" && r.organizationId === a.organizationId && r.plantId === a.plantId && r.zoneId === a.zoneId && (role !== "Department Leader" || r.departmentId === a.departmentId));
}
export function eligibleV4Coordinator(a: MyAction, personId: string, verifierId: string) {
  if (!a.v4 || personId === verifierId || !independent(a, personId) || a.v4.workCapacity.capacity === "Factory Admin") return false;
  return resolveFactoryPerson(personId, { organizationId: a.organizationId!, plantId: a.plantId!, zoneId: a.zoneId }).factoryAdmin;
}
export function validV4Selection(a: MyAction, s = a.v4?.verifierSelection): s is VerifierSelectionSnapshot {
  return Boolean(s && s.actionId === a.id && s.scope.organizationId === a.organizationId && s.scope.plantId === a.plantId && s.scope.zoneId === a.zoneId && s.scope.departmentId === a.departmentId && eligibleV4Verifier(a, s.verifierPersonId) && eligibleV4Coordinator(a, s.coordinatorPersonId, s.verifierPersonId)
    && (s.verifierAuthorization.kind === "role-assignment" && (getAccessV4State().assignments.some(r => r.id === s.verifierAuthorization.id && r.personId === s.verifierPersonId && r.status === "Active" && r.organizationId === a.organizationId && r.plantId === a.plantId && r.zoneId === a.zoneId && (a.v4?.workCapacity.capacity === "Department Member" ? r.role === "Department Leader" && r.departmentId === a.departmentId : r.role === "Zone Leader")) || (a.v4?.workCapacity.capacity === "Zone Leader" && getAccessV3State().factoryAdmins.some(r => r.id === s.verifierAuthorization.id && r.userId === s.verifierPersonId && r.organizationId === a.organizationId && r.plantId === a.plantId && r.status === "Active"))))
    && getAccessV3State().factoryAdmins.some(r => r.id === s.coordinatorAuthorizationReference && r.userId === s.coordinatorPersonId && r.organizationId === a.organizationId && r.plantId === a.plantId && r.status === "Active"));
}
export function canReadV4Action(a: MyAction) {
  const platform = getPlatformOperationalScope("actions");
  if (platform && a.organizationId === platform.context.organizationId && a.plantId === platform.context.plantId && !getRecordTombstone("action", a.id)) return true;
  try { const { actor, member, source } = requireV4ActionBase(a); return canReadScopedAudit(source) || actor.user.id === a.createdByUserId || actor.user.id === a.responsiblePersonId || (validV4Selection(a) && a.v4!.verifierSelection!.verifierPersonId === actor.user.id) || (member.factoryAdmin && a.v4?.workCapacity.capacity !== "Factory Admin"); } catch { return false; }
}
export function canWorkV4Action(a: MyAction, personId: string) {
  try { requireV4ActionBase(a, personId); return a.responsiblePersonId === personId && eligibleWorkCapacity(a, a.v4!.workCapacity) && ["Assigned", "Open", "In Progress", "Rework Required"].includes(a.status); } catch { return false; }
}
export function canVerifyV4Action(a: MyAction, personId: string) {
  try { requireV4ActionBase(a, personId); return validV4Selection(a) && a.v4!.verifierSelection!.verifierPersonId === personId && eligibleWorkCapacity(a, a.v4!.workCapacity); } catch { return false; }
}
export function actionV4ReadSet() { return new Map([ACTIONS_KEY, AUDITS_KEY, "ops-access-v3-administration-v1", "ops-access-v4-administration-v1", "ops-organization-configuration-v1", "five-s-administration-users-v1", "ops-active-access-context-v1", "5s-auth-session", "five-s-demo-role", "ops-administration-demo-person-v1", "ops-organization-modules-v1"].map(k => [k, window.localStorage.getItem(k)])); }
let writeScope = false;
export async function withV4ActionWrite<T>(fn: () => T): Promise<T> { return withAdministrationLock(() => { writeScope = true; try { return fn(); } finally { writeScope = false; } }); }
export function persistV4ActionUpdate(a: MyAction, updates: Partial<MyAction>, actor?: V4ActionActor) {
  if (!writeScope || !actor?.v4Expectation || actor.v4Expectation.revision !== a.v4?.revision) throw new Error("Use the protected Action command with the displayed revision.");
  const permission = () => { requireV4ActionBase(a, actor.id); requireAccessContext(actor.v4Expectation!.selectionId, { organizationId: a.organizationId!, plantId: a.plantId }, "factory"); };
  permission();
  const rows = readCanonicalActions(); const current = rows.find(r => r.id === a.id);
  if (!current || JSON.stringify(current) !== JSON.stringify(a)) throw new Error("Action revision conflict. Reload the task.");
  if (updates.status === "Completed" || updates.status === "Rework Required") { if (!canVerifyV4Action(a, actor.id)) throw new Error("Independent verifier eligibility changed."); }
  else if (!canWorkV4Action(a, actor.id)) throw new Error("Current owner/work capacity is not eligible.");
  if (updates.status === "Pending Auditor Review" && (a.status !== "In Progress" || !a.actionType || !validV4Selection(a))) throw new Error("An independent, eligible verifier and coordinator must be explicitly selected before submission.");
  const allowed = new Set(["status", "actionType", "actionTakenDescription", "resolutionObservation", "correctiveActionCategory", "costSaving", "currency", "submittedForReviewAt", "completedAt", "reviewedAt", "reviewedBy", "reviewHistory", "activityHistory", "submissionRevisions", "closedByUserId", "closedBy", "closedAt", "closureRemark", "completedByUserId", "completedByName", "evidence", "progressEvidence"]);
  if (Object.keys(updates).some(k => !allowed.has(k))) throw new Error("Immutable v4 identity/scope/work-capacity cannot be generically changed.");
  if (updates.status === "In Progress" && (!["Assigned", "Open", "Rework Required"].includes(a.status) || !["immediate", "corrective"].includes(updates.actionType ?? ""))) throw new Error("An explicit Action type is required at Start.");
  if ((updates.status === "Completed" || updates.status === "Rework Required") && (!["Pending Review", "Pending Auditor Review", "Awaiting Review"].includes(a.status) || !a.submittedForReviewAt)) throw new Error("Owner submission is required before review.");
  if (updates.status === "Completed" && (!a.evidence.length || !(a.resolutionObservation ?? a.actionTakenDescription)?.trim() || !a.correctiveActionCategory || !Number.isFinite(a.costSaving) || a.costSaving! < 0)) throw new Error("Complete resolution package and evidence are required.");
  for (const key of ["activityHistory", "reviewHistory"] as const) {
    if (updates[key] && (a[key] ?? []).some((entry, i) => JSON.stringify(entry) !== JSON.stringify(updates[key]![i]))) throw new Error("Historical Action events cannot be removed or rewritten.");
  }
  for (const key of ["evidence", "progressEvidence"] as const) {
    const values = updates[key] ?? a[key] ?? [];
    assertV4EvidenceReferences(values, a.id, a.organizationId!, a.plantId!);
    if (updates[key] && (a[key] ?? []).some((e, i) => JSON.stringify(e) !== JSON.stringify(values[i]))) throw new Error("Historical evidence cannot be removed or rewritten through this path.");
  }
  const next: MyAction = { ...a, ...updates, v4: { ...a.v4!, revision: a.v4!.revision + 1, actualCompleterIds: updates.status === "Pending Auditor Review" ? [...new Set([...a.v4!.actualCompleterIds, actor.id])] : a.v4!.actualCompleterIds } };
  const reads = actionV4ReadSet();
  commitAdministrationV4([{ key: ACTIONS_KEY, before: reads.get(ACTIONS_KEY)!, after: JSON.stringify(rows.map(r => r.id === a.id ? next : r)) }], reads, permission);
  return next;
}
export function narrowAuditTaskHref(path: string) {
  const match = /^\/(?:5s\/)?actions\/([^/]+)$/.exec(path);
  if (!match) return false;
  try { const a = readCanonicalActions().find(a => a.id === decodeURIComponent(match[1])); return Boolean(a && isV4Action(a) && canReadV4Action(a)); } catch { return false; }
}
export function v4VerifierCandidates(a: MyAction) { return getCanonicalAdminUsers().filter(p => eligibleV4Verifier(a, p.id)); }
export function pendingV4Recovery() { return typeof window !== "undefined" && Boolean(window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY)); }
