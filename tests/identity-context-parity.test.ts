import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";

async function setup(environment: "development" | "production" = "development") {
  vi.resetModules(); vi.stubEnv("NODE_ENV", environment);
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal("window", { localStorage: storage }); vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("StorageEvent", class extends Event { constructor(type: string) { super(type); } });
  authenticateDemoFixture();
  const current = await import("@/lib/current-user");
  const state = await import("@/features/five-s/administration/access-v3-state");
  const context = await import("@/features/five-s/administration/access-v4-context");
  const profiles = await import("@/lib/demo/canonical-profiles");
  const administration = await import("@/features/five-s/administration/access-v3-store");
  const modules = await import("@/lib/module-entitlements");
  const native = await import("@/lib/demo/native-demo-data");
  function assignedFactory() {
    const stamp = { assignedBy: "USR-OPS-SUPER-ADMIN", assignedAt: "2026-10-23", updatedAt: "2026-10-23" };
    const next = structuredClone(state.EMPTY_ACCESS_V3);
    next.clientMemberships.push({ ...stamp, id: "CM-LK", userId: "USR-LAKSHMAN", organizationId: "abc-manufacturing", clientAdmin: false, status: "Active" });
    next.factoryMemberships.push({ ...stamp, id: "FM-LK", userId: "USR-LAKSHMAN", organizationId: "abc-manufacturing", plantId: "PLANT-EGM", baseRole: "Zone Leader", status: "Active" });
    next.zoneAllocations.push({ ...stamp, id: "ZA-LK", userId: "USR-LAKSHMAN", organizationId: "abc-manufacturing", plantId: "PLANT-EGM", zoneId: "ZONE-A", responsibility: "Leader", status: "Active" });
    next.factoryAdmins.push({ ...stamp, id: "FA-LK", userId: "USR-LAKSHMAN", organizationId: "abc-manufacturing", plantId: "PLANT-EGM", status: "Active" });
    storage.setItem(state.ACCESS_V3_KEY, JSON.stringify(next));
    return next;
  }
  return { values, storage, current, state, context, profiles, administration, modules, native, assignedFactory };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe.each(["development", "production"] as const)("canonical identity in %s", environment => {
  it("uses identical legacy defaults without manufacturing a Factory Admin assignment", async () => {
    const s = await setup(environment);
    expect(s.current.getCurrentDemoUser()).toMatchObject({ id: "USR-LAKSHMAN", role: "Zone Leader", isSuperAdmin: false });
    expect(s.profiles.resolveCanonicalProfile("USR-LAKSHMAN")?.responsibilities).toEqual(["Zone Leader", "Admin", "Auditor"]);
    expect(s.context.initializeCurrentAccessContext()).toBeNull();
    expect(s.administration.canOpenV4Administration()).toBe(false);
    expect(s.modules.getFactoryAccess("abc-manufacturing", "PLANT-EGM")).toMatchObject({ audit: true, actions: true, redFlag: false });
    expect(s.storage.getItem(s.state.ACCESS_V3_KEY)).toBeNull();
  });
  it("restores the sole authorized factory for the current person and preserves populated records", async () => {
    const s = await setup(environment); s.assignedFactory();
    s.storage.setItem("standalone-5s-actions", '[{"id":"USER-ACTION","title":"Retain"}]');
    s.storage.setItem(s.modules.FACTORY_MODULE_ACCESS_KEY, JSON.stringify({ version: 2, factories: { "PLANT-EGM": { ...s.modules.NEW_FACTORY_ACCESS, audit: true, redTag: false } } }));
    const before = new Map(s.values); const selected = s.context.initializeCurrentAccessContext();
    expect(selected).toMatchObject({ personId: "USR-LAKSHMAN", kind: "factory", organizationId: "abc-manufacturing", plantId: "PLANT-EGM" });
    expect(s.current.getCurrentDemoUser()).toMatchObject({ id: "USR-LAKSHMAN", role: "Factory Administrator", isSuperAdmin: false });
    expect(s.administration.canOpenV4Administration()).toBe(true);
    expect(s.modules.getOrganizationAccess()).toMatchObject({ audit: true, actions: true, redTag: false });
    for (const [key, value] of before) expect(s.storage.getItem(key)).toBe(value);
    const after = [...s.values]; expect(s.context.initializeCurrentAccessContext()).toEqual(selected); expect([...s.values]).toEqual(after);
  });
  it("does not restore legacy roles after canonical membership becomes inactive", async () => {
    const s = await setup(environment); const state = s.assignedFactory();
    s.context.initializeCurrentAccessContext(); state.clientMemberships[0].status = "Inactive"; s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(state));
    expect(s.current.getCurrentDemoUser().role).toBe("Standard User");
    expect(s.administration.canOpenV4Administration()).toBe(false);
    const before = [...s.values]; expect(() => s.context.initializeCurrentAccessContext()).toThrow(); expect([...s.values]).toEqual(before);
  });
  it("keeps revoked Factory Admin assignments separate from retained operational roles", async () => {
    const s = await setup(environment); const state = s.assignedFactory(); s.context.initializeCurrentAccessContext();
    state.factoryAdmins[0].status = "Inactive"; s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(state));
    expect(s.current.getCurrentDemoUser().role).toBe("Zone Leader"); expect(s.administration.canOpenV4Administration()).toBe(false);
  });
  it("requires an explicit selection when the current person has several factories", async () => {
    const s = await setup(environment); const state = s.assignedFactory();
    const config = await import("@/lib/organization-store");
    s.storage.setItem("ops-organization-configuration-v1", JSON.stringify({ plants: [...config.ORGANIZATION_PLANT_SEEDS, { ...config.ORGANIZATION_PLANT_SEEDS[0], id: "SECOND", organizationId: "abc-manufacturing", name: "Second" }], zones: config.ORGANIZATION_ZONE_SEEDS }));
    state.factoryMemberships.push({ ...state.factoryMemberships[0], id: "FM-SECOND", plantId: "SECOND" }); s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(state));
    const before = [...s.values]; expect(s.context.initializeCurrentAccessContext()).toBeNull(); expect([...s.values]).toEqual(before);
    expect(s.current.getCurrentDemoUser().role).toBe("Standard User");
  });
});
it("native initialization is idempotent and retains edits, revocations and the selected persona", async () => {
  const s = await setup(); await s.native.initializeNativeRoleDemo();
  const hierarchy = s.profiles.getCanonicalProfileHierarchy();
  const factory = hierarchy.clients.flatMap(client => client.factories.map(factory => ({ ...factory, organizationId: client.id }))).find(factory => factory.users.some(user => user.primaryRole === "Factory Administrator"));
  if (!factory) throw new Error("Native factory fixture missing");
  const user = factory.users.find(user => user.primaryRole === "Factory Administrator"); if (!user) throw new Error("Native administrator missing");
  const { switchFinalDemoPersona } = await import("@/lib/demo/switch-final-persona");
  switchFinalDemoPersona(user.personId, { kind: "factory", organizationId: factory.organizationId, plantId: factory.id });
  s.storage.setItem("standalone-5s-actions", '[{"id":"USER-EDIT","title":"Keep"}]');
  const access = structuredClone(s.state.getAccessV3State());
  const grant = access.factoryAdmins.find(item => item.userId === user.personId && item.plantId === factory.id);
  if (!grant) throw new Error("Native Factory Admin assignment missing");
  grant.status = "Inactive"; s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(access));
  const modules = JSON.parse(s.storage.getItem(s.modules.FACTORY_MODULE_ACCESS_KEY) ?? "{}");
  modules.factories[factory.id].audit = false; s.storage.setItem(s.modules.FACTORY_MODULE_ACCESS_KEY, JSON.stringify(modules));
  const before = [...s.values]; await s.native.initializeNativeRoleDemo(); expect([...s.values]).toEqual(before);
  expect(s.current.getCurrentDemoUser().id).toBe(user.personId);
});
it.each(["populated", "unsupported-manifest", "unsupported-schema"])("preserves every stored byte for %s initialization", async kind => {
  const s = await setup();
  if (kind === "unsupported-schema") { await s.native.initializeNativeRoleDemo(); const old = JSON.parse(s.storage.getItem(s.state.ACCESS_V3_KEY) ?? "{}"); s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify({ ...old, version: 9 })); }
  else if (kind === "populated") s.storage.setItem("standalone-5s-actions", '[{"id":"USER-EDIT"}]');
  else s.storage.setItem("ops-final-role-demo-v1", '{"version":9}');
  const before = [...s.values]; await expect(s.native.initializeNativeRoleDemo()).rejects.toThrow(); expect([...s.values]).toEqual(before);
});
it("blocks privileged switching, native initialization and reset in public production", async () => {
  const s = await setup("production"); const { switchFinalDemoPersona } = await import("@/lib/demo/switch-final-persona"); const before = [...s.values];
  expect(s.native.NATIVE_DEMO_ENABLED).toBe(false);
  expect(() => switchFinalDemoPersona("USR-OPS-SUPER-ADMIN", { kind: "platform" })).toThrow(/disabled in production/);
  await expect(s.native.initializeNativeRoleDemo()).rejects.toThrow(/development only/); await expect(s.native.resetNativeRoleDemo()).rejects.toThrow(/development only/);
  expect([...s.values]).toEqual(before);
});
