"use client";
import { saveGembaPhoto } from "@/lib/gemba/gemba-photo-storage";
import { getActiveAccessContext } from "@/features/five-s/administration/access-v4-context";
import { getAccessV4State, notifyAccessV4 } from "@/features/five-s/administration/access-v4-state";
import { V4_STORAGE_KEY, commitAdministrationV4, withAdministrationLock } from "@/lib/administration-v4-storage";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { actionV4ReadSet } from "./action-v4-policy";
export interface V4AssetIntent { id: string; key: string; organizationId: string; plantId: string; recordId: string; actorId: string; state: "Prepared" | "Stored"; createdAt: string }
function intents(): V4AssetIntent[] {
  const s = getAccessV4State() as ReturnType<typeof getAccessV4State> & { assetIntents?: V4AssetIntent[] };
  if (s.assetIntents !== undefined && (!Array.isArray(s.assetIntents) || s.assetIntents.some(i => !i || !i.id || !i.key || !i.createdAt || !i.recordId || !i.organizationId || !i.plantId || !i.actorId || !["Prepared", "Stored"].includes(i.state)))) throw new Error("Invalid asset intent ledger. Preserve storage.");
  const values = s.assetIntents ?? [];
  if (new Set(values.map(i => i.id)).size !== values.length || new Set(values.map(i => i.key)).size !== values.length) throw new Error("Duplicate asset intent identity. Preserve storage.");
  return values;
}
export function assertV4EvidenceReferences(evidence: { id: string; storageKey?: string; url?: string; dataUrl?: string; uploadedBy?: string }[], recordId: string, organizationId: string, plantId: string) {
  const ledger = intents();
  for (const e of evidence) if (!e.storageKey || e.url || e.dataUrl || ledger.filter(i => i.id === e.id && i.key === e.storageKey && i.recordId === recordId && i.organizationId === organizationId && i.plantId === plantId && i.state === "Stored" && e.uploadedBy === i.actorId).length !== 1) throw new Error("Evidence publication requires a durable, scoped upload receipt. Existing historical assets are never deleted.");
}
/** Unique keys + durable intent precede Blob storage. Failed metadata leaves a tracked orphan, never a fake published reference. */
export async function storeV4Evidence(recordId: string, blob: Blob, selectionId: string, authorize: () => void) {
  const c = getActiveAccessContext(); const actor = getAuthenticatedDemoActor();
  if (!c || c.kind !== "factory" || !actor || c.selectionId !== selectionId) throw new Error("Evidence context changed.");
  if (!blob.size || blob.size > 10 * 1024 * 1024) throw new Error("Evidence must be nonempty and at most 10 MB.");
  const intent: V4AssetIntent = { id: crypto.randomUUID(), key: `v4-evidence-${crypto.randomUUID()}`, organizationId: c.organizationId, plantId: c.plantId, recordId, actorId: actor.user.id, state: "Prepared", createdAt: new Date().toISOString() };
  const check = () => { const active = getActiveAccessContext(); if (!active || active.selectionId !== selectionId || active.personId !== intent.actorId) throw new Error("Evidence identity/context changed."); authorize(); };
  const write = (stored: boolean) => withAdministrationLock(() => {
    check(); const s = getAccessV4State(); const values = intents(); const reads = actionV4ReadSet();
    const next = { ...s, revision: s.revision + 1, assetIntents: stored ? values.map(i => i.id === intent.id ? { ...i, state: "Stored" } : i) : [...values, intent] };
    commitAdministrationV4([{ key: V4_STORAGE_KEY, before: reads.get(V4_STORAGE_KEY)!, after: JSON.stringify(next) }], reads, check); notifyAccessV4();
  });
  await write(false);
  await saveGembaPhoto(intent.key, blob);
  await write(true);
  return { id: intent.id, storageKey: intent.key, uploadedAt: intent.createdAt, uploadedBy: intent.actorId };
}
