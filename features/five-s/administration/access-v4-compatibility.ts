/** Phase 2A read-only descriptions/comparisons. No migration or authorization. */
import {
  validateIndependentRoleAssignment, validateOrganizationalParentChain,
  type AssignmentProposal, type IndependentAssignment, type OrganizationalCatalog,
  type OrganizationalScope, type ValidationResult, type ViolationCode,
} from "./access-v4-validators";
import type {
  CanonicalDepartmentReference, CanonicalScope, Department, IndependentVerifierDesignation,
  RoleAssignment, VerifierSelectionSnapshot, WorkCapacitySnapshot, ZoneLeaderAssignment,
} from "./access-v4-models";

export type CompatibilityProblem = "MISSING_REFERENCE" | "UNRESOLVED_REFERENCE" | "AMBIGUOUS_REFERENCE" | "PARENT_CONFLICT";
export type CompatibilityResult<Value, Legacy> =
  | { readonly kind: "legacy-only"; readonly legacy: Legacy; readonly reason: "LEGACY_ONLY" }
  | { readonly kind: "v4-reference"; readonly legacy: Legacy; readonly value: Value }
  | { readonly kind: "unresolved"; readonly legacy: Legacy; readonly reason: CompatibilityProblem };
const nonempty = (id: string | undefined): id is string => typeof id === "string" && id.trim().length > 0;
function lookup<T extends { readonly id: string }>(items: readonly T[], id: string | undefined): { value?: T; problem?: CompatibilityProblem } {
  if (!nonempty(id)) return { problem: "MISSING_REFERENCE" };
  const found = items.filter(item => item.id === id);
  return found.length === 1 ? { value: found[0] } : { problem: found.length ? "AMBIGUOUS_REFERENCE" : "UNRESOLVED_REFERENCE" };
}
/** Historical identity resolution deliberately does not turn inactivity into lost history. */
function scopeProblem(catalog: OrganizationalCatalog, scope: OrganizationalScope): CompatibilityProblem | undefined {
  const client = lookup(catalog.clients, scope.organizationId);
  if (client.problem) return client.problem;
  const factory = lookup(catalog.factories, scope.plantId);
  if (factory.problem) return factory.problem;
  if (factory.value?.organizationId !== scope.organizationId) return "PARENT_CONFLICT";
  if (scope.zoneId === undefined) return scope.departmentId === undefined ? undefined : "MISSING_REFERENCE";
  const zone = lookup(catalog.zones, scope.zoneId);
  if (zone.problem) return zone.problem;
  if (zone.value?.plantId !== scope.plantId) return "PARENT_CONFLICT";
  if (scope.departmentId === undefined) return;
  const department = lookup(catalog.departments, scope.departmentId);
  if (department.problem) return department.problem;
  if (department.value?.organizationId !== scope.organizationId || department.value.plantId !== scope.plantId || department.value.zoneId !== scope.zoneId) return "PARENT_CONFLICT";
}
function sameScope(a: OrganizationalScope, b: OrganizationalScope) {
  return a.organizationId === b.organizationId && a.plantId === b.plantId && a.zoneId === b.zoneId && a.departmentId === b.departmentId;
}
function departmentDescription<Legacy extends { readonly department?: string }>(
  legacy: Legacy, reference: CanonicalDepartmentReference | undefined,
  catalog: OrganizationalCatalog, departments: readonly Department[],
): CompatibilityResult<Department, Legacy> {
  if (reference === undefined) return typeof legacy.department === "string"
    ? { kind: "legacy-only", legacy, reason: "LEGACY_ONLY" }
    : { kind: "unresolved", legacy, reason: "MISSING_REFERENCE" };
  const problem = scopeProblem(catalog, reference);
  if (problem) return { kind: "unresolved", legacy, reason: problem };
  const found = lookup(departments, reference.departmentId);
  if (found.problem) return { kind: "unresolved", legacy, reason: found.problem };
  if (!found.value || !sameScope({ ...found.value, departmentId: found.value.id }, reference)) return { kind: "unresolved", legacy, reason: "PARENT_CONFLICT" };
  return { kind: "v4-reference", legacy, value: found.value };
}
/** Strings remain snapshots even if a Department happens to have that name. */
export function describeZoneDepartment<Legacy extends { readonly department?: string }>(
  legacy: Legacy, reference: CanonicalDepartmentReference | undefined,
  catalog: OrganizationalCatalog, departments: readonly Department[],
): CompatibilityResult<Department, Legacy> { return departmentDescription(legacy, reference, catalog, departments); }
export function describeAuditDepartment<Legacy extends { readonly department?: string }>(
  legacy: Legacy, reference: CanonicalDepartmentReference | undefined,
  catalog: OrganizationalCatalog, departments: readonly Department[],
): CompatibilityResult<Department, Legacy> { return departmentDescription(legacy, reference, catalog, departments); }

/** Returns explicit lifecycles alongside the original legacy object, never replaces leaderId. */
export function describeZoneLeadership<Legacy extends { readonly leaderId?: string }>(
  legacy: Legacy, scope: { readonly organizationId: string; readonly plantId: string; readonly zoneId: string },
  catalog: OrganizationalCatalog, assignments: readonly ZoneLeaderAssignment[],
): CompatibilityResult<readonly ZoneLeaderAssignment[], Legacy> {
  const problem = scopeProblem(catalog, scope);
  if (problem) return { kind: "unresolved", legacy, reason: problem };
  const candidates = assignments.filter(a => a.zoneId === scope.zoneId);
  if (candidates.some(a => a.organizationId !== scope.organizationId || a.plantId !== scope.plantId)) return { kind: "unresolved", legacy, reason: "PARENT_CONFLICT" };
  if (!candidates.length) return nonempty(legacy.leaderId)
    ? { kind: "legacy-only", legacy, reason: "LEGACY_ONLY" }
    : { kind: "unresolved", legacy, reason: "MISSING_REFERENCE" };
  for (const a of candidates) {
    if (!nonempty(a.id) || !nonempty(a.personId)) return { kind: "unresolved", legacy, reason: "MISSING_REFERENCE" };
    if (assignments.filter(other => other.id === a.id).length !== 1) return { kind: "unresolved", legacy, reason: "AMBIGUOUS_REFERENCE" };
    const person = lookup(catalog.people, a.personId);
    if (person.problem) return { kind: "unresolved", legacy, reason: person.problem };
  }
  return { kind: "v4-reference", legacy, value: candidates };
}

/** A selection reference is not a finding that its verifier/coordinator is eligible. */
export function describeActionReviewer<Legacy extends { readonly reviewerId?: string; readonly reviewerName?: string; readonly auditor?: string }>(
  legacy: Legacy, selectionId: string | undefined, selections: readonly VerifierSelectionSnapshot[],
  request: { readonly actionId: string; readonly scope: CanonicalScope }, catalog: OrganizationalCatalog,
): CompatibilityResult<VerifierSelectionSnapshot, Legacy> {
  if (selectionId === undefined) return nonempty(legacy.reviewerId) || nonempty(legacy.reviewerName) || nonempty(legacy.auditor)
    ? { kind: "legacy-only", legacy, reason: "LEGACY_ONLY" }
    : { kind: "unresolved", legacy, reason: "MISSING_REFERENCE" };
  if (!nonempty(request.actionId)) return { kind: "unresolved", legacy, reason: "MISSING_REFERENCE" };
  const problem = scopeProblem(catalog, request.scope);
  if (problem) return { kind: "unresolved", legacy, reason: problem };
  const found = lookup(selections, selectionId);
  if (found.problem) return { kind: "unresolved", legacy, reason: found.problem };
  const selection = found.value;
  if (!selection || selection.actionId !== request.actionId || !sameScope(selection.scope, request.scope)) return { kind: "unresolved", legacy, reason: "PARENT_CONFLICT" };
  for (const id of [selection.verifierPersonId, selection.coordinatorPersonId]) {
    const person = lookup(catalog.people, id);
    if (person.problem) return { kind: "unresolved", legacy, reason: person.problem };
  }
  if (!nonempty(selection.verifierAuthorization.id) || !nonempty(selection.coordinatorAuthorizationReference)) return { kind: "unresolved", legacy, reason: "MISSING_REFERENCE" };
  return { kind: "v4-reference", legacy, value: selection };
}

/** Lifecycle/data filtering only; neither helper computes effective authority. */
export function isActiveAssignment(assignment: { readonly status: string }): boolean { return assignment.status === "Active"; }
export function filterActiveRoleAssignments(assignments: readonly RoleAssignment[], scope: CanonicalScope): readonly RoleAssignment[] {
  if (!nonempty(scope.organizationId) || !nonempty(scope.plantId)
    || (scope.zoneId !== undefined && !nonempty(scope.zoneId))
    || (scope.departmentId !== undefined && (!nonempty(scope.departmentId) || !nonempty(scope.zoneId)))) return [];
  // Exact scope: a factory Champion never becomes a Zone/Department membership.
  return assignments.filter(a => isActiveAssignment(a) && sameScope(a, scope));
}
export function validateProposedRoleAssignment(input: AssignmentProposal): ValidationResult { return validateIndependentRoleAssignment(input); }
export function hasSameDepartmentIdentity(a: Department, b: Department): boolean {
  return [a.id, a.organizationId, a.plantId, a.zoneId, b.id, b.organizationId, b.plantId, b.zoneId].every(nonempty)
    && a.id === b.id && a.organizationId === b.organizationId && a.plantId === b.plantId && a.zoneId === b.zoneId;
}
/** Status/parent facts only, not membership eligibility or a deactivation guard (R08). */
export function validateDepartmentForNewAssignment(department: Department, catalog: OrganizationalCatalog): ValidationResult {
  const errors = [...validateOrganizationalParentChain(catalog, { ...department, departmentId: department.id }).violations];
  if (department.status !== "Active" && !errors.some(e => e.code === "INACTIVE_RECORD" && e.recordIds.includes(department.id))) errors.push({ code: "INACTIVE_RECORD", recordIds: [department.id] });
  return { valid: errors.length === 0, violations: errors };
}
export interface DepartmentDefinitionResult {
  readonly valid: boolean;
  readonly violations: readonly { readonly code: ViolationCode | "DUPLICATE_DEPARTMENT_ID" | "DUPLICATE_DEPARTMENT_NAME" | "DUPLICATE_DEPARTMENT_CODE"; readonly recordIds: readonly string[] }[];
}
/** Proposed active name/code uniqueness; does not create a record or reserve a name. */
export function validateDepartmentDefinition(department: Department, catalog: OrganizationalCatalog, existing: readonly Department[]): DepartmentDefinitionResult {
  const violations: { code: ViolationCode | "DUPLICATE_DEPARTMENT_ID" | "DUPLICATE_DEPARTMENT_NAME" | "DUPLICATE_DEPARTMENT_CODE"; recordIds: readonly string[] }[] = [];
  const problem = scopeProblem({ ...catalog, departments: [department] }, { ...department, departmentId: department.id });
  if (problem) violations.push({ code: problem === "MISSING_REFERENCE" ? "MISSING_ID" : problem === "AMBIGUOUS_REFERENCE" ? "AMBIGUOUS_ID" : problem === "PARENT_CONFLICT" ? "PARENT_CONFLICT" : "UNRESOLVED_ID", recordIds: [department.id] });
  if (!nonempty(department.name) || !nonempty(department.code)) violations.push({ code: "INVALID_INPUT", recordIds: [department.id] });
  for (const other of existing) {
    if (other.id === department.id) violations.push({ code: "DUPLICATE_DEPARTMENT_ID", recordIds: [department.id, other.id] });
    if (department.status !== "Active" || other.status !== "Active" || other.organizationId !== department.organizationId || other.plantId !== department.plantId || other.zoneId !== department.zoneId) continue;
    if (other.name.trim().toLowerCase() === department.name.trim().toLowerCase()) violations.push({ code: "DUPLICATE_DEPARTMENT_NAME", recordIds: [department.id, other.id] });
    if (other.code.trim().toLowerCase() === department.code.trim().toLowerCase()) violations.push({ code: "DUPLICATE_DEPARTMENT_CODE", recordIds: [department.id, other.id] });
  }
  return { valid: violations.length === 0, violations };
}
/** Historical exact reference comparison; revocation does not rewrite a captured capacity. */
export function matchesRecordedWorkCapacity(snapshot: WorkCapacitySnapshot, assignment: IndependentAssignment): boolean {
  return nonempty(snapshot.actionId) && nonempty(snapshot.personId) && nonempty(snapshot.roleAssignmentId)
    && nonempty(snapshot.assignmentScope.organizationId) && nonempty(snapshot.assignmentScope.plantId)
    && (snapshot.capacity === "Factory Admin" || nonempty(snapshot.assignmentScope.zoneId))
    && ((snapshot.capacity !== "Department Leader" && snapshot.capacity !== "Department Member") || nonempty(snapshot.assignmentScope.departmentId))
    && snapshot.roleAssignmentId === assignment.id && snapshot.personId === assignment.personId
    && snapshot.capacity === assignment.role && sameScope(snapshot.assignmentScope, assignment);
}
/** Exact active designation reference only, not independent verifier qualification. */
export function matchesActionSpecificDesignation(designation: IndependentVerifierDesignation, request: {
  readonly actionId: string; readonly organizationId: string; readonly plantId: string; readonly personId: string;
}): boolean {
  return [designation.id, request.actionId, request.organizationId, request.plantId, request.personId].every(nonempty)
    && designation.status === "Active" && designation.actionId === request.actionId
    && designation.organizationId === request.organizationId && designation.plantId === request.plantId && designation.personId === request.personId;
}
