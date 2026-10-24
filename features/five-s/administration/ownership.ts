"use client";
import { getOutstandingUserImprovements, reassignImprovementOwnerForDeactivation } from "../continuous-improvement/store";
import { selectableImprovementOwners } from "../continuous-improvement/owner";
import { reassignActionOwner } from "@/lib/actions/action-store";
import { getFiveSZoneConfiguration } from "@/lib/five-s/configuration";
import { getAdminUser, getAdminUsers, getOutstandingUserActions, setAdminUserActive } from "./store";
import { getOrganizationZones } from "@/lib/organization-store";

export function getUserTransferCandidates(userId: string) {
  const outstanding = getOutstandingUserActions(userId);
  return getAdminUsers().filter(user => user.id !== userId && user.status === "Active" && outstanding.every(action => getFiveSZoneConfiguration(action.area)?.members.some(member => member.id === user.id)));
}

export function getUserCITransferCandidates(userId: string) {
  const outstanding = getOutstandingUserImprovements(userId);
  return getAdminUsers().filter(user => user.id !== userId && user.status === "Active" && outstanding.every(item => selectableImprovementOwners([user], item.plant, item.zone).length > 0));
}

/** Save transfers before deactivation. Failures keep the account active.
 * Already saved transfers retain their history; retries transfer remaining work. */
export function deactivateUserWithActionTransfer(userId: string, replacementId: string, reason: string, actorId: string, ciReplacementId = replacementId) {
  const actor = getAdminUser(actorId);
  if (actor?.status !== "Active" || !actor.roles.includes("Admin") || !actor.permissions.includes("administration.manage_users")) throw new Error("Administration access is required.");
  if (userId === actorId) throw new Error("You cannot deactivate your own Admin account.");
  if (!getAdminUser(userId)) throw new Error("User not found.");
  if (getAdminUser(userId)?.accessModel === "v3") throw new Error("Use scoped administration for v3 profiles; legacy ownership transfer is not permitted.");
  if (getOrganizationZones().some(zone => zone.leaderId === userId)) throw new Error("Reassign this user's Zone Leader responsibility before deactivating the account.");
  const outstanding = getOutstandingUserActions(userId);
  if (outstanding.length && (!reason.trim() || !getUserTransferCandidates(userId).some(user => user.id === replacementId))) throw new Error("Select an eligible replacement owner and enter a transfer reason.");
  const improvements = getOutstandingUserImprovements(userId);
  if (improvements.some(item => actor.plant !== item.plant && actor.plant !== "All organizations")) throw new Error("Administration access to the CI Plant is required.");
  if (improvements.length && (!reason.trim() || !getUserCITransferCandidates(userId).some(user => user.id === ciReplacementId))) throw new Error("Select an eligible active CI replacement owner for all affected Zones and enter a transfer reason.");
  for (const action of outstanding) {
    if (!reassignActionOwner(action.id, actor, replacementId, reason)) throw new Error("Transfer could not be completed. The user remains active. Saved transfers are preserved; review remaining Actions and retry.");
  }
  for (const item of improvements) {
    if (!reassignImprovementOwnerForDeactivation(item.id, userId, ciReplacementId, reason, actorId)) throw new Error("CI transfer could not be completed. The user remains active. Saved transfers are preserved; review remaining ownership and retry.");
  }
  if (!setAdminUserActive(userId, false, actorId)) throw new Error("Ownership was transferred, but deactivation could not be saved. The user remains active; retry deactivation.");
  return true;
}
