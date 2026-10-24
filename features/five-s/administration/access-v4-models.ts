/**
 * Phase 2A proposed, readonly in-memory schemas. Not persisted payloads, runtime
 * grants or replacements for canonical v3/Audit/Action models.
 */
import type { DepartmentRecord } from "./access-v4-validators";

export interface FactoryScope {
  readonly organizationId: string;
  readonly plantId: string;
}
export interface ZoneScope extends FactoryScope { readonly zoneId: string }
export interface DepartmentScope extends ZoneScope { readonly departmentId: string }
export type CanonicalScope =
  | (FactoryScope & { readonly zoneId?: never; readonly departmentId?: never })
  | (ZoneScope & { readonly departmentId?: never })
  | DepartmentScope;

export interface RecordAttribution {
  readonly createdBy: string;
  readonly createdAt: string;
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly revision?: number;
  readonly historyEventIds?: readonly string[];
}
/** Parent IDs are immutable; inactive records retain all identity/history. */
export interface Department extends DepartmentRecord, RecordAttribution {
  readonly name: string;
  readonly code: string;
}
export interface AssignmentAttribution {
  readonly id: string;
  readonly personId: string;
  readonly assignedBy: string;
  readonly assignedAt: string;
  readonly revision?: number;
  readonly historyEventIds?: readonly string[];
}
export type AssignmentLifecycle =
  | { readonly status: "Active"; readonly revokedBy?: never; readonly revokedAt?: never; readonly revocationReason?: never }
  | { readonly status: "Revoked"; readonly revokedBy: string; readonly revokedAt: string; readonly revocationReason: string };
export type ZoneChampionAssignment = AssignmentAttribution & AssignmentLifecycle & FactoryScope & {
  readonly role: "Zone Champion";
  readonly zoneId?: never;
  readonly departmentId?: never;
};
export type ZoneLeaderAssignment = AssignmentAttribution & AssignmentLifecycle & ZoneScope & {
  readonly role: "Zone Leader";
  readonly departmentId?: never;
};
export type DepartmentLeaderAssignment = AssignmentAttribution & AssignmentLifecycle & DepartmentScope & { readonly role: "Department Leader" };
export type DepartmentMemberAssignment = AssignmentAttribution & AssignmentLifecycle & DepartmentScope & { readonly role: "Department Member" };
export type RoleAssignment = ZoneChampionAssignment | ZoneLeaderAssignment | DepartmentLeaderAssignment | DepartmentMemberAssignment;

/** Action-specific CA designation is an attributed fact, never eligibility by itself. */
export type IndependentVerifierDesignation = AssignmentAttribution & AssignmentLifecycle & FactoryScope & {
  readonly actionId: string;
  readonly capability: "verifyFactoryAdminWork";
};
export interface DepartmentOriginWorkScope extends DepartmentScope { readonly kind: "department" }
interface WorkCapacityCapture {
  readonly actionId: string;
  readonly personId: string;
  readonly roleAssignmentId: string;
  readonly capturedBy: string;
  readonly capturedAt: string;
}
/** Exactly one captured capacity/reference, regardless of other roles held later. */
export type WorkCapacitySnapshot = WorkCapacityCapture & (
  | { readonly capacity: "Department Member" | "Department Leader"; readonly assignmentScope: DepartmentScope }
  | { readonly capacity: "Zone Leader"; readonly assignmentScope: ZoneScope & { readonly departmentId?: never } }
  | { readonly capacity: "Factory Admin"; readonly assignmentScope: FactoryScope & { readonly zoneId?: never; readonly departmentId?: never } }
);
export interface VerifierSelectionSnapshot {
  readonly id: string;
  readonly actionId: string;
  readonly scope: CanonicalScope;
  readonly verifierPersonId: string;
  readonly verifierAuthorization: { readonly kind: "role-assignment" | "action-designation"; readonly id: string };
  readonly coordinatorPersonId: string;
  readonly coordinatorAuthorizationReference: string;
  readonly selectedAt: string;
  readonly revision?: number;
}
/** Retains both selections; does not define who may replace a verifier (R01). */
export interface VerifierReplacementHistoryEvent {
  readonly id: string;
  readonly actionId: string;
  readonly scope: CanonicalScope;
  readonly previousSelection: VerifierSelectionSnapshot;
  readonly replacementSelection: VerifierSelectionSnapshot;
  readonly changedBy: string;
  readonly changedAt: string;
  readonly reason: string;
}
/** Explicit new reference, never a legacy display-name fallback. */
export type CanonicalDepartmentReference = DepartmentScope;
