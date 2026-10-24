"use client";

import { useState } from "react";
import { Check, Circle, Settings2 } from "lucide-react";
import { AccessV4Panel, DepartmentDialog } from "@/features/five-s/administration/access-v4-panel";
import { FactoryUserDialog, ZoneDialog } from "@/features/five-s/administration/access-v3-page";
import { getFactorySeatUsage } from "@/features/five-s/administration/access-v3-store";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { getAllOrganizationConfiguration, useOrganizationConfiguration, type OrganizationPlant } from "@/lib/organization-store";
import { useModuleEntitlements } from "@/lib/module-entitlements";
import { ACCESS_CAPABILITIES } from "@/lib/modules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/ui/progress-bar";
import { getFactorySetupReadiness, type FactorySetupStep } from "./factory-onboarding";
import { FactoryMemberAssignmentsDialog } from "./factory-member-assignments-dialog";

function statusVariant(status: FactorySetupStep["status"]): "success" | "outline" | "muted" {
  return status === "Completed" ? "success" : status === "In progress" ? "outline" : "muted";
}

export function FactoryOnboardingDashboard({ organizationId, clientName, factory }: { organizationId: string; clientName: string; factory: OrganizationPlant }) {
  const accessV3 = useAccessV3State();
  const accessV4 = useAccessV4State();
  useOrganizationConfiguration();
  const moduleAccess = useModuleEntitlements();
  const [dialog, setDialog] = useState<"user" | "zone" | "department" | "members" | "">("");
  const [userId, setUserId] = useState<string>();
  const [showStructure, setShowStructure] = useState(false);
  const configuration = getAllOrganizationConfiguration();
  const readiness = getFactorySetupReadiness(organizationId, factory.id, configuration.zones, accessV3, accessV4);
  const usage = getFactorySeatUsage(factory.id);
  const memberships = accessV3.factoryMemberships.filter(item => item.organizationId === organizationId && item.plantId === factory.id && item.status === "Active");
  const departments = accessV4.departments.filter(item => item.organizationId === organizationId && item.plantId === factory.id && item.status === "Active");
  const enabledModules = ACCESS_CAPABILITIES.filter(item => moduleAccess[item.id]);

  function openUser(id?: string) { setUserId(id); setDialog("user"); }
  function manageStructure() { setShowStructure(true); requestAnimationFrame(() => document.getElementById("factory-structure-setup")?.scrollIntoView({ behavior: "smooth", block: "start" })); }

  return <section className="grid gap-7" aria-label="Factory Get Started">
    <header className="grid gap-4 border-b pb-6">
      <div><p className="text-sm font-medium text-primary">{clientName} · {factory.name}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome to OE</h1><p className="mt-2 text-sm text-muted-foreground">Let&apos;s set up your factory before starting operational activities.</p></div>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div><dt className="text-sm text-muted-foreground">Active users</dt><dd className="mt-1 text-2xl font-semibold">{usage.activeUsers} / {usage.maximumActiveUsers ?? "Not configured"}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Available user seats</dt><dd className="mt-1 text-2xl font-semibold">{usage.available ?? "Not configured"}</dd></div>
        <div><dt className="text-sm text-muted-foreground">Setup progress</dt><dd className="mt-1 text-2xl font-semibold">{readiness.progress}%</dd></div>
      </dl>
      <ProgressBar value={readiness.progress} className="h-2" />
      {!usage.configured && <p role="alert" className="text-sm text-destructive">Metric Mind must configure this factory&apos;s active user limit before users can be added.</p>}
      {usage.atCapacity && usage.configured && <p role="status" className="text-sm text-destructive">The factory has reached its active user limit ({usage.activeUsers} of {usage.maximumActiveUsers}). Deactivate a factory user or ask Metric Mind to increase the limit.</p>}
    </header>

    <div className="divide-y border-y">
      {readiness.steps.map((step, index) => <section key={step.id} className="grid gap-3 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
        <div className="flex min-w-0 gap-3">
          <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${step.status === "Completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{step.status === "Completed" ? <Check className="size-4" /> : <Circle className="size-3" />}</span>
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{index + 1}. {step.title}</p><Badge variant={statusVariant(step.status)}>{step.status}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
            {step.id === "departments" && departments.length > 0 && <div className="mt-3 grid gap-1 text-sm text-muted-foreground">{readiness.activeZones.map(zone => { const names = departments.filter(item => item.zoneId === zone.id).map(item => item.name); return names.length ? <p key={zone.id}><span className="font-medium text-foreground">{zone.name}:</span> {names.join(", ")}</p> : null; })}</div>}
          </div>
        </div>
        <div>{step.id === "users" ? <Button disabled={usage.atCapacity} onClick={() => openUser()}>{memberships.length ? "Add another user" : "Add User"}</Button> : step.id === "zones" ? <Button onClick={() => setDialog("zone")}>Create Zone</Button> : step.id === "departments" ? <Button disabled={!readiness.activeZones.length} onClick={() => setDialog("department")}>Create Department</Button> : step.id === "members" ? <Button disabled={!memberships.length || !readiness.activeZones.length} onClick={() => setDialog("members")}>Assign Members</Button> : <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={manageStructure}><Settings2 className="size-4" />Manage Responsibilities</Button></div>}</div>
      </section>)}
    </div>

    <section className="grid gap-2"><h2 className="text-sm font-semibold">Enabled modules</h2><div className="flex flex-wrap gap-2">{enabledModules.map(item => <Badge key={item.id} variant="outline">{item.label}</Badge>)}{!enabledModules.length && <p className="text-sm text-muted-foreground">No operational modules are enabled for this factory.</p>}</div><p className="text-sm text-muted-foreground">Metric Mind controls module availability independently from factory setup.</p></section>

    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={manageStructure}>Factory configuration</Button></div>
    {showStructure && <section id="factory-structure-setup" className="scroll-mt-6 border-t pt-6"><AccessV4Panel /></section>}
    {dialog === "user" && <FactoryUserDialog key={userId ?? "new"} organizationId={organizationId} plant={factory} userId={userId} onClose={() => { setDialog(""); setUserId(undefined); }} />}
    {dialog === "zone" && <ZoneDialog organizationId={organizationId} plantId={factory.id} onClose={() => setDialog("")} />}
    {dialog === "department" && <DepartmentDialog key={`${organizationId}:${factory.id}`} organizationId={organizationId} plantId={factory.id} onClose={() => setDialog("")} />}
    {dialog === "members" && <FactoryMemberAssignmentsDialog key={`${organizationId}:${factory.id}`} organizationId={organizationId} plantId={factory.id} factoryName={factory.name} onClose={() => setDialog("")} />}
  </section>;
}
