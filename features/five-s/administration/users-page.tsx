"use client";

import { AccessAdministrationPage } from "./access-v3-page";
import { useAccessV3State } from "./access-v3-state";
import { canOpenAccessAdministration } from "./access-v3-store";
import { useMemo, useState } from "react";
import { Check, Edit3, Eye, Search, ShieldCheck, UserRoundCheck, UserRoundX, UsersRound } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { OpsFeedback } from "@/components/ops/ops-feedback";
import { OpsPersonSelect } from "@/components/ops/ops-person-select";
import { deactivateUserWithActionTransfer, getUserCITransferCandidates, getUserTransferCandidates } from "./ownership";
import { getOutstandingUserActions } from "./store";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FiveSPageHeader from "../components/FiveSPageHeader";
import { ACCESS_CAPABILITIES } from "@/lib/modules";
import { useModuleEntitlements } from "@/lib/module-entitlements";
import { useActionStore } from "@/lib/actions/action-store";
import { useCurrentUser } from "@/lib/current-user";
import { useOrganizationConfiguration } from "@/lib/organization-store";
import { getOutstandingUserImprovements, useImprovements } from "@/features/five-s/continuous-improvement/store";
import { assignZoneLeader, createAdminUser, setAdminUserActive, updateAdminUser, useAdminUsers } from "./store";
import { hasPermission, permissionsForRoles } from "./permissions";
import { ADMIN_ROLES, type AdminRole, type AdminUser, type AdminUserInput, type ZoneResponsibility } from "./types";

type Feedback = { tone: "success" | "error"; message: string } | null;

function LegacyAdministrationUsersPage({ settingsMode = false }: { settingsMode?: boolean }) {
  const current = useCurrentUser();
  const users = useAdminUsers();
  const organization = useOrganizationConfiguration();
  useActionStore();
  useImprovements();
  const admin = users.find((user) => user.id === current.id);
  const allowed = current.isSuperAdmin || hasPermission(admin, "administration.view");
  const canManage = current.isSuperAdmin || hasPermission(admin, "administration.manage_users");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("All");
  const [plant, setPlant] = useState("All");
  const [zone, setZone] = useState("All");
  const [status, setStatus] = useState("All");
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [inspect, setInspect] = useState<AdminUser | null>(null);
  const [deactivate, setDeactivate] = useState<AdminUser | null>(null);
  const [replacementId, setReplacementId] = useState("");
  const [ciReplacementId, setCIReplacementId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [pendingSave, setPendingSave] = useState<AdminUserInput | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const filtered = useMemo(() => users.filter((user) => user.accessModel !== "v3").filter((user) => {
    const query = search.trim().toLowerCase();
    return (!query || `${user.name} ${user.employeeId} ${user.email}`.toLowerCase().includes(query))
      && (role === "All" || user.roles.includes(role as AdminRole))
      && (plant === "All" || user.plant === plant)
      && (zone === "All" || user.zoneMemberships.some((membership) => membership.zone === zone))
      && (status === "All" || user.status === status);
  }), [plant, role, search, status, users, zone]);

  if (!allowed) return <PageContainer><Card><CardContent className="grid min-h-72 place-items-center text-center"><div><ShieldCheck className="mx-auto size-9 text-muted-foreground" /><h1 className="mt-3 text-lg font-semibold">Administration access required</h1><p className="mt-2 text-sm text-muted-foreground">Only authorized Admin and Super Admin users can view Users &amp; Access.</p></div></CardContent></Card></PageContainer>;

  const active = users.filter((user) => user.status === "Active");
  const summary = [
    ["Total Users", users.length], ["Active", active.length], ["Inactive", users.length - active.length],
    ["Admins", active.filter((user) => user.roles.includes("Admin")).length],
    ["Zone Leaders", active.filter((user) => organization.zones.some((item) => item.leaderId === user.id)).length],
  ] as const;

  function responsibilities(user: AdminUser) {
    return {
      actions: getOutstandingUserActions(user.id).length,
      ownedImprovements: getOutstandingUserImprovements(user.id).length,
    };
  }

  function saveUser(input: AdminUserInput) {
    const leadership = input.zoneMemberships.find((membership) => membership.responsibility === "Leader");
    const targetZone = leadership ? organization.zones.find((item) => item.name === leadership.zone) : undefined;
    if (targetZone && targetZone.leaderId !== (editing === "new" ? "" : editing?.id)) { setPendingSave(input); return; }
    commitUser(input);
  }

  function commitUser(input: AdminUserInput) {
    try {
      const saved = editing === "new" ? createAdminUser(input, current.id) : editing ? updateAdminUser(editing.id, input, current.id) : null;
      if (!saved) throw new Error("Could not save the user.");
      const leadership = input.zoneMemberships.find((membership) => membership.responsibility === "Leader");
      if (leadership) {
        const targetZone = organization.zones.find((item) => item.name === leadership.zone);
        if (!targetZone || !assignZoneLeader(targetZone.id, saved.id, current.id)) throw new Error("The user was saved, but Zone leadership could not be updated.");
      }
      setEditing(null); setPendingSave(null); setFeedback({ tone: "success", message: editing === "new" ? "User added successfully." : "User updated successfully." });
    } catch (reason) { setPendingSave(null); setFeedback({ tone: "error", message: reason instanceof Error ? reason.message : "Could not save the user." }); }
  }

  function deactivateUser(user: AdminUser) {
    try { deactivateUserWithActionTransfer(user.id, replacementId, transferReason, current.id, ciReplacementId); setDeactivate(null); setFeedback({ tone: "success", message: `${user.name} is now inactive. Historical records remain unchanged.` }); }
    catch (reason) { setDeactivate(null); setFeedback({ tone: "error", message: reason instanceof Error ? reason.message : "Could not deactivate the user." }); }
  }

  return <PageContainer className="max-w-none">
    <FiveSPageHeader eyebrow={settingsMode ? "" : "Administration"} title={settingsMode ? "Users" : "Users & Access"} description={settingsMode ? "Manage organization users, roles, Plant and Zone assignments." : "Manage users, roles, zones and access to OPS."}  />
    {feedback && <OpsFeedback tone={feedback.tone} message={feedback.message} />}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{summary.map(([label, value]) => <Card key={label} className="shadow-none"><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p></CardContent></Card>)}</div>
    <Card><CardContent className="grid gap-2 p-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(135px,.55fr))]">
      <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ID, or email..." /></div>
      <Filter value={role} onChange={setRole} label="All roles" options={[...ADMIN_ROLES]} /><Filter value={plant} onChange={setPlant} label="All plants" options={organization.plants.map((item) => item.name)} /><Filter value={zone} onChange={setZone} label="All zones" options={organization.zones.map((item) => item.name)} /><Filter value={status} onChange={setStatus} label="All statuses" options={["Active", "Inactive"]} />
    </CardContent></Card>
    <Card className="overflow-hidden"><CardContent className="p-0">
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-sm"><thead><tr className="border-b bg-muted/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground">{["User","Role","Plant","Zone","Status","Last Active","Actions"].map((label) => <th key={label} className="px-4 py-3">{label}</th>)}</tr></thead><tbody>{filtered.map((user) => <tr key={user.id} className="border-b last:border-0"><td className="px-4 py-3"><p className="font-semibold">{user.name}</p><p className="text-xs text-muted-foreground">{user.email}</p></td><td className="px-4 py-3"><div className="flex max-w-64 flex-wrap gap-1">{user.roles.filter((item) => item !== "Viewer").map((item) => <Badge key={item} variant="muted">{item}</Badge>)}</div></td><td className="px-4 py-3">{user.plant}</td><td className="px-4 py-3">{user.zoneMemberships.map((item) => `${item.zone}${item.responsibility === "Leader" ? " · Leader" : ""}`).join(", ") || "—"}</td><td className="px-4 py-3"><Badge variant={user.status === "Active" ? "success" : "muted"}>{user.status}</Badge></td><td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatDate(user.updatedAt)}</td><td className="px-4 py-3"><UserActions user={user} currentId={current.id} canManage={canManage} onInspect={setInspect} onEdit={setEditing} onToggle={(item) => item.status === "Active" ? (setReplacementId(""), setCIReplacementId(""), setTransferReason(""), setDeactivate(item)) : reactivate(item)} /></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 p-3 md:hidden">{filtered.map((user) => <div key={user.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">{user.name}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div><Badge variant={user.status === "Active" ? "success" : "muted"}>{user.status}</Badge></div><div className="mt-3 flex flex-wrap gap-1">{user.roles.map((item) => <Badge key={item} variant="muted">{item}</Badge>)}</div><p className="mt-3 text-xs text-muted-foreground">{user.plant} · {user.zoneMemberships.map((item) => item.zone).join(", ") || "No Zone"}</p><div className="mt-3 border-t pt-2"><UserActions user={user} currentId={current.id} canManage={canManage} onInspect={setInspect} onEdit={setEditing} onToggle={(item) => item.status === "Active" ? (setReplacementId(""), setCIReplacementId(""), setTransferReason(""), setDeactivate(item)) : reactivate(item)} /></div></div>)}</div>
      {!filtered.length && <p className="p-14 text-center text-sm text-muted-foreground">No users match these filters.</p>}
    </CardContent></Card>
    <UserEditor key={typeof editing === "string" ? editing : editing?.id ?? "closed"} user={editing} plants={organization.plants.map((item) => item.name)} zones={organization.zones.filter((item) => item.status === "Active").map((item) => item.name)} currentId={current.id} onClose={() => setEditing(null)} onSave={saveUser} />
    <UserDetail user={inspect} onClose={() => setInspect(null)} />
    <AlertDialog open={Boolean(deactivate)} onOpenChange={(open) => { if (!open) setDeactivate(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Deactivate {deactivate?.name}?</AlertDialogTitle><AlertDialogDescription>{deactivate && (() => { const work = responsibilities(deactivate); return <>This user currently owns <strong>{work.actions} open Actions</strong> and <strong>{work.ownedImprovements} outstanding CI records</strong>. Historical records and CI participation remain preserved. Outstanding ownership must be transferred before deactivation.</>; })()}</AlertDialogDescription></AlertDialogHeader>
      {deactivate && (responsibilities(deactivate).actions > 0 || responsibilities(deactivate).ownedImprovements > 0) && <div className="grid gap-3">
        {responsibilities(deactivate).actions > 0 && <><OpsPersonSelect label="Replacement Action owner" people={getUserTransferCandidates(deactivate.id)} value={replacementId} onValueChange={setReplacementId} />{!getUserTransferCandidates(deactivate.id).length && <p className="text-sm text-muted-foreground">No member is eligible for all affected Zones. Reassign Actions individually before deactivation.</p>}</>}
        {responsibilities(deactivate).ownedImprovements > 0 && <><OpsPersonSelect label="Replacement CI owner" people={getUserCITransferCandidates(deactivate.id)} value={ciReplacementId} onValueChange={setCIReplacementId} />{!getUserCITransferCandidates(deactivate.id).length && <p className="text-sm text-muted-foreground">No active CI owner is eligible for all affected Plants and Zones. CI ownership must be reassigned before deactivation.</p>}</>}
        <Field label="Transfer reason"><Input value={transferReason} onChange={event => setTransferReason(event.target.value)} /></Field>
      </div>}
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={Boolean(deactivate && ((responsibilities(deactivate).actions > 0 && !replacementId) || (responsibilities(deactivate).ownedImprovements > 0 && !ciReplacementId) || ((responsibilities(deactivate).actions > 0 || responsibilities(deactivate).ownedImprovements > 0) && !transferReason.trim())))} onClick={() => deactivate && deactivateUser(deactivate)}>{deactivate && (responsibilities(deactivate).actions > 0 || responsibilities(deactivate).ownedImprovements > 0) ? "Confirm Transfer & Deactivate" : "Confirm Deactivation"}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(pendingSave)} onOpenChange={(open) => { if (!open) setPendingSave(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Change Zone Leader?</AlertDialogTitle><AlertDialogDescription>This may affect new assignments and escalations for this Zone. Existing historical records will remain unchanged.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => pendingSave && commitUser(pendingSave)}>Confirm Change</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </PageContainer>;

  function reactivate(user: AdminUser) { try { if (!setAdminUserActive(user.id, true, current.id)) throw new Error("Could not reactivate the user."); setFeedback({ tone: "success", message: `${user.name} is active.` }); } catch (reason) { setFeedback({ tone: "error", message: reason instanceof Error ? reason.message : "Could not reactivate the user." }); } }
}

function UserEditor({ user, plants, zones, currentId, onClose, onSave }: { user: AdminUser | "new" | null; plants: string[]; zones: string[]; currentId: string; onClose: () => void; onSave: (input: AdminUserInput) => void }) {
  const initial = useMemo<AdminUserInput | null>(() => user === "new" ? { employeeId: `EMP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, name: "", email: "", plant: plants[0] ?? "", status: "Active", roles: [], zoneMemberships: [], permissions: [] } : user ? toInput(user) : null, [plants, user]);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  if (!form) return null;
  const currentForm = form;
  const membership = currentForm.zoneMemberships[0];
  function toggleRole(role: AdminRole, checked: boolean) { const roles = checked ? [...new Set([...currentForm.roles.filter((item) => item !== "Viewer"), role])] : currentForm.roles.filter((item) => item !== role); setForm((current) => current ? { ...current, roles, permissions: permissionsForRoles(roles) } : current); }
  function submit() { if (!currentForm.name.trim()) { setError("Full name is required."); return; } if (!currentForm.email.trim() || !currentForm.email.includes("@")) { setError("A valid user email is required."); return; } if (!currentForm.roles.length) { setError("Select at least one Role."); return; } if (currentForm.status === "Inactive" && membership?.responsibility === "Leader") { setError("An inactive user cannot be selected as Zone Leader."); return; } if (user !== "new" && user?.status === "Active" && currentForm.status === "Inactive") { setError("Use the Deactivate action so active responsibilities can be reviewed first."); return; } if (user !== "new" && user?.id === currentId && (!currentForm.roles.includes("Admin") || currentForm.status === "Inactive")) { setError("You cannot remove your own critical Admin access or deactivate your account."); return; } onSave(currentForm); }
  return <Dialog open={Boolean(user)} onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>{user === "new" ? "Add User" : "Edit User"}</DialogTitle><DialogDescription>Configure the user profile, fixed role capabilities, and current organization assignments.</DialogDescription></DialogHeader><div className="grid gap-6"><section className="grid items-start gap-x-6 gap-y-5 sm:grid-cols-2"><Field label="Full Name"><Input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field><Field label="Employee ID"><Input value={form.employeeId} disabled /><Help>Generated once and retained for historical references.</Help></Field><Field label="Status"><Select searchLabel={"Status"} value={form.status} onValueChange={(value) => setForm({ ...form, status: (value ?? "Active") as AdminUser["status"] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Inactive">Inactive</SelectItem></SelectContent></Select></Field></section><section><Label>Roles</Label><p className="mt-1 text-xs text-muted-foreground">Roles use the current fixed OPS capability presets.</p><div className="mt-3 flex flex-wrap gap-2">{ADMIN_ROLES.map((role) => <label key={role} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm"><Checkbox checked={form.roles.includes(role)} onCheckedChange={(checked) => toggleRole(role, checked === true)} />{role}</label>)}</div></section><section className="grid items-start gap-5 sm:grid-cols-3"><Field label="Plant"><OpsPersonSelect label="Plant" clearable={false} entityLabel="Plant" entityPlural="Plants" people={plants.map(item => ({ id: item, name: item }))} value={form.plant} onValueChange={value => setForm({ ...form, plant: value })} /></Field><Field label="Zone"><OpsPersonSelect label="Zone" clearable={false} entityLabel="Zone" entityPlural="Zones" people={[{ id: "none", name: "No Zone" }, ...zones.map(item => ({ id: item, name: item }))]} value={membership?.zone ?? "none"} onValueChange={value => setForm({ ...form, zoneMemberships: value === "none" ? [] : [{ zone: value, responsibility: membership?.responsibility ?? "Member" }] })} /></Field><Field label="Zone Responsibility"><Select searchLabel={"Zone Responsibility"} disabled={!membership} value={membership?.responsibility ?? "Member"} onValueChange={(value) => setForm({ ...form, zoneMemberships: membership ? [{ ...membership, responsibility: (value ?? "Member") as ZoneResponsibility }] : [] })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Member">Member</SelectItem><SelectItem value="Leader">Zone Leader</SelectItem><SelectItem value="Auditor">Auditor</SelectItem></SelectContent></Select></Field></section>{error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive">{error}</p>}</div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}>Save User</Button></DialogFooter></DialogContent></Dialog>;
}

function UserDetail({ user, onClose }: { user: AdminUser | null; onClose: () => void }) {
  const entitlements = useModuleEntitlements();
  if (!user) return null;
  const permissions = Object.entries({ Audits: "audits.view", Actions: "actions.view", Reports: "reports.view", "Continual Improvement": "ci.view", "Red Flag": "red_tag.view", Administration: "administration.view" }).filter(([, permission]) => user.permissions.includes(permission as never));
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}><DialogContent className="max-h-[calc(100dvh-1rem)] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{user.name}</DialogTitle><DialogDescription>Profile, assignments, inherited access, and current status.</DialogDescription></DialogHeader><div className="grid gap-5"><DetailSection title="Profile"><DetailGrid rows={[["Email", user.email], ["Employee ID", user.employeeId], ["Roles", user.roles.join(", ")], ["Status", user.status]]} /></DetailSection><DetailSection title="Assignments"><DetailGrid rows={[["Plant", user.plant], ["Zone", user.zoneMemberships.map((item) => item.zone).join(", ") || "Not assigned"], ["Responsibility", user.zoneMemberships.map((item) => item.responsibility).join(", ") || "—"]]} /></DetailSection><DetailSection title="Access"><div className="flex flex-wrap gap-2">{permissions.map(([label]) => <Badge key={label} variant="outline"><Check className="size-3" />{label}</Badge>)}</div></DetailSection><DetailSection title="Module Access"><p className="mb-3 text-xs text-muted-foreground">Inherited from the selected factory. Per-user overrides are not used.</p><div className="grid gap-2 sm:grid-cols-2">{ACCESS_CAPABILITIES.map((capability) => <div key={capability.id} className="flex items-center gap-2 rounded-lg border px-3 py-2"><capability.icon className="size-4 text-muted-foreground" /><span className="flex-1 text-sm font-medium">{capability.label}</span><Badge variant={entitlements[capability.id] ? "success" : "muted"}>{entitlements[capability.id] ? "Enabled" : "Unavailable"}</Badge></div>)}</div></DetailSection></div></DialogContent></Dialog>;
}

function UserActions({ user, currentId, canManage, onInspect, onEdit, onToggle }: { user: AdminUser; currentId: string; canManage: boolean; onInspect: (user: AdminUser) => void; onEdit: (user: AdminUser) => void; onToggle: (user: AdminUser) => void }) { return <div className="flex flex-wrap gap-1"><Button size="sm" variant="ghost" onClick={() => onInspect(user)}><Eye className="size-4" />View</Button>{canManage && <Button size="sm" variant="ghost" onClick={() => onEdit(user)}><Edit3 className="size-4" />Edit</Button>}{canManage && user.id !== currentId && <Button size="icon-sm" variant="ghost" onClick={() => onToggle(user)} aria-label={user.status === "Active" ? `Deactivate ${user.name}` : `Activate ${user.name}`}>{user.status === "Active" ? <UserRoundX className="size-4" /> : <UserRoundCheck className="size-4" />}</Button>}</div>; }
function DetailSection({ title, children }: { title: string; children: React.ReactNode }) { return <section><h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><UsersRound className="size-4 text-primary" />{title}</h3><div className="rounded-xl border p-4">{children}</div></section>; }
function DetailGrid({ rows }: { rows: string[][] }) { return <dl className="grid gap-4 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-semibold">{value}</dd></div>)}</dl>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{label}{children}</label>; }
function Help({ children }: { children: React.ReactNode }) { return <span className="text-[11px] font-normal text-muted-foreground">{children}</span>; }
function Filter({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: string[] }) { return <Select searchLabel={label} value={value} onValueChange={(next) => onChange(next ?? "All")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">{label}</SelectItem>{options.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value)); }
function toInput(user: AdminUser): AdminUserInput { return { employeeId: user.employeeId, name: user.name, email: user.email, plant: user.plant, status: user.status, roles: [...user.roles], zoneMemberships: user.zoneMemberships.map((item) => ({ ...item })), permissions: [...user.permissions] }; }

export default function AdministrationUsersPage(props: { settingsMode?: boolean }) {
  useCurrentUser(); useAccessV3State();
  return canOpenAccessAdministration() ? <AccessAdministrationPage /> : <LegacyAdministrationUsersPage {...props} />;
}
