"use client";
import { getAccessV4State } from "./access-v4-state";
import { isDepartmentLeader } from "./access-v4-context";
import { getRecordTombstone } from "@/lib/records/record-tombstones";
import type { FiveSAudit } from "../types/five-s";
import { resolveFactoryPerson } from "./factory-authorization";
import { readAdministrationPayload, ADMINISTRATION_JOURNAL_KEY } from "@/lib/administration-storage";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { createFactoryAccessPayload, FACTORY_MODULE_ACCESS_KEY, NEW_FACTORY_ACCESS, notifyFactoryAccessChanged, removeFactoryAccessPayload, type FactoryAccessState } from "@/lib/module-entitlements";
import { DEMO_ORGANIZATION, getOrganizations, type Organization } from "@/lib/organizations";
import { getAllOrganizationConfiguration, refreshOrganizationConfiguration, type OrganizationPlant, type OrganizationZone } from "@/lib/organization-store";
import { getAdminUsers, getCanonicalAdminUsers, getOutstandingUserActions, refreshAdminDirectory } from "./store";
import { getOutstandingUserImprovements } from "../continuous-improvement/store";
import type { AdminUser } from "./types";
import { ACCESS_V3_KEY, getAccessV3State, notifyAccessV3 } from "./access-v3-state";
import { FACTORY_BASE_ROLES, type AccessV3State, type FactoryBaseRole } from "./access-v3-types";
const USERS_KEY = "five-s-administration-users-v1", CONFIG_KEY = "ops-organization-configuration-v1", DEMO_MANIFEST_KEY = "ops-final-role-demo-v1";
export const ADMIN_TRANSACTION_KEY = ADMINISTRATION_JOURNAL_KEY;
type Actor = NonNullable<ReturnType<typeof getAuthenticatedDemoActor>>;
export interface PersonInput {
    name: string;
    email: string;
    employeeId: string;
}
export interface FactoryUserInput {
    userId?: string;
    person?: PersonInput;
    baseRole: FactoryBaseRole;
    zoneIds: string[];
    status?: "Active" | "Inactive";
}
export interface FactorySeatUsage {
    activeUsers: number;
    maximumActiveUsers?: number;
    available?: number;
    configured: boolean;
    atCapacity: boolean;
}
function uid(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
function now() { return new Date().toISOString(); }
function deny(message = "You do not have administration authority for this client/factory."): never { throw new Error(message); }
function subject(expectedActorId?: string): Actor { const actor = getAuthenticatedDemoActor(expectedActorId); if (!actor)
    deny("An active authenticated administration session is required."); return actor; }
function client(id: string) { const matches = getOrganizations().filter(item => item.id === id); if (matches.length !== 1) deny("Unknown or ambiguous client ID. Preserve the original data for review."); const item = matches[0]; if (!item || item.status !== "Active")
    deny("Select an active canonical client ID."); return item; }
export function plantOrganization(plant: OrganizationPlant) { return plant.organizationId ?? DEMO_ORGANIZATION.id; }
export function getFactorySeatUsage(plantId: string): FactorySeatUsage {
    const plant = getAllOrganizationConfiguration().plants.find(item => item.id === plantId);
    if (!plant) deny("Unknown factory ID.");
    const activeUsers = new Set(getAccessV3State().factoryMemberships.filter(item => item.plantId === plantId && item.status === "Active").map(item => item.userId)).size;
    const maximumActiveUsers = plant.maximumActiveUsers;
    return { activeUsers, maximumActiveUsers, available: maximumActiveUsers === undefined ? undefined : Math.max(0, maximumActiveUsers - activeUsers), configured: maximumActiveUsers !== undefined, atCapacity: maximumActiveUsers === undefined || activeUsers >= maximumActiveUsers };
}
function factory(organizationId: string, plantId: string) { client(organizationId); const matches = getAllOrganizationConfiguration().plants.filter(item => item.id === plantId); if (matches.length !== 1) deny("Unknown or ambiguous factory ID. Preserve the original data for review."); const plant = matches[0]; if (!plant || plantOrganization(plant) !== organizationId || plant.status !== "Active")
    deny("Select an active factory belonging to this client."); return plant; }
export function isPlatformActor(actor = getAuthenticatedDemoActor()) { return Boolean(actor?.identity.isSuperAdmin && actor.user.id === "USR-OPS-SUPER-ADMIN"); }
export function hasClientAdministration(organizationId: string, userId = getAuthenticatedDemoActor()?.user.id) { return Boolean(userId && getAccessV3State().clientMemberships.some(item => item.userId === userId && item.organizationId === organizationId && item.status === "Active" && item.clientAdmin)); }
export function hasFactoryAdministration(organizationId: string, plantId: string, userId = getAuthenticatedDemoActor()?.user.id) { const s = getAccessV3State(); return Boolean(userId && s.clientMemberships.some(item => item.userId === userId && item.organizationId === organizationId && item.status === "Active") && s.factoryAdmins.some(item => item.userId === userId && item.organizationId === organizationId && item.plantId === plantId && item.status === "Active")); }
function platform(expected?: string) { const a = subject(expected); if (!isPlatformActor(a))
    deny("Only Metric Mind Super Admin can manage clients and factory approvals."); return a; }
function clientAdmin(organizationId: string, expected?: string) { const a = subject(expected); client(organizationId); if (a.identity.isSuperAdmin || !hasClientAdministration(organizationId, a.user.id))
    deny(); return a; }
function factoryAdministration(organizationId: string, plantId: string, expected?: string) { const a = subject(expected); factory(organizationId, plantId); if (a.identity.isSuperAdmin || (!hasClientAdministration(organizationId, a.user.id) && !hasFactoryAdministration(organizationId, plantId, a.user.id)))
    deny(); return a; }
export function canOpenAccessAdministration() { const a = getAuthenticatedDemoActor(); return Boolean(a && (isPlatformActor(a) || getAccessV3State().clientMemberships.some(item => item.userId === a.user.id && item.status === "Active" && item.clientAdmin) || getAccessV3State().factoryAdmins.some(item => item.userId === a.user.id && item.status === "Active" && hasFactoryAdministration(item.organizationId, item.plantId, a.user.id)))); }
export function administrationClients() { const a = subject(); return getOrganizations().filter(item => isPlatformActor(a) || hasClientAdministration(item.id, a.user.id) || getAccessV3State().factoryAdmins.some(fa => fa.organizationId === item.id && hasFactoryAdministration(item.id, fa.plantId, a.user.id))); }
export function administrationFactories(organizationId: string) { const a = subject(); client(organizationId); return getAllOrganizationConfiguration().plants.filter(item => plantOrganization(item) === organizationId && (hasClientAdministration(organizationId, a.user.id) || hasFactoryAdministration(organizationId, item.id, a.user.id))); }
function eligibleClientPerson(userId: string, organizationId: string) { const person = getCanonicalAdminUsers().find(item => item.id === userId); const member = getAccessV3State().clientMemberships.some(item => item.userId === userId && item.organizationId === organizationId && item.status === "Active"); const legacyDemo = person?.accessModel !== "v3" && organizationId === DEMO_ORGANIZATION.id && getAllOrganizationConfiguration().plants.some(p => plantOrganization(p) === organizationId && p.name === person?.plant); return person?.status === "Active" && person.id !== "USR-OPS-SUPER-ADMIN" && (member || legacyDemo) ? person : undefined; }
export function administrationPeople(organizationId: string) { const a = subject(); client(organizationId); const factories = administrationFactories(organizationId); if (!isPlatformActor(a) && !hasClientAdministration(organizationId, a.user.id) && !factories.some(p => hasFactoryAdministration(organizationId, p.id, a.user.id)))
    deny(); return getAdminUsers().filter(user => eligibleClientPerson(user.id, organizationId)); }
function payloadKeys(value: object, allowed: string[]) { if (Object.keys(value).some(key => !allowed.includes(key)))
    deny("Unexpected administration payload fields. Elevated roles and permission arrays are not accepted."); }
function newPerson(input: PersonInput, users: AdminUser[]) { payloadKeys(input, ["name", "email", "employeeId"]); if (!input.name?.trim() || !input.email?.includes("@") || !input.employeeId?.trim())
    deny("Name, valid email and Employee ID are required."); if (users.some(item => item.email.toLowerCase() === input.email.trim().toLowerCase() || item.employeeId.toLowerCase() === input.employeeId.trim().toLowerCase()))
    deny("This profile cannot be created in the current scope. Select an authorized client person or request a platform identity review."); return { id: uid("USR"), name: input.name.trim(), email: input.email.trim(), employeeId: input.employeeId.trim(), status: "Active", roles: [], permissions: [], plant: "", zoneMemberships: [], updatedAt: now(), accessModel: "v3" } satisfies AdminUser; }
function defaultClientAdministrator(clientName: string): PersonInput {
    if (clientName.trim().toLowerCase() === "iq") return { name: "IQ Manoj", email: "manoj@iq-demo.invalid", employeeId: "IQ-DEMO-CA" };
    const slug = clientName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "client";
    return { name: `${clientName.trim()} Admin`, email: `${slug}.admin@oe-demo.invalid`, employeeId: `OE-${slug.toUpperCase()}-ADMIN` };
}
function joinClient(next: AccessV3State, userId: string, organizationId: string, actorId: string) { const membership = next.clientMemberships.find(item => item.userId === userId && item.organizationId === organizationId); if (membership) {
    if (membership.status !== "Active")
        deny("Inactive client membership requires an explicit Client Admin/platform review.");
    return membership;
} const m = { id: uid("CM"), userId, organizationId, status: "Active" as const, clientAdmin: false, assignedBy: actorId, assignedAt: now(), updatedAt: now() }; next.clientMemberships.push(m); return m; }
/** Synchronous browser transaction: original payloads journaled, no subscribers until every write succeeds. */
function commit(authorize: () => Actor, organizationId: string, operation: string, targetId: string, next: AccessV3State, options: {
    plantId?: string;
    users?: AdminUser[];
    configuration?: ReturnType<typeof getAllOrganizationConfiguration>;
    demoManifest?: Record<string, unknown>;
    before?: unknown;
    after?: unknown;
    auditRecords?: FiveSAudit[];
    moduleAccess?: FactoryAccessState;
} = {}) {
    const actor = authorize();
    if (window.localStorage.getItem(ADMIN_TRANSACTION_KEY))
        deny("An interrupted administration change needs recovery. Preserve browser storage and use the platform Recovery action before retrying.");
    for (const [key, field] of [[USERS_KEY, "users"], [CONFIG_KEY, "configuration"]] as const) {
        const raw = window.localStorage.getItem(key);
        if (raw) {
            const parsed: unknown = JSON.parse(raw);
            if ((field === "users" && !Array.isArray(parsed)) || (field === "configuration" && (!parsed || typeof parsed !== "object" || !("plants" in parsed) || !("zones" in parsed) || !Array.isArray(parsed.plants) || !Array.isArray(parsed.zones))))
                deny(`Existing ${field} payload is invalid. Preserve it and restore a valid backup.`);
        }
    }
    const event = { id: uid("ADM"), actorId: actor.user.id, targetId, organizationId, plantId: options.plantId, operation, at: now(), before: options.before, after: options.after };
    const writes: Array<[
        string,
        string
    ]> = [];
    if (options.users)
        writes.push([USERS_KEY, JSON.stringify(options.users)]);
    if (options.configuration)
        writes.push([CONFIG_KEY, JSON.stringify({ ...JSON.parse(window.localStorage.getItem(CONFIG_KEY) ?? "{}"), ...options.configuration })]);
    if (options.demoManifest)
        writes.push([DEMO_MANIFEST_KEY, JSON.stringify(options.demoManifest)]);
    if (options.auditRecords) writes.push(["manufacturing-qms-five-s-audits-v1", JSON.stringify(options.auditRecords)]);
    if (options.moduleAccess) writes.push([FACTORY_MODULE_ACCESS_KEY, JSON.stringify(options.moduleAccess)]);
    const addedPeople = options.users?.filter(person => !getAdminUsers().some(existing => existing.id === person.id)) ?? [];
    const creationEvents = addedPeople.map(person => ({ ...event, id: uid("ADM"), targetId: person.id, operation: "person.created", before: undefined, after: { userId: person.id, status: person.status, accessModel: person.accessModel } }));
    writes.push([ACCESS_V3_KEY, JSON.stringify({ ...next, events: [...next.events, ...creationEvents, event] })]);
    const before = writes.map(([key]) => ({ key, value: window.localStorage.getItem(key) }));
    authorize();
    try {
        window.localStorage.setItem(ADMIN_TRANSACTION_KEY, JSON.stringify(before));
        for (const [key, value] of writes)
            window.localStorage.setItem(key, value);
        window.localStorage.removeItem(ADMIN_TRANSACTION_KEY);
    }
    catch {
        try {
            for (const item of before) {
                if (item.value === null)
                    window.localStorage.removeItem(item.key);
                else
                    window.localStorage.setItem(item.key, item.value);
            }
            window.localStorage.removeItem(ADMIN_TRANSACTION_KEY);
        }
        catch {
            throw new Error("Administration persistence failed and recovery is pending. Original payloads remain in the administration transaction journal. Do not clear browser storage.");
        }
        throw new Error("Administration change could not be saved. Original records were preserved; no success event was recorded.");
    }
    if (options.users)
        refreshAdminDirectory();
    if (options.configuration)
        refreshOrganizationConfiguration();
    if (options.moduleAccess)
        notifyFactoryAccessChanged();
    notifyAccessV3();
}
export function recoverAdministrationTransaction(expectedActorId?: string) { platform(expectedActorId); const raw = window.localStorage.getItem(ADMIN_TRANSACTION_KEY); if (!raw)
    return; const items: unknown = JSON.parse(raw); if (!Array.isArray(items) || items.some(item => !item || ![USERS_KEY, CONFIG_KEY, ACCESS_V3_KEY, DEMO_MANIFEST_KEY, FACTORY_MODULE_ACCESS_KEY, "manufacturing-qms-five-s-audits-v1"].includes(item.key) || !(item.value === null || typeof item.value === "string")))
    deny("Invalid recovery journal. Preserve it and restore a verified backup."); for (const item of items as Array<{
    key: string;
    value: string | null;
}>) {
    if (item.value === null)
        window.localStorage.removeItem(item.key);
    else
        window.localStorage.setItem(item.key, item.value);
} window.localStorage.removeItem(ADMIN_TRANSACTION_KEY); refreshAdminDirectory(); refreshOrganizationConfiguration(); notifyFactoryAccessChanged(); notifyAccessV3(); }
export function saveClientProfile(input: {
    id?: string;
    name: string;
    industry: string;
}, expectedActorId?: string) { platform(expectedActorId); payloadKeys(input, ["id", "name", "industry"]); if (!input.name?.trim() || !input.industry?.trim())
    deny("Client name and industry are required."); const old = input.id ? getOrganizations().find(item => item.id === input.id) : undefined; if (input.id && !old)
    deny("Unknown client ID."); const duplicate = getOrganizations().find(item => item.id !== input.id && item.name.toLowerCase() === input.name.trim().toLowerCase()); if (duplicate) {
        const administrators = getAccessV3State().clientMemberships.filter(item => item.organizationId === duplicate.id && item.status === "Active" && item.clientAdmin);
        const people = administrators.length === 1 ? getCanonicalAdminUsers().filter(person => person.id === administrators[0].userId && person.status === "Active") : [];
        if (!input.id && duplicate.industry.toLowerCase() === input.industry.trim().toLowerCase() && administrators.length === 1 && people.length === 1) return duplicate;
        deny("Client name already exists or its automatic administrator provisioning requires review.");
    } const item: Organization = { ...(old ?? { id: uid("ORG"), plants: 0, users: 0, status: "Active", operationalState: "Staged" }), name: input.name.trim(), industry: input.industry.trim(), lastUpdated: now() }; const next = structuredClone(getAccessV3State()); next.clients = [...next.clients.filter(client => client.id !== item.id), item];
    if (old) {
        commit(() => platform(expectedActorId), item.id, "client.updated", item.id, next, { before: old, after: item });
        return item;
    }
    const users = getCanonicalAdminUsers();
    const administrator = newPerson(defaultClientAdministrator(item.name), users);
    const membership = joinClient(next, administrator.id, item.id, "USR-OPS-SUPER-ADMIN");
    membership.clientAdmin = true;
    membership.updatedAt = now();
    commit(() => platform(expectedActorId), item.id, "client.created", item.id, next, { users: [administrator, ...users], before: undefined, after: { client: item, defaultClientAdministrator: { personId: administrator.id, membershipId: membership.id } } });
    return item;
}
export function assignClientAdministrator(organizationId: string, input: {
    userId?: string;
    person?: PersonInput;
}, expectedActorId?: string) { platform(expectedActorId); client(organizationId); void input; deny("Client Administrators are provisioned automatically when Metric Mind creates a client."); }
export function saveFactory(organizationId: string, input: {
    id?: string;
    name: string;
    code: string;
    location: string;
    description?: string;
    maximumActiveUsers?: number;
}, expectedActorId?: string) { const a = input.id ? subject(expectedActorId) : platform(expectedActorId); if (input.id && !isPlatformActor(a) && !hasClientAdministration(organizationId, a.user.id)) deny(); client(organizationId); payloadKeys(input, ["id", "name", "code", "location", "description", "maximumActiveUsers"]); const old = input.id ? factory(organizationId, input.id) : undefined; if (old && input.name.trim() !== old.name)
    deny("Factory names are retained to preserve operational references. Edit location or description instead."); if (!input.name?.trim() || !input.code?.trim())
    deny("Factory name and code are required."); if (input.maximumActiveUsers !== undefined && (!Number.isSafeInteger(input.maximumActiveUsers) || input.maximumActiveUsers < 1)) deny("Maximum active users must be a whole number greater than zero."); if (!old && input.maximumActiveUsers === undefined) deny("Set the factory maximum active users before creating it."); if (!isPlatformActor(a) && input.maximumActiveUsers !== undefined && input.maximumActiveUsers !== old?.maximumActiveUsers) deny("Only Metric Mind can change the factory user limit."); const currentUsage = old ? getFactorySeatUsage(old.id).activeUsers : 0; if (input.maximumActiveUsers !== undefined && input.maximumActiveUsers < currentUsage) deny(`The limit cannot be lower than the ${currentUsage} active factory users. Deactivate users first.`); const configuration = structuredClone(getAllOrganizationConfiguration()); if (configuration.plants.some(p => p.id !== input.id && plantOrganization(p) === organizationId && (p.code.toLowerCase() === input.code.trim().toLowerCase() || p.name.toLowerCase() === input.name.trim().toLowerCase())))
    deny("Factory name/code already exists in this client."); const item: OrganizationPlant = { ...(old ?? { id: uid("PLANT"), managerId: "", managerName: "", status: "Active", codeLocked: true }), organizationId, name: input.name.trim(), code: old?.codeLocked ? old.code : input.code.trim().toUpperCase(), location: input.location.trim(), description: input.description?.trim(), maximumActiveUsers: input.maximumActiveUsers ?? old?.maximumActiveUsers }; configuration.plants = [...configuration.plants.filter(p => p.id !== item.id), item]; commit(() => input.id ? (isPlatformActor() ? platform(expectedActorId) : clientAdmin(organizationId, expectedActorId)) : platform(expectedActorId), organizationId, old ? "factory.updated" : "factory.created", item.id, structuredClone(getAccessV3State()), { configuration, moduleAccess: old ? undefined : createFactoryAccessPayload(item.id, NEW_FACTORY_ACCESS), plantId: item.id, before: old, after: item }); return item; }
export function requestFactory(organizationId: string, input: { name: string; description?: string }, expectedActorId?: string) { const a = clientAdmin(organizationId, expectedActorId); payloadKeys(input, ["name", "description"]); const name = input.name?.trim(); if (!name) deny("Factory name is required."); const state = getAccessV3State(); if (getAllOrganizationConfiguration().plants.some(p => plantOrganization(p) === organizationId && p.name.toLowerCase() === name.toLowerCase()) || state.factoryRequests.some(r => r.organizationId === organizationId && r.status === "Pending" && r.name.toLowerCase() === name.toLowerCase())) deny("This factory already exists or has a pending request."); const next = structuredClone(state); const item = { id: uid("FREQ"), organizationId, name, description: input.description?.trim() || undefined, status: "Pending" as const, requestedBy: a.user.id, requestedAt: now() }; next.factoryRequests.push(item); commit(() => clientAdmin(organizationId, expectedActorId), organizationId, "factoryRequest.submitted", item.id, next, { after: item }); return item; }
export function decideFactoryRequest(requestId: string, decision: "Approved" | "Rejected", expectedActorId?: string) { const a = platform(expectedActorId); const state = getAccessV3State(); const request = state.factoryRequests.find(item => item.id === requestId); if (!request || request.status !== "Pending") deny("Pending factory request not found or already decided."); client(request.organizationId); const next = structuredClone(state); const item = next.factoryRequests.find(candidate => candidate.id === requestId)!; const before = structuredClone(item); item.status = decision; item.decidedBy = a.user.id; item.decidedAt = now(); let configuration: ReturnType<typeof getAllOrganizationConfiguration> | undefined; let moduleAccess: FactoryAccessState | undefined; if (decision === "Approved") { configuration = structuredClone(getAllOrganizationConfiguration()); if (configuration.plants.some(p => plantOrganization(p) === request.organizationId && p.name.toLowerCase() === request.name.toLowerCase())) deny("A factory with this name already exists. Reject this request or review the existing factory."); const base = request.name.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 8) || "FACTORY"; let code = base; let suffix = 2; while (configuration.plants.some(p => plantOrganization(p) === request.organizationId && p.code.toUpperCase() === code)) code = `${base.slice(0, 6)}${suffix++}`; const plant: OrganizationPlant = { id: uid("PLANT"), organizationId: request.organizationId, name: request.name, code, location: "", description: request.description, managerId: "", managerName: "", status: "Active", codeLocked: true, maximumActiveUsers: 25 }; configuration.plants.push(plant); item.factoryId = plant.id; moduleAccess = createFactoryAccessPayload(plant.id, NEW_FACTORY_ACCESS); } commit(() => platform(expectedActorId), request.organizationId, decision === "Approved" ? "factoryRequest.approved" : "factoryRequest.rejected", item.id, next, { configuration, moduleAccess, plantId: item.factoryId, before, after: item }); return item; }
export function assignFactoryAdministrator(organizationId: string, plantId: string, userId: string, expectedActorId?: string) { const a = clientAdmin(organizationId, expectedActorId); factory(organizationId, plantId); if (!eligibleClientPerson(userId, organizationId))
    deny("Select an active eligible person in this client."); const next = structuredClone(getAccessV3State()); joinClient(next, userId, organizationId, a.user.id); if (next.factoryAdmins.some(item => item.userId === userId && item.plantId === plantId && item.status === "Active"))
    deny("This person is already a Factory Admin."); const item = { id: uid("FA"), userId, organizationId, plantId, status: "Active" as const, assignedBy: a.user.id, assignedAt: now() }; next.factoryAdmins.push(item); commit(() => clientAdmin(organizationId, expectedActorId), organizationId, "factoryAdmin.assigned", userId, next, { plantId, after: item }); return item; }
export function revokeFactoryAdministrator(assignmentId: string, expectedActorId?: string) { const next = structuredClone(getAccessV3State()); const item = next.factoryAdmins.find(item => item.id === assignmentId); if (!item || item.status !== "Active")
    deny("Active assignment not found."); const a = clientAdmin(item.organizationId, expectedActorId); factory(item.organizationId, item.plantId); if (!next.factoryAdmins.some(other => other.id !== item.id && other.plantId === item.plantId && other.status === "Active" && eligibleClientPerson(other.userId, item.organizationId)))
    deny("Assign another active Factory Admin before revoking the last assignment. No ownership will be transferred automatically."); const before = structuredClone(item); item.status = "Inactive"; item.revokedAt = now(); item.revokedBy = a.user.id; commit(() => clientAdmin(item.organizationId, expectedActorId), item.organizationId, "factoryAdmin.revoked", item.userId, next, { plantId: item.plantId, before, after: item }); }
export function saveFactoryUser(organizationId: string, plantId: string, input: FactoryUserInput, expectedActorId?: string) { const a = factoryAdministration(organizationId, plantId, expectedActorId); payloadKeys(input, ["userId", "person", "baseRole", "zoneIds", "status"]); if (!(FACTORY_BASE_ROLES as readonly string[]).includes(input.baseRole) || !Array.isArray(input.zoneIds) || input.zoneIds.some(id => typeof id !== "string") || (input.status && !["Active", "Inactive"].includes(input.status)))
    deny("Choose only Zone Leader, Zone Member or Standard User with valid allocations."); if (Boolean(input.userId) === Boolean(input.person))
    deny("Choose an existing person or enter a new profile."); const users = getCanonicalAdminUsers(); const person = input.person ? newPerson(input.person, users) : eligibleClientPerson(input.userId!, organizationId); if (!person)
    deny("The person is not eligible in this client. Cross-client profiles are private; request a reviewed platform assignment."); const zones = getAllOrganizationConfiguration().zones; if (input.zoneIds.some(id => zones.filter(z => z.id === id).length !== 1 || !zones.some(z => z.id === id && z.plantId === plantId && z.status === "Active")))
    deny("Select canonical active Zones in this factory."); const next = structuredClone(getAccessV3State()); joinClient(next, person.id, organizationId, a.user.id); const old = next.factoryMemberships.find(m => m.userId === person.id && m.plantId === plantId); const before = old ? structuredClone(old) : undefined; const inactive = input.status === "Inactive"; const activatesSeat = !inactive && old?.status !== "Active"; if (activatesSeat) { const usage = getFactorySeatUsage(plantId); if (!usage.configured) deny("This factory user limit is not configured. Metric Mind must set a limit before another user can be activated."); if (usage.atCapacity) deny(`This factory has reached its active user limit (${usage.activeUsers} of ${usage.maximumActiveUsers}). Deactivate a factory user or ask Metric Mind to increase the limit.`); } if (inactive && (getOutstandingUserActions(person.id).length || getOutstandingUserImprovements(person.id).length || next.factoryAdmins.some(fa => fa.userId === person.id && fa.plantId === plantId && fa.status === "Active")))
    deny("Resolve outstanding work and Factory Admin authority before deactivating this membership. No transfer is automatic."); const time = now(); const m = { id: old?.id ?? uid("FM"), userId: person.id, organizationId, plantId, baseRole: input.baseRole, status: input.status ?? "Active" as const, assignedBy: old?.assignedBy ?? a.user.id, assignedAt: old?.assignedAt ?? time, updatedAt: time }; next.factoryMemberships = [...next.factoryMemberships.filter(item => item.id !== m.id), m]; for (const allocation of next.zoneAllocations.filter(item => item.userId === person.id && item.plantId === plantId)) {
    allocation.status = "Inactive";
    allocation.updatedAt = time;
} for (const zoneId of new Set(input.zoneIds)) {
    const oldAllocation = next.zoneAllocations.find(item => item.userId === person.id && item.plantId === plantId && item.zoneId === zoneId);
    const patch = { responsibility: input.baseRole === "Zone Leader" ? "Leader" as const : "Member" as const, status: m.status, updatedAt: time };
    if (oldAllocation)
        Object.assign(oldAllocation, patch);
    else
        next.zoneAllocations.push({ id: uid("ZA"), userId: person.id, organizationId, plantId, zoneId, ...patch, assignedBy: a.user.id, assignedAt: time });
} commit(() => factoryAdministration(organizationId, plantId, expectedActorId), organizationId, old ? "factoryMembership.updated" : "factoryUser.added", person.id, next, { plantId, users: input.person ? [person, ...users] : undefined, before, after: { membership: m, zoneIds: input.zoneIds, affectedAuditAssignments: unfinishedAuditorAssignments(person.id, organizationId, plantId), consequence: "Audit eligibility is re-evaluated dynamically; any required reassignment is explicit." } }); return person; }

export function deactivateFactoryUser(organizationId: string, plantId: string, userId: string, expectedActorId?: string) {
    const actor = platform(expectedActorId); const plant = factory(organizationId, plantId); const state = getAccessV3State();
    const current = state.factoryMemberships.find(item => item.organizationId === organizationId && item.plantId === plantId && item.userId === userId && item.status === "Active");
    if (!current) deny("Active factory user membership not found.");
    const assignedAudits = (() => { try { const value: unknown = JSON.parse(readAdministrationPayload("manufacturing-qms-five-s-audits-v1") ?? "[]"); return Array.isArray(value) ? (value as FiveSAudit[]).filter(item => item.organizationId === organizationId && item.plantId === plantId && item.assignedAuditorId === userId && item.status !== "Completed").length : 1; } catch { return 1; } })();
    if (getOutstandingUserActions(userId).length || getOutstandingUserImprovements(userId).length || assignedAudits || state.factoryAdmins.some(item => item.userId === userId && item.plantId === plantId && item.status === "Active")) deny(`Resolve active ownership, Audit assignments and Factory Admin authority before deactivating this user from ${plant.name}. Historical records will not be reassigned automatically.`);
    const next = structuredClone(state); const membership = next.factoryMemberships.find(item => item.id === current.id)!; const before = structuredClone(membership); membership.status = "Inactive"; membership.updatedAt = now();
    next.zoneAllocations.filter(item => item.userId === userId && item.plantId === plantId && item.status === "Active").forEach(item => { item.status = "Inactive"; item.updatedAt = now(); });
    commit(() => platform(expectedActorId), organizationId, "factoryUser.deactivated", userId, next, { plantId, before, after: membership });
    return actor.user.id;
}

function operationalDependencies(organizationId: string, plant?: OrganizationPlant) {
    const keys = ["standalone-5s-actions", "manufacturing-qms-five-s-audits-v1", "ops-gemba-v1", "five-s-red-tags-v1", "five-s-continuous-improvements-v1", "ops-visual-improvements-v1", "ops-visual-management-v1"];
    const terminal = new Set(["completed", "closed", "resolved", "rejected", "removed", "cancelled", "archived"]); let any = false; let active = false;
    const inspect = (value: unknown): void => {
        if (Array.isArray(value)) { value.forEach(inspect); return; }
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        const organizationMatches = record.organizationId === organizationId || (organizationId === DEMO_ORGANIZATION.id && record.organizationId === undefined);
        const scopeMatches = plant ? organizationMatches && (record.plantId === plant.id || record.plant === plant.name) : record.organizationId === organizationId;
        if (scopeMatches) { any = true; const status = typeof record.status === "string" ? record.status.toLowerCase() : ""; if (!terminal.has(status)) active = true; }
        Object.values(record).forEach(inspect);
    };
    for (const key of keys) { const raw = window.localStorage.getItem(key); if (!raw) continue; try { inspect(JSON.parse(raw)); } catch { any = true; active = true; } }
    return { any, active };
}

export function getFactoryRemovalMode(plantId: string): "delete" | "archive" {
    const plant = getAllOrganizationConfiguration().plants.find(item => item.id === plantId);
    if (!plant) return "archive";
    const state = getAccessV3State(); const v4 = getAccessV4State();
    const history = state.factoryMemberships.some(item => item.plantId === plantId) || state.factoryAdmins.some(item => item.plantId === plantId) || state.zoneAllocations.some(item => item.plantId === plantId) || state.auditorGrants.some(item => item.plantId === plantId) || state.factoryRequests.some(item => item.factoryId === plantId) || getAllOrganizationConfiguration().zones.some(item => item.plantId === plantId) || v4.departments.some(item => item.plantId === plantId) || operationalDependencies(plantOrganization(plant), plant).any;
    return plant.demoDataset?.disposable && !history ? "delete" : "archive";
}

export function removeFactory(organizationId: string, plantId: string, expectedActorId?: string) {
    platform(expectedActorId); const plant = factory(organizationId, plantId); const state = getAccessV3State(); const v4 = getAccessV4State();
    const blockers = [
        state.factoryMemberships.some(item => item.plantId === plantId && item.status === "Active") && "active users",
        state.factoryAdmins.some(item => item.plantId === plantId && item.status === "Active") && "Factory Admin assignments",
        state.auditorGrants.some(item => item.plantId === plantId && item.status === "Active") && "Auditor authorizations",
        getAllOrganizationConfiguration().zones.some(item => item.plantId === plantId && item.status === "Active") && "active Zones",
        v4.departments.some(item => item.plantId === plantId && item.status === "Active") && "active Departments",
        state.factoryRequests.some(item => item.organizationId === organizationId && item.status === "Pending") && "pending factory requests",
        operationalDependencies(organizationId, plant).active && "active operational records",
    ].filter(Boolean);
    if (blockers.length) deny(`Cannot remove ${plant.name}: resolve ${blockers.join(", ")} first. No dependent records were changed.`);
    const configuration = structuredClone(getAllOrganizationConfiguration()); const mode = getFactoryRemovalMode(plantId);
    if (mode === "delete") configuration.plants = configuration.plants.filter(item => item.id !== plantId);
    else configuration.plants = configuration.plants.map(item => item.id === plantId ? { ...item, status: "Inactive" as const } : item);
    commit(() => platform(expectedActorId), organizationId, mode === "delete" ? "factory.deleted" : "factory.archived", plantId, structuredClone(state), { configuration, moduleAccess: mode === "delete" ? removeFactoryAccessPayload(plantId) : undefined, plantId, before: plant, after: mode === "delete" ? undefined : { ...plant, status: "Inactive" } });
    return mode;
}

export function archiveClient(organizationId: string, expectedActorId?: string) {
    platform(expectedActorId); const organization = client(organizationId); const state = getAccessV3State();
    const factories = getAllOrganizationConfiguration().plants.filter(item => plantOrganization(item) === organizationId);
    const pending = state.factoryRequests.some(item => item.organizationId === organizationId && item.status === "Pending");
    const orphanedFactoryAccess = state.factoryMemberships.some(item => item.organizationId === organizationId && item.status === "Active") || state.factoryAdmins.some(item => item.organizationId === organizationId && item.status === "Active");
    if (factories.length || pending || orphanedFactoryAccess || operationalDependencies(organizationId).active) deny(`Cannot archive ${organization.name}: remove its factories, factory access, pending requests and active operational dependencies first. No records were changed.`);
    const next = structuredClone(state); const archivedAt = now(); next.clients = [...next.clients.filter(item => item.id !== organizationId), { ...organization, status: "Inactive", lastUpdated: archivedAt }];
    next.clientMemberships.filter(item => item.organizationId === organizationId && item.status === "Active").forEach(item => { item.status = "Inactive"; item.updatedAt = archivedAt; });
    commit(() => platform(expectedActorId), organizationId, "client.archived", organizationId, next, { before: organization, after: { client: { ...organization, status: "Inactive" }, consequence: "Client memberships were deactivated; identities and history were retained." } });
}
export function saveFactoryZone(organizationId: string, plantId: string, input: {
    id?: string;
    name: string;
    code: string;
    department: string;
}, expectedActorId?: string) { const actor = factoryAdministration(organizationId, plantId, expectedActorId); payloadKeys(input, ["id", "name", "code", "department"]); if (!input.name?.trim() || !input.code?.trim())
    deny("Zone name and code are required."); const configuration = structuredClone(getAllOrganizationConfiguration()); if (input.id && configuration.zones.filter(z => z.id === input.id).length !== 1) deny("Unknown or ambiguous Zone ID."); const old = input.id ? configuration.zones.find(z => z.id === input.id && z.plantId === plantId) : undefined; if (input.id && !old)
    deny("Unknown or wrong-factory Zone."); if (old && old.accessModel !== "v4" && !input.department?.trim()) deny("Department is required for this legacy Zone."); if (configuration.zones.some(z => z.id !== input.id && z.plantId === plantId && (z.name.toLowerCase() === input.name.trim().toLowerCase() || z.code.toLowerCase() === input.code.trim().toLowerCase())))
    deny("Zone name/code already exists in this factory."); const item: OrganizationZone = { ...(old ?? { id: uid("ZONE"), organizationId, accessModel: "v4", leaderId: "", leaderName: "", status: "Active", codeApprovedBy: actor.user.id, codeApprovedAt: now() }), plantId, name: input.name.trim(), code: input.code.trim().toUpperCase(), department: old?.accessModel === "v4" || !old ? "" : input.department.trim() }; configuration.zones = [...configuration.zones.filter(z => z.id !== item.id), item]; commit(() => factoryAdministration(organizationId, plantId, expectedActorId), organizationId, old ? "zone.updated" : "zone.created", item.id, structuredClone(getAccessV3State()), { configuration, plantId, before: old, after: item }); return item; }

/** Audit assignment payload and its administration event share the Phase 1 recovery journal. */
export function reassignAuditAdministrator(auditId: string, auditorId: string, reason: string) {
    if (getRecordTombstone("audit", auditId)) throw new Error("Audit is deleted.");
    const raw = readAdministrationPayload("manufacturing-qms-five-s-audits-v1");
    const records: unknown = raw ? JSON.parse(raw) : null;
    if (!Array.isArray(records)) throw new Error("A valid persisted Audit collection is required.");
    const audits = records as FiveSAudit[];
    const matches = audits.filter(a => a.id === auditId);
    if (matches.length !== 1 || matches[0].status === "Completed") throw new Error("Select one unfinished Audit.");
    const before = matches[0];
    if (!before.organizationId || !before.plantId || !before.zoneId) throw new Error("Legacy assignments require separately reviewed scope mapping.");
    const context = { organizationId: before.organizationId, plantId: before.plantId, zoneId: before.zoneId };
    const actor = factoryAdministration(context.organizationId, context.plantId);
    const target = resolveFactoryPerson(auditorId, context);
    if (!target.canAuditZone || !reason.trim() || auditorId === before.assignedAuditorId) throw new Error("Select an eligible replacement and enter a reassignment reason.");
    const after: FiveSAudit = { ...before, auditor: target.person.name, assignedAuditorId: auditorId, assignmentHistory: [...(before.assignmentHistory ?? []), { actorId: actor.user.id, at: now(), previousAuditorId: before.assignedAuditorId, previousAuditor: before.auditor, auditorId, auditor: target.person.name, reason: reason.trim() }] };
    const next = audits.map(a => a.id === auditId ? after : a);
    commit(() => { const current = factoryAdministration(context.organizationId, context.plantId); if (!resolveFactoryPerson(auditorId, context).canAuditZone) deny("Replacement eligibility changed."); return current; }, before.organizationId, "audit.reassigned", auditId, structuredClone(getAccessV3State()), { plantId: before.plantId, before, after, auditRecords: next });
    return { audit: after, records: next };
}
export function unfinishedAuditorAssignments(userId: string, organizationId: string, plantId: string) {
    factoryAdministration(organizationId, plantId);
    const raw = readAdministrationPayload("manufacturing-qms-five-s-audits-v1");
    const audits: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(audits)) throw new Error("Invalid Audit payload. Preserve browser storage for recovery.");
    return (audits as FiveSAudit[]).filter(a => !getRecordTombstone("audit", a.id) && a.organizationId === organizationId && a.plantId === plantId && a.assignedAuditorId === userId && a.status !== "Completed").map(a => ({ id: a.id, zoneId: a.zoneId, status: a.status }));
}
export function saveAuditorAuthorization(organizationId: string, plantId: string, userId: string, zoneIds: string[], expectedActorId?: string) {
    const context = { organizationId, plantId };
    const actor = factoryAdministration(organizationId, plantId, expectedActorId);
    const target = resolveFactoryPerson(userId, context);
    if (!target.zoneLeader || !zoneIds.length || new Set(zoneIds).size !== zoneIds.length || zoneIds.some(zoneId => !resolveFactoryPerson(userId, { ...context, zoneId }).valid)) throw new Error("Select an active Zone Leader with a leadership allocation and valid factory Zones.");
    const next = structuredClone(getAccessV3State());
    const active = next.auditorGrants.filter(g => g.userId === userId && g.organizationId === organizationId && g.plantId === plantId && g.status === "Active");
    if (active.length > 1) throw new Error("Ambiguous Auditor authorizations require review. No changes saved.");
    const before = active[0] ? structuredClone(active[0]) : undefined;
    if (before && before.zoneIds.length === zoneIds.length && before.zoneIds.every(id => zoneIds.includes(id))) throw new Error("This Auditor authorization already exists.");
    const grant = active[0] ?? { id: uid("AGR"), userId, organizationId, plantId, zoneIds: [], status: "Active" as const, grantedBy: actor.user.id, grantedAt: now() };
    grant.zoneIds = [...zoneIds]; grant.updatedBy = actor.user.id; grant.updatedAt = now();
    if (!active.length) next.auditorGrants.push(grant);
    commit(() => { const current = factoryAdministration(organizationId, plantId, expectedActorId); if (!resolveFactoryPerson(userId, context).zoneLeader) deny("Auditor eligibility changed."); return current; }, organizationId, before ? "auditor.scopeChanged" : "auditor.granted", grant.id, next, { plantId, before, after: { ...grant, affectedAssignments: unfinishedAuditorAssignments(userId, organizationId, plantId) } });
    return grant;
}
export function revokeAuditorAuthorization(grantId: string, expectedActorId?: string) {
    const next = structuredClone(getAccessV3State());
    const matches = next.auditorGrants.filter(g => g.id === grantId);
    if (matches.length !== 1 || matches[0].status !== "Active") throw new Error("Select one active Auditor authorization.");
    const grant = matches[0]; const context = { organizationId: grant.organizationId, plantId: grant.plantId };
    const actor = factoryAdministration(grant.organizationId, grant.plantId, expectedActorId); const before = structuredClone(grant);
    grant.status = "Revoked"; grant.revokedBy = actor.user.id; grant.revokedAt = now();
    commit(() => factoryAdministration(grant.organizationId, grant.plantId, expectedActorId), grant.organizationId, "auditor.revoked", grant.id, next, { plantId: grant.plantId, before, after: { ...grant, affectedAssignments: unfinishedAuditorAssignments(grant.userId, grant.organizationId, grant.plantId), consequence: "Execution blocked; unfinished audits retain their state and require explicit reassignment." } });
}

/** Navigation only; each v4 command independently revalidates its scope. */
export function canOpenV4Administration() {
  if (canOpenAccessAdministration()) return true;
  const a = getAuthenticatedDemoActor();
  return Boolean(a && getAccessV4State().assignments.some(r => r.status === "Active" && r.personId === a.user.id && ((r.role === "Department Leader" && isDepartmentLeader(a.user.id, r.departmentId, r.organizationId, r.plantId)) || (r.role === "Zone Champion" && resolveFactoryPerson(a.user.id, r).valid && Boolean(resolveFactoryPerson(a.user.id, r).membership)))));
}
