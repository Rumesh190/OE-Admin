/**
 * Phase 1A structural validation only. No runtime wiring, stores or permissions.
 * Eligibility facts must come from an independently authorized caller in any
 * future integration; a valid result never authorizes an operational command.
 */
export interface CanonicalRecord { readonly id: string; readonly status: "Active" | "Inactive" }
export interface FactoryRecord extends CanonicalRecord { readonly organizationId: string }
export interface ZoneRecord extends CanonicalRecord { readonly plantId: string }
export interface DepartmentRecord extends CanonicalRecord {
  readonly organizationId: string;
  readonly plantId: string;
  readonly zoneId: string;
}
export interface OrganizationalCatalog {
  readonly clients: readonly CanonicalRecord[];
  readonly factories: readonly FactoryRecord[];
  readonly zones: readonly ZoneRecord[];
  readonly departments: readonly DepartmentRecord[];
  readonly people: readonly CanonicalRecord[];
}
export interface OrganizationalScope {
  readonly organizationId: string;
  readonly plantId: string;
  readonly zoneId?: string;
  readonly departmentId?: string;
}
export type IndependentRole = "Factory Admin" | "Zone Champion" | "Zone Leader" | "Department Leader" | "Department Member";
export interface IndependentAssignment extends OrganizationalScope {
  readonly id: string;
  readonly personId: string;
  readonly role: IndependentRole;
  readonly status: "Active" | "Inactive" | "Revoked";
}
/** A supplied decision about this exact tuple; this module cannot establish eligibility. */
export interface AssignmentEligibility extends OrganizationalScope {
  readonly assignmentId: string;
  readonly personId: string;
  readonly role: IndependentRole;
  readonly eligible: boolean;
}
export type ViolationCode =
  | "MISSING_ID" | "UNRESOLVED_ID" | "AMBIGUOUS_ID" | "INACTIVE_RECORD"
  | "PARENT_CONFLICT" | "INVALID_ROLE_SCOPE" | "INVALID_ROLE" | "INVALID_INPUT"
  | "DUPLICATE_ASSIGNMENT" | "ZONE_LEADERSHIP_CONFLICT" | "DEPARTMENT_ZONE_CONFLICT"
  | "LED_ZONE_CONFLICT" | "ELIGIBILITY_REQUIRED" | "INACTIVE_ASSIGNMENT"
  | "ACTION_ZONE_CONFLICT" | "VERIFIER_REQUIRED" | "COORDINATOR_REQUIRED"
  | "INDEPENDENCE_CONFLICT" | "DESIGNATION_SCOPE_CONFLICT";
export interface Violation {
  readonly code: ViolationCode;
  readonly recordIds: readonly string[];
}
export interface ValidationResult {
  readonly valid: boolean;
  readonly violations: readonly Violation[];
}
const result = (violations: Violation[]): ValidationResult => ({ valid: violations.length === 0, violations });
function issue(violations: Violation[], code: ViolationCode, ...ids: (string | undefined)[]) {
  violations.push({ code, recordIds: ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0) });
}
function resolve<T extends CanonicalRecord>(records: readonly T[], id: string | undefined, violations: Violation[]): T | undefined {
  if (typeof id !== "string" || !id.trim()) { issue(violations, "MISSING_ID"); return; }
  const matches = records.filter(record => record.id === id);
  if (matches.length !== 1) { issue(violations, matches.length ? "AMBIGUOUS_ID" : "UNRESOLVED_ID", id); return; }
  if (matches[0].status !== "Active") issue(violations, "INACTIVE_RECORD", id);
  return matches[0];
}
function scopeChecks(catalog: OrganizationalCatalog, scope: OrganizationalScope, depth: "factory" | "zone" | "department", errors: Violation[]) {
  resolve(catalog.clients, scope.organizationId, errors);
  const factory = resolve(catalog.factories, scope.plantId, errors);
  if (factory && factory.organizationId !== scope.organizationId) issue(errors, "PARENT_CONFLICT", factory.id, scope.organizationId);
  if (depth === "factory") return;
  const zone = resolve(catalog.zones, scope.zoneId, errors);
  if (zone && zone.plantId !== scope.plantId) issue(errors, "PARENT_CONFLICT", zone.id, scope.plantId);
  if (depth === "zone") return;
  const department = resolve(catalog.departments, scope.departmentId, errors);
  if (department && (department.organizationId !== scope.organizationId || department.plantId !== scope.plantId || department.zoneId !== scope.zoneId)) {
    issue(errors, "PARENT_CONFLICT", department.id, scope.zoneId, scope.plantId, scope.organizationId);
  }
}
/** Validates a new operational Department chain; never resolves display names. */
export function validateOrganizationalParentChain(catalog: OrganizationalCatalog, scope: OrganizationalScope): ValidationResult {
  const errors: Violation[] = [];
  scopeChecks(catalog, scope, "department", errors);
  return result(errors);
}
const roles: readonly IndependentRole[] = ["Factory Admin", "Zone Champion", "Zone Leader", "Department Leader", "Department Member"];
const departmentRole = (role: IndependentRole) => role === "Department Leader" || role === "Department Member";
function sameScope(a: OrganizationalScope, b: OrganizationalScope) {
  return a.organizationId === b.organizationId && a.plantId === b.plantId && a.zoneId === b.zoneId && a.departmentId === b.departmentId;
}
function eligible(assignment: IndependentAssignment, facts: readonly AssignmentEligibility[]) {
  const matches = facts.filter(fact => fact.assignmentId === assignment.id);
  return matches.length === 1 && matches[0].eligible === true && matches[0].personId === assignment.personId
    && matches[0].role === assignment.role && sameScope(matches[0], assignment);
}
export interface AssignmentProposal {
  readonly catalog: OrganizationalCatalog;
  readonly proposed: IndependentAssignment;
  readonly existing: readonly IndependentAssignment[];
  readonly eligibility: readonly AssignmentEligibility[];
}
/** Checks only a proposed active assignment; unrelated/ended historical rows are not normalized. */
export function validateIndependentRoleAssignment(input: AssignmentProposal): ValidationResult {
  const { catalog, proposed: p, existing, eligibility } = input;
  const errors: Violation[] = [];
  if (!p.id?.trim()) issue(errors, "MISSING_ID");
  if (!roles.includes(p.role)) { issue(errors, "INVALID_ROLE", p.id); return result(errors); }
  if (!["Active", "Inactive", "Revoked"].includes(p.status)) { issue(errors, "INVALID_INPUT", p.id); return result(errors); }
  // Ended assignments remain representable, but never count in current conflicts or eligibility.
  if (p.status !== "Active") return result(errors);
  resolve(catalog.people, p.personId, errors);
  const depth = departmentRole(p.role) ? "department" : p.role === "Zone Leader" ? "zone" : "factory";
  scopeChecks(catalog, p, depth, errors);
  if ((depth === "factory" && (p.zoneId !== undefined || p.departmentId !== undefined)) || (depth === "zone" && p.departmentId !== undefined)) {
    issue(errors, "INVALID_ROLE_SCOPE", p.id);
  }
  if (!eligible(p, eligibility)) issue(errors, "ELIGIBILITY_REQUIRED", p.id, p.personId);
  for (const old of existing) {
    if (old.id === p.id) issue(errors, "DUPLICATE_ASSIGNMENT", p.id, old.id);
    if (old.status !== "Active") continue;
    if (old.id !== p.id && old.personId === p.personId && old.role === p.role && sameScope(old, p)) {
      issue(errors, "DUPLICATE_ASSIGNMENT", p.id, old.id);
    }
    if (old.personId !== p.personId || old.plantId !== p.plantId) continue;
    if (old.organizationId !== p.organizationId) { issue(errors, "PARENT_CONFLICT", p.id, old.id); continue; }
    if (old.role === "Zone Leader" && p.role === "Zone Leader" && old.zoneId !== p.zoneId) issue(errors, "ZONE_LEADERSHIP_CONFLICT", p.id, old.id);
    if (departmentRole(old.role) && departmentRole(p.role) && old.zoneId !== p.zoneId) issue(errors, "DEPARTMENT_ZONE_CONFLICT", p.id, old.id);
    if ((old.role === "Zone Leader" && departmentRole(p.role) && old.zoneId !== p.zoneId)
      || (p.role === "Zone Leader" && departmentRole(old.role) && old.zoneId !== p.zoneId)) issue(errors, "LED_ZONE_CONFLICT", p.id, old.id);
  }
  return result(errors);
}
export function validateZoneLeaderAssignment(input: AssignmentProposal): ValidationResult {
  if (input.proposed.role !== "Zone Leader") return result([{ code: "INVALID_ROLE", recordIds: [input.proposed.id] }]);
  return validateIndependentRoleAssignment(input);
}
export function validateDepartmentAssignment(input: AssignmentProposal): ValidationResult {
  if (!departmentRole(input.proposed.role)) return result([{ code: "INVALID_ROLE", recordIds: [input.proposed.id] }]);
  return validateIndependentRoleAssignment(input);
}
/** U03 structural predicate, not an owner-selection or Action authorization policy. */
export function validateDepartmentActionOwner(input: {
  readonly catalog: OrganizationalCatalog;
  readonly origin: OrganizationalScope;
  readonly responsiblePersonId: string;
  readonly assignment?: IndependentAssignment;
  readonly eligibility: readonly AssignmentEligibility[];
}): ValidationResult {
  const errors = [...validateOrganizationalParentChain(input.catalog, input.origin).violations];
  const a = input.assignment;
  if (!a) { issue(errors, "ELIGIBILITY_REQUIRED", input.responsiblePersonId); return result(errors); }
  if (a.status !== "Active") issue(errors, "INACTIVE_ASSIGNMENT", a.id);
  errors.push(...validateIndependentRoleAssignment({ catalog: input.catalog, proposed: a, existing: [], eligibility: input.eligibility }).violations);
  if (a.personId !== input.responsiblePersonId || !a.zoneId || a.organizationId !== input.origin.organizationId || a.plantId !== input.origin.plantId || a.zoneId !== input.origin.zoneId) {
    issue(errors, "ACTION_ZONE_CONFLICT", a.id, input.origin.departmentId, input.responsiblePersonId);
  }
  return result(errors);
}
export interface ReviewEligibilityFact extends OrganizationalScope {
  readonly personId: string;
  readonly actionId: string;
  readonly eligible: boolean;
}
export interface ActionVerifierDesignation extends ReviewEligibilityFact { readonly status: "Active" | "Revoked" }
/** Explicit qualification decisions are inputs. This does not grant/select/replace a verifier. */
export function validateIndependentVerification(input: {
  readonly stage: "draft" | "submission";
  readonly actionId: string;
  readonly scope: OrganizationalScope;
  readonly creatorId: string;
  readonly completerIds: readonly string[];
  readonly verifier?: ReviewEligibilityFact;
  readonly coordinator?: ReviewEligibilityFact;
  readonly factoryAdminWork: boolean;
  readonly designation?: ActionVerifierDesignation;
}): ValidationResult {
  const errors: Violation[] = [];
  for (const id of [input.actionId, input.creatorId, input.scope.organizationId, input.scope.plantId, ...input.completerIds]) {
    if (typeof id !== "string" || !id.trim()) issue(errors, "MISSING_ID");
  }
  if (!["draft", "submission"].includes(input.stage) || typeof input.factoryAdminWork !== "boolean") issue(errors, "INVALID_INPUT", input.actionId);
  if (input.scope.zoneId !== undefined && !input.scope.zoneId.trim()) issue(errors, "MISSING_ID");
  if (input.scope.departmentId !== undefined && (!input.scope.departmentId.trim() || !input.scope.zoneId?.trim())) issue(errors, "MISSING_ID");
  const excluded = [input.creatorId, ...input.completerIds];
  if (!input.verifier) {
    if (input.stage === "submission") issue(errors, "VERIFIER_REQUIRED", input.actionId);
    return result(errors);
  }
  for (const fact of [input.verifier, input.coordinator]) {
    if (!fact) { issue(errors, "COORDINATOR_REQUIRED", input.actionId); continue; }
    if (!fact.personId?.trim()) issue(errors, "MISSING_ID");
    if (fact.eligible !== true || fact.actionId !== input.actionId || !sameScope(fact, input.scope)) issue(errors, "ELIGIBILITY_REQUIRED", fact.personId, input.actionId);
    if (excluded.includes(fact.personId)) issue(errors, "INDEPENDENCE_CONFLICT", fact.personId, input.actionId);
  }
  if (input.factoryAdminWork) {
    const d = input.designation;
    if (!d || d.status !== "Active" || d.eligible !== true || d.personId !== input.verifier.personId || d.actionId !== input.actionId || !sameScope(d, input.scope)) {
      issue(errors, "DESIGNATION_SCOPE_CONFLICT", input.actionId, d?.actionId);
    }
  }
  return result(errors);
}
