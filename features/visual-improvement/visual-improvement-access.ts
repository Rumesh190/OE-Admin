import type { AdminUser } from "@/features/five-s/administration/types";
import { hasPermission } from "@/features/five-s/administration/permissions";
import type { DemoUser } from "@/lib/current-user";
import type { VisualImprovement } from "./types";
import { hasPlatformLegacyOperationalAccess } from "@/lib/platform-operational-access";
import { canCreateDemoModuleRecord } from "@/lib/demo/demo-module-creation";

function hasRole(user: AdminUser | undefined, roles: AdminUser["roles"]) {
  return Boolean(user?.roles.some((role) => roles.includes(role)));
}

export function canViewVisualImprovement(user: AdminUser | undefined, currentUser: DemoUser, item?: VisualImprovement) {
  if (currentUser.isSuperAdmin) return hasPlatformLegacyOperationalAccess("visualImprovement", item?.plant);
  if (!user || user.status !== "Active" || !hasPermission(user, "ci.view")) return false;
  if (!item || hasRole(user, ["Admin", "Auditor", "Reviewer", "Viewer"])) return true;
  return item.zone === currentUser.primaryZone || item.ownerId === currentUser.id || item.createdById === currentUser.id || item.participants.some((person) => person.id === currentUser.id);
}

export function canCreateVisualImprovement(user: AdminUser | undefined, currentUser: DemoUser) {
  if (canCreateDemoModuleRecord("visualImprovement", currentUser.id)) return true;
  if (currentUser.isSuperAdmin) return hasPlatformLegacyOperationalAccess("visualImprovement");
  if (!user || user.status !== "Active") return false;
  return hasRole(user, ["Admin", "Auditor", "Zone Leader", "Zone Member"]) || hasPermission(user, "ci.create");
}

export function canManageVisualImprovement(user: AdminUser | undefined, currentUser: DemoUser, item: VisualImprovement) {
  if (currentUser.isSuperAdmin) return hasPlatformLegacyOperationalAccess("visualImprovement", item.plant);
  if (!user || user.status !== "Active") return false;
  if (hasRole(user, ["Admin"])) return true;
  if (hasRole(user, ["Zone Leader"]) && item.zone === currentUser.primaryZone) return true;
  return item.ownerId === currentUser.id || item.createdById === currentUser.id || item.participants.some((person) => person.id === currentUser.id) || hasPermission(user, "ci.implement");
}

export function canReviewVisualImprovement(user: AdminUser | undefined, currentUser: DemoUser, item: VisualImprovement) {
  if (currentUser.isSuperAdmin) return hasPlatformLegacyOperationalAccess("visualImprovement", item.plant) && item.createdById !== currentUser.id;
  if (!user || user.status !== "Active") return false;
  if (hasRole(user, ["Admin", "Auditor"]) || hasPermission(user, "actions.review")) return true;
  return item.zone === currentUser.primaryZone && (hasRole(user, ["Zone Leader"]) || hasPermission(user, "ci.review"));
}

export function canCreateVisualImprovementAction(user: AdminUser | undefined, currentUser: DemoUser) {
  return currentUser.isSuperAdmin ? hasPlatformLegacyOperationalAccess("visualImprovement") : Boolean(user?.status === "Active" && hasPermission(user, "actions.create"));
}
