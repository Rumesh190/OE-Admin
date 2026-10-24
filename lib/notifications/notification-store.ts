"use client";

import { useSyncExternalStore } from "react";
import { safeSetStorage, safeSetStorageString, type StorageResult } from "@/lib/browser-storage";

export interface AppNotification {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  read: boolean;
  deduplicationKey?: string;
  context?: { sourceModule: "gemba"; observationId: string; actorId: string; zoneIds: string[] };
}

const STORAGE_KEY = "standalone-5s-notifications";
const FIXTURE_VERSION_KEY = "standalone-5s-notification-fixture-version";
const FIXTURE_VERSION = "canonical-cross-zone-v1";
const CANONICAL_NOTIFICATIONS: AppNotification[] = [
  { id: "NOT-ACT-ZB-001-ASSIGN", recipientUserId: "USR-RUMESH", title: "New Action Requires Assignment", message: "Clear unused material from the production aisle · Raised by: Lakshman · Audit: 5S-EGM-ZB-001 · Zone: Zone B · Priority: High", href: "/5s/actions/ACT-ZB-001", createdAt: "2026-08-25T09:30:00.000Z", read: false },
  {
    id: "NOT-ACT-ZA-001-ASSIGNED",
    recipientUserId: "USR-SIVA",
    title: "New action assigned",
    message: "Clear unused material from the production aisle · Assigned by: Lakshman · Audit: 5S-EGM-ZA-006 · Zone: Zone A · Priority: High · Due: 2026-08-26",
    href: "/5s/actions/ACT-ZA-001",
    createdAt: "2026-08-25T09:30:00.000Z",
    read: false,
  },
];
let notifications: AppNotification[] = [...CANONICAL_NOTIFICATIONS];
let loaded = false;
const listeners = new Set<() => void>();
const EMPTY_NOTIFICATIONS: AppNotification[] = [];

let loadFailure = false;
let persistenceFailure: Extract<StorageResult, { success: false }> | null = null;
function publish() { listeners.forEach(listener => listener()); }
function persist(next: AppNotification[]) {
  if (persistenceFailure) return persistenceFailure;
  const result = safeSetStorage(STORAGE_KEY, next, { reportError: false });
  if (!result.success) { persistenceFailure = result; publish(); return result; }
  notifications = next;
  publish();
  return result;
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(parsed)) throw new Error("Invalid notification payload");
    notifications = parsed;
    if (window.localStorage.getItem(FIXTURE_VERSION_KEY) !== FIXTURE_VERSION) {
      const fixtureIds = new Set(CANONICAL_NOTIFICATIONS.map(item => item.id));
      const result = persist([...CANONICAL_NOTIFICATIONS, ...notifications.filter(item => !fixtureIds.has(item.id))]);
      if (result.success) {
        const version = safeSetStorageString(FIXTURE_VERSION_KEY, FIXTURE_VERSION, { reportError: false });
        if (!version.success) persistenceFailure = version;
      }
    }
  } catch {
    // Preserve unreadable storage. Do not replace it with new notifications.
    notifications = [];
    loadFailure = true;
    persistenceFailure = { success: false, reason: "unknown", message: "Notifications could not be loaded. Existing browser data has been preserved." };
  }
}

export function createNotification(input: Omit<AppNotification, "id" | "createdAt" | "read">) {
  // Preserve the existing non-browser in-memory behavior; the shell only runs delivery in an effect.
  if (typeof window === "undefined") {
    const notification: AppNotification = { ...input, id: `NOT-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), read: false };
    notifications = [notification, ...notifications];
    return notification;
  }
  load();
  if (persistenceFailure) return undefined;
  const result = tryCreateNotification(input);
  return result.success ? result.notification : undefined;
}

export function markNotificationRead(id: string) {
  load();
  return persist(notifications.map(item => item.id === id ? { ...item, read: true } : item));
}

export function useNotifications(recipientUserId: string) {
  load();
  const snapshot = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => notifications,
    () => EMPTY_NOTIFICATIONS
  );
  return snapshot.filter(item => item.recipientUserId === recipientUserId);
}

export function useNotificationStorageError() {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => listeners.delete(listener); },
    () => persistenceFailure?.message ?? null,
    () => null,
  );
}

/** User-triggered retry only: passive renders do not repeatedly write after storage fails. */
export function retryNotificationPersistence() { persistenceFailure = null; loadFailure = false; loaded = false; load(); publish(); }

/** Publish only after durable local persistence; retries reuse the same personal notification. */
export function tryCreateNotification(input: Omit<AppNotification, "id" | "createdAt" | "read">) {
  load();
  const existing = input.deduplicationKey && notifications.find(item => item.deduplicationKey === input.deduplicationKey && item.recipientUserId === input.recipientUserId);
  if (existing) return { success: true as const, notification: existing };
  // This durable API is also used by explicit Gemba save/retry operations.
  if (!loadFailure) persistenceFailure = null;
  if (persistenceFailure) return persistenceFailure;
  const notification: AppNotification = { ...input, id: `NOT-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), read: false };
  const result = persist([notification, ...notifications]);
  return result.success ? { success: true as const, notification } : result;
}
