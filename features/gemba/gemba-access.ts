import { getAdminUser } from "@/features/five-s/administration/store";
import { getDeploymentRecipients } from "./gemba-deployment";
import type { GembaObservation, GembaState, GembaWalk } from "./types";
import { hasPlatformLegacyOperationalAccess } from "@/lib/platform-operational-access";
import { canCreateDemoModuleRecord } from "@/lib/demo/demo-module-creation";

export interface GembaAccessUser {
  id: string;
  primaryZone: string;
  isSuperAdmin: boolean;
}

export function canConductGembaWalk(roles: readonly string[] | undefined, user?: GembaAccessUser) {
  const configured = user ? getAdminUser(user.id) : undefined;
  return Boolean((user && canCreateDemoModuleRecord("gemba", user.id)) || (user?.isSuperAdmin && hasPlatformLegacyOperationalAccess("gemba")) || (configured?.status === "Active" && configured.roles.some((role) => role === "Admin" || role === "Auditor")));
}

export function canViewGembaWalk(walk: GembaWalk, user: GembaAccessUser, roles: readonly string[] | undefined) {
  const configured = getAdminUser(user.id);
  if (configured?.status !== "Active") return false;
  return user.isSuperAdmin
    || Boolean(roles?.some((role) => role === "Admin" || role === "Auditor"))
    || walk.zone === user.primaryZone
    || walk.leadId === user.id
    || walk.participants.some((person) => person.id === user.id);
}

export function visibleGembaWalks(walks: GembaWalk[], user: GembaAccessUser, roles: readonly string[] | undefined) {
  return walks.filter((walk) => canViewGembaWalk(walk, user, roles));
}

export function canMutateGembaWalk(walk: Pick<GembaWalk, "plant">, actor: { id: string } | undefined) {
  const user = actor ? getAdminUser(actor.id) : undefined;
  return Boolean((actor && canCreateDemoModuleRecord("gemba", actor.id)) || hasPlatformLegacyOperationalAccess("gemba", walk.plant) || (user?.status === "Active" && user.id !== "USR-OPS-SUPER-ADMIN" && user.roles.some(role => role === "Admin" || role === "Auditor") && (user.plant === walk.plant || user.plant === "All organizations")));
}

/** Current leadership plus retained Zone relationships grant observation-only access. */
export function canReceiveGembaObservation(walk: GembaWalk, observation: GembaObservation, userId: string) {
  return observation.gembaId === walk.id && Boolean(observation.horizontalDeployment?.enabled && getDeploymentRecipients(walk.plant, observation.horizontalDeployment.targetZoneIds).some(recipient => recipient.leaderUserId === userId));
}

/** Whitelisted projection: never return linked Action content, other observations or walk details. */
export function getSharedGembaObservation(state: GembaState, observationId: string, userId: string) {
  const observation = state.observations.find(item => item.id === observationId);
  const walk = observation && state.walks.find(item => item.id === observation.gembaId);
  if (!walk || !observation || !canReceiveGembaObservation(walk, observation, userId)) return null;
  return { id: observation.id, title: observation.title, description: observation.description, type: observation.type, location: observation.location, createdAt: observation.createdAt, evidence: observation.evidence, plant: walk.plant, zone: walk.zone, status: "Shared observation" };
}

export function receivedGembaObservations(state: GembaState, userId: string) {
  return state.observations.flatMap(observation => {
    const shared = getSharedGembaObservation(state, observation.id, userId);
    return shared ? [shared] : [];
  });
}
