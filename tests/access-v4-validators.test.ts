import { describe, expect, it, vi } from "vitest";
import {
  validateOrganizationalParentChain, validateZoneLeaderAssignment, validateDepartmentAssignment,
  validateIndependentRoleAssignment, validateDepartmentActionOwner, validateIndependentVerification,
  type OrganizationalCatalog, type OrganizationalScope, type IndependentAssignment,
  type AssignmentEligibility, type ValidationResult, type ViolationCode,
} from "@/features/five-s/administration/access-v4-validators";

function fixture() {
  const catalog: OrganizationalCatalog = {
    clients: [{ id: "C1", status: "Active" }, { id: "C2", status: "Active" }],
    factories: [{ id: "F1", organizationId: "C1", status: "Active" }, { id: "F2", organizationId: "C1", status: "Active" }, { id: "F3", organizationId: "C2", status: "Active" }],
    zones: [{ id: "Z1", plantId: "F1", status: "Active" }, { id: "Z2", plantId: "F1", status: "Active" }, { id: "Z3", plantId: "F2", status: "Active" }, { id: "Z4", plantId: "F3", status: "Active" }],
    departments: [
      { id: "D1", organizationId: "C1", plantId: "F1", zoneId: "Z1", status: "Active" },
      { id: "D2", organizationId: "C1", plantId: "F1", zoneId: "Z1", status: "Active" },
      { id: "D3", organizationId: "C1", plantId: "F1", zoneId: "Z2", status: "Active" },
      { id: "D4", organizationId: "C2", plantId: "F3", zoneId: "Z4", status: "Active" },
    ],
    people: ["P1", "P2", "P3"].map(id => ({ id, status: "Active" })),
  };
  const scope = { organizationId: "C1", plantId: "F1", zoneId: "Z1", departmentId: "D1" };
  return { catalog, scope };
}
function assignment(patch: Partial<IndependentAssignment> = {}): IndependentAssignment {
  return { id: "A1", personId: "P1", role: "Zone Leader", status: "Active", organizationId: "C1", plantId: "F1", zoneId: "Z1", ...patch };
}
function fact(a: IndependentAssignment): AssignmentEligibility {
  return { assignmentId: a.id, personId: a.personId, role: a.role, organizationId: a.organizationId, plantId: a.plantId, zoneId: a.zoneId, departmentId: a.departmentId, eligible: true };
}
function proposal(p = assignment(), existing: IndependentAssignment[] = []) {
  return { catalog: fixture().catalog, proposed: p, existing, eligibility: [fact(p)] };
}
function has(result: ValidationResult, code: ViolationCode) {
  expect(result.valid).toBe(false);
  expect(result.violations.map(v => v.code)).toContain(code);
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe("v4 explicit canonical chains", () => {
  it("accepts a canonical active hierarchy", () => {
    const { catalog, scope } = fixture();
    expect(validateOrganizationalParentChain(catalog, scope)).toEqual({ valid: true, violations: [] });
  });
  it.each(["organizationId", "plantId", "zoneId", "departmentId"] as const)("rejects missing %s", key => {
    const { catalog, scope } = fixture();
    has(validateOrganizationalParentChain(catalog, { ...scope, [key]: "" }), "MISSING_ID");
  });
  it.each(["clients", "factories", "zones", "departments"] as const)("rejects ambiguous IDs in %s", key => {
    const { catalog, scope } = fixture();
    has(validateOrganizationalParentChain({ ...catalog, [key]: [...catalog[key], catalog[key][0]] }, scope), "AMBIGUOUS_ID");
  });
  it.each(["clients", "factories", "zones", "departments"] as const)("rejects inactive %s", key => {
    const { catalog, scope } = fixture();
    has(validateOrganizationalParentChain({ ...catalog, [key]: catalog[key].map((r, i) => i ? r : { ...r, status: "Inactive" }) }, scope), "INACTIVE_RECORD");
  });
  it.each([{ organizationId: "C2" }, { plantId: "F2" }, { zoneId: "Z2" }])("rejects conflicting parent chain %j", patch => {
    const { catalog, scope } = fixture();
    has(validateOrganizationalParentChain(catalog, { ...scope, ...patch }), "PARENT_CONFLICT");
  });
  it("never resolves names or legacy department strings", () => {
    const { catalog, scope } = fixture();
    has(validateOrganizationalParentChain(catalog, { ...scope, departmentId: "Production" }), "UNRESOLVED_ID");
  });
});

describe("v4 proposed independent assignments", () => {
  it("permits multiple people leading one Zone", () => {
    expect(validateZoneLeaderAssignment(proposal(assignment(), [assignment({ id: "A2", personId: "P2" })])).valid).toBe(true);
  });
  it("rejects a second led Zone for one person in one factory", () => {
    has(validateZoneLeaderAssignment(proposal(assignment(), [assignment({ id: "A2", zoneId: "Z2" })])), "ZONE_LEADERSHIP_CONFLICT");
  });
  it("permits independent leadership in another factory", () => {
    expect(validateZoneLeaderAssignment(proposal(assignment({ plantId: "F2", zoneId: "Z3" }), [assignment({ id: "A2" })])).valid).toBe(true);
  });
  it("rejects duplicate active tuples", () => {
    has(validateZoneLeaderAssignment(proposal(assignment(), [assignment({ id: "A2" })])), "DUPLICATE_ASSIGNMENT");
  });
  it.each(["Inactive", "Revoked"] as const)("retains %s history without conferring leadership", status => {
    const old = assignment({ id: "A2", zoneId: "Z2", status });
    const input = deepFreeze(proposal(assignment(), [old]));
    expect(validateZoneLeaderAssignment(input).valid).toBe(true);
    expect(input.existing[0]).toEqual(old);
  });
  it("does not reject unrelated legacy multi-Zone history", () => {
    const old = [assignment({ id: "L1", personId: "P2" }), assignment({ id: "L2", personId: "P2", zoneId: "Z2" })];
    expect(validateZoneLeaderAssignment(proposal(assignment(), old)).valid).toBe(true);
    has(validateZoneLeaderAssignment(proposal(assignment({ personId: "P2" }), old)), "ZONE_LEADERSHIP_CONFLICT");
  });
  it.each(["Department Leader", "Department Member"] as const)("permits several %ss in one Department", role => {
    const p = assignment({ role, departmentId: "D1" });
    expect(validateDepartmentAssignment(proposal(p, [{ ...p, id: "A2", personId: "P2" }])).valid).toBe(true);
  });
  it("permits same-person Leader/Member assignments across same-Zone Departments", () => {
    const p = assignment({ role: "Department Member", departmentId: "D2" });
    expect(validateDepartmentAssignment(proposal(p, [assignment({ id: "A2", role: "Department Leader", departmentId: "D1" })])).valid).toBe(true);
  });
  it("rejects cross-Zone Department Leader/Member combinations", () => {
    const p = assignment({ role: "Department Member", departmentId: "D3", zoneId: "Z2" });
    has(validateDepartmentAssignment(proposal(p, [assignment({ id: "A2", role: "Department Leader", departmentId: "D1" })])), "DEPARTMENT_ZONE_CONFLICT");
  });
  it("rejects Department assignment outside the led Zone", () => {
    const p = assignment({ role: "Department Leader", zoneId: "Z2", departmentId: "D3" });
    has(validateDepartmentAssignment(proposal(p, [assignment({ id: "A2" })])), "LED_ZONE_CONFLICT");
  });
  it("also checks Department alignment when proposing leadership", () => {
    has(validateZoneLeaderAssignment(proposal(assignment(), [assignment({ id: "A2", role: "Department Member", zoneId: "Z2", departmentId: "D3" })])), "LED_ZONE_CONFLICT");
  });
  it("rejects duplicate active Department tuples", () => {
    const p = assignment({ role: "Department Member", departmentId: "D1" });
    has(validateDepartmentAssignment(proposal(p, [{ ...p, id: "A2" }])), "DUPLICATE_ASSIGNMENT");
  });
  it("does not use revoked Department assignments as current conflicts", () => {
    const p = assignment({ role: "Department Member", departmentId: "D1" });
    expect(validateDepartmentAssignment(proposal(p, [assignment({ id: "A2", role: "Department Leader", departmentId: "D3", zoneId: "Z2", status: "Revoked" })])).valid).toBe(true);
  });
  it("rejects reusing an ended canonical assignment ID", () => {
    has(validateZoneLeaderAssignment(proposal(assignment(), [assignment({ status: "Revoked" })])), "DUPLICATE_ASSIGNMENT");
  });
  it("accepts an ended historical row without making it a current assignment", () => {
    const p = assignment({ status: "Revoked", zoneId: "OLD-RETAINED-ID" });
    expect(validateIndependentRoleAssignment({ ...proposal(p), eligibility: [] }).valid).toBe(true);
  });
  it("rejects inactive people and inactive Department parents", () => {
    const p = assignment({ role: "Department Member", departmentId: "D1" });
    const input = proposal(p);
    has(validateDepartmentAssignment({ ...input, catalog: { ...input.catalog, people: [{ id: "P1", status: "Inactive" }] } }), "INACTIVE_RECORD");
    has(validateDepartmentAssignment({ ...input, catalog: { ...input.catalog, zones: input.catalog.zones.map(z => ({ ...z, status: "Inactive" })) } }), "INACTIVE_RECORD");
  });
  it("rejects missing Department eligibility and duplicate ineligible facts", () => {
    const p = assignment({ role: "Department Leader", departmentId: "D1" });
    has(validateDepartmentAssignment({ ...proposal(p), eligibility: [] }), "ELIGIBILITY_REQUIRED");
    has(validateDepartmentAssignment({ ...proposal(p), eligibility: [{ ...fact(p), eligible: false }] }), "ELIGIBILITY_REQUIRED");
  });
  it("requires exact supplied eligibility, rather than a role label", () => {
    const input = proposal(assignment());
    has(validateIndependentRoleAssignment({ ...input, eligibility: [] }), "ELIGIBILITY_REQUIRED");
    has(validateIndependentRoleAssignment({ ...input, eligibility: [{ ...fact(input.proposed), personId: "P2" }] }), "ELIGIBILITY_REQUIRED");
    has(validateIndependentRoleAssignment({ ...input, eligibility: [fact(input.proposed), fact(input.proposed)] }), "ELIGIBILITY_REQUIRED");
  });
  it("requires canonical active person and full Department parents", () => {
    const p = assignment({ role: "Department Member", departmentId: "D4" });
    has(validateDepartmentAssignment(proposal(p)), "PARENT_CONFLICT");
    has(validateDepartmentAssignment(proposal({ ...p, personId: "Display Name" })), "UNRESOLVED_ID");
  });
  it("permits separately represented FA and ZL without deriving grants", () => {
    const input = proposal(assignment(), [assignment({ id: "FA", role: "Factory Admin", zoneId: undefined })]);
    expect(validateIndependentRoleAssignment(input)).toEqual({ valid: true, violations: [] });
    expect(Object.keys(validateIndependentRoleAssignment(input))).toEqual(["valid", "violations"]);
  });
  it("permits Champion and Department Leader without manufacturing Zone memberships", () => {
    const p = assignment({ role: "Zone Champion", zoneId: undefined });
    const input = proposal(p, [assignment({ id: "DL", role: "Department Leader", departmentId: "D1" })]);
    const before = structuredClone(input);
    expect(validateIndependentRoleAssignment(input).valid).toBe(true);
    expect(input).toEqual(before);
    has(validateIndependentRoleAssignment(proposal({ ...p, zoneId: "Z1" })), "INVALID_ROLE_SCOPE");
  });
  it("rejects wrong role-specific entry points", () => {
    has(validateZoneLeaderAssignment(proposal(assignment({ role: "Department Member" }))), "INVALID_ROLE");
    has(validateDepartmentAssignment(proposal()), "INVALID_ROLE");
  });
});

describe("Department-origin Action owner scope only", () => {
  function owner(patch: Partial<IndependentAssignment> = {}) {
    const { catalog, scope } = fixture();
    const a = assignment({ role: "Department Member", departmentId: "D1", ...patch });
    return { catalog, origin: scope, responsiblePersonId: "P1", assignment: a, eligibility: [fact(a)] };
  }
  it("accepts an explicitly eligible same-Zone owner", () => expect(validateDepartmentActionOwner(owner()).valid).toBe(true));
  it("rejects foreign Zone even when eligible there", () => has(validateDepartmentActionOwner(owner({ zoneId: "Z2", departmentId: "D3" })), "ACTION_ZONE_CONFLICT"));
  it("rejects foreign client and factory", () => has(validateDepartmentActionOwner(owner({ organizationId: "C2", plantId: "F3", zoneId: "Z4", departmentId: "D4" })), "ACTION_ZONE_CONFLICT"));
  it("rejects missing origin, work assignment or eligibility", () => {
    has(validateDepartmentActionOwner({ ...owner(), origin: { ...owner().origin, departmentId: undefined } }), "MISSING_ID");
    has(validateDepartmentActionOwner({ ...owner(), assignment: undefined }), "ELIGIBILITY_REQUIRED");
    has(validateDepartmentActionOwner({ ...owner(), eligibility: [] }), "ELIGIBILITY_REQUIRED");
  });
  it("rejects wrong canonical responsible ID and revoked work", () => {
    has(validateDepartmentActionOwner({ ...owner(), responsiblePersonId: "P2" }), "ACTION_ZONE_CONFLICT");
    has(validateDepartmentActionOwner(owner({ status: "Revoked" })), "INACTIVE_ASSIGNMENT");
  });
});

describe("approved verification structure, not qualification policy", () => {
  function review() {
    const scope: OrganizationalScope = fixture().scope;
    return { stage: "submission" as "draft" | "submission", actionId: "TASK", scope, creatorId: "CREATOR", completerIds: ["WORKER", "OLD-WORKER"],
      verifier: { ...scope, personId: "VERIFIER", actionId: "TASK", eligible: true },
      coordinator: { ...scope, personId: "COORDINATOR", actionId: "TASK", eligible: true }, factoryAdminWork: false };
  }
  it("accepts explicit independent eligibility facts", () => expect(validateIndependentVerification(review()).valid).toBe(true));
  it.each(["CREATOR", "WORKER", "OLD-WORKER"])("rejects verifier %s from retained history", personId => {
    const input = review();
    has(validateIndependentVerification({ ...input, verifier: { ...input.verifier, personId } }), "INDEPENDENCE_CONFLICT");
  });
  it.each(["CREATOR", "WORKER", "OLD-WORKER"])("rejects coordinator %s", personId => {
    const input = review();
    has(validateIndependentVerification({ ...input, coordinator: { ...input.coordinator, personId } }), "INDEPENDENCE_CONFLICT");
  });
  it("requires explicitly eligible coordinator and verifier facts", () => {
    const input = review();
    has(validateIndependentVerification({ ...input, coordinator: undefined }), "COORDINATOR_REQUIRED");
    has(validateIndependentVerification({ ...input, coordinator: { ...input.coordinator, eligible: false } }), "ELIGIBILITY_REQUIRED");
    has(validateIndependentVerification({ ...input, verifier: { ...input.verifier, eligible: false } }), "ELIGIBILITY_REQUIRED");
  });
  it("allows no-verifier draft but blocks review submission", () => {
    expect(validateIndependentVerification({ ...review(), stage: "draft", verifier: undefined, coordinator: undefined }).valid).toBe(true);
    has(validateIndependentVerification({ ...review(), verifier: undefined }), "VERIFIER_REQUIRED");
  });
  it("rejects cross-scope or another Action's eligibility", () => {
    const input = review();
    for (const patch of [{ plantId: "F2" }, { organizationId: "C2" }, { zoneId: "Z2" }, { actionId: "OTHER" }]) {
      has(validateIndependentVerification({ ...input, verifier: { ...input.verifier, ...patch } }), "ELIGIBILITY_REQUIRED");
    }
  });
  it("requires active exact-Action FA verifier designation", () => {
    const input = review();
    const valid = { ...input, factoryAdminWork: true, designation: { ...input.verifier, status: "Active" as const } };
    expect(validateIndependentVerification(valid).valid).toBe(true);
    has(validateIndependentVerification({ ...valid, designation: undefined }), "DESIGNATION_SCOPE_CONFLICT");
    for (const patch of [{ actionId: "OTHER" }, { status: "Revoked" as const }, { plantId: "F2" }, { personId: "OTHER" }]) {
      has(validateIndependentVerification({ ...valid, designation: { ...valid.designation, ...patch } }), "DESIGNATION_SCOPE_CONFLICT");
    }
  });
  it("does not accept missing/blank scoped identity information", () => {
    const input = review();
    has(validateIndependentVerification({ ...input, verifier: { ...input.verifier, personId: "" } }), "MISSING_ID");
    const scope = { ...input.scope, zoneId: "" };
    has(validateIndependentVerification({ ...input, scope, verifier: { ...input.verifier, ...scope }, coordinator: { ...input.coordinator, ...scope } }), "MISSING_ID");
  });
  it("rejects a coordinator qualified only for a different scope or Action", () => {
    const input = review();
    has(validateIndependentVerification({ ...input, coordinator: { ...input.coordinator, actionId: "OTHER" } }), "ELIGIBILITY_REQUIRED");
    has(validateIndependentVerification({ ...input, coordinator: { ...input.coordinator, plantId: "F2" } }), "ELIGIBILITY_REQUIRED");
  });
  it("does not approve self-selection merely because work is still a draft", () => {
    const input = review();
    has(validateIndependentVerification({ ...input, stage: "draft", coordinator: { ...input.coordinator, personId: "CREATOR" } }), "INDEPENDENCE_CONFLICT");
  });
  it("fails closed on missing creator/completer canonical IDs", () => {
    has(validateIndependentVerification({ ...review(), creatorId: "" }), "MISSING_ID");
    has(validateIndependentVerification({ ...review(), completerIds: [""] }), "MISSING_ID");
  });
});

describe("pure validation safety", () => {
  it("accepts deeply frozen inputs unchanged for all validators", () => {
    const { catalog, scope } = deepFreeze(fixture());
    const p = deepFreeze(proposal(assignment({ role: "Department Member", departmentId: "D1" })));
    const before = JSON.stringify({ catalog, scope, p });
    validateOrganizationalParentChain(catalog, scope);
    validateDepartmentAssignment(p);
    validateZoneLeaderAssignment(deepFreeze(proposal()));
    validateIndependentRoleAssignment(p);
    validateDepartmentActionOwner(deepFreeze({ catalog, origin: scope, responsiblePersonId: "P1", assignment: p.proposed, eligibility: p.eligibility }));
    validateIndependentVerification(deepFreeze({ stage: "draft", actionId: "T", scope, creatorId: "P1", completerIds: [], factoryAdminWork: false }));
    expect(JSON.stringify({ catalog, scope, p })).toBe(before);
  });
  it("has deterministic conflicts without browser, session, clock or ID allocation", () => {
    const input = deepFreeze(proposal(assignment(), [assignment({ id: "A2", zoneId: "Z2" })]));
    const now = vi.spyOn(Date, "now").mockImplementation(() => { throw new Error("clock forbidden"); });
    try {
      const first = validateZoneLeaderAssignment(input);
      expect(validateZoneLeaderAssignment(input)).toEqual(first);
      expect(first.violations[0]).toEqual({ code: "ZONE_LEADERSHIP_CONFLICT", recordIds: ["A1", "A2"] });
      expect(typeof window).toBe("undefined");
    } finally { now.mockRestore(); }
  });
});
