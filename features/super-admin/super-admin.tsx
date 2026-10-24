"use client";

import { useAdminUsers } from "@/features/five-s/administration/store";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { getAllOrganizationConfiguration, useOrganizationConfiguration, type OrganizationPlant } from "@/lib/organization-store";
import { archiveClient, deactivateFactoryUser, getFactoryRemovalMode, getFactorySeatUsage, plantOrganization, removeFactory } from "@/features/five-s/administration/access-v3-store";
import { DEMO_ORGANIZATION, getOrganizations, useOrganizations } from "@/lib/organizations";
import { ClientProfileDialog, FactoryDialog, PlatformClientActions } from "@/features/five-s/administration/access-v3-page";
import { decideFactoryRequest } from "@/features/five-s/administration/access-v3-store";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  enabledFactoryModuleCount,
  saveFactoryAccess,
  useFactoryAccess,
  type Organization,
  type OrganizationAccess,
} from "@/lib/module-entitlements";
import { ACCESS_CAPABILITIES, OPERATIONAL_MODULES, SHARED_CAPABILITIES, type AccessCapabilityId } from "@/lib/modules";
import { PageContainer } from "@/components/layout/page-container";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { OpsTabBar } from "@/components/ops/ops-tabs";

function useOrganizationCounts(organizationId: string) {
  const state = useAccessV3State(); useOrganizationConfiguration(); const legacyUsers = useAdminUsers();
  const plants = getAllOrganizationConfiguration().plants.filter(p => plantOrganization(p) === organizationId);
  const members = new Set(state.clientMemberships.filter(m => m.organizationId === organizationId && m.status === "Active").map(m => m.userId));
  if (organizationId === DEMO_ORGANIZATION.id) for (const person of legacyUsers) if (person.id !== "USR-OPS-SUPER-ADMIN" && plants.some(p => p.name === person.plant)) members.add(person.id);
  return { plants: plants.length, users: members.size };
}

function organizationById(id: string) { return getOrganizations().find((organization) => organization.id === id); }

function OrganizationMissing() {
  return <PageContainer><FiveSPageHeader eyebrow="Super Admin" title="Organization not found" description="The requested organization is not available." /><Button nativeButton={false} render={<Link href="/super-admin/organizations" />} variant="outline">Back to Organizations</Button></PageContainer>;
}

function OrganizationTabs({ organization, active }: { organization: Organization; active: "overview" | "factories" }) {
  const items = [
    { label: "Overview", href: `/super-admin/organizations/${organization.id}`, id: "overview" },
    { label: "Factories", href: `/super-admin/organizations/${organization.id}/factories`, id: "factories" },
  ] as const;
  return <nav aria-label="Organization sections" className="flex gap-1 overflow-x-auto border-b border-border/70">
    {items.map((item) => <Link key={item.label} href={item.href} aria-current={active === item.id ? "page" : undefined} className={`relative shrink-0 px-3 py-2.5 text-sm font-medium ${active === item.id ? "text-primary after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-primary" : "text-muted-foreground hover:text-foreground"}`}>{item.label}</Link>)}
  </nav>;
}

export function OrganizationsPage() {
  const organizations = useOrganizations();
  const [creating, setCreating] = React.useState(false);
  return <PageContainer>
    <FiveSPageHeader eyebrow="Super Admin" title="Clients" description="Manage clients, factories and module access." actions={<Button onClick={() => setCreating(true)}>Create client</Button>} />{creating && <ClientProfileDialog onClose={() => setCreating(false)} />}
    <Card className="overflow-hidden"><Table><TableHeader><TableRow><TableHead>Client</TableHead><TableHead>Client Admin</TableHead><TableHead>Factories</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Manage</TableHead></TableRow></TableHeader><TableBody>{organizations.map((organization) => <OrganizationRow key={organization.id} organization={organization} />)}</TableBody></Table></Card>
  </PageContainer>;
}

function OrganizationRow({ organization }: { organization: Organization }) {
  const counts = useOrganizationCounts(organization.id);
  const state = useAccessV3State(); const people = useAdminUsers(true);
  const clientAdmin = state.clientMemberships.find(item => item.organizationId === organization.id && item.status === "Active" && item.clientAdmin);
  const [confirming, setConfirming] = React.useState(false); const [error, setError] = React.useState("");
  function archive() { try { archiveClient(organization.id); setConfirming(false); setError(""); } catch (reason) { setConfirming(false); setError(reason instanceof Error ? reason.message : "Unable to archive client."); } }
  return <><TableRow><TableCell><Link href={`/super-admin/organizations/${organization.id}`} className="font-medium hover:text-primary hover:underline">{organization.name}</Link>{error && <p role="alert" className="mt-1 max-w-sm text-xs text-destructive">{error}</p>}</TableCell><TableCell>{people.find(person => person.id === clientAdmin?.userId)?.name ?? "Provisioning incomplete"}</TableCell><TableCell>{counts.plants}</TableCell><TableCell><Badge variant={organization.status === "Active" ? "success" : "muted"}>{organization.status}</Badge></TableCell><TableCell className="text-right"><div className="flex justify-end gap-3"><Link href={`/super-admin/organizations/${organization.id}`} className="inline-flex items-center gap-1.5 font-medium text-primary">Manage <ArrowRight className="size-3.5" /></Link>{organization.status === "Active" && <button className="font-medium text-destructive hover:underline" onClick={() => setConfirming(true)}>Archive</button>}</div></TableCell></TableRow><AlertDialog open={confirming} onOpenChange={setConfirming}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archive {organization.name}?</AlertDialogTitle><AlertDialogDescription>This disables the client context without deleting its history. The action is blocked while factories, pending requests, or operational dependencies remain.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={archive}>Archive client</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></>;
}

export function OrganizationDetailPage({ organizationId }: { organizationId: string }) {
  useOrganizations();
  const counts = useOrganizationCounts(organizationId);
  const state = useAccessV3State(); const people = useAdminUsers(true);
  const organization = organizationById(organizationId);
  if (!organization) return <OrganizationMissing />;
  const membership = state.clientMemberships.find(item => item.organizationId === organizationId && item.status === "Active" && item.clientAdmin);
  return <PageContainer><FiveSPageHeader eyebrow="Super Admin / Clients" title={organization.name} description="Client overview" actions={<PlatformClientActions client={organization} />} /><OrganizationTabs organization={organization} active="overview" /><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Industry" value={organization.industry} /><Summary label="Factories" value={String(counts.plants)} /><Summary label="Client Admin" value={people.find(person => person.id === membership?.userId)?.name ?? "Provisioning incomplete"} /><Summary label="Status" value={organization.status} /></div></PageContainer>;
}

function FactoryManagement({ organization, factory, onEdit, onDeactivate }: { organization: Organization; factory: OrganizationPlant; onEdit: () => void; onDeactivate: (userId: string) => void }) {
  const state = useAccessV3State(); const people = useAdminUsers(true); const persisted = useFactoryAccess(organization.id, factory.id); const usage = getFactorySeatUsage(factory.id);
  const [tab, setTab] = React.useState("overview"); const [changes, setChanges] = React.useState<Partial<OrganizationAccess>>({}); const [success, setSuccess] = React.useState(false); const [error, setError] = React.useState("");
  const draft = { ...persisted, ...changes }; const changed = ACCESS_CAPABILITIES.some(capability => draft[capability.id] !== persisted[capability.id]);
  function saveModules() { setSuccess(false); setError(""); if (saveFactoryAccess(organization.id, factory.id, draft)) { setChanges({}); setSuccess(true); } else setError("Unable to save factory module access. Confirm Metric Mind authority and keep Actions enabled when an operational module requires it."); }
  const memberships = state.factoryMemberships.filter(item => item.plantId === factory.id);
  return <section className="grid gap-4 rounded-xl border bg-card p-4"><div><p className="text-sm text-muted-foreground">{organization.name}</p><h2 className="text-lg font-semibold">{factory.name}</h2></div><OpsTabBar label="Factory management sections" active={tab} onChange={setTab} tabs={[{ id: "overview", label: "Overview" }, { id: "modules", label: "Modules" }, { id: "users", label: "Users" }]}/>
    {tab === "overview" && <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Summary label="Factory" value={factory.name}/><Summary label="Parent client" value={organization.name}/><Summary label="Active users / maximum" value={`${usage.activeUsers} / ${usage.maximumActiveUsers ?? "Not configured"}`}/><Summary label="Enabled modules" value={String(enabledFactoryModuleCount(persisted))}/><div className="sm:col-span-2 lg:col-span-4"><Button variant="outline" onClick={onEdit}>Edit factory settings</Button></div></div>}
    {tab === "modules" && <div className="grid gap-4"><div><h3 className="font-semibold">Factory modules</h3><p className="text-sm text-muted-foreground">Changes apply only to {factory.name}. Existing records remain preserved when a module is disabled.</p></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}{success && <p role="status" className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="size-4"/>Factory module access updated.</p>}<AccessSection title="Operational Excellence Modules" capabilities={OPERATIONAL_MODULES} access={draft} onChange={(id, enabled) => { setSuccess(false); setChanges(current => ({ ...current, [id]: enabled })); }}/><AccessSection title="Shared Platform Capabilities" capabilities={SHARED_CAPABILITIES} access={draft} onChange={(id, enabled) => { setSuccess(false); setChanges(current => ({ ...current, [id]: enabled })); }}/>{changed && <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setChanges({})}>Cancel</Button><Button onClick={saveModules}>Save modules</Button></div>}</div>}
    {tab === "users" && <div className="divide-y border-y">{memberships.map(membership => { const admin = state.factoryAdmins.some(item => item.plantId === factory.id && item.userId === membership.userId && item.status === "Active"); return <div key={membership.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{people.find(person => person.id === membership.userId)?.name ?? membership.userId}</p><p className="text-sm text-muted-foreground">{membership.baseRole}{admin ? " · Factory Admin" : ""} · {membership.status}</p></div>{membership.status === "Active" && <Button size="sm" variant="outline" onClick={() => onDeactivate(membership.userId)}>Deactivate</Button>}</div>; })}{!memberships.length && <p className="py-4 text-sm text-muted-foreground">No factory user memberships.</p>}</div>}
  </section>;
}

export function OrganizationFactoriesPage({ organizationId }: { organizationId: string }) {
  useOrganizations(); useOrganizationConfiguration(); const state = useAccessV3State(); const people = useAdminUsers(true);
  const organization = organizationById(organizationId); const [creating, setCreating] = React.useState(false); const [editing, setEditing] = React.useState<string>(); const [managed, setManaged] = React.useState<string>(); const [removing, setRemoving] = React.useState<string>(); const [deactivating, setDeactivating] = React.useState<{ plantId: string; userId: string }>(); const [error, setError] = React.useState("");
  if (!organization) return <OrganizationMissing/>;
  const factories = getAllOrganizationConfiguration().plants.filter(plant => plantOrganization(plant) === organizationId);
  const requests = state.factoryRequests.filter(request => request.organizationId === organizationId).slice().reverse();
  const managedFactory = factories.find(factory => factory.id === managed);
  const removalFactory = factories.find(factory => factory.id === removing);
  const deactivationUser = deactivating ? people.find(person => person.id === deactivating.userId) : undefined;
  function decide(id: string, decision: "Approved" | "Rejected") { try { decideFactoryRequest(id, decision); setError(""); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update factory request."); } }
  function remove() { if (!removalFactory) return; try { const mode = removeFactory(organizationId, removalFactory.id); setRemoving(undefined); setManaged(undefined); setError(`${removalFactory.name} ${mode === "delete" ? "was permanently deleted" : "was archived"}.`); } catch (reason) { setRemoving(undefined); setError(reason instanceof Error ? reason.message : "Unable to remove factory."); } }
  function deactivate() { if (!deactivating) return; try { deactivateFactoryUser(organizationId, deactivating.plantId, deactivating.userId); setDeactivating(undefined); setError(""); } catch (reason) { setDeactivating(undefined); setError(reason instanceof Error ? reason.message : "Unable to deactivate factory user."); } }
  return <PageContainer>
    <FiveSPageHeader eyebrow="Super Admin / Clients" title={organization.name} description="Factories, user limits and module access" actions={<Button onClick={() => setCreating(true)}>Add factory</Button>}/>
    <OrganizationTabs organization={organization} active="factories"/>
    {error && <p role="alert" className={error.includes("was ") ? "text-sm text-emerald-700" : "text-sm text-destructive"}>{error}</p>}
    <section><h2 className="font-semibold">Factories</h2><div className="mt-3 overflow-x-auto rounded-xl border"><Table><TableHeader><TableRow><TableHead>Factory</TableHead><TableHead>Active users</TableHead><TableHead>Maximum</TableHead><TableHead>Available</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>
      {factories.map(factory => { const usage = getFactorySeatUsage(factory.id); return <TableRow key={factory.id}><TableCell><p className="font-medium">{factory.name}</p><p className="text-xs text-muted-foreground">{factory.code}{factory.location ? ` · ${factory.location}` : ""}</p></TableCell><TableCell>{usage.activeUsers}</TableCell><TableCell>{usage.maximumActiveUsers ?? "Not configured"}</TableCell><TableCell>{usage.available ?? "Not configured"}</TableCell><TableCell><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => setManaged(managed === factory.id ? undefined : factory.id)}>Manage</Button><Button size="sm" variant="outline" onClick={() => setRemoving(factory.id)}>{getFactoryRemovalMode(factory.id) === "delete" ? "Delete" : "Archive"}</Button></div></TableCell></TableRow>; })}
      {!factories.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">No factories.</TableCell></TableRow>}
    </TableBody></Table></div></section>
    {managedFactory && <FactoryManagement key={managedFactory.id} organization={organization} factory={managedFactory} onEdit={() => setEditing(managedFactory.id)} onDeactivate={userId => setDeactivating({ plantId: managedFactory.id, userId })}/>}
    <section><h2 className="font-semibold">Factory requests</h2><div className="mt-3 divide-y rounded-xl border">{requests.map(request => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{request.name}</p><p className="text-sm text-muted-foreground">{request.description || "No description"} · {request.status}</p></div>{request.status === "Pending" && <div className="flex gap-2"><Button variant="outline" onClick={() => decide(request.id, "Rejected")}>Reject</Button><Button onClick={() => decide(request.id, "Approved")}>Approve</Button></div>}</div>)}{!requests.length && <p className="p-4 text-sm text-muted-foreground">No factory requests.</p>}</div></section>
    {creating && <FactoryDialog organizationId={organizationId} onClose={() => setCreating(false)}/>}
    {editing && <FactoryDialog organizationId={organizationId} plant={factories.find(factory => factory.id === editing)} onClose={() => setEditing(undefined)}/>}
    <AlertDialog open={Boolean(removalFactory)} onOpenChange={open => { if (!open) setRemoving(undefined); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{removalFactory && getFactoryRemovalMode(removalFactory.id) === "delete" ? "Delete" : "Archive"} {removalFactory?.name}?</AlertDialogTitle><AlertDialogDescription>{removalFactory && getFactoryRemovalMode(removalFactory.id) === "delete" ? "This permanently removes an empty factory explicitly marked as disposable demo data." : "This marks the factory inactive and preserves historical references."} Active users, administrators, Zones, Departments, authorizations, or pending dependencies will block the action.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Confirm</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(deactivating)} onOpenChange={open => { if (!open) setDeactivating(undefined); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Deactivate {deactivationUser?.name ?? "factory user"}?</AlertDialogTitle><AlertDialogDescription>The factory membership and active Zone allocations will be disabled. Identity and history remain. Active ownership, Audit assignments, or Factory Admin authority will block this action.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deactivate}>Deactivate user</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </PageContainer>;
}

function Summary({ label, value }: { label: string; value: string }) { return <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold">{value}</p></CardContent></Card>; }

export function OrganizationModulesPage({ organizationId }: { organizationId: string }) {
  useOrganizations();
  const organization = organizationById(organizationId);
  if (!organization) return <OrganizationMissing />;
  return <PageContainer><FiveSPageHeader eyebrow="Super Admin / Clients" title={organization.name} description="Module access is configured independently for each factory."/><Button nativeButton={false} render={<Link href={`/super-admin/organizations/${organization.id}/factories`}/>}>Open factories</Button></PageContainer>;
}

function AccessSection({ title, capabilities, access, onChange, disabled = false }: { title: string; capabilities: typeof OPERATIONAL_MODULES | typeof SHARED_CAPABILITIES; access: OrganizationAccess; disabled?: boolean; onChange: (id: AccessCapabilityId, enabled: boolean) => void }) {
  return <section><h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</h2><div className="grid gap-3 md:grid-cols-2">{capabilities.map((capability) => <Card key={capability.id} className="shadow-none"><CardContent className="p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary"><capability.icon className="size-[17px]" /></span><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{capability.label}</h3><p className="mt-1 text-sm leading-5 text-muted-foreground">{capability.id === "actions" ? "Required shared service for linked workflow Actions." : capability.description}</p></div><Switch disabled={disabled || (capability.id === "actions" && access.actions)} checked={access[capability.id]} onCheckedChange={(checked) => onChange(capability.id, checked)} aria-label={`Enable ${capability.label}`} /></div><div className="mt-3 border-t border-border/60 pt-3"><Badge variant={access[capability.id] ? "success" : "muted"} size="sm">{access[capability.id] ? "Enabled" : "Disabled"}</Badge></div></CardContent></Card>)}</div></section>;
}
