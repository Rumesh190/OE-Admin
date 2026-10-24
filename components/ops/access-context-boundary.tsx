"use client";
import { ScopedWorkspace } from "@/features/ops-dashboard/scoped-workspace";
import { getOrganizationAccess } from "@/lib/module-entitlements";
import { narrowAuditTaskHref } from "@/lib/actions/action-v4-policy";
import { canOpenScopedAuditModule } from "@/lib/five-s/audit-authorization";
import { getOrganizations } from "@/lib/organizations";
import { usePathname } from "next/navigation";
import { useCurrentUser } from "@/lib/current-user";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { useAccessContext, isLegacyABCOperationalContext } from "@/features/five-s/administration/access-v4-context";
import { ACCESS_CAPABILITIES } from "@/lib/modules";
import Link from "next/link";
import { Button } from "@/components/ui/button";

function ModuleAvailability({ title, description }: { title: string; description: string }) {
  return <section className="grid min-h-[360px] place-items-center p-6 text-center"><div className="max-w-xl"><p className="text-sm font-medium text-primary">{title}</p><h1 className="mt-2 text-2xl font-semibold">Module access unavailable</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-5 flex justify-center gap-2"><Button variant="outline" nativeButton={false} render={<Link href="/dashboard"/>}>Dashboard</Button><Button variant="outline" nativeButton={false} render={<Link href="/settings"/>}>View settings</Button></div></div></section>;
}
/** Remount on identity/context changes discards open dialogs and evidence previews. */
export function AccessContextBoundary({ children }: { children: React.ReactNode }) {
  const identity = useCurrentUser(); const accessV3 = useAccessV3State(); useAccessV4State();
  const { context, error, ready } = useAccessContext(); const path = usePathname();
  const clientAdminContext = Boolean(context && context.kind !== "platform" && accessV3.clientMemberships.some(membership => membership.userId === identity.id && membership.organizationId === context.organizationId && membership.status === "Active" && membership.clientAdmin));
  const legacySettings = path.startsWith("/settings/") && !["/settings/administration", "/settings/users", "/settings/appearance"].some(route => path === route || path.startsWith(`${route}/`));
  if (legacySettings && !ready) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading settings scope…</p>;
  if (legacySettings && !(identity.isSuperAdmin && context?.kind === "platform" && path === "/settings/module-access") && (error || !isLegacyABCOperationalContext(context))) return <section className="p-6"><h1 className="font-semibold">Tenant administration scope required</h1><p className="mt-2 text-sm text-muted-foreground">These legacy settings belong to the ABC compatibility scope. Manage the selected client and factory through Administration.</p></section>;
  const administration = path === "/settings" || path.startsWith("/settings/") || path === "/profile" || path === "/super-admin" || path.startsWith("/super-admin/");
  if (!ready && !administration) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading access context…</p>;
  if (!administration && identity.isSuperAdmin && !context) return path === "/dashboard" ? <ScopedWorkspace key={identity.id} mode="dashboard" /> : <section className="p-6"><h1 className="font-semibold">Platform administration scope</h1><p className="mt-2 text-sm text-muted-foreground">Platform identity does not grant factory operational authority. Select an operational demo persona to continue.</p></section>;
  const scopeKey = `${identity.id}:${context?.selectionId ?? "legacy-abc"}`;
  const scopedMain = path === "/dashboard" || path === "/reports";
  if (ready && context && !error && (!isLegacyABCOperationalContext(context) || clientAdminContext) && scopedMain) {
    const allowed = path === "/dashboard" || (context.kind === "factory" && getOrganizationAccess(context.organizationId).reports);
    if (allowed) return <div key={scopeKey} className="contents"><ScopedWorkspace mode={path === "/reports" ? "reports" : "dashboard"} /></div>;
  }
  const auditPath = path === "/audits" || path === "/5s/audits" || /^\/5s\/audits\/[^/]+\/report$/.test(path);
  const capability = ACCESS_CAPABILITIES.find(item => [item.route, ...(item.legacyRoutes ?? [])].some(route => path === route || path.startsWith(`${route}/`)));
  const entitledDemoModule = Boolean(context?.kind === "factory" && capability && getOrganizationAccess(context.organizationId)[capability.id]);
  const narrowOperational = (auditPath && canOpenScopedAuditModule()) || narrowAuditTaskHref(path) || entitledDemoModule;
  if (!administration && (error || (!isLegacyABCOperationalContext(context) && !narrowOperational))) {
    if (error) return <ModuleAvailability title="Scope unavailable" description={error}/>;
    if (context && context.kind !== "platform" && capability) {
      const enabled = getOrganizationAccess(context.organizationId)[capability.id];
      if (!enabled) return <ModuleAvailability title="Access unavailable" description={`${capability.label} is not enabled for the selected factory.`}/>;
      return <ModuleAvailability title="Access unavailable" description={`Your current role and factory context do not permit this ${capability.label} operation.`}/>;
    }
    return <ModuleAvailability title="Operational context required" description="Select a client and factory from the header before opening operational records."/>;
  }
  const organization = context?.organizationId ? getOrganizations().find(o => o.id === context.organizationId) : undefined;
  return <div key={`${identity.id}:${context?.selectionId ?? "legacy-abc"}`} className="contents">{organization?.demoDataset?.disposable && <p role="status" className="border-b bg-amber-50 px-6 py-2 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">{organization.name} demo · Generated disposable data</p>}{children}</div>;
}
