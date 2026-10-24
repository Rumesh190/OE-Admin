/** Browser-local administration transactions. Cooperating v4 writers use one Web Lock.
 * Existing v3 synchronous writers are guarded by the shared pending journal.
 * This is not server authorization or a cross-device transaction protocol. */
export const ADMINISTRATION_JOURNAL_KEY = "ops-access-v3-pending-transaction-v1";
export const ADMINISTRATION_LOCK = "ops-administration-writes-v4";
export const V4_STORAGE_KEY = "ops-access-v4-administration-v1";
export const ADMIN_V4_TARGETS = [V4_STORAGE_KEY, "ops-access-v3-administration-v1", "ops-organization-configuration-v1", "standalone-5s-actions", "manufacturing-qms-five-s-audits-v1"] as const;
export interface AdministrationImage { key: string; before: string | null; after: string }
export interface AdministrationJournalV4 { version: 2; id: string; phase: "Prepared" | "Committed"; images: AdministrationImage[] }
export function decodeAdministrationJournalV4(value: unknown): AdministrationJournalV4 {
  const j = value as AdministrationJournalV4;
  if (!j || j.version !== 2 || !j.id || !["Prepared", "Committed"].includes(j.phase) || !Array.isArray(j.images) || !j.images.length || j.images.some(i => !i || !(ADMIN_V4_TARGETS as readonly string[]).includes(i.key) || !(i.before === null || typeof i.before === "string") || typeof i.after !== "string") || new Set(j.images.map(i => i.key)).size !== j.images.length) throw new Error("Unsupported administration journal. Preserve storage for review.");
  return j;
}
export async function withAdministrationLock<T>(work: () => T): Promise<T> {
  if (typeof navigator === "undefined" || !navigator.locks?.request) throw new Error("Protected v4 writes require Web Locks in this browser.");
  return navigator.locks.request(ADMINISTRATION_LOCK, { mode: "exclusive" }, work);
}
/** No async boundary between final authorization, read-set check and commit marker. */
export function commitAdministrationV4(images: AdministrationImage[], readSet: ReadonlyMap<string, string | null>, authorize: () => void): void {
  const storage = window.localStorage;
  if (storage.getItem(ADMINISTRATION_JOURNAL_KEY)) throw new Error("Administration recovery is required before writing.");
  authorize();
  for (const [key, raw] of readSet) if (storage.getItem(key) !== raw) throw new Error("Revision conflict. Reload and review before retrying.");
  for (const i of images) if (!readSet.has(i.key) || readSet.get(i.key) !== i.before) throw new Error("Revision conflict: transaction before-image is not in the protected read set.");
  const journal = decodeAdministrationJournalV4({ version: 2, id: crypto.randomUUID(), phase: "Prepared", images });
  storage.setItem(ADMINISTRATION_JOURNAL_KEY, JSON.stringify(journal));
  try {
    for (const i of images) storage.setItem(i.key, i.after);
    storage.setItem(ADMINISTRATION_JOURNAL_KEY, JSON.stringify({ ...journal, phase: "Committed" }));
  } catch {
    try { recoverAdministrationV4Storage(); } catch { throw new Error("Write failed; administration recovery is pending. Preserve storage."); }
    throw new Error("Write failed. Original administration records were restored.");
  }
  try { storage.removeItem(ADMINISTRATION_JOURNAL_KEY); } catch {
    // Business state is committed; never report this as a rolled-back write.
    throw new Error("Change committed; journal cleanup is pending. Recover before another change.");
  }
}
/** Caller must authorize platform recovery. Unknown bytes are never overwritten. */
export function recoverAdministrationV4Storage(): void {
  const storage = window.localStorage;
  const raw = storage.getItem(ADMINISTRATION_JOURNAL_KEY);
  if (!raw) return;
  const j = decodeAdministrationJournalV4(JSON.parse(raw));
  for (const i of j.images) {
    const actual = storage.getItem(i.key);
    if (actual !== i.before && actual !== i.after) throw new Error("Recovery conflict. Preserve storage and obtain a verified backup.");
  }
  for (const i of j.images) {
    const target = j.phase === "Committed" ? i.after : i.before;
    if (target === null) storage.removeItem(i.key); else storage.setItem(i.key, target);
  }
  storage.removeItem(ADMINISTRATION_JOURNAL_KEY);
}
