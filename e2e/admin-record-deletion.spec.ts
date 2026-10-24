import { test, expect } from "@playwright/test";
import { seed } from "./ui-batch2-helpers";
import type { DeletionModule } from "../lib/records/record-tombstones";

const key = "ops-record-tombstones-v1:abc-manufacturing";
const cases: Array<{ module: DeletionModule; id: string; path: string; source: string; observationId?: string }> = [
  { module: "audit", id: "5S-EGM-ZA-001", path: "/audits", source: "audit" },
  { module: "redTag", id: "RT-EGM-ZA-001", path: "/5s/red/RT-EGM-ZA-001", source: "redTag" },
  { module: "gemba", id: "GEM-2026-015", path: "/gemba/GEM-2026-015", source: "gemba" },
  { module: "continuousImprovement", id: "CI-2026-014", path: "/continuous-improvement/CI-2026-014", source: "continuousImprovement" },
  { module: "visualImprovement", id: "VI-2026-014", path: "/visual-improvement/VI-2026-014", source: "visualImprovement" },
  { module: "vmBoard", id: "VM-ZA-T1", path: "/visual-management/boards/VM-ZA-T1", source: "visualManagement" },
  { module: "vmMeeting", id: "VMM-2026-013", path: "/visual-management/meetings/VMM-2026-013", source: "visualManagement" },
];
for (const item of cases) test(`Admin ${item.module} deletion retains Actions and survives reload`, async ({ page }) => {
  await seed(page);
  await page.addInitScript(item => {
    if (localStorage.getItem("deletion-fixture")) return;
    localStorage.setItem("deletion-fixture", "1");
    localStorage.setItem("ops-organization-modules-v1", JSON.stringify({ visualImprovement: true, visualManagement: true, gemba: true }));
    localStorage.setItem("standalone-5s-action-fixture-version", "canonical-zone-a-dashboard-v4");
    localStorage.setItem("standalone-5s-actions", JSON.stringify([{ id: "ACT-DELETE-PRESERVE", title: "Deletion preservation Action", description: "Keep ownership, history, due date and evidence", source: "Manual", sourceModule: item.source, sourceId: item.id, sourceTitle: item.id, plant: "Egmore Plant", area: "Zone A", department: "Production", assignedTo: "Siva Kumar", responsiblePersonId: "USR-SIVA-KUMAR", createdByUserId: "USR-LAKSHMAN", createdByName: "Lakshman", status: "In Progress", priority: "Medium", dueDate: "2030-12-01", createdAt: "2030-01-01", evidence: [], reviewHistory: [], activityHistory: [{ id: "PRESERVE-HISTORY", type: "started", actorId: "USR-SIVA-KUMAR", actorName: "Siva Kumar", createdAt: "2030-01-01" }], submissionRevisions: [] }]));
  }, item);
  await page.goto(item.path, { waitUntil: "networkidle" });
  let id = item.id;
  if (item.module === "audit") {
    const first = page.getByRole("button", { name: /^Record actions / }).first();
    id = (await first.getAttribute("aria-label"))!.replace("Record actions ", "");
    // Use the selected canonical Audit identifier for the explicit Action source fixture.
    await page.evaluate(id => { const records = JSON.parse(localStorage.getItem("standalone-5s-actions")!); records.find((record: { id: string }) => record.id === "ACT-DELETE-PRESERVE").sourceId = id; localStorage.setItem("standalone-5s-actions", JSON.stringify(records)); }, id);
    await page.reload({ waitUntil: "networkidle" });
  }
  const before = await page.evaluate(() => localStorage.getItem("standalone-5s-actions"));
  const menu = () => page.getByRole("button", { name: `Record actions ${id}`, exact: true });
  await expect(menu()).toBeVisible(); if (item.module === "audit") { await menu().focus(); await page.keyboard.press("Enter"); } else await menu().click(); await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toBeVisible(); await expect(dialog).toContainText(id); await expect(dialog).toContainText("Linked Actions"); await expect(dialog).toContainText("will be retained");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBeNull(); expect(await page.evaluate(() => localStorage.getItem("standalone-5s-actions"))).toBe(before);
  await menu().click(); await page.getByRole("menuitem", { name: "Delete", exact: true }).click(); await page.getByRole("dialog").getByRole("button", { name: "Delete Record", exact: true }).click();
  await expect.poll(() => page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key) ?? "[]").some((record: { id: string }) => record.id === id), { key, id })).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("standalone-5s-actions"))).toBe(before);
  await page.goto("/actions", { waitUntil: "networkidle" }); await expect(page.getByRole("button", { name: /^Deletion preservation Action/ })).toBeVisible(); await expect(page.getByText(/Source deleted/).first()).toBeVisible();
  await page.reload({ waitUntil: "networkidle" }); await expect(page.getByText(/Source deleted/).first()).toBeVisible();
  await page.goto(item.module === "audit" ? `/audits?audit=${encodeURIComponent(id)}` : item.path, { waitUntil: "networkidle" }); await expect(page.getByText("Record deleted", { exact: true })).toBeVisible();
});

test("non-Admin cannot see Delete; explicit Action deletion retains its source", async ({ page }) => {
  await seed(page, "leader"); await page.goto("/continuous-improvement/CI-2026-014", { waitUntil: "networkidle" }); await expect(page.getByRole("button", { name: /^Record actions / })).toHaveCount(0);
  await page.evaluate(() => localStorage.setItem("five-s-demo-role", "auditor"));
  await page.goto("/actions/ACT-CI-013-01", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Record actions ACT-CI-013-01", exact: true }).click(); await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("source record will be retained"); await page.getByRole("button", { name: "Delete Record", exact: true }).click();
  await page.goto("/continuous-improvement/CI-2026-013", { waitUntil: "networkidle" }); await expect(page.getByRole("heading", { level: 1 })).toBeVisible(); await expect(page.getByText("Action deleted").first()).toBeVisible();
  await page.goto("/actions/ACT-CI-013-01", { waitUntil: "networkidle" }); await expect(page.getByText("Record deleted", { exact: true })).toBeVisible();
});
