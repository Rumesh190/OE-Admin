import { provisionedClientAdministrator, seedLegacyClientAdministrator } from "./helpers/client-administrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";
import type { FiveSAudit } from "@/features/five-s/types/five-s";
async function setup() {
    vi.resetModules();
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    vi.stubGlobal("window", { localStorage: storage });
    vi.stubGlobal("localStorage", storage);
    authenticateDemoFixture();
    const current = await import("@/lib/current-user");
    current.setDemoRole("superAdmin");
    const commands = await import("@/features/five-s/administration/access-v3-store");
    const state = await import("@/features/five-s/administration/access-v3-state");
    const directory = await import("@/features/five-s/administration/store");
    const policy = await import("@/features/five-s/administration/factory-authorization");
    const auditPolicy = await import("@/lib/five-s/audit-authorization");
    const audits = await import("@/lib/five-s/audit-store");
    // Characterize the existing v3 branch. New independent clients are staged/versioned and covered by v4 suites.
    const organization = commands.saveClientProfile({ id: "abc-manufacturing", name: "Phase 2 legacy client", industry: "Manufacturing" });
    const ca = await seedLegacyClientAdministrator();
    const plant = commands.saveFactory(organization.id, { name: "Factory One", code: "ONE", location: "Test", maximumActiveUsers: 30 });
  current.setAdministrationDemoIdentity(ca.id);
    commands.assignFactoryAdministrator(organization.id, plant.id, ca.id);
    const zones = ["A", "B", "C"].map(code => commands.saveFactoryZone(organization.id, plant.id, { name: `Zone ${code}`, code, department: "Production" }));
    const users = (["Zone Leader", "Zone Leader", "Zone Member", "Standard User"] as const).map((baseRole, i) => commands.saveFactoryUser(organization.id, plant.id, { person: { name: `Person ${i}`, email: `p${i}@phase2.invalid`, employeeId: `P2-${i}` }, baseRole, zoneIds: [zones[i === 1 ? 2 : 0].id] }));
    const context = { organizationId: organization.id, plantId: plant.id, zoneId: zones[1].id };
    const grant = commands.saveAuditorAuthorization(organization.id, plant.id, users[0].id, zones.map(z => z.id));
    commands.saveAuditorAuthorization(organization.id, plant.id, users[1].id, [zones[1].id]);
    const sections: FiveSAudit["sections"] = [{ category: "Sort", description: "Sort", score: 2, maxScore: 2, questions: [{ id: "Q-P2", category: "Sort", question: "Is the area organized?", score: 2, maxScore: 2, status: "Pass", actionRequired: false, observation: "Retained work", evidence: [{ id: "EV-HISTORY", name: "Original evidence", type: "image", size: 1, dataUrl: "", storageKey: "historical-reference", uploadedAt: "2026-01-01T00:00:00Z", uploadedBy: "Original author" }] }] }];
    function create(zoneId = context.zoneId, auditorId = users[0].id, startNow = false) { return audits.createFiveSAudit({ ...context, zoneId, assignedAuditorId: auditorId, title: "Requested title", plant: plant.name, area: "Zone B", department: "Production", auditor: "Untrusted label", dueDate: "2099-01-02", scheduledDate: "2099-01-01", scheduledTime: "12:00", sections: structuredClone(sections) }, { startNow }); }
    function select(id = ca.id) { current.setAdministrationDemoIdentity(id); }
    return { values, storage, current, commands, state, directory, policy, auditPolicy, audits, organization, ca, plant, zones, users, context, grant, sections, create, select };
}
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
describe("Phase 2 factory Auditor authorization", () => {
    it("preserves Phase 1 and unknown metadata, stable identities and legacy permissions without implicit grants", async () => {
        const s = await setup();
        const users = structuredClone(s.directory.getAdminUsers());
        const state = s.state.getAccessV3State();
        s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify({ ...state, extension: { retained: true } }));
        s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [s.zones[1].id]);
        expect(JSON.parse(s.storage.getItem(s.state.ACCESS_V3_KEY)!).extension).toEqual({ retained: true });
        expect(s.directory.getAdminUsers()).toEqual(users);
        expect(s.state.getAccessV3State().auditorGrants.some(g => g.userId === "USR-LAKSHMAN")).toBe(false);
        const old = { ...s.state.getAccessV3State() } as Partial<ReturnType<typeof s.state.getAccessV3State>>;
        delete old.auditorGrants;
        s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(old));
        expect(s.state.getAccessV3State().auditorGrants).toEqual([]);
    });
    it.each([2, 3])("denies grants to non-Zone-Leader person %s without writes", async (i) => { const s = await setup(); const before = [...s.values]; expect(() => s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[i].id, [s.zones[1].id])).toThrow(); expect([...s.values]).toEqual(before); });
    it.each(["inactive", "allocation", "role", "client", "factory"])("dynamically invalidates authority when %s changes, retaining the grant", async (kind) => {
        const s = await setup();
        const next = structuredClone(s.state.getAccessV3State());
        if (kind === "inactive")
            next.factoryMemberships.find(m => m.userId === s.users[0].id)!.status = "Inactive";
        if (kind === "allocation")
            next.zoneAllocations.filter(m => m.userId === s.users[0].id).forEach(m => { m.status = "Inactive"; });
        if (kind === "role")
            next.factoryMemberships.find(m => m.userId === s.users[0].id)!.baseRole = "Zone Member";
        if (kind === "client")
            next.clients.find(c => c.id === s.organization.id)!.status = "Inactive";
        if (kind === "factory") {
            const config = await import("@/lib/organization-store");
            const raw = config.getAllOrganizationConfiguration();
            s.storage.setItem("ops-organization-configuration-v1", JSON.stringify({ ...raw, plants: raw.plants.map(p => p.id === s.plant.id ? { ...p, status: "Inactive" } : p) }));
            config.refreshOrganizationConfiguration();
        }
        s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(next));
        expect(s.policy.resolveFactoryPerson(s.users[0].id, s.context).canAuditZone).toBe(false);
        expect(s.state.getAccessV3State().auditorGrants.find(g => g.id === s.grant.id)?.status).toBe("Active");
    });
    it.each(["superAdmin", "zoneLeader", "forged"])("denies %s grant authority without partial writes", async (kind) => {
        const s = await setup();
        if (kind === "superAdmin")
            s.current.setDemoRole("superAdmin");
        if (kind === "clientAdmin") {
            const next = structuredClone(s.state.getAccessV3State());
            next.factoryAdmins = [];
            s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(next));
        }
        if (kind === "zoneLeader")
            s.select(s.users[0].id);
        const before = [...s.values];
        expect(() => s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [s.zones[1].id], kind === "forged" ? s.users[1].id : undefined)).toThrow();
        expect([...s.values]).toEqual(before);
    });
    it("rejects duplicate and ambiguous grants; explicit scope changes are attributed", async () => {
        const s = await setup();
        expect(() => s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, s.zones.map(z => z.id))).toThrow(/already/);
        s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [s.zones[1].id]);
        const event = s.state.getAccessV3State().events.at(-1)!;
        expect(event.operation).toBe("auditor.scopeChanged");
        expect(event.actorId).toBe(s.ca.id);
        expect(event.before).toMatchObject({ id: s.grant.id });
        const next = structuredClone(s.state.getAccessV3State());
        next.auditorGrants.push({ ...next.auditorGrants[0], id: "DUPLICATE" });
        s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(next));
        expect(s.policy.resolveFactoryPerson(s.users[0].id, s.context).grantEffective).toBe(false);
        expect(() => s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [s.zones[2].id])).toThrow(/Ambiguous/);
    });
    it("excludes every leadership Zone and uses factory/Zone IDs across identical names", async () => {
        const s = await setup();
        s.commands.saveFactoryUser(s.organization.id, s.plant.id, { userId: s.users[0].id, baseRole: "Zone Leader", zoneIds: [s.zones[0].id, s.zones[2].id] });
        for (const zone of [s.zones[0], s.zones[2]])
            expect(s.policy.resolveFactoryPerson(s.users[0].id, { ...s.context, zoneId: zone.id }).canAuditZone).toBe(false);
        expect(s.policy.resolveFactoryPerson(s.users[0].id, s.context).canAuditZone).toBe(true);
        const configuration = await import("@/lib/organization-store");
        const originalConfiguration = configuration.getAllOrganizationConfiguration();
        s.storage.setItem("ops-organization-configuration-v1", JSON.stringify({ ...originalConfiguration, zones: originalConfiguration.zones.map(z => z.id === s.zones[1].id ? { ...z, leaderId: s.users[0].id } : z) }));
        expect(s.policy.resolveFactoryPerson(s.users[0].id, s.context).canAuditZone).toBe(false);
        s.storage.setItem("ops-organization-configuration-v1", JSON.stringify(originalConfiguration));
        s.current.setDemoRole("superAdmin");
        const plant = s.commands.saveFactory(s.organization.id, { name: "Factory Two", code: "TWO", location: "Test", maximumActiveUsers: 30 });
        s.current.setAdministrationDemoIdentity(s.ca.id);
        s.commands.assignFactoryAdministrator(s.organization.id, plant.id, s.ca.id);
        const a = s.commands.saveFactoryZone(s.organization.id, plant.id, { name: "Zone A", code: "A", department: "Production" });
        const b = s.commands.saveFactoryZone(s.organization.id, plant.id, { name: "Zone B", code: "B", department: "Production" });
        s.commands.saveFactoryUser(s.organization.id, plant.id, { userId: s.users[0].id, baseRole: "Zone Leader", zoneIds: [b.id] });
        expect(s.policy.resolveFactoryPerson(s.users[0].id, { organizationId: s.organization.id, plantId: plant.id, zoneId: a.id }).canAuditZone).toBe(false);
        s.commands.saveAuditorAuthorization(s.organization.id, plant.id, s.users[0].id, [a.id]);
        expect(s.policy.resolveFactoryPerson(s.users[0].id, { organizationId: s.organization.id, plantId: plant.id, zoneId: a.id }).canAuditZone).toBe(true);
        expect(() => s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [a.id])).toThrow();
    });
    it("denies foreign-client people and factories without disclosing their assignments", async () => {
        const s = await setup();
        s.current.setDemoRole("superAdmin");
        const foreign = s.commands.saveClientProfile({ name: "Foreign client", industry: "Other" });
        const person = await provisionedClientAdministrator(foreign.id);
        s.select();
        const before = [...s.values];
        expect(() => s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, person.id, [s.zones[1].id])).toThrow();
        expect(() => s.commands.unfinishedAuditorAssignments(person.id, foreign.id, "foreign")).toThrow();
        expect([...s.values]).toEqual(before);
    });
});
describe("Phase 2 Audit command boundaries", () => {
    it("schedules with canonical labels and an explicit assignment; excludes own Zones and noneligible people", async () => {
        const s = await setup();
        const audit = s.create();
        expect(audit.status).toBe("Scheduled");
        expect(audit.auditor).toBe(s.users[0].name);
        expect(audit.assignedAuditorId).toBe(s.users[0].id);
        expect(audit.assignmentHistory?.[0].actorId).toBe(s.ca.id);
        const unsigned = s.audits.createFiveSAudit({ ...audit, auditorSignature: { userId: s.users[0].id, userName: s.users[0].name, signedAt: "Forged", signatureImage: "Forged" }, completedAt: "Forged" }, { startNow: false });
        expect(unsigned.auditorSignature).toBeUndefined(); expect(unsigned.completedAt).toBeUndefined();
        expect(s.auditPolicy.eligibleAuditAssignees(s.context).map(p => p.id)).toEqual(expect.arrayContaining([s.users[0].id, s.users[1].id]));
        expect(() => s.create(s.zones[0].id)).toThrow();
        expect(() => s.create(s.zones[1].id, s.users[2].id)).toThrow();
        s.select(s.users[0].id);
        expect(() => s.create()).toThrow();
    });
    it("permits the assigned authorized auditor to start and save, without broad module permissions", async () => {
        const s = await setup();
        const audit = s.create();
        s.select(s.users[0].id);
        const started = s.audits.startScheduledFiveSAudit(audit.id)!;
        expect(started.status).toBe("In Progress");
        expect(s.audits.saveFiveSAuditDraft(audit.id, started.sections)?.sections).toEqual(started.sections);
        expect(s.directory.getAdminUser(s.users[0].id)?.permissions).toEqual([]);
        expect(() => s.audits.updateFiveSAudit(audit.id, { assignedAuditorId: s.users[1].id })).toThrow();
        expect(() => s.audits.updateFiveSAudit(audit.id, { status: "Scheduled" })).toThrow();
        expect(() => s.audits.updateFiveSAudit(audit.id, { auditorSignature: { userId: s.ca.id, userName: "Fake", signedAt: "now", signatureImage: "fake" } })).toThrow();
    });
    it.each(["unassigned", "inactive"])("denies %s execution without answers, signatures, evidence, events or transitions", async (kind) => {
        const s = await setup();
        const audit = s.create();
        s.select(s.users[0].id);
        s.audits.startScheduledFiveSAudit(audit.id);
        s.select();
        if (kind === "revoked")
            s.commands.revokeAuditorAuthorization(s.grant.id);
        if (kind === "inactive" || kind === "ownZone" || kind === "roleChanged")
            s.commands.saveFactoryUser(s.organization.id, s.plant.id, { userId: s.users[0].id, baseRole: kind === "roleChanged" ? "Zone Member" : "Zone Leader", status: kind === "inactive" ? "Inactive" : "Active", zoneIds: [kind === "ownZone" ? s.zones[1].id : s.zones[0].id] });
        if (kind === "wrongZone")
            s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [s.zones[2].id]);
        s.select(kind === "unassigned" ? s.users[1].id : s.users[0].id);
        const before = [...s.values];
        expect(() => s.audits.updateFiveSAudit(audit.id, { sections: s.sections, auditorSignature: { userId: s.users[0].id, userName: "Fake", signedAt: "now", signatureImage: "fake" } })).toThrow();
        try {
            s.audits.saveFiveSAuditDraft(audit.id, s.sections);
        }
        catch { /* denial */ }
        expect(s.audits.completeFiveSAudit(audit.id, s.sections)).toBeUndefined();
        await expect(s.audits.persistFiveSAuditEvidence(audit.id, s.sections[0].questions[0].evidence![0])).rejects.toThrow();
        const evidenceStorage = await import("@/lib/five-s/audit-evidence-storage");
        await expect(evidenceStorage.persistAuditEvidence(s.sections[0].questions[0].evidence![0], audit.id)).rejects.toThrow();
        await expect(evidenceStorage.persistAuditEvidence(s.sections[0].questions[0].evidence![0])).rejects.toThrow();
        expect([...s.values]).toEqual(before);
    });
    it("permits FA direct execution without a base role/grant, denies a different factory, and preserves completion requirements", async () => {
        const s = await setup();
        const audit = s.create(s.zones[0].id, s.ca.id, true);
        expect(audit.status).toBe("In Progress");
        expect(s.policy.resolveFactoryPerson(s.ca.id, s.context).grant).toBeUndefined();
        expect(s.audits.canCompleteFiveSAudit(audit)).toBe(true);
        expect(s.audits.completeFiveSAudit(audit.id, audit.sections)).toBeUndefined();
        s.audits.updateFiveSAudit(audit.id, { auditorSignature: { userId: s.ca.id, userName: s.ca.name, signedAt: new Date().toISOString(), signatureImage: "data:image/png;base64,AA==" } });
        expect(s.audits.completeFiveSAudit(audit.id, audit.sections)?.status).toBe("Completed");
        s.current.setDemoRole("superAdmin");
        const plant = s.commands.saveFactory(s.organization.id, { name: "Factory Two", code: "TWO", location: "Test", maximumActiveUsers: 30 });
        s.current.setAdministrationDemoIdentity(s.ca.id);
        expect(s.policy.resolveFactoryPerson(s.ca.id, { organizationId: s.organization.id, plantId: plant.id }).factoryAdmin).toBe(false);
        expect(() => s.audits.createFiveSAudit({ ...audit, plantId: plant.id }, { startNow: true })).toThrow();
    });
    it("reassigns explicitly after revocation, preserving history, signatures, evidence, status, IDs and relationships", async () => {
        const s = await setup();
        const audit = s.create();
        s.select(s.users[0].id);
        s.audits.startScheduledFiveSAudit(audit.id);
        const signature = { userId: s.users[0].id, userName: s.users[0].name, signedAt: "2026-01-01", signatureImage: "historical" };
        s.audits.updateFiveSAudit(audit.id, { auditorSignature: signature });
        s.select();
        const before = s.audits.getFiveSAuditById(audit.id)!;
        s.commands.revokeAuditorAuthorization(s.grant.id);
        expect(s.audits.getFiveSAuditById(audit.id)).toEqual(before);
        expect(s.state.getAccessV3State().events.at(-1)?.after).toMatchObject({ affectedAssignments: [{ id: audit.id, zoneId: s.zones[1].id, status: "In Progress" }] });
        const next = s.audits.reassignFiveSAudit(audit.id, s.users[1].id, "Grant revoked; explicit reassignment");
        expect(next).toMatchObject({ id: before.id, status: before.status, sections: before.sections, auditorSignature: signature });
        expect(next.assignmentHistory?.at(-1)).toMatchObject({ actorId: s.ca.id, previousAuditorId: s.users[0].id, auditorId: s.users[1].id, reason: "Grant revoked; explicit reassignment" });
        s.select(s.users[0].id);
        expect(() => s.audits.updateFiveSAudit(audit.id, { score: 0 })).toThrow();
        s.select(s.users[1].id);
        expect(s.audits.saveFiveSAuditDraft(audit.id, next.sections)?.id).toBe(audit.id);
        s.audits.updateFiveSAudit(audit.id, { auditorSignature: { ...signature, userId: s.users[1].id, userName: s.users[1].name } });
        expect(s.audits.getFiveSAuditById(audit.id)?.signatureHistory).toContainEqual(signature);
    });
    it("failed/ineligible reassignment preserves the entire original collection and emits no success", async () => {
        const s = await setup();
        const audit = s.create();
        const before = [...s.values];
        expect(() => s.audits.reassignFiveSAudit(audit.id, s.users[2].id, "Invalid")).toThrow();
        expect([...s.values]).toEqual(before);
        const original = s.storage.setItem;
        s.storage.setItem = (key, value) => { if (key === s.state.ACCESS_V3_KEY)
            throw new Error("Quota"); original(key, value); };
        expect(() => s.audits.reassignFiveSAudit(audit.id, s.users[1].id, "Valid")).toThrow(/recovery/);
        expect(s.audits.getFiveSAuditById(audit.id)?.assignedAuditorId).toBe(s.users[0].id);
        expect(() => s.audits.startScheduledFiveSAudit(audit.id)).toThrow();
        s.storage.setItem = original;
        s.current.setDemoRole("superAdmin");
        s.commands.recoverAdministrationTransaction();
        s.select();
        expect(s.audits.getFiveSAuditById(audit.id)?.assignedAuditorId).toBe(s.users[0].id);
        expect(s.state.getAccessV3State().events.some(e => e.operation === "audit.reassigned")).toBe(false);
    });
    it("denies unassigned Start, forged execution identity, generic linked Action changes and reset bypasses", async () => {
        const s = await setup();
        const audit = s.create();
        s.select(s.users[1].id);
        const before = [...s.values];
        expect(() => s.audits.startScheduledFiveSAudit(audit.id)).toThrow();
        expect([...s.values]).toEqual(before);
        s.select(s.users[0].id);
        s.audits.startScheduledFiveSAudit(audit.id);
        const started = s.audits.getFiveSAuditById(audit.id)!;
        const unchanged = [...s.values];
        expect(() => s.audits.updateFiveSAudit(audit.id, { score: 0 }, { id: s.ca.id })).toThrow();
        const injected = structuredClone(started.sections);
        injected[0].questions[0].actionId = "FORGED-ACTION";
        expect(() => s.audits.saveFiveSAuditDraft(audit.id, injected)).toThrow();
        expect(() => s.audits.resetFiveSAudits()).toThrow();
        expect(() => s.audits.clearFiveSAuditStorage()).toThrow();
        expect(() => s.audits.setFiveSAudits([])).toThrow();
        expect([...s.values]).toEqual(unchanged);
    });
    it("rejects invalid schedules before reserving IDs and denies foreign-factory scheduling", async () => {
        const s = await setup();
        const audit = s.create();
        const original = [...s.values];
        expect(() => s.audits.createFiveSAudit({ ...audit, scheduledDate: "", scheduledTime: "" }, { startNow: false })).toThrow();
        expect([...s.values]).toEqual(original);
        s.current.setDemoRole("superAdmin");
        const second = s.commands.saveFactory(s.organization.id, { name: "Unassigned factory", code: "NO", location: "Test", maximumActiveUsers: 30 });
        s.current.setAdministrationDemoIdentity(s.ca.id);
        expect(() => s.audits.createFiveSAudit({ ...audit, plantId: second.id }, { startNow: false })).toThrow();
    });
    it("reacts to person deactivation without deleting history", async () => {
        const s = await setup();
        const audit = s.create();
        s.select(s.users[0].id);
        s.audits.startScheduledFiveSAudit(audit.id);
        const people = s.directory.getAdminUsers().map(p => p.id === s.users[0].id ? { ...p, status: "Inactive" } : p);
        s.storage.setItem("five-s-administration-users-v1", JSON.stringify(people));
        expect(s.audits.getFiveSAudits()).toEqual([]);
        expect(() => s.audits.updateFiveSAudit(audit.id, { score: 0 })).toThrow();
        s.select();
        expect(s.state.getAccessV3State().auditorGrants.find(g => g.id === s.grant.id)?.status).toBe("Active");
        expect(() => s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [s.zones[1].id])).toThrow();
    });
    it("rolls back a failed Audit answer write in memory and storage", async () => {
        const s = await setup();
        const audit = s.create();
        s.select(s.users[0].id);
        s.audits.startScheduledFiveSAudit(audit.id);
        const original = s.audits.getFiveSAuditById(audit.id)!;
        const sections = structuredClone(original.sections);
        sections[0].questions[0].observation = "Must not be saved";
        const set = s.storage.setItem;
        s.storage.setItem = (key, value) => { if (key === "manufacturing-qms-five-s-audits-v1")
            throw new Error("Quota"); set(key, value); };
        expect(() => s.audits.saveFiveSAuditDraft(audit.id, sections)).toThrow();
        expect(s.audits.getFiveSAuditById(audit.id)).toEqual(original);
    });
    it("invalidates a removed authorization Zone and records a fresh grant after explicit revocation", async () => {
        const s = await setup();
        s.commands.revokeAuditorAuthorization(s.grant.id);
        const grant = s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [s.zones[1].id]);
        expect(grant.id).not.toBe(s.grant.id);
        expect(s.state.getAccessV3State().auditorGrants.find(g => g.id === s.grant.id)?.status).toBe("Revoked");
        const configuration = await import("@/lib/organization-store");
        const raw = configuration.getAllOrganizationConfiguration();
        s.storage.setItem("ops-organization-configuration-v1", JSON.stringify({ ...raw, zones: raw.zones.map(z => z.id === s.zones[1].id ? { ...z, status: "Inactive" } : z) }));
        expect(s.policy.resolveFactoryPerson(s.users[0].id, s.context).grantEffective).toBe(false);
    });
    it("rolls back a single failed reassignment write with no journal or success event left behind", async () => {
        const s = await setup();
        const audit = s.create();
        const raw = s.storage.getItem("manufacturing-qms-five-s-audits-v1");
        const events = structuredClone(s.state.getAccessV3State().events);
        const set = s.storage.setItem;
        let failed = false;
        s.storage.setItem = (key, value) => { if (key === s.state.ACCESS_V3_KEY && !failed) {
            failed = true;
            throw new Error("Quota");
        } set(key, value); };
        expect(() => s.audits.reassignFiveSAudit(audit.id, s.users[1].id, "Failed write")).toThrow(/preserved/);
        expect(s.storage.getItem("manufacturing-qms-five-s-audits-v1")).toBe(raw);
        expect(s.state.getAccessV3State().events).toEqual(events);
        expect(s.storage.getItem(s.commands.ADMIN_TRANSACTION_KEY)).toBeNull();
    });
    it("uses the assigned factory's Audit subscription independently of Egmore defaults", async () => {
        const s = await setup(); const entitlements = await import("@/lib/module-entitlements"); s.current.setDemoRole("superAdmin");
        expect(entitlements.saveFactoryAccess("abc-manufacturing", "PLANT-EGM", { ...entitlements.getFactoryAccess("abc-manufacturing", "PLANT-EGM"), audit: false })).toBe(true);
        const contexts = await import("@/features/five-s/administration/access-v4-context");
        const selectFactory = () => { s.select(); contexts.selectAccessContext({ version: 1, selectionId: "", personId: s.ca.id, kind: "factory", organizationId: s.organization.id, plantId: s.plant.id }); };
        s.current.setDemoRole("superAdmin"); expect(entitlements.saveFactoryAccess(s.organization.id, s.plant.id, { ...entitlements.NEW_FACTORY_ACCESS, audit: true })).toBe(true);
        selectFactory(); expect(s.auditPolicy.canOpenScopedAuditModule()).toBe(true); const audit = s.create();
        s.current.setDemoRole("superAdmin"); expect(entitlements.saveFactoryAccess(s.organization.id, s.plant.id, { ...entitlements.getFactoryAccess(s.organization.id, s.plant.id), audit: false })).toBe(true);
        selectFactory(); expect(s.auditPolicy.canOpenScopedAuditModule()).toBe(false); expect(s.audits.getFiveSAuditById(audit.id)).toBeUndefined(); expect(() => s.create()).toThrow(/not enabled/);
    });
    it.each(["revoked", "ownZone", "wrongZone", "roleChanged"])("retains explicit assigned-member execution after %s eligibility changes", async kind => {
        const s = await setup(); const audit = s.create(); s.select(s.users[0].id); s.audits.startScheduledFiveSAudit(audit.id); s.select();
        if (kind === "revoked") s.commands.revokeAuditorAuthorization(s.grant.id);
        if (kind === "ownZone" || kind === "roleChanged") s.commands.saveFactoryUser(s.organization.id, s.plant.id, { userId: s.users[0].id, baseRole: kind === "roleChanged" ? "Zone Member" : "Zone Leader", zoneIds: [kind === "ownZone" ? s.zones[1].id : s.zones[0].id] });
        if (kind === "wrongZone") s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [s.zones[2].id]);
        s.select(s.users[0].id); const current = s.audits.getFiveSAuditById(audit.id)!;
        expect(s.auditPolicy.canExecuteScopedAudit(current)).toBe(true);
        expect(s.audits.saveFiveSAuditDraft(audit.id, current.sections)?.sections).toEqual(current.sections);
        expect(s.policy.resolveFactoryPerson(s.users[0].id, s.context).canAuditZone).toBe(false);
    });
    it("permits Client Admin administration without inheriting operational execution", async () => {
        const s = await setup(); const next = structuredClone(s.state.getAccessV3State()); next.factoryAdmins = []; s.storage.setItem(s.state.ACCESS_V3_KEY, JSON.stringify(next));
        expect(s.commands.saveAuditorAuthorization(s.organization.id, s.plant.id, s.users[0].id, [s.zones[1].id]).updatedBy).toBe(s.ca.id);
        expect(s.policy.resolveFactoryPerson(s.ca.id, s.context).factoryAdmin).toBe(false);
    });
    it("does not reveal unassigned-factory audits via list, detail or report store projections", async () => { const s = await setup(); const audit = s.create(); s.current.setDemoRole("auditor"); expect(s.audits.getFiveSAudits().some(a => a.id === audit.id)).toBe(false); expect(s.audits.getFiveSAuditById(audit.id)).toBeUndefined(); s.select(s.users[2].id); expect(s.audits.getFiveSAudits()).toEqual([]); });
});
