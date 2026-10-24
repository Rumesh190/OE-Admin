export type StorageFailureReason = "quota" | "unavailable" | "unknown";
export type StorageResult = { success: true } | { success: false; reason: StorageFailureReason; message: string };

export const STORAGE_FULL_MESSAGE = "Unable to save because browser storage is full. Remove an older demo record or a large attachment and try again.";

function isQuotaError(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014);
}

export function safeSetStorage(key: string, value: unknown, options?: { reportError?: boolean }): StorageResult {
  if (typeof window === "undefined") return { success: false, reason: "unavailable", message: "Browser storage is unavailable." };
  try { window.localStorage.setItem(key, JSON.stringify(value)); return { success: true }; }
  catch (error) { if (options?.reportError !== false) console.error(`Unable to persist ${key}:`, error); return { success: false, reason: isQuotaError(error) ? "quota" : "unknown", message: isQuotaError(error) ? STORAGE_FULL_MESSAGE : "Unable to save this change. Please try again." }; }
}

export function safeSetStorageString(key: string, value: string, options?: { reportError?: boolean }): StorageResult {
  if (typeof window === "undefined") return { success: false, reason: "unavailable", message: "Browser storage is unavailable." };
  try { window.localStorage.setItem(key, value); return { success: true }; }
  catch (error) { if (options?.reportError !== false) console.error(`Unable to persist ${key}:`, error); return { success: false, reason: isQuotaError(error) ? "quota" : "unknown", message: isQuotaError(error) ? STORAGE_FULL_MESSAGE : "Unable to save this change. Please try again." }; }
}

export function cleanupObsoleteDemoStorage() {
  if (typeof window === "undefined") return;
  ["five-s-ci-create-draft", "five-s-temporary-evidence", "standalone-5s-upload-previews"].forEach((key) => window.localStorage.removeItem(key));
}

export function getApproximateStorageUsage() {
  if (typeof window === "undefined") return { totalBytes: 0, keys: [] as Array<{ key: string; bytes: number }> };
  const keys = Object.keys(window.localStorage).map((key) => ({ key, bytes: new Blob([key, window.localStorage.getItem(key) ?? ""]).size })).sort((a, b) => b.bytes - a.bytes);
  return { totalBytes: keys.reduce((sum, item) => sum + item.bytes, 0), keys };
}

/**
 * Get a storage key with optional prefix
 */
export function getStorageKey(key: string, prefix?: string): string {
  return prefix ? `${prefix}_${key}` : key;
}

/**
 * Load typed data from localStorage
 */
export function loadFromStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return null;
    
    return JSON.parse(stored) as T;
  } catch (error) {
    console.error(`Failed to load ${key}:`, error);
    return null;
  }
}
