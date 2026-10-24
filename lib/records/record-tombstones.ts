"use client";
import { useMemo, useSyncExternalStore } from "react";
import { safeSetStorage } from "@/lib/browser-storage";
import { DEMO_ORGANIZATION } from "@/lib/organizations";
import type { VisualManagementBoard } from "@/features/visual-management/types";
import type { MyAction, ActionSourceModule } from "@/features/five-s/types/my-actions";
import type { OpsRecordRef } from "@/lib/relationships/types";

export type DeletionModule = "audit" | "redTag" | "gemba" | "gembaObservation" | "continuousImprovement" | "visualImprovement" | "vmBoard" | "vmMeeting" | "action";
export interface DeletionRecord { id: string; title: string; plant: string; zone?: string; organizationId?: string; aliases?: string[]; parentId?: string; childIds?: string[]; linkedActionIds?: string[]; boardAccess?: Pick<VisualManagementBoard, "plant" | "zone" | "owner" | "members"> }
export interface RecordTombstone extends DeletionRecord { module: DeletionModule; organizationId: string; deletedAt: string; deletedById: string; deletedByName: string }
export const DELETION_STORAGE_KEY = `ops-record-tombstones-v1:${DEMO_ORGANIZATION.id}`;
const EMPTY: RecordTombstone[] = [];
let serialized: string | null | undefined;
let records = EMPTY;
const listeners = new Set<() => void>();
const sources = new Map<DeletionModule, (id: string) => DeletionRecord | undefined>();
let policy: ((module: DeletionModule, id: string) => { record: DeletionRecord; actorId: string; actorName: string }) | undefined;
let actionReader: () => MyAction[] = () => [];
export function registerDeletionSource(module: DeletionModule, reader: (id: string) => DeletionRecord | undefined) { sources.set(module, reader); }
export function getDeletionRecord(module: DeletionModule, id: string) { return sources.get(module)?.(id); }
export function registerDeletionActionReader(reader: () => MyAction[]) { actionReader = reader; }
export function readDeletionActions() { return actionReader(); }
export function registerDeletionPolicy(next: NonNullable<typeof policy>) { policy = next; }
function snapshot() {
  if (typeof window === "undefined") return EMPTY;
  const stored = window.localStorage.getItem(DELETION_STORAGE_KEY);
  if (stored !== serialized) {
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) throw new Error("Deletion history is invalid. Restore browser storage before continuing.");
    records = parsed.filter((item: RecordTombstone) => item.organizationId === DEMO_ORGANIZATION.id);
    serialized = stored;
  }
  return records;
}
export function subscribeRecordDeletions(listener: () => void) {
  listeners.add(listener);
  const changed = (event: StorageEvent) => { if (event.key === DELETION_STORAGE_KEY || event.key === null) listener(); };
  if (typeof window !== "undefined") window.addEventListener?.("storage", changed);
  return () => { listeners.delete(listener); if (typeof window !== "undefined") window.removeEventListener?.("storage", changed); };
}
export function useRecordDeletions() { return useSyncExternalStore(subscribeRecordDeletions, snapshot, () => EMPTY); }
export function getRecordTombstone(module: DeletionModule, id: string) { return snapshot().find(item => item.module === module && (item.id === id || item.aliases?.includes(id))); }
export function activeOperationalRecords<T extends { id: string }>(module: DeletionModule, items: readonly T[], deleted = snapshot()): T[] {
  if (!deleted.some(item => item.module === module)) return [...items];
  return items.filter(item => !deleted.some(record => record.module === module && record.id === item.id));
}
export function useActiveOperationalRecords<T extends { id: string }>(module: DeletionModule, items: readonly T[]): T[] {
  const deleted = useRecordDeletions();
  return useMemo(() => activeOperationalRecords(module, items, deleted), [module, items, deleted]);
}
/** Persistence always invokes the registered canonical authorization policy, including direct calls. */
export function commitOperationalDeletion(module: DeletionModule, id: string, confirmed = false) {
  if (!confirmed) throw new Error("Confirm deletion before deleting this record.");
  if (!policy) throw new Error("Record deletion is unavailable.");
  const authorized = policy(module, id);
  const current = snapshot();
  if (getRecordTombstone(module, id)) throw new Error("This record has already been deleted.");
  const tombstone: RecordTombstone = { ...authorized.record, module, organizationId: DEMO_ORGANIZATION.id, deletedAt: new Date().toISOString(), deletedById: authorized.actorId, deletedByName: authorized.actorName };
  const next = [...current, tombstone];
  const saved = safeSetStorage(DELETION_STORAGE_KEY, next);
  if (!saved.success) throw new Error(saved.message);
  records = next; serialized = JSON.stringify(next);
  listeners.forEach(listener => listener());
  return tombstone;
}
export function deletedRecordRef(ref: OpsRecordRef) {
  if (ref.module === "action") return getRecordTombstone("action", ref.recordId);
  if (ref.module === "gemba") return (ref.childId && getRecordTombstone("gembaObservation", ref.childId)) || getRecordTombstone("gemba", ref.recordId);
  if (ref.module === "visualManagement") return ref.childId ? getRecordTombstone("vmMeeting", ref.childId) : getRecordTombstone("vmBoard", ref.recordId) || getRecordTombstone("vmMeeting", ref.recordId);
  if (["audit", "redTag", "continuousImprovement", "visualImprovement"].includes(ref.module)) return getRecordTombstone(ref.module as DeletionModule, ref.recordId);
}
export function deletedActionSource(action: MyAction, module: ActionSourceModule) {
  const id = action.sourceId ?? action.auditId ?? action.sourceTitle;
  if (module === "manual") return undefined;
  if (module === "redFlag") return getRecordTombstone("redTag", id);
  if (module === "visualManagement") return (action.visualManagementSource?.meetingId && getRecordTombstone("vmMeeting", action.visualManagementSource.meetingId)) || (action.visualManagementSource?.boardId && getRecordTombstone("vmBoard", action.visualManagementSource.boardId)) || getRecordTombstone("vmMeeting", id) || getRecordTombstone("vmBoard", id);
  if (module === "gemba") return (action.sourceObservationId && getRecordTombstone("gembaObservation", action.sourceObservationId)) || getRecordTombstone("gemba", id);
  return getRecordTombstone(module, module === "audit" ? action.auditId ?? id : id);
}
export function deletedRecordHref(href: string) {
  const [path, search] = href.split("?");
  const audit = new URLSearchParams(search).get("audit");
  if (audit && ["/audits", "/5s/audits"].includes(path)) return getRecordTombstone("audit", audit);
  const routes: Array<[RegExp, DeletionModule]> = [[/^\/(?:5s\/)?actions\/([^/?#]+)/, "action"], [/^\/(?:5s\/)?audits\/([^/?#]+)/, "audit"], [/^\/5s\/red\/([^/?#]+)/, "redTag"], [/^\/gemba\/([^/?#]+)/, "gemba"], [/^\/continuous-improvement\/([^/?#]+)/, "continuousImprovement"], [/^\/visual-improvement\/([^/?#]+)/, "visualImprovement"], [/^\/visual-management\/boards\/([^/?#]+)/, "vmBoard"], [/^\/visual-management\/meetings\/([^/?#]+)/, "vmMeeting"]];
  for (const [pattern, module] of routes) { const match = path.match(pattern); if (match) return getRecordTombstone(module, decodeURIComponent(match[1])); }
}
