import { provisionedClientAdministrator } from "./helpers/client-administrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";
async function setup() {
  vi.resetModules();
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => { values.set(k, v); }, removeItem: (k: string) => { values.delete(k); } };
  vi.stubGlobal("window", { localStorage: storage, dispatchEvent: vi.fn() }); vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("navigator", { locks: { request: async (_name: string, _options: unknown, callback: () => unknown) => callback() } });
  authenticateDemoFixture();
  const current = await import("@/lib/current-user"); current.setDemoRole("superAdmin");
  const commands = await import("@/features/five-s/administration/access-v3-store");
  const state = await import("@/features/five-s/administration/access-v3-state");
  const directory = await import("@/features/five-s/administration/store");
  const v4 = await import("@/features/five-s/administration/access-v4-store");
  const v4state = await import("@/features/five-s/administration/access-v4-state");
  const context = await import("@/features/five-s/administration/access-v4-context");
  const persistence = await import("@/lib/administration-v4-storage");
  const org = commands.saveClientProfile({ name: "Synthetic client", industry: "Test" });
  const ca = await provisionedClientAdministrator(org.id);
  const plant = commands.saveFactory(org.id, { name: "Test Factory", code: "TF", location: "Test", maximumActiveUsers: 30 });
  current.setAdministrationDemoIdentity(ca.id);
  commands.assignFactoryAdministrator(org.id, plant.id, ca.id);
  const zone = commands.saveFactoryZone(org.id, plant.id, { name: "Test Zone", code: "TZ", department: "Legacy string" });
  const zone2 = commands.saveFactoryZone(org.id, plant.id, { name: "Second Zone", code: "Z2", department: "Legacy second" });
  const member = commands.saveFactoryUser(org.id, plant.id, { person: { name: "Test Member", email: "member@example.invalid", employeeId: "TEST-M" }, baseRole: "Standard User", zoneIds: [zone.id] });
  const scope = { organizationId: org.id, plantId: plant.id };
  function selectFactory() { context.selectAccessContext({ version: 1, selectionId: "", personId: current.getCurrentDemoUser().id, kind: "factory", ...scope }); }
  selectFactory();
  const expected = () => ({ revision: v4state.getAccessV4State().revision, selectionId: context.getActiveAccessContext()!.selectionId });
  const department = () => v4.saveDepartment({ ...scope, zoneId: zone.id }, { name: "Assembly", code: "ASM", status: "Active" }, expected());
  return { values, storage, current, commands, state, directory, v4, v4state, context, persistence, org, ca, plant, zone, zone2, member, scope, expected, department, selectFactory };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Batch 1 protected administration", () => {
  it("creates scoped Departments and multiple explicit leaders without changing legacy data", async () => {
    const s = await setup(); const old = s.storage.getItem("ops-organization-configuration-v1"); const v3 = JSON.stringify(s.state.getAccessV3State());
    const d = await s.department();
    await s.v4.assignV4Role({ ...s.scope, zoneId: s.zone.id }, "Zone Leader", s.member.id, s.expected());
    const second = s.commands.saveFactoryUser(s.org.id, s.plant.id, { person: { name: "Second", email: "second@example.invalid", employeeId: "SECOND" }, baseRole: "Standard User", zoneIds: [s.zone.id] });
    const newerV3 = JSON.stringify(s.state.getAccessV3State());
    await s.v4.assignV4Role({ ...s.scope, zoneId: s.zone.id }, "Zone Leader", second.id, s.expected());
    expect(s.v4state.getAccessV4State().assignments).toHaveLength(2); expect(d.revision).toBe(1);
    expect(s.storage.getItem("ops-organization-configuration-v1")).toBe(old);
    expect(JSON.stringify(s.state.getAccessV3State())).toBe(newerV3); expect(v3).not.toBe(newerV3);
  });
  it("rejects stale revision and stale context without writes", async () => {
    const s = await setup(); const stale = s.expected(); const d = await s.department(); const before = [...s.values];
    await expect(s.v4.saveDepartment({ ...s.scope, zoneId: s.zone.id }, { id: d.id, name: "Stale", code: "ASM", status: "Active" }, stale)).rejects.toThrow(/Revision/);
    expect([...s.values]).toEqual(before);
    const old = s.expected(); s.selectFactory(); const changed = [...s.values];
    await expect(s.v4.assignV4Role(s.scope, "Zone Champion", s.member.id, old)).rejects.toThrow(/context/); expect([...s.values]).toEqual(changed);
  });
  it("blocks cross-client/factory context spoofing and SA operational inheritance", async () => {
    const s = await setup(); const before = [...s.values];
    await expect(s.v4.saveDepartment({ organizationId: "abc-manufacturing", plantId: "PLANT-EGM", zoneId: "ZONE-A" }, { name: "Bad", code: "B", status: "Active" }, s.expected())).rejects.toThrow(/context/);
    expect([...s.values]).toEqual(before);
    s.current.setDemoRole("superAdmin");
    expect(s.context.validateAccessContext({ version: 1, selectionId: "test", personId: "USR-OPS-SUPER-ADMIN", kind: "factory", ...s.scope }).kind).toBe("factory");
    expect(s.state.getAccessV3State().factoryAdmins.some(item => item.userId === "USR-OPS-SUPER-ADMIN")).toBe(false);
  });
  it("prevents cross-Zone leadership and Department assignment", async () => {
    const s = await setup(); const d = await s.department();
    await s.v4.assignV4Role({ ...s.scope, zoneId: s.zone.id, departmentId: d.id }, "Department Leader", s.member.id, s.expected());
    await expect(s.v4.assignV4Role({ ...s.scope, zoneId: s.zone2.id }, "Zone Leader", s.member.id, s.expected())).rejects.toThrow(/Zone/);
  });
  it("allows DL same-Department member allocation but denies peer appointment and user creation authority", async () => {
    const s = await setup(); const d = await s.department();
    await s.v4.assignV4Role({ ...s.scope, zoneId: s.zone.id, departmentId: d.id }, "Department Leader", s.member.id, s.expected());
    const other = s.commands.saveFactoryUser(s.org.id, s.plant.id, { person: { name: "Other", email: "other@example.invalid", employeeId: "OTHER" }, baseRole: "Zone Member", zoneIds: [s.zone.id] });
    s.current.setAdministrationDemoIdentity(s.member.id); s.selectFactory();
    await s.v4.assignV4Role({ ...s.scope, zoneId: s.zone.id, departmentId: d.id }, "Department Member", other.id, s.expected());
    const before = [...s.values];
    await expect(s.v4.assignV4Role({ ...s.scope, zoneId: s.zone.id, departmentId: d.id }, "Department Leader", other.id, s.expected())).rejects.toThrow(/Factory Admin/);
    expect(() => s.commands.saveFactoryUser(s.org.id, s.plant.id, { person: { name: "Bad", email: "bad@example.invalid", employeeId: "BAD" }, baseRole: "Standard User", zoneIds: [] })).toThrow(); expect([...s.values]).toEqual(before);
  });
  it("Champion oversight does not grant assignment authority", async () => {
    const s = await setup(); await s.v4.assignV4Role(s.scope, "Zone Champion", s.member.id, s.expected());
    s.current.setAdministrationDemoIdentity(s.member.id); s.selectFactory(); const before = [...s.values];
    await expect(s.department()).rejects.toThrow(/Factory Admin/); expect([...s.values]).toEqual(before);
  });
  it.each(["Inactive", "missing"])("rejects %s membership on write/context use", async mode => {
    const s = await setup(); const e = s.expected(); const state = structuredClone(s.state.getAccessV3State());
    if (mode === "Inactive") state.clientMemberships.find(m => m.userId === s.ca.id)!.status = "Inactive"; else state.clientMemberships = state.clientMemberships.filter(m => m.userId !== s.ca.id);
    s.storage.setItem("ops-access-v3-administration-v1", JSON.stringify(state)); const before = [...s.values];
    await expect(s.v4.saveDepartment({ ...s.scope, zoneId: s.zone.id }, { name: "Bad", code: "B", status: "Active" }, e)).rejects.toThrow(); expect([...s.values]).toEqual(before);
  });
  it("blocks deactivation/revocation until full dependency coverage exists", async () => {
    const s = await setup(); const d = await s.department(); const a = await s.v4.assignV4Role(s.scope, "Zone Champion", s.member.id, s.expected()); const before = [...s.values];
    await expect(s.v4.saveDepartment({ ...s.scope, zoneId: s.zone.id }, { id: d.id, name: d.name, code: d.code, status: "Inactive" }, s.expected())).rejects.toThrow(/dependency/);
    await expect(s.v4.revokeV4Role(s.scope, a.id, "Reviewed", s.expected())).rejects.toThrow(/dependency/); expect([...s.values]).toEqual(before);
  });
  it("preserves unknown compatible fields and rejects unknown versions without repair", async () => {
    const s = await setup(); const d = await s.department(); const data = { ...s.v4state.getAccessV4State(), future: { keep: true } };
    s.storage.setItem(s.persistence.V4_STORAGE_KEY, JSON.stringify(data));
    await s.v4.saveDepartment({ ...s.scope, zoneId: s.zone.id }, { id: d.id, name: "Updated", code: d.code, status: "Active" }, s.expected());
    expect(JSON.parse(s.storage.getItem(s.persistence.V4_STORAGE_KEY)!).future).toEqual({ keep: true });
    const unsupported = JSON.stringify({ ...data, schemaVersion: 9 }); s.storage.setItem(s.persistence.V4_STORAGE_KEY, unsupported);
    expect(() => s.v4state.getAccessV4State()).toThrow(/Unsupported/); expect(s.storage.getItem(s.persistence.V4_STORAGE_KEY)).toBe(unsupported);
  });
  it("new-client entitlements deny by default and remain staged even with configured flags; ABC/XYZ unchanged", async () => {
    const s = await setup(); const access = await import("@/lib/module-entitlements");
    expect(s.org.operationalState).toBe("Staged"); expect(Object.values(access.getOrganizationAccess(s.org.id)).every(v => v === false)).toBe(true);
    expect(access.getFactoryAccess("abc-manufacturing", "PLANT-EGM").audit).toBe(true); expect(access.getOrganizationAccess("xyz-components").gemba).toBe(false);
    s.current.setDemoRole("superAdmin");
    expect(access.saveFactoryAccess(s.org.id, s.plant.id, { ...access.getFactoryAccess("abc-manufacturing", "PLANT-EGM") })).toBe(true);
    expect(access.getOrganizationAccess(s.org.id).audit).toBe(false); expect(access.getOrganizationAccess("unknown-client").audit).toBe(false);
  });
  it("only SA can attach a reviewed identity; no roles or old membership changes", async () => {
    const s = await setup();
    const input = { personId: "USR-LAKSHMAN", confirmedPersonId: "USR-LAKSHMAN", organizationId: s.org.id, reason: "Synthetic identity review", expectedV3Payload: s.storage.getItem("ops-access-v3-administration-v1") };
    await expect(s.v4.attachPersonToClient(input, s.expected())).rejects.toThrow();
    s.current.setDemoRole("superAdmin"); s.context.selectAccessContext({ version: 1, personId: "USR-OPS-SUPER-ADMIN", selectionId: "", kind: "platform" });
    const old = structuredClone(s.state.getAccessV3State()); const users = JSON.stringify(s.directory.getAdminUsers());
    const m = await s.v4.attachPersonToClient(input, s.expected());
    expect(m.clientAdmin).toBe(false); expect(s.state.getAccessV3State().factoryAdmins).toEqual(old.factoryAdmins); expect(s.state.getAccessV3State().auditorGrants).toEqual(old.auditorGrants); expect(s.state.getAccessV3State().clientMemberships).toEqual([...old.clientMemberships, m]); expect(JSON.stringify(s.directory.getAdminUsers())).toBe(users);
    await expect(s.v4.attachPersonToClient({ ...input, expectedV3Payload: s.storage.getItem("ops-access-v3-administration-v1") }, s.expected())).rejects.toThrow(/membership/);
  });
  it("denies attachment identity mismatch and dormant target grants", async () => {
    const s = await setup(); s.current.setDemoRole("superAdmin"); s.context.selectAccessContext({ version: 1, personId: "USR-OPS-SUPER-ADMIN", selectionId: "", kind: "platform" });
    const input = { personId: "USR-LAKSHMAN", confirmedPersonId: "wrong", organizationId: s.org.id, reason: "review", expectedV3Payload: s.storage.getItem("ops-access-v3-administration-v1") };
    await expect(s.v4.attachPersonToClient(input, s.expected())).rejects.toThrow(/Confirm/);
    const data = structuredClone(s.state.getAccessV3State()); data.factoryAdmins.push({ id: "dormant", userId: "USR-LAKSHMAN", organizationId: s.org.id, plantId: s.plant.id, status: "Inactive", assignedBy: s.ca.id, assignedAt: "test" }); s.storage.setItem("ops-access-v3-administration-v1", JSON.stringify(data));
    await expect(s.v4.attachPersonToClient({ ...input, confirmedPersonId: input.personId, expectedV3Payload: s.storage.getItem("ops-access-v3-administration-v1") }, s.expected())).rejects.toThrow(/Dormant/);
  });
  it("rolls back membership and events if the second protected write fails", async () => {
    const s = await setup(); s.current.setDemoRole("superAdmin"); s.context.selectAccessContext({ version: 1, personId: "USR-OPS-SUPER-ADMIN", selectionId: "", kind: "platform" }); const before = [...s.values];
    const original = s.storage.setItem; let failed = false;
    vi.spyOn(s.storage, "setItem").mockImplementation((k, v) => { if (k === s.persistence.V4_STORAGE_KEY && !failed) { failed = true; throw new Error("quota"); } original(k, v); });
    await expect(s.v4.attachPersonToClient({ personId: "USR-LAKSHMAN", confirmedPersonId: "USR-LAKSHMAN", organizationId: s.org.id, reason: "review", expectedV3Payload: s.storage.getItem("ops-access-v3-administration-v1") }, s.expected())).rejects.toThrow(/restored/);
    expect([...s.values]).toEqual(before);
  });
  it("recovers Prepared backwards and Committed forwards, quarantining foreign bytes", async () => {
    const s = await setup(); const journalKey = "ops-access-v3-pending-transaction-v1"; const key = s.persistence.V4_STORAGE_KEY;
    const images = [{ key, before: null, after: "after" }];
    s.storage.setItem(key, "after"); s.storage.setItem(journalKey, JSON.stringify({ version: 2, id: "tx", phase: "Prepared", images })); s.persistence.recoverAdministrationV4Storage(); expect(s.storage.getItem(key)).toBeNull();
    s.storage.setItem(journalKey, JSON.stringify({ version: 2, id: "tx", phase: "Committed", images })); s.persistence.recoverAdministrationV4Storage(); expect(s.storage.getItem(key)).toBe("after");
    s.storage.setItem(journalKey, JSON.stringify({ version: 2, id: "tx", phase: "Prepared", images })); s.storage.setItem(key, "foreign"); expect(() => s.persistence.recoverAdministrationV4Storage()).toThrow(/conflict/); expect(s.storage.getItem(key)).toBe("foreign"); expect(s.storage.getItem(journalKey)).not.toBeNull();
  });
  it("requires Web Locks and compares the final raw read set before a write", async () => {
    const s = await setup(); const before = [...s.values]; vi.stubGlobal("navigator", {});
    await expect(s.department()).rejects.toThrow(/Web Locks/); expect([...s.values]).toEqual(before);
    expect(() => s.persistence.commitAdministrationV4([{ key: s.persistence.V4_STORAGE_KEY, before: null, after: "bad" }], new Map([["5s-auth-session", "stale"]]), () => undefined)).toThrow(/Revision conflict/); expect([...s.values]).toEqual(before);
  });
  it("persists an identity-bound context across module reload and invalidates it after identity change", async () => {
    const s = await setup(); const original = s.context.getActiveAccessContext();
    if (!original) throw new Error("Expected selected factory fixture");
    vi.resetModules(); const reloaded = await import("@/features/five-s/administration/access-v4-context");
    expect(reloaded.getActiveAccessContext()).toEqual(original);
    const current = await import("@/lib/current-user"); current.setDemoRole("superAdmin");
    expect(reloaded.getActiveAccessContext()).toBeNull();
    expect(() => reloaded.validateAccessContext(original)).toThrow(/current identity/);
  });
  it("retains a recoverable journal if rollback itself fails", async () => {
    const s = await setup(); const key = s.persistence.V4_STORAGE_KEY; const journalKey = "ops-access-v3-pending-transaction-v1";
    const originalSet = s.storage.setItem; const originalRemove = s.storage.removeItem;
    vi.spyOn(s.storage, "setItem").mockImplementation((k, v) => { if (k === key) throw new Error("unavailable"); originalSet(k, v); });
    vi.spyOn(s.storage, "removeItem").mockImplementation(k => { if (k === key) throw new Error("unavailable"); originalRemove(k); });
    await expect(s.department()).rejects.toThrow(/recovery is pending/); expect(s.storage.getItem(journalKey)).not.toBeNull();
    vi.restoreAllMocks(); s.current.setDemoRole("superAdmin"); await s.v4.recoverV4Administration();
    expect(s.storage.getItem(journalKey)).toBeNull(); expect(s.storage.getItem(key)).toBeNull();
  });
  it("does not roll back committed business state when journal cleanup fails", async () => {
    const s = await setup(); const journalKey = "ops-access-v3-pending-transaction-v1";
    const original = s.storage.removeItem;
    vi.spyOn(s.storage, "removeItem").mockImplementation(k => { if (k === journalKey) throw new Error("cleanup"); original(k); });
    await expect(s.department()).rejects.toThrow(/Change committed/);
    expect(JSON.parse(s.storage.getItem(journalKey)!).phase).toBe("Committed");
    expect(s.v4state.getAccessV4State().departments).toHaveLength(1);
    vi.restoreAllMocks(); s.current.setDemoRole("superAdmin"); await s.v4.recoverV4Administration();
    expect(s.v4state.getAccessV4State().departments).toHaveLength(1); expect(s.storage.getItem(journalKey)).toBeNull();
  });

});
