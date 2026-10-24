import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessV3State } from "@/features/five-s/administration/access-v3-types";
import type { AdminUser } from "@/features/five-s/administration/types";
import type { OrganizationPlant, OrganizationZone } from "@/lib/organization-store";
import type { FiveSAudit } from "@/features/five-s/types/five-s";
import { validateIndependentRoleAssignment } from "@/features/five-s/administration/access-v4-validators";

// Node-only dependency injection: real v3 policy bodies, synthetic read snapshots.
// No browser global, storage adapter, real directory, store mutation or session is used.
const fixture = vi.hoisted(() => ({
  people: [] as AdminUser[], plants: [] as OrganizationPlant[], zones: [] as OrganizationZone[],
  state: {} as AccessV3State, actorId: "FA",
}));
vi.mock("@/features/five-s/administration/store", () => ({
  getAdminUsers: () => fixture.people,
  getAdminUser: (id: string) => fixture.people.find(p => p.id === id),
}));
vi.mock("@/features/five-s/administration/access-v3-state", () => ({ getAccessV3State: () => fixture.state }));
vi.mock("@/lib/organization-store", () => ({ getAllOrganizationConfiguration: () => ({ plants: fixture.plants, zones: fixture.zones }) }));
vi.mock("@/lib/organizations", () => ({ DEMO_ORGANIZATION: { id: "LEGACY" }, getOrganizations: () => fixture.state.clients }));
vi.mock("@/lib/administration-storage", () => ({
  ADMINISTRATION_JOURNAL_KEY: "unused-test-journal",
  readAdministrationPayload: (key: string) => {
    if (key === "five-s-administration-users-v1") return JSON.stringify(fixture.people);
    if (key === "ops-organization-configuration-v1") return JSON.stringify({ plants: fixture.plants, zones: fixture.zones });
    throw new Error(`Unexpected storage read: ${key}`);
  },
}));
vi.mock("@/lib/demo-session", () => ({ getAuthenticatedDemoActor: (expected?: string) => {
  const user = fixture.people.find(p => p.id === fixture.actorId && p.status === "Active");
  return user && (expected === undefined || expected === user.id)
    ? { user, identity: { id: user.id, isSuperAdmin: user.id === "USR-OPS-SUPER-ADMIN" } } : undefined;
} }));
vi.mock("@/lib/current-user", () => ({ getCurrentDemoUser: () => ({ id: fixture.actorId }) }));
vi.mock("@/lib/module-entitlements", () => ({ getOrganizationAccess: (id: string) => ({ audit: id === "CLIENT" }) }));

import { resolveFactoryPerson, requireFactoryAdministrator } from "@/features/five-s/administration/factory-authorization";
import { canCreateImprovement } from "@/features/five-s/continuous-improvement/access";
import { canCreateRedTag } from "@/features/five-s/red-tag/access";
import { canExecuteScopedAudit, canReadScopedAudit } from "@/lib/five-s/audit-authorization";
const context = { organizationId: "CLIENT", plantId: "PLANT", zoneId: "ZB" };
function audit(): FiveSAudit {
  return { ...context, id: "AUDIT", assignedAuditorId: "ZL", title: "Synthetic retained Audit", plant: "Plant", department: "Production", area: "B", auditor: "ZL", status: "In Progress", score: 0, maxScore: 0, completionPercentage: 0, dueDate: "2099-01-01", sections: [],
    auditorSignature: { userId: "ZL", userName: "ZL", signedAt: "2026-01-01", signatureImage: "synthetic" },
    assignmentHistory: [{ actorId: "FA", at: "2026-01-01", previousAuditor: "", auditorId: "ZL", auditor: "ZL", reason: "Scheduled" }] };
}
beforeEach(() => {
  fixture.actorId = "FA";
  fixture.people = ["FA", "CA", "ZL", "ZM", "USR-OPS-SUPER-ADMIN"].map(id => ({ id, name: id, employeeId: `EMP-${id}`, email: `${id}@test.invalid`, status: "Active", accessModel: "v3", plant: "", roles: [], permissions: [], zoneMemberships: [], updatedAt: "2026-01-01" }));
  fixture.plants = [{ id: "PLANT", organizationId: "CLIENT", name: "Plant", code: "P", location: "", managerId: "CA", managerName: "CA", status: "Active", codeLocked: true }];
  fixture.zones = ["ZA", "ZB", "ZC"].map(id => ({ id, name: id, code: id, plantId: "PLANT", leaderId: "", leaderName: "", department: "Production", status: "Active" }));
  const stamp = { assignedBy: "FA", assignedAt: "2026-01-01", updatedAt: "2026-01-01" };
  fixture.state = {
    version: 1, clients: [{ id: "CLIENT", name: "Client", industry: "Manufacturing", plants: 1, users: 5, status: "Active", lastUpdated: "2026-01-01" }],
    clientMemberships: fixture.people.map(p => ({ ...stamp, id: `CM-${p.id}`, userId: p.id, organizationId: "CLIENT", status: "Active", clientAdmin: p.id === "CA" })),
    factoryMemberships: ["ZL", "ZM"].map(id => ({ ...stamp, id: `FM-${id}`, userId: id, organizationId: "CLIENT", plantId: "PLANT", status: "Active", baseRole: id === "ZL" ? "Zone Leader" : "Zone Member" })),
    zoneAllocations: [{ ...stamp, id: "ZA-ZL", userId: "ZL", organizationId: "CLIENT", plantId: "PLANT", zoneId: "ZA", responsibility: "Leader", status: "Active" }],
    factoryAdmins: [{ id: "FA-1", userId: "FA", organizationId: "CLIENT", plantId: "PLANT", status: "Active", assignedBy: "CA", assignedAt: "2026-01-01" }],
    auditorGrants: [{ id: "GRANT", userId: "ZL", organizationId: "CLIENT", plantId: "PLANT", zoneIds: ["ZA", "ZB", "ZC"], status: "Active", grantedBy: "FA", grantedAt: "2026-01-01" }], factoryRequests: [], events: [],
  };
});

describe("unchanged v3 policy bodies with read-only synthetic dependencies", () => {
  it("never accesses the user's browser or storage globals", () => {
    expect(typeof window).toBe("undefined");
    expect(typeof indexedDB).toBe("undefined");
    expect(resolveFactoryPerson("FA", context).factoryAdmin).toBe(true);
  });
  it("requires explicit FA independently of Client Admin, manager metadata and Super Admin", () => {
    expect(resolveFactoryPerson("CA", context)).toMatchObject({ clientAdmin: true, factoryAdmin: false });
    expect(resolveFactoryPerson("USR-OPS-SUPER-ADMIN", context)).toMatchObject({ valid: false, factoryAdmin: false });
    expect(resolveFactoryPerson("FA", context)).toMatchObject({ factoryAdmin: true, clientAdmin: false, membership: undefined });
    fixture.actorId = "CA";
    expect(() => requireFactoryAdministrator(context)).toThrow(/Factory Admin/);
  });
  it("retains the existing multi-Zone allocation representation without normalization", () => {
    fixture.state.zoneAllocations.push({ ...fixture.state.zoneAllocations[0], id: "SECOND", zoneId: "ZC" });
    const before = structuredClone(fixture.state);
    const resolved = resolveFactoryPerson("ZL", context);
    expect(resolved.allocations).toEqual(before.zoneAllocations);
    expect(resolved.canAuditZone).toBe(true);
    expect(fixture.state).toEqual(before);
  });
  it("does not infer Auditor eligibility from a ZL label", () => {
    fixture.state.auditorGrants = [];
    expect(resolveFactoryPerson("ZL", context)).toMatchObject({ zoneLeader: true, grantEffective: false, canAuditZone: false });
  });
  it("requires both eligible base role and active leadership for grants", () => {
    fixture.state.factoryMemberships[0].baseRole = "Zone Member";
    expect(resolveFactoryPerson("ZL", context).canAuditZone).toBe(false);
    fixture.state.factoryMemberships[0].baseRole = "Zone Leader";
    fixture.state.zoneAllocations[0].status = "Inactive";
    expect(resolveFactoryPerson("ZL", context).canAuditZone).toBe(false);
  });
  it("excludes all current own Zones even if included in the explicit grant", () => {
    expect(resolveFactoryPerson("ZL", { ...context, zoneId: "ZA" })).toMatchObject({ grantEffective: true, leadsZone: true, canAuditZone: false });
    expect(resolveFactoryPerson("ZL", context).canAuditZone).toBe(true);
  });
  it("continues to honor legacy Zone leaderId as an exclusion", () => {
    fixture.zones[1].leaderId = "ZL";
    const before = structuredClone(fixture.zones);
    expect(resolveFactoryPerson("ZL", context)).toMatchObject({ grantEffective: true, leadsZone: true, canAuditZone: false });
    expect(fixture.zones).toEqual(before);
  });
  it("permits FA direct scoped Audit execution without an Auditor grant or membership", () => {
    expect(canExecuteScopedAudit(audit(), "FA")).toBe(true);
    expect(canReadScopedAudit(audit())).toBe(true);
    fixture.actorId = "CA";
    expect(canExecuteScopedAudit(audit(), "CA")).toBe(false);
  });
  it("revocation invalidates future grant eligibility while retaining explicit active-member assignments and Audit history", () => {
    fixture.actorId = "ZL";
    const record = audit();
    const before = structuredClone(record);
    expect(canExecuteScopedAudit(record, "ZL")).toBe(true);
    fixture.state.auditorGrants[0].status = "Revoked";
    expect(resolveFactoryPerson("ZL", context).canAuditZone).toBe(false);
    expect(canExecuteScopedAudit(record, "ZL")).toBe(true);
    expect(fixture.state.auditorGrants).toHaveLength(1);
    expect(record).toEqual(before);
  });
  it("leaves legacy department strings and raw metadata unchanged on reads", () => {
    const before = JSON.stringify(fixture);
    resolveFactoryPerson("FA", context);
    resolveFactoryPerson("ZL", context);
    expect(fixture.zones.map(z => z.department)).toEqual(["Production", "Production", "Production"]);
    expect(JSON.stringify(fixture)).toBe(before);
  });
  it("synthetic v4 Champion construction does not expand existing module access", () => {
    fixture.actorId = "ZM";
    const before = structuredClone(fixture);
    const actor = { id: "ZM", name: "ZM", role: "Zone Member", initials: "ZM", plant: "", primaryZone: "", isSuperAdmin: false };
    expect(canCreateImprovement(fixture.people.find(p => p.id === "ZM"), actor)).toBe(false);
    expect(canCreateRedTag(fixture.people.find(p => p.id === "ZM"))).toBe(false);
    const p = { id: "SYNTHETIC", personId: "ZM", organizationId: "CLIENT", plantId: "PLANT", role: "Zone Champion" as const, status: "Active" as const };
    expect(validateIndependentRoleAssignment({
      catalog: { clients: fixture.state.clients, factories: fixture.plants.map(p => ({ ...p, organizationId: "CLIENT" })), zones: fixture.zones, departments: [], people: fixture.people },
      proposed: p, existing: [], eligibility: [{ ...p, assignmentId: p.id, eligible: true }],
    }).valid).toBe(true);
    expect(resolveFactoryPerson("ZM", context)).toMatchObject({ factoryAdmin: false, grantEffective: false, canAuditZone: false });
    expect(canExecuteScopedAudit(audit(), "ZM")).toBe(false);
    expect(canCreateImprovement(fixture.people.find(p => p.id === "ZM"), actor)).toBe(false);
    expect(canCreateRedTag(fixture.people.find(p => p.id === "ZM"))).toBe(false);
    expect(fixture).toEqual(before);
  });
});
