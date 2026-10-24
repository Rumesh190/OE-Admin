import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";
import { provisionedClientAdministrator } from "./helpers/client-administrator";

async function setup() {
  vi.resetModules();
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  vi.stubGlobal("window", { localStorage: storage }); vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("navigator", { locks: { request: async (_: string, _options: unknown, work: () => unknown) => work() } });
  authenticateDemoFixture();
  const current = await import("@/lib/current-user"); current.setDemoRole("superAdmin");
  const directory = await import("@/features/five-s/administration/store");
  const commands = await import("@/features/five-s/administration/access-v3-store");
  const state = await import("@/features/five-s/administration/access-v3-state");
  const v4 = await import("@/features/five-s/administration/access-v4-state");
  const context = await import("@/features/five-s/administration/access-v4-context");
  const policy = await import("@/features/five-s/administration/factory-authorization");
  const plan = await import("@/features/five-s/administration/iq-onboarding");
  const zones = await import("@/features/five-s/administration/iq-onboarding-store");
  const administration = await import("@/features/five-s/administration/access-v4-store");
  const access = await import("@/lib/module-entitlements");
  function select(kind: "platform" | "client" | "factory", organizationId = "", plantId = "") {
    const base = { version: 1 as const, selectionId: "", personId: current.getCurrentDemoUser().id };
    if (kind === "platform") context.selectAccessContext({ ...base, kind });
    else if (kind === "client") context.selectAccessContext({ ...base, kind, organizationId });
    else context.selectAccessContext({ ...base, kind, organizationId, plantId });
  }
  select("platform");
  async function clientAndAdministrator() {
    const client = commands.saveClientProfile({ ...plan.IQ_PLAN.client });
    return { client, administrator: await provisionedClientAdministrator(client.id) };
  }
  async function withFactory() {
    const s = await clientAndAdministrator();
    const factory = commands.saveFactory(s.client.id, { ...plan.IQ_PLAN.factory, maximumActiveUsers: 30 });
    return { ...s, factory };
  }
  async function provision() {
    const s = await withFactory();
    await administration.attachPersonToClient({ personId: "USR-LAKSHMAN", confirmedPersonId: "USR-LAKSHMAN", organizationId: s.client.id, reason: "Explicit synthetic identity review", expectedV3Payload: storage.getItem(state.ACCESS_V3_KEY) }, { selectionId: context.getActiveAccessContext()?.selectionId ?? "", revision: v4.getAccessV4State().revision });
    current.setAdministrationDemoIdentity(s.administrator.id); select("client", s.client.id);
    commands.assignFactoryAdministrator(s.client.id, s.factory.id, "USR-LAKSHMAN");
    current.setDemoRole("auditor"); select("factory", s.client.id, s.factory.id);
    return s;
  }
  const expected = plan.captureOnboardingExpectation;
  return { values, storage, current, directory, commands, state, v4, context, policy, plan, zones, administration, access, expected, select, clientAndAdministrator, withFactory, provision };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe("Canonical IQ client provisioning (replaces the retired separate CA setup step)", () => {
  it("atomically creates a distinct Client Admin with no operational grants and retains ABC identities", async () => {
    const s = await setup(); const people = structuredClone(s.directory.getAdminUsers()); const old = structuredClone(s.state.getAccessV3State());
    const { client, administrator } = await s.clientAndAdministrator();
    expect(client.operationalState).toBe("Staged"); expect(client.id).not.toBe("abc-manufacturing");
    expect(administrator.id).not.toBe("USR-MANOJ-GURU"); expect(administrator.email).toBe("manoj@iq-demo.invalid"); expect(administrator.employeeId).toBe("IQ-DEMO-CA");
    expect(administrator.roles).toEqual([]); expect(administrator.permissions).toEqual([]);
    expect(s.state.getAccessV3State().factoryAdmins).toEqual(old.factoryAdmins);
    expect(s.state.getAccessV3State().clientMemberships.filter(m => m.organizationId === "abc-manufacturing")).toEqual(old.clientMemberships);
    for (const person of people) expect(s.directory.getAdminUser(person.id)).toEqual(person);
  });
  it.each(["email", "employeeId"] as const)("rejects case-insensitive %s collisions without partially creating a client", async field => {
    const s = await setup();
    const extra = { ...s.directory.getAdminUsers()[0], id: "USR-COLLISION", status: "Inactive" as const, email: field === "email" ? "MANOJ@IQ-DEMO.INVALID" : "other@example.invalid", employeeId: field === "employeeId" ? "iq-demo-ca" : "OTHER" };
    s.storage.setItem(s.plan.DIRECTORY_KEY, JSON.stringify([...s.directory.getAdminUsers(), extra])); const before = [...s.values];
    expect(() => s.commands.saveClientProfile({ ...s.plan.IQ_PLAN.client })).toThrow(/profile/); expect([...s.values]).toEqual(before);
  });
  it("does not merge ABC Manoj even if proposed contact fields match", async () => {
    const s = await setup();
    s.storage.setItem(s.plan.DIRECTORY_KEY, JSON.stringify(s.directory.getAdminUsers().map(p => p.id === "USR-MANOJ-GURU" ? { ...p, email: "manoj@iq-demo.invalid", employeeId: "IQ-DEMO-CA" } : p)));
    const before = [...s.values]; expect(() => s.commands.saveClientProfile({ ...s.plan.IQ_PLAN.client })).toThrow(/profile/); expect([...s.values]).toEqual(before);
  });
  it("resumes client creation without duplicate identities, memberships or events", async () => {
    const s = await setup(); const first = await s.clientAndAdministrator(); const before = [...s.values]; const second = await s.clientAndAdministrator();
    expect(second).toEqual(first); expect([...s.values]).toEqual(before);
    expect(() => s.commands.assignClientAdministrator(first.client.id, { userId: "USR-MANOJ-GURU" })).toThrow(/automatically/); expect([...s.values]).toEqual(before);
  });
  it("requires platform authority and an explicit user limit for factory creation", async () => {
    const s = await setup(); const p = await s.clientAndAdministrator(); const before = [...s.values];
    expect(() => s.commands.saveFactory(p.client.id, { ...s.plan.IQ_PLAN.factory, maximumActiveUsers: undefined })).toThrow(/maximum/); expect([...s.values]).toEqual(before);
    s.current.setAdministrationDemoIdentity(p.administrator.id); s.select("client", p.client.id); const caBefore = [...s.values];
    expect(() => s.commands.saveFactory(p.client.id, { ...s.plan.IQ_PLAN.factory, maximumActiveUsers: 30 })).toThrow(); expect([...s.values]).toEqual(caBefore);
  });
  it("does not inherit operational authority from client or platform administration", async () => {
    const s = await setup(); const p = await s.withFactory();
    expect(s.policy.resolveFactoryPerson(p.administrator.id, { organizationId: p.client.id, plantId: p.factory.id }).factoryAdmin).toBe(false);
    s.select("factory", p.client.id, p.factory.id);
    expect(s.policy.resolveFactoryPerson(s.current.getCurrentDemoUser().id, { organizationId: p.client.id, plantId: p.factory.id }).factoryAdmin).toBe(false);
    s.current.setAdministrationDemoIdentity(p.administrator.id); s.select("client", p.client.id);
    s.select("factory", p.client.id, p.factory.id);
    expect(s.policy.resolveFactoryPerson(s.current.getCurrentDemoUser().id, { organizationId: p.client.id, plantId: p.factory.id }).factoryAdmin).toBe(false);
  });
  it("creates confirmed Department-less Zones with canonical ownership and keeps ABC strings", async () => {
    const s = await setup(); const old = structuredClone(s.plan.canonicalOnboardingConfiguration().zones); const p = await s.provision();
    const scope = { organizationId: p.client.id, plantId: p.factory.id };
    const before = [...s.values]; await expect(s.zones.createV4FactoryZone(scope, { name: "Zone A", code: "ZA", codeConfirmed: false }, s.expected())).rejects.toThrow(/confirmed/); expect([...s.values]).toEqual(before);
    for (const z of s.plan.IQ_PLAN.zones) {
      const created = await s.zones.createV4FactoryZone(scope, { name: z.name, code: z.proposedCode, codeConfirmed: true }, s.expected());
      expect(created.organizationId).toBe(p.client.id); expect(created.plantId).toBe(p.factory.id); expect(created.department).toBe(""); expect(created.leaderId).toBe(""); expect(created.codeApprovedBy).toBe("USR-LAKSHMAN");
      expect(s.plan.isDepartmentlessV4Zone(created)).toBe(true);
    }
    expect(s.plan.canonicalOnboardingConfiguration().zones.filter(z => z.plantId === "PLANT-EGM")).toEqual(old); expect(s.v4.getAccessV4State().departments).toEqual([]);
  });
  it("rejects foreign ownership, duplicate codes and stale revisions without resetting records", async () => {
    const s = await setup(); const p = await s.provision(); const scope = { organizationId: p.client.id, plantId: p.factory.id }; const input = { name: "Zone A", code: "ZA", codeConfirmed: true };
    const stale = s.expected(); await s.zones.createV4FactoryZone(scope, input, s.expected()); const before = [...s.values];
    await expect(s.zones.createV4FactoryZone({ ...scope, plantId: "PLANT-EGM" }, input, s.expected())).rejects.toThrow(/context/);
    await expect(s.zones.createV4FactoryZone(scope, { ...input, name: "Zone B", code: "za" }, s.expected())).rejects.toThrow(/conflicts/);
    await expect(s.zones.createV4FactoryZone(scope, { ...input, name: "Zone B", code: "ZB" }, stale)).rejects.toThrow(/revision/); expect([...s.values]).toEqual(before);
  });
  it("denies staged factory capabilities and preserves operational history", async () => {
    const s = await setup(); s.storage.setItem("standalone-5s-actions", JSON.stringify([{ id: "HISTORY", activity: ["retained"] }])); const history = s.storage.getItem("standalone-5s-actions");
    const p = await s.provision(); expect(Object.values(s.access.getFactoryAccess(p.client.id, p.factory.id)).every(v => v === false)).toBe(true);
    expect(s.storage.getItem("standalone-5s-actions")).toBe(history);
  });
  it("isolates client directories and factory contexts", async () => {
    const s = await setup(); const p = await s.provision(); s.current.setAdministrationDemoIdentity(p.administrator.id); s.select("client", p.client.id);
    expect(s.commands.administrationPeople(p.client.id).map(p => p.id).sort()).toEqual(["USR-LAKSHMAN", p.administrator.id].sort());
    expect(() => s.select("client", "abc-manufacturing")).toThrow();
  });
  it("rolls back client, identity and membership together after a write failure and permits retry", async () => {
    const s = await setup(); s.state.getAccessV3State(); s.directory.getAdminUsers(); const before = [...s.values]; const original = s.storage.setItem; let failed = false;
    vi.spyOn(s.storage, "setItem").mockImplementation((k, v) => { if (k === s.state.ACCESS_V3_KEY && !failed) { failed = true; throw new Error("quota"); } original(k, v); });
    expect(() => s.commands.saveClientProfile({ ...s.plan.IQ_PLAN.client })).toThrow(/restored|preserved/); expect([...s.values]).toEqual(before);
    expect((await s.clientAndAdministrator()).administrator.id).not.toBe("USR-MANOJ-GURU");
  });
  it("rolls back Zone and event together and retains unknown configuration metadata", async () => {
    const s = await setup(); const p = await s.provision(); s.storage.setItem(s.plan.CONFIGURATION_KEY, JSON.stringify({ ...s.plan.canonicalOnboardingConfiguration(), futureMetadata: { keep: true } }));
    const before = [...s.values]; const original = s.storage.setItem; let failed = false;
    vi.spyOn(s.storage, "setItem").mockImplementation((k, v) => { if (k === s.state.ACCESS_V3_KEY && !failed) { failed = true; throw new Error("quota"); } original(k, v); });
    const scope = { organizationId: p.client.id, plantId: p.factory.id }; const input = { name: "Zone A", code: "ZA", codeConfirmed: true };
    await expect(s.zones.createV4FactoryZone(scope, input, s.expected())).rejects.toThrow(/restored/); expect([...s.values]).toEqual(before);
    await s.zones.createV4FactoryZone(scope, input, s.expected()); expect(JSON.parse(s.storage.getItem(s.plan.CONFIGURATION_KEY) ?? "{}").futureMetadata).toEqual({ keep: true });
  });
});
