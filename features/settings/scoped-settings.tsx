"use client";
import Link from "next/link";
import { useCurrentUser } from "@/lib/current-user";
import { useAccessContext } from "@/features/five-s/administration/access-v4-context";
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { resolveFactoryPerson } from "@/features/five-s/administration/factory-authorization";
import { hasClientAdministration } from "@/features/five-s/administration/access-v3-store";
import { PageContainer } from "@/components/layout/page-container";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useFactoryAccess } from "@/lib/module-entitlements";
import { ACCESS_CAPABILITIES } from "@/lib/modules";
import { Badge } from "@/components/ui/badge";
import { EgmoreDemoControls } from "@/features/settings/egmore-demo-controls";
export function ScopedSettings() {
  const person = useCurrentUser(); const { context, error } = useAccessContext(); const state = useAccessV4State();
  const fa = context?.kind === "factory" && resolveFactoryPerson(person.id, context).factoryAdmin;
  const ca = Boolean(context && context.kind !== "platform" && hasClientAdministration(context.organizationId, person.id));
  const factoryViewer = context?.kind === "factory" && (fa || hasClientAdministration(context.organizationId, person.id));
  const factoryAccess = useFactoryAccess(context?.kind === "factory" ? context.organizationId : "__no-client__", context?.kind === "factory" ? context.plantId : "__no-factory__");
  const assignments = state.assignments.filter(a => context?.kind === "factory" && a.personId === person.id && a.organizationId === context.organizationId && a.plantId === context.plantId && a.status === "Active");
  const dl = assignments.some(a => a.role === "Department Leader");
  const champion = assignments.some(a => a.role === "Zone Champion");
  const links = [{ href: "/profile?tab=preferences", title: "Personal preferences", description: "Appearance and your profile preferences" }];
  if (person.isSuperAdmin && context?.kind === "platform") links.unshift({ href: "/super-admin/organizations", title: "Clients & subscriptions", description: "Platform client, factory and module administration" });
  if (ca) links.unshift({ href: "/settings/administration", title: "Client administration", description: "Factories and explicit Factory Admin appointments in this client" });
  if (!ca) {
    if (fa) links.unshift({ href: "/settings/administration", title: "Factory administration", description: "Users, Zones, Departments, independent roles and Auditor authorizations in this factory" });
    else if (dl) links.unshift({ href: "/settings/administration", title: "Department allocations", description: "Manage permitted member allocations in your existing Department" });
    else if (champion) links.unshift({ href: "/settings/administration", title: "Factory oversight", description: "Read approved Department oversight; no factory administration authority" });
  }
  return <PageContainer><FiveSPageHeader eyebrow={person.role} title="Settings & Administration" description={`${person.name} · Settings follow current canonical assignments and selected scope.`} />{error && <p role="alert" className="text-destructive">{error}</p>}<div className="divide-y border-y">{links.map(link => <Link key={link.href} className="block rounded-md py-5 outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring" href={link.href}><h2 className="font-semibold">{link.title}</h2><p className="mt-1 text-sm text-muted-foreground">{link.description}</p></Link>)}</div>{person.isSuperAdmin && context?.kind === "platform" && process.env.NODE_ENV === "development" && <EgmoreDemoControls />}{factoryViewer && <section><div><h2 className="font-semibold">Factory module access</h2><p className="mt-1 text-sm text-muted-foreground">Read-only entitlement state managed by Metric Mind for the selected factory.</p></div><div className="mt-3 flex flex-wrap gap-2">{ACCESS_CAPABILITIES.map(item => <Badge key={item.id} variant={factoryAccess[item.id] ? "success" : "muted"}>{item.label}: {factoryAccess[item.id] ? "Enabled" : "Disabled"}</Badge>)}</div></section>}<p className="text-sm text-muted-foreground">{ca ? "Select a factory to review its modules or use Administration to manage factories, users, Zones, Departments and approved role assignments." : fa ? "Factory module configuration is read-only; Metric Mind controls availability." : "Operational roles retain their permitted work and review responsibilities."}</p></PageContainer>;
}
