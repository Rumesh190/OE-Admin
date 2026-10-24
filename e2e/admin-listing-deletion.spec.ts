import { test, expect } from "@playwright/test";
import { seed } from "./ui-batch2-helpers";

const routes = [
  ["Audit", "/audits"], ["Red Tag", "/5s/red"], ["Gemba walks", "/gemba"],
  ["Gemba observations", "/gemba?tab=observations"], ["CI", "/continuous-improvement"],
  ["CI review", "/continuous-improvement?tab=review"], ["VI", "/visual-improvement"], ["VM boards", "/visual-management/boards"],
  ["VM meetings", "/visual-management/meetings"], ["Actions", "/actions"],
] as const;
const tombstoneKey = "ops-record-tombstones-v1:abc-manufacturing";
for (const width of [375, 1440]) for (const [label, path] of routes) {
  test(`Admin deletes ${label} from listing at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 }); await seed(page);
    await page.addInitScript(() => localStorage.setItem("ops-organization-modules-v1", JSON.stringify({ visualImprovement: true, visualManagement: true, gemba: true })));
    const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
    await page.goto(path, { waitUntil: "networkidle" });
    const listingUrl = page.url();
    const button = page.locator('button[aria-label^="Record actions "]:visible').first();
    await expect(button).toBeVisible(); const name = (await button.getAttribute("aria-label"))!;
    const id = name.replace("Record actions ", "");
    // Menus must be siblings of navigation controls, never nested interactive controls.
    expect(await button.evaluate(element => Boolean(element.parentElement?.closest("a,button")))).toBe(false);
    const beforeActions = await page.evaluate(() => localStorage.getItem("standalone-5s-actions"));
    await button.focus(); await page.keyboard.press("Enter"); await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("dialog")).toContainText(id);
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(await page.evaluate(key => localStorage.getItem(key), tombstoneKey)).toBeNull();
    await expect(page).toHaveURL(listingUrl);
    await button.click(); await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: "Delete Record", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator(`button[aria-label="${name}"]:visible`)).toHaveCount(0);
    await expect(page).toHaveURL(listingUrl);
    expect(await page.evaluate(({ key, id }) => JSON.parse(localStorage.getItem(key) ?? "[]").some((record: { id: string }) => record.id === id), { key: tombstoneKey, id })).toBe(true);
    if (label !== "Actions") expect(await page.evaluate(() => localStorage.getItem("standalone-5s-actions"))).toBe(beforeActions);
    expect(errors).toEqual([]);
  });
}
test("non-Admin listing menus stay hidden", async ({ page }) => {
  await seed(page, "leader");
  for (const [, path] of routes) {
    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: /^Record actions / })).toHaveCount(0);
  }
});
