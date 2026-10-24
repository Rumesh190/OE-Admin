import { getOrganizations } from "@/lib/organizations";
import type { AdminUser } from "@/features/five-s/administration/types";
import { hasPermission } from "@/features/five-s/administration/permissions";
import type { DemoUser } from "@/lib/current-user";
import { DEMO_ORGANIZATION } from "@/lib/module-entitlements";

type Identity = Pick<DemoUser, "id" | "isSuperAdmin">;

export function isActivePlatformSuperAdmin(identity: Identity, user: AdminUser | undefined) {
  return Boolean(user?.id === identity.id && user.status === "Active"
    && identity.id === "USR-OPS-SUPER-ADMIN" && identity.isSuperAdmin);
}

export function canManageAuditConfiguration(identity: Identity, user: AdminUser | undefined, organizationId = DEMO_ORGANIZATION.id) {
  if (!user || user.id !== identity.id || user.status !== "Active") return false;
  if (!getOrganizations().some(organization => organization.id === organizationId)) return false;
  if (isActivePlatformSuperAdmin(identity, user)) return true;
  // The current OPS user directory and normal application shell belong to the demo organization.
  // Do not infer membership of another organization from a permission or caller-supplied ID.
  return organizationId === DEMO_ORGANIZATION.id && hasPermission(user, "administration.manage_configuration");
}

/** Question management is reserved for Admin and platform Super Admin roles. */
export function canManageAuditQuestions(identity: Identity, user: AdminUser | undefined, organizationId = DEMO_ORGANIZATION.id) {
  return canManageAuditConfiguration(identity, user, organizationId)
    && (isActivePlatformSuperAdmin(identity, user) || Boolean(user?.roles.includes("Admin")));
}
