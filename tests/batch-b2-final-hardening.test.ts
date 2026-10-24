import { seedLegacyDirectoryPerson } from "./helpers/legacy-directory";
import { authenticateDemoFixture } from "./helpers/demo-session";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MyAction } from "@/features/five-s/types/my-actions";
const leader = { id: "USR-RUMESH", name: "Rumesh" };
const owner = { id: "USR-SIVA-KUMAR", name: "Siva Kumar" };
const reviewer = { id: "USR-LAKSHMAN", name: "Lakshman" };
function fixture(overrides: Partial<MyAction> = {}): MyAction {
  return { id: "FINAL", title: "Repair hydraulic oil leakage", description: "Repair the leak", source: "Gemba", sourceModule: "gemba", sourceId: "SOURCE", sourceTitle: "SOURCE", plant: "Egmore Plant", department: "Production", area: "Zone B", assignedTo: owner.name, responsiblePersonId: owner.id, responsiblePersonName: owner.name, createdByUserId: reviewer.id, createdByName: reviewer.name, auditor: reviewer.name, status: "In Progress", priority: "Medium", dueDate: "2030-10-20", createdAt: "2030-10-01", evidence: [], ...overrides };
}
async function setup(initial = fixture()) {
  vi.resetModules(); const values = new Map<string, string>();
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal("window", { localStorage }); authenticateDemoFixture(); const store = await import("@/lib/actions/action-store"); store.getActions(); store.setActions([initial]); return { store, localStorage };
}
async function submit(store: Awaited<ReturnType<typeof setup>>["store"]) {
  store.addActionEvidence("FINAL", { id: "AFTER", name: "after.jpg", type: "image", uploadedAt: "2030-10-21", uploadedBy: owner.name, url: "data:image/jpeg;base64,after" }, owner);
  return store.submitActionForReview("FINAL", owner, { observation: "Leak repaired", correctiveActionCategory: "Communication", costSaving: 0 });
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Final generic updater hardening", () => {
  it("rejects raw dates, overrides, lifecycle, ownership, Zone and source rewrites", async () => {
    const { store } = await setup(); const before = store.getActionById("FINAL");
    for (const patch of [{ dueDate: "2030-10-24" }, { dueDateOverride: "2030-10-24" }, { priorityDueDate: "2030-10-24" }, { dueDateHistory: [] }, { status: "Completed" }, { responsiblePersonId: leader.id }, { reviewerId: owner.id }, { submittedForReviewAt: "2030-10-21" }, { area: "Zone A" }, { sourceId: "OTHER" }, { activityHistory: [] }, { closedAt: "2030-10-21" }] as Partial<MyAction>[]) expect(store.updateAction("FINAL", patch, leader)).toBeUndefined();
    expect(store.getActionById("FINAL")).toEqual(before);
  });
  it("requires an active authorized actor for both old and canonical priority entry points", async () => {
    const { store } = await setup();
    expect(store.updateAction("FINAL", { priority: "High" })).toBeUndefined();
    expect(store.updateAction("FINAL", { priority: "High" }, owner)).toBeUndefined();
    expect(store.changeActionPriority("FINAL", owner, "High")).toBeUndefined();
    expect(store.updateAction("FINAL", { priority: "High" }, leader)?.priority).toBe("High");
    store.setActions([fixture({ area: "Zone A" })]);
    expect(store.updateAction("FINAL", { priority: "Critical" }, leader)).toBeUndefined();
  });
  it("preserves overrides and rejects combined legacy date/priority payloads", async () => {
    const { store } = await setup(); store.changeActionDueDate("FINAL", leader, "2030-10-24", "Delivery delayed");
    expect(store.updateAction("FINAL", { priority: "High", dueDate: "2030-10-22" }, leader)).toBeUndefined();
    const updated = store.changeActionPriority("FINAL", leader, "High")!;
    expect(updated).toMatchObject({ dueDate: "2030-10-24", dueDateOverride: "2030-10-24", priority: "High", priorityDueDate: expect.any(String) }); expect(updated.dueDateHistory).toHaveLength(1);
  });
  it("retains pre-assignment priority setup for an active Audit creator with actions.create", async () => {
    const { store } = await setup(); const admin = await import("@/features/five-s/administration/store"); const { permissionsForRoles } = await import("@/features/five-s/administration/permissions");
    const creator = seedLegacyDirectoryPerson(admin, { employeeId: "FINAL-AUDITOR", name: "Setup Auditor", email: "setup@example.test", plant: "Egmore Plant", status: "Active", roles: ["Auditor"], zoneMemberships: [{ zone: "Zone A", responsibility: "Auditor" }], permissions: permissionsForRoles(["Auditor"]) });
    store.setActions([fixture({ source: "Audit", sourceModule: "audit", status: "Awaiting Assignment", createdByUserId: creator.id, createdByName: creator.name })]);
    expect(store.changeActionPriority("FINAL", creator, "High")?.priority).toBe("High");
    expect(store.changeActionDueDate("FINAL", creator, "2030-10-24", "Delay")).toBeUndefined();
    store.setActions([fixture({ createdByUserId: creator.id, status: "Assigned" })]); expect(store.changeActionPriority("FINAL", creator, "Critical")).toBeUndefined();
  });
});
describe("Final scoped delegated closure", () => {
  it("allows a current leader to close only after owner submission and records canonical reviewer identity", async () => {
    const { store } = await setup(); expect(store.closeReviewedAction("FINAL", leader)).toBeUndefined(); await submit(store);
    const { getActionsForTab } = await import("@/features/actions/action-center-data"); const { DEMO_USERS } = await import("@/lib/current-user"); const { getAdminUser } = await import("@/features/five-s/administration/store");
    expect(getActionsForTab(store.getActions(), "awaiting-review", DEMO_USERS.leader, getAdminUser(leader.id)).map(action => action.id)).toEqual(["FINAL"]);
    const closed = store.closeReviewedAction("FINAL", { ...leader, name: "Spoofed name" }, "Verified leak repair")!;
    expect(closed).toMatchObject({ status: "Completed", sourceId: "SOURCE", closedByUserId: leader.id, reviewedBy: leader.name, closedAt: expect.any(String), completedByUserId: owner.id });
    expect(closed.reviewHistory).toEqual(expect.arrayContaining([expect.objectContaining({ type: "verified", actorId: leader.id, actorName: leader.name })]));
  });
  it("rejects missing evidence, cross-zone delegation and self-approval", async () => {
    const { store } = await setup(); await submit(store); const submitted = store.getActionById("FINAL")!;
    store.setActions([{ ...submitted, evidence: [] }]); expect(store.getActionClosureError(store.getActionById("FINAL")!, leader)).toContain("evidence"); expect(store.closeReviewedAction("FINAL", leader)).toBeUndefined();
    store.setActions([{ ...submitted, area: "Zone A", reviewerId: leader.id }]); expect(store.closeReviewedAction("FINAL", leader)).toBeUndefined();
    store.setActions([{ ...submitted, responsiblePersonId: leader.id, assignedTo: leader.name, reviewerId: leader.id }]); expect(store.closeReviewedAction("FINAL", leader)).toBeUndefined();
  });
  it("keeps completion evidence and lifecycle history immutable after closure", async () => {
    const { store } = await setup(); await submit(store); const closed = store.closeReviewedAction("FINAL", leader)!;
    const photo = { id: "LATE", name: "late.jpg", type: "image" as const, uploadedAt: "2030-10-22", uploadedBy: owner.name };
    expect(store.addActionEvidence("FINAL", photo, owner)).toBeUndefined(); expect(store.addActionProgressEvidence("FINAL", photo, owner)).toBeUndefined();
    expect(store.updateAction("FINAL", { evidence: [] })).toBeUndefined(); expect(store.getActionById("FINAL")).toEqual(closed);
  });
  it("does not delegate Audit findings away from their assigned reviewer", async () => {
    const { store } = await setup(fixture({ source: "Audit", sourceModule: "audit" })); await submit(store);
    expect(store.closeReviewedAction("FINAL", leader)).toBeUndefined(); expect(store.closeReviewedAction("FINAL", reviewer)?.status).toBe("Completed");
  });
  it("rejects inactive actors for priority, dates and delegated review", async () => {
    const { store, localStorage } = await setup(); const { ADMIN_USER_SEEDS } = await import("@/features/five-s/administration/store"); localStorage.setItem("five-s-administration-users-v1", JSON.stringify(ADMIN_USER_SEEDS.map(user => user.id === leader.id ? { ...user, status: "Inactive" } : user)));
    expect(store.changeActionPriority("FINAL", leader, "High")).toBeUndefined(); expect(store.changeActionDueDate("FINAL", leader, "2030-10-24", "Delay")).toBeUndefined(); await submit(store); expect(store.closeReviewedAction("FINAL", leader)).toBeUndefined();
  });
  it.each([["Gemba", "gemba"], ["Red Tag", "redTag"], ["Continuous Improvement", "continuousImprovement"], ["Audit", "audit"], ["Visual Management", "visualManagement"]] as const)("preserves %s linkage, evidence and history through submission and permitted closure", async (source, sourceModule) => {
    const { store } = await setup(fixture({ source, sourceModule, sourceId: `SOURCE-${sourceModule}` })); store.changeActionDueDate("FINAL", leader, "2030-10-24", "Delivery delayed"); await submit(store); const before = store.getActionById("FINAL")!;
    const closed = store.closeReviewedAction("FINAL", sourceModule === "audit" ? reviewer : leader)!; expect(closed).toMatchObject({ id: before.id, sourceId: before.sourceId, sourceModule, evidence: before.evidence, dueDateHistory: before.dueDateHistory, dueDateOverride: before.dueDateOverride, status: "Completed" }); expect(closed.activityHistory?.slice(0, before.activityHistory?.length)).toEqual(before.activityHistory);
    vi.resetModules(); const reloaded = await import("@/lib/actions/action-store"); expect(reloaded.getActionById("FINAL")?.closedByUserId).toBe(closed.closedByUserId);
  });
});
