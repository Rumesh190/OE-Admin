"use client";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { useState } from "react";
import Link from "next/link";
import { useAccessContext } from "@/features/five-s/administration/access-v4-context";
import { useCurrentUser } from "@/lib/current-user";
import { useActionStore } from "@/lib/actions/action-store";
import { useFiveSAuditStore } from "@/lib/five-s/audit-store";
import { canReadV4Action, canVerifyV4Action, isV4Action } from "@/lib/actions/action-v4-policy";
import { canReadScopedAudit } from "@/lib/five-s/audit-authorization";
import { canOpenV4Administration, getFactorySeatUsage } from "@/features/five-s/administration/access-v3-store";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import { getFinalDemoManifest } from "@/lib/demo/final-demo";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";
import { getOrganizations, useOrganizations } from "@/lib/organizations";
import { getAllOrganizationConfiguration, useOrganizationConfiguration } from "@/lib/organization-store";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { getFactoryAccess, useModuleEntitlements } from "@/lib/module-entitlements";
import { ACCESS_CAPABILITIES } from "@/lib/modules";
import { resolveFactoryPerson } from "@/features/five-s/administration/factory-authorization";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { getFactorySetupReadiness } from "./factory-onboarding";
import { FactoryOnboardingDashboard } from "./factory-onboarding-dashboard";
import { OperationalDashboard } from "./operational-dashboard";
import { ClientAdminFactoryDashboard } from "./client-admin-factory-dashboard";
import { ClientAdminOverview } from "./client-admin-overview";
import { useVisibleModuleAccess } from "@/lib/navigation/visible-module-access";

/** Scoped projection on the primary routes. Reads the existing stores and record policies. */
export function ScopedWorkspace({ mode }: { mode: "dashboard" | "reports" | "actions" }) {
  const person = useCurrentUser();
  const { context } = useAccessContext();
  useOrganizations(); useOrganizationConfiguration();
  const accessV3 = useAccessV3State();
  const accessV4 = useAccessV4State();
  const directory = useAdminUsers(true);
  const moduleAccess = useModuleEntitlements();
  const visibleModuleAccess = useVisibleModuleAccess();
  const actions = useActionStore().filter(action => isV4Action(action) && canReadV4Action(action));
  const audits = useFiveSAuditStore().filter(a => a.policyVersion === "ops-access-v4" && canReadScopedAudit(a));
  const [search, setSearch] = useState("");
  const url = useUrlState();
  const tab = url.params.get("tab") ?? "All";
  const status = tab.toLowerCase() === "all" ? "All" : tab;
  const setStatus = (value: string) => url.update({ tab: value }, "push");
  const statuses = [...new Set(actions.map(a => a.status))].sort();
  const visible = actions.filter(a => (status === "All" || a.status === status) && `${a.id} ${a.title} ${a.status}`.toLowerCase().includes(search.toLowerCase()));
  const configuration = getAllOrganizationConfiguration();
  const selectedClient = context?.kind === "factory" ? getOrganizations().find(item => item.id === context.organizationId) : undefined;
  const selectedFactory = context?.kind === "factory" ? configuration.plants.find(item => item.id === context.plantId && (item.organizationId ?? "abc-manufacturing") === context.organizationId) : undefined;
  const factoryZones = context?.kind === "factory" ? configuration.zones.filter(item => item.plantId === context.plantId && item.status === "Active") : [];
  const factoryDepartments = context?.kind === "factory" ? accessV4.departments.filter(item => item.organizationId === context.organizationId && item.plantId === context.plantId && item.status === "Active") : [];
  const factoryUsage = selectedFactory ? getFactorySeatUsage(selectedFactory.id) : undefined;
  const factoryUsers = context?.kind === "factory" ? [...new Set(accessV3.factoryMemberships.filter(item => item.organizationId === context.organizationId && item.plantId === context.plantId && item.status === "Active").map(item => item.userId))].flatMap(userId => { const user = directory.find(item => item.id === userId && item.status === "Active"); return user ? [user] : []; }) : [];
  const enabledModules = ACCESS_CAPABILITIES.filter(capability => moduleAccess[capability.id]);
  const factoryActor = context?.kind === "factory" ? resolveFactoryPerson(person.id, context) : undefined;
  const factoryAssignments = context?.kind === "factory" ? accessV4.assignments.filter(item => item.personId === person.id && item.organizationId === context.organizationId && item.plantId === context.plantId && item.status === "Active") : [];
  const factorySetup = context?.kind === "factory" ? getFactorySetupReadiness(context.organizationId, context.plantId, configuration.zones, accessV3, accessV4) : undefined;
  const requiresColdStart = Boolean(factorySetup && factorySetup.steps.some(step => ["users", "zones", "departments"].includes(step.id) && step.status !== "Completed"));
  if (person.isSuperAdmin && context?.kind === "platform") {
    const clients = getOrganizations(); const factories = getAllOrganizationConfiguration().plants;
    return <section className="grid gap-6" aria-label="Platform overview"><div><p className="text-sm text-muted-foreground">Metric Mind · Platform Super Admin</p><h1 className="mt-1 text-2xl font-semibold">Platform overview</h1><p className="mt-2 text-sm text-muted-foreground">Select a client and factory in the header before opening tenant-owned operational records.</p></div><dl className="grid gap-4 border-y py-5 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Active clients</dt><dd className="text-2xl font-semibold">{clients.filter(item => item.status === "Active").length}</dd></div><div><dt className="text-sm text-muted-foreground">Active factories</dt><dd className="text-2xl font-semibold">{factories.filter(item => item.status === "Active").length}</dd></div></dl><div className="flex flex-wrap gap-2"><Button nativeButton={false} render={<Link href="/super-admin/organizations"/>}>Clients & subscriptions</Button><Button nativeButton={false} variant="outline" render={<Link href="/settings/administration"/>}>Administration</Button><Button nativeButton={false} variant="outline" render={<Link href="/settings"/>}>Settings</Button></div></section>;
  }
  if (context?.kind === "client") {
    const client = getOrganizations().find(item => item.id === context.organizationId);
    const factories = getAllOrganizationConfiguration().plants.filter(item => (item.organizationId ?? "abc-manufacturing") === context.organizationId);
    const factoryIds = new Set(factories.map(item => item.id));
    const activeFactoryAdmins = accessV3.factoryAdmins.filter(item => item.organizationId === context.organizationId && factoryIds.has(item.plantId) && item.status === "Active");
    if (client) return <ClientAdminOverview client={client} factories={factories.map(factory => ({ factory, usage: getFactorySeatUsage(factory.id), moduleCount: ACCESS_CAPABILITIES.filter(capability => getFactoryAccess(context.organizationId, factory.id)[capability.id]).length, zoneCount: configuration.zones.filter(zone => zone.plantId === factory.id && zone.status === "Active").length, departmentCount: accessV4.departments.filter(department => department.organizationId === context.organizationId && department.plantId === factory.id && department.status === "Active").length, administratorCount: activeFactoryAdmins.filter(item => item.plantId === factory.id).length }))} />;
  }
  if (mode === "dashboard" && selectedClient && selectedFactory && factoryActor?.clientAdmin && factorySetup && requiresColdStart) {
    return <FactoryOnboardingDashboard organizationId={selectedClient.id} clientName={selectedClient.name} factory={selectedFactory} />;
  }
  if (mode === "dashboard" && selectedClient && selectedFactory && factoryActor?.clientAdmin && factorySetup && !requiresColdStart && factoryUsage) {
    return <ClientAdminFactoryDashboard client={selectedClient} factory={selectedFactory} setup={factorySetup} usage={factoryUsage} users={factoryUsers} zones={factoryZones} departments={factoryDepartments} modules={enabledModules} />;
  }
  if (mode === "dashboard" && selectedClient && selectedFactory && factoryActor?.valid && !factoryActor.clientAdmin && !factoryActor.factoryAdmin) {
    const scopeLabels = [...new Set([
      ...factoryActor.allocations.map(item => factoryZones.find(zone => zone.id === item.zoneId)?.name).filter((name): name is string => Boolean(name)),
      ...factoryAssignments.flatMap(item => [item.zoneId ? factoryZones.find(zone => zone.id === item.zoneId)?.name : undefined, item.departmentId ? factoryDepartments.find(department => department.id === item.departmentId)?.name : undefined].filter((name): name is string => Boolean(name))),
    ])];
    const myActions = actions.filter(action => action.responsiblePersonId === person.id && action.status !== "Completed");
    const pendingReviews = actions.filter(action => ["Pending Review", "Pending Auditor Review", "Awaiting Review"].includes(action.status) && canVerifyV4Action(action, person.id));
    return <OperationalDashboard person={person} client={selectedClient} factory={selectedFactory} scopeLabels={scopeLabels} assignments={factoryAssignments} actions={myActions} audits={audits} pendingReviews={pendingReviews} access={visibleModuleAccess}/>;
  }
  return <section className="grid gap-6" aria-label="Scoped operational workspace">
    {getFinalDemoManifest() && selectedClient?.demoDataset?.disposable && <p role="status" className="border-b pb-3 text-sm text-amber-800 dark:text-amber-200">{selectedClient.name} demo · Isolated disposable storage · Production activation is not authorized</p>}
    <div><p className="text-sm text-muted-foreground">{person.name} · {person.role}</p><h1 className="mt-1 text-2xl font-semibold">{mode === "actions" ? "Actions" : mode === "reports" ? "Reports" : selectedFactory ? `${selectedFactory.name} dashboard` : "Dashboard"}</h1><p className="mt-2 text-sm text-muted-foreground">{selectedClient && selectedFactory ? `${selectedClient.name} · ${selectedFactory.name}. ` : ""}Records and summaries follow the current identity, factory context, module entitlements, and role permissions.</p></div>
    {mode === "dashboard" && selectedFactory && <section className="grid gap-4" aria-label="Factory overview"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">Factory overview</h2><p className="mt-1 text-sm text-muted-foreground">Canonical configuration for {selectedClient?.name ?? "the selected client"} · {selectedFactory.name}</p></div>{factorySetup && <Badge variant={factorySetup.ready ? "success" : "warning"}>{factorySetup.ready ? "Setup complete" : `${factorySetup.progress}% setup`}</Badge>}</div><dl className="grid gap-4 border-y py-5 sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-sm text-muted-foreground">Active users</dt><dd className="text-2xl font-semibold">{factoryUsage?.activeUsers ?? 0}</dd></div><div><dt className="text-sm text-muted-foreground">Login limit</dt><dd className="text-2xl font-semibold">{factoryUsage?.maximumActiveUsers ?? "Not configured"}</dd></div><div><dt className="text-sm text-muted-foreground">Active Zones</dt><dd className="text-2xl font-semibold">{factoryZones.length}</dd></div><div><dt className="text-sm text-muted-foreground">Active Departments</dt><dd className="text-2xl font-semibold">{factoryDepartments.length}</dd></div></dl><div><h3 className="text-sm font-semibold">Enabled modules</h3><div className="mt-2 flex flex-wrap gap-2">{enabledModules.map(module => <Badge key={module.id} variant="outline">{module.label}</Badge>)}{!enabledModules.length && <p className="text-sm text-muted-foreground">No operational modules are enabled for this factory.</p>}</div></div><div className="grid gap-2 text-sm"><p><span className="font-medium">Users:</span> {factoryUsers.map(user => user.name).join(", ") || "None configured"}</p><div className="grid gap-2 sm:grid-cols-2"><p><span className="font-medium">Zones:</span> {factoryZones.map(zone => zone.name).join(", ") || "None configured"}</p><p><span className="font-medium">Departments:</span> {factoryDepartments.map(department => department.name).join(", ") || "None configured"}</p></div></div></section>}
    {mode !== "actions" && <dl className="grid gap-4 border-y py-5 sm:grid-cols-3"><div><dt className="text-sm text-muted-foreground">Authorized Audits</dt><dd className="text-2xl font-semibold">{audits.length}</dd></div><div><dt className="text-sm text-muted-foreground">Open Actions</dt><dd className="text-2xl font-semibold">{actions.filter(a => a.status !== "Completed").length}</dd></div><div><dt className="text-sm text-muted-foreground">Completed Actions</dt><dd className="text-2xl font-semibold">{actions.filter(a => a.status === "Completed").length}</dd></div></dl>}
    {mode === "dashboard" && <div className="flex flex-wrap gap-2">{canOpenV4Administration() && <Button nativeButton={false} variant="outline" render={<Link href="/settings/administration" />}>{context?.kind === "factory" ? "Factory configuration" : "Administration"}</Button>}<Button nativeButton={false} variant="outline" render={<Link href="/settings" />}>Settings</Button></div>}
    <div className="grid gap-4"><h2 className="text-lg font-semibold">Authorized Actions · {actions.length}</h2><OpsTabBar label="Action status tabs" active={status} onChange={setStatus} tabs={[{ id: "All", label: "All", count: actions.length }, ...statuses.map(s => ({ id: s, label: s, count: actions.filter(a => a.status === s).length }))]} /><div className="flex flex-wrap gap-3"><Input aria-label="Search Actions" placeholder="Search Actions" className="max-w-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
      <div className="divide-y border-y">{visible.map(a => <div key={a.id} className="flex flex-wrap items-center gap-3 py-4"><Link className="min-w-0 flex-1 rounded-md outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" href={`/actions/${encodeURIComponent(a.id)}`}><p className="text-sm text-muted-foreground">{a.id} · Audit {a.sourceId}</p><p className="font-medium">{a.title}</p><p className="text-sm text-muted-foreground">{a.assignedTo} · Due {a.dueDate}</p></Link><Badge variant="outline">{a.status}</Badge><RecordDeletionMenu module="action" recordId={a.id} /></div>)}{!visible.length && <p className="py-6 text-sm text-muted-foreground">No authorized Actions match this selection.</p>}</div>
    </div>
    {mode !== "actions" && <div className="grid gap-3"><h2 className="text-lg font-semibold">Authorized Audits</h2>{audits.map(a => <Link key={a.id} className="rounded-md border-b py-3 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" href={`/audits?audit=${encodeURIComponent(a.id)}`}>{a.title} · {a.status}</Link>)}{!audits.length && <p className="text-sm text-muted-foreground">No Audits are assigned to this identity.</p>}</div>}
  </section>;
}
