"use client";

let authorized = false;
let checking: Promise<boolean> | undefined;
export function isDemoAccessEnabled() { return process.env.NODE_ENV === "development" || authorized; }

/** The route and the entire protected deployment enforce credentials on the server. */
export function requestDemoAccess() {
  checking ??= verifyDemoAccess().finally(() => { checking = undefined; });
  return checking;
}

async function verifyDemoAccess() {
  authorized = false;
  const response = await fetch("/api/demo/access", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) throw new Error("Unable to verify demo access. Reload after authenticating to this deployment.");
  const value: unknown = await response.json();
  authorized = Boolean(value && typeof value === "object" && "enabled" in value && value.enabled === true);
  return isDemoAccessEnabled();
}

export function requireDemoAccess() {
  if (!isDemoAccessEnabled()) throw new Error("Demo initialization and privileged switching require authorized demo access; public production switching is disabled.");
}
