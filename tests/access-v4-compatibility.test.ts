import { describe, expect, it, vi } from "vitest";
import {
  describeZoneDepartment, describeAuditDepartment, describeZoneLeadership, describeActionReviewer,
  filterActiveRoleAssignments, isActiveAssignment, hasSameDepartmentIdentity,
  validateDepartmentDefinition, validateDepartmentForNewAssignment, matchesRecordedWorkCapacity,
} from "@/features/five-s/administration/access-v4-compatibility";
import type { Department, ZoneLeaderAssignment, ZoneChampionAssignment, VerifierSelectionSnapshot } from "@/features/five-s/administration/access-v4-models";
import type { OrganizationalCatalog } from "@/features/five-s/administration/access-v4-validators";

function fixture() {
  const department: Department = { id: "D1", organizationId: "C1", plantId: "F1", zoneId: "Z1", name: "Production", code: "PR", status: "Active", createdBy: "P1", createdAt: "2026-01-01", updatedBy: "P1", updatedAt: "2026-01-01" };
  const catalog: OrganizationalCatalog = {
    clients: [{ id: "C1", status: "Active" }], factories: [{ id: "F1", organizationId: "C1", status: "Active" }],
    zones: [{ id: "Z1", plantId: "F1", status: "Active" }, { id: "Z2", plantId: "F1", status: "Active" }], departments: [department],
    people: ["P1", "P2", "P3"].map(id => ({ id, status: "Active" })),
  };
  const reference = { organizationId: "C1", plantId: "F1", zoneId: "Z1", departmentId: "D1" };
  const scope = { organizationId: "C1", plantId: "F1", zoneId: "Z1" };
  const assignment: ZoneLeaderAssignment = { id: "L1", personId: "P1", role: "Zone Leader", status: "Active", ...scope, assignedBy: "P2", assignedAt: "2026-01-01" };
  const selection: VerifierSelectionSnapshot = { id: "S1", actionId: "TASK", scope: reference, verifierPersonId: "P2", verifierAuthorization: { kind: "role-assignment", id: "L1" }, coordinatorPersonId: "P3", coordinatorAuthorizationReference: "QUALIFICATION-FACT", selectedAt: "2026-01-01" };
  return { department, catalog, reference, scope, assignment, selection };
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}

describe("Department compatibility distinguishes display strings from canonical refs", () => {
  it("leaves a v3 Zone string unchanged, even when a Department name matches", () => {
    const { catalog, department } = fixture();
    const legacy = { id: "Z1", department: "Production", leaderId: "OLD-LEADER" };
    const result = describeZoneDepartment(legacy, undefined, catalog, [department]);
    expect(result).toEqual({ kind: "legacy-only", legacy, reason: "LEGACY_ONLY" });
    expect(result).not.toHaveProperty("value");
    expect(legacy.department).toBe("Production");
  });
  it("resolves an explicit canonical Department without replacing the old display", () => {
    const { catalog, department, reference } = fixture();
    const legacy = { department: "Historical name" };
    const result = describeZoneDepartment(legacy, reference, catalog, [department]);
    expect(result).toEqual({ kind: "v4-reference", legacy, value: department });
    expect(legacy.department).toBe("Historical name");
  });
  it("retains an inactive Department as history, without new-assignment eligibility", () => {
    const f = fixture();
    const department: Department = { ...f.department, status: "Inactive" };
    const catalog = { ...f.catalog, departments: [department] };
    expect(describeAuditDepartment({ department: "Production" }, f.reference, catalog, [department]).kind).toBe("v4-reference");
    expect(validateDepartmentForNewAssignment(department, catalog).valid).toBe(false);
  });
  it("does not erase retained references when parents become inactive", () => {
    const f = fixture();
    const catalog = { ...f.catalog, clients: [{ ...f.catalog.clients[0], status: "Inactive" as const }] };
    expect(describeZoneDepartment({ department: "Legacy" }, f.reference, catalog, [f.department]).kind).toBe("v4-reference");
    expect(validateDepartmentForNewAssignment(f.department, catalog).valid).toBe(false);
  });
  it.each(["", "UNKNOWN", "Production"])("returns explicit unresolved result for canonical ID %j", departmentId => {
    const f = fixture();
    const result = describeZoneDepartment({ department: "Production" }, { ...f.reference, departmentId }, f.catalog, [f.department]);
    expect(result.kind).toBe("unresolved");
    expect(result).not.toHaveProperty("value");
  });
  it("reports missing legacy/canonical information without a fabricated ID", () => {
    const f = fixture();
    expect(describeZoneDepartment({}, undefined, f.catalog, [f.department])).toEqual({ kind: "unresolved", legacy: {}, reason: "MISSING_REFERENCE" });
  });
  it("does not resolve duplicate canonical Department IDs", () => {
    const f = fixture();
    expect(describeZoneDepartment({ department: "Legacy" }, f.reference, { ...f.catalog, departments: [f.department, f.department] }, [f.department]).kind).toBe("unresolved");
    expect(describeZoneDepartment({ department: "Legacy" }, f.reference, f.catalog, [f.department, f.department])).toMatchObject({ kind: "unresolved", reason: "AMBIGUOUS_REFERENCE" });
  });
  it("rejects a reference belonging to another Zone/Factory/Client", () => {
    const f = fixture();
    for (const patch of [{ zoneId: "Z2" }, { plantId: "MISSING" }, { organizationId: "OTHER" }]) {
      expect(describeZoneDepartment({ department: "Legacy" }, { ...f.reference, ...patch }, f.catalog, [f.department]).kind).toBe("unresolved");
    }
  });
  it("does not trust conflicting parent IDs in richer Department models", () => {
    const f = fixture();
    expect(describeZoneDepartment({ department: "Legacy" }, f.reference, f.catalog, [{ ...f.department, zoneId: "Z2" }])).toMatchObject({ kind: "unresolved", reason: "PARENT_CONFLICT" });
  });
  it("preserves historical Audit snapshots/signature and assignment arrays intact", () => {
    const f = fixture();
    const audit = freeze({ id: "AUDIT-OLD", department: "Original department", auditorSignature: { userId: "ORIGINAL", signedAt: "2020-01-01" }, signatureHistory: [{ userId: "OLD" }], assignmentHistory: [{ auditorId: "OLD" }] });
    const before = JSON.stringify(audit);
    expect(describeAuditDepartment(audit, undefined, f.catalog, [f.department])).toEqual({ kind: "legacy-only", legacy: audit, reason: "LEGACY_ONLY" });
    expect(describeAuditDepartment(audit, f.reference, f.catalog, [f.department])).toMatchObject({ kind: "v4-reference", legacy: audit });
    expect(JSON.stringify(audit)).toBe(before);
  });
});

describe("leadership descriptions preserve both generations independently", () => {
  it("does not convert a legacy leaderId into an explicit assignment", () => {
    const f = fixture();
    const legacy = { leaderId: "OLD-PERSON", department: "Production" };
    expect(describeZoneLeadership(legacy, f.scope, f.catalog, [])).toEqual({ kind: "legacy-only", legacy, reason: "LEGACY_ONLY" });
  });
  it("keeps legacy leader/allocation history alongside multiple explicit leaders", () => {
    const f = fixture();
    const legacy = freeze({ leaderId: "OLD-PERSON", allocations: [{ id: "OLD-1", zoneId: "Z1", responsibility: "Leader" }, { id: "OLD-2", zoneId: "Z2", responsibility: "Leader" }] });
    const before = JSON.stringify(legacy);
    const explicit = [f.assignment, { ...f.assignment, id: "L2", personId: "P2" }];
    expect(describeZoneLeadership(legacy, f.scope, f.catalog, explicit)).toEqual({ kind: "v4-reference", legacy, value: explicit });
    expect(JSON.stringify(legacy)).toBe(before);
  });
  it("retains revoked lifecycles in descriptions but active filtering excludes them", () => {
    const f = fixture();
    const revoked: ZoneLeaderAssignment = { ...f.assignment, status: "Revoked", revokedBy: "P2", revokedAt: "2026-01-02", revocationReason: "Recorded history" };
    expect(describeZoneLeadership({ leaderId: "OLD" }, f.scope, f.catalog, [revoked])).toMatchObject({ kind: "v4-reference", value: [revoked] });
    expect(isActiveAssignment(revoked)).toBe(false);
    expect(filterActiveRoleAssignments([revoked], f.scope)).toEqual([]);
  });
  it("does not apply factory Champion oversight as Zone membership", () => {
    const f = fixture();
    const champion: ZoneChampionAssignment = { id: "CH1", personId: "P3", role: "Zone Champion", status: "Active", organizationId: "C1", plantId: "F1", assignedBy: "P2", assignedAt: "2026-01-01" };
    expect(filterActiveRoleAssignments([champion, f.assignment], f.scope)).toEqual([f.assignment]);
    expect(filterActiveRoleAssignments([champion, f.assignment], { organizationId: "C1", plantId: "F1" })).toEqual([champion]);
    expect(filterActiveRoleAssignments([champion, f.assignment], { organizationId: "", plantId: "F1" })).toEqual([]);
  });
  it("rejects malformed, conflicting and unresolved new leader references", () => {
    const f = fixture();
    for (const patch of [{ personId: "UNKNOWN" }, { id: "" }, { plantId: "OTHER" }, { organizationId: "OTHER" }]) {
      expect(describeZoneLeadership({ leaderId: "OLD" }, f.scope, f.catalog, [{ ...f.assignment, ...patch }]).kind).toBe("unresolved");
    }
    expect(describeZoneLeadership({ leaderId: "OLD" }, f.scope, f.catalog, [f.assignment, f.assignment])).toMatchObject({ kind: "unresolved", reason: "AMBIGUOUS_REFERENCE" });
  });
});

describe("Action reviewer compatibility never selects/grants/replaces", () => {
  it("preserves legacy reviewer ID, name, auditor, revisions and review events", () => {
    const f = fixture();
    const legacy = freeze({ reviewerId: "OLD-ID", reviewerName: "Original Reviewer", auditor: "Original Creator", reviewHistory: [{ actorId: "OLD-ID" }], submissionRevisions: [{ number: 1 }] });
    expect(describeActionReviewer(legacy, undefined, [], { actionId: "TASK", scope: f.reference }, f.catalog)).toEqual({ kind: "legacy-only", legacy, reason: "LEGACY_ONLY" });
    expect(legacy.reviewerId).toBe("OLD-ID");
  });
  it("reports name-only history as legacy, never guessing a person ID", () => {
    const f = fixture();
    const result = describeActionReviewer({ reviewerName: "P2" }, undefined, [f.selection], { actionId: "TASK", scope: f.reference }, f.catalog);
    expect(result.kind).toBe("legacy-only");
    expect(result).not.toHaveProperty("value");
  });
  it("keeps explicit selection beside legacy reviewer without changing either", () => {
    const f = fixture();
    const legacy = { reviewerId: "OLD" };
    expect(describeActionReviewer(legacy, "S1", [f.selection], { actionId: "TASK", scope: f.reference }, f.catalog)).toEqual({ kind: "v4-reference", legacy, value: f.selection });
    expect(f.selection).not.toHaveProperty("eligible");
    expect(f.selection).not.toHaveProperty("permissions");
  });
  it("explicit unresolved v4 ID does not fall back to legacy reviewer authority", () => {
    const f = fixture();
    expect(describeActionReviewer({ reviewerId: "P2" }, "UNKNOWN", [f.selection], { actionId: "TASK", scope: f.reference }, f.catalog)).toMatchObject({ kind: "unresolved", reason: "UNRESOLVED_REFERENCE" });
  });
  it("rejects other Action/scope and ambiguous/missing selection references", () => {
    const f = fixture();
    expect(describeActionReviewer({ reviewerId: "OLD" }, "S1", [f.selection], { actionId: "OTHER", scope: f.reference }, f.catalog)).toMatchObject({ kind: "unresolved", reason: "PARENT_CONFLICT" });
    expect(describeActionReviewer({ reviewerId: "OLD" }, "S1", [f.selection], { actionId: "TASK", scope: { ...f.reference, zoneId: "Z2" } }, f.catalog).kind).toBe("unresolved");
    expect(describeActionReviewer({ reviewerId: "OLD" }, "S1", [f.selection, f.selection], { actionId: "TASK", scope: f.reference }, f.catalog).kind).toBe("unresolved");
    expect(describeActionReviewer({}, undefined, [], { actionId: "TASK", scope: f.reference }, f.catalog)).toMatchObject({ kind: "unresolved", reason: "MISSING_REFERENCE" });
  });
  it("does not fabricate a missing coordinator/verifier or authorization reference", () => {
    const f = fixture();
    for (const patch of [{ verifierPersonId: "UNKNOWN" }, { coordinatorPersonId: "UNKNOWN" }, { coordinatorAuthorizationReference: "" }, { verifierAuthorization: { kind: "role-assignment" as const, id: "" } }]) {
      expect(describeActionReviewer({ reviewerId: "OLD" }, "S1", [{ ...f.selection, ...patch }], { actionId: "TASK", scope: f.reference }, f.catalog).kind).toBe("unresolved");
    }
  });
});

describe("compatibility purity", () => {
  it("all operations work on frozen inputs without changes and give repeatable descriptions", () => {
    const f = freeze(fixture());
    const zone = freeze({ department: "Old", leaderId: "OLD", allocations: [{ zoneId: "Z1" }, { zoneId: "Z2" }] });
    const audit = freeze({ department: "Old audit department", signatureHistory: [{ userId: "OLD" }] });
    const action = freeze({ reviewerId: "OLD", reviewHistory: [{ actorId: "OLD" }] });
    const before = JSON.stringify({ f, zone, audit, action });
    const calls = () => [
      describeZoneDepartment(zone, f.reference, f.catalog, [f.department]),
      describeAuditDepartment(audit, f.reference, f.catalog, [f.department]),
      describeZoneLeadership(zone, f.scope, f.catalog, [f.assignment]),
      describeActionReviewer(action, "S1", [f.selection], { actionId: "TASK", scope: f.reference }, f.catalog),
      filterActiveRoleAssignments([f.assignment], f.scope),
      hasSameDepartmentIdentity(f.department, f.department),
      validateDepartmentDefinition(f.department, f.catalog, []),
      validateDepartmentForNewAssignment(f.department, f.catalog),
      matchesRecordedWorkCapacity({ actionId: "TASK", personId: "P1", roleAssignmentId: "L1", capacity: "Zone Leader", assignmentScope: f.scope, capturedBy: "P3", capturedAt: "2026-01-01" }, f.assignment),
    ];
    const now = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("Clock access prohibited"); });
    try { expect(calls()).toEqual(calls()); } finally { now.mockRestore(); }
    expect(JSON.stringify({ f, zone, audit, action })).toBe(before);
    expect(typeof window).toBe("undefined");
  });
});
