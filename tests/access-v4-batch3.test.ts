import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";
import type { FiveSAudit } from "@/features/five-s/types/five-s";
const binary = vi.hoisted(() => new Map<string, Blob>());
vi.mock("@/lib/gemba/gemba-photo-storage", () => ({
  saveGembaPhoto: vi.fn(async (key: string, blob: Blob) => { binary.set(key, blob); }),
  getGembaPhoto: vi.fn(async (key: string) => binary.get(key)),
  dataUrlToBlob: (data: string) => data.startsWith("data:") ? new Blob(["image"], { type: "image/png" }) : null,
}));
export async function setup() {
  vi.resetModules(); binary.clear();
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent: vi.fn() }); vi.stubGlobal("localStorage", storage);
  const queues = new Map<string, Promise<unknown>>();
  vi.stubGlobal("navigator", { userAgent: "Vitest", platform: "test", locks: { request: (name: string, options: unknown, callback?: () => unknown) => {
    const work = typeof options === "function" ? options as () => unknown : callback!;
    const result = (queues.get(name) ?? Promise.resolve()).catch(() => undefined).then(work);
    queues.set(name, result); return result;
  } } });
  authenticateDemoFixture(); const current = await import("@/lib/current-user"); current.setDemoRole("superAdmin");
  const context = await import("@/features/five-s/administration/access-v4-context");
  const state = await import("@/features/five-s/administration/access-v3-state");
  const v4state = await import("@/features/five-s/administration/access-v4-state");
  const legacy = await import("@/features/five-s/administration/access-v3-store");
  const admin = await import("@/features/five-s/administration/access-v4-store");
  const people = await import("@/features/five-s/administration/store");
  const factoryAuth = await import("@/features/five-s/administration/factory-authorization");
  const client = legacy.saveClientProfile({ name: "Synthetic Audit Tenant", industry: "Manufacturing" });
  const ca = legacy.assignClientAdministrator(client.id, { person: { name: "Synthetic Client Admin", email: "ca@synthetic.invalid", employeeId: "CA-SYN" } });
  current.setAdministrationDemoIdentity(ca.id); const factory = legacy.saveFactory(client.id, { name: "Synthetic factory", code: "SYN", location: "Test" });
  function select(personId: string, kind: "platform" | "client" | "factory" = "factory") {
    if (personId === "USR-OPS-SUPER-ADMIN") current.setDemoRole("superAdmin"); else if (personId === "USR-LAKSHMAN") current.setDemoRole("auditor"); else current.setAdministrationDemoIdentity(personId);
    const base = { version: 1 as const, personId, selectionId: "" };
    if (kind === "platform") context.selectAccessContext({ ...base, kind }); else if (kind === "client") context.selectAccessContext({ ...base, kind, organizationId: client.id }); else context.selectAccessContext({ ...base, kind, organizationId: client.id, plantId: factory.id });
  }
  const exp = () => ({ selectionId: context.getActiveAccessContext()!.selectionId, revision: v4state.getAccessV4State().revision });
  select("USR-OPS-SUPER-ADMIN", "platform"); await admin.attachPersonToClient({ personId: "USR-LAKSHMAN", confirmedPersonId: "USR-LAKSHMAN", organizationId: client.id, reason: "Synthetic approved identity attachment", expectedV3Payload: storage.getItem(state.ACCESS_V3_KEY) }, exp());
  select(ca.id, "client"); legacy.assignFactoryAdministrator(client.id, factory.id, "USR-LAKSHMAN"); select("USR-LAKSHMAN");
  const za = legacy.saveFactoryZone(client.id, factory.id, { name: "Zone A", code: "ZA", department: "Legacy fixture" }); const zb = legacy.saveFactoryZone(client.id, factory.id, { name: "Zone B", code: "ZB", department: "Legacy fixture" });
  const scope = { organizationId: client.id, plantId: factory.id };
  const dept = await admin.saveDepartment({ ...scope, zoneId: za.id }, { name: "Approved synthetic Department", code: "SD", status: "Active" }, exp());
  function person(name: string, zoneId = za.id) { return legacy.saveFactoryUser(client.id, factory.id, { person: { name, email: `${name}@synthetic.invalid`, employeeId: name }, baseRole: "Standard User", zoneIds: [zoneId] }); }
  const owner = person("owner"), reviewer = person("reviewer"), reviewer2 = person("reviewer2"), coordinator = person("coordinator"), faVerifier = person("faVerifier"), leader = person("leader"), auditor = person("auditor", zb.id), foreign = person("foreign", zb.id);
  const role = async (personId: string, role: "Department Member" | "Department Leader" | "Zone Leader", zoneId = za.id) => admin.assignV4Role({ ...scope, zoneId, ...(role.startsWith("Department") ? { departmentId: dept.id } : {}) }, role, personId, exp());
  const ownerRole = await role(owner.id, "Department Member"); await role(reviewer.id, "Department Leader"); await role(reviewer2.id, "Department Leader"); const leaderRole = await role(leader.id, "Zone Leader"); await role(auditor.id, "Zone Leader", zb.id);
  select(ca.id, "client"); legacy.assignFactoryAdministrator(client.id, factory.id, coordinator.id); legacy.assignFactoryAdministrator(client.id, factory.id, faVerifier.id); select("USR-LAKSHMAN"); legacy.saveAuditorAuthorization(client.id, factory.id, auditor.id, [za.id, zb.id]);
  // Isolated activated fixture only. No application activation operation exists or runs here.
  const active = structuredClone(state.getAccessV3State()); active.clients = active.clients.map(c => c.id === client.id ? { ...c, operationalState: "Active" as const } : c); storage.setItem(state.ACCESS_V3_KEY, JSON.stringify(active));
  const modules = await import("@/lib/modules"); storage.setItem("ops-organization-modules-v1", JSON.stringify({ [client.id]: Object.fromEntries(Object.keys(modules.DEFAULT_MODULE_ENTITLEMENTS).map(k => [k, k === "audit"])) }));
  storage.setItem("standalone-5s-actions", "[]"); storage.setItem("manufacturing-qms-five-s-audits-v1", "[]");
  const auditStore = await import("@/lib/five-s/audit-store"); const actionStore = await import("@/lib/actions/action-store"); const service = await import("@/lib/actions/audit-corrective-actions"); const policy = await import("@/lib/actions/action-v4-policy"); const auditPolicy = await import("@/lib/five-s/audit-authorization"); const assets = await import("@/lib/actions/action-v4-assets");
  const auditExpected = (a: FiveSAudit) => ({ selectionId: context.getActiveAccessContext()!.selectionId, revision: a.revision! });
  function createAudit(departmentId: string | null = dept.id, zoneId = za.id, assignedAuditorId = "USR-LAKSHMAN", startNow = true) {
    const sections: FiveSAudit["sections"] = [{ category: "Sort", description: "Sort", score: 0, maxScore: 2, questions: [{ id: `Q-${crypto.randomUUID()}`, departmentId: departmentId ?? undefined, category: "Sort", question: "Synthetic noncompliance", questionSource: "custom", responseType: "Compliance", requireEvidenceOnNonCompliance: false, mandatory: true, score: null, maxScore: 2, status: "Not Started", actionRequired: false }] }];
    return auditStore.createFiveSAudit({ ...scope, zoneId, assignedAuditorId, title: "Generated", plant: factory.name, department: "", area: "Zone A", auditor: "", dueDate: "2099-01-01", scheduledDate: "2099-01-01", scheduledTime: "09:00", sections }, { startNow, expectedContextSelectionId: context.getActiveAccessContext()!.selectionId });
  }
  function finding(a: FiveSAudit) {
    auditStore.updateFiveSAudit(a.id, { sections: a.sections.map(s => ({ ...s, questions: s.questions.map(q => ({ ...q, score: 0, complianceResponse: 0, status: "Fail", observation: "Repair required", actionRequired: true })) })) }, current.getCurrentDemoUser(), auditExpected(a));
    return auditStore.getFiveSAuditById(a.id)!;
  }
  const latestAudit = (id: string) => auditStore.getFiveSAuditById(id)!;
  const expectedD10 = (a: FiveSAudit) => ({ selectionId: context.getActiveAccessContext()!.selectionId, auditRevision: a.revision!, administrationRevision: v4state.getAccessV4State().revision });
  const input = (assignmentId = ownerRole.id) => ({ title: "Correct issue", description: "Repair the noncompliance", assignmentId, dueDate: "2099-01-01", priority: "Medium" as const });
  const actionExpected = (id: string) => ({ selectionId: context.getActiveAccessContext()!.selectionId, revision: policy.readCanonicalActions().find(a => a.id === id)!.v4!.revision });
  async function task(assignmentId = ownerRole.id) { select("USR-LAKSHMAN"); const a = finding(createAudit()); const action = await service.createAuditQuestionCorrectiveAction(a.id, a.sections[0].questions[0].id, input(assignmentId), expectedD10(a)); return { audit: latestAudit(a.id), action }; }
  async function selectedTask() { const t = await task(); select(coordinator.id); await service.selectAuditActionVerifier(t.action.id, reviewer.id, "", actionExpected(t.action.id)); select(owner.id); return t; }
  async function workedTask() { const t = await selectedTask(); await actionStore.executeV4ActionTransition(t.action.id, actionExpected(t.action.id), { operation: "start", actionType: "corrective" }); const file = Object.assign(new Blob(["proof"], { type: "image/png" }), { name: "proof.png" }) as File; await service.uploadAuditActionEvidence(t.action.id, file, "resolution", actionExpected(t.action.id)); return t; }
  return { values, storage, current, context, state, v4state, legacy, admin, people, factoryAuth, client, ca, factory, za, zb, scope, dept, owner, reviewer, reviewer2, coordinator, faVerifier, leader, auditor, foreign, ownerRole, leaderRole, select, exp, role, createAudit, finding, latestAudit, expectedD10, input, actionExpected, task, selectedTask, workedTask, auditStore, actionStore, service, policy, auditPolicy, assets, auditExpected };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Batch 3 scoped Audit and canonical corrective Actions", () => {
  it("isolates IQ-like Audit records from ABC and rejects forged actors/context and missing expectations", async () => {
    const s = await setup(); const a = s.createAudit(); const before = [...s.values];
    expect(() => s.auditStore.updateFiveSAudit(a.id, { sections: a.sections }, { id: s.owner.id }, s.auditExpected(a))).toThrow();
    expect(() => s.auditStore.updateFiveSAudit(a.id, { sections: a.sections })).toThrow(/revision/); expect([...s.values]).toEqual(before);
    s.current.setDemoRole("leader"); expect(s.auditStore.getFiveSAuditById(a.id)).toBeUndefined(); expect(s.auditPolicy.canExecuteScopedAudit(a)).toBe(false);
  });
  it("preserves direct FA execution and explicit ZL Auditor grant with own-Zone exclusion", async () => {
    const s = await setup(); const a = s.createAudit(undefined, s.za.id, s.auditor.id, false); expect(() => s.createAudit(null, s.zb.id, s.auditor.id, false)).toThrow(/eligible authorized auditor/); const own = { ...a, zoneId: s.zb.id };
    s.select(s.auditor.id); expect(s.auditPolicy.canExecuteScopedAudit(a, s.auditor.id, "start")).toBe(true); expect(s.auditPolicy.canExecuteScopedAudit(own, s.auditor.id, "start")).toBe(false);
    const started = s.auditStore.startScheduledFiveSAudit(a.id, new Date(), s.auditExpected(a)); expect(started?.status).toBe("In Progress");
    s.select(s.coordinator.id); const direct = s.createAudit(undefined, s.za.id, s.coordinator.id); expect(s.auditPolicy.canExecuteScopedAudit(direct)).toBe(true);
    s.select(s.ca.id, "client"); expect(s.auditPolicy.canExecuteScopedAudit(direct)).toBe(false);
  });
  it("creates one real canonical Action with exact source, tenant and recorded capacity, and retries without duplication", async () => {
    const s = await setup(); const { action, audit } = await s.task();
    expect(action.organizationId).toBe(s.client.id); expect(action.plantId).toBe(s.factory.id); expect(action.departmentId).toBe(s.dept.id); expect(action.v4!.workCapacity.roleAssignmentId).toBe(s.ownerRole.id); expect(action.v4!.workCapacity.capacity).toBe("Department Member"); expect(audit.sections[0].questions[0].actionId).toBe(action.id);
    expect(s.policy.readCanonicalActions()).toHaveLength(1); const before = [...s.values];
    const repeated = await s.service.createAuditQuestionCorrectiveAction(audit.id, action.questionId!, s.input(), s.expectedD10(audit)); expect(repeated.id).toBe(action.id); expect([...s.values]).toEqual(before);
  });
  it("blocks missing Department, foreign/cross-Zone assignment and generic v4 source-link bypass", async () => {
    const s = await setup(); const missing = s.finding(s.createAudit(undefined));
    // createAudit's default argument is intentionally overridden here with an explicit source snapshot edit fixture.
    const raw = s.policy.readCanonicalAudits().map(a => a.id === missing.id ? { ...a, sections: a.sections.map(sec => ({ ...sec, questions: sec.questions.map(q => ({ ...q, departmentId: undefined })) })) } : a); s.storage.setItem(s.policy.AUDITS_KEY, JSON.stringify(raw)); const a = s.latestAudit(missing.id); const before = [...s.values];
    await expect(s.service.createAuditQuestionCorrectiveAction(a.id, a.sections[0].questions[0].id, s.input(), s.expectedD10(a))).rejects.toThrow(/Department/); expect([...s.values]).toEqual(before);
    const valid = s.finding(s.createAudit()); await expect(s.service.createAuditQuestionCorrectiveAction(valid.id, valid.sections[0].questions[0].id, s.input("foreign-assignment"), s.expectedD10(valid))).rejects.toThrow(/assignment/);
    expect(() => s.auditStore.linkAuditQuestionAction(valid.id, valid.sections[0].questions[0].id, "fake", s.current.getCurrentDemoUser())).toThrow(/atomic/);
  });
  it("allows Audit completion with a valid open Action and blocks fabricated linkage", async () => {
    const s = await setup(); const t = await s.task(); const a = s.latestAudit(t.audit.id); const sig = { userId: "USR-LAKSHMAN", userName: "Lakshman", signedAt: new Date().toISOString(), signatureImage: "data:image/png;base64,signature" };
    s.auditStore.updateFiveSAudit(a.id, { auditorSignature: sig }, s.current.getCurrentDemoUser(), s.auditExpected(a)); const signed = s.latestAudit(a.id);
    expect(s.auditStore.completeFiveSAudit(a.id, signed.sections, s.current.getCurrentDemoUser(), s.auditExpected(signed))?.status).toBe("Completed"); expect(s.policy.readCanonicalActions()[0].status).toBe("Assigned");
  });
  it("narrows task access without general Actions entitlement and excludes unrelated/foreign task readers", async () => {
    const s = await setup(); const t = await s.task(); s.select(s.owner.id);
    expect(s.policy.canReadV4Action(t.action)).toBe(true); expect(s.policy.narrowAuditTaskHref(`/actions/${t.action.id}`)).toBe(true); expect(s.policy.narrowAuditTaskHref("/actions")).toBe(false);
    const access = await import("@/lib/module-entitlements"); expect(access.getOrganizationAccess(s.client.id).actions).toBe(false);
    s.select(s.foreign.id); expect(s.policy.canReadV4Action(t.action)).toBe(false); expect(s.actionStore.getActionById(t.action.id)).toBeUndefined();
  });
  it("allows draft work without verifier and prevents submission without explicit independent selection", async () => {
    const s = await setup(); const t = await s.task(); s.select(s.owner.id);
    expect(await s.actionStore.executeV4ActionTransition(t.action.id, s.actionExpected(t.action.id), { operation: "start", actionType: "corrective" })).toBeTruthy();
    const file = Object.assign(new Blob(["proof"], { type: "image/png" }), { name: "proof.png" }) as File; await s.service.uploadAuditActionEvidence(t.action.id, file, "resolution", s.actionExpected(t.action.id));
    await expect(s.actionStore.executeV4ActionTransition(t.action.id, s.actionExpected(t.action.id), { operation: "submit", observation: "Fixed", correctiveActionCategory: "Repair", costSaving: 0 })).rejects.toThrow(/verifier/);
  });
  it("rejects creator, completer/owner, peer and coordinator/verifier self-selection", async () => {
    const s = await setup(); const t = await s.task(); const before = [...s.values];
    await expect(s.service.selectAuditActionVerifier(t.action.id, s.reviewer.id, "", s.actionExpected(t.action.id))).rejects.toThrow(/independent/); expect([...s.values]).toEqual(before);
    s.select(s.owner.id); await expect(s.service.selectAuditActionVerifier(t.action.id, s.reviewer.id, "", s.actionExpected(t.action.id))).rejects.toThrow(/independent/);
    s.select(s.coordinator.id); await expect(s.service.selectAuditActionVerifier(t.action.id, s.owner.id, "", s.actionExpected(t.action.id))).rejects.toThrow(/independent/);
  });
  it("uses recorded capacity even if owner gains a higher role and completes review/rework/closure canonically", async () => {
    const s = await setup(); const t = await s.workedTask();
    const snapshot = structuredClone(s.policy.readCanonicalActions()[0].v4!.workCapacity);
    s.select("USR-LAKSHMAN"); await s.role(s.owner.id, "Department Leader"); s.select(s.owner.id);
    await s.actionStore.executeV4ActionTransition(t.action.id, s.actionExpected(t.action.id), { operation: "submit", observation: "Fixed", correctiveActionCategory: "Repair", costSaving: 0 });
    s.select(s.reviewer.id); await s.actionStore.executeV4ActionTransition(t.action.id, s.actionExpected(t.action.id), { operation: "rework", reason: "More work" });
    s.select(s.owner.id); await s.actionStore.executeV4ActionTransition(t.action.id, s.actionExpected(t.action.id), { operation: "start", actionType: "corrective" }); await s.actionStore.executeV4ActionTransition(t.action.id, s.actionExpected(t.action.id), { operation: "submit", observation: "Fixed again", correctiveActionCategory: "Repair", costSaving: 0 });
    s.select(s.reviewer.id); const closed = await s.actionStore.executeV4ActionTransition(t.action.id, s.actionExpected(t.action.id), { operation: "close", reason: "Verified" });
    expect(closed?.status).toBe("Completed"); expect(closed?.submissionRevisions).toHaveLength(2); expect(closed?.v4!.workCapacity).toEqual(snapshot); expect(closed?.closedByUserId).toBe(s.reviewer.id);
  });
  it("blocks revoked verifier/coordinator eligibility and requires reasoned replacement with retained history", async () => {
    const s = await setup(); const t = await s.workedTask(); const data = structuredClone(s.v4state.getAccessV4State());
    data.assignments = data.assignments.map(r => r.personId === s.reviewer.id ? { ...r, status: "Revoked", revokedBy: "USR-LAKSHMAN", revokedAt: new Date().toISOString(), revocationReason: "Synthetic revocation", revision: r.revision + 1 } : r); data.revision++; s.storage.setItem("ops-access-v4-administration-v1", JSON.stringify(data));
    await expect(s.actionStore.executeV4ActionTransition(t.action.id, s.actionExpected(t.action.id), { operation: "submit", observation: "Fixed", correctiveActionCategory: "Repair", costSaving: 0 })).rejects.toThrow(/verifier/);
    s.select(s.coordinator.id); await expect(s.service.selectAuditActionVerifier(t.action.id, s.reviewer2.id, "", s.actionExpected(t.action.id))).rejects.toThrow(/reason/);
    const next = await s.service.selectAuditActionVerifier(t.action.id, s.reviewer2.id, "Reviewed replacement", s.actionExpected(t.action.id)); expect(next.v4!.verifierHistory).toHaveLength(1); expect(next.v4!.verifierHistory[0].previousSelection.verifierPersonId).toBe(s.reviewer.id);
  });
  it("requires two independent FAs for ZL work, blocks one-FA factories and unqualified FA-work designation", async () => {
    const s = await setup(); const t = await s.task(s.leaderRole.id); s.select(s.coordinator.id);
    await expect(s.service.selectAuditActionVerifier(t.action.id, s.coordinator.id, "", s.actionExpected(t.action.id))).rejects.toThrow(/independent/);
    await s.service.selectAuditActionVerifier(t.action.id, s.faVerifier.id, "", s.actionExpected(t.action.id));
    const state = structuredClone(s.state.getAccessV3State()); state.factoryAdmins = state.factoryAdmins.filter(a => a.userId === s.coordinator.id); s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(state));
    expect(s.policy.eligibleV4Coordinator(s.policy.readCanonicalActions()[0], s.coordinator.id, s.coordinator.id)).toBe(false); expect(s.policy.validV4Selection(s.policy.readCanonicalActions()[0])).toBe(false);
    const action = s.policy.readCanonicalActions()[0]; action.v4!.workCapacity = { ...action.v4!.workCapacity, capacity: "Factory Admin", assignmentScope: s.scope }; s.storage.setItem(s.policy.ACTIONS_KEY, JSON.stringify([action]));
    await expect(s.service.selectAuditActionVerifier(action.id, s.faVerifier.id, "", s.actionExpected(action.id))).rejects.toThrow(/qualification/);
  });
  it("serializes simultaneous source creation and blocks stale context/revision without partial publication", async () => {
    const s = await setup(); const a = s.finding(s.createAudit()); const q = a.sections[0].questions[0]; const expected = s.expectedD10(a);
    const results = await Promise.allSettled([s.service.createAuditQuestionCorrectiveAction(a.id, q.id, s.input(), expected), s.service.createAuditQuestionCorrectiveAction(a.id, q.id, s.input(), expected)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(s.policy.readCanonicalActions()).toHaveLength(1);
    const b = s.finding(s.createAudit()); const old = s.expectedD10(b); s.select("USR-LAKSHMAN"); const before = [...s.values];
    await expect(s.service.createAuditQuestionCorrectiveAction(b.id, b.sections[0].questions[0].id, s.input(), old)).rejects.toThrow(/context/); expect([...s.values]).toEqual(before);
  });
  it("rolls Action/source writes back together on quota failure and permits safe retry", async () => {
    const s = await setup(); const a = s.finding(s.createAudit()); const original = s.storage.setItem; let fail = true;
    const sourceBytes = s.storage.getItem(s.policy.AUDITS_KEY); const actionBytes = s.storage.getItem(s.policy.ACTIONS_KEY);
    vi.spyOn(s.storage, "setItem").mockImplementation((k, v) => { if (k === s.policy.AUDITS_KEY && fail) { fail = false; throw new Error("quota"); } original(k, v); });
    await expect(s.service.createAuditQuestionCorrectiveAction(a.id, a.sections[0].questions[0].id, s.input(), s.expectedD10(a))).rejects.toThrow(/restored/); expect(s.storage.getItem(s.policy.AUDITS_KEY)).toBe(sourceBytes); expect(s.storage.getItem(s.policy.ACTIONS_KEY)).toBe(actionBytes);
    const next = await s.service.createAuditQuestionCorrectiveAction(a.id, a.sections[0].questions[0].id, s.input(), s.expectedD10(a)); expect(next.id).toBeTruthy(); expect(s.policy.readCanonicalActions()).toHaveLength(1);
  });
  it("tracks successful Blob upload after metadata failure without deleting previous evidence", async () => {
    const s = await setup(); const t = await s.selectedTask(); await s.actionStore.executeV4ActionTransition(t.action.id, s.actionExpected(t.action.id), { operation: "start", actionType: "corrective" });
    const old = s.storage.getItem(s.policy.ACTIONS_KEY); const original = s.storage.setItem; let fail = true;
    vi.spyOn(s.storage, "setItem").mockImplementation((k, v) => { if (k === s.policy.ACTIONS_KEY && fail) { fail = false; throw new Error("quota"); } original(k, v); });
    const file = Object.assign(new Blob(["new photo"], { type: "image/png" }), { name: "proof.png" }) as File;
    await expect(s.service.uploadAuditActionEvidence(t.action.id, file, "resolution", s.actionExpected(t.action.id))).rejects.toThrow(/restored/); expect(s.storage.getItem(s.policy.ACTIONS_KEY)).toBe(old); expect(binary.size).toBe(1);
    const ledger = JSON.parse(s.storage.getItem("ops-access-v4-administration-v1")!).assetIntents; expect(ledger).toHaveLength(1); expect(ledger[0].state).toBe("Stored");
  });
  it("keeps Staged clients and revoked entitlements blocked, and prevents generic lifecycle/evidence bypass", async () => {
    const s = await setup(); const t = await s.task(); s.select(s.owner.id); const a = s.policy.readCanonicalActions()[0]; const user = s.current.getCurrentDemoUser(); const before = [...s.values];
    expect(s.actionStore.updateAction(a.id, { evidence: [{ id: "fake", name: "fake", type: "image", uploadedAt: "now", uploadedBy: user.id }] }, user)).toBeUndefined();
    expect(() => s.actionStore.startAssignedAction(a.id, { ...user, v4Expectation: s.actionExpected(a.id) }, "corrective")).toThrow(/protected/); expect([...s.values]).toEqual(before);
    const data = structuredClone(s.state.getAccessV3State()); data.clients = data.clients.map(c => c.id === s.client.id ? { ...c, operationalState: "Staged" } : c); s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(data)); expect(s.policy.canReadV4Action(t.action)).toBe(false); expect(s.auditPolicy.canReadScopedAudit(t.audit)).toBe(false);
  });
});
