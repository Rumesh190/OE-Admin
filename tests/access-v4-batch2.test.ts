import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";
async function setup() {
  vi.resetModules();
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent: vi.fn() }); vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("navigator", { locks: { request: async (_: string, _options: unknown, work: () => unknown) => work() } });
  authenticateDemoFixture();
  const current = await import("@/lib/current-user"); current.setDemoRole("superAdmin");
  const directory = await import("@/features/five-s/administration/store");
  const legacy = await import("@/features/five-s/administration/access-v3-store");
  const state = await import("@/features/five-s/administration/access-v3-state");
  const v4 = await import("@/features/five-s/administration/access-v4-state");
  const context = await import("@/features/five-s/administration/access-v4-context");
  const policy = await import("@/features/five-s/administration/factory-authorization");
  const plan = await import("@/features/five-s/administration/iq-onboarding");
  const commands = await import("@/features/five-s/administration/iq-onboarding-store");
  legacy.assignClientAdministrator("abc-manufacturing", { userId: "USR-RUMESH" });
  current.setDemoRole("leader"); legacy.assignFactoryAdministrator("abc-manufacturing", "PLANT-EGM", "USR-LAKSHMAN"); current.setDemoRole("superAdmin");
  function select(kind: "platform" | "client" | "factory", organizationId?: string, plantId?: string) {
    const base = { version: 1 as const, selectionId: "", personId: current.getCurrentDemoUser().id };
    if (kind === "platform") context.selectAccessContext({ ...base, kind });
    else if (kind === "client") context.selectAccessContext({ ...base, kind, organizationId: organizationId! });
    else context.selectAccessContext({ ...base, kind, organizationId: organizationId!, plantId: plantId! });
  }
  select("platform");
  const expected = plan.captureOnboardingExpectation;
  async function clientAndAdministrator() { const client = await commands.createIQStagedClient(expected()); const administrator = await commands.setupIQClientAdministrator(client.id, expected()); return { client, administrator }; }
  async function withFactory() { const s = await clientAndAdministrator(); current.setAdministrationDemoIdentity(s.administrator.id); select("client", s.client.id); const factory = await commands.createIQFactory(s.client.id, expected()); return { ...s, factory }; }
  function confirmation() { const p = plan.canonicalOnboardingPeople().find(p => p.id === "USR-LAKSHMAN")!; return { personId: p.id, email: p.email, employeeId: p.employeeId, reason: "Explicit synthetic identity review" }; }
  async function provision() {
    const s = await withFactory(); current.setDemoRole("superAdmin"); select("platform"); await commands.attachIQLakshman(s.client.id, confirmation(), expected());
    current.setAdministrationDemoIdentity(s.administrator.id); select("client", s.client.id); const assignment = await commands.appointIQFactoryAdministrator(s.client.id, s.factory.id, "USR-LAKSHMAN", expected());
    current.setDemoRole("auditor"); select("factory", s.client.id, s.factory.id); return { ...s, assignment };
  }
  return { values, storage, current, directory, legacy, state, v4, context, policy, plan, commands, expected, select, clientAndAdministrator, withFactory, confirmation, provision };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Batch 2 staged IQ onboarding", () => {
  it("creates a distinct Manoj identity with only client authority and retains ABC identities/authority", async () => {
    const s = await setup(); const people = structuredClone(s.directory.getAdminUsers()); const old = structuredClone(s.state.getAccessV3State()); const abcAuthority = s.policy.resolveFactoryPerson("USR-LAKSHMAN", { organizationId: "abc-manufacturing", plantId: "PLANT-EGM" });
    const { client, administrator } = await s.clientAndAdministrator();
    expect(client.operationalState).toBe("Staged"); expect(client.id).not.toBe("abc-manufacturing"); expect(administrator.id).not.toBe("USR-MANOJ-GURU"); expect(administrator.email).toBe("manoj@IQ.com"); expect(administrator.employeeId).toBe("Manoj_001"); expect(administrator.roles).toEqual([]); expect(administrator.permissions).toEqual([]);
    expect(s.state.getAccessV3State().factoryAdmins).toEqual(old.factoryAdmins);
    expect(s.state.getAccessV3State().clientMemberships.filter(m => m.organizationId === "abc-manufacturing")).toEqual(old.clientMemberships);
    expect(s.policy.resolveFactoryPerson("USR-LAKSHMAN", { organizationId: "abc-manufacturing", plantId: "PLANT-EGM" })).toEqual(abcAuthority);
    for (const p of people) expect(s.directory.getAdminUsers().find(u => u.id === p.id)).toEqual(p);
  });
  it.each(["email", "employeeId"] as const)("rejects case-insensitive %s collisions in fresh raw directory despite primed cache", async field => {
    const s = await setup(); const client = await s.commands.createIQStagedClient(s.expected());
    const extra = { ...s.directory.getAdminUsers()[0], id: "USR-COLLISION", status: "Inactive" as const, email: field === "email" ? "MANOJ@iq.COM" : "other@example.invalid", employeeId: field === "employeeId" ? "mANOJ_001" : "OTHER" };
    s.storage.setItem(s.plan.DIRECTORY_KEY, JSON.stringify([...s.directory.getAdminUsers(), extra])); const before = [...s.values];
    await expect(s.commands.setupIQClientAdministrator(client.id, s.expected())).rejects.toThrow(/collision/); expect([...s.values]).toEqual(before);
    expect(() => s.legacy.assignClientAdministrator(client.id, { person: { ...s.plan.IQ_PLAN.administrator } })).toThrow(/profile/); expect([...s.values]).toEqual(before);
  });
  it("never reuses ABC Manoj even if both contact fields match the proposed IQ contact", async () => {
    const s = await setup(); const client = await s.commands.createIQStagedClient(s.expected());
    const people = s.directory.getAdminUsers().map(p => p.id === "USR-MANOJ-GURU" ? { ...p, email: "manoj@IQ.com", employeeId: "Manoj_001" } : p);
    s.storage.setItem(s.plan.DIRECTORY_KEY, JSON.stringify(people)); const before = [...s.values];
    await expect(s.commands.setupIQClientAdministrator(client.id, s.expected())).rejects.toThrow(/collision/); expect([...s.values]).toEqual(before);
  });
  it("resumes every creation/attachment/appointment step without duplicate records or events", async () => {
    const s = await setup(); const client = await s.commands.createIQStagedClient(s.expected()); const afterClient = [...s.values];
    expect((await s.commands.createIQStagedClient(s.expected())).id).toBe(client.id); expect([...s.values]).toEqual(afterClient);
    const ca = await s.commands.setupIQClientAdministrator(client.id, s.expected()); const afterCA = [...s.values];
    expect((await s.commands.setupIQClientAdministrator(client.id, s.expected())).id).toBe(ca.id); expect([...s.values]).toEqual(afterCA);
    s.current.setAdministrationDemoIdentity(ca.id); s.select("client", client.id); const factory = await s.commands.createIQFactory(client.id, s.expected()); const afterFactory = [...s.values];
    expect((await s.commands.createIQFactory(client.id, s.expected())).id).toBe(factory.id); expect([...s.values]).toEqual(afterFactory);
    s.current.setDemoRole("superAdmin"); s.select("platform"); const m = await s.commands.attachIQLakshman(client.id, s.confirmation(), s.expected()); const afterMember = [...s.values];
    expect((await s.commands.attachIQLakshman(client.id, s.confirmation(), s.expected())).id).toBe(m.id); expect([...s.values]).toEqual(afterMember);
    s.current.setAdministrationDemoIdentity(ca.id); s.select("client", client.id); const a = await s.commands.appointIQFactoryAdministrator(client.id, factory.id, "USR-LAKSHMAN", s.expected()); const afterFA = [...s.values];
    expect((await s.commands.appointIQFactoryAdministrator(client.id, factory.id, "USR-LAKSHMAN", s.expected())).id).toBe(a.id); expect([...s.values]).toEqual(afterFA);
    s.current.setDemoRole("auditor"); s.select("factory", client.id, factory.id); const z = await s.commands.createIQZone(client.id, factory.id, "Zone A", "ZA", true, s.expected()); const afterZone = [...s.values];
    expect((await s.commands.createIQZone(client.id, factory.id, "Zone A", "za", true, s.expected())).id).toBe(z.id); expect([...s.values]).toEqual(afterZone);
  });
  it("requires SA contact confirmation, reviewed attachment, and actual IQ CA for FA appointment", async () => {
    const s = await setup(); const p = await s.withFactory(); const before = [...s.values];
    await expect(s.commands.attachIQLakshman(p.client.id, s.confirmation(), s.expected())).rejects.toThrow(/context/);
    await expect(s.commands.appointIQFactoryAdministrator(p.client.id, p.factory.id, "USR-LAKSHMAN", s.expected())).rejects.toThrow(/reviewed/);
    await expect(s.commands.appointIQFactoryAdministrator(p.client.id, p.factory.id, p.administrator.id, s.expected())).rejects.toThrow(/reviewed/); expect([...s.values]).toEqual(before);
    s.current.setDemoRole("superAdmin"); s.select("platform");
    await expect(s.commands.attachIQLakshman(p.client.id, { ...s.confirmation(), employeeId: "wrong" }, s.expected())).rejects.toThrow(/confirmation/);
    await s.commands.attachIQLakshman(p.client.id, s.confirmation(), s.expected()); const afterAttach = [...s.values];
    await expect(s.commands.appointIQFactoryAdministrator(p.client.id, p.factory.id, "USR-LAKSHMAN", s.expected())).rejects.toThrow(/context/); expect([...s.values]).toEqual(afterAttach);
    const review = s.state.getAccessV3State().events.find(e => e.operation === "person.clientAttached")?.after as { identityReview: { personId: string; confirmedBy: string } };
    expect(review.identityReview.personId).toBe("USR-LAKSHMAN"); expect(review.identityReview.confirmedBy).toBe("USR-OPS-SUPER-ADMIN");
  });
  it("requires the actual distinct CA and never inherits factory administration from platform/client authority", async () => {
    const s = await setup(); const p = await s.clientAndAdministrator();
    s.select("client", p.client.id); const before = [...s.values];
    await expect(s.commands.createIQFactory(p.client.id, s.expected())).rejects.toThrow(/actual assigned/); expect([...s.values]).toEqual(before);
    s.current.setAdministrationDemoIdentity(p.administrator.id); s.select("client", p.client.id); const factory = await s.commands.createIQFactory(p.client.id, s.expected());
    expect(s.policy.resolveFactoryPerson(p.administrator.id, { organizationId: p.client.id, plantId: factory.id }).factoryAdmin).toBe(false);
    expect(() => s.select("factory", p.client.id, factory.id)).toThrow();
  });
  it("creates confirmed Department-less v4 Zones with canonical IQ ownership, retaining legacy ABC strings", async () => {
    const s = await setup(); const oldZones = structuredClone(s.plan.canonicalOnboardingConfiguration().zones); const p = await s.provision();
    const before = [...s.values]; await expect(s.commands.createIQZone(p.client.id, p.factory.id, "Zone A", "ZA", false, s.expected())).rejects.toThrow(/confirmed/); expect([...s.values]).toEqual(before);
    for (const z of s.plan.IQ_PLAN.zones) {
      const created = await s.commands.createIQZone(p.client.id, p.factory.id, z.name, z.proposedCode, true, s.expected());
      expect(created.organizationId).toBe(p.client.id); expect(created.plantId).toBe(p.factory.id); expect(created.department).toBe(""); expect(created.leaderId).toBe(""); expect(created.codeApprovedBy).toBe("USR-LAKSHMAN"); expect(s.plan.isDepartmentlessV4Zone(created)).toBe(true);
    }
    expect(s.plan.canonicalOnboardingConfiguration().zones.filter(z => z.plantId === "PLANT-EGM")).toEqual(oldZones); expect(s.v4.getAccessV4State().departments).toEqual([]);
    expect(() => s.legacy.saveFactoryZone(p.client.id, p.factory.id, { name: "Legacy test", code: "LT", department: "" })).toThrow(/department/);
    const zoneA = s.plan.canonicalOnboardingConfiguration().zones.find(z => z.plantId === p.factory.id && z.name === "Zone A")!;
    const beforeLegacyEdit = [...s.values];
    expect(() => s.legacy.saveFactoryZone(p.client.id, p.factory.id, { id: zoneA.id, name: zoneA.name, code: zoneA.code, department: "Invented legacy string" })).toThrow(/independent Departments/);
    expect([...s.values]).toEqual(beforeLegacyEdit);
    const readiness = s.plan.getIQOnboardingReadiness()!; expect(readiness.steps.find(x => x.id === "zones")?.status).toBe("complete"); expect(readiness.steps.find(x => x.id === "departments")?.status).toBe("pending"); expect(readiness.activationAvailable).toBe(false);
  });
  it("rejects foreign ownership, duplicate codes and malformed configuration without resetting data", async () => {
    const s = await setup(); const p = await s.provision(); await s.commands.createIQZone(p.client.id, p.factory.id, "Zone A", "ZA", true, s.expected());
    const before = [...s.values];
    await expect(s.commands.createV4FactoryZone({ organizationId: p.client.id, plantId: "PLANT-EGM" }, { name: "Wrong", code: "BAD", codeConfirmed: true }, s.expected())).rejects.toThrow(/context/);
    await expect(s.commands.createIQZone(p.client.id, p.factory.id, "Zone B", "za", true, s.expected())).rejects.toThrow(/conflicts/); expect([...s.values]).toEqual(before);
    const priorExpected = s.expected(); s.storage.setItem(s.plan.CONFIGURATION_KEY, "{}"); const malformed = [...s.values];
    await expect(s.commands.createIQZone(p.client.id, p.factory.id, "Zone B", "ZB", true, priorExpected)).rejects.toThrow(); expect([...s.values]).toEqual(malformed);
  });
  it("staged entitlements deny all capabilities and do not modify existing subscription maps or histories", async () => {
    const s = await setup();
    s.storage.setItem("ops-organization-modules-v1", JSON.stringify({ "abc-manufacturing": { audit: true, actions: true }, "xyz-components": { audit: false } }));
    s.storage.setItem("manufacturing-qms-five-s-audits-v1", JSON.stringify([{ id: "historical-audit", signature: "retained" }])); s.storage.setItem("standalone-5s-actions", JSON.stringify([{ id: "historical-action", activity: ["retained"] }]));
    const keys = ["ops-organization-modules-v1", "manufacturing-qms-five-s-audits-v1", "standalone-5s-actions"]; const bytes = keys.map(k => s.storage.getItem(k)); const p = await s.provision();
    const access = await import("@/lib/module-entitlements"); expect(Object.values(access.getOrganizationAccess(p.client.id)).every(v => v === false)).toBe(true); expect(access.getOrganizationAccess("abc-manufacturing").audit).toBe(true); expect(keys.map(k => s.storage.getItem(k))).toEqual(bytes);
    expect(s.policy.resolveFactoryPerson("USR-LAKSHMAN", { organizationId: "abc-manufacturing", plantId: "PLANT-EGM" }).factoryAdmin).toBe(true);
  });
  it("projects no IQ records for ABC administrators and no foreign profiles/counts for IQ CA", async () => {
    const s = await setup(); const p = await s.provision();
    s.current.setDemoRole("leader"); s.select("client", "abc-manufacturing"); expect(s.plan.getIQOnboardingReadiness()).toBeNull();
    expect(s.context.isLegacyABCOperationalContext(s.context.getActiveAccessContext())).toBe(false);
    s.current.setAdministrationDemoIdentity(p.administrator.id); s.select("client", p.client.id); const readiness = s.plan.getIQOnboardingReadiness()!;
    expect(s.context.isLegacyABCOperationalContext(s.context.getActiveAccessContext())).toBe(false); expect(readiness.client?.id).toBe(p.client.id); expect(readiness.factory?.id).toBe(p.factory.id); expect(readiness.lakshman).toBeUndefined(); expect(JSON.stringify(readiness)).not.toContain("PLANT-EGM"); expect(JSON.stringify(readiness)).not.toContain("USR-MANOJ-GURU");
    expect(s.legacy.administrationPeople(p.client.id).map(p => p.id).sort()).toEqual(["USR-LAKSHMAN", p.administrator.id].sort());
    expect(() => s.select("client", "abc-manufacturing")).toThrow();
  });
  it("rolls back directory and membership together on failed CA creation, then resumes", async () => {
    const s = await setup(); const client = await s.commands.createIQStagedClient(s.expected()); const before = [...s.values]; const original = s.storage.setItem; let failed = false;
    vi.spyOn(s.storage, "setItem").mockImplementation((k, v) => { if (k === "ops-access-v3-administration-v1" && !failed) { failed = true; throw new Error("quota"); } original(k, v); });
    await expect(s.commands.setupIQClientAdministrator(client.id, s.expected())).rejects.toThrow(/preserved/); expect([...s.values]).toEqual(before);
    const ca = await s.commands.setupIQClientAdministrator(client.id, s.expected()); expect(ca.id).not.toBe("USR-MANOJ-GURU");
  });
  it("rolls back new Zone and its event together while preserving unknown configuration fields", async () => {
    const s = await setup(); const p = await s.provision();
    s.storage.setItem(s.plan.CONFIGURATION_KEY, JSON.stringify({ ...s.plan.canonicalOnboardingConfiguration(), futureMetadata: { keep: true } })); const before = [...s.values]; const original = s.storage.setItem; let failed = false;
    vi.spyOn(s.storage, "setItem").mockImplementation((k, v) => { if (k === "ops-access-v3-administration-v1" && !failed) { failed = true; throw new Error("quota"); } original(k, v); });
    await expect(s.commands.createIQZone(p.client.id, p.factory.id, "Zone A", "ZA", true, s.expected())).rejects.toThrow(/restored/); expect([...s.values]).toEqual(before);
    await s.commands.createIQZone(p.client.id, p.factory.id, "Zone A", "ZA", true, s.expected()); expect(JSON.parse(s.storage.getItem(s.plan.CONFIGURATION_KEY)!).futureMetadata).toEqual({ keep: true });
  });
  it("blocks stale onboarding reviews and refuses renamed ABC as an IQ identity", async () => {
    const s = await setup(); const stale = s.expected(); const client = await s.commands.createIQStagedClient(s.expected()); const before = [...s.values];
    await expect(s.commands.setupIQClientAdministrator(client.id, stale)).rejects.toThrow(/revision/); expect([...s.values]).toEqual(before);
    const state = structuredClone(s.state.getAccessV3State()); state.clients = state.clients.filter(c => c.id !== client.id); state.clients.push({ ...client, id: "abc-manufacturing" }); s.storage.setItem("ops-access-v3-administration-v1", JSON.stringify(state)); const renamed = [...s.values];
    await expect(s.commands.createIQStagedClient(s.expected())).rejects.toThrow(/independent/); expect([...s.values]).toEqual(renamed);
  });
});
