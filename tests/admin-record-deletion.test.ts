import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";
import type { MyAction } from "@/features/five-s/types/my-actions";
import type { DeletionModule } from "@/lib/records/record-tombstones";

async function setup() {
  vi.resetModules();
  const values = new Map<string, string>();
  const localStorage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal("window", { localStorage }); vi.stubGlobal("localStorage", localStorage);
  authenticateDemoFixture(); localStorage.setItem("five-s-demo-role", "auditor"); localStorage.setItem("ops-red-tag-original-reset-v1", "done");
  localStorage.setItem("ops-organization-modules-v1", JSON.stringify({ visualImprovement: true, visualManagement: true, gemba: true }));
  const actions = await import("@/lib/actions/action-store"); actions.getActions();
  const audit = await import("@/lib/five-s/audit-store"); const red = await import("@/features/five-s/red-tag/store");
  const gemba = await import("@/features/gemba/gemba-store"); const ci = await import("@/features/five-s/continuous-improvement/store");
  const visual = await import("@/features/visual-improvement/visual-improvement-store"); const vm = await import("@/features/visual-management/visual-management-store");
  const deletion = await import("@/lib/records/record-deletion"); const tombstones = await import("@/lib/records/record-tombstones");
  const ids: Record<DeletionModule, string> = { audit: audit.getFiveSAudits()[0].id, redTag: red.getRedTags()[0].id, gemba: gemba.getGembaState().walks[0].id, gembaObservation: gemba.getGembaState().observations[0].id, continuousImprovement: ci.getImprovements()[0].id, visualImprovement: visual.getVisualImprovements()[0].id, vmBoard: vm.getVisualManagementState().boards[0].id, vmMeeting: vm.getVisualManagementState().meetings[0].id, action: "ACT-DELETE-TEST" };
  const active = (module: DeletionModule) => module === "audit" ? audit.getFiveSAudits() : module === "redTag" ? red.getRedTags() : module === "gemba" ? gemba.getGembaState().walks : module === "gembaObservation" ? gemba.getGembaState().observations : module === "continuousImprovement" ? ci.getImprovements() : module === "visualImprovement" ? visual.getVisualImprovements() : module === "vmBoard" ? vm.getVisualManagementState().boards : module === "vmMeeting" ? vm.getVisualManagementState().meetings : actions.getActions();
  return { localStorage, values, actions, audit, red, gemba, ci, visual, vm, deletion, tombstones, ids, active };
}
function linkedAction(module: DeletionModule, id: string): MyAction {
  return { id: "ACT-DELETE-TEST", title: "Retained execution", description: "Preserve all fields", source: "Manual", sourceModule: module === "gembaObservation" ? "gemba" : module === "vmBoard" || module === "vmMeeting" ? "visualManagement" : module === "action" ? "manual" : module, sourceId: id, sourceTitle: id, ...(module === "gembaObservation" ? { sourceObservationId: id } : {}), plant: "Egmore Plant", area: "Zone A", department: "Production", assignedTo: "Lakshman", responsiblePersonId: "USR-LAKSHMAN", createdByUserId: "USR-LAKSHMAN", status: "In Progress", priority: "Medium", dueDate: "2030-12-01", createdAt: "2026-10-01", evidence: [{ id: "E-KEEP", name: "Preserved photo", type: "image", uploadedBy: "Lakshman", uploadedAt: "2026-10-01", url: "/demo-5s/not-good-example.png" }], activityHistory: [{ id: "H-KEEP", type: "started", actorId: "USR-LAKSHMAN", actorName: "Lakshman", createdAt: "2026-10-01" }], reviewHistory: [], submissionRevisions: [] };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Admin-only browser-local operational deletion", () => {
  it.each<DeletionModule>(["audit", "redTag", "gemba", "gembaObservation", "continuousImprovement", "visualImprovement", "vmBoard", "vmMeeting"])("deletes only %s from active views and preserves canonical linked Actions byte-for-byte", async module => {
    const s = await setup(); const id = s.ids[module]; const action = linkedAction(module, id); if (module === "gemba") action.sourceObservationId = s.gemba.getGembaState().observations.find(item => item.gembaId === id)?.id; s.actions.setActions([action]);
    const evidenceResolver = await import("@/lib/actions/action-evidence"); const beforeEvidence = ["gemba", "redTag"].includes(module) ? evidenceResolver.resolveActionSourceBeforeEvidence(action, s.red.getRedTags()) : undefined;
    const before = structuredClone(s.actions.getActions()); s.localStorage.setItem("standalone-5s-actions", JSON.stringify(before)); const persistedActions = s.localStorage.getItem("standalone-5s-actions"); const otherIds = s.active(module).filter(item => item.id !== id).map(item => item.id);
    expect(s.deletion.canDeleteOperationalRecord(module, id)).toBe(true);
    expect(() => s.deletion.deleteOperationalRecord(module, id)).toThrow(/Confirm/);
    expect(s.active(module).some(item => item.id === id)).toBe(true);
    const deleted = s.deletion.deleteOperationalRecord(module, id, true);
    expect(deleted.linkedActionIds).toContain(action.id);
    expect(s.active(module).map(item => item.id)).toEqual(otherIds);
    expect(s.actions.getActions()).toEqual(before); expect(s.localStorage.getItem("standalone-5s-actions")).toBe(persistedActions);
    if (beforeEvidence) { const afterEvidence = evidenceResolver.resolveActionSourceBeforeEvidence(action, s.red.getRedTags()); expect(afterEvidence.evidence).toEqual(beforeEvidence.evidence); expect(afterEvidence.state).toBe(beforeEvidence.state); expect(afterEvidence.provenance).toContain(id); }
    const config = await import("@/lib/actions/action-config");
    expect(config.getActionSourceHref(action)).toBeUndefined(); expect(config.getActionSourceRecordLabel(action)).toContain("Source deleted");
    expect(s.values.has(s.tombstones.DELETION_STORAGE_KEY)).toBe(true);
    expect(() => s.deletion.deleteOperationalRecord(module, id, true)).toThrow();
  });
  it("rejects non-Admin, unauthenticated, platform Super Admin, foreign-plant and foreign-organization calls", async () => {
    const s = await setup(); const id = s.ids.audit;
    for (const role of ["leader", "responsible", "superAdmin"]) { s.localStorage.setItem("five-s-demo-role", role); expect(() => s.deletion.deleteOperationalRecord("audit", id, true)).toThrow(/Admin/); expect(() => s.tombstones.commitOperationalDeletion("audit", id, true)).toThrow(/Admin/); }
    s.localStorage.setItem("five-s-demo-role", "auditor"); s.localStorage.removeItem("5s-auth-session"); expect(() => s.deletion.deleteOperationalRecord("audit", id, true)).toThrow(); authenticateDemoFixture();
    const base = s.ci.getImprovements()[0]; s.ci.setImprovements([{ ...base, plant: "Other Plant" }]); expect(() => s.deletion.deleteOperationalRecord("continuousImprovement", base.id, true)).toThrow();
    s.ci.setImprovements([{ ...base, organizationId: "xyz-components" } as typeof base]); expect(() => s.deletion.deleteOperationalRecord("continuousImprovement", base.id, true)).toThrow();
    expect(s.tombstones.getRecordTombstone("audit", id)).toBeUndefined();
  });
  it("deleting an Action leaves its source and required Action references unresolved", async () => {
    const s = await setup(); const item = s.ci.getImprovements()[0]; const action = linkedAction("continuousImprovement", item.id); s.actions.setActions([action]); s.ci.setImprovements([{ ...item, status: "in_progress", actionIds: [action.id] }]);
    const before = structuredClone(s.ci.getImprovements()); s.deletion.deleteOperationalRecord("action", action.id, true);
    expect(s.actions.getActionById(action.id)).toBeUndefined(); expect(s.ci.getImprovements()).toEqual(before);
    expect(s.ci.getImprovementById(item.id)?.actionIds).toContain(action.id);
    const users = await import("@/lib/current-user");
    s.ci.setImprovements([{ ...before[0], status: "awaiting_completion_review" }]);
    expect(() => s.ci.completeImprovementReview(item.id, "Reviewed", users.DEMO_USERS.auditor)).toThrow(/Complete linked Action/);
    expect(s.ci.getImprovementById(item.id)?.status).toBe("awaiting_completion_review");
  });
  it("retains evidence archives, deleted IDs and tombstones across reload without resetting source storage", async () => {
    const s = await setup(); const id = s.ids.redTag; const original = structuredClone(s.red.getRedTag(id));
    s.deletion.deleteOperationalRecord("redTag", id, true); expect(s.red.getRedTagEvidenceArchive().find(item => item.id === id)).toEqual(original);
    vi.resetModules(); const reloaded = await import("@/features/five-s/red-tag/store"); expect(reloaded.getRedTag(id)).toBeUndefined(); expect(reloaded.getRedTagEvidenceArchive().some(item => item.id === id)).toBe(true);
    const commands = await import("@/lib/records/module-records"); const first = commands.allocateModuleRecordId("redTag", ["RT-000099"]); expect(first).toBe("RT-000100"); expect(commands.allocateModuleRecordId("redTag", [])).toBe("RT-000101");
  });
  it("does not reuse a deleted numeric source ID during real record creation", async () => {
    const s = await setup(); const base = s.ci.getImprovements()[0]; s.ci.setImprovements([{ ...base, id: "CI-000099" }]);
    s.deletion.deleteOperationalRecord("continuousImprovement", "CI-000099", true);
    const users = await import("@/lib/current-user");
    const created = s.ci.createImprovement({ title: "New proposal", issueDescription: "New issue", estimatedTime: 1, estimatedTimeUnit: "Days", memberIds: [], plant: "Egmore Plant", zone: "Zone A" }, users.DEMO_USERS.auditor, true)!;
    expect(created.id).toBe("CI-000100"); expect(s.ci.getImprovementById("CI-000099")).toBeUndefined();
  });
  it("fails without partial deletion when persistence is unavailable or module access is disabled", async () => {
    const s = await setup(); const id = s.ids.audit; vi.spyOn(console, "error").mockImplementation(() => {}); const write = vi.spyOn(s.localStorage, "setItem").mockImplementation(() => { throw new Error("Unavailable"); });
    expect(() => s.deletion.deleteOperationalRecord("audit", id, true)).toThrow(); expect(s.audit.getFiveSAuditById(id)).toBeDefined(); write.mockRestore();
    s.localStorage.setItem("ops-organization-modules-v1", JSON.stringify({ audit: false })); vi.resetModules(); const audit = await import("@/lib/five-s/audit-store"); audit.getFiveSAudits(); const deletion = await import("@/lib/records/record-deletion"); expect(() => deletion.deleteOperationalRecord("audit", id, true)).toThrow();
  });
  it("retains other VM meetings and preserves their access after board deletion", async () => {
    const s = await setup(); const board = s.vm.getVisualManagementState().boards.find(board => s.vm.getVisualManagementState().meetings.some(meeting => meeting.boardId === board.id))!;
    const meetings = structuredClone(s.vm.getVisualManagementState().meetings); s.deletion.deleteOperationalRecord("vmBoard", board.id, true);
    expect(s.vm.getVisualManagementState().meetings).toEqual(meetings);
    const access = await import("@/features/visual-management/visual-management-access"); const users = await import("@/lib/current-user");
    expect(access.visibleVisualManagementMeetings(meetings, s.vm.getVisualManagementState().boards, users.DEMO_USERS.auditor, ["Admin"]).map(item => item.id)).toEqual(meetings.map(item => item.id));
  });
  it("preserves deleted VM meeting archives when creating another meeting", async () => {
    const s = await setup();
    const original = structuredClone(s.vm.getVisualManagementState().meetings.find(item => item.status === "Completed")!);
    expect(original).toBeDefined();
    s.deletion.deleteOperationalRecord("vmMeeting", original.id, true);
    const users = await import("@/lib/current-user");
    s.vm.startVisualManagementMeeting(original.boardId, users.DEMO_USERS.auditor);
    const persisted = JSON.parse(s.localStorage.getItem("ops-visual-management-v1")!);
    expect(persisted.meetings.find((item: { id: string }) => item.id === original.id)).toEqual(original);
    expect(s.vm.getVisualManagementMeeting(original.id)).toBeUndefined();
  });

  it("retains legacy Red Flag references that identify an existing Red Tag", async () => {
    const s = await setup(); const id = s.ids.redTag;
    s.actions.setActions([{ ...linkedAction("redTag", id), source: "Red Flag", sourceModule: "redFlag" }]);
    const deleted = s.deletion.deleteOperationalRecord("redTag", id, true);
    expect(deleted.linkedActionIds).toContain("ACT-DELETE-TEST");
    const relationships = await import("@/lib/relationships/canonical-records");
    const edges = relationships.canonicalRelationshipEdges({ actions: s.actions.getActions(), redTags: [], improvements: [], audits: [], visualImprovements: [], gemba: s.gemba.getGembaState(), vm: s.vm.getVisualManagementState(), relationships: [] });
    const resolved = relationships.resolveLinkedRecordEntries({ module: "action", recordId: "ACT-DELETE-TEST" }, edges, [{ ref: { module: "action", recordId: "ACT-DELETE-TEST" }, title: "Retained execution", status: "In Progress", href: "/actions/ACT-DELETE-TEST" }]);
    expect(resolved.entries.some(item => item.record.deleted && item.record.ref.module === "redTag")).toBe(true);
  });

});
