import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MyAction } from "@/features/five-s/types/my-actions";

vi.mock("@/lib/actions/action-store", () => ({ getActionById: () => undefined, appendActionAttentionActivity: vi.fn() }));
vi.mock("@/lib/actions/action-configuration-store", () => ({ getActionConfiguration: () => ({
  reminders: { dueSoon: { enabled: false }, dueToday: { enabled: true }, overdue: { enabled: false }, repeatOverdue: { enabled: false }, includeZoneLeader: false }, escalations: [],
}) }));
const key = "standalone-5s-notifications";
const reminderKey = "ops-action-reminders-v1";
const fixtureKey = "standalone-5s-notification-fixture-version";
const old = { id: "SAVED", recipientUserId: "OWNER", title: "Existing", message: "Preserve", href: "/actions/old", createdAt: "2026-01-01", read: false };
const input = { recipientUserId: "OWNER", title: "New", message: "New reminder", href: "/actions/new", deduplicationKey: "new-reminder" };
const action = { id: "TASK", title: "Synthetic task", status: "In Progress", responsiblePersonId: "OWNER", dueDate: "2026-10-22", evidence: [] } as unknown as MyAction;
let values: Map<string, string>;
let blockedKey: string | null;
let setItem: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 22, 12));
  values = new Map([[key, JSON.stringify([old])], [fixtureKey, "canonical-cross-zone-v1"], [reminderKey, "[]"], ["ops-action-escalations-v1", "[]"], ["historical-evidence", "preserve-large-attachment"]]);
  blockedKey = null;
  setItem = vi.fn((k: string, value: string) => { if (blockedKey === "*" || blockedKey === k) throw new DOMException("Quota", "QuotaExceededError"); values.set(k, value); });
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem, removeItem: (k: string) => values.delete(k) } });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("Notification quota handling", () => {
  it("preserves saved data, publishes no failed reminder, and stops passive retry writes", async () => {
    blockedKey = "*"; const before = [...values]; const error = vi.spyOn(console, "error");
    const notifications = await import("@/lib/notifications/notification-store");
    const attention = await import("@/lib/actions/action-attention-store");
    expect(attention.evaluateActionAttention([action], []).reminders).toEqual([]);
    expect(attention.getActionReminders(action.id)).toEqual([]);
    expect(setItem).toHaveBeenCalledTimes(1);
    attention.evaluateActionAttention([action], []);
    expect(notifications.createNotification(input)).toBeUndefined();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect([...values]).toEqual(before); expect(error).not.toHaveBeenCalled();
    blockedKey = null; notifications.retryNotificationPersistence(); attention.retryActionAttention([action], []);
    expect(attention.getActionReminders(action.id)).toHaveLength(1);
    expect(JSON.parse(values.get(key)!)).toHaveLength(2);
    const writes = setItem.mock.calls.length; attention.evaluateActionAttention([action], []);
    expect(setItem).toHaveBeenCalledTimes(writes);
    expect(values.get("historical-evidence")).toBe("preserve-large-attachment");
  });

  it("deduplicates a durable delivery when its reminder marker fails, including after reload", async () => {
    blockedKey = reminderKey;
    const notifications = await import("@/lib/notifications/notification-store"); const attention = await import("@/lib/actions/action-attention-store");
    expect(attention.evaluateActionAttention([action], []).storageError).toMatch(/storage is full/);
    expect(values.get(reminderKey)).toBe("[]"); expect(attention.getActionReminders(action.id)).toEqual([]);
    expect(JSON.parse(values.get(key)!)).toHaveLength(2);
    const writes = setItem.mock.calls.length; attention.evaluateActionAttention([action], []); expect(setItem).toHaveBeenCalledTimes(writes);
    blockedKey = null; notifications.retryNotificationPersistence(); attention.retryActionAttention([action], []);
    expect(attention.getActionReminders(action.id)).toHaveLength(1); expect(JSON.parse(values.get(key)!)).toHaveLength(2);
    vi.resetModules(); const reloaded = await import("@/lib/actions/action-attention-store");
    const saved = values.get(key); reloaded.evaluateActionAttention([action], []); expect(values.get(key)).toBe(saved);
  });

  it("retains unread state after a failed mark-read and lets explicit durable saves retry", async () => {
    const store = await import("@/lib/notifications/notification-store"); const created = store.tryCreateNotification(input); expect(created.success).toBe(true);
    if (!created.success) throw new Error("Fixture must save");
    const before = values.get(key); blockedKey = key;
    expect(store.markNotificationRead(created.notification.id).success).toBe(false); expect(values.get(key)).toBe(before);
    expect(store.tryCreateNotification(input)).toMatchObject({ success: true, notification: { read: false } });
    expect(store.tryCreateNotification({ ...input, deduplicationKey: "second" }).success).toBe(false);
    blockedKey = null;
    expect(store.tryCreateNotification({ ...input, deduplicationKey: "second" }).success).toBe(true);
    expect(JSON.parse(values.get(key)!)).toHaveLength(3);
  });

  it("does not mark fixtures initialized or overwrite saved notifications when quota is exhausted", async () => {
    values.delete(fixtureKey); blockedKey = "*"; const before = [...values];
    const store = await import("@/lib/notifications/notification-store"); expect(store.createNotification(input)).toBeUndefined();
    expect([...values]).toEqual(before); expect(values.has(fixtureKey)).toBe(false);
  });

  it("preserves malformed notification storage instead of replacing it", async () => {
    values.set(key, "{incomplete"); const store = await import("@/lib/notifications/notification-store");
    expect(store.tryCreateNotification(input).success).toBe(false); expect(values.get(key)).toBe("{incomplete"); expect(setItem).not.toHaveBeenCalled();
  });
});
