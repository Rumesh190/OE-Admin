import type { Organization } from "@/lib/organizations";
export const FACTORY_BASE_ROLES = ["Zone Leader", "Zone Member", "Standard User"] as const;
export type FactoryBaseRole = typeof FACTORY_BASE_ROLES[number];
export type MembershipStatus = "Active" | "Inactive";
export interface ClientMembership {
    id: string;
    userId: string;
    organizationId: string;
    status: MembershipStatus;
    clientAdmin: boolean;
    assignedBy: string;
    assignedAt: string;
    updatedAt: string;
}
export interface FactoryMembership {
    id: string;
    userId: string;
    organizationId: string;
    plantId: string;
    baseRole: FactoryBaseRole;
    status: MembershipStatus;
    assignedBy: string;
    assignedAt: string;
    updatedAt: string;
}
export interface ZoneAllocation {
    id: string;
    userId: string;
    organizationId: string;
    plantId: string;
    zoneId: string;
    responsibility: "Leader" | "Member";
    status: MembershipStatus;
    assignedBy: string;
    assignedAt: string;
    updatedAt: string;
}
export interface FactoryAdminAssignment {
    id: string;
    userId: string;
    organizationId: string;
    plantId: string;
    status: MembershipStatus;
    assignedBy: string;
    assignedAt: string;
    revokedBy?: string;
    revokedAt?: string;
}
export interface FactoryRequest {
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    status: "Pending" | "Approved" | "Rejected";
    requestedBy: string;
    requestedAt: string;
    decidedBy?: string;
    decidedAt?: string;
    factoryId?: string;
}
export interface AdministrationEvent {
    id: string;
    actorId: string;
    targetId: string;
    organizationId: string;
    plantId?: string;
    operation: string;
    at: string;
    before?: unknown;
    after?: unknown;
}
export interface AuditorGrant {
    id: string;
    userId: string;
    organizationId: string;
    plantId: string;
    zoneIds: string[];
    status: "Active" | "Revoked";
    grantedBy: string;
    grantedAt: string;
    updatedBy?: string;
    updatedAt?: string;
    revokedBy?: string;
    revokedAt?: string;
}
export interface AccessV3State {
    auditorGrants: AuditorGrant[];
    version: 1;
    clients: Organization[];
    clientMemberships: ClientMembership[];
    factoryMemberships: FactoryMembership[];
    zoneAllocations: ZoneAllocation[];
    factoryAdmins: FactoryAdminAssignment[];
    factoryRequests: FactoryRequest[];
    events: AdministrationEvent[];
}
