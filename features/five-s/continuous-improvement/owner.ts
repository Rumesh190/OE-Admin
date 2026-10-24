import type { AdminUser } from "@/features/five-s/administration/types";
import { getAdminUser } from "@/features/five-s/administration/store";
import type { ContinuousImprovement } from "./types";
import { canCreateDemoModuleRecord } from "@/lib/demo/demo-module-creation";

export function selectableImprovementOwners(users: readonly AdminUser[], plant: string, zone: string) {
  const demoCreation = canCreateDemoModuleRecord("continuousImprovement");
  return users
    .filter((user) => user.status === "Active" && user.plant === plant && (demoCreation ? user.zoneMemberships.some((membership) => membership.zone === zone) : user.permissions.includes("ci.implement") && (user.roles.includes("Admin") || user.zoneMemberships.some((membership) => membership.zone === zone))))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function improvementOwnerDisplayName(item: Pick<ContinuousImprovement, "ownerId" | "ownerName">) {
  const canonical = item.ownerId ? getAdminUser(item.ownerId) : undefined;
  return canonical?.name ?? (item.ownerName?.trim() || "Owner unavailable");
}
