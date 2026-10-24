import { afterEach, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
async function setup() {
  vi.resetModules();
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
  vi.stubGlobal("window", { localStorage: storage }); vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("StorageEvent", class extends Event { constructor(type: string) { super(type); } });
  authenticateDemoFixture();
  return { values, storage };
}
it("returns stable identity snapshots and refreshes them across canonical persona changes", async () => {
  await setup(); const current = await import("@/lib/current-user");
  current.setDemoRole("superAdmin"); const platform = current.getCurrentDemoUser();
  expect(platform).toMatchObject({ id: "USR-OPS-SUPER-ADMIN", role: "Platform Super Admin", isSuperAdmin: true });
  expect(current.getCurrentDemoUser()).toBe(platform);
  current.setDemoRole("auditor"); const operational = current.getCurrentDemoUser();
  expect(operational.id).toBe("USR-LAKSHMAN"); expect(operational.isSuperAdmin).toBe(false); expect(current.getCurrentDemoUser()).toBe(operational);
  expect(() => current.setAdministrationDemoIdentity("UNAVAILABLE-IDENTITY")).toThrow(/active administration person/);
  window.localStorage.setItem(current.ADMIN_DEMO_SUBJECT_KEY, "UNAVAILABLE-IDENTITY");
  expect(current.getCurrentDemoUser()).toMatchObject({ id: "UNAVAILABLE-IDENTITY", isSuperAdmin: false, role: "Standard User" });
});
it("retains foreign records and seeds the complete Egmore roster and source-linked module data", async () => {
  const s = await setup(); vi.stubEnv("NODE_ENV", "development");
  s.storage.setItem("standalone-5s-actions", JSON.stringify([{ id: "FOREIGN-ACTION", organizationId: "FOREIGN", title: "Keep" }]));
  s.storage.setItem("ops-organization-configuration-v1", JSON.stringify({ plants: [], zones: [{ id: "FOREIGN-ZONE", plantId: "FOREIGN", name: "Keep" }], futureMetadata: { keep: true } }));
  const demo = await import("@/lib/demo/egmore-demo-data"); await demo.prepareEgmoreDemoData();
  const directory = await import("@/features/five-s/administration/store");
  expect(directory.getAdminUsers().some(p => p.id === "USR-MEENA")).toBe(true);
  const actions = JSON.parse(s.storage.getItem("standalone-5s-actions") ?? "[]") as Array<{ id: string }>;
  expect(actions.some(a => a.id === "FOREIGN-ACTION")).toBe(true); expect(new Set(actions.map(a => a.id)).size).toBe(actions.length);
  const configuration = JSON.parse(s.storage.getItem("ops-organization-configuration-v1") ?? "{}");
  expect(configuration.futureMetadata).toEqual({ keep: true }); expect(configuration.zones.some((z: { id: string }) => z.id === "FOREIGN-ZONE")).toBe(true);
  expect(configuration.zones.filter((z: { plantId: string }) => z.plantId === "PLANT-EGM")).toHaveLength(4);
  const access = JSON.parse(s.storage.getItem("ops-access-v3-administration-v1") ?? "{}");
  expect(access.factoryAdmins[0]).toMatchObject({ userId: "USR-LAKSHMAN", plantId: "PLANT-EGM" }); expect(access.auditorGrants).toHaveLength(2);
  await demo.prepareEgmoreDemoData();
  const repeated = JSON.parse(s.storage.getItem("standalone-5s-actions") ?? "[]") as Array<{ id: string }>;
  expect(repeated.map(a => a.id)).toEqual(actions.map(a => a.id));
});

it("builds the nested native persona hierarchy with distinct client administrators and preserves foreign manifest entries", async () => {
  const s = await setup(); vi.stubEnv("NODE_ENV", "development");
  const foreign = { personId: "FOREIGN-PERSON", organizationId: "FOREIGN-CLIENT", name: "Retained", role: "Client Administrator" };
  s.storage.setItem("ops-final-role-demo-v1", JSON.stringify({ personas: [foreign] }));
  const native = await import("@/lib/demo/native-demo-data"); await native.resetNativeRoleDemo();
  const manifest = JSON.parse(s.storage.getItem("ops-final-role-demo-v1") ?? "{}");
  expect(manifest.personas).toContainEqual(foreign);
  expect(manifest.personas.every((p: { personId?: string }) => typeof p.personId === "string")).toBe(true);
  const { getCanonicalProfileHierarchy } = await import("@/lib/demo/canonical-profiles");
  const hierarchy = getCanonicalProfileHierarchy();
  expect(hierarchy.platform?.personId).toBe("USR-OPS-SUPER-ADMIN");
  const abc = hierarchy.clients.find(client => client.id === "abc-manufacturing");
  expect(abc?.administrator?.personId).toBeTruthy();
  expect(abc?.administrator?.personId).not.toBe("USR-RUMESH");
  expect(abc?.factories.some(factory => factory.id === "PLANT-EGM")).toBe(true);
});
