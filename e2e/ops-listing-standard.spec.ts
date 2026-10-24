import { test, expect } from "@playwright/test";
import { seed, state } from "./ui-batch2-helpers";

const routes = [
  ["/5s/red", "Red Tag sections", "All"],
  ["/actions?tab=all", "Actions sections", "All"],
  ["/gemba?tab=walks", "Gemba sections", "All Walks"],
  ["/gemba?tab=observations", "Gemba sections", "All Observations"],
  ["/continuous-improvement?tab=improvements", "Continual Improvement sections", "All"],
  ["/audits", "Audit views", "All"],
  ["/visual-improvement?tab=improvements", "Visual Improvement views", "All"],
  ["/visual-management/boards", "Visual Management sections", "All Boards"],
  ["/visual-management/meetings", "Meeting views", "All"],
  ["/reports", "Report modules", "All"],
];
for (const width of [1440, 1024, 768, 390, 320]) test(`listing navigation and geometry ${width}px`, async ({ page }, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width, height: 1000 });
  await seed(page);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [route, label, all] of routes) {
    await page.goto(route, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toHaveCount(1);
    const tabs = page.getByRole("tablist", { name: label, exact: true });
    await expect(tabs).toBeVisible();
    const selected = tabs.getByRole("tab", { name: new RegExp(`^${all}(?:\\s|\\d|$)`) });
    await expect(selected).toHaveAttribute("aria-selected", "true");
    await selected.focus();
    await page.keyboard.press("End");
    await expect(tabs.getByRole("tab").last()).toBeFocused();
    await page.keyboard.press("Home");
    await expect(tabs.getByRole("tab").first()).toBeFocused();
    await state(page, info, `${route.replace(/[^a-z]/gi, "-")}-${width}`, width === 1440 || width === 320);
  }
  expect(errors).toEqual([]);
});

test("Action tabs preserve search and support browser Back/Forward", async ({ page }) => {
  await seed(page);
  await page.goto("/actions?tab=all");
  const search = page.getByPlaceholder("Search actions, source, person...");
  await search.fill("listing-no-match");
  const tabs = page.getByRole("tablist", { name: "Actions sections" });
  await tabs.getByRole("tab", { name: /^Completed/ }).click();
  await expect(search).toHaveValue("listing-no-match");
  await page.goBack();
  await expect(tabs.getByRole("tab", { name: /^All(?:\s|\d|$)/ })).toHaveAttribute("aria-selected", "true");
  await page.goForward();
  await expect(tabs.getByRole("tab", { name: /^Completed/ })).toHaveAttribute("aria-selected", "true");
});

test("All Actions includes every supported status, counts, search and clear", async ({ page }) => {
  await seed(page);
  const statuses = ["Awaiting Assignment", "Assigned", "Open", "In Progress", "Overdue", "Pending Review", "Pending Auditor Review", "Awaiting Review", "Rework Required", "Completed"];
  await page.addInitScript(statuses => {
    if (localStorage.getItem("ops-listing-status-fixture")) return;
    localStorage.setItem("ops-listing-status-fixture", "1");
    localStorage.setItem("standalone-5s-actions", JSON.stringify(statuses.map((status, index) => ({ id: `ACT-LIST-${index}`, title: `Listing ${status}`, description: "Listing acceptance record", source: "Manual", sourceModule: "manual", sourceTitle: "Manual", plant: "Egmore Plant", area: "Zone A", department: "Production", assignedTo: "Lakshman", responsiblePersonId: "USR-LAKSHMAN", responsiblePersonName: "Lakshman", createdByUserId: "USR-LAKSHMAN", createdByName: "Lakshman", status, priority: "Medium", dueDate: "2030-12-01", createdAt: `2026-10-${String(index + 1).padStart(2, "0")}`, evidence: [] }))));
  }, statuses);
  await page.goto("/actions?tab=all", { waitUntil: "networkidle" });
  const tabs = page.getByRole("tablist", { name: "Actions sections" });
  const allTab = tabs.getByRole("tab", { name: /^All / });
  await expect(allTab).toHaveAttribute("aria-selected", "true");
  const authorizedCount = await page.getByRole("table", { name: "Actions", exact: true }).locator("tbody tr").count();
  await expect(allTab).toHaveAccessibleName(`All ${authorizedCount}`);
  await expect(page.getByRole("button", { name: /^Listing / })).toHaveCount(10);
  await tabs.getByRole("tab", { name: /^Completed / }).click();
  await expect(page.getByRole("button", { name: /^Listing / })).toHaveCount(1);
  await tabs.getByRole("tab", { name: "My Actions 10", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Listing / })).toHaveCount(10);
  await page.getByPlaceholder("Search actions, source, person...").fill("no-listing-matches");
  await expect(page.getByRole("button", { name: /^Listing / })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear Filters", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Listing / })).toHaveCount(10);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: /^Listing / })).toHaveCount(10);
});

test("CI listing scopes retain search and clear conflicting stage filters", async ({ page }) => {
  await seed(page);
  await page.goto("/continuous-improvement?tab=improvements", { waitUntil: "networkidle" });
  const search = page.getByPlaceholder("Search improvements...");
  const tabs = page.getByRole("tablist", { name: "Continual Improvement sections" });
  await search.fill("material");
  await tabs.getByRole("tab", { name: /^Proposals/ }).click();
  await expect(search).toHaveValue("material");
  await tabs.getByRole("tab", { name: /^All / }).click();
  await expect(search).toHaveValue("material");
  await page.getByRole("button", { name: "Clear Filters", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(page.getByRole("combobox", { name: "All stages", exact: true })).toContainText("All stages");
  await page.reload({ waitUntil: "networkidle" });
  await expect(tabs.getByRole("tab", { name: /^All / })).toHaveAttribute("aria-selected", "true");
});

test("status tab counts match rendered Red Tag, Audit, CI and VI subsets", async ({ page }) => {
  await seed(page);
  const modules = [
    { route: "/5s/red", label: "Red Tag sections", scopes: ["All", "Under Review", "Awaiting Closure", "Closed"] },
    { route: "/audits", label: "Audit views", scopes: ["All", "Draft", "Scheduled", "In Progress", "Review", "Completed"] },
    { route: "/continuous-improvement?tab=improvements", label: "Continual Improvement sections", scopes: ["All", "Proposals", "In Progress", "Under Review", "Completed"] },
    { route: "/visual-improvement?tab=improvements", label: "Visual Improvement views", scopes: ["All", "Awaiting Review", "Completed"] },
  ];
  for (const listing of modules) {
    await page.goto(listing.route, { waitUntil: "networkidle" });
    for (const scope of listing.scopes) {
      const tab = page.getByRole("tablist", { name: listing.label, exact: true }).getByRole("tab", { name: new RegExp(`^${scope} \\d+$`) });
      const count = Number((await tab.innerText()).match(/\d+$/)?.[0]);
      await tab.click();
      await expect(page.getByRole("tablist", { name: listing.label, exact: true }).getByRole("tab", { name: new RegExp(`^${scope} \\d+$`) })).toHaveAttribute("aria-selected", "true");
      await expect(page.locator("tbody tr").filter({ hasNot: page.locator("td[colspan]") })).toHaveCount(count);
    }
  }
});
