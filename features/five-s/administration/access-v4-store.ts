"use client";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { getOrganizations } from "@/lib/organizations";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
import { readAdministrationPayload, ADMINISTRATION_JOURNAL_KEY } from "@/lib/administration-storage";
import { commitAdministrationV4, withAdministrationLock, V4_STORAGE_KEY, recoverAdministrationV4Storage } from "@/lib/administration-v4-storage";
import { getAdminUsers } from "./store";
import { ACCESS_V3_KEY, getAccessV3State, notifyAccessV3 } from "./access-v3-state";
import { decodeAccessV4, getAccessV4State, notifyAccessV4, type AccessV4State, type PersistedAssignment, type PersistedDepartment } from "./access-v4-state";
import { requireAccessContext, isDepartmentLeader } from "./access-v4-context";
import { resolveFactoryPerson } from "./factory-authorization";
import { validateDepartmentDefinition, validateProposedRoleAssignment } from "./access-v4-compatibility";
import type { OrganizationalCatalog, IndependentAssignment } from "./access-v4-validators";
import type { FactoryScope } from "./access-v4-models";
export interface V4WriteExpectation { revision: number; selectionId: string }
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const fail = (message: string): never => { throw new Error(message); };
const READ_KEYS = [ACCESS_V3_KEY, V4_STORAGE_KEY, "five-s-administration-users-v1", "ops-organization-configuration-v1", "5s-auth-session", "five-s-demo-role", "ops-administration-demo-person-v1", "ops-active-access-context-v1"];
function readSet() { return new Map(READ_KEYS.map(k => [k, window.localStorage.getItem(k)])); }
function currentPerson() {
  const actor = getAuthenticatedDemoActor();
  if (!actor) return fail("An active authenticated session is required.");
  const raw = readAdministrationPayload("five-s-administration-users-v1");
  const people = raw ? JSON.parse(raw) as ReturnType<typeof getAdminUsers> : getAdminUsers();
  if (!Array.isArray(people) || (people.filter(p => p.id === actor.user.id).length !== 1 || people.find(p => p.id === actor.user.id)?.status !== "Active")) return fail("Canonical actor is inactive or ambiguous.");
  return actor;
}
function authorize(scope: FactoryScope, expected: V4WriteExpectation, departmentId?: string, memberOnly = false) {
  requireAccessContext(expected.selectionId, scope, "factory");
  const actor = currentPerson();
  const p = resolveFactoryPerson(actor.user.id, scope);
  if (!p.clientAdmin && !p.factoryAdmin && !(memberOnly && departmentId && isDepartmentLeader(actor.user.id, departmentId, scope.organizationId, scope.plantId))) fail("Client Admin, Factory Admin or an eligible Department Leader assignment is required.");
  return actor;
}
function catalog(s: AccessV4State): OrganizationalCatalog {
  const raw = readAdministrationPayload("ops-organization-configuration-v1");
  const config = raw ? JSON.parse(raw) as ReturnType<typeof getAllOrganizationConfiguration> : getAllOrganizationConfiguration();
  const peopleRaw = readAdministrationPayload("five-s-administration-users-v1");
  const people = peopleRaw ? JSON.parse(peopleRaw) as ReturnType<typeof getAdminUsers> : getAdminUsers();
  if (!Array.isArray(config.plants) || !Array.isArray(config.zones) || !Array.isArray(people)) return fail("Invalid canonical directory or factory configuration.");
  return { clients: getOrganizations(), factories: config.plants.map(p => ({ ...p, organizationId: p.organizationId ?? "abc-manufacturing" })), zones: config.zones, departments: s.departments, people };
}
function event(s: AccessV4State, scope: { organizationId: string; plantId?: string }, actorId: string, operation: string, targetId: string, before: unknown, after: unknown, reason?: string) {
  s.events.push({ id: uid("ADM"), organizationId: scope.organizationId, plantId: scope.plantId, actorId, operation, targetId, before, after, reason, at: new Date().toISOString() });
}
async function mutate<T>(expected: V4WriteExpectation, permission: () => ReturnType<typeof currentPerson>, change: (s: AccessV4State, actorId: string) => T): Promise<T> {
  return withAdministrationLock(() => {
    const actor = permission();
    const reads = readSet();
    const current = getAccessV4State();
    if (current.revision !== expected.revision) return fail("Revision conflict. Reload and review before retrying.");
    const next = structuredClone(current);
    const result = change(next, actor.user.id);
    next.revision += 1;
    const after = JSON.stringify(next);
    decodeAccessV4(after);
    commitAdministrationV4([{ key: V4_STORAGE_KEY, before: reads.get(V4_STORAGE_KEY) ?? null, after }], reads, () => { permission(); });
    notifyAccessV4();
    return result;
  });
}
export function saveDepartment(scope: FactoryScope & { zoneId: string }, input: { id?: string; name: string; code: string; status: "Active" | "Inactive" }, expected: V4WriteExpectation) {
  return mutate(expected, () => authorize(scope, expected), (s, actorId) => {
    const old = input.id ? s.departments.find(d => d.id === input.id) : undefined;
    if (input.id && !old) return fail("Unknown Department ID.");
    if (old && (old.organizationId !== scope.organizationId || old.plantId !== scope.plantId || old.zoneId !== scope.zoneId)) return fail("Department parent scope is immutable.");
    if (!["Active", "Inactive"].includes(input.status)) return fail("Invalid Department lifecycle.");
    if (old?.status === "Active" && input.status === "Inactive") return fail(DEPENDENCY_BLOCKER);
    const at = new Date().toISOString();
    const item: PersistedDepartment = { ...(old ?? { id: uid("DEPT"), createdBy: actorId, createdAt: at }), organizationId: scope.organizationId, plantId: scope.plantId, zoneId: scope.zoneId, name: input.name.trim(), code: input.code.trim(), status: input.status, updatedBy: actorId, updatedAt: at, revision: (old?.revision ?? 0) + 1 };
    const departmentCatalog = catalog(s);
    if (departmentCatalog.clients.filter(c => c.id === scope.organizationId && c.status === "Active").length !== 1 || departmentCatalog.factories.filter(p => p.id === scope.plantId && p.organizationId === scope.organizationId && p.status === "Active").length !== 1 || departmentCatalog.zones.filter(z => z.id === scope.zoneId && z.plantId === scope.plantId && z.status === "Active").length !== 1) return fail("An active canonical parent chain is required.");
    const validation = validateDepartmentDefinition(item, departmentCatalog, s.departments.filter(d => d.id !== item.id));
    if (!validation.valid) return fail(`Department validation: ${validation.violations.map(v => v.code).join(", ")}`);
    s.departments = [...s.departments.filter(d => d.id !== item.id), item];
    event(s, scope, actorId, old ? "department.updated" : "department.created", item.id, old, item);
    return item;
  });
}
export const DEPENDENCY_BLOCKER = "Deactivation/revocation is blocked: the unfinished-work dependency index does not yet cover all OPS modules. No work or historical assignment was changed.";
export function assignV4Role(scope: FactoryScope & { zoneId?: string; departmentId?: string }, role: PersistedAssignment["role"], personId: string, expected: V4WriteExpectation) {
  return mutate(expected, () => authorize(scope, expected, scope.departmentId, role === "Department Member"), (s, actorId) => {
    const p = resolveFactoryPerson(personId, scope);
    if (!p.valid || !p.membership) return fail("An active, unambiguous client and factory membership is required.");
    const item = { id: uid("ROLE"), organizationId: scope.organizationId, plantId: scope.plantId, ...(scope.zoneId !== undefined ? { zoneId: scope.zoneId } : {}), ...(scope.departmentId !== undefined ? { departmentId: scope.departmentId } : {}), role, personId, status: "Active", assignedBy: actorId, assignedAt: new Date().toISOString(), revision: 1 } as PersistedAssignment;
    const c = catalog(s);
    if (scope.zoneId && p.allocations.some(a => a.zoneId !== scope.zoneId)) return fail("Existing Zone allocations conflict; no cross-Zone move is permitted.");
    const actor = resolveFactoryPerson(actorId, scope);
    if (!actor.clientAdmin && !actor.factoryAdmin && role === "Department Member" && !p.allocations.some(a => a.zoneId === scope.zoneId) && !s.assignments.some(a => a.personId === personId && a.status === "Active" && a.plantId === scope.plantId && a.organizationId === scope.organizationId && a.zoneId === scope.zoneId)) return fail("Department Leaders may allocate only existing same-Zone people; request administrator review for unallocated people.");
    // Read legacy leadership for conflict detection, without converting or changing it.
    const legacy: IndependentAssignment[] = getAccessV3State().zoneAllocations.filter(a => a.status === "Active" && a.responsibility === "Leader").map(a => ({ ...a, personId: a.userId, role: "Zone Leader" }));
    for (const z of getAllOrganizationConfiguration().zones.filter(z => z.leaderId && z.status === "Active")) {
      const factory = c.factories.find(p => p.id === z.plantId);
      if (factory) legacy.push({ id: `legacy-zone:${z.id}`, personId: z.leaderId, organizationId: factory.organizationId, plantId: z.plantId, zoneId: z.id, role: "Zone Leader", status: "Active" });
    }
    // Same Zone legacy leadership is compatible with an explicit v4 row; different Zone is not.
    const conflicts = legacy.filter(a => !(role === "Zone Leader" && a.personId === personId && a.zoneId === scope.zoneId && a.plantId === scope.plantId));
    const validation = validateProposedRoleAssignment({ catalog: c, proposed: item, existing: [...s.assignments, ...conflicts], eligibility: [{ ...scope, assignmentId: item.id, personId, role, eligible: true }] });
    if (!validation.valid) return fail(`Assignment validation: ${validation.violations.map(v => v.code).join(", ")}`);
    s.assignments.push(item);
    event(s, scope, actorId, "role.assigned", item.id, undefined, item);
    return item;
  });
}
export function revokeV4Role(scope: FactoryScope, assignmentId: string, reason: string, expected: V4WriteExpectation): Promise<never> {
  return withAdministrationLock(() => {
    const s = getAccessV4State(); const a = s.assignments.find(a => a.id === assignmentId && a.organizationId === scope.organizationId && a.plantId === scope.plantId);
    if (!a || a.status !== "Active") return fail("Active assignment not found.");
    authorize(scope, expected, a.departmentId, a.role === "Department Member");
    if (s.revision !== expected.revision) return fail("Revision conflict.");
    if (!reason.trim()) return fail("A revocation reason is required.");
    return fail(DEPENDENCY_BLOCKER);
  });
}
export function attachPersonToClient(input: { personId: string; organizationId: string; confirmedPersonId: string; reason: string; expectedV3Payload: string | null; expectedDirectoryPayload?: string | null; identityConfirmation?: { email: string; employeeId: string } }, expected: V4WriteExpectation) {
  const permission = () => {
    requireAccessContext(expected.selectionId, { organizationId: input.organizationId }, "platform");
    const a = currentPerson();
    if (!a.identity.isSuperAdmin || a.user.id !== "USR-OPS-SUPER-ADMIN") return fail("Only Metric Mind Super Admin may attach an existing identity.");
    return a;
  };
  return withAdministrationLock(() => {
    const actor = permission(); const reads = readSet(); const state = getAccessV3State(); const v4 = getAccessV4State();
    if (v4.revision !== expected.revision || reads.get(ACCESS_V3_KEY) !== input.expectedV3Payload) return fail("Revision conflict. Review current memberships before attaching.");
    if (input.expectedDirectoryPayload !== undefined && reads.get("five-s-administration-users-v1") !== input.expectedDirectoryPayload) return fail("Directory revision conflict. Repeat the identity review.");
    if (input.identityConfirmation) {
      const raw = readAdministrationPayload("five-s-administration-users-v1");
      const directory = raw ? JSON.parse(raw) as ReturnType<typeof getAdminUsers> : getAdminUsers();
      const reviewed = directory.filter(p => p.id === input.personId);
      if (reviewed.length !== 1 || !input.identityConfirmation.email.trim() || !input.identityConfirmation.employeeId.trim() || reviewed[0].email.trim().toLowerCase() !== input.identityConfirmation.email.trim().toLowerCase() || reviewed[0].employeeId.trim().toLowerCase() !== input.identityConfirmation.employeeId.trim().toLowerCase()) return fail("Canonical contact confirmation does not match the reviewed identity.");
    }
    const c = catalog(v4); const people = c.people.filter(p => p.id === input.personId);
    if (input.personId === "USR-OPS-SUPER-ADMIN" || people.length !== 1 || people[0]?.status !== "Active" || input.confirmedPersonId !== input.personId || !input.reason.trim()) return fail("Confirm the exact active canonical person ID and provide a reason.");
    if ((c.clients.filter(o => o.id === input.organizationId).length !== 1 || c.clients.find(o => o.id === input.organizationId)?.status !== "Active")) return fail("Select an active canonical client.");
    if (state.clientMemberships.some(m => m.userId === input.personId && m.organizationId === input.organizationId)) return fail("Existing or inactive membership requires review; attachment cannot overwrite it.");
    if ([...state.factoryMemberships, ...state.factoryAdmins, ...state.zoneAllocations, ...state.auditorGrants].some(r => r.userId === input.personId && r.organizationId === input.organizationId) || v4.assignments.some(r => r.personId === input.personId && r.organizationId === input.organizationId)) return fail("Dormant target-client assignments require review before attachment.");
    const at = new Date().toISOString(); const membership = { id: uid("CM"), userId: input.personId, organizationId: input.organizationId, status: "Active" as const, clientAdmin: false, assignedBy: actor.user.id, assignedAt: at, updatedAt: at };
    const next = structuredClone(state); next.clientMemberships.push(membership);
    const nextV4 = structuredClone(v4); nextV4.revision += 1;
    event(nextV4, input, actor.user.id, "person.clientAttached", membership.id, undefined, membership, input.reason.trim());
    next.events.push({ id: uid("ADM"), actorId: actor.user.id, organizationId: input.organizationId, targetId: membership.id, operation: "person.clientAttached", at, after: { membership, reason: input.reason.trim(), ...(input.identityConfirmation ? { identityReview: { personId: input.personId, email: input.identityConfirmation.email.trim(), employeeId: input.identityConfirmation.employeeId.trim(), confirmedBy: actor.user.id, confirmedAt: at } } : {}) } });
    commitAdministrationV4([{ key: ACCESS_V3_KEY, before: reads.get(ACCESS_V3_KEY) ?? null, after: JSON.stringify(next) }, { key: V4_STORAGE_KEY, before: reads.get(V4_STORAGE_KEY) ?? null, after: JSON.stringify(nextV4) }], reads, () => { permission(); });
    notifyAccessV3(); notifyAccessV4(); return membership;
  });
}
export async function recoverV4Administration() {
  return withAdministrationLock(() => {
    const a = currentPerson();
    if (!a.identity.isSuperAdmin || a.user.id !== "USR-OPS-SUPER-ADMIN") return fail("Platform Super Admin recovery is required.");
    if (window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY)) recoverAdministrationV4Storage();
    notifyAccessV3(); notifyAccessV4();
  });
}
