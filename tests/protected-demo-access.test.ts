import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";
import { GET } from "@/app/api/demo/access/route";
const password = "synthetic-test-passphrase-only";
const authorization = (username = "reviewer", secret = password) => `Basic ${Buffer.from(`${username}:${secret}`).toString("base64")}`;
function enable() { vi.stubEnv("OE_DEMO_MODE", "protected"); vi.stubEnv("OE_DEMO_ACCESS_USERNAME", "reviewer"); vi.stubEnv("OE_DEMO_ACCESS_PASSWORD", password); }
afterEach(() => { vi.unstubAllEnvs(); });
describe("server-enforced protected demo access", () => {
  it.each(["/dashboard", "/settings/administration", "/api/demo/access", "/api/visual-management/kpi/analyze"])("challenges unauthenticated %s requests", path => {
    enable(); const response = proxy(new NextRequest(`https://demo.invalid${path}`));
    expect(response.status).toBe(401); expect(response.headers.get("www-authenticate")).toContain("Basic"); expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("rejects spoofed flags, malformed credentials and incorrect passwords", () => {
    enable();
    for (const value of ["Basic !!!", "Bearer anything", authorization("intruder"), authorization("reviewer", "wrong")]) {
      const response = proxy(new NextRequest("https://demo.invalid/dashboard", { headers: { authorization: value, "x-demo-enabled": "true" } })); expect(response.status).toBe(401);
    }
  });
  it("authorizes valid credentials without returning secrets or enabling caches", async () => {
    enable(); const request = new NextRequest("https://demo.invalid/api/demo/access", { headers: { authorization: authorization() } });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1");
    const response = GET(request); expect(await response.json()).toEqual({ enabled: true }); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await GET(new NextRequest("https://demo.invalid/api/demo/access")).json()).toEqual({ enabled: false });
  });
  it.each(["", "short"])("fails closed when protected mode has missing/weak credentials %j", secret => {
    enable(); vi.stubEnv("OE_DEMO_ACCESS_PASSWORD", secret);
    expect(proxy(new NextRequest("https://demo.invalid/dashboard")).status).toBe(503);
  });
  it("leaves public production without privileged switching even with a forged browser flag", async () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("OE_DEMO_MODE", "");
    const request = new NextRequest("https://demo.invalid/api/demo/access", { headers: { "x-demo-enabled": "true", authorization: authorization() } });
    expect(proxy(request).headers.get("x-middleware-next")).toBe("1"); expect(await GET(request).json()).toEqual({ enabled: false });
  });
});
