"use client";

import Link from "next/link";
import { ArrowRight, ClipboardCheck, ListTodo, ShieldCheck } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { MyAction } from "@/features/five-s/types/my-actions";
import type { FiveSAudit } from "@/features/five-s/types/five-s";
import type { PersistedAssignment } from "@/features/five-s/administration/access-v4-state";
import type { OrganizationPlant } from "@/lib/organization-store";
import type { Organization } from "@/lib/organizations";
import type { DemoUser } from "@/lib/current-user";
import { ACCESS_CAPABILITIES } from "@/lib/modules";
import type { OrganizationAccess } from "@/lib/module-entitlements";
import { Button } from "@/components/ui/button";

export function OperationalDashboard({ person, client, factory, scopeLabels, assignments, actions, audits, pendingReviews, access }: {
  person: DemoUser;
  client: Organization;
  factory: OrganizationPlant;
  scopeLabels: string[];
  assignments: PersistedAssignment[];
  actions: MyAction[];
  audits: FiveSAudit[];
  pendingReviews: MyAction[];
  access: OrganizationAccess;
}) {
  const responsibilities = [...new Set([person.role, ...assignments.map(item => item.role)])];
  const modules = ACCESS_CAPABILITIES.filter(item => access[item.id]);
  const work: Array<{ label: string; value: number; icon: LucideIcon; href: string }> = [];
  if (access.actions) work.push({ label: "My Open Actions", value: actions.length, icon: ListTodo, href: "/actions" });
  if (access.actions && pendingReviews.length > 0) work.push({ label: "Pending Reviews", value: pendingReviews.length, icon: ShieldCheck, href: "/actions" });
  if (access.audit) work.splice(1, 0, { label: "My Authorized Audits", value: audits.length, icon: ClipboardCheck, href: "/audits" });
  return <section className="grid gap-8" aria-label="Operational dashboard">
    <header className="border-b pb-6"><p className="text-sm font-medium text-primary">{client.name} · {factory.name}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Welcome back, {person.name}</h1><p className="mt-2 text-sm text-muted-foreground">{responsibilities.join(" · ")}{scopeLabels.length ? ` · ${scopeLabels.join(", ")}` : ""}</p></header>
    <section className="grid gap-4"><div><h2 className="text-lg font-semibold">My Work</h2><p className="mt-1 text-sm text-muted-foreground">Work available to your current identity and factory scope.</p></div><div className="grid gap-3 sm:grid-cols-3">{work.map(item => { const Icon = item.icon; return <Link key={item.label} href={item.href} className="group rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"><Icon className="size-5 text-muted-foreground"/><p className="mt-5 text-2xl font-semibold">{item.value}</p><p className="mt-1 text-sm text-muted-foreground">{item.label}</p></Link>; })}</div>{work.every(item => item.value === 0) && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">You have no assigned work in this factory right now.</p>}</section>
    <section className="grid gap-4"><div><h2 className="text-lg font-semibold">My Modules</h2><p className="mt-1 text-sm text-muted-foreground">Modules enabled for this factory and available to your current role.</p></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modules.map(module => { const Icon = module.icon; return <Link key={module.id} href={module.route} className="group flex items-center gap-3 rounded-xl border bg-card p-4 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary"><Icon className="size-5"/></span><span className="min-w-0 flex-1"><span className="block font-semibold">{module.label}</span><span className="block truncate text-xs text-muted-foreground">{module.description}</span></span><ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"/></Link>; })}</div>{!modules.length && <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No operational modules are currently available for this role and factory.</p>}</section>
    <div><Button nativeButton={false} variant="outline" render={<Link href="/profile"/>}>My Profile</Button></div>
  </section>;
}
