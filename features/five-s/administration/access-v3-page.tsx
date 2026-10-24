"use client";
import { ACCESS_CONTEXT_KEY, authorizedContextOptions, getActiveAccessContext, selectAccessContext, useAccessContext } from "./access-v4-context";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { AccessV4Panel, DepartmentDialog, ResponsibilityDialog } from "./access-v4-panel";
import { reassignFiveSAudit, useFiveSAuditStore } from "@/lib/five-s/audit-store";
import { eligibleAuditAssignees, auditContext } from "@/lib/five-s/audit-authorization";
import { resolveFactoryPerson } from "./factory-authorization";
import { saveAuditorAuthorization, revokeAuditorAuthorization, unfinishedAuditorAssignments } from "./access-v3-store";
import type { AuditorGrant } from "./access-v3-types";
import { useState } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Factory, Plus, Settings2 } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import FiveSPageHeader from "../components/FiveSPageHeader";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import { useCurrentUser } from "@/lib/current-user";
import { useOrganizationConfiguration, getAllOrganizationConfiguration, type OrganizationPlant, type OrganizationZone } from "@/lib/organization-store";
import { useOrganizations, type Organization } from "@/lib/organizations";
import { useAdminUsers } from "./store";
import { useAccessV3State } from "./access-v3-state";
import type { FactoryBaseRole } from "./access-v3-types";
import { administrationClients, administrationFactories, administrationPeople, assignFactoryAdministrator, canOpenAccessAdministration, getFactorySeatUsage, hasClientAdministration, hasFactoryAdministration, isPlatformActor, recoverAdministrationTransaction, requestFactory, revokeFactoryAdministrator, saveClientProfile, saveFactory, saveFactoryUser, saveFactoryZone, type PersonInput } from "./access-v3-store";
function Field({ label, children }: {
    label: string;
    children: React.ReactNode;
}) { return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{label}{children}</label>; }
function Choice({ label, value, onChange, options, disabled = false }: {
    label: string;
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    options: Array<{
        id: string;
        name: string;
    }>;
}) { return <Field label={label}><Select value={value} disabled={disabled} onValueChange={value => onChange(value ?? "")}><SelectTrigger aria-label={label} className="w-full"><SelectValue placeholder={`Select ${label.toLowerCase()}`}>{options.find(item => item.id === value)?.name}</SelectValue></SelectTrigger><SelectContent>{options.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>; }
function PersonFields({ value, onChange }: {
    value: PersonInput;
    onChange: (value: PersonInput) => void;
}) { return <><Field label="Full name"><Input value={value.name} onChange={event => onChange({ ...value, name: event.target.value })}/></Field><Field label="Email"><Input type="email" value={value.email} onChange={event => onChange({ ...value, email: event.target.value })}/></Field><Field label="Employee ID"><Input value={value.employeeId} onChange={event => onChange({ ...value, employeeId: event.target.value })}/></Field></>; }
function MutationDialog({ title, description, submit, children, onSave, onClose }: {
    title: string;
    description: string;
    submit: string;
    children: React.ReactNode;
    onSave: () => void;
    onClose: () => void;
}) { const [openedContext] = useState(() => window.localStorage.getItem(ACCESS_CONTEXT_KEY)); const [openedActor] = useState(() => getAuthenticatedDemoActor()?.user.id); const [error, setError] = useState(""); const [pending, setPending] = useState(false); return <Dialog open onOpenChange={open => { if (!open && !pending)
    onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={event => { event.preventDefault(); setPending(true); setError(""); try {
    if (window.localStorage.getItem(ACCESS_CONTEXT_KEY) !== openedContext || getAuthenticatedDemoActor()?.user.id !== openedActor) throw new Error("Access context or identity changed. Reopen this form.");
    if (openedContext) getActiveAccessContext();
    onSave();
    onClose();
}
catch (error) {
    setError(error instanceof Error ? error.message : "Unable to save.");
}
finally {
    setPending(false);
} }}>{children}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending}>{pending ? "Saving…" : submit}</Button></DialogFooter></form></DialogContent></Dialog>; }
export function ClientProfileDialog({ client, onClose }: {
    client?: Organization;
    onClose: () => void;
}) { const [name, setName] = useState(client?.name ?? ""); const [industry, setIndustry] = useState(client?.industry ?? ""); return <MutationDialog title={client ? "Edit client" : "Create client"} description={client ? "Update the client profile without changing its administrator, factories or module access." : "Creates the client and its default Client Administrator together. Factory and module access remain separately controlled."} submit={client ? "Save client" : "Create client"} onClose={onClose} onSave={() => { saveClientProfile({ id: client?.id, name, industry }); }}><Field label="Client name"><Input value={name} onChange={event => setName(event.target.value)}/></Field><Field label="Industry"><Input value={industry} onChange={event => setIndustry(event.target.value)}/></Field></MutationDialog>; }
export function PlatformClientActions({ client }: {
    client: Organization;
}) { useAccessV3State(); useCurrentUser(); const [dialog, setDialog] = useState(""); if (!isPlatformActor())
    return null; return <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDialog("profile")}>Edit client</Button>{dialog === "profile" && <ClientProfileDialog client={client} onClose={() => setDialog("")}/>}</div>; }
export function FactoryDialog({ organizationId, plant, onClose }: {
    organizationId: string;
    plant?: OrganizationPlant;
    onClose: () => void;
}) { const platform = isPlatformActor(); const [form, setForm] = useState({ name: plant?.name ?? "", code: plant?.code ?? "", location: plant?.location ?? "", description: plant?.description ?? "", maximumActiveUsers: String(plant?.maximumActiveUsers ?? (plant ? "" : 25)) }); return <MutationDialog title={plant ? "Edit factory" : "Create factory"} description="A factory reuses the existing Plant entity. Metric Mind controls its active user limit; manager metadata grants no administrative authority." submit="Save factory" onClose={onClose} onSave={() => { saveFactory(organizationId, { name: form.name, code: form.code, location: form.location, description: form.description, id: plant?.id, ...(platform ? { maximumActiveUsers: Number(form.maximumActiveUsers) } : {}) }); }}>{(["name", "code", "location", "description"] as const).map(field => <Field key={field} label={`Factory ${field}`}><Input value={form[field]} disabled={Boolean(plant && (field === "name" || (field === "code" && plant.codeLocked)))} onChange={event => setForm({ ...form, [field]: event.target.value })}/></Field>)}{platform && <Field label="Maximum active users"><Input type="number" min={1} step={1} required value={form.maximumActiveUsers} onChange={event => setForm({ ...form, maximumActiveUsers: event.target.value })}/></Field>}</MutationDialog>; }
export function FactoryRequestDialog({ organizationId, onClose }: { organizationId: string; onClose: () => void }) { const [name, setName] = useState(""); const [description, setDescription] = useState(""); return <MutationDialog title="Request Factory" description="Metric Mind must approve this request before an active factory is created." submit="Submit request" onClose={onClose} onSave={() => { requestFactory(organizationId, { name, description }); }}><Field label="Factory name"><Input required value={name} onChange={event => setName(event.target.value)}/></Field><Field label="Description (optional)"><Input value={description} onChange={event => setDescription(event.target.value)}/></Field></MutationDialog>; }
function FactoryAdminDialog({ organizationId, plant, onClose }: {
    organizationId: string;
    plant: OrganizationPlant;
    onClose: () => void;
}) { const [id, setId] = useState(""); return <MutationDialog title="Assign Factory Admin" description={`Confirm factory administration for ${plant.name}. This assignment is separate from an operational base role and permits Audit scheduling and direct execution in this factory.`} submit="Confirm Factory Admin assignment" onClose={onClose} onSave={() => { assignFactoryAdministrator(organizationId, plant.id, id); }}><Choice label="Person" value={id} onChange={setId} options={administrationPeople(organizationId)}/></MutationDialog>; }
export function FactoryUserDialog({ organizationId, plant, userId, onClose }: {
    organizationId: string;
    plant: OrganizationPlant;
    userId?: string;
    onClose: () => void;
}) { const state = useAccessV3State(); const current = state.factoryMemberships.find(item => item.userId === userId && item.plantId === plant.id); const [person, setPerson] = useState<PersonInput>({ name: "", email: "", employeeId: "" }); const [role, setRole] = useState<FactoryBaseRole>(current?.baseRole ?? "Zone Member"); const [zoneIds, setZoneIds] = useState(state.zoneAllocations.filter(item => item.userId === userId && item.plantId === plant.id && item.status === "Active").map(item => item.zoneId)); const zones = getAllOrganizationConfiguration().zones.filter(z => z.plantId === plant.id && z.status === "Active"); return <MutationDialog title={userId ? "Map User to Zone" : "Add User"} description={userId ? `Factory: ${plant.name}. Select the user's Zone and then assign their Zone role.` : `Factory: ${plant.name}. Add the user profile first. Zone membership and roles are assigned in the next step.`} submit={userId ? "Save Zone mapping" : "Add User"} onClose={onClose} onSave={() => { saveFactoryUser(organizationId, plant.id, userId ? { userId, baseRole: zoneIds.length ? role : "Standard User", zoneIds, status: current?.status ?? "Active" } : { person, baseRole: "Standard User", zoneIds: [], status: "Active" }); }}>{userId ? <><fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">Zone</legend>{zones.map(zone => <label key={zone.id} className="flex items-center gap-2 text-sm"><Checkbox checked={zoneIds.includes(zone.id)} onCheckedChange={checked => setZoneIds(ids => checked ? [...ids, zone.id] : ids.filter(id => id !== zone.id))}/>{zone.name}</label>)}{!zones.length && <p className="text-sm text-muted-foreground">Create a Zone before mapping this user.</p>}</fieldset>{zoneIds.length > 0 && <Choice label="Zone role" value={role === "Zone Leader" ? role : "Zone Member"} onChange={value => setRole(value as FactoryBaseRole)} options={[{ id: "Zone Member", name: "Zone Member" }, { id: "Zone Leader", name: "Zone Leader" }]}/>}</> : <PersonFields value={person} onChange={setPerson}/>}</MutationDialog>; }
export function ZoneDialog({ organizationId, plantId, zone, onClose }: {
    organizationId: string;
    plantId: string;
    zone?: OrganizationZone;
    onClose: () => void;
}) { const [form, setForm] = useState({ name: zone?.name ?? "", code: zone?.code ?? "", department: zone?.department ?? "" }); const legacy = Boolean(zone && zone.accessModel !== "v4"); return <MutationDialog title={zone ? "Edit Zone" : "Create Zone"} description={legacy ? "This legacy Zone retains its combined Department field." : "Departments are managed separately after the Zone is saved."} submit="Save Zone" onClose={onClose} onSave={() => { saveFactoryZone(organizationId, plantId, { ...form, id: zone?.id }); }}><Field label="Zone name"><Input required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })}/></Field><Field label="Zone code"><Input required value={form.code} onChange={event => setForm({ ...form, code: event.target.value })}/></Field>{legacy && <Field label="Zone department"><Input required value={form.department} onChange={event => setForm({ ...form, department: event.target.value })}/></Field>}</MutationDialog>; }
function ClientOverview({ client, factories }: { client: Organization; factories: OrganizationPlant[] }) {
    const state = useAccessV3State(); const people = useAdminUsers(true);
    const admins = state.factoryAdmins.filter(item => item.organizationId === client.id && item.status === "Active" && factories.some(factory => factory.id === item.plantId));
    return <section className="grid gap-4 rounded-xl border bg-card p-5"><div><p className="text-sm text-muted-foreground">Client Overview</p><h2 className="text-lg font-semibold">{client.name}</h2></div><dl className="grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Status</dt><dd className="font-semibold">{client.status}</dd></div><div><dt className="text-sm text-muted-foreground">Factories</dt><dd className="font-semibold">{factories.length}</dd></div></dl><div><h3 className="text-sm font-semibold">Factory Administrators</h3><p className="mt-1 text-sm text-muted-foreground">{admins.map(item => `${factories.find(factory => factory.id === item.plantId)?.name ?? "Factory"}: ${people.find(person => person.id === item.userId)?.name ?? "Assigned administrator"}`).join(" · ") || "No active Factory Administrator assignments"}</p></div></section>;
}
export function AccessAdministrationPage({ embedded = false }: { embedded?: boolean } = {}) {
    const current = useCurrentUser();
    if (current.role === "Client Administrator" && !embedded) redirect("/dashboard?view=administration");
    if (!["Platform Super Admin", "Client Administrator", "Factory Administrator"].includes(current.role)) return <NativeScopedAdministration role={current.role}/>;
    return <LegacyAccessAdministrationPage embedded={embedded} />;
}
function NativeScopedAdministration({ role }: { role: string }) {
    const canViewStructure = role === "Zone Champion" || role === "Department Leader";
    return <PageContainer><FiveSPageHeader eyebrow="Settings" title="Administration" description={canViewStructure ? "Review the organization structure and assignments available in your scope." : "Your account and access are managed by an authorized administrator."}/>
      {canViewStructure ? <AccessV4Panel/> : <section className="rounded-xl border bg-card p-6"><h2 className="font-semibold">{role}</h2><p className="mt-2 text-sm text-muted-foreground">No administration controls are assigned to this role. Use Profile for personal settings and the main navigation for authorized operational work.</p><Button className="mt-4" variant="outline" nativeButton={false} render={<Link href="/profile"/>}>Open profile</Button></section>}
    </PageContainer>;
}
function LegacyAccessAdministrationPage({ embedded = false }: { embedded?: boolean }) {
    const { context: activeContext, error: contextError, ready } = useAccessContext();
    const current = useCurrentUser();
    const state = useAccessV3State();
    const users = useAdminUsers(true);
    useOrganizations();
    useOrganizationConfiguration();
    const [selectedClient, setSelectedClient] = useState("");
    const [selectedPlant, setSelectedPlant] = useState("");
    const [search, setSearch] = useState("");
    const [tab, setTab] = useState(embedded ? "users" : "factories");
    const [dialog, setDialog] = useState("");
    const [targetZone, setTargetZone] = useState<string>();
    const [targetUser, setTargetUser] = useState<string>();
    const [assignment, setAssignment] = useState("");
    const [recoveryError, setRecoveryError] = useState("");
    if (!ready || contextError || (!activeContext && users.find(p => p.id === current.id)?.accessModel === "v3") || !canOpenAccessAdministration())
        return null;
    const clients = administrationClients();
    const contextClient = activeContext?.organizationId;
    const organizationId = contextClient ?? (clients.some(c => c.id === selectedClient) ? selectedClient : clients[0]?.id);
    const client = clients.find(c => c.id === organizationId);
    if (!client)
        return <PageContainer><p>No assigned clients.</p></PageContainer>;
    const factories = administrationFactories(client.id).filter(p => activeContext?.kind !== "factory" || p.id === activeContext.plantId);
    const plant = activeContext?.kind === "factory" ? factories.find(p => p.id === activeContext.plantId) : factories.find(p => p.id === selectedPlant) ?? factories[0];
    const canClient = hasClientAdministration(client.id, current.id);
    const canFactory = Boolean(plant && (!activeContext || activeContext.kind === "factory") && hasFactoryAdministration(client.id, plant.id, current.id));
    if (embedded && activeContext?.kind === "client") {
        const contexts = authorizedContextOptions();
        return <PageContainer className="max-w-none"><div className="grid gap-4 lg:grid-cols-2">{factories.map(factory => {
            const context = contexts.find(option => option.kind === "factory" && option.organizationId === client.id && option.plantId === factory.id);
            const usage = getFactorySeatUsage(factory.id);
            return <button key={factory.id} type="button" disabled={!context} className="group flex min-h-28 items-center justify-between gap-4 rounded-2xl border bg-card p-5 text-left shadow-sm transition-[border-color,box-shadow,transform] duration-150 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" onClick={() => { if (context) selectAccessContext(context); }}>
              <span className="flex min-w-0 items-center gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-primary transition-colors group-hover:bg-primary/[0.14]"><Factory className="size-5"/></span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="truncate font-semibold group-hover:text-primary">{factory.name}</span><Badge variant={factory.status === "Active" ? "success" : "muted"}>{factory.status}</Badge></span><span className="mt-1 block truncate text-sm text-muted-foreground">{factory.location || "Location not configured"}</span><span className="mt-2 block text-xs text-muted-foreground">{usage.activeUsers} of {usage.maximumActiveUsers ?? "—"} user seats in use</span></span></span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"/>
            </button>;
        })}{!factories.length && <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground lg:col-span-2">No factories are available for this client.</p>}</div></PageContainer>;
    }
    const memberships = state.factoryMemberships.filter(m => m.organizationId === client.id && m.plantId === plant?.id);
    const people = (canClient || canFactory) ? administrationPeople(client.id) : [];
    const query = search.toLowerCase();
    const canManageFactory = canClient || canFactory;
    const seatUsage = plant ? getFactorySeatUsage(plant.id) : undefined;
    const seatMessage = !seatUsage?.configured ? "User limit not configured. Metric Mind must set a limit before another user can be activated." : seatUsage.atCapacity ? `Active user limit reached (${seatUsage.activeUsers} of ${seatUsage.maximumActiveUsers}).` : `${seatUsage.activeUsers} of ${seatUsage.maximumActiveUsers} active users · ${seatUsage.available} available`;
    const administrationTabs = [{ id: "factories", label: "Factories" }, { id: "users", label: "Users & Roles" }];
    const administrationActions = <div className="flex flex-wrap gap-2">{canClient && !embedded && <Button onClick={() => setDialog("requestFactory")}><Plus className="size-4"/>Request Factory</Button>}{canManageFactory && plant && <Button disabled={seatUsage?.atCapacity} title={seatUsage?.atCapacity ? seatMessage : undefined} onClick={() => { setTargetUser(undefined); setDialog("user"); }}><Plus className="size-4"/>Add User</Button>}</div>;
    if (embedded && activeContext?.kind === "factory" && plant) {
        const zones = getAllOrganizationConfiguration().zones.filter(zone => zone.plantId === plant.id);
        const visibleMemberships = memberships.filter(membership => `${users.find(user => user.id === membership.userId)?.name ?? ""} ${membership.baseRole}`.toLowerCase().includes(query));
        const visibleZones = zones.filter(zone => `${zone.name} ${zone.code} ${zone.department}`.toLowerCase().includes(query));
        const factoryAdmins = state.factoryAdmins.filter(admin => admin.organizationId === client.id && admin.plantId === plant.id);
        return <PageContainer className="max-w-none">
          <OpsTabBar label="Factory administration sections" active={tab} onChange={next => { setTab(next); setSearch(""); }} tabs={[{ id: "users", label: "Users" }, { id: "structure", label: "Zones & Departments" }, { id: "responsibilities", label: "Responsibilities" }]}/>
          <div className="grid gap-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input className="sm:max-w-md" aria-label="Search factory administration" placeholder={tab === "users" ? "Search users..." : tab === "structure" ? "Search Zones or Departments..." : "Search members or responsibilities..."} value={search} onChange={event => setSearch(event.target.value)}/>
              {tab === "users" && <div className="sm:ml-auto">{administrationActions}</div>}
              {tab === "structure" && <div className="flex flex-wrap gap-2 sm:ml-auto"><Button variant="outline" onClick={() => { setTargetZone(undefined); setDialog("zone"); }}><Plus className="size-4"/>Create Zone</Button><Button onClick={() => setDialog("department")}><Plus className="size-4"/>Create Department</Button></div>}
              {tab === "responsibilities" && <Button className="sm:ml-auto" onClick={() => setDialog("responsibility")}><Plus className="size-4"/>Assign members</Button>}
            </div>
            {tab === "users" && <><section aria-labelledby="factory-people-heading" className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h2 id="factory-people-heading" className="font-semibold">People</h2><p className={`mt-1 text-sm ${seatUsage?.atCapacity ? "text-destructive" : "text-muted-foreground"}`}>{seatMessage}</p></div>
                <Badge variant={seatUsage?.atCapacity ? "danger" : "outline"}>{memberships.length} {memberships.length === 1 ? "user" : "users"}</Badge>
              </div>
              <div className="mt-4 divide-y border-y">
                {visibleMemberships.map(membership => {
                    const person = users.find(user => user.id === membership.userId);
                    const assignedZones = state.zoneAllocations.filter(allocation => allocation.userId === membership.userId && allocation.plantId === plant.id && allocation.status === "Active").map(allocation => zones.find(zone => zone.id === allocation.zoneId)?.name ?? "Assigned Zone");
                    return <div key={membership.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate font-medium">{person?.name ?? "Factory user"}</p><p className="mt-0.5 text-sm text-muted-foreground">{membership.baseRole}{assignedZones.length ? ` · ${assignedZones.join(", ")}` : " · No Zone assigned"}</p></div><Button size="sm" variant="ghost" onClick={() => { setTargetUser(membership.userId); setDialog("user"); }}>Edit</Button></div>;
                })}
                {!visibleMemberships.length && <p className="py-5 text-sm text-muted-foreground">{query ? "No people match this search." : "No factory users have been added yet."}</p>}
              </div>
            </section>
            {canClient && <section aria-labelledby="factory-admins-heading" className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="factory-admins-heading" className="font-semibold">Factory administrators</h2><p className="mt-1 text-sm text-muted-foreground">People authorized to manage this factory.</p></div><Button size="sm" variant="outline" onClick={() => setDialog("factoryAdmin")}><Plus className="size-4"/>Assign administrator</Button></div>
              <div className="mt-4 divide-y border-y">
                {factoryAdmins.map(admin => <div key={admin.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{people.find(person => person.id === admin.userId)?.name ?? "Assigned administrator"}</p><p className="text-sm text-muted-foreground">{admin.status}</p></div>{admin.status === "Active" && <Button size="sm" variant="ghost" onClick={() => { setAssignment(admin.id); setDialog("revoke"); }}>Revoke</Button>}</div>)}
                {!factoryAdmins.length && <p className="py-5 text-sm text-muted-foreground">No Factory Administrator is assigned.</p>}
              </div>
            </section>}</>}
            {tab === "structure" && <div className="grid items-start gap-5 xl:grid-cols-2">
              <section aria-labelledby="factory-zones-heading" className="grid content-start gap-4 rounded-2xl border bg-card p-5 shadow-sm">
                <div><h2 id="factory-zones-heading" className="font-semibold">Zones</h2><p className="mt-1 text-sm text-muted-foreground">Organize the factory into operational areas.</p></div>
                <div className="divide-y border-y">
                  {visibleZones.map(zone => <div key={zone.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-medium">{zone.name}</p><p className="text-sm text-muted-foreground">{zone.code}{zone.accessModel === "v4" ? " · Departments managed separately" : zone.department ? ` · ${zone.department}` : ""}</p></div><Button variant="ghost" size="sm" onClick={() => { setTargetZone(zone.id); setDialog("zone"); }}>Edit</Button></div>)}
                  {!visibleZones.length && <p className="py-5 text-sm text-muted-foreground">{query ? "No Zones match this search." : "No Zones have been created yet."}</p>}
                </div>
              </section>
              <AccessV4Panel embedded search={search} view="departments" showActions={false}/>
            </div>}
            {tab === "responsibilities" && <><AccessV4Panel embedded search={search} view="responsibilities" showActions={false}/><details className="rounded-2xl border bg-card shadow-sm"><summary className="cursor-pointer px-5 py-4 font-medium">Advanced audit access</summary><div className="border-t px-5 pb-5"><AuditorAuthorizationSection organizationId={client.id} plant={plant} search={query}/></div></details></>}
          </div>
          {dialog === "factoryAdmin" && <FactoryAdminDialog organizationId={client.id} plant={plant} onClose={() => setDialog("")}/>}
          {dialog === "user" && <FactoryUserDialog key={targetUser ?? "new"} organizationId={client.id} plant={plant} userId={targetUser} onClose={() => setDialog("")}/>}
          {dialog === "zone" && <ZoneDialog organizationId={client.id} plantId={plant.id} zone={zones.find(zone => zone.id === targetZone)} onClose={() => setDialog("")}/>}
          {dialog === "department" && <DepartmentDialog organizationId={client.id} plantId={plant.id} onClose={() => setDialog("")}/>}
          {dialog === "responsibility" && <ResponsibilityDialog onClose={() => setDialog("")}/>}
          {dialog === "revoke" && <MutationDialog title="Revoke Factory Admin assignment?" description="The person and all operational ownership/history will be retained. The last active Factory Admin cannot be revoked without a replacement." submit="Confirm revocation" onClose={() => setDialog("")} onSave={() => revokeFactoryAdministrator(assignment)}><p className="text-sm">Assignment {assignment}</p></MutationDialog>}
        </PageContainer>;
    }
    return <PageContainer className="max-w-none">{embedded ? <div className="flex flex-wrap justify-end gap-2">{administrationActions}</div> : <FiveSPageHeader eyebrow="Settings" title="Administration" description={`${client.name} · Manage factories, users and approved role assignments.`} actions={administrationActions}/>}
    {(!embedded || activeContext?.kind !== "factory") && <div className={embedded ? "max-w-md" : "grid gap-3 sm:grid-cols-2"}>{!embedded && <Choice label="Client" disabled={Boolean(activeContext?.organizationId)} value={client.id} onChange={id => { setSelectedClient(id); setSelectedPlant(""); setTab("factories"); }} options={clients}/>} {factories.length > 0 && <Choice label={embedded ? "Manage factory" : "Factory"} value={plant?.id ?? ""} onChange={id => { setSelectedPlant(id); setTab("users"); }} options={factories}/>}</div>}
    <OpsTabBar label="Administration sections" active={tab} onChange={setTab} tabs={administrationTabs}/>
    <Input aria-label="Search administration" placeholder={embedded ? "Search people, Zones or Departments..." : "Search factories or people..."} value={search} onChange={event => setSearch(event.target.value)}/>
    {canClient && tab === "factories" && !embedded && <ClientOverview client={client} factories={factories}/>}
    {tab === "factories" && <section aria-label="Factories" className="divide-y rounded-xl border">{factories.filter(p => `${p.name} ${p.code}`.toLowerCase().includes(query)).map(p => { const usage = getFactorySeatUsage(p.id); return <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-semibold">{p.name}</p><p className="text-sm text-muted-foreground">{p.code}{p.location ? ` · ${p.location}` : ""}</p><p className="mt-1 text-xs text-muted-foreground">Active users: {usage.activeUsers} · Maximum: {usage.maximumActiveUsers ?? "Not configured"} · Available: {usage.available ?? "Not configured"}</p></div><div className="flex flex-wrap gap-2">{canClient && <><Button variant="outline" onClick={() => { setSelectedPlant(p.id); setDialog("editFactory"); }}>Edit factory</Button><Button variant="outline" onClick={() => { setSelectedPlant(p.id); setDialog("factoryAdmin"); }}>Assign Factory Admin</Button></>}<Button variant="outline" onClick={() => { setSelectedPlant(p.id); setTab("users"); }}><Settings2 className="size-4"/>Manage</Button></div></div>; })}{!factories.length && <p className="p-5 text-sm text-muted-foreground">No factories yet. Submit a factory request for Metric Mind approval.</p>}</section>}
    {canClient && tab === "factories" && <section><h2 className="font-semibold">Factory requests</h2><div className="mt-2 divide-y rounded-xl border">{state.factoryRequests.filter(request => request.organizationId === client.id).slice().reverse().map(request => <div key={request.id} className="flex items-center justify-between gap-3 p-4"><div><p className="font-medium">{request.name}</p>{request.description && <p className="text-sm text-muted-foreground">{request.description}</p>}</div><Badge variant={request.status === "Approved" ? "success" : request.status === "Rejected" ? "danger" : "outline"}>{request.status}</Badge></div>)}{!state.factoryRequests.some(request => request.organizationId === client.id) && <p className="p-4 text-sm text-muted-foreground">No factory requests.</p>}</div></section>}
    {tab === "users" && <AccessV4Panel embedded={embedded}/>}
    {plant && canClient && tab === "users" && <section className="mt-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Factory Admins · {plant.name}</h2><Button variant="outline" onClick={() => setDialog("factoryAdmin")}>Assign Factory Admin</Button></div><div className="mt-2 divide-y rounded-xl border">{state.factoryAdmins.filter(a => a.organizationId === client.id && a.plantId === plant.id).map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><span>{people.find(p => p.id === a.userId)?.name ?? "Assigned administrator"} <Badge variant="outline">{a.status}</Badge></span>{a.status === "Active" && <Button variant="outline" onClick={() => { setAssignment(a.id); setDialog("revoke"); }}>Revoke assignment</Button>}</div>)}</div></section>}
    {plant && canManageFactory && tab === "users" && <section className="mt-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Users & Zones · {plant.name}</h2><p className={`text-sm ${seatUsage?.atCapacity ? "text-destructive" : "text-muted-foreground"}`}>{seatMessage}</p></div><Button variant="outline" onClick={() => { setTargetZone(undefined); setDialog("zone"); }}>Create Zone</Button></div><div className="mt-3 divide-y rounded-xl border">{memberships.filter(m => `${users.find(u => u.id === m.userId)?.name} ${m.baseRole}`.toLowerCase().includes(query)).map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{users.find(u => u.id === m.userId)?.name ?? "Factory user"}</p><p className="text-sm text-muted-foreground">{m.baseRole} · {m.status}</p><p className="mt-1 text-xs text-muted-foreground">Zones: {state.zoneAllocations.filter(a => a.userId === m.userId && a.plantId === plant.id && a.status === "Active").map(a => getAllOrganizationConfiguration().zones.find(z => z.id === a.zoneId)?.name ?? "Assigned Zone").join(", ") || "None"}</p></div><Button variant="outline" onClick={() => { setTargetUser(m.userId); setDialog("user"); }}>Edit membership</Button></div>)}{!memberships.length && <p className="p-4 text-sm text-muted-foreground">No factory memberships yet.</p>}</div><div className="mt-4 divide-y border-t">{getAllOrganizationConfiguration().zones.filter(z => z.plantId === plant.id).map(z => <div key={z.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><span className="text-sm">{z.name} · {z.accessModel === "v4" ? "Independent Departments" : z.department}</span><Button variant="ghost" size="sm" onClick={() => { setTargetZone(z.id); setDialog("zone"); }}>Edit Zone</Button></div>)}</div><details className="mt-6 rounded-xl border bg-card"><summary className="cursor-pointer px-4 py-3 font-medium">Audit access</summary><div className="border-t px-4 pb-4"><AuditorAuthorizationSection organizationId={client.id} plant={plant} search={query}/></div></details></section>}
    {isPlatformActor() && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { try {
        recoverAdministrationTransaction();
        setRecoveryError("");
    }
    catch (e) {
        setRecoveryError(e instanceof Error ? e.message : "Recovery failed.");
    } }}>Recover interrupted administration change</Button>{recoveryError && <p role="alert">{recoveryError}</p>}</div>}
    {dialog === "editFactory" && plant && <FactoryDialog organizationId={client.id} plant={plant} onClose={() => setDialog("")}/>} {dialog === "requestFactory" && <FactoryRequestDialog organizationId={client.id} onClose={() => setDialog("")}/>} {dialog === "factoryAdmin" && plant && <FactoryAdminDialog organizationId={client.id} plant={plant} onClose={() => setDialog("")}/>}{dialog === "user" && plant && <FactoryUserDialog key={targetUser ?? "new"} organizationId={client.id} plant={plant} userId={targetUser} onClose={() => setDialog("")}/>}{dialog === "zone" && plant && <ZoneDialog organizationId={client.id} plantId={plant.id} zone={getAllOrganizationConfiguration().zones.find(z => z.id === targetZone)} onClose={() => setDialog("")}/>}{dialog === "revoke" && <MutationDialog title="Revoke Factory Admin assignment?" description="The person and all operational ownership/history will be retained. The last active Factory Admin cannot be revoked without a replacement." submit="Confirm revocation" onClose={() => setDialog("")} onSave={() => revokeFactoryAdministrator(assignment)}><p className="text-sm">Assignment {assignment}</p></MutationDialog>}
  </PageContainer>;
}

function AuditorAuthorizationSection({ organizationId, plant, search }: { organizationId: string; plant: OrganizationPlant; search: string }) {
  const state = useAccessV3State(); const people = administrationPeople(organizationId); const audits = useFiveSAuditStore();
  const [dialog, setDialog] = useState(""); const [grantId, setGrantId] = useState(""); const [userId, setUserId] = useState(""); const [zoneIds, setZoneIds] = useState<string[]>([]); const [auditId, setAuditId] = useState(""); const [reason, setReason] = useState("");
  const grants = state.auditorGrants.filter(g => g.organizationId === organizationId && g.plantId === plant.id);
  const grant = grants.find(g => g.id === grantId);
  const zones = getAllOrganizationConfiguration().zones.filter(z => z.plantId === plant.id && z.status === "Active");
  const eligible = people.filter(p => resolveFactoryPerson(p.id, { organizationId, plantId: plant.id }).zoneLeader);
  const audit = audits.find(a => a.id === auditId);
  function openEdit(g?: AuditorGrant) { setGrantId(g?.id ?? ""); setUserId(g?.userId ?? ""); setZoneIds(g?.zoneIds ?? []); setDialog("grant"); }
  return <section className="mt-5 grid min-w-0 gap-4" aria-label="Auditor Authorization"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Auditor Authorization · {plant.name}</h2><p className="text-sm text-muted-foreground">Only active Zone Leaders qualify. All Zones they currently lead remain excluded from execution.</p></div><Button onClick={() => openEdit()}>Grant authorization</Button></div>
  <div className="divide-y rounded-xl border">{grants.filter(g => (people.find(p => p.id === g.userId)?.name ?? g.userId).toLowerCase().includes(search)).map(g => <div key={g.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="font-medium">{people.find(p => p.id === g.userId)?.name ?? g.userId} · {g.status}{g.status === "Active" && !resolveFactoryPerson(g.userId, { organizationId, plantId: plant.id }).grantEffective ? " · Ineffective: eligibility changed" : ""}</p><p className="text-sm text-muted-foreground">Zones: {g.zoneIds.map(id => zones.find(z => z.id === id)?.name ?? id).join(", ")}</p><p className="break-words text-sm text-muted-foreground">Granted by {people.find(p => p.id === g.grantedBy)?.name ?? g.grantedBy} · {new Date(g.grantedAt).toLocaleString()}</p></div>{g.status === "Active" && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openEdit(g)}>Edit authorized Zones</Button><Button variant="outline" onClick={() => { setGrantId(g.id); setDialog("revokeAuditor"); }}>Revoke authorization</Button></div>}</div>)}{!grants.length && <p className="p-4 text-sm text-muted-foreground">No Auditor authorizations. Grant an eligible Zone Leader access to selected Zones.</p>}</div>
  <h3 className="font-semibold">Unfinished Audit assignments</h3><div className="divide-y">{audits.filter(a => a.organizationId === organizationId && a.plantId === plant.id && a.status !== "Completed").map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><p className="text-sm">{a.title} · {a.area} · {a.auditor} · {a.status}</p><Button variant="outline" onClick={() => { setAuditId(a.id); setUserId(""); setReason(""); setDialog("reassign"); }}>Reassign auditor</Button></div>)}</div>
  <h3 className="font-semibold">Authorization history</h3><div className="divide-y">{state.events.filter(e => e.organizationId === organizationId && e.plantId === plant.id && (e.operation.startsWith("auditor.") || e.operation === "audit.reassigned")).slice().reverse().map(e => <div key={e.id} className="py-3 text-sm"><p>{e.operation} · {people.find(p => p.id === e.actorId)?.name ?? e.actorId} · {new Date(e.at).toLocaleString()}</p><p className="break-all text-muted-foreground">{e.targetId}</p></div>)}</div>
  {dialog === "grant" && <MutationDialog title={grant ? "Edit authorized Zones" : "Grant Auditor authorization"} description={`Factory: ${plant.name}. Authorization permits assigned audits only; own leadership Zones remain excluded. No expiry applies.`} submit="Confirm authorization" onClose={() => setDialog("")} onSave={() => { saveAuditorAuthorization(organizationId, plant.id, userId, zoneIds); }}>
  {grant ? <p>{people.find(p => p.id === userId)?.name ?? userId}</p> : <Choice label="Eligible Zone Leader" value={userId} onChange={setUserId} options={eligible.filter(p => !grants.some(g => g.userId === p.id && g.status === "Active"))}/>}
  {!eligible.length && <p>No eligible active Zone Leaders. Add a factory membership and leadership allocation first.</p>}
  <fieldset className="grid gap-2"><legend className="mb-2 text-sm font-medium">Authorized Zones</legend>{zones.map(z => <label key={z.id} className="flex items-center gap-2 text-sm"><Checkbox checked={zoneIds.includes(z.id)} onCheckedChange={checked => setZoneIds(ids => checked ? [...ids, z.id] : ids.filter(id => id !== z.id))}/>{z.name}{resolveFactoryPerson(userId, { organizationId, plantId: plant.id, zoneId: z.id }).leadsZone ? " (own Zone: execution excluded)" : ""}</label>)}</fieldset><p className="text-sm">Review: {zoneIds.map(id => zones.find(z => z.id === id)?.name ?? id).join(", ") || "Select at least one Zone"}</p></MutationDialog>}
  {dialog === "revokeAuditor" && grant && <MutationDialog title="Revoke Auditor authorization?" description="Future execution is blocked immediately. Saved answers, evidence, signatures and Audit lifecycle remain unchanged. Reassignment is explicit." submit="Confirm revocation" onClose={() => setDialog("")} onSave={() => revokeAuditorAuthorization(grant.id)}><p>{people.find(p => p.id === grant.userId)?.name ?? grant.userId} · {plant.name}</p><p className="text-sm">Zones: {grant.zoneIds.map(id => zones.find(z => z.id === id)?.name ?? id).join(", ")}</p><p className="text-sm">Impacted unfinished assignments: {unfinishedAuditorAssignments(grant.userId, organizationId, plant.id).map(a => `${a.id} (${a.status})`).join(", ") || "None"}</p></MutationDialog>}
  {dialog === "reassign" && audit && <MutationDialog title="Reassign Audit" description="Existing answers, evidence, signatures, linked Actions and lifecycle are retained. Previous assignment and reason are recorded." submit="Confirm reassignment" onClose={() => setDialog("")} onSave={() => { reassignFiveSAudit(audit.id, userId, reason); }}><p>{audit.title} · {plant.name} · {audit.area} · Current auditor: {audit.auditor}</p><Choice label="Replacement auditor" value={userId} onChange={setUserId} options={eligibleAuditAssignees(auditContext(audit)!).filter(p => p.id !== audit.assignedAuditorId)}/><Field label="Reassignment reason"><Input value={reason} onChange={e => setReason(e.target.value)}/></Field></MutationDialog>}
  </section>;
}
