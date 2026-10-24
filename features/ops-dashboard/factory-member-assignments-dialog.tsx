"use client";

import { useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getActiveAccessContext } from "@/features/five-s/administration/access-v4-context";
import { getAccessV4State, useAccessV4State, type PersistedAssignment, type PersistedDepartment } from "@/features/five-s/administration/access-v4-state";
import { assignV4Role } from "@/features/five-s/administration/access-v4-store";
import { saveFactoryUser } from "@/features/five-s/administration/access-v3-store";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import type { FactoryMembership, ZoneAllocation } from "@/features/five-s/administration/access-v3-types";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { getAllOrganizationConfiguration, useOrganizationConfiguration, type OrganizationZone } from "@/lib/organization-store";

type ZoneRole = "Zone Member" | "Zone Leader";
type DepartmentRole = "Department Member" | "Department Leader";

function AssignmentSelect({ label, value, disabled, placeholder, onChange, children }: { label: string; value: string; disabled?: boolean; placeholder: string; onChange: (value: string) => void; children: ReactNode }) {
  return <label className="grid gap-1.5 text-sm font-medium">{label}<Select value={value} disabled={disabled} onValueChange={value => onChange(value ?? "")}><SelectTrigger aria-label={label} className="w-full"><SelectValue placeholder={placeholder}/></SelectTrigger><SelectContent>{children}</SelectContent></Select></label>;
}

function MemberAssignmentRow({ organizationId, plantId, membership, name, zones, departments, allocations, assignments }: {
  organizationId: string;
  plantId: string;
  membership: FactoryMembership;
  name: string;
  zones: OrganizationZone[];
  departments: PersistedDepartment[];
  allocations: ZoneAllocation[];
  assignments: PersistedAssignment[];
}) {
  const currentAllocation = allocations.find(item => item.status === "Active");
  const currentDepartmentAssignments = assignments.filter(item => item.status === "Active" && (item.role === "Department Member" || item.role === "Department Leader"));
  const currentDepartmentAssignment = currentDepartmentAssignments.length === 1 ? currentDepartmentAssignments[0] : undefined;
  const [zoneId, setZoneId] = useState(currentDepartmentAssignment?.zoneId ?? currentAllocation?.zoneId ?? "");
  const [zoneRole, setZoneRole] = useState<ZoneRole>(currentAllocation?.responsibility === "Leader" || membership.baseRole === "Zone Leader" ? "Zone Leader" : "Zone Member");
  const [departmentId, setDepartmentId] = useState(currentDepartmentAssignment?.departmentId ?? "");
  const [departmentRole, setDepartmentRole] = useState<DepartmentRole>(currentDepartmentAssignment?.role === "Department Leader" ? "Department Leader" : "Department Member");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const departmentLocked = currentDepartmentAssignments.length > 0;
  const availableDepartments = departments.filter(item => item.zoneId === zoneId);

  async function save() {
    let zoneSaved = false;
    setPending(true); setError(""); setMessage("");
    try {
      if (!zoneId || !zones.some(item => item.id === zoneId)) throw new Error("Select a Zone for this member.");
      if (departmentId && !availableDepartments.some(item => item.id === departmentId)) throw new Error("Select a Department within the chosen Zone.");
      if (currentDepartmentAssignments.length > 1) throw new Error("Multiple active Department assignments require administrator review.");
      saveFactoryUser(organizationId, plantId, { userId: membership.userId, baseRole: zoneRole, zoneIds: [zoneId], status: membership.status });
      zoneSaved = true;
      if (departmentId && !currentDepartmentAssignment) {
        const context = getActiveAccessContext();
        if (!context || context.kind !== "factory" || context.organizationId !== organizationId || context.plantId !== plantId) throw new Error("Factory context changed. Reopen Assign Members.");
        await assignV4Role({ organizationId, plantId, zoneId, departmentId }, departmentRole, membership.userId, { selectionId: context.selectionId, revision: getAccessV4State().revision });
      }
      setMessage("Assignment saved");
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : "Unable to save this assignment.";
      setError(zoneSaved && departmentId && !currentDepartmentAssignment ? `Zone assignment saved. Department role was not saved: ${detail}` : detail);
    } finally {
      setPending(false);
    }
  }

  return <section className="grid gap-4 rounded-xl border p-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">{name}</h3><p className="text-xs text-muted-foreground">{membership.baseRole === "Standard User" ? "Ready for assignment" : membership.baseRole}</p></div>{message && <span className="flex items-center gap-1 text-sm text-emerald-700"><Check className="size-4"/>{message}</span>}</div>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <AssignmentSelect label="Zone" value={zoneId} disabled={departmentLocked} placeholder="Select Zone" onChange={value => { setZoneId(value); setDepartmentId(""); setMessage(""); }}>
        {zones.map(zone => <SelectItem key={zone.id} value={zone.id}>{zone.name}</SelectItem>)}
      </AssignmentSelect>
      <AssignmentSelect label="Zone role" value={zoneRole} disabled={!zoneId} placeholder="Select Zone role" onChange={value => { setZoneRole(value as ZoneRole); setMessage(""); }}>
        <SelectItem value="Zone Member">Zone Member</SelectItem><SelectItem value="Zone Leader">Zone Leader</SelectItem>
      </AssignmentSelect>
      <AssignmentSelect label="Department" value={departmentId || "none"} disabled={!zoneId || departmentLocked} placeholder="Optional" onChange={value => { setDepartmentId(value === "none" ? "" : value); setMessage(""); }}>
        <SelectItem value="none">No Department</SelectItem>{availableDepartments.map(department => <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>)}
      </AssignmentSelect>
      <AssignmentSelect label="Department role" value={departmentRole} disabled={!departmentId || departmentLocked} placeholder="Select Department role" onChange={value => { setDepartmentRole(value as DepartmentRole); setMessage(""); }}>
        <SelectItem value="Department Member">Department Member</SelectItem><SelectItem value="Department Leader">Department Leader</SelectItem>
      </AssignmentSelect>
    </div>
    {departmentLocked && <p className="text-xs text-muted-foreground">The existing Department assignment is preserved. Zone role can still be updated within the same Zone.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex justify-end"><Button size="sm" disabled={pending || !zoneId} onClick={save}>{pending ? "Saving…" : "Save assignment"}</Button></div>
  </section>;
}

export function FactoryMemberAssignmentsDialog({ organizationId, plantId, factoryName, onClose }: { organizationId: string; plantId: string; factoryName: string; onClose: () => void }) {
  const accessV3 = useAccessV3State();
  const accessV4 = useAccessV4State();
  const people = useAdminUsers(true);
  useOrganizationConfiguration();
  const zones = getAllOrganizationConfiguration().zones.filter(item => item.plantId === plantId && item.status === "Active" && (!item.organizationId || item.organizationId === organizationId));
  const departments = accessV4.departments.filter(item => item.organizationId === organizationId && item.plantId === plantId && item.status === "Active");
  const memberships = accessV3.factoryMemberships.filter(item => item.organizationId === organizationId && item.plantId === plantId && item.status === "Active");

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>Assign Members</DialogTitle><DialogDescription>Assign every {factoryName} user to a Zone and, when needed, a Department. Roles apply only within the selected scope.</DialogDescription></DialogHeader>
    <div className="grid gap-4">{memberships.map(membership => <MemberAssignmentRow key={membership.id} organizationId={organizationId} plantId={plantId} membership={membership} name={people.find(person => person.id === membership.userId)?.name ?? "Factory user"} zones={zones} departments={departments} allocations={accessV3.zoneAllocations.filter(item => item.userId === membership.userId && item.plantId === plantId)} assignments={accessV4.assignments.filter(item => item.personId === membership.userId && item.organizationId === organizationId && item.plantId === plantId)}/>)}
      {!memberships.length && <p className="rounded-xl border p-4 text-sm text-muted-foreground">Add factory users before assigning members.</p>}
      {!zones.length && <p className="text-sm text-destructive">Create a Zone before assigning members.</p>}
    </div>
    <DialogFooter><Button variant="outline" onClick={onClose}>Done</Button></DialogFooter>
  </DialogContent></Dialog>;
}
