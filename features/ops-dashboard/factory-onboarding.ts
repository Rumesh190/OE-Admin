import type { AccessV3State } from "@/features/five-s/administration/access-v3-types";
import type { AccessV4State } from "@/features/five-s/administration/access-v4-state";
import type { OrganizationZone } from "@/lib/organization-store";

export type FactorySetupStatus = "Not started" | "In progress" | "Completed";

export interface FactorySetupStep {
  id: "users" | "zones" | "departments" | "members" | "responsibilities";
  title: string;
  status: FactorySetupStatus;
  detail: string;
}

export interface FactorySetupReadiness {
  ready: boolean;
  progress: number;
  steps: FactorySetupStep[];
  activeUserIds: string[];
  activeZones: OrganizationZone[];
  activeDepartmentCount: number;
}

function status(done: boolean, started: boolean): FactorySetupStatus {
  return done ? "Completed" : started ? "In progress" : "Not started";
}

/**
 * Factory readiness is derived only from canonical administration records.
 * Legacy Zone departments remain valid for configured ABC factories; new v4
 * Zones require independent Department records and explicit responsibilities.
 */
export function getFactorySetupReadiness(
  organizationId: string,
  plantId: string,
  zones: readonly OrganizationZone[],
  accessV3: AccessV3State,
  accessV4: AccessV4State,
): FactorySetupReadiness {
  const memberships = accessV3.factoryMemberships.filter(item => item.organizationId === organizationId && item.plantId === plantId && item.status === "Active");
  const activeUserIds = [...new Set(memberships.map(item => item.userId))].filter(userId =>
    memberships.filter(item => item.userId === userId).length === 1 &&
    accessV3.clientMemberships.filter(item => item.userId === userId && item.organizationId === organizationId && item.status === "Active").length === 1
  );
  const users = new Set(activeUserIds);
  const activeZones = zones.filter(item => item.plantId === plantId && item.status === "Active" && (!item.organizationId || item.organizationId === organizationId));
  const zoneIds = new Set(activeZones.map(item => item.id));
  const activeDepartments = accessV4.departments.filter(item => item.organizationId === organizationId && item.plantId === plantId && item.status === "Active" && zoneIds.has(item.zoneId));
  const legacyDepartmentZones = activeZones.filter(item => item.accessModel !== "v4" && item.department.trim());
  const activeAssignments = accessV4.assignments.filter(item => item.organizationId === organizationId && item.plantId === plantId && item.status === "Active" && users.has(item.personId));
  const zoneAllocations = accessV3.zoneAllocations.filter(item => item.organizationId === organizationId && item.plantId === plantId && item.status === "Active" && users.has(item.userId) && zoneIds.has(item.zoneId));
  const legacyZoneMemberships = activeZones.filter(item => item.accessModel !== "v4" && item.leaderId && users.has(item.leaderId));
  const departmentAssignments = activeAssignments.filter(item => (item.role === "Department Leader" || item.role === "Department Member") && activeDepartments.some(department => department.id === item.departmentId && department.zoneId === item.zoneId));

  const usersDone = activeUserIds.length > 0;
  const zonesDone = activeZones.length > 0;
  const departmentsDone = activeDepartments.length + legacyDepartmentZones.length > 0;
  const zoneMembershipCount = zoneAllocations.length + legacyZoneMemberships.length;
  const membersStarted = zoneMembershipCount > 0 || departmentAssignments.length > 0;
  const membersDone = zoneMembershipCount > 0 && (activeDepartments.length === 0 || departmentAssignments.length > 0);

  const zoneHasLeader = (zone: OrganizationZone) =>
    Boolean(zone.leaderId && users.has(zone.leaderId)) ||
    zoneAllocations.some(item => item.zoneId === zone.id && item.responsibility === "Leader") ||
    activeAssignments.some(item => item.role === "Zone Leader" && item.zoneId === zone.id);
  const departmentHasLeader = (departmentId: string) => activeAssignments.some(item => item.role === "Department Leader" && item.departmentId === departmentId);
  const leadershipStarted = activeZones.some(zoneHasLeader) || activeDepartments.some(department => departmentHasLeader(department.id)) || activeAssignments.some(item => item.role === "Zone Champion");
  const responsibilitiesDone = zonesDone && activeZones.every(zoneHasLeader) && activeDepartments.every(department => departmentHasLeader(department.id));

  const steps: FactorySetupStep[] = [
    { id: "users", title: "Add Users", status: status(usersDone, usersDone), detail: `${activeUserIds.length} active factory ${activeUserIds.length === 1 ? "user" : "users"}` },
    { id: "zones", title: "Create Zones", status: status(zonesDone, zonesDone), detail: `${activeZones.length} active ${activeZones.length === 1 ? "Zone" : "Zones"}` },
    { id: "departments", title: "Create Departments", status: status(departmentsDone, departmentsDone), detail: `${activeDepartments.length + legacyDepartmentZones.length} active ${activeDepartments.length + legacyDepartmentZones.length === 1 ? "Department" : "Departments"}` },
    { id: "members", title: "Assign Members", status: status(membersDone, membersStarted), detail: `${zoneMembershipCount} Zone and ${departmentAssignments.length} Department allocations` },
    { id: "responsibilities", title: "Assign Operational Responsibilities", status: status(responsibilitiesDone, leadershipStarted), detail: "Every active Zone and Department needs an explicit leader" },
  ];
  const completed = steps.filter(step => step.status === "Completed").length;
  return { ready: completed === steps.length, progress: completed * 20, steps, activeUserIds, activeZones, activeDepartmentCount: activeDepartments.length + legacyDepartmentZones.length };
}
