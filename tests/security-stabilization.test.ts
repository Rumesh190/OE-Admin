import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";

let values: Map<string, string>;
beforeEach(() => {
  vi.resetModules(); values = new Map([["ops-red-tag-original-reset-v1", "done"], ["unrelated-data", "intact"]]);
  vi.stubGlobal("window", { alert: vi.fn(), localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } });
  authenticateDemoFixture();
  vi.stubGlobal("navigator", { userAgent: "Vitest", platform: "MacIntel" });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const manual = { title: "Authorized work", description: "Execute work", source: "Manual" as const, sourceModule: "manual" as const, sourceTitle: "Manual", plant: "Egmore Plant", area: "Zone A", department: "Production", assignedTo: "Ritika", responsiblePersonId: "USR-RITIKA", status: "Assigned" as const, priority: "Medium" as const, dueDate: "2030-12-20" };
async function api() {
  const identity = await import("@/lib/current-user"), directory = await import("@/features/five-s/administration/store");
  const actions = await import("@/lib/actions/action-store"), modules = await import("@/lib/module-entitlements");
  return { identity, directory, actions, modules };
}
function unchanged(operation: () => unknown) { const before = [...values]; expect(operation).toThrow(); expect([...values]).toEqual(before); }

describe("Security stabilization: entitlement command authority", () => {
  it.each(["responsible", "leader", "auditor"] as const)("rejects authenticated %s, including a spoofed Super Admin argument, without writes", async role => {
    const m = await api(); m.identity.setDemoRole(role);
    const before = [...values], access = m.modules.getOrganizationAccess("xyz-components");
    expect(Reflect.apply(m.modules.saveFactoryAccess, undefined, ["xyz-components", "PLANT-XYZ", { ...access, redTag: true }, { ...m.identity.DEMO_USERS.superAdmin }])).toBe(false);
    expect([...values]).toEqual(before); expect(m.modules.getOrganizationAccess("xyz-components")).toEqual(access);
  });
  it("preserves authorized platform Save, organization isolation and reload", async () => {
    const m = await api(); m.identity.setDemoRole("superAdmin");
    const abc = m.modules.getFactoryAccess("abc-manufacturing", "PLANT-EGM");
    const organizations = await import("@/features/five-s/administration/access-v3-store");
    const client = organizations.saveClientProfile({ name: "Isolated Test Client", industry: "Test" });
    const factory = organizations.saveFactory(client.id, { name: "Isolated Test Factory", code: "ITF", location: "Test", maximumActiveUsers: 10 });
    expect(m.modules.saveFactoryAccess(client.id, factory.id, { ...m.modules.NEW_FACTORY_ACCESS, redTag: true })).toBe(true);
    expect(m.modules.getFactoryAccess("abc-manufacturing", "PLANT-EGM")).toEqual(abc); vi.resetModules();
    const reloaded = await import("@/lib/module-entitlements");
    expect(reloaded.normalizeFactoryAccess(JSON.parse(values.get(m.modules.FACTORY_MODULE_ACCESS_KEY) ?? "{}" )).factories[factory.id].redTag).toBe(true);
    expect(JSON.parse(values.get(m.modules.FACTORY_MODULE_ACCESS_KEY) ?? "{}").factories[factory.id].redTag).toBe(true);
    expect(values.get("unrelated-data")).toBe("intact");
  });
  it("rejects signed-out, disabled and unknown organization writes; getter references cannot mutate entitlements", async () => {
    const m = await api(); m.identity.setDemoRole("superAdmin"); const access = m.modules.getOrganizationAccess();
    const copy = m.modules.getOrganizationAccess(); copy.actions = false; expect(m.modules.getOrganizationAccess().actions).toBe(access.actions);
    values.delete("5s-auth-session"); let before = [...values]; expect(m.modules.saveFactoryAccess("abc-manufacturing", "PLANT-EGM", access)).toBe(false); expect([...values]).toEqual(before);
    authenticateDemoFixture(); m.directory.getAdminUser(m.identity.DEMO_USERS.superAdmin.id)!.status = "Inactive";
    before = [...values]; expect(m.modules.saveFactoryAccess("abc-manufacturing", "PLANT-EGM", access)).toBe(false); expect([...values]).toEqual(before);
    m.directory.getAdminUser(m.identity.DEMO_USERS.superAdmin.id)!.status = "Active";
    expect(m.modules.saveFactoryAccess("UNKNOWN", "UNKNOWN", access)).toBe(false);
  });
});

describe("Security stabilization: canonical Action creation", () => {
  it("rejects unauthenticated and malformed sessions before storage initialization or allocation", async () => {
    const m = await api(); values.delete("5s-auth-session"); unchanged(() => m.actions.createAction(manual));
    values.set("5s-auth-session", "broken"); unchanged(() => m.actions.createAction(manual));
    values.set("5s-auth-session", JSON.stringify({ authenticated: true, username: "admin", version: 99 })); unchanged(() => m.actions.createAction(manual));
  });
  it("rejects unknown, disabled, Viewer and spoofed creators without trusting extra roles or identity arguments", async () => {
    const m = await api(); const actor = m.directory.getAdminUser(m.identity.DEMO_USERS.auditor.id)!;
    unchanged(() => m.actions.createAction({ ...manual, createdByUserId: "UNKNOWN" }));
    actor.status = "Inactive"; unchanged(() => m.actions.createAction(manual)); actor.status = "Active";
    actor.permissions = ["actions.view"]; actor.roles = ["Viewer"]; unchanged(() => m.actions.createAction(manual));
    m.identity.setDemoRole("responsible"); unchanged(() => Reflect.apply(m.actions.createAction, undefined, [{ ...manual, createdByUserId: m.identity.DEMO_USERS.auditor.id, roles: ["Admin"] }, m.identity.DEMO_USERS.superAdmin]));
    unchanged(() => m.actions.createAction({ ...manual, area: "Zone B" }));
  });
  it("rejects invalid/stale roles and cross-organization/plant/Zone scope", async () => {
    const m = await api();
    unchanged(() => m.actions.createAction({ ...manual, plant: "Other Plant" }));
    unchanged(() => m.actions.createAction({ ...manual, area: "Zone Missing" }));
    unchanged(() => m.actions.createAction({ ...manual, organizationId: "xyz-components" } as typeof manual));
    unchanged(() => m.actions.createAction({ ...manual, responsiblePersonId: "UNKNOWN" }));
    unchanged(() => m.actions.createAction({ ...manual, responsiblePersonId: "USR-SIVA-KUMAR" }));
    unchanged(() => m.actions.createAction({ ...manual, reviewerId: "USR-RITIKA" }));
    unchanged(() => m.actions.createAction({ ...manual, zoneLeaderId: "USR-RUMESH" }));
    values.set("five-s-demo-role", "UNKNOWN"); unchanged(() => m.actions.createAction(manual));
    values.set("five-s-demo-role", "superAdmin"); unchanged(() => m.actions.createAction(manual));
    values.delete("five-s-demo-role"); m.directory.getAdminUser(m.identity.DEMO_USERS.auditor.id)!.roles = ["Zone Member"];
    unchanged(() => m.actions.createAction({ ...manual, area: "Zone B" }));
  });
  it("blocks directory-manager impersonation that could otherwise grant Action creation permission", async () => {
    const m = await api(); m.identity.setDemoRole("responsible");
    const member = m.directory.getAdminUser(m.identity.DEMO_USERS.responsible.id)!;
    const before = structuredClone(member);
    unchanged(() => m.directory.updateAdminUser(member.id, { ...member, roles: ["Admin"], permissions: ["actions.create"] }, m.identity.DEMO_USERS.auditor.id));
    expect(m.directory.getAdminUser(member.id)).toEqual(before);
    unchanged(() => m.actions.createAction({ ...manual, area: "Zone B" }));
    m.identity.setDemoRole("auditor");
    expect(m.directory.updateAdminUser(member.id, { ...member, name: "Authorized updated member" }, m.identity.DEMO_USERS.auditor.id)?.name).toBe("Authorized updated member");
  });
  it("records the authenticated Action Center creator and clean history rather than caller-provided names/events", async () => {
    const m = await api(); const created = m.actions.createAction({ ...manual, createdByName: "Forged", auditor: "Forged", activityHistory: [{ id: "FAKE", type: "closed", actorId: "UNKNOWN", actorName: "Forged", createdAt: "2000-01-01" }] });
    expect(created).toMatchObject({ createdByUserId: "USR-LAKSHMAN", createdByName: "Lakshman", auditor: "Lakshman", sourceModule: "manual" });
    unchanged(() => m.actions.createAction({ ...manual, status: "Completed" }));
    unchanged(() => m.actions.createAction({ ...manual, closedByUserId: "USR-LAKSHMAN", closedAt: "2026-10-19" }));
    unchanged(() => m.actions.createAction({ ...manual, reviewHistory: [] }));
    expect(created.activityHistory).toHaveLength(1); expect(created.activityHistory![0]).toMatchObject({ type: "created", actorId: "USR-LAKSHMAN", actorName: "Lakshman" });
  });
  it("rejects a disabled module, missing sources and conflicting source identity before writing", async () => {
    const m = await api();
    unchanged(() => m.actions.createAction({ ...manual, source: "Red Tag", sourceModule: "redTag", sourceId: "MISSING" }));
    unchanged(() => m.actions.createAction({ ...manual, sourceModule: "redTag", sourceId: "MISSING" }));
    m.identity.setDemoRole("superAdmin"); expect(m.modules.saveFactoryAccess("abc-manufacturing", "PLANT-EGM", { ...m.modules.getOrganizationAccess(), actions: false })).toBe(true);
    m.identity.setDemoRole("auditor"); unchanged(() => m.actions.createAction(manual));
  });
  it("keeps fixture replacement, reset and clearing unavailable in production", async () => {
    const m = await api(); vi.stubEnv("NODE_ENV", "production");
    unchanged(() => m.actions.setActions([])); unchanged(() => m.actions.resetActions()); unchanged(() => m.actions.clearSavedActions());
  });
});

async function enableLegacyImprovement(m: Awaited<ReturnType<typeof api>>) {
  m.identity.setDemoRole("superAdmin"); expect(m.modules.saveFactoryAccess("abc-manufacturing", "PLANT-EGM", { ...m.modules.getOrganizationAccess(), visualImprovement: true })).toBe(true); m.identity.setDemoRole("auditor");
}
describe("Security stabilization: canonical source integrations", () => {
  it("permits authorized Gemba, rejects missing/foreign children and duplicate direct creation", async () => {
    const m = await api(), gemba = await import("@/features/gemba/gemba-store");
    const observation = gemba.saveGembaObservation("GEM-2026-015", { type: "Issue", title: "Physical issue", description: "Inspect", location: "Office", peopleInvolved: [], evidence: [] }, m.identity.DEMO_USERS.auditor)!;
    const input = { ...manual, source: "Gemba" as const, sourceModule: "gemba" as const, sourceId: observation.gembaId, sourceObservationId: observation.id };
    unchanged(() => m.actions.createAction({ ...input, sourceObservationId: "MISSING" }));
    const created = m.actions.createAction(input); expect(created.sourceId).toBe(observation.gembaId); unchanged(() => m.actions.createAction(input));
    expect(gemba.linkGembaAction(observation.gembaId, observation.id, created.id, m.identity.DEMO_USERS.auditor)).toBe(true);
    expect(gemba.getGembaState().observations.find(item => item.id === observation.id)?.actionId).toBe(created.id);
  });
  it("preserves the approved Red Tag creator exception, multiple Actions and canonical reverse links", async () => {
    const m = await api(), tags = await import("@/features/five-s/red-tag/store"); m.identity.setDemoRole("responsible"); const actor = m.identity.DEMO_USERS.responsible;
    const tag = tags.createAndSubmitRedTagV2({ plant: actor.plant, zone: "Zone B", section: "Production", department: "Production", itemName: "Fixture", reason: "Unused", remarks: "Review fixture", imageUrl: "/before.png", createdById: actor.id, createdByName: actor.name }, actor, m.identity.DEMO_USERS.leader)!;
    const input = { ...manual, area: "Zone B", source: "Red Tag" as const, sourceModule: "redTag" as const, sourceId: tag.id, responsiblePersonId: actor.id, assignedTo: actor.name };
    unchanged(() => m.actions.createAction({ ...input, status: "Completed" }));
    const a = m.actions.createAction(input), b = m.actions.createAction(input); expect(a.id).not.toBe(b.id);
    expect(tags.linkRedTagAction(tag.id, a.id, actor)).toBeDefined(); expect(tags.linkRedTagAction(tag.id, b.id, actor)).toBeDefined(); expect(tags.getRedTag(tag.id)?.actionIds).toEqual([a.id, b.id]);
    unchanged(() => m.actions.createAction({ ...input, area: "Zone A" }));
    Object.assign(tags.getRedTag(tag.id)!, { organizationId: "xyz-components" });
    unchanged(() => m.actions.createAction(input));
  });
  it("permits authorized CI and VI while preserving source identity and blocking unavailable records", async () => {
    const m = await api(), ci = await import("@/features/five-s/continuous-improvement/store"), viStore = await import("@/features/visual-improvement/visual-improvement-store"); await enableLegacyImprovement(m);
    const improvement = ci.getImprovements().find(item => item.zone === "Zone A")!;
    const visual = viStore.getVisualImprovements().find(item => item.zone === "Zone A" && !item.actionId)!;
    const input = { ...manual, source: "Continuous Improvement" as const, sourceModule: "continuousImprovement" as const, sourceId: improvement.id };
    expect(m.actions.createAction(input)).toMatchObject({ sourceModule: "continuousImprovement", sourceId: improvement.id });
    expect(m.actions.createAction({ ...manual, source: "Visual Improvement", sourceModule: "visualImprovement", sourceId: visual.id })).toMatchObject({ sourceModule: "visualImprovement", sourceId: visual.id });
    unchanged(() => m.actions.createAction({ ...input, sourceId: "FOREIGN-MISSING" }));
  });
  it("permits authorized Audit question creation and refuses conflicting question/parent or duplicate links", async () => {
    const m = await api(), auditStore = await import("@/lib/five-s/audit-store");
    const audit = auditStore.getFiveSAudits().find(item => item.area === "Zone A")!, question = audit.sections.flatMap(section => section.questions).find(item => !item.actionId)!;
    const input = { ...manual, source: "5S Audit" as const, sourceModule: "audit" as const, sourceId: audit.id, auditId: audit.id, questionId: question.id, sourceObservationId: question.id, status: "Awaiting Assignment" as const, assignedTo: "", responsiblePersonId: undefined };
    expect(m.actions.createAction(input)).toMatchObject({ auditId: audit.id, sourceId: audit.id, questionId: question.id }); unchanged(() => m.actions.createAction(input));
    unchanged(() => m.actions.createAction({ ...input, auditId: "OTHER" })); unchanged(() => m.actions.createAction({ ...input, questionId: "MISSING", sourceObservationId: "MISSING" }));
  });
  it("permits authorized VM topic Action creation and rejects nonexistent topic context", async () => {
    const m = await api(), vm = await import("@/features/visual-management/visual-management-store");
    const meeting = vm.startVisualManagementMeeting("VM-ZA-T1", m.identity.DEMO_USERS.auditor)!;
    const topic = vm.addMeetingTopic(meeting.id, { title: "Security fixture", description: "Investigate deviation", section: "Safety", owner: m.identity.DEMO_USERS.auditor, decision: "Investigate", followUpRequired: true }, m.identity.DEMO_USERS.auditor)!;
    const input = { ...manual, source: "Visual Management" as const, sourceModule: "visualManagement" as const, sourceId: meeting.id, sourceObservationId: topic.id };
    expect(m.actions.createAction(input)).toMatchObject({ sourceModule: "visualManagement", sourceId: meeting.id, sourceObservationId: topic.id }); unchanged(() => m.actions.createAction(input));
    unchanged(() => m.actions.createAction({ ...input, sourceObservationId: "MISSING" }));
  });
});
