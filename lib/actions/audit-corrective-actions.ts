"use client";
import type { MyAction, MyActionPriority } from "@/features/five-s/types/my-actions";
import type { WorkCapacitySnapshot, VerifierSelectionSnapshot } from "@/features/five-s/administration/access-v4-models";
import { getAccessV4State, type PersistedAssignment } from "@/features/five-s/administration/access-v4-state";
import { getAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { getCanonicalAdminUsers } from "@/features/five-s/administration/store";
import { requireAccessContext } from "@/features/five-s/administration/access-v4-context";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { canExecuteScopedAudit, requireV4AuditContext } from "@/lib/five-s/audit-authorization";
import { questionComplianceResponse } from "@/lib/five-s/scoring-policy";
import { allocateModuleRecordId, withVersionedBusinessCreation } from "@/lib/records/module-records";
import { commitAdministrationV4, withAdministrationLock } from "@/lib/administration-v4-storage";
import { refreshCanonicalActionStore, validateActionDueDate } from "./action-store";
import { ACTIONS_KEY, AUDITS_KEY, actionV4ReadSet, readCanonicalActions, readCanonicalAudits, eligibleWorkCapacity, requireV4ActionBase, canReadV4Action, canWorkV4Action, eligibleV4Coordinator, eligibleV4Verifier, withV4ActionWrite, persistV4ActionUpdate } from "./action-v4-policy";
import { assertV4EvidenceReferences, storeV4Evidence } from "./action-v4-assets";
import { getRecordTombstone } from "@/lib/records/record-tombstones";
export interface CorrectiveActionExpectation { selectionId: string; auditRevision: number; administrationRevision: number }
function captureCapacity(r: PersistedAssignment, actionId: string, capturedBy: string, capturedAt: string): WorkCapacitySnapshot {
  const base = { actionId, capturedBy, capturedAt, personId: r.personId, roleAssignmentId: r.id };
  if (r.role === "Zone Leader") return { ...base, capacity: r.role, assignmentScope: { organizationId: r.organizationId, plantId: r.plantId, zoneId: r.zoneId } };
  if (r.role === "Department Leader" || r.role === "Department Member") return { ...base, capacity: r.role, assignmentScope: { organizationId: r.organizationId, plantId: r.plantId, zoneId: r.zoneId, departmentId: r.departmentId } };
  throw new Error("Unsupported work capacity. Factory-level owner eligibility remains unapproved.");
}
export function correctiveActionOwnerCandidates(auditId: string, questionId: string) {
  const audit = readCanonicalAudits().find(a => a.id === auditId);
  if (!audit || !canExecuteScopedAudit(audit)) return [];
  const q = audit.sections.flatMap(s => s.questions).find(q => q.id === questionId);
  if (!q?.departmentId) return [];
  const people = getCanonicalAdminUsers();
  return getAccessV4State().assignments.filter(r => r.status === "Active" && r.organizationId === audit.organizationId && r.plantId === audit.plantId && r.zoneId === audit.zoneId && (r.role === "Zone Leader" || ((r.role === "Department Leader" || r.role === "Department Member") && r.departmentId === q.departmentId))).filter(r => {
    const snapshot = captureCapacity(r, "candidate", "candidate", "candidate");
    return eligibleWorkCapacity({ organizationId: audit.organizationId, plantId: audit.plantId, zoneId: audit.zoneId, departmentId: q.departmentId }, snapshot);
  }).map(r => ({ id: r.id, name: `${people.find(p => p.id === r.personId)?.name ?? r.personId} · ${r.role}`, personId: r.personId, role: r.role }));
}
export async function createAuditQuestionCorrectiveAction(auditId: string, questionId: string, input: { title: string; description: string; assignmentId: string; dueDate: string; priority: MyActionPriority }, expected: CorrectiveActionExpectation) {
  return withVersionedBusinessCreation(() => withAdministrationLock(() => {
    const audits = readCanonicalAudits(); const rows = readCanonicalActions(); const audit = audits.find(a => a.id === auditId);
    const permission = () => {
      if (!audit || !canExecuteScopedAudit(audit) || getRecordTombstone("audit", auditId)) throw new Error("Current Audit execution authority is required.");
      requireV4AuditContext(audit, { selectionId: expected.selectionId, revision: expected.auditRevision });
      if (getAccessV4State().revision !== expected.administrationRevision) throw new Error("Assignment revision changed. Review the owner selection.");
    };
    permission();
    const questions = audit!.sections.flatMap(s => s.questions).filter(q => q.id === questionId);
    if (questions.length !== 1) throw new Error("Select the exact canonical Audit question.");
    const q = questions[0];
    const existing = rows.filter(a => a.sourceModule === "audit" && a.sourceId === auditId && (a.questionId === questionId || a.sourceObservationId === questionId));
    if (q.actionId || existing.length) {
      const match = existing[0];
      if (existing.length === 1 && q.actionId === match.id && !getRecordTombstone("action", match.id) && canReadV4Action(match)) return match;
      throw new Error("A source link already exists or is inconsistent/deleted. Preserve it for reviewed repair.");
    }
    const compliance = questionComplianceResponse(q);
    if (compliance !== 0 && compliance !== 1) throw new Error("Corrective Actions require a persisted noncompliant finding.");
    if (!q.departmentId) throw new Error("Canonical Department is required. Zone/factory-level owner policy is unsupported; no Department is fabricated.");
    if ((q.questionSource !== "custom" || q.requireEvidenceOnNonCompliance) && !(q.evidence?.length)) throw new Error("Required finding evidence must be durably saved before Action creation.");
    assertV4EvidenceReferences(q.evidence ?? [], auditId, audit!.organizationId!, audit!.plantId!);
    if (!input.title.trim() || !input.description.trim() || !["Low", "Medium", "High", "Critical"].includes(input.priority) || !/^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) || Boolean(validateActionDueDate(input.dueDate))) throw new Error("Title, description, priority and valid future due date are required.");
    const assignment = getAccessV4State().assignments.find(r => r.id === input.assignmentId);
    if (!assignment || !correctiveActionOwnerCandidates(auditId, questionId).some(c => c.id === assignment.id)) throw new Error("Select an active, eligible exact work assignment in the originating Zone/Department.");
    const actor = getAuthenticatedDemoActor()!; const person = getCanonicalAdminUsers().find(p => p.id === assignment.personId)!; const at = new Date().toISOString();
    // Keep the existing globally shared legacy reservation namespace. Tenant scope comes only from explicit record fields.
    const id = allocateModuleRecordId("actions", rows.map(a => a.id));
    const work = captureCapacity(assignment, id, actor.user.id, at);
    const action: MyAction = { id, policyVersion: "ops-access-v4", organizationId: audit!.organizationId, plantId: audit!.plantId, zoneId: audit!.zoneId, departmentId: q.departmentId, v4: { version: 1, revision: 1, workCapacity: work, verifierHistory: [], actualCompleterIds: [] }, title: input.title.trim(), description: input.description.trim(), auditId, questionId, source: "Audit", sourceModule: "audit", sourceId: auditId, sourceTitle: audit!.title, sourceLabel: "Audit", sourceObservationId: questionId, sourceObservation: q.observation ?? q.question, questionText: q.question, plant: audit!.plant, area: audit!.area, department: getAccessV4State().departments.find(d => d.id === q.departmentId)!.name, assignedTo: person.name, responsiblePersonId: person.id, responsiblePersonName: person.name, createdByUserId: actor.user.id, createdByName: actor.user.name, assignedByUserId: actor.user.id, assignedByName: actor.user.name, assignedAt: at, status: "Assigned", priority: input.priority, dueDate: input.dueDate, createdAt: at, evidence: [], progressEvidence: [], issueEvidence: (q.evidence ?? []).map(e => ({ id: e.id, name: e.name, type: e.type, actionId: id, evidenceType: "finding", storageKey: e.storageKey, uploadedAt: e.uploadedAt, uploadedBy: e.uploadedBy })), activityHistory: [{ id: crypto.randomUUID(), type: "created", actorId: actor.user.id, actorName: actor.user.name, createdAt: at }], submissionRevisions: [] };
    if (!eligibleWorkCapacity(action, work)) throw new Error("Owner eligibility changed before publication.");
    const nextAudit = { ...audit!, revision: audit!.revision! + 1, sections: audit!.sections.map(s => ({ ...s, questions: s.questions.map(question => question.id === questionId ? { ...question, actionId: id, actionRequired: true } : question) })) };
    const reads = actionV4ReadSet();
    commitAdministrationV4([{ key: ACTIONS_KEY, before: reads.get(ACTIONS_KEY)!, after: JSON.stringify([action, ...rows]) }, { key: AUDITS_KEY, before: reads.get(AUDITS_KEY)!, after: JSON.stringify(audits.map(a => a.id === auditId ? nextAudit : a)) }], reads, () => { permission(); if (!eligibleWorkCapacity(action, work)) throw new Error("Owner eligibility revoked."); });
    refreshCanonicalActionStore(); window.dispatchEvent?.(new Event("ops-audit-v4-changed")); return action;
  }));
}
export async function selectAuditActionVerifier(actionId: string, verifierId: string, reason: string, expected: { selectionId: string; revision: number }) {
  return withAdministrationLock(() => {
    const rows = readCanonicalActions(); const a = rows.find(a => a.id === actionId); if (!a) throw new Error("Action unavailable.");
    const { actor } = requireV4ActionBase(a); requireAccessContext(expected.selectionId, { organizationId: a.organizationId!, plantId: a.plantId }, "factory");
    if (a.v4!.revision !== expected.revision || a.status === "Completed") throw new Error("Action changed or closed.");
    if (a.v4!.workCapacity.capacity === "Factory Admin") throw new Error("Action-specific FA-work verifier qualification facts are not approved; designation is blocked.");
    if (!eligibleWorkCapacity(a, a.v4!.workCapacity) || !eligibleV4Verifier(a, verifierId) || !eligibleV4Coordinator(a, actor.user.id, verifierId)) throw new Error("An independent authorized coordinator and distinct eligible verifier are required. One-FA factories cannot satisfy the ZL-work pair.");
    const previous = a.v4!.verifierSelection;
    if (previous && !reason.trim()) throw new Error("Verifier replacement requires a reason.");
    const coordinator = getAccessV3State().factoryAdmins.find(r => r.userId === actor.user.id && r.organizationId === a.organizationId && r.plantId === a.plantId && r.status === "Active")!;
    const capacity = a.v4!.workCapacity.capacity;
    const reference = capacity === "Zone Leader" ? getAccessV3State().factoryAdmins.find(r => r.userId === verifierId && r.organizationId === a.organizationId && r.plantId === a.plantId && r.status === "Active") : getAccessV4State().assignments.find(r => r.personId === verifierId && r.organizationId === a.organizationId && r.plantId === a.plantId && r.zoneId === a.zoneId && r.status === "Active" && (capacity === "Department Member" ? r.role === "Department Leader" && r.departmentId === a.departmentId : r.role === "Zone Leader"));
    if (!reference) throw new Error("Explicit verifier authorization reference is unavailable.");
    const selectedAt = new Date().toISOString();
    const selection: VerifierSelectionSnapshot = { id: crypto.randomUUID(), actionId, scope: { organizationId: a.organizationId!, plantId: a.plantId!, zoneId: a.zoneId!, departmentId: a.departmentId! }, verifierPersonId: verifierId, verifierAuthorization: { kind: "role-assignment", id: reference.id }, coordinatorPersonId: actor.user.id, coordinatorAuthorizationReference: coordinator.id, selectedAt };
    const person = getCanonicalAdminUsers().find(p => p.id === verifierId)!;
    const updated: MyAction = { ...a, reviewerId: verifierId, reviewerName: person.name, v4: { ...a.v4!, revision: a.v4!.revision + 1, verifierSelection: selection, verifierHistory: previous ? [...a.v4!.verifierHistory, { id: crypto.randomUUID(), actionId, scope: selection.scope, previousSelection: previous, replacementSelection: selection, changedBy: actor.user.id, changedAt: selectedAt, reason: reason.trim() }] : a.v4!.verifierHistory } };
    const reads = actionV4ReadSet();
    commitAdministrationV4([{ key: ACTIONS_KEY, before: reads.get(ACTIONS_KEY)!, after: JSON.stringify(rows.map(r => r.id === actionId ? updated : r)) }], reads, () => { requireV4ActionBase(a, actor.user.id); if (!eligibleV4Coordinator(a, actor.user.id, verifierId) || !eligibleV4Verifier(a, verifierId)) throw new Error("Selection eligibility changed."); });
    refreshCanonicalActionStore(); return updated;
  });
}
export async function uploadAuditActionEvidence(actionId: string, file: File, kind: "progress" | "resolution", expected: { selectionId: string; revision: number }) {
  const actor = getAuthenticatedDemoActor();
  const authorize = () => { const current = readCanonicalActions().find(a => a.id === actionId); if (!current || current.v4?.revision !== expected.revision || current.status !== "In Progress" || !actor || !canWorkV4Action(current, actor.user.id)) throw new Error("Current owner, unchanged Action and started work required for upload."); };
  authorize();
  const receipt = await storeV4Evidence(actionId, file, expected.selectionId, authorize);
  return withV4ActionWrite(() => {
    authorize(); const current = readCanonicalActions().find(a => a.id === actionId)!;
    const evidence = { ...receipt, name: file.name, type: file.type.startsWith("image/") ? "image" as const : "document" as const, mimeType: file.type, actionId, evidenceType: kind };
    const history = [...(current.activityHistory ?? []), { id: crypto.randomUUID(), type: "evidence_uploaded" as const, actorId: actor!.user.id, actorName: actor!.user.name, createdAt: new Date().toISOString(), remark: `${kind} evidence: ${file.name}` }];
    const result = persistV4ActionUpdate(current, kind === "progress" ? { progressEvidence: [...(current.progressEvidence ?? []), evidence], activityHistory: history } : { evidence: [...current.evidence, evidence], activityHistory: history }, { id: actor!.user.id, name: actor!.user.name, v4Expectation: expected });
    refreshCanonicalActionStore(); return result;
  });
}
