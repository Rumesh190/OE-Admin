// Test-only launcher: a fresh browser/context, never a user's profile or an application seed route.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";
const baseURL = process.env.OPS_V4_UAT_BASE_URL ?? "http://localhost:3000";
if (!/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(baseURL)) throw new Error("Manual synthetic UAT requires a local loopback server");
const fixture = JSON.parse(readFileSync(process.argv[2] ?? "/tmp/ops-v4-uat-fixture.json", "utf8"));
if (fixture.version !== 1 || !fixture.storage || !fixture.auditId) throw new Error("Generate the existing Batch 3 synthetic fixture first");
const browser = await chromium.launch({ headless: false, executablePath: process.env.OPS_QA_BROWSER_EXECUTABLE });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, storageState: { cookies: [], origins: [{ origin: baseURL, localStorage: Object.entries(fixture.storage).map(([name, value]) => ({ name, value })) }] } });
const page = await context.newPage();
console.log("Isolated synthetic UAT only. No IQ activation, existing browser profile or storage reset.");
console.log("Select identities through Account menu, then Active context in /settings/administration.");
await page.goto(`${baseURL}/settings/administration`);
await page.waitForEvent("close", { timeout: 0 });
await browser.close();
