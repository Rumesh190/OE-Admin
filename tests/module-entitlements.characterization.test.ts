import { authenticateDemoFixture } from "./helpers/demo-session";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => vi.unstubAllGlobals());

describe("organization module access", () => {
  it("persists module changes per factory without touching Visual Management data", async () => {
    const values = new Map<string, string>();
    values.set("ops-visual-management-v1", JSON.stringify({ meetings: [{ id: "VMM-KEEP" }] }));
    vi.stubGlobal("window", { localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } }); authenticateDemoFixture();
    vi.resetModules();
    const identity = await import("@/lib/current-user"); identity.setDemoRole("superAdmin");
    const store = await import("@/lib/module-entitlements");
    const initial = store.getOrganizationAccess("abc-manufacturing");
    expect(initial.gemba).toBe(true);
    expect(initial.audit).toBe(true);
    expect(initial.redTag).toBe(true);
    expect(initial.visualManagement).toBe(true);
    expect(store.getOrganizationAccess("xyz-components").gemba).toBe(false);
    expect(store.getOrganizationAccess("xyz-components").redTag).toBe(false);
    expect(store.getOrganizationAccess("xyz-components").visualManagement).toBe(false);

    expect(store.saveFactoryAccess("abc-manufacturing", "PLANT-EGM", { ...initial, visualManagement: false, gemba: false })).toBe(true);
    expect(store.getOrganizationAccess("abc-manufacturing")).toMatchObject({ visualManagement: false, gemba: false });
    expect(values.get("ops-visual-management-v1")).toBe(JSON.stringify({ meetings: [{ id: "VMM-KEEP" }] }));

    const independent = store.getOrganizationAccess("abc-manufacturing");
    expect(store.saveFactoryAccess("abc-manufacturing", "PLANT-EGM", { ...independent, redFlag: false, redTag: true })).toBe(true);
    expect(store.getOrganizationAccess("abc-manufacturing")).toMatchObject({ redFlag: false, redTag: true });
    expect(store.saveFactoryAccess("abc-manufacturing", "PLANT-EGM", { ...store.getOrganizationAccess("abc-manufacturing"), redFlag: true, redTag: false })).toBe(true);
    expect(store.getOrganizationAccess("abc-manufacturing")).toMatchObject({ redFlag: false, redTag: false });

    const withoutGemba = store.getOrganizationAccess("abc-manufacturing");
    expect(store.saveFactoryAccess("abc-manufacturing", "PLANT-EGM", { ...withoutGemba, audit: false, visualManagement: true })).toBe(true);
    expect(store.getOrganizationAccess("abc-manufacturing").audit).toBe(false);
    expect(store.getOrganizationAccess("abc-manufacturing").visualManagement).toBe(true);
    expect(JSON.parse(values.get("ops-organization-modules-v1") ?? "{}").factories["PLANT-EGM"]).toMatchObject({ gemba: false, audit: false, visualManagement: true });
  });
});
