"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LayoutDashboard, MapPin, Pencil, Settings2, Users } from "lucide-react";
import type { AdminUser } from "@/features/five-s/administration/types";
import type { PersistedDepartment } from "@/features/five-s/administration/access-v4-state";
import type { FactorySeatUsage } from "@/features/five-s/administration/access-v3-store";
import { AccessAdministrationPage, FactoryDialog } from "@/features/five-s/administration/access-v3-page";
import { authorizedContextOptions, selectAccessContext } from "@/features/five-s/administration/access-v4-context";
import type { OrganizationPlant, OrganizationZone } from "@/lib/organization-store";
import type { Organization } from "@/lib/organizations";
import { ACCESS_CAPABILITIES } from "@/lib/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import { useUrlState } from "@/lib/navigation/use-url-state";
import type { FactorySetupReadiness } from "./factory-onboarding";

type EnabledModule = (typeof ACCESS_CAPABILITIES)[number];

export function ClientAdminFactoryDashboard({
  client,
  factory,
  setup,
  usage,
  users,
  zones,
  departments,
  modules,
}: {
  client: Organization;
  factory: OrganizationPlant;
  setup: FactorySetupReadiness;
  usage: FactorySeatUsage;
  users: AdminUser[];
  zones: OrganizationZone[];
  departments: PersistedDepartment[];
  modules: EnabledModule[];
}) {
  const url = useUrlState();
  const router = useRouter();
  const [editingFactory, setEditingFactory] = useState(false);
  const view = url.params.get("view") === "administration" ? "administration" : "overview";
  const capacityUsed = usage.maximumActiveUsers
    ? Math.round((usage.activeUsers / usage.maximumActiveUsers) * 100)
    : 0;
  const uniqueUsers = [...new Map(users.map(user => [user.name.trim().toLowerCase(), user])).values()];
  function returnToClient() {
    const clientContext = authorizedContextOptions().find(context => context.kind === "client" && context.organizationId === client.id);
    if (!clientContext) return;
    selectAccessContext(clientContext);
    router.replace("/dashboard");
  }

  return <section className="grid gap-8" aria-label="Client Administrator factory dashboard">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 mb-3" onClick={returnToClient}><ArrowLeft className="size-4" />Back to factories</Button>
        <p className="text-sm font-medium text-primary">Factory overview</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{factory.name}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4" aria-hidden="true" />
          {factory.location || "Location not configured"} · {client.name}
        </p>
      </div>
      {view === "overview" && <div className="flex items-center gap-2"><Badge variant={setup.ready ? "success" : "warning"}>{setup.ready ? "Setup complete" : `${setup.progress}% configured`}</Badge><Button variant="outline" onClick={() => setEditingFactory(true)}><Pencil className="size-4" />Edit factory</Button></div>}
    </header>

    <OpsTabBar label="Factory dashboard sections" active={view} onChange={next => url.update({ view: next === "overview" ? undefined : next }, "push")} tabs={[{ id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "administration", label: "Administration", icon: Settings2 }]} />

    {view === "overview" && <><section className="rounded-2xl border bg-card p-6 shadow-sm" aria-labelledby="factory-capacity-heading">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 id="factory-capacity-heading" className="font-semibold">User capacity</h2>
              <p className="mt-1 text-sm text-muted-foreground">{usage.activeUsers} of {usage.maximumActiveUsers ?? "—"} login seats are in use</p>
            </div>
            <span className="text-2xl font-semibold tabular-nums">{usage.available ?? "—"}<span className="ml-1 text-sm font-normal text-muted-foreground">available</span></span>
          </div>
          <ProgressBar value={capacityUsed} className="mt-4 h-2" />
        </div>
        <dl className="grid grid-cols-3 gap-6 border-t pt-5 lg:min-w-[430px] lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Users</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{usage.activeUsers}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Zones</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{zones.length}</dd></div>
          <div><dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Departments</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{departments.length}</dd></div>
        </dl>
      </div>
    </section>

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <section aria-labelledby="enabled-modules-heading" className="rounded-2xl border bg-card p-5 shadow-sm">
        <div>
          <h2 id="enabled-modules-heading" className="text-lg font-semibold">Enabled modules</h2>
          <p className="mt-1 text-sm text-muted-foreground">Modules available for this factory.</p>
        </div>
        <div className="mt-4 grid border-t sm:grid-cols-2 sm:gap-x-6">
          {modules.map(module => {
            const Icon = module.icon;
            return <div key={module.id} className="flex items-center gap-3 border-b py-3.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary"><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{module.label}</span>
            </div>;
          })}
          {!modules.length && <p className="py-5 text-sm text-muted-foreground sm:col-span-2">No modules are enabled for this factory.</p>}
        </div>
      </section>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <section aria-labelledby="factory-structure-heading">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 id="factory-structure-heading" className="text-lg font-semibold">Factory structure</h2>
              <p className="mt-1 text-sm text-muted-foreground">Zones and their Departments.</p>
            </div>
            <Badge variant="outline">{setup.progress}% configured</Badge>
          </div>
          <div className="mt-4 divide-y border-t">
            {zones.map(zone => {
              const zoneDepartments = departments.filter(department => department.zoneId === zone.id);
              return <div key={zone.id} className="py-3">
                <div className="flex items-center justify-between gap-3"><span className="font-medium">{zone.name}</span><span className="text-xs text-muted-foreground">{zoneDepartments.length} {zoneDepartments.length === 1 ? "Department" : "Departments"}</span></div>
                <p className="mt-1 text-sm text-muted-foreground">{zoneDepartments.map(department => department.name).join(", ") || zone.department || "No Department added"}</p>
              </div>;
            })}
            {!zones.length && <p className="py-5 text-sm text-muted-foreground">No Zones are configured.</p>}
          </div>
        </section>

        <section aria-labelledby="factory-users-heading" className="mt-6 border-t pt-5">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="factory-users-heading" className="font-semibold">Factory users</h2>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {uniqueUsers.slice(0, 8).map(user => <span key={user.id} className="inline-flex items-center gap-2 rounded-full border bg-background py-1 pl-1 pr-2.5 text-sm">
              <span className="grid size-6 place-items-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">{user.name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>
              {user.name}
            </span>)}
            {uniqueUsers.length > 8 && <Badge variant="muted" className="rounded-full">+{uniqueUsers.length - 8} more</Badge>}
            {!uniqueUsers.length && <p className="text-sm text-muted-foreground">No active users are assigned.</p>}
          </div>
        </section>
      </div>
    </div></>}

    {view === "administration" && <section id="administration" aria-labelledby="factory-management-heading">
      <div className="mb-6 flex flex-col gap-1">
        <p className="text-sm font-medium text-primary">Administration</p>
        <h2 id="factory-management-heading" className="mt-1 text-2xl font-semibold tracking-tight">Manage {factory.name}</h2>
        <p className="mt-2 text-sm text-muted-foreground">Manage factory users, Zones, Departments and responsibilities.</p>
      </div>
      <AccessAdministrationPage embedded />
    </section>}
    {editingFactory && <FactoryDialog organizationId={client.id} plant={factory} onClose={() => setEditingFactory(false)} />}
  </section>;
}
