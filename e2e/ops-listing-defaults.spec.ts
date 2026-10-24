import { test, expect } from "@playwright/test";
import { seed } from "./ui-batch2-helpers";

const modules = [
  { path: "/gemba", label: "Gemba sections", all: "All Walks", other: "Overview", sidebar: /^Gemba/ },
  { path: "/5s/red", label: "Red Tag sections", all: "All", other: "Overview", sidebar: /^Red Tag/ },
  { path: "/continuous-improvement", label: "Continual Improvement sections", all: "All", other: "Overview", sidebar: /^Continual Improvement/ },
  { path: "/audits", label: "Audit views", all: "All", other: "Completed", sidebar: /^Audit/ },
  { path: "/actions", label: "Actions sections", all: "All", other: "Completed", sidebar: /^Actions$/ },
  { path: "/visual-improvement", label: "Visual Improvement views", all: "All", other: "Overview" },
  { path: "/visual-management", label: "Visual Management sections", all: "All Boards", other: "Overview", sidebar: /^Visual Management/ },
  { path: "/reports", label: "Report modules", all: "All", other: "Actions", sidebar: /^Reports$/ },
];
for (const listing of modules) test(`${listing.path}: entry, refresh and sidebar default to All`, async ({ page }) => {
  await seed(page);
  await page.addInitScript(({ label, all }) => {
    const runtime = window as Window & { listingTabPaints?: string[] };
    runtime.listingTabPaints = [];
    let frames = 0;
    function sample() {
      if (getComputedStyle(document.documentElement).visibility !== "hidden") {
        const nav = [...document.querySelectorAll('[role="tablist"]')].find(item => item.getAttribute("aria-label") === label);
        const selected = nav?.querySelector('[aria-selected="true"]')?.textContent ?? "";
        if (selected && !selected.startsWith(all)) runtime.listingTabPaints!.push(selected);
      }
      if (++frames < 180) requestAnimationFrame(sample);
    }
    requestAnimationFrame(sample);
  }, { label: listing.label, all: listing.all });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error" && /hydrat|didn't match|server rendered/i.test(message.text())) errors.push(message.text()); });
  await page.goto(listing.path, { waitUntil: "networkidle" });
  const tabs = () => page.getByRole("tablist", { name: listing.label, exact: true });
  const all = () => tabs().getByRole("tab", { name: new RegExp(`^${listing.all}(?:\\s|$)`) });
  await expect(all()).toHaveAttribute("aria-selected", "true");
  await tabs().getByRole("tab", { name: new RegExp(`^${listing.other}(?:\\s|$)`) }).click();
  await page.reload({ waitUntil: "networkidle" });
  await expect(all()).toHaveAttribute("aria-selected", "true");
  expect(await page.evaluate(() => (window as Window & { listingTabPaints?: string[] }).listingTabPaints)).toEqual([]);
  await tabs().getByRole("tab", { name: new RegExp(`^${listing.other}(?:\\s|$)`) }).click();
  if (listing.sidebar) {
    await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: listing.sidebar }).click();
    await expect(all()).toHaveAttribute("aria-selected", "true");
  }
  await page.goto("/actions", { waitUntil: "networkidle" });
  await page.getByRole("tablist", { name: "Actions sections" }).getByRole("tab", { name: /^Completed / }).click();
  if (listing.sidebar) await page.getByRole("navigation", { name: "Primary", exact: true }).getByRole("link", { name: listing.sidebar }).click();
  else await page.goto(listing.path, { waitUntil: "networkidle" });
  await expect(all()).toHaveAttribute("aria-selected", "true");
  expect(errors).toEqual([]);
});

test("explicit observation tab and record deep links survive navigation; Back/Forward works", async ({ page }) => {
  await seed(page);
  await page.goto("/gemba?tab=observations", { waitUntil: "networkidle" });
  const tabs = page.getByRole("tablist", { name: "Gemba sections", exact: true });
  await expect(tabs.getByRole("tab", { name: /^All Observations / })).toHaveAttribute("aria-selected", "true");
  await tabs.getByRole("tab", { name: "Overview", exact: true }).click();
  await page.goBack();
  await expect(tabs.getByRole("tab", { name: /^All Observations / })).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(tabs.getByRole("tab", { name: "Overview", exact: true })).toHaveAttribute("aria-selected", "true");
  await page.goto("/actions/ACT-ZA-001", { waitUntil: "networkidle" });
  await page.reload({ waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/actions\/ACT-ZA-001$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
