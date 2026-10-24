"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Factory, MapPin, Pencil, Plus, ShieldCheck, Users } from "lucide-react";
import type { FactorySeatUsage } from "@/features/five-s/administration/access-v3-store";
import { FactoryDialog, FactoryRequestDialog } from "@/features/five-s/administration/access-v3-page";
import { authorizedContextOptions, selectAccessContext } from "@/features/five-s/administration/access-v4-context";
import type { OrganizationPlant } from "@/lib/organization-store";
import type { Organization } from "@/lib/organizations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";

export interface ClientFactorySummary {
  factory: OrganizationPlant;
  usage: FactorySeatUsage;
  moduleCount: number;
  zoneCount: number;
  departmentCount: number;
  administratorCount: number;
}

export function ClientAdminOverview({ client, factories }: {
  client: Organization;
  factories: ClientFactorySummary[];
}) {
  const router = useRouter();
  const [editingFactory, setEditingFactory] = useState<OrganizationPlant>();
  const [requestingFactory, setRequestingFactory] = useState(false);
  function openFactory(factory: OrganizationPlant) {
    const context = authorizedContextOptions().find(option => option.kind === "factory" && option.organizationId === client.id && option.plantId === factory.id);
    if (!context) return;
    selectAccessContext(context);
    router.push("/dashboard?view=administration");
  }

  return <section className="grid gap-8" aria-label="Client administration dashboard">
    <header className="border-b pb-6">
      <div>
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
          <span>Client administration</span>
          <Badge variant={client.status === "Active" ? "success" : "muted"}>{client.status}</Badge>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">{client.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Manage factories and review operational readiness across this client.</p>
      </div>
    </header>

    <section aria-labelledby="client-factories-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="client-factories-heading" className="text-lg font-semibold">Factories</h2>
          <p className="mt-1 text-sm text-muted-foreground">Select a factory to manage its people, Zones, Departments and responsibilities.</p>
        </div>
        <Button variant="outline" onClick={() => setRequestingFactory(true)}><Plus className="size-4" />Request factory</Button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        {factories.map(({ factory, usage, moduleCount, zoneCount, departmentCount, administratorCount }) => {
          const capacityUsed = usage.maximumActiveUsers ? Math.round((usage.activeUsers / usage.maximumActiveUsers) * 100) : 0;
          return <article key={factory.id} className="group relative rounded-xl border bg-card p-5 transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
            <button type="button" aria-label={`Manage ${factory.name}`} className="absolute inset-0 z-10 cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openFactory(factory)}><span className="sr-only">Manage {factory.name}</span></button>
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary transition-colors group-hover:bg-primary/[0.14]"><Factory className="size-5" /></span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold transition-colors group-hover:text-primary">{factory.name}</h3><Badge variant={factory.status === "Active" ? "success" : "muted"}>{factory.status}</Badge></div>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="size-3.5" />{factory.location || "Location not configured"}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant="outline">{moduleCount} modules</Badge>
                <Button size="sm" variant="ghost" className="relative z-20" onClick={() => setEditingFactory(factory)}><Pencil className="size-3.5" />Edit</Button>
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">Login capacity</span><span className="font-medium tabular-nums">{usage.activeUsers} / {usage.maximumActiveUsers ?? "—"}</span></div>
              <ProgressBar value={capacityUsed} className="mt-2 h-2" barClassName={usage.atCapacity ? "bg-amber-500" : undefined} />
            </div>

            <dl className="mt-5 grid grid-cols-3 gap-3 border-t pt-4">
              <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><Users className="size-3.5" />Users</dt><dd className="mt-1 font-semibold tabular-nums">{usage.activeUsers}</dd></div>
              <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="size-3.5" />Zones / Depts</dt><dd className="mt-1 font-semibold tabular-nums">{zoneCount} / {departmentCount}</dd></div>
              <div><dt className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />Admins</dt><dd className="mt-1 font-semibold tabular-nums">{administratorCount}</dd></div>
            </dl>
          </article>;
        })}
        {!factories.length && <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground xl:col-span-2">No factories belong to this client.</p>}
      </div>
    </section>
    {editingFactory && <FactoryDialog organizationId={client.id} plant={editingFactory} onClose={() => setEditingFactory(undefined)} />}
    {requestingFactory && <FactoryRequestDialog organizationId={client.id} onClose={() => setRequestingFactory(false)} />}
  </section>;
}
