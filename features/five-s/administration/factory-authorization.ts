"use client";
import { getAccessV4State } from "./access-v4-state";
import { readAdministrationPayload } from "@/lib/administration-storage";
import type { AdminUser } from "./types";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { getAdminUsers } from "./store";
import { getAccessV3State } from "./access-v3-state";
import { DEMO_ORGANIZATION, getOrganizations } from "@/lib/organizations";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
export interface FactoryContext {
    organizationId: string;
    plantId: string;
    zoneId?: string;
}
/** Resolves canonical relationships, without projecting them into legacy role arrays. */
export function resolveFactoryPerson(userId: string, context: FactoryContext) {
    const state = getAccessV3State();
    const rawPeople = readAdministrationPayload("five-s-administration-users-v1");
    const directory: unknown = rawPeople ? JSON.parse(rawPeople) : getAdminUsers();
    if (!Array.isArray(directory)) throw new Error("Invalid canonical person directory. Preserve browser storage for review.");
    const people = (directory as AdminUser[]).filter(p => p.id === userId);
    const clients = getOrganizations().filter(c => c.id === context.organizationId);
    const rawConfiguration = readAdministrationPayload("ops-organization-configuration-v1");
    const configuration: unknown = rawConfiguration ? JSON.parse(rawConfiguration) : getAllOrganizationConfiguration();
    if (!configuration || typeof configuration !== "object" || !("plants" in configuration) || !("zones" in configuration) || !Array.isArray(configuration.plants) || !Array.isArray(configuration.zones)) throw new Error("Invalid canonical factory/Zone configuration. Preserve browser storage for review.");
    const catalog = configuration as ReturnType<typeof getAllOrganizationConfiguration>;
    const plants = catalog.plants.filter(p => p.id === context.plantId);
    const zones = context.zoneId ? catalog.zones.filter(z => z.id === context.zoneId) : [];
    const clientMembers = state.clientMemberships.filter(m => m.userId === userId && m.organizationId === context.organizationId && m.status === "Active");
    const valid = people.length === 1 && people[0].status === "Active" && userId !== "USR-OPS-SUPER-ADMIN" && clients.length === 1 && clients[0].status === "Active" && plants.length === 1 && plants[0].status === "Active" && (plants[0].organizationId ?? DEMO_ORGANIZATION.id) === context.organizationId && clientMembers.length === 1 && (!context.zoneId || (zones.length === 1 && zones[0].status === "Active" && zones[0].plantId === context.plantId));
    const memberships = state.factoryMemberships.filter(m => m.userId === userId && m.organizationId === context.organizationId && m.plantId === context.plantId && m.status === "Active");
    const allocations = state.zoneAllocations.filter(a => a.userId === userId && a.organizationId === context.organizationId && a.plantId === context.plantId && a.status === "Active" && catalog.zones.some(z => z.id === a.zoneId && z.plantId === context.plantId && z.status === "Active"));
    const grants = state.auditorGrants.filter(g => g.userId === userId && g.organizationId === context.organizationId && g.plantId === context.plantId && g.status === "Active");
    const explicitLeaders = valid && context.organizationId !== DEMO_ORGANIZATION.id ? getAccessV4State().assignments.filter(a => a.role === "Zone Leader" && a.personId === userId && a.status === "Active" && a.organizationId === context.organizationId && a.plantId === context.plantId && catalog.zones.some(z => z.id === a.zoneId && z.plantId === context.plantId && z.status === "Active")) : [];
    const zoneLeader = Boolean(valid && memberships.length === 1 && ((memberships[0].baseRole === "Zone Leader" && allocations.some(a => a.responsibility === "Leader")) || explicitLeaders.length === 1));
    const grant = grants.length === 1 ? grants[0] : undefined;
    const grantEffective = Boolean(zoneLeader && grant && state.auditorGrants.filter(g => g.id === grant.id).length === 1 && grant.zoneIds.length && grant.zoneIds.every(id => catalog.zones.filter(z => z.id === id && z.plantId === context.plantId && z.status === "Active").length === 1));
    const leadsZone = Boolean(context.zoneId && (explicitLeaders.some(a => a.zoneId === context.zoneId) || allocations.some(a => a.zoneId === context.zoneId && a.responsibility === "Leader") || zones.some(z => z.plantId === context.plantId && z.leaderId === userId)));
    return { valid, person: people[0], clientAdmin: Boolean(valid && clientMembers[0]?.clientAdmin), factoryAdmin: Boolean(valid && state.factoryAdmins.filter(a => a.userId === userId && a.organizationId === context.organizationId && a.plantId === context.plantId && a.status === "Active").length === 1), membership: valid && memberships.length === 1 ? memberships[0] : undefined, allocations, zoneLeader, grant, grantEffective, leadsZone, canAuditZone: Boolean(grantEffective && context.zoneId && grant?.zoneIds.includes(context.zoneId) && !leadsZone) };
}
export function resolveCurrentFactoryActor(context: FactoryContext, expectedActorId?: string) {
    const actor = getAuthenticatedDemoActor(expectedActorId);
    return actor ? { actor, ...resolveFactoryPerson(actor.user.id, context) } : undefined;
}
export function requireFactoryAdministrator(context: FactoryContext, expectedActorId?: string) {
    const resolved = resolveCurrentFactoryActor(context, expectedActorId);
    if (resolved?.actor.identity.isSuperAdmin && resolved.actor.user.id === "USR-OPS-SUPER-ADMIN") {
        const selected = typeof window === "undefined" ? null : JSON.parse(window.localStorage.getItem("ops-active-access-context-v1") ?? "null") as { kind?: string; personId?: string; organizationId?: string; plantId?: string } | null;
        if (selected?.kind === "factory" && selected.personId === resolved.actor.user.id && selected.organizationId === context.organizationId && selected.plantId === context.plantId) return resolved.actor;
    }
    if (!resolved?.factoryAdmin)
        throw new Error("An active Factory Admin assignment for this factory is required.");
    return resolved.actor;
}
