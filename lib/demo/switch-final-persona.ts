"use client";
import { getAdminUser } from "@/features/five-s/administration/store";
import { ACCESS_CONTEXT_KEY, authorizedContextOptions, notifyAccessContextChanged, selectAccessContext } from "@/features/five-s/administration/access-v4-context";
import { ADMIN_DEMO_SUBJECT_KEY, notifyDemoIdentityChanged, stageDemoIdentity } from "@/lib/current-user";
import type { CanonicalProfileTarget } from "./canonical-profiles";

export type DemoPersonaTarget = CanonicalProfileTarget;

/** Demo identity selection, never a permission grant. Missing/revoked memberships fail closed. */
export function switchFinalDemoPersona(personId: string, target?: DemoPersonaTarget) {
  if (getAdminUser(personId)?.status !== "Active") throw new Error("This profile is inactive or unavailable.");
  const keys = ["five-s-demo-role", ADMIN_DEMO_SUBJECT_KEY, ACCESS_CONTEXT_KEY] as const;
  const before = new Map(keys.map(key => [key, window.localStorage.getItem(key)]));
  try {
    stageDemoIdentity(personId);
    const options = authorizedContextOptions();
    const selected = target ? options.find(context => {
      if (target.kind === "platform") return context.kind === "platform";
      if (target.kind === "client") return context.kind === "client" && context.organizationId === target.organizationId;
      return context.kind === "factory" && context.organizationId === target.organizationId && context.plantId === target.plantId;
    }) : options.find(context => context.kind === "client") ?? options.find(context => context.kind === "factory") ?? options.find(context => context.kind === "platform");
    if (!selected) throw new Error("The selected persona has no active authorized demo scope. Open Administration to review its membership.");
    selectAccessContext(selected, false);
  } catch (error) {
    try {
      before.forEach((value, key) => value === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, value));
    } catch {
      notifyDemoIdentityChanged();
      notifyAccessContextChanged();
      throw new Error("Profile switching failed and the previous browser context could not be fully restored. Stop operational work and restore the saved demo dataset.");
    }
    notifyDemoIdentityChanged();
    notifyAccessContextChanged();
    throw error;
  }
  notifyDemoIdentityChanged();
  notifyAccessContextChanged();
}
