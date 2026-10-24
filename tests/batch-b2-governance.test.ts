import { seedLegacyDirectoryPerson } from "./helpers/legacy-directory";
import { authenticateDemoFixture } from "./helpers/demo-session";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MyAction } from "@/features/five-s/types/my-actions";
const leader = { id: "USR-RUMESH", name: "Rumesh" };
const owner = { id: "USR-SIVA-KUMAR", name: "Siva Kumar" };
const auditor = { id: "USR-LAKSHMAN", name: "Lakshman" };
function fixture(overrides: Partial<MyAction> = {}): MyAction {
  return { id: "B2-ACTION", title: "Repair hydraulic oil leakage", description: "Repair leakage", source: "Gemba", sourceModule: "gemba", sourceId: "GEM-B2", sourceTitle: "GEM-B2", plant: "Egmore Plant", department: "Production", area: "Zone B", assignedTo: owner.name, responsiblePersonId: owner.id, responsiblePersonName: owner.name, zoneLeaderId: leader.id, createdByUserId: auditor.id, createdByName: auditor.name, auditor: auditor.name, status: "In Progress", priority: "Medium", dueDate: "2030-10-20", createdAt: "2030-10-01", evidence: [], ...overrides };
}
async function setup() {
  vi.resetModules(); const values = new Map<string, string>();
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal("window", { localStorage }); authenticateDemoFixture(); vi.stubGlobal("localStorage", localStorage);
  const store = await import("@/lib/actions/action-store"); store.getActions(); store.setActions([fixture()]); return { store, localStorage };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("B2 explicit due-date override", () => {
  it("records an authorized override while preserving baseline, source, priority and status", async () => {
    const { store } = await setup(); const result = store.changeActionDueDate("B2-ACTION", leader, "2030-10-24", "Replacement component delivery delayed.")!;
    expect(result).toMatchObject({ dueDate: "2030-10-24", priorityDueDate: "2030-10-20", dueDateOverride: "2030-10-24", sourceId: "GEM-B2", status: "In Progress", priority: "Medium", dueDateHistory: [expect.objectContaining({ previousDate: "2030-10-20", newDate: "2030-10-24", actorId: leader.id, actorName: leader.name, changedAt: expect.any(String), reason: "Replacement component delivery delayed." })] });
    vi.resetModules(); const reloaded = await import("@/lib/actions/action-store"); expect(reloaded.getActionById(result.id)?.dueDateHistory).toEqual(result.dueDateHistory);
  });
  it("rejects missing reasons, invalid calendar dates, past dates and cross-zone actors", async () => {
    const { store } = await setup();
    expect(store.changeActionDueDate("B2-ACTION", leader, "2030-10-24", " ")).toBeUndefined();
    expect(store.changeActionDueDate("B2-ACTION", leader, "2030-02-30", "Delay")).toBeUndefined();
    expect(store.changeActionDueDate("B2-ACTION", leader, "2020-10-01", "Delay")).toBeUndefined();
    expect(store.changeActionDueDate("B2-ACTION", owner, "2030-10-24", "Delay")).toBeUndefined();
    store.setActions([fixture({ area: "Zone A", zoneLeaderId: auditor.id })]);
    expect(store.changeActionDueDate("B2-ACTION", leader, "2030-10-24", "Delay")).toBeUndefined();
  });
  it("preserves completed historical records", async () => {
    const { store } = await setup(); const before = fixture({ status: "Completed" }); store.setActions([before]);
    expect(store.changeActionDueDate(before.id, leader, "2030-10-24", "Delay")).toBeUndefined(); expect(store.getActionById(before.id)).toEqual(before);
  });
});

describe("B2 closure safeguards with approved scoped delegation", () => {
  it("requires submission and completion evidence for an existing authorized reviewer", async () => {
    const { store } = await setup();
    expect(store.closeReviewedAction("B2-ACTION", auditor)).toBeUndefined();
    store.setActions([fixture({ status: "Pending Auditor Review", submittedForReviewAt: "2030-10-21", resolutionObservation: "Leak repaired", correctiveActionCategory: "Communication", costSaving: 0 })]);
    expect(store.getActionClosureError(store.getActionById("B2-ACTION")!, auditor)).toContain("evidence");
    expect(store.closeReviewedAction("B2-ACTION", auditor)).toBeUndefined();
  });
  it("retains the existing reviewer authority and full owner submission lifecycle", async () => {
    const { store } = await setup();
    store.addActionEvidence("B2-ACTION", { id: "AFTER", name: "after.jpg", type: "image", uploadedAt: "2030-10-21", uploadedBy: owner.name, url: "data:image/jpeg;base64,after" }, owner);
    expect(store.submitActionForReview("B2-ACTION", owner, { observation: "Leak repaired", correctiveActionCategory: "Communication", costSaving: 0 })).toMatchObject({ status: "Pending Auditor Review" });
    expect(store.canReviewAction(store.getActionById("B2-ACTION")!, leader)).toBe(true);
    expect(store.closeReviewedAction("B2-ACTION", auditor, "Verified")).toMatchObject({ status: "Completed", closedByUserId: auditor.id, reviewedBy: auditor.name, sourceId: "GEM-B2", closedAt: expect.any(String) });
    expect(store.updateAction("B2-ACTION", { description: "Changed" })).toBeUndefined();
  });
  it("blocks self-approval even when an owner is the explicit reviewer", async () => {
    const { store } = await setup(); store.setActions([fixture({ reviewerId: owner.id, reviewerName: owner.name, status: "Pending Review", submittedForReviewAt: "2030-10-21" })]);
    expect(store.getActionClosureError(store.getActionById("B2-ACTION")!, owner)).toContain("own work");
    expect(store.closeReviewedAction("B2-ACTION", owner)).toBeUndefined();
  });
  it("preserves the Audit assigned-reviewer restriction", async () => {
    const { store } = await setup(); store.setActions([fixture({ source: "Audit", sourceModule: "audit", reviewerId: auditor.id, reviewerName: auditor.name, status: "Pending Review", submittedForReviewAt: "2030-10-21" })]);
    expect(store.closeReviewedAction("B2-ACTION", leader)).toBeUndefined();
  });
});

describe("B2 override compatibility", () => {
  it("keeps the effective override when priority baseline changes and recalculates overdue filters", async () => {
    const { store } = await setup(); store.changeActionDueDate("B2-ACTION", leader, "2030-10-24", "Delivery");
    const changed = store.changeActionPriority("B2-ACTION", leader, "High")!;
    expect(changed).toMatchObject({ priority: "High", priorityDueDate: expect.any(String), dueDate: "2030-10-24", dueDateOverride: "2030-10-24" });
    expect(store.updateAction("B2-ACTION", { dueDateOverride: undefined })).toBeUndefined();
    const { isActionOverdue } = await import("@/lib/actions/action-config");
    expect(isActionOverdue(changed, new Date("2030-10-23T12:00:00"))).toBe(false);
    expect(isActionOverdue(changed, new Date("2030-10-25T12:00:00"))).toBe(true);
  });
});

describe("B2 confirmed Audit deletion policy", () => {
  it("requires confirmation and current-session Admin while retaining linked Actions for every Audit status", async () => {
    const { store } = await setup(); const audits = await import("@/lib/five-s/audit-store");
    const draft = { id: "B2-AUDIT", title: "B2 Audit", plant: "Egmore Plant", department: "Production", area: "Zone B", auditor: auditor.name, status: "Draft" as const, score: 0, maxScore: 0, completionPercentage: 0, createdAt: "2030-10-01", dueDate: "2030-10-20", sections: [] };
    audits.setFiveSAudits([draft]);
    expect(audits.deleteFiveSAudit(draft.id, auditor)).toBe(false);
    expect(audits.deleteFiveSAudit(draft.id, leader, true)).toBe(false);
    for (const status of ["Draft", "Scheduled", "In Progress", "Completed"] as const) {
      const current = { ...draft, id: `${draft.id}-${status}`, status };
      const linked = fixture({ source: "Audit", sourceModule: "audit", sourceId: current.id }); store.setActions([linked]);
      const before = structuredClone(store.getActions());
      audits.setFiveSAudits([current]); expect(audits.deleteFiveSAudit(current.id, auditor, true)).toBe(true);
      expect(audits.getFiveSAuditById(current.id)).toBeUndefined(); expect(store.getActions()).toEqual(before);
    }
  });
  it("rejects caller-supplied non-Admin auditors and inactive users", async () => {
    const { store } = await setup(); store.setActions([]); const admin = await import("@/features/five-s/administration/store"); const { permissionsForRoles } = await import("@/features/five-s/administration/permissions"); const audits = await import("@/lib/five-s/audit-store");
    const user = seedLegacyDirectoryPerson(admin, { employeeId: "B2-AUDITOR", name: "B2 Auditor", email: "b2.auditor@example.test", plant: "Egmore Plant", status: "Active", roles: ["Auditor"], zoneMemberships: [{ zone: "Zone A", responsibility: "Auditor" }], permissions: permissionsForRoles(["Auditor"]) });
    const draft = { id: "B2-AUDIT", title: "B2 Audit", plant: "Egmore Plant", department: "Production", area: "Zone B", auditor: user.name, status: "Scheduled" as const, score: 0, maxScore: 0, completionPercentage: 0, createdAt: "2030-10-01", dueDate: "2030-10-20", sections: [] };
    audits.setFiveSAudits([draft]); expect(audits.canDeleteFiveSAudit(draft, { id: user.id })).toBe(false);
    expect(audits.canDeleteFiveSAudit({ ...draft, auditor: "Different Auditor" }, { id: user.id })).toBe(false);
    admin.setAdminUserActive(user.id, false, auditor.id); expect(audits.deleteFiveSAudit(draft.id, { id: user.id }, true)).toBe(false);
  });
  it("retains an Audit when deletion cannot persist", async () => {
    const { localStorage } = await setup(); const audits = await import("@/lib/five-s/audit-store");
    const draft = { id: "B2-AUDIT", title: "B2 Audit", plant: "Egmore Plant", department: "Production", area: "Zone B", auditor: auditor.name, status: "Draft" as const, score: 0, maxScore: 0, completionPercentage: 0, createdAt: "2030-10-01", dueDate: "2030-10-20", sections: [] };
    audits.setFiveSAudits([draft]); vi.spyOn(console, "error").mockImplementation(() => {}); vi.spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("Quota"); });
    expect(audits.deleteFiveSAudit(draft.id, auditor, true)).toBe(false); expect(audits.getFiveSAuditById(draft.id)).toEqual(draft);
  });
});

describe("B2 source and historical compatibility", () => {
  it.each([["Gemba", "gemba"], ["Red Tag", "redTag"], ["Continuous Improvement", "continuousImprovement"], ["Audit", "audit"], ["Visual Management", "visualManagement"]] as const)("preserves %s identity, evidence and ownership through date override and reassignment", async (source, sourceModule) => {
    const { store } = await setup(); const before = fixture({ source, sourceModule, sourceId: `SOURCE-${sourceModule}`, evidence: [{ id: "AFTER", name: "after.jpg", type: "image", uploadedAt: "2030-10-20", uploadedBy: owner.name, url: "data:image/jpeg;base64,after" }] }); store.setActions([before]);
    store.changeActionDueDate(before.id, leader, "2030-10-24", "Delivery delayed");
    const reassigned = store.reassignActionOwner(before.id, leader, "USR-SUBURAMIANI", "Absence")!;
    expect(reassigned).toMatchObject({ id: before.id, sourceModule, sourceId: before.sourceId, evidence: before.evidence, dueDate: "2030-10-24", dueDateOverride: "2030-10-24", status: before.status, responsiblePersonId: "USR-SUBURAMIANI" });
    expect(reassigned.dueDateHistory).toHaveLength(1); expect(reassigned.reassignmentHistory).toHaveLength(1);
  });
  it("rejects inactive leaders for date editing and inactive designated reviewers for closure", async () => {
    const { store, localStorage } = await setup(); const { ADMIN_USER_SEEDS } = await import("@/features/five-s/administration/store");
    localStorage.setItem("five-s-administration-users-v1", JSON.stringify(ADMIN_USER_SEEDS.map(user => [leader.id, auditor.id].includes(user.id) ? { ...user, status: "Inactive" } : user)));
    expect(store.changeActionDueDate("B2-ACTION", leader, "2030-10-24", "Delay")).toBeUndefined();
    store.setActions([fixture({ status: "Pending Review", submittedForReviewAt: "2030-10-21", resolutionObservation: "Done", correctiveActionCategory: "Communication", costSaving: 0, evidence: [{ id: "AFTER", name: "after.jpg", type: "image", uploadedAt: "2030-10-21", uploadedBy: owner.name }] })]);
    expect(store.closeReviewedAction("B2-ACTION", auditor)).toBeUndefined();
  });
});
