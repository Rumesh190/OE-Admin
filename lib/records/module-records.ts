"use client";

import { DEMO_ORGANIZATION } from "@/lib/organizations";
import { safeSetStorageString } from "@/lib/browser-storage";

/** Business records only. Child/event, configuration and template IDs are independent. */
export const MODULE_RECORD_PREFIXES = {
  audit: "AUD", redTag: "RT", continuousImprovement: "CI", visualImprovement: "VI",
  visualManagement: "VM", gemba: "GW", actions: "ACT", redFlag: "RF",
} as const;
export type RecordModule = keyof typeof MODULE_RECORD_PREFIXES;
export const RECORD_CREATION_LOCK = "ops-business-record-creation-v1";
const refreshers = new Map<string, () => void>();
let creationScope = false;

export function registerRecordCreationStore(key: string, refresh: () => void) { refreshers.set(key, refresh); }

/** Reload registered browser-backed module stores after an explicit demo-data import. */
export function refreshRegisteredRecordStores() {
  for (const refresh of refreshers.values()) refresh();
}

/** Keep existing synchronous commands; run their complete read/create/write inside one browser lock. */
export async function withBusinessRecordCreation<T>(create: () => T): Promise<T> {
  const execute = () => {
    for (const refresh of refreshers.values()) refresh();
    creationScope = true;
    try { return create(); } finally { creationScope = false; }
  };
  if (typeof navigator !== "undefined" && navigator.locks) return navigator.locks.request(RECORD_CREATION_LOCK, execute);
  if (typeof window !== "undefined" && window.document) throw new Error("Safe record creation requires a browser with Web Locks support. Please use a supported browser.");
  return execute(); // Non-browser command tests; never a browser concurrency fallback.
}

function sequenceKey(module: RecordModule, organizationId: string) {
  if (!organizationId.trim()) throw new Error("Organization identity is required for record creation.");
  return `ops-record-sequence-v1:${encodeURIComponent(organizationId)}:${module}`;
}
function highWater(module: RecordModule, existingIds: readonly string[], organizationId: string) {
  const key = sequenceKey(module, organizationId);
  const stored = typeof window === "undefined" ? null : window.localStorage.getItem(key);
  const value = stored === null ? 0 : Number(stored);
  if ((stored !== null && !/^\d+$/.test(stored)) || !Number.isSafeInteger(value) || value < 0) throw new Error("The record sequence is invalid. Restore the sequence before creating more records.");
  const pattern = new RegExp(`^${MODULE_RECORD_PREFIXES[module]}-(\\d{6,})$`);
  return existingIds.reduce((max, id) => {
    const match = id.match(pattern);
    const number = match ? Number(match[1]) : 0;
    if (!Number.isSafeInteger(number)) throw new Error("The record sequence exceeds the supported range.");
    return Math.max(max, number);
  }, value);
}
export function previewModuleRecordId(module: RecordModule, existingIds: readonly string[] = [], organizationId = DEMO_ORGANIZATION.id) {
  const next = highWater(module, existingIds, organizationId) + 1;
  if (!Number.isSafeInteger(next)) throw new Error("The record sequence is exhausted.");
  return `${MODULE_RECORD_PREFIXES[module]}-${String(next).padStart(6, "0")}`;
}
export function allocateModuleRecordId(module: RecordModule, existingIds: readonly string[] = [], organizationId = DEMO_ORGANIZATION.id) {
  if (typeof window === "undefined") throw new Error("Browser storage is required for record creation.");
  if (window.document && !creationScope) throw new Error("Record creation must use the serialized creation command. Please retry from the creation form.");
  const id = previewModuleRecordId(module, existingIds, organizationId);
  const number = id.slice(MODULE_RECORD_PREFIXES[module].length + 1);
  const saved = safeSetStorageString(sequenceKey(module, organizationId), String(Number(number)));
  if (!saved.success) throw new Error(saved.message);
  // Reservation is permanent even if the later record write fails or the record is deleted.
  return id;
}

/** V4 source transactions hold the business lock through the nested administration lock.
 * No fixture refresh/normalization is performed on canonical transaction inputs. */
export async function withVersionedBusinessCreation<T>(create: () => Promise<T>): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks?.request) throw new Error("Versioned record creation requires Web Locks.");
  return navigator.locks.request(RECORD_CREATION_LOCK, async () => {
    creationScope = true;
    try { return await create(); } finally { creationScope = false; }
  });
}
