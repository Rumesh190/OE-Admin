"use client";
import { useCurrentUser } from "@/lib/current-user";
import { useAccessContext } from "@/features/five-s/administration/access-v4-context";
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
import { getOrganizations } from "@/lib/organizations";
export function ActiveAccessLabel() {
  const person = useCurrentUser();
  const { context, ready, error } = useAccessContext();
  const state = useAccessV4State(); useAccessV3State();
  if (!ready) return <span className="sr-only">Loading persona scope</span>;
  const config = getAllOrganizationConfiguration();
  const assignments = state.assignments.filter(a => a.personId === person.id && a.status === "Active" && context?.kind === "factory" && a.organizationId === context.organizationId && a.plantId === context.plantId);
  const location = error ? "Scope unavailable" : !context ? person.plant : context.kind === "platform" ? "Platform administration" : [getOrganizations().find(o => o.id === context.organizationId)?.name, context.kind === "factory" ? config.plants.find(p => p.id === context.plantId)?.name : "Client administration", ...assignments.map(a => a.zoneId ? [config.zones.find(z => z.id === a.zoneId)?.name, a.departmentId ? state.departments.find(d => d.id === a.departmentId)?.name : undefined].filter(Boolean).join(" / ") : "Factory oversight")].filter(Boolean).join(" · ");
  return <div className="hidden min-w-0 max-w-md px-2 text-right md:block" aria-label="Active persona and scope"><p className="truncate text-sm font-medium">{person.name} · {person.role}</p><p className="truncate text-xs text-muted-foreground" title={location}>{location}</p></div>;
}
