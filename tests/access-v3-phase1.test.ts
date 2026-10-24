import { provisionedClientAdministrator, seedLegacyClientAdministrator } from "./helpers/client-administrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";
import type { FactoryUserInput } from "@/features/five-s/administration/access-v3-store";
async function setup() {
    vi.resetModules();
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("localStorage", storage);
    authenticateDemoFixture();
    const current = await import("@/lib/current-user");
    current.setDemoRole("superAdmin");
    const directory = await import("@/features/five-s/administration/store");
    const commands = await import("@/features/five-s/administration/access-v3-store");
    const state = await import("@/features/five-s/administration/access-v3-state");
    const organizations = await import("@/lib/organizations");
    const plants = await import("@/lib/organization-store");
    const person = { name: "Client Administrator", email: "client.admin@test.invalid", employeeId: "EMP-NEW-CA" };
    return { values, storage, current, directory, commands, state, organizations, plants, person };
}
async function factorySetup() {
    const s = await setup();
    const organization = s.commands.saveClientProfile({ name: "Phase 1 Client", industry: "Manufacturing" });
    const ca = await provisionedClientAdministrator(organization.id);
    const plant = s.commands.saveFactory(organization.id, { name: "Factory One", code: "ONE", location: "Test", maximumActiveUsers: 30 });
    s.current.setAdministrationDemoIdentity(ca.id);
    s.commands.assignFactoryAdministrator(organization.id, plant.id, ca.id);
    const zone = s.commands.saveFactoryZone(organization.id, plant.id, { name: "Shared name", code: "S", department: "Production" });
    return { ...s, organization, ca, plant, zone };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Access v3 Phase 1 administration hierarchy", () => {
    it("adds stable clients with automatic administrators while retaining existing identities and entitlements and persists profile edits", async () => {
        const s = await setup();
        s.storage.setItem("ops-organization-modules-v1", JSON.stringify({ "abc-manufacturing": { audit: false } }));
        const entitlement = s.storage.getItem("ops-organization-modules-v1");
        const users = structuredClone(s.directory.getAdminUsers());
        const a = s.commands.saveClientProfile({ name: "First Client", industry: "Manufacturing" });
        const b = s.commands.saveClientProfile({ name: "Second Client", industry: "Services" });
        expect(a.id).not.toBe(b.id);
        expect(s.commands.saveClientProfile({ id: a.id, name: "Renamed Client", industry: "Manufacturing" }).id).toBe(a.id);
        expect(s.directory.getAdminUsers().filter(person => users.some(original => original.id === person.id))).toEqual(users);
        expect(s.directory.getAdminUsers()).toHaveLength(users.length + 2);
        expect(s.storage.getItem("ops-organization-modules-v1")).toBe(entitlement);
        vi.resetModules();
        const reloaded = await import("@/lib/organizations");
        expect(reloaded.getOrganizations().find(item => item.id === a.id)?.name).toBe("Renamed Client");
        expect(reloaded.getOrganizations().some(item => item.id === "abc-manufacturing")).toBe(true);
    });
    it.each(["auditor", "leader", "responsible"] as const)("legacy %s cannot manage clients or obtain v3 assignment automatically", async (role) => {
        const s = await setup();
        s.current.setDemoRole(role);
        const before = [...s.values];
        expect(() => s.commands.saveClientProfile({ name: "Forbidden", industry: "Test" })).toThrow();
        expect(() => s.commands.saveFactory("abc-manufacturing", { name: "Forbidden", code: "BAD", location: "Test" })).toThrow();
        expect(s.commands.canOpenAccessAdministration()).toBe(false);
        expect(s.state.getAccessV3State().factoryAdmins).toEqual([]);
        expect([...s.values]).toEqual(before);
    });
    it("does not automatically grant platform factory powers or create legacy-role auditor grants", async () => {
        const s = await setup();
        const users = structuredClone(s.directory.getAdminUsers());
        expect(() => s.commands.saveFactory("abc-manufacturing", { name: "Forbidden", code: "BAD", location: "Test" })).toThrow();
        expect(() => s.commands.assignFactoryAdministrator("abc-manufacturing", "PLANT-EGM", "USR-RUMESH")).toThrow();
        expect(s.directory.getAdminUsers()).toEqual(users);
        expect(s.state.getAccessV3State().clientMemberships).toEqual([]);
        expect(s.state.getAccessV3State().events).toEqual([]);
    });
    it("allows client-scoped factories and explicit FA assignment, with no inherited operational roles", async () => {
        const s = await factorySetup();
        expect(s.plant.organizationId).toBe(s.organization.id);
        expect(s.directory.getAdminUser(s.ca.id)?.roles).toEqual([]);
        expect(s.directory.getAdminUser(s.ca.id)?.permissions).toEqual([]);
        expect(() => s.commands.saveFactory("abc-manufacturing", { name: "Foreign", code: "BAD", location: "Test" })).toThrow();
        expect(() => s.commands.assignFactoryAdministrator("abc-manufacturing", "PLANT-EGM", s.ca.id)).toThrow();
        expect(s.commands.administrationFactories(s.organization.id).map(p => p.id)).toContain(s.plant.id);
        const access = await import("@/lib/module-entitlements");
        expect(access.saveFactoryAccess(s.organization.id, s.plant.id, access.getOrganizationAccess(s.organization.id))).toBe(false);
        const gemba = await import("@/features/gemba/gemba-access");
        const ci = await import("@/features/five-s/continuous-improvement/access");
        const actor = s.current.getCurrentDemoUser();
        expect(gemba.canConductGembaWalk([], actor)).toBe(true);
        expect(ci.canCreateImprovement(s.ca, actor)).toBe(true);
    });
    it.each(["Admin", "Auditor", "Reviewer", "Factory Admin", "Client Admin", "Super Admin", "Viewer"])("rejects elevated factory base role %s without writes", async (baseRole) => {
        const s = await factorySetup();
        const before = [...s.values];
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, { person: { name: "Member", email: "member@test.invalid", employeeId: "EMP-M" }, baseRole, zoneIds: [] } as unknown as FactoryUserInput)).toThrow();
        expect([...s.values]).toEqual(before);
    });
    it("rejects injected permissions, roles, foreign people and ambiguous scope without partial writes/events", async () => {
        const s = await factorySetup();
        const before = [...s.values];
        const payload = { person: { name: "Member", email: "member@test.invalid", employeeId: "EMP-M" }, baseRole: "Standard User", zoneIds: [], permissions: ["administration.manage_users"] };
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, payload as unknown as FactoryUserInput)).toThrow(/payload/);
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, { ...payload, permissions: undefined } as unknown as FactoryUserInput)).toThrow();
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, { userId: "USR-RUMESH", baseRole: "Zone Member", zoneIds: [] })).toThrow();
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.name, { userId: s.ca.id, baseRole: "Zone Member", zoneIds: [] })).toThrow();
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, { userId: s.ca.id, baseRole: "Zone Member", zoneIds: ["ZONE-A"] })).toThrow();
        expect([...s.values]).toEqual(before);
    });
    it("preserves a single identity, independent factory roles and multiple canonical Zone allocations", async () => {
        const s = await factorySetup();
        const actions = await import("@/lib/actions/action-store");
        const originalActions = structuredClone(actions.getActions());
        s.current.setDemoRole("superAdmin");
        const second = s.commands.saveFactory(s.organization.id, { name: "Factory Two", code: "TWO", location: "Test", maximumActiveUsers: 30 });
        s.current.setAdministrationDemoIdentity(s.ca.id);
        s.commands.assignFactoryAdministrator(s.organization.id, second.id, s.ca.id);
        const z2 = s.commands.saveFactoryZone(s.organization.id, second.id, { name: "Shared name", code: "S", department: "Production" });
        const z3 = s.commands.saveFactoryZone(s.organization.id, s.plant.id, { name: "Other Zone", code: "O", department: "Production" });
        const person = s.commands.saveFactoryUser(s.organization.id, s.plant.id, { person: { name: "Stable Person", email: "stable@test.invalid", employeeId: "EMP-STABLE" }, baseRole: "Zone Member", zoneIds: [s.zone.id, z3.id] });
        s.commands.saveFactoryUser(s.organization.id, second.id, { userId: person.id, baseRole: "Standard User", zoneIds: [z2.id] });
        const secondBefore = structuredClone(s.state.getAccessV3State().factoryMemberships.find(m => m.plantId === second.id && m.userId === person.id));
        s.commands.saveFactoryUser(s.organization.id, s.plant.id, { userId: person.id, baseRole: "Zone Leader", zoneIds: [s.zone.id, z3.id] });
        expect(s.directory.getAdminUsers().filter(p => p.id === person.id)).toHaveLength(1);
        expect(s.state.getAccessV3State().factoryMemberships.find(m => m.plantId === second.id && m.userId === person.id)).toEqual(secondBefore);
        expect(s.state.getAccessV3State().zoneAllocations.filter(a => a.userId === person.id && a.status === "Active")).toHaveLength(3);
        expect(z2.id).not.toBe(s.zone.id);
        expect(actions.getActions()).toEqual(originalActions);
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, { person: { name: "Duplicate", email: "stable@test.invalid", employeeId: "NEW" }, baseRole: "Zone Member", zoneIds: [] })).toThrow(/profile/i);
    });
    it("prevents FA from managing a different factory, appointing FA, granting Client Admin or changing entitlements", async () => {
        const s = await factorySetup();
        const person = s.commands.saveFactoryUser(s.organization.id, s.plant.id, { person: { name: "Factory Admin", email: "fa@test.invalid", employeeId: "EMP-FA" }, baseRole: "Zone Member", zoneIds: [] });
        s.commands.assignFactoryAdministrator(s.organization.id, s.plant.id, person.id);
        s.current.setDemoRole("superAdmin");
        const second = s.commands.saveFactory(s.organization.id, { name: "Other factory", code: "OTHER", location: "Test", maximumActiveUsers: 30 });
        s.current.setAdministrationDemoIdentity(s.ca.id);
        s.current.setAdministrationDemoIdentity(person.id);
        const before = [...s.values];
        expect(() => s.commands.saveFactoryUser(s.organization.id, second.id, { userId: person.id, baseRole: "Zone Member", zoneIds: [] })).toThrow();
        expect(() => s.commands.assignFactoryAdministrator(s.organization.id, s.plant.id, s.ca.id)).toThrow();
        expect(() => s.commands.assignClientAdministrator(s.organization.id, { userId: person.id })).toThrow();
        expect(() => s.commands.saveFactory(s.organization.id, { id: s.plant.id, name: "Unauthorized edit", code: "ONE", location: "Test" })).toThrow();
        const access = await import("@/lib/module-entitlements");
        expect(access.saveFactoryAccess(s.organization.id, s.plant.id, access.getOrganizationAccess(s.organization.id))).toBe(false);
        expect([...s.values]).toEqual(before);
    });
    it("rejects unauthenticated, inactive and forged current actors", async () => {
        const s = await factorySetup();
        const before = [...s.values];
        expect(() => s.commands.saveFactoryZone(s.organization.id, s.plant.id, { name: "Bad", code: "BAD", department: "Test" }, "USR-LAKSHMAN")).toThrow();
        expect([...s.values]).toEqual(before);
        s.storage.removeItem("5s-auth-session");
        expect(() => s.commands.saveFactory(s.organization.id, { name: "Bad", code: "BAD", location: "Test" })).toThrow();
        authenticateDemoFixture();
        const users = s.directory.getAdminUsers().map(u => u.id === s.ca.id ? { ...u, status: "Inactive" as const } : u);
        s.storage.setItem("five-s-administration-users-v1", JSON.stringify(users));
        s.directory.refreshAdminDirectory();
        expect(() => s.commands.saveFactory(s.organization.id, { name: "Bad", code: "BAD", location: "Test" })).toThrow();
    });
    it("blocks last-admin revocation and retains complete assignment history without person deactivation", async () => {
        const s = await factorySetup();
        const first = s.state.getAccessV3State().factoryAdmins[0];
        expect(() => s.commands.revokeFactoryAdministrator(first.id)).toThrow(/another/);
        const person = s.commands.saveFactoryUser(s.organization.id, s.plant.id, { person: { name: "Second Admin", email: "second@test.invalid", employeeId: "EMP-SECOND" }, baseRole: "Standard User", zoneIds: [] });
        s.commands.assignFactoryAdministrator(s.organization.id, s.plant.id, person.id);
        s.commands.revokeFactoryAdministrator(first.id);
        expect(s.state.getAccessV3State().factoryAdmins.find(a => a.id === first.id)).toMatchObject({ status: "Inactive", revokedBy: s.ca.id, assignedBy: s.ca.id });
        expect(s.directory.getAdminUser(first.userId)?.status).toBe("Active");
    });
    it("preserves original payloads and records no success when a multi-key write fails", async () => {
        const s = await factorySetup();
        const before = [...s.values].sort();
        const events = structuredClone(s.state.getAccessV3State().events);
        const write = s.storage.setItem;
        vi.spyOn(s.storage, "setItem").mockImplementation((key, value) => { if (key === s.state.ACCESS_V3_KEY && value.includes("Failure Person"))
            throw new Error("Quota"); write(key, value); });
        // Event summaries do not expose profile details, so fail the metadata write once after the directory write.
        let failed = false;
        vi.mocked(s.storage.setItem).mockImplementation((key, value) => { if (key === s.state.ACCESS_V3_KEY && !failed) {
            failed = true;
            throw new Error("Quota");
        } write(key, value); });
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, { person: { name: "Failure Person", email: "failure@test.invalid", employeeId: "EMP-FAILURE" }, baseRole: "Standard User", zoneIds: [] })).toThrow(/preserved/);
        expect([...s.values].sort()).toEqual(before);
        expect(s.state.getAccessV3State().events).toEqual(events);
        expect(s.directory.getAdminUsers().some(p => p.email === "failure@test.invalid")).toBe(false);
    });
    it("attributes successful events to the actual authenticated subject and preserves existing configuration payloads", async () => {
        const s = await factorySetup();
        const event = s.state.getAccessV3State().events.at(-1)!;
        expect(event.actorId).toBe(s.ca.id);
        expect(event.organizationId).toBe(s.organization.id);
        expect(event.plantId).toBe(s.plant.id);
        expect(event.operation).toBe("zone.created");
        expect(s.plants.getOrganizationPlant("PLANT-EGM")?.id).toBe("PLANT-EGM");
        expect(s.plants.getOrganizationPlants().some(p => p.id === s.plant.id)).toBe(false);
        expect(s.plants.getAllOrganizationConfiguration().zones.some(z => z.id === "ZONE-A")).toBe(true);
    });
    it("persists new-client entitlement changes only for the platform and preserves legacy client settings", async () => {
        const s = await factorySetup();
        s.current.setDemoRole("superAdmin");
        const access = await import("@/lib/module-entitlements");
        const old = structuredClone(access.getOrganizationAccess("abc-manufacturing"));
        expect(access.saveFactoryAccess(s.organization.id, s.plant.id, { ...access.NEW_FACTORY_ACCESS, audit: false })).toBe(true);
        s.current.setAdministrationDemoIdentity(s.ca.id);
        expect(access.saveFactoryAccess(s.organization.id, s.plant.id, { ...access.getOrganizationAccess(s.organization.id), audit: true })).toBe(false);
        expect(access.getOrganizationAccess(s.organization.id).audit).toBe(false);
        expect(access.getOrganizationAccess("abc-manufacturing")).toEqual(old);
        vi.resetModules();
        const reloaded = await import("@/lib/module-entitlements");
        expect(reloaded.getOrganizationAccess(s.organization.id).audit).toBe(false);
    });
    it("preserves invalid original storage and blocks interrupted transactions until platform recovery", async () => {
        const s = await factorySetup();
        s.storage.setItem("five-s-administration-users-v1", "{broken");
        const raw = [...s.values];
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, { userId: s.ca.id, baseRole: "Standard User", zoneIds: [] })).toThrow();
        expect([...s.values]).toEqual(raw);
        s.storage.setItem("five-s-administration-users-v1", JSON.stringify(s.directory.getAdminUsers()));
        const original = s.storage.getItem(s.state.ACCESS_V3_KEY)!;
        s.storage.setItem(s.commands.ADMIN_TRANSACTION_KEY, JSON.stringify([{ key: s.state.ACCESS_V3_KEY, value: original }]));
        expect(() => s.commands.saveFactoryZone(s.organization.id, s.plant.id, { name: "Blocked", code: "B", department: "Production" })).toThrow(/recovery/);
        expect(() => s.commands.recoverAdministrationTransaction()).toThrow();
        s.current.setDemoRole("superAdmin");
        s.commands.recoverAdministrationTransaction();
        expect(s.storage.getItem(s.commands.ADMIN_TRANSACTION_KEY)).toBeNull();
        expect(s.storage.getItem(s.state.ACCESS_V3_KEY)).toBe(original);
    });
    it("does not rewrite legacy owners, reviewers or roles when explicitly allocating an existing eligible person", async () => {
        const s = await setup();
        const actions = await import("@/lib/actions/action-store");
        const actionBefore = structuredClone(actions.getActions());
        const original = structuredClone(s.directory.getAdminUser("USR-SIVA-KUMAR"));
        const ca = await seedLegacyClientAdministrator();
        s.current.setAdministrationDemoIdentity(ca.id);
        s.commands.assignFactoryAdministrator("abc-manufacturing", "PLANT-EGM", ca.id);
        s.commands.saveFactoryUser("abc-manufacturing", "PLANT-EGM", { userId: "USR-SIVA-KUMAR", baseRole: "Zone Leader", zoneIds: ["ZONE-A", "ZONE-B"] });
        expect(s.directory.getAdminUser("USR-SIVA-KUMAR")).toEqual(original);
        expect(actions.getActions()).toEqual(actionBefore);
        expect(() => s.commands.saveFactoryUser("abc-manufacturing", "PLANT-EGM", { userId: "USR-SIVA-KUMAR", baseRole: "Zone Leader", zoneIds: [], status: "Inactive" })).toThrow(/outstanding/);
        expect(s.state.getAccessV3State().factoryMemberships.find(m => m.userId === "USR-SIVA-KUMAR")?.status).toBe("Active");
    });
    it("does not authorize inactive client membership or leak a foreign client's people", async () => {
        const s = await factorySetup();
        expect(s.commands.administrationPeople(s.organization.id).some(u => u.id === "USR-RUMESH")).toBe(false);
        const next = structuredClone(s.state.getAccessV3State());
        next.clientMemberships.find(m => m.userId === s.ca.id)!.status = "Inactive";
        s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(next));
        const before = [...s.values];
        expect(() => s.commands.saveFactoryZone(s.organization.id, s.plant.id, { name: "Forbidden", code: "BAD", department: "Production" })).toThrow();
        expect(() => s.commands.saveFactory(s.organization.id, { name: "Forbidden", code: "BAD", location: "Test" })).toThrow();
        expect([...s.values]).toEqual(before);
    });
    it("hides incomplete writes behind original journal payloads until explicit recovery", async () => {
        const s = await factorySetup(); const before = JSON.stringify(s.state.getAccessV3State());
        s.storage.setItem(s.commands.ADMIN_TRANSACTION_KEY, JSON.stringify([{ key: s.state.ACCESS_V3_KEY, value: before }]));
        const corrupt = structuredClone(s.state.getAccessV3State()); corrupt.events.push({ id: "FALSE-SUCCESS", actorId: s.ca.id, organizationId: s.organization.id, operation: "uncommitted", targetId: s.ca.id, at: "2030-01-01" });
        s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(corrupt));
        expect(s.state.getAccessV3State().events.some(e => e.id === "FALSE-SUCCESS")).toBe(false);
        s.current.setDemoRole("superAdmin"); s.commands.recoverAdministrationTransaction(); expect(s.storage.getItem(s.state.ACCESS_V3_KEY)).toBe(before);
    });

    it("rejects duplicate canonical factory and Zone IDs without guessing or rewriting storage", async () => {
        const s = await factorySetup(); const configuration = structuredClone(s.plants.getAllOrganizationConfiguration());
        configuration.plants.push({ ...s.plant, name: "Ambiguous duplicate" }); s.storage.setItem("ops-organization-configuration-v1", JSON.stringify(configuration)); s.plants.refreshOrganizationConfiguration(); const before = [...s.values];
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, { userId: s.ca.id, baseRole: "Zone Member", zoneIds: [] })).toThrow(/ambiguous/); expect([...s.values]).toEqual(before);
        configuration.plants.pop(); configuration.zones.push({ ...s.zone, name: "Ambiguous Zone" }); s.storage.setItem("ops-organization-configuration-v1", JSON.stringify(configuration)); s.plants.refreshOrganizationConfiguration(); const zoneBefore = [...s.values];
        expect(() => s.commands.saveFactoryUser(s.organization.id, s.plant.id, { userId: s.ca.id, baseRole: "Zone Member", zoneIds: [s.zone.id] })).toThrow(); expect([...s.values]).toEqual(zoneBefore);
    });

});
