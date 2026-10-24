"use client";

import { getAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { getAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { getAdminUsers } from "@/features/five-s/administration/store";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
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
  const access = getAccessV3State();
  const membership = access.factoryMemberships.find(item => item.userId === personId && item.organizationId === organizationId && item.plantId === plantId && item.status === "Active");
  const roles: string[] = [];
  if (access.factoryAdmins.some(item => item.userId === personId && item.organizationId === organizationId && item.plantId === plantId && item.status === "Active")) roles.push("Factory Administrator");
  for (const assignment of getAccessV4State().assignments.filter(item => item.personId === personId && item.organizationId === organizationId && item.plantId === plantId && item.status === "Active")) roles.push(assignment.role);
  if (membership?.baseRole === "Zone Leader") roles.push("Zone Leader");
  else if (membership?.baseRole === "Zone Member") roles.push("Zone Member");
  else if (membership) roles.push("Standard User");
  if (access.auditorGrants.some(item => item.userId === personId && item.organizationId === organizationId && item.plantId === plantId && item.status === "Active")) roles.push("Auditor");
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

export function resolveCanonicalProfileRole(personId: string, target?: CanonicalProfileTarget | null) {
  if (personId === "USR-OPS-SUPER-ADMIN") return "Platform Super Admin";
  const hierarchy = getCanonicalProfileHierarchy();
  if (target?.kind === "client") return hierarchy.clients.find(item => item.id === target.organizationId)?.administrator?.personId === personId ? "Client Administrator" : "Standard User";
  if (target?.kind === "factory") {
    const client = hierarchy.clients.find(item => item.id === target.organizationId);
    if (client?.administrator?.personId === personId) return "Client Administrator";
    return client?.factories.find(item => item.id === target.plantId)?.users.find(item => item.personId === personId)?.primaryRole ?? "Standard User";
  }
  for (const client of hierarchy.clients) {
    if (client.administrator?.personId === personId) return "Client Administrator";
    for (const factory of client.factories) {
      const profile = factory.users.find(item => item.personId === personId);
      if (profile) return profile.primaryRole;
    }
  }
  return "Standard User";
}
