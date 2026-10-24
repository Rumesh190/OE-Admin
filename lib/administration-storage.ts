import { decodeAdministrationJournalV4, ADMINISTRATION_JOURNAL_KEY } from "./administration-v4-storage";
/** Pending browser administration writes read their original payload until recovery finishes. */
export { ADMINISTRATION_JOURNAL_KEY };
export function readAdministrationPayload(key: string): string | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY);
  if (raw) {
    const journal: unknown = JSON.parse(raw);
    if (journal && !Array.isArray(journal)) {
      const transaction = decodeAdministrationJournalV4(journal);
      const image = transaction.images.find(item => item.key === key);
      if (image) return transaction.phase === "Committed" ? image.after : image.before;
      return window.localStorage.getItem(key);
    }
    if (!Array.isArray(journal) || journal.some(item => !item || typeof item.key !== "string" || !(item.value === null || typeof item.value === "string"))) throw new Error("Invalid administration recovery journal. Preserve browser storage and restore a verified backup.");
    const original = (journal as Array<{ key: string; value: string | null }>).find(item => item.key === key);
    if (original) return original.value;
  }
  return window.localStorage.getItem(key);
}
