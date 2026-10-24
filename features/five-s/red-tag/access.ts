import { hasPermission } from "@/features/five-s/administration/permissions";
import type { AdminUser } from "@/features/five-s/administration/types";
import { getAdminUsers } from "@/features/five-s/administration/store";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { getOrganizationAccess } from "@/lib/module-entitlements";
import { getOrganizationPlant, getOrganizationZone, getOrganizationZones } from "@/lib/organization-store";
import { RED_TAG_SECTIONS, type RedTag } from "./types";
import { hasPlatformLegacyOperationalAccess } from "@/lib/platform-operational-access";
import { canCreateDemoModuleRecord } from "@/lib/demo/demo-module-creation";
import { getActiveAccessContext } from "@/features/five-s/administration/access-v4-context";

export function canCreateRedTag(user: AdminUser | undefined) {
  const candidate = user ?? getAuthenticatedDemoActor()?.user;
  return Boolean(candidate?.status === "Active" && (canCreateDemoModuleRecord("redTag", candidate.id) || hasPlatformLegacyOperationalAccess("redTag") || (candidate.id !== "USR-OPS-SUPER-ADMIN" && candidate.accessModel !== "v3" && (hasPermission(candidate, "red_tag.create") || candidate.roles.some(role => ["Admin", "Auditor", "Zone Leader"].includes(role))))));
}

/** Demo-session boundary only. A production backend must enforce the same scope. */
export function getRedTagSessionActor(expectedId?: string) {
  const actor = getAuthenticatedDemoActor(expectedId);
  return actor && (canCreateDemoModuleRecord("redTag", actor.user.id) || (actor.identity.isSuperAdmin && hasPlatformLegacyOperationalAccess("redTag")) || (!actor.identity.isSuperAdmin && actor.user.accessModel !== "v3")) ? actor.user : undefined;
}

export function canAccessRedTagZone(user: AdminUser | undefined, plantName: string, zoneName: string) {
  const plant = getOrganizationPlant(plantName);
  const zone = getOrganizationZone(zoneName);
  if (!user || user.status !== "Active" || !plant || plant.status !== "Active" || !zone || zone.status !== "Active" || zone.plantId !== plant.id) return false;
  if (hasPlatformLegacyOperationalAccess("redTag", plant.name)) return true;
  const context = getActiveAccessContext();
  if (canCreateDemoModuleRecord("redTag", user.id) && context?.kind === "factory" && context.plantId === plant.id) return true;
  return (user.plant === plant.name || user.plant === "All organizations")
    && (user.roles.includes("Admin") || user.zoneMemberships.some(membership => getOrganizationZone(membership.zone)?.id === zone.id));
}

export const RED_TAG_OWN_ZONE_MESSAGE = "You cannot raise a Red Tag in your assigned Zone. A Red Tag must be raised by an authorized user from another Zone.";

/** Leadership assignments are resolved to active canonical Zone IDs, never business ID prefixes. */
export function isRedTagOwnLeaderZone(user: AdminUser | undefined, targetZone: string) {
  const target = getOrganizationZone(targetZone);
  if (!user?.roles.includes("Zone Leader") || !target) return false;
  const assignedIds = new Set(getOrganizationZones().filter(zone => zone.status === "Active" && (
    zone.leaderId === user.id || user.zoneMemberships.some(membership => membership.responsibility === "Leader" && getOrganizationZone(membership.zone)?.id === zone.id)
  )).map(zone => zone.id));
  return assignedIds.has(target.id);
}

export function getRedTagCreationError(user: AdminUser | undefined, plant: string, zone: string) {
  if (!canCreateRedTag(user) || !getOrganizationAccess().redTag || !canAccessRedTagZone(user, plant, zone)) return "You do not have permission to create a Red Tag in this Zone.";
  if (user && canCreateDemoModuleRecord("redTag", user.id)) return "";
  if (isRedTagOwnLeaderZone(user, zone)) return RED_TAG_OWN_ZONE_MESSAGE;
  const reviewer = getRedTagZoneLeader(plant, zone);
  if (!reviewer || !(hasPermission(reviewer, "red_tag.manage") || hasPermission(reviewer, "actions.review"))) return "This Zone requires one active authorized Zone Leader before a Red Tag can be submitted.";
  if (reviewer.id === user!.id) return "The Red Tag creator cannot evaluate their own Red Tag. A different authorized Zone Leader is required.";
  return "";
}

export function canCreateRedTagInZone(user: AdminUser | undefined, plant: string, zone: string) {
  return !getRedTagCreationError(user, plant, zone);
}

/** Existing Red Tag department choices plus departments configured in the active plant. */
export function getRedTagDepartments(plantName: string) {
  const plant = getOrganizationPlant(plantName);
  if (!plant || plant.status !== "Active") return [];
  return [...new Set([...RED_TAG_SECTIONS, ...getOrganizationZones().filter(zone => zone.status === "Active" && zone.plantId === plant.id).map(zone => zone.department.trim()).filter(Boolean)])];
}

export function getRedTagZoneLeader(plantName: string, zoneName: string) {
  const plant = getOrganizationPlant(plantName);
  const zone = getOrganizationZone(zoneName);
  if (!plant || plant.status !== "Active" || !zone || zone.status !== "Active" || zone.plantId !== plant.id || !zone.leaderId) return undefined;
  const leaders = getAdminUsers().filter(user => user.status === "Active" && user.plant === plant.name && user.roles.includes("Zone Leader")
    && user.zoneMemberships.some(membership => getOrganizationZone(membership.zone)?.id === zone.id && membership.responsibility === "Leader"));
  return leaders.length === 1 && leaders[0].id === zone.leaderId ? leaders[0] : undefined;
}

export function canReviewRedTag(tag: RedTag, user: AdminUser | undefined) {
  const leader = getRedTagZoneLeader(tag.plant, tag.zone);
  return Boolean(user?.status === "Active" && tag.createdById !== user.id && leader?.id === user.id && tag.review?.reviewerId === user.id
    && (hasPermission(user, "red_tag.manage") || hasPermission(user, "actions.review")));
}

export function canLinkRedTagAction(tag: RedTag, user: AdminUser | undefined) {
  return tag.status !== "Closed" && tag.decisionRecord?.type !== "keep" && canAccessRedTagZone(user, tag.plant, tag.zone)
    && Boolean(user && (tag.createdById === user.id || hasPermission(user, "red_tag.manage") || user.roles.includes("Admin")));
}

export function canManageRedTag(tag: RedTag, user: AdminUser | undefined) {
  return canAccessRedTagZone(user, tag.plant, tag.zone) && (hasPermission(user, "red_tag.manage") || hasPermission(user, "actions.review"));
}
