"use client";

import { getAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { getAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { getAdminUsers } from "@/features/five-s/administration/store";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
import { resolveFactoryPerson } from "@/features/five-s/administration/factory-authorization";
import { getOrganizations } from "@/lib/organizations";

export type CanonicalProfileTarget =
  | { kind: "platform" }
  | { kind: "client"; organizationId: string }
  | { kind: "factory"; organizationId: string; plantId: string };

export interface CanonicalProfile {
  personId: string;
  name: string;
  primaryRole: string;
  responsibilities: string[];
}

export interface CanonicalFactoryProfiles {
  id: string;
  name: string;
  users: CanonicalProfile[];
}

export interface CanonicalClientProfiles {
  id: string;
  name: string;
  administrator: CanonicalProfile | null;
  factories: CanonicalFactoryProfiles[];
}

const roleOrder = ["Factory Administrator", "Zone Champion", "Zone Leader", "Department Leader", "Department Member", "Zone Member", "Standard User"];

function ordered(values: Iterable<string>) {
  return [...new Set(values)].sort((a, b) => {
    const ai = roleOrder.indexOf(a); const bi = roleOrder.indexOf(b);
    return (ai < 0 ? roleOrder.length : ai) - (bi < 0 ? roleOrder.length : bi) || a.localeCompare(b);
  });
}

function factoryProfile(personId: string, organizationId: string, plantId: string): CanonicalProfile | null {
  const person = getAdminUsers().find(item => item.id === personId && item.status === "Active");
  if (!person) return null;
  const resolved = resolveFactoryPerson(personId, { organizationId, plantId });
  if (!resolved.valid) return null;
  const membership = resolved.membership;
  const roles: string[] = [];
  if (resolved.factoryAdmin) roles.push("Factory Administrator");
  for (const assignment of getAccessV4State().assignments.filter(item => item.personId === personId && item.organizationId === organizationId && item.plantId === plantId && item.status === "Active")) roles.push(assignment.role);
  if (membership?.baseRole === "Zone Leader") roles.push("Zone Leader");
  else if (membership?.baseRole === "Zone Member") roles.push("Zone Member");
  else if (membership) roles.push("Standard User");
  if (resolved.grantEffective) roles.push("Auditor");
  const responsibilities = ordered(roles);
  if (!responsibilities.length) return null;
  return { personId, name: person.name, primaryRole: responsibilities[0], responsibilities };
}

export function getCanonicalProfileHierarchy() {
  const people = getAdminUsers();
  const access = getAccessV3State();
  const configuration = getAllOrganizationConfiguration();
  const platformPerson = people.find(item => item.id === "USR-OPS-SUPER-ADMIN" && item.status === "Active");
  const platform = platformPerson ? { personId: platformPerson.id, name: platformPerson.name, primaryRole: "Platform Super Admin", responsibilities: ["Platform Super Admin"] } : null;
  const clients: CanonicalClientProfiles[] = getOrganizations().filter(item => item.status === "Active").map(organization => {
    const canonicalAdminId = access.clientMemberships
      .filter(item => item.organizationId === organization.id && item.status === "Active" && item.clientAdmin && people.some(person => person.id === item.userId && person.status === "Active"))
      .sort((left, right) => left.assignedAt.localeCompare(right.assignedAt) || left.id.localeCompare(right.id))[0]?.userId;
    const administrator = canonicalAdminId ? [canonicalAdminId].flatMap(personId => {
      const person = people.find(item => item.id === personId && item.status === "Active");
      return person ? [{ personId, name: person.name, primaryRole: "Client Administrator", responsibilities: ["Client Administrator"] }] : [];
    })[0] ?? null : null;
    const factories = configuration.plants.filter(item => (item.organizationId ?? "abc-manufacturing") === organization.id && item.status === "Active").map(factory => {
      const factoryIds = new Set([
        ...access.factoryMemberships.filter(item => item.organizationId === organization.id && item.plantId === factory.id && item.status === "Active").map(item => item.userId),
        ...access.factoryAdmins.filter(item => item.organizationId === organization.id && item.plantId === factory.id && item.status === "Active").map(item => item.userId),
      ]);
      const clientAdminIds = new Set(access.clientMemberships.filter(item => item.organizationId === organization.id && item.status === "Active" && item.clientAdmin).map(item => item.userId));
      const users = [...factoryIds].filter(personId => !clientAdminIds.has(personId) && access.clientMemberships.some(item => item.userId === personId && item.organizationId === organization.id && item.status === "Active")).flatMap(personId => {
        const profile = factoryProfile(personId, organization.id, factory.id);
        return profile ? [profile] : [];
      }).sort((a, b) => roleOrder.indexOf(a.primaryRole) - roleOrder.indexOf(b.primaryRole) || a.name.localeCompare(b.name));
      return { id: factory.id, name: factory.name, users };
    });
    return { id: organization.id, name: organization.name, administrator, factories };
  });
  return { platform, clients };
}

/** One presentation projection; roles never create memberships or authorization. */
export function resolveCanonicalProfile(personId: string, target?: CanonicalProfileTarget | null): CanonicalProfile | null {
  const person = getAdminUsers().find(item => item.id === personId && item.status === "Active");
  if (!person) return null;
  if (personId === "USR-OPS-SUPER-ADMIN") return { personId, name: person.name, primaryRole: "Platform Super Admin", responsibilities: ["Platform Super Admin"] };
  const hierarchy = getCanonicalProfileHierarchy();
  if (target?.kind === "client") {
    const administrator = hierarchy.clients.find(item => item.id === target.organizationId)?.administrator;
    return administrator?.personId === personId ? administrator : null;
  }
  if (target?.kind === "factory") {
    const client = hierarchy.clients.find(item => item.id === target.organizationId);
    if (client?.administrator?.personId === personId) return client.administrator;
    const profile = client?.factories.find(item => item.id === target.plantId)?.users.find(item => item.personId === personId);
    if (profile) return profile;
  }
  // Legacy ABC seeds have role/Zone fields, not canonical factory assignments.
  // Never use them to revive inactive/revoked canonical authority or a foreign scope.
  const access = getAccessV3State();
  const scopedIdentity = person.accessModel === "v3" || access.clientMemberships.some(item => item.userId === personId)
    || access.factoryMemberships.some(item => item.userId === personId) || access.factoryAdmins.some(item => item.userId === personId);
  const legacyScope = !target || (target.kind === "factory" && target.organizationId === "abc-manufacturing" && target.plantId === "PLANT-EGM");
  if (!scopedIdentity && legacyScope) {
    const responsibilities = ordered(person.roles);
    return { personId, name: person.name, primaryRole: responsibilities[0] ?? "Standard User", responsibilities };
  }
  return null;
}

export function resolveCanonicalProfileRole(personId: string, target?: CanonicalProfileTarget | null) {
  return resolveCanonicalProfile(personId, target)?.primaryRole ?? "Standard User";
}
