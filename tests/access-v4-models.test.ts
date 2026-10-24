import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  Department, ZoneChampionAssignment, ZoneLeaderAssignment, DepartmentLeaderAssignment,
  DepartmentMemberAssignment, IndependentVerifierDesignation, DepartmentOriginWorkScope,
  WorkCapacitySnapshot, VerifierSelectionSnapshot, VerifierReplacementHistoryEvent,
} from "@/features/five-s/administration/access-v4-models";
import {
  validateDepartmentDefinition, hasSameDepartmentIdentity, validateDepartmentForNewAssignment,
  validateProposedRoleAssignment, isActiveAssignment, filterActiveRoleAssignments,
  matchesRecordedWorkCapacity, matchesActionSpecificDesignation,
} from "@/features/five-s/administration/access-v4-compatibility";
import type { IndependentAssignment, AssignmentEligibility, OrganizationalCatalog } from "@/features/five-s/administration/access-v4-validators";

const attribution = { createdBy: "P1", createdAt: "2026-01-01", updatedBy: "P1", updatedAt: "2026-01-01" };
const assigned = { assignedBy: "P1", assignedAt: "2026-01-01", status: "Active" as const };
function department(id = "D1", zoneId = "Z1"): Department {
  return { ...attribution, id, organizationId: "C1", plantId: "F1", zoneId, name: "Production", code: id, status: "Active", historyEventIds: ["EVENT"] };
}
function catalog(departments: readonly Department[] = [department()]): OrganizationalCatalog {
  return { clients: [{ id: "C1", status: "Active" }], factories: [{ id: "F1", organizationId: "C1", status: "Active" }, { id: "F2", organizationId: "C1", status: "Active" }],
    zones: [{ id: "Z1", plantId: "F1", status: "Active" }, { id: "Z2", plantId: "F1", status: "Active" }, { id: "Z3", plantId: "F2", status: "Active" }], departments,
    people: ["P1", "P2", "P3"].map(id => ({ id, status: "Active" })) };
}
function leader(id = "L1", personId = "P1", zoneId = "Z1", plantId = "F1"): ZoneLeaderAssignment {
  return { ...assigned, id, personId, organizationId: "C1", plantId, zoneId, role: "Zone Leader" };
}
function champion(id = "CH1", personId = "P1"): ZoneChampionAssignment {
  return { ...assigned, id, personId, organizationId: "C1", plantId: "F1", role: "Zone Champion" };
}
function member(id = "M1", personId = "P1", departmentId = "D1", zoneId = "Z1"): DepartmentMemberAssignment {
  return { ...assigned, id, personId, organizationId: "C1", plantId: "F1", zoneId, departmentId, role: "Department Member" };
}
function validate(p: IndependentAssignment, existing: readonly IndependentAssignment[] = [], departments: readonly Department[] = [department()]) {
  const eligibility: AssignmentEligibility = { ...p, assignmentId: p.id, eligible: true };
  return validateProposedRoleAssignment({ catalog: catalog(departments), proposed: p, existing, eligibility: [eligibility] });
}
function selection(id = "S1", verifierPersonId = "P2"): VerifierSelectionSnapshot {
  return { id, actionId: "TASK", scope: { organizationId: "C1", plantId: "F1", zoneId: "Z1", departmentId: "D1" }, verifierPersonId,
    verifierAuthorization: { kind: "role-assignment", id: "DL1" }, coordinatorPersonId: "P3", coordinatorAuthorizationReference: "EXPLICIT-EXTERNAL-FACT", selectedAt: "2026-01-01" };
}

describe("proposed Department model and structural checks", () => {
  it("represents the complete attributed canonical record", () => {
    const d = department();
    expect(validateDepartmentDefinition(d, catalog(), []).valid).toBe(true);
    expect(d).toMatchObject({ id: "D1", name: "Production", code: "D1", zoneId: "Z1", status: "Active", createdBy: "P1", historyEventIds: ["EVENT"] });
    expectTypeOf(d).toExtend<Department>();
  });
  it("represents multiple Departments in one Zone with distinct names/codes", () => {
    const second = { ...department("D2"), name: "Packing" };
    expect(validateDepartmentDefinition(second, catalog(), [department()]).valid).toBe(true);
  });
  it("allows the same name/code across different Zones", () => {
    const other = { ...department("D2", "Z2"), code: "D1" };
    expect(validateDepartmentDefinition(other, catalog(), [department()]).valid).toBe(true);
  });
  it.each(["name", "code"] as const)("detects duplicate active %s in parent Zone, case-insensitively", key => {
    const first = department();
    const second = { ...department("D2"), name: "Packing", [key]: ` ${first[key].toLowerCase()} ` };
    const result = validateDepartmentDefinition(second, catalog(), [first]);
    expect(result.valid).toBe(false);
    expect(result.violations.map(v => v.code)).toContain(key === "name" ? "DUPLICATE_DEPARTMENT_NAME" : "DUPLICATE_DEPARTMENT_CODE");
  });
  it("rejects canonical ID reuse and empty proposed name/code", () => {
    expect(validateDepartmentDefinition(department(), catalog(), [{ ...department(), status: "Inactive" }]).violations.map(v => v.code)).toContain("DUPLICATE_DEPARTMENT_ID");
    for (const patch of [{ name: "" }, { code: " " }]) expect(validateDepartmentDefinition({ ...department(), ...patch }, catalog(), []).violations.map(v => v.code)).toContain("INVALID_INPUT");
  });
  it("does not treat inactive names as active conflicts or erase their history", () => {
    const first: Department = { ...department(), status: "Inactive" };
    const second = { ...department("D2"), code: "D1" };
    expect(validateDepartmentDefinition(second, catalog(), [first]).valid).toBe(true);
    expect(first.historyEventIds).toEqual(["EVENT"]);
    expect(validateDepartmentDefinition(first, catalog(), []).valid).toBe(true);
  });
  it.each([{ zoneId: "" }, { zoneId: "MISSING" }, { plantId: "F2" }, { organizationId: "UNKNOWN" }])("rejects missing/conflicting parent %j", patch => {
    expect(validateDepartmentDefinition({ ...department(), ...patch }, catalog(), []).valid).toBe(false);
  });
  it("rejects ambiguous parents without choosing the first matching ID", () => {
    const c = catalog();
    expect(validateDepartmentDefinition(department(), { ...c, zones: [...c.zones, c.zones[0]] }, []).violations[0].code).toBe("AMBIGUOUS_ID");
  });
  it("compares immutable identity/parent fields independently of names/status", () => {
    const first = department();
    expect(hasSameDepartmentIdentity(first, { ...first, name: "Renamed", status: "Inactive" })).toBe(true);
    for (const patch of [{ id: "NEW" }, { organizationId: "C2" }, { plantId: "F2" }, { zoneId: "Z2" }]) expect(hasSameDepartmentIdentity(first, { ...first, ...patch })).toBe(false);
  });
  it("requires active Department and parents for a new assignment", () => {
    const d = department();
    expect(validateDepartmentForNewAssignment(d, catalog()).valid).toBe(true);
    expect(validateDepartmentForNewAssignment({ ...d, status: "Inactive" }, catalog()).valid).toBe(false);
    const c = catalog();
    expect(validateDepartmentForNewAssignment(d, { ...c, factories: [{ ...c.factories[0], status: "Inactive" }] }).valid).toBe(false);
  });
});

describe("independent assignment records use Phase 1A validation", () => {
  it("represents multiple factory Champions with no Zone memberships/grants", () => {
    expect(validate(champion(), [champion("CH2", "P2")]).valid).toBe(true);
    expect(champion()).not.toHaveProperty("zoneId");
    expect(champion()).not.toHaveProperty("permissions");
  });
  it("permits multiple leaders of one Zone", () => expect(validate(leader(), [leader("L2", "P2")]).valid).toBe(true));
  it("rejects one person leading two Zones in the same factory", () => {
    expect(validate(leader(), [leader("L2", "P1", "Z2")]).violations.map(v => v.code)).toContain("ZONE_LEADERSHIP_CONFLICT");
  });
  it("allows independent leadership in a different factory", () => expect(validate(leader("L2", "P1", "Z3", "F2"), [leader()]).valid).toBe(true));
  it("represents multiple Department Leaders and Members", () => {
    const dl: DepartmentLeaderAssignment = { ...member(), role: "Department Leader" };
    expect(validate(dl, [{ ...dl, id: "DL2", personId: "P2" }]).valid).toBe(true);
    expect(validate(member(), [member("M2", "P2")]).valid).toBe(true);
  });
  it("allows same-Zone Departments and rejects cross-Zone/alignment conflicts", () => {
    expect(validate(member("M2", "P1", "D2"), [member()], [department(), { ...department("D2"), name: "Packing" }]).valid).toBe(true);
    const wrong = member("M2", "P1", "D3", "Z2");
    expect(validate(wrong, [member()], [department("D3", "Z2")]).violations.map(v => v.code)).toContain("DEPARTMENT_ZONE_CONFLICT");
    expect(validate(wrong, [leader()], [department("D3", "Z2")]).violations.map(v => v.code)).toContain("LED_ZONE_CONFLICT");
  });
  it("rejects duplicate active tuples", () => expect(validate(member(), [member("M2")]).violations.map(v => v.code)).toContain("DUPLICATE_ASSIGNMENT"));
  it("retains attributed revocation and represents reappointment with a new ID", () => {
    const old: ZoneLeaderAssignment = { ...leader(), status: "Revoked", revokedBy: "P2", revokedAt: "2026-01-02", revocationReason: "Explicit review", historyEventIds: ["OLD-EVENT"] };
    const next = leader("NEW-LIFECYCLE");
    expect(isActiveAssignment(old)).toBe(false);
    expect(validate(next, [old]).valid).toBe(true);
    expect(old).toMatchObject({ id: "L1", assignedBy: "P1", revokedBy: "P2", historyEventIds: ["OLD-EVENT"] });
    expect(filterActiveRoleAssignments([old, next], { organizationId: "C1", plantId: "F1", zoneId: "Z1" })).toEqual([next]);
  });
  it("rejects reusing an old lifecycle ID", () => {
    const old: ZoneLeaderAssignment = { ...leader(), status: "Revoked", revokedBy: "P2", revokedAt: "2026-01-02", revocationReason: "Ended" };
    expect(validate(leader(), [old]).valid).toBe(false);
  });
});

describe("recorded capacity and verification history are facts, not grants", () => {
  it("binds capacity to the exact role-assignment ID/person/scope", () => {
    const a = member();
    const snapshot: WorkCapacitySnapshot = { actionId: "TASK", personId: "P1", roleAssignmentId: a.id, capacity: "Department Member", assignmentScope: { organizationId: "C1", plantId: "F1", zoneId: "Z1", departmentId: "D1" }, capturedBy: "P3", capturedAt: "2026-01-01" };
    expect(matchesRecordedWorkCapacity(snapshot, a)).toBe(true);
    for (const patch of [{ id: "OTHER" }, { personId: "P2" }, { zoneId: "Z2" }, { departmentId: "D2" }, { role: "Department Leader" as const }]) expect(matchesRecordedWorkCapacity(snapshot, { ...a, ...patch })).toBe(false);
    // Current revocation does not rewrite an old recorded capacity or re-authorize it.
    expect(matchesRecordedWorkCapacity(snapshot, { ...a, status: "Revoked" })).toBe(true);
    const roles = [a, leader(), champion()];
    expect(roles).toHaveLength(3);
    expect(snapshot.capacity).toBe("Department Member");
    expect(snapshot.roleAssignmentId).toBe("M1");
    const blank = { ...snapshot, assignmentScope: { ...snapshot.assignmentScope, organizationId: "" } };
    expect(matchesRecordedWorkCapacity(blank, { ...a, organizationId: "" })).toBe(false);
  });
  it("records explicit Department work origin", () => {
    const origin: DepartmentOriginWorkScope = { kind: "department", organizationId: "C1", plantId: "F1", zoneId: "Z1", departmentId: "D1" };
    expect(origin).not.toHaveProperty("permissions");
    expect(origin.zoneId).toBe("Z1");
  });
  it("records exactly one verifier and explicit qualification references without inferring eligibility", () => {
    const selected = selection();
    expect(selected.verifierPersonId).toBe("P2");
    expect(selected.verifierAuthorization.id).toBe("DL1");
    expect(selected).not.toHaveProperty("eligible");
    expect(selected).not.toHaveProperty("permissions");
    expect(selected.coordinatorAuthorizationReference).toBe("EXPLICIT-EXTERNAL-FACT");
  });
  it("an Action-specific designation cannot be reused for another Action, scope or person", () => {
    const designation: IndependentVerifierDesignation = { ...assigned, id: "DESIGNATION", personId: "P2", organizationId: "C1", plantId: "F1", actionId: "TASK", capability: "verifyFactoryAdminWork" };
    const request = { actionId: "TASK", organizationId: "C1", plantId: "F1", personId: "P2" };
    expect(matchesActionSpecificDesignation(designation, request)).toBe(true);
    for (const patch of [{ actionId: "OTHER" }, { plantId: "F2" }, { organizationId: "C2" }, { personId: "P1" }]) expect(matchesActionSpecificDesignation(designation, { ...request, ...patch })).toBe(false);
    expect(matchesActionSpecificDesignation({ ...designation, status: "Revoked", revokedBy: "P1", revokedAt: "2026-01-02", revocationReason: "Ended" }, request)).toBe(false);
  });
  it("retains previous verifier selection in a replacement-history record", () => {
    const previous = Object.freeze(selection());
    const replacement = Object.freeze(selection("S2", "P3"));
    const event: VerifierReplacementHistoryEvent = { id: "REPLACE", actionId: "TASK", scope: previous.scope, previousSelection: previous, replacementSelection: replacement, changedBy: "P1", changedAt: "2026-01-02", reason: "Recorded externally authorized replacement" };
    expect(event.previousSelection).toEqual(previous);
    expect(event.replacementSelection).toEqual(replacement);
    expect(previous.verifierPersonId).toBe("P2");
    expect(event).not.toHaveProperty("replacementAuthorized");
  });
});
