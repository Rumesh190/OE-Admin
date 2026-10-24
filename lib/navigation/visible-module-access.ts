"use client";

import { useAccessContext } from "@/features/five-s/administration/access-v4-context";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { canOpenScopedAuditModule, requiresScopedAuditPolicy } from "@/lib/five-s/audit-authorization";
import { useCurrentUser } from "@/lib/current-user";
import { useModuleEntitlements } from "@/lib/module-entitlements";

/** Shared sidebar/dashboard projection. Route and command guards remain authoritative. */
export function useVisibleModuleAccess() {
  const identity = useCurrentUser();
  const access = useAccessV3State();
  useAccessV4State();
  const { context } = useAccessContext();
  const base = useModuleEntitlements();
  const entitlements = requiresScopedAuditPolicy() ? { ...base, audit: canOpenScopedAuditModule() } : base;
  const clientAdmin = Boolean(context && context.kind !== "platform" && access.clientMemberships.some(item => item.userId === identity.id && item.organizationId === context.organizationId && item.status === "Active" && item.clientAdmin));
  if (identity.isSuperAdmin) return Object.fromEntries(Object.keys(entitlements).map(key => [key, true])) as typeof entitlements;
  if (!context) return entitlements;
  return Object.fromEntries(Object.entries(entitlements).map(([key, enabled]) => [key, Boolean((clientAdmin || context.kind === "factory") && enabled)])) as typeof entitlements;
}
