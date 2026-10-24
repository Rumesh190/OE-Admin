import { createHash, timingSafeEqual } from "node:crypto";

/** Server-only configuration. Never serialize the credentials or use NEXT_PUBLIC_ variables. */
export function protectedDemoConfiguration() {
  const enabled = process.env.OE_DEMO_MODE === "protected";
  const username = process.env.OE_DEMO_ACCESS_USERNAME ?? "";
  const password = process.env.OE_DEMO_ACCESS_PASSWORD ?? "";
  return { enabled, username, password, configured: enabled && username.length > 0 && !username.includes(":") && password.length >= 16 };
}

export function acceptsDemoCredentials(authorization: string | null) {
  const config = protectedDemoConfiguration();
  if (!config.configured || !authorization?.startsWith("Basic ")) return false;
  const supplied = Buffer.from(authorization.slice(6), "base64").toString("utf8");
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(supplied), digest(`${config.username}:${config.password}`));
}
