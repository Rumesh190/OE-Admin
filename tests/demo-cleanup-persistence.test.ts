import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { authenticateDemoFixture } from "./helpers/demo-session";
beforeEach(() => {
  vi.resetModules(); const values = new Map<string, string>([["standalone-5s-actions", "[]"], ["manufacturing-qms-five-s-audits-v1", "[]"], ["ops-red-tag-original-reset-v1", "done"]]);
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v), removeItem: (k: string) => values.delete(k) }, dispatchEvent: vi.fn() });
  authenticateDemoFixture();
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("does not resurrect disposable Action fixtures into an intentionally empty collection", async () => {
  const store = await import("@/lib/actions/action-store"); expect(store.getActions()).toEqual([]);
  expect(window.localStorage.getItem("standalone-5s-actions")).toBe("[]");
});
it("does not resurrect disposable Audit fixtures into an intentionally empty collection", async () => {
  const store = await import("@/lib/five-s/audit-store"); expect(store.getFiveSAudits()).toEqual([]);
  expect(window.localStorage.getItem("manufacturing-qms-five-s-audits-v1")).toBe("[]");
});

it("retains the exact first identification photo while compacting and restoring its redundant legacy alias", async () => {
  const store = await import("@/features/five-s/red-tag/store");
  const url = "data:image/png;base64," + "A".repeat(1200);
  const tag = { id: "RT-COMPACTION", status: "Open", imageUrl: url, identificationEvidence: [{ id: "PHOTO", name: "Original", url, uploadedBy: "Original author", uploadedAt: "2026-01-01" }], history: [{ id: "HISTORY", type: "created" }] } as unknown as import("@/features/five-s/red-tag/types").RedTag;
  const original = JSON.stringify(tag); const compact = store.compactRedTagPhotoAliases([tag])[0];
  expect(compact.imageUrl).toBeUndefined(); expect(compact.identificationEvidence).toEqual(tag.identificationEvidence);
  expect(store.normalizeRedTag(compact).imageUrl).toBe(url); expect(compact.history).toEqual(tag.history); expect(JSON.stringify(tag)).toBe(original);
});
it("retains a distinct selected primary photo instead of replacing it with another image", async () => {
  const store = await import("@/features/five-s/red-tag/store");
  const url = "data:image/png;base64," + "B".repeat(1200);
  const tag = { imageUrl: url, identificationEvidence: [{ url: "different-primary" }, { url }] } as unknown as import("@/features/five-s/red-tag/types").RedTag;
  expect(store.compactRedTagPhotoAliases([tag])[0]).toBe(tag);
});
