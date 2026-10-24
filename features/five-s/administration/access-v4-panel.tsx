"use client";
import { useState, type ReactNode } from "react";
import { useCurrentUser } from "@/lib/current-user";
import { useAdminUsers } from "./store";
import { useOrganizations, getOrganizations } from "@/lib/organizations";
import { useOrganizationConfiguration, getAllOrganizationConfiguration } from "@/lib/organization-store";
import { useAccessV3State, ACCESS_V3_KEY } from "./access-v3-state";
import { useAccessV4State, type PersistedAssignment, type PersistedDepartment } from "./access-v4-state";
import { authorizedContextOptions, useAccessContext, selectAccessContext, isDepartmentLeader, type AccessContext } from "./access-v4-context";
import { resolveFactoryPerson } from "./factory-authorization";
import { assignV4Role, saveDepartment, attachPersonToClient, recoverV4Administration, type V4WriteExpectation } from "./access-v4-store";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { readAdministrationPayload } from "@/lib/administration-storage";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>; }
function Choice({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: { id: string; name: string }[]; onChange: (v: string) => void; disabled?: boolean }) {
  return <Field label={label}><Select value={value} disabled={disabled} onValueChange={v => onChange(v ?? "")}><SelectTrigger aria-label={label} className="w-full"><SelectValue placeholder={`Select ${label.toLowerCase()}`}>{options.find(o => o.id === value)?.name}</SelectValue></SelectTrigger><SelectContent>{options.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select></Field>;
}
function createDepartmentCode(name: string) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "DEPARTMENT";
}
function contextId(c: AccessContext) { return `${c.kind}:${c.organizationId ?? ""}:${c.plantId ?? ""}`; }
export function AccessV4Panel({ embedded = false, search = "", view = "all", showActions = true }: { embedded?: boolean; search?: string; view?: "all" | "departments" | "responsibilities"; showActions?: boolean } = {}) {
  const identity = useCurrentUser(); const people = useAdminUsers(true); useOrganizations(); useOrganizationConfiguration(); useAccessV3State();
  const state = useAccessV4State(); const { context, ready, error: contextError } = useAccessContext();
  const [error, setError] = useState(""); const [dialog, setDialog] = useState<{ kind: "department" | "role" | "attach"; expected: V4WriteExpectation; department?: PersistedDepartment; context: AccessContext; v3: string | null }>();
  if (!ready) return <p role="status" className="p-6 text-sm text-muted-foreground">Loading organizational access…</p>;
  const options = authorizedContextOptions();
  const factory = context?.kind === "factory" ? context : null;
  const resolved = factory ? resolveFactoryPerson(identity.id, factory) : null;
  const manager = Boolean(resolved?.clientAdmin || resolved?.factoryAdmin);
  const champion = Boolean(factory && state.assignments.some(a => a.role === "Zone Champion" && a.personId === identity.id && a.status === "Active" && a.organizationId === factory.organizationId && a.plantId === factory.plantId));
  const departments = factory ? state.departments.filter(d => d.organizationId === factory.organizationId && d.plantId === factory.plantId && (manager || champion || isDepartmentLeader(identity.id, d.id, factory.organizationId, factory.plantId))) : [];
  const readable = (a: PersistedAssignment) => factory && a.organizationId === factory.organizationId && a.plantId === factory.plantId && (manager || a.personId === identity.id || (a.departmentId && isDepartmentLeader(identity.id, a.departmentId, factory.organizationId, factory.plantId)));
  const query = search.trim().toLowerCase();
  const visibleDepartments = departments.filter(department => {
    const zone = getAllOrganizationConfiguration().zones.find(item => item.id === department.zoneId);
    return !query || `${department.name} ${zone?.name ?? ""}`.toLowerCase().includes(query);
  });
  const visibleAssignments = state.assignments.filter(readable).filter(assignment => {
    const department = departments.find(item => item.id === assignment.departmentId);
    const zone = getAllOrganizationConfiguration().zones.find(item => item.id === assignment.zoneId);
    const person = people.find(item => item.id === assignment.personId);
    return !query || `${person?.name ?? ""} ${assignment.role} ${department?.name ?? ""} ${zone?.name ?? ""}`.toLowerCase().includes(query);
  });
  const showDepartments = view !== "responsibilities";
  const showResponsibilities = view !== "departments";
  function open(kind: "department" | "role" | "attach", department?: PersistedDepartment) { if (context) setDialog({ kind, department, context, expected: { selectionId: context.selectionId, revision: state.revision }, v3: readAdministrationPayload(ACCESS_V3_KEY) }); }
  return <section aria-label="Organizational access v4" className={embedded ? "grid min-w-0 content-start gap-4 rounded-2xl border bg-card p-5 shadow-sm" : "mb-6 grid min-w-0 gap-4 border-b pb-6"}>
    {!embedded && <><div><h2 className="text-lg font-semibold">Organization structure</h2><p className="text-sm text-muted-foreground">Departments and role assignments in your current authorized scope.</p></div>
    <Choice label="Active context" value={context ? contextId(context) : ""} options={options.map(c => ({ id: contextId(c), name: c.kind === "platform" ? "Metric Mind · Platform administration" : `${getOrganizations().find(o => o.id === c.organizationId)?.name ?? c.organizationId} · ${c.kind === "client" ? "Client administration" : getAllOrganizationConfiguration().plants.find(p => p.id === c.plantId)?.name ?? c.plantId}` }))} onChange={id => { try { const selected = options.find(c => contextId(c) === id); if (selected) selectAccessContext(selected); setDialog(undefined); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Unable to select context"); } }}/></>}
    {embedded && <div><h2 className="font-semibold">{view === "departments" ? "Departments" : view === "responsibilities" ? "Responsibilities" : "Departments & responsibilities"}</h2><p className="mt-1 text-sm text-muted-foreground">{view === "departments" ? "Add Departments beneath the factory's Zones." : view === "responsibilities" ? "Assign factory members to their operational responsibilities." : "Organize Departments and assign each member's responsibility."}</p></div>}
    {(error || contextError) && <p role="alert" className="text-sm text-destructive">{error || contextError}</p>}
    {!context && <p className="text-sm text-muted-foreground">Select an authorized context to manage v4 assignments. No client or factory is selected automatically.</p>}
    {context?.kind === "platform" && <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => open("attach")}>Attach existing person to client</Button><Button variant="outline" onClick={async () => { try { await recoverV4Administration(); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "Recovery failed"); } }}>Recover v4 administration</Button></div>}
    {factory && <>
      {showActions && <div className="flex flex-wrap gap-2">{showDepartments && manager && <Button size="sm" onClick={() => open("department")}>Create Department</Button>}{showResponsibilities && (manager || departments.some(d => isDepartmentLeader(identity.id, d.id, factory.organizationId, factory.plantId))) && <Button size="sm" onClick={() => open("role")}>{manager ? "Assign members" : "Assign Department Member"}</Button>}</div>}
      {showDepartments && <><div className="divide-y border-y">{visibleDepartments.map(d => <div className="flex flex-wrap items-center justify-between gap-3 py-3" key={d.id}><div><p className="font-medium">{d.name}</p><p className="text-sm text-muted-foreground">{getAllOrganizationConfiguration().zones.find(z => z.id === d.zoneId)?.name ?? "Assigned Zone"}</p></div>{manager && <Button size="sm" variant="ghost" onClick={() => open("department", d)}>Edit</Button>}</div>)}</div>{!visibleDepartments.length && <p className="text-sm text-muted-foreground">{query ? "No Departments match this search." : "No Departments available in your assigned scope."}</p>}</>}
      {showResponsibilities && <><div className="divide-y border-y">{visibleAssignments.map(a => { const department = departments.find(d => d.id === a.departmentId); const zone = getAllOrganizationConfiguration().zones.find(z => z.id === a.zoneId); return <div key={a.id} className="py-3"><p className="font-medium">{people.find(p => p.id === a.personId)?.name ?? "Assigned person"}</p><p className="text-sm text-muted-foreground">{a.role} · {department?.name ?? zone?.name ?? "Factory-wide"}</p></div>; })}{!visibleAssignments.length && <p className="py-5 text-sm text-muted-foreground">{query ? "No responsibilities match this search." : "No responsibilities have been assigned yet."}</p>}</div><details><summary className="cursor-pointer text-sm font-medium">Assignment lifecycle history</summary><div className="divide-y">{state.events.filter(e => e.organizationId === factory.organizationId && e.plantId === factory.plantId && (manager || state.assignments.some(a => a.id === e.targetId && readable(a)))).slice().reverse().map(e => <p key={e.id} className="break-words py-2 text-sm">{e.operation} · {e.targetId} · {e.actorId} · {e.at}{e.reason ? ` · ${e.reason}` : ""}</p>)}</div></details></>}
    </>}
    {dialog && context?.selectionId === dialog.context.selectionId && <V4Dialog key={`${dialog.kind}:${dialog.context.selectionId}`} {...dialog} fa={manager} onClose={() => setDialog(undefined)}/>}
  </section>;
}
export function DepartmentDialog({ organizationId, plantId, onClose }: { organizationId: string; plantId: string; onClose: () => void }) {
  const state = useAccessV4State();
  const { context, ready } = useAccessContext();
  if (!ready || !context || context.kind !== "factory" || context.organizationId !== organizationId || context.plantId !== plantId) return null;
  return <V4Dialog kind="department" expected={{ selectionId: context.selectionId, revision: state.revision }} context={context} v3={null} fa onClose={onClose}/>;
}
export function ResponsibilityDialog({ onClose }: { onClose: () => void }) {
  const identity = useCurrentUser();
  const state = useAccessV4State();
  const { context, ready } = useAccessContext();
  if (!ready || !context || context.kind !== "factory") return null;
  const resolved = resolveFactoryPerson(identity.id, context);
  const manager = Boolean(resolved.clientAdmin || resolved.factoryAdmin);
  return <V4Dialog kind="role" expected={{ selectionId: context.selectionId, revision: state.revision }} context={context} v3={readAdministrationPayload(ACCESS_V3_KEY)} fa={manager} onClose={onClose}/>;
}
function V4Dialog({ kind, expected, context, department, v3, fa, onClose }: { kind: "department" | "role" | "attach"; expected: V4WriteExpectation; context: AccessContext; department?: PersistedDepartment; v3: string | null; fa: boolean; onClose: () => void }) {
  const state = useAccessV4State(); const people = useAdminUsers(true); const identity = useCurrentUser();
  const [name, setName] = useState(department?.name ?? ""); const [zoneId, setZoneId] = useState(department?.zoneId ?? ""); const [departmentId, setDepartmentId] = useState("");
  const [role, setRole] = useState<PersistedAssignment["role"]>(fa ? "Zone Champion" : "Department Member");
  const [personId, setPersonId] = useState(""); const [clientId, setClientId] = useState(""); const [confirmed, setConfirmed] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const scope = context.kind === "factory" ? { organizationId: context.organizationId, plantId: context.plantId } : null;
  const zones = scope ? getAllOrganizationConfiguration().zones.filter(z => z.plantId === scope.plantId && z.status === "Active") : [];
  const departments = scope ? state.departments.filter(d => d.organizationId === scope.organizationId && d.plantId === scope.plantId && d.status === "Active" && (fa || isDepartmentLeader(identity.id, d.id, scope.organizationId, scope.plantId))) : [];
  const selectedDepartment = departments.find(d => d.id === departmentId);
  const needsDepartment = role === "Department Leader" || role === "Department Member";
  const candidates = kind === "attach" ? people.filter(p => p.status === "Active" && p.id !== "USR-OPS-SUPER-ADMIN") : scope ? people.filter(p => {
    const resolved = resolveFactoryPerson(p.id, scope);
    const selectedZone = needsDepartment ? selectedDepartment?.zoneId : role === "Zone Leader" ? zoneId : undefined;
    return resolved.valid && resolved.membership && (!selectedZone || !resolved.allocations.some(a => a.zoneId !== selectedZone)) && (fa || (selectedZone && (resolved.allocations.some(a => a.zoneId === selectedZone) || state.assignments.some(a => a.personId === p.id && a.organizationId === scope.organizationId && a.plantId === scope.plantId && a.zoneId === selectedZone && a.status === "Active"))));
  }) : [];
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{kind === "department" ? department ? "Edit Department" : "Create Department" : kind === "attach" ? "Attach existing person" : "Assign member"}</DialogTitle><DialogDescription>{kind === "attach" ? "Platform review creates an ordinary client membership only. Existing memberships and responsibilities are preserved." : kind === "department" ? "Choose the parent Zone and enter the Department name. New Departments are activated automatically." : "Choose the member, their Zone or Department, and the responsibility they will hold."}</DialogDescription></DialogHeader>
    <form className="grid gap-4" onSubmit={async e => { e.preventDefault(); setPending(true); setError(""); try {
      if (kind === "attach") await attachPersonToClient({ personId, organizationId: clientId, confirmedPersonId: confirmed, reason, expectedV3Payload: v3 }, expected);
      else if (scope && kind === "department") await saveDepartment({ ...scope, zoneId }, { id: department?.id, name, code: department?.code ?? createDepartmentCode(name), status: department?.status ?? "Active" }, expected);
      else if (scope) await assignV4Role({ ...scope, ...(needsDepartment ? { zoneId: selectedDepartment?.zoneId, departmentId } : role === "Zone Leader" ? { zoneId } : {}) }, role, personId, expected);
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save"); } finally { setPending(false); } }}>
      {kind === "department" ? <><Choice label="Parent Zone" value={zoneId} disabled={Boolean(department)} onChange={setZoneId} options={zones.map(z => ({ id: z.id, name: z.name }))}/><Field label="Department name"><Input required value={name} onChange={e => setName(e.target.value)}/></Field></> : <>
        {kind === "attach" ? <Choice label="Target client" value={clientId} onChange={setClientId} options={getOrganizations().filter(o => o.status === "Active").map(o => ({ id: o.id, name: o.name }))}/> : <><Choice label="Role" value={role} onChange={v => { setRole(v as PersistedAssignment["role"]); setPersonId(""); }} options={(fa ? ["Zone Champion", "Zone Leader", "Department Leader", "Department Member"] : ["Department Member"]).map(r => ({ id: r, name: r }))}/>{role === "Zone Leader" && <Choice label="Zone" value={zoneId} onChange={setZoneId} options={zones.map(z => ({ id: z.id, name: z.name }))}/>}{needsDepartment && <Choice label="Department" value={departmentId} onChange={setDepartmentId} options={departments.map(d => ({ id: d.id, name: d.name }))}/>}</>}
        <Choice label="Eligible person" value={personId} onChange={setPersonId} options={candidates.map(p => ({ id: p.id, name: p.name }))}/>{!candidates.length && <p className="text-sm text-muted-foreground">No eligible people in the selected scope. Client and factory memberships must be explicitly configured first.</p>}
        {kind === "attach" && <><Field label="Confirm canonical person ID"><Input required value={confirmed} onChange={e => setConfirmed(e.target.value)}/></Field><Field label="Review reason"><Input required value={reason} onChange={e => setReason(e.target.value)}/></Field></>}
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || (kind !== "department" && !candidates.some(p => p.id === personId))}>{pending ? "Saving…" : "Confirm"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
