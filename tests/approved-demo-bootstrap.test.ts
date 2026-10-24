import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";

async function setup(environment: "development" | "production" = "production") {
  vi.resetModules(); vi.stubEnv("NODE_ENV", environment);
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal("window", { localStorage: storage }); vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("StorageEvent", class extends Event { constructor(type: string) { super(type); } });
  authenticateDemoFixture();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ enabled: true }))));
  const access = await import("@/lib/demo/demo-access"); await access.requestDemoAccess();
  const bootstrap = await import("@/lib/demo/approved-demo-bootstrap");
  const current = await import("@/lib/current-user");
  const context = await import("@/features/five-s/administration/access-v4-context");
  const v3 = await import("@/features/five-s/administration/access-v3-state");
  const v4 = await import("@/features/five-s/administration/access-v4-state");
  const profiles = await import("@/lib/demo/canonical-profiles");
  const policy = await import("@/features/five-s/administration/access-v3-store");
  const modules = await import("@/lib/module-entitlements");
  return { values, storage, bootstrap, current, context, v3, v4, profiles, policy, modules };
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe.each(["development", "production"] as const)("approved demo initialization in %s", environment => {
  it("initializes canonical clients, real Egmore authority, factory limits, independent roles and all module records before choosing the default", async () => {
    const s = await setup(environment); expect(await s.bootstrap.bootstrapApprovedDemo()).toEqual({ initialized: true, notice: "" });
    expect(s.profiles.getCanonicalProfileHierarchy().clients.map(client => client.name).sort()).toEqual(["ABC Manufacturing", "Hyundai", "IQ", "Mitsubishi"]);
    expect(s.current.getCurrentDemoUser()).toMatchObject({ id: "USR-LAKSHMAN", role: "Factory Administrator", isSuperAdmin: false });
    expect(s.context.getActiveAccessContext()).toMatchObject({ personId: "USR-LAKSHMAN", kind: "factory", organizationId: "abc-manufacturing", plantId: "PLANT-EGM" });
    expect(s.policy.canOpenV4Administration()).toBe(true); expect(s.modules.getOrganizationAccess()).toMatchObject({ actions: true, audit: true, gemba: true, reports: true, visualManagement: true });
    expect(s.policy.getFactorySeatUsage("PLANT-EGM")).toMatchObject({ maximumActiveUsers: 30, configured: true });
    expect(s.v4.getAccessV4State().departments.filter(d => d.plantId === "PLANT-EGM")).toHaveLength(4);
    expect(JSON.parse(s.storage.getItem("standalone-5s-actions") ?? "[]").length).toBeGreaterThan(0);
    expect(JSON.parse(s.storage.getItem("ops-gemba-v1") ?? "{}").walks.length).toBeGreaterThan(0);
    const original = [...s.values]; expect(await s.bootstrap.bootstrapApprovedDemo()).toEqual({ initialized: false, notice: "" }); expect([...s.values]).toEqual(original);
  });
  it("retains edited records, disabled modules, revoked authority and the chosen persona on repeated login", async () => {
    const s = await setup(environment); await s.bootstrap.bootstrapApprovedDemo();
    const v3 = structuredClone(s.v3.getAccessV3State());
    const fa = v3.factoryAdmins.find(item => item.userId === "USR-LAKSHMAN" && item.plantId === "PLANT-EGM"); if (!fa) throw new Error("Missing seeded assignment");
    fa.status = "Inactive"; s.storage.setItem(s.v3.ACCESS_V3_KEY, JSON.stringify(v3));
    s.storage.setItem("standalone-5s-actions", '[{"id":"EDITED","title":"Keep user work"}]');
    const modules = JSON.parse(s.storage.getItem(s.modules.FACTORY_MODULE_ACCESS_KEY) ?? "{}"); modules.factories["PLANT-EGM"].visualManagement = false; s.storage.setItem(s.modules.FACTORY_MODULE_ACCESS_KEY, JSON.stringify(modules));
    const before = [...s.values]; await s.bootstrap.bootstrapApprovedDemo(); expect([...s.values]).toEqual(before);
    expect(s.current.getCurrentDemoUser().role).toBe("Zone Leader"); expect(s.policy.canOpenV4Administration()).toBe(false);
  });
  it("does not seed over populated browser data or alter its entitlements", async () => {
    const s = await setup(environment); s.storage.setItem("standalone-5s-actions", '[{"id":"USER-ACTION"}]');
    const before = [...s.values]; const result = await s.bootstrap.bootstrapApprovedDemo();
    expect(result.initialized).toBe(false); expect(result.notice).toContain("preserved"); expect([...s.values]).toEqual(before);
  });
});
it.each(["ops-approved-demo-bootstrap-v1", "ops-access-v3-administration-v1", "ops-final-role-demo-v1", "ops-organization-modules-v1"])("rejects unsupported %s without replacing its bytes", async key => {
  const s = await setup(); s.storage.setItem(key, '{"version":99}'); const before = [...s.values];
  await expect(s.bootstrap.bootstrapApprovedDemo()).rejects.toThrow(); expect([...s.values]).toEqual(before);
});
it("rolls the entire native/Egmore/default-selection bootstrap back when a later write fails", async () => {
  const s = await setup(); const before = [...s.values]; const original = s.storage.setItem; let failed = false;
  vi.spyOn(s.storage, "setItem").mockImplementation((key, value) => { if (key === "ops-egmore-client-demo-v1" && !failed) { failed = true; throw new Error("Synthetic quota failure"); } original(key, value); });
  await expect(s.bootstrap.bootstrapApprovedDemo()).rejects.toThrow(/quota/); expect([...s.values]).toEqual(before);
  expect((await s.bootstrap.bootstrapApprovedDemo()).initialized).toBe(true);
});
it("deduplicates simultaneous initialization without duplicate records or conflicting persona selection", async () => {
  const s = await setup(); const first = s.bootstrap.bootstrapApprovedDemo(); const second = s.bootstrap.bootstrapApprovedDemo(); expect(second).toBe(first); await first;
  const state = s.v3.getAccessV3State(); expect(new Set(state.factoryMemberships.map(item => item.id)).size).toBe(state.factoryMemberships.length);
  expect(s.current.getCurrentDemoUser().role).toBe("Factory Administrator");
});
it("public production cannot authorize privileged initialization through browser-local flags", async () => {
  vi.resetModules(); vi.stubEnv("NODE_ENV", "production");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ enabled: false }))));
  const access = await import("@/lib/demo/demo-access"); expect(await access.requestDemoAccess()).toBe(false);
  const bootstrap = await import("@/lib/demo/approved-demo-bootstrap"); expect(() => bootstrap.bootstrapApprovedDemo()).toThrow(/authorized demo access/);
});
