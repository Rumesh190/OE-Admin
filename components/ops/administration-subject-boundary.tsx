"use client";
import { narrowAuditTaskHref } from "@/lib/actions/action-v4-policy";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useCurrentUser } from "@/lib/current-user";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { useAccessContext } from "@/features/five-s/administration/access-v4-context";
import { ACCESS_CAPABILITIES } from "@/lib/modules";
import { useVisibleModuleAccess } from "@/lib/navigation/visible-module-access";
import { Button } from "@/components/ui/button";
const subscribeHydration = () => () => {};
/** Factory-scoped demo profiles may open modules enabled for their current factory. */
export function AdministrationSubjectBoundary({ children }: {
    children: React.ReactNode;
}) {
    const current = useCurrentUser();
    const person = useAdminUsers(true).find(item => item.id === current.id);
    const path = usePathname();
    const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
    const state = useAccessV3State();
    const { context } = useAccessContext();
    const visibleModules = useVisibleModuleAccess();
    const clientAdminDashboard = path === "/dashboard" && context?.kind === "factory" && state.clientMemberships.some(membership => membership.userId === current.id && membership.organizationId === context.organizationId && membership.status === "Active" && membership.clientAdmin);
    const auditPath = path === "/audits" || path === "/5s/audits" || /^\/5s\/audits\/[^/]+\/report$/.test(path);
    const capability = ACCESS_CAPABILITIES.find(item => [item.route, ...(item.legacyRoutes ?? [])].some(route => path === route || path.startsWith(`${route}/`)));
    const enabledFactoryModule = Boolean(context?.kind === "factory" && capability && visibleModules[capability.id]);
    if (auditPath && !hydrated) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading Audit access…</p>;
    if (person?.accessModel === "v3" && !clientAdminDashboard && !enabledFactoryModule && !auditPath && !narrowAuditTaskHref(path) && !["/settings", "/profile"].some(route => path === route || path.startsWith(`${route}/`)))
        return <section className="mx-auto my-8 grid max-w-xl gap-4 rounded-xl border p-6"><h1 className="text-lg font-semibold">Administration profile</h1><p className="text-sm text-muted-foreground">This profile has no access to this operational route. Audit access follows explicit factory assignments and Auditor authorizations.</p><Button nativeButton={false} render={<Link href="/settings/administration"/>}>Open Administration</Button></section>;
    return children;
}
