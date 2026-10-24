import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules(); const values = new Map([["ops-red-tag-original-reset-v1", "done"]]);
  vi.stubGlobal("window", { dispatchEvent: vi.fn(), alert: vi.fn(), localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  } });
});
afterEach(() => vi.unstubAllGlobals());

// Desired authorization acceptance requirements. These remain red until the
// documented mutation-boundary gaps are fixed; do not invert them into approval.
describe("P0 unresolved authorization acceptance", () => {
  it("P0-AUTH-RT rejects creation by an unknown actor at the store boundary", async () => {
    const tags = await import("@/features/five-s/red-tag/store");
    const actor = { id: "UNKNOWN-P0", name: "Unknown", role: "Viewer", initials: "QA", plant: "Egmore Plant", primaryZone: "Zone A", isSuperAdmin: false };
    let rejected = false;
    try {
      rejected = tags.createRedTagV2({ plant: "Egmore Plant", zone: "Zone A", section: "Stores", department: "Stores", category: "Tools", itemName: "Unused fixture", reason: "Unused", reasonCategory: "Usage", remarks: "Review fixture", imageUrl: "data:image/jpeg;base64,before", createdById: actor.id, createdByName: actor.name }, actor) === undefined;
    } catch { rejected = true; }
    expect(rejected, "Unknown actors must not create Red Tags via direct store commands").toBe(true);
  });
  it("P0-AUTH-ENT rejects organization entitlement changes by an ordinary member", async () => {
    const identity = await import("@/lib/current-user"); identity.setDemoRole("responsible");
    const store = await import("@/lib/module-entitlements");
    const before = { ...store.getOrganizationAccess("xyz-components") };
    let rejected = false;
    try { rejected = store.saveFactoryAccess("xyz-components", "PLANT-XYZ", { ...before, redTag: true }) === false; } catch { rejected = true; }
    expect(rejected, "Only authorized platform administrators may mutate module entitlements").toBe(true);
    expect(store.getOrganizationAccess("xyz-components")).toEqual(before);
  });
  it("P0-AUTH-ACT rejects direct canonical Action creation by a member without creation permission", async () => {
    const identity = await import("@/lib/current-user"); identity.setDemoRole("responsible");
    const actions = await import("@/lib/actions/action-store");
    let rejected = false;
    try { actions.createAction({ title: "Unauthorized test", description: "Must be rejected", source: "Manual", sourceModule: "manual", sourceTitle: "Manual", plant: "Egmore Plant", department: "Stores", area: "Zone A", assignedTo: "", status: "Open", priority: "Medium", dueDate: "2030-10-25" }); } catch { rejected = true; }
    expect(rejected, "Canonical Action creation must enforce current actor authority").toBe(true);
  });
});
