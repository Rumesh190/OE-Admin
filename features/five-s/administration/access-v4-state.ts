"use client";
import { useSyncExternalStore } from "react";
import { readAdministrationPayload } from "@/lib/administration-storage";
import { V4_STORAGE_KEY } from "@/lib/administration-v4-storage";
import type { Department, RoleAssignment } from "./access-v4-models";
export type PersistedDepartment = Department & { readonly revision: number };
export type PersistedAssignment = RoleAssignment & { readonly revision: number };
export interface V4AssignmentEvent {
  id: string; organizationId: string; plantId?: string; actorId: string; targetId: string;
  operation: string; at: string; reason?: string; before?: unknown; after?: unknown;
}
export interface AccessV4State {
  requiredCapabilities?: readonly string[];
  schemaVersion: 1; policyVersion: "ops-access-v4"; revision: number;
  departments: PersistedDepartment[]; assignments: PersistedAssignment[]; events: V4AssignmentEvent[];
}
export const EMPTY_V4: AccessV4State = { schemaVersion: 1, policyVersion: "ops-access-v4", revision: 0, departments: [], assignments: [], events: [] };
const revision = (v: unknown) => Number.isSafeInteger(v) && (v as number) >= 1;
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
export function decodeAccessV4(raw: string | null): AccessV4State {
  if (raw === null) return EMPTY_V4; // Not initialized; reads never seed storage.
  const s = JSON.parse(raw) as AccessV4State;
  if (!s || s.schemaVersion !== 1 || s.policyVersion !== "ops-access-v4" || !revision(s.revision) || !Array.isArray(s.departments) || !Array.isArray(s.assignments) || !Array.isArray(s.events)) throw new Error("Unsupported v4 administration data. Preserve storage; no automatic migration is available.");
  if (s.requiredCapabilities !== undefined && (!Array.isArray(s.requiredCapabilities) || s.requiredCapabilities.some(c => !["departments", "independent-assignments"].includes(c)))) throw new Error("Unsupported required administration capability. Preserve storage.");
  const all = [...s.departments, ...s.assignments];
  if (all.some(r => !r || !text(r.id) || !text(r.organizationId) || !text(r.plantId) || !revision(r.revision)) || new Set(all.map(r => r.id)).size !== all.length) throw new Error("Invalid v4 identities, scope or revisions.");
  if (s.departments.some(d => !text(d.zoneId) || !text(d.name) || !text(d.code) || !["Active", "Inactive"].includes(d.status) || !text(d.createdBy) || !text(d.createdAt) || !text(d.updatedBy) || !text(d.updatedAt))) throw new Error("Invalid Department record.");
  if (s.assignments.some(a => !text(a.personId) || !text(a.assignedBy) || !text(a.assignedAt) || !["Active", "Revoked"].includes(a.status) || (a.status === "Revoked" && (!text(a.revokedBy) || !text(a.revokedAt) || !text(a.revocationReason))) || (a.role === "Zone Champion" ? a.zoneId !== undefined || a.departmentId !== undefined : a.role === "Zone Leader" ? !text(a.zoneId) || a.departmentId !== undefined : !["Department Leader", "Department Member"].includes(a.role) || !text(a.zoneId) || !text(a.departmentId)))) throw new Error("Invalid independent assignment record.");
  if (s.events.some(e => !e || !text(e.id) || !text(e.organizationId) || !text(e.actorId) || !text(e.targetId) || !text(e.operation) || !text(e.at)) || new Set(s.events.map(e => e.id)).size !== s.events.length) throw new Error("Invalid assignment history.");
  return s; // Compatible unknown fields are retained by spread-based updates.
}
let previous: string | null | undefined;
let snapshot = EMPTY_V4;
const listeners = new Set<() => void>();
export function getAccessV4State() {
  if (typeof window === "undefined") return EMPTY_V4;
  const raw = readAdministrationPayload(V4_STORAGE_KEY);
  if (raw !== previous) { snapshot = decodeAccessV4(raw); previous = raw; }
  return snapshot;
}
export function notifyAccessV4() { listeners.forEach(l => l()); }
function subscribe(l: () => void) { listeners.add(l); window.addEventListener?.("storage", l); return () => { listeners.delete(l); window.removeEventListener?.("storage", l); }; }
export function useAccessV4State() { return useSyncExternalStore(subscribe, getAccessV4State, () => EMPTY_V4); }
