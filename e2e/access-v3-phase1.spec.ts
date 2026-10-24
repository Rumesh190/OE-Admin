import { test, expect, type Page } from "@playwright/test";
import { seed } from "./ui-batch2-helpers";
async function choose(page: Page, label: string, option: string) { await page.getByRole("combobox", { name: label, exact: true }).click(); await page.getByRole("option", { name: option, exact: true }).click(); }
async function switchTo(page: Page, name: string) { await page.getByRole("button", { name: "Account menu" }).click(); await page.getByRole("menuitem").filter({ hasText: name }).click(); }
for (const width of [375, 1440])
    test(`v3 administration journey and preserved identity at ${width}px`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 900 });
        await seed(page, "superAdmin");
        const errors: string[] = [];
        page.on("pageerror", error => errors.push(error.message));
        page.on("console", message => { if (message.type() === "error" || /hydration|base ui|invalid dom|nested/i.test(message.text())) errors.push(message.text()); });
        await page.goto("/super-admin/organizations", { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Create client", exact: true }).click();
        await page.getByLabel("Client name", { exact: true }).fill("Phase One Browser Client");
        await page.getByLabel("Industry", { exact: true }).fill("Manufacturing");
        await page.getByRole("button", { name: "Save client" }).click();
        await page.getByRole("link", { name: "Phase One Browser Client", exact: true }).click();
        await page.getByRole("button", { name: "Assign Client Admin", exact: true }).click();
        await choose(page, "Person selection", "New administration profile");
        await page.getByLabel("Full name", { exact: true }).fill("Phase One Client Admin");
        await page.getByLabel("Email", { exact: true }).fill("phase1-ca@test.invalid");
        await page.getByLabel("Employee ID", { exact: true }).fill("EMP-PHASE1-CA");
        await page.getByRole("button", { name: "Confirm Client Admin assignment" }).click();
        await page.reload({ waitUntil: "networkidle" });
        await switchTo(page, "Phase One Client Admin");
        await page.goto("/settings/administration", { waitUntil: "networkidle" });
        await expect(page.getByRole("tab", { name: "All", exact: true })).toHaveAttribute("aria-selected", "true");
        for (const [name, code] of [["Factory First", "FIRST"], ["Factory Second", "SECOND"]]) {
            await page.getByRole("button", { name: "Create factory", exact: true }).click();
            await page.getByLabel("Factory name").fill(name);
            await page.getByLabel("Factory code").fill(code);
            await page.getByLabel("Factory location").fill("Test location");
            await page.getByRole("button", { name: "Save factory" }).click();
        }
        await page.getByRole("button", { name: "Assign Factory Admin", exact: true }).first().click();
        await choose(page, "Person", "Phase One Client Admin");
        await page.getByRole("button", { name: "Confirm Factory Admin assignment" }).click();
        await page.getByRole("button", { name: "Create Zone", exact: true }).click();
        await page.getByLabel("Zone name").fill("Zone Shared");
        await page.getByLabel("Zone code").fill("SH");
        await page.getByLabel("Zone department").fill("Production");
        await page.getByRole("button", { name: "Save Zone" }).click();
        await page.getByRole("button", { name: "Add User", exact: true }).click();
        await page.getByLabel("Full name", { exact: true }).fill("Stable Factory Person");
        await page.getByLabel("Email", { exact: true }).fill("stable-factory@test.invalid");
        await page.getByLabel("Employee ID", { exact: true }).fill("EMP-STABLE-BROWSER");
        await page.getByRole("combobox", { name: "Base role", exact: true }).click();
        await expect(page.getByRole("option")).toHaveCount(3);
        for (const role of ["Zone Leader", "Zone Member", "Standard User"])
            await expect(page.getByRole("option", { name: role, exact: true })).toBeVisible();
        await page.getByRole("option", { name: "Zone Member", exact: true }).click();
        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        expect(await page.evaluate(() => JSON.parse(localStorage.getItem("five-s-administration-users-v1") ?? "[]").some((u: {
            email: string;
        }) => u.email === "stable-factory@test.invalid"))).toBe(false);
        await page.getByRole("button", { name: "Add User", exact: true }).click();
        await page.getByLabel("Full name", { exact: true }).fill("Stable Factory Person");
        await page.getByLabel("Email", { exact: true }).fill("stable-factory@test.invalid");
        await page.getByLabel("Employee ID", { exact: true }).fill("EMP-STABLE-BROWSER");
        await choose(page, "Base role", "Zone Member");
        await page.getByRole("checkbox").check();
        await page.getByRole("button", { name: "Save factory user" }).click();
        await page.getByRole("button", { name: "Revoke assignment", exact: true }).click();
        await page.getByRole("button", { name: "Confirm revocation" }).click();
        await expect(page.getByRole("alert")).toContainText("another active Factory Admin");
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        // Assign the second factory explicitly, then reuse the existing person without changing identity.
        await page.getByRole("button", { name: "Assign Factory Admin", exact: true }).nth(1).click();
        await choose(page, "Person", "Phase One Client Admin");
        await page.getByRole("button", { name: "Confirm Factory Admin assignment" }).click();
        await page.getByRole("button", { name: "Add User", exact: true }).click();
        await choose(page, "Person selection", "Existing client person");
        await choose(page, "Person", "Stable Factory Person");
        await choose(page, "Base role", "Standard User");
        await page.getByRole("button", { name: "Save factory user" }).click();
        const result = await page.evaluate(() => {
            const state = JSON.parse(localStorage.getItem("ops-access-v3-administration-v1")!);
            const users = JSON.parse(localStorage.getItem("five-s-administration-users-v1")!);
            const person = users.filter((u: {
                email: string;
            }) => u.email === "stable-factory@test.invalid");
            return { count: person.length, roles: state.factoryMemberships.filter((m: {
                    userId: string;
                }) => m.userId === person[0].id).map((m: {
                    baseRole: string;
                }) => m.baseRole).sort(), permissions: person[0].permissions, events: state.events.length };
        });
        expect(result.count).toBe(1);
        expect(result.roles).toEqual(["Standard User", "Zone Member"]);
        expect(result.permissions).toEqual([]);
        expect(result.events).toBeGreaterThan(7);
        await page.getByRole("tab", { name: "History", exact: true }).click();
        await expect(page.getByRole("region", { name: "Administration history" })).toContainText("factoryUser.added");
        await page.reload({ waitUntil: "networkidle" });
        await expect(page.getByRole("tab", { name: "All", exact: true })).toHaveAttribute("aria-selected", "true");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await expect(page.getByRole("combobox", { name: "Client", exact: true })).toContainText("Phase One Browser Client");
        await page.screenshot({ path: info.outputPath("administration.png"), fullPage: true });
        await page.getByRole("button", { name: "Assign Factory Admin", exact: true }).first().click();
        await choose(page, "Person", "Stable Factory Person");
        await page.getByRole("button", { name: "Confirm Factory Admin assignment" }).click();
        await page.getByRole("button", { name: "Revoke assignment", exact: true }).first().click();
        await page.getByRole("button", { name: "Confirm revocation" }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await switchTo(page, "OPS Super Admin");
        await switchTo(page, "Stable Factory Person");
        await page.goto("/settings/administration", { waitUntil: "networkidle" });
        await expect(page.getByRole("button", { name: "Create factory", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Assign Factory Admin", exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Add User", exact: true })).toBeVisible();
        await expect(page.getByRole("combobox", { name: "Factory", exact: true })).toContainText("Factory First");
        await page.getByRole("button", { name: "Add User", exact: true }).click();
        await page.getByLabel("Full name", { exact: true }).fill("Factory-scoped new person");
        await page.getByLabel("Email", { exact: true }).fill("factory-scoped@test.invalid");
        await page.getByLabel("Employee ID", { exact: true }).fill("EMP-FA-CREATED");
        await page.getByRole("button", { name: "Save factory user" }).click();
        await expect(page.getByText("Factory-scoped new person", { exact: true })).toBeVisible();
        await page.goto("/actions", { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { name: "Administration profile", exact: true })).toBeVisible();
        await switchTo(page, "OPS Super Admin");
        await page.goto("/super-admin/organizations", { waitUntil: "networkidle" });
        await expect(page.getByRole("link", { name: "Phase One Browser Client", exact: true })).toBeVisible();
        expect(errors).toEqual([]);
    });
test("legacy Admin has no implicit v3 authority and no elevated Add User control", async ({ page }) => {
    await seed(page);
    await page.goto("/settings/administration", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "Administration access required" })).toBeVisible();
    await page.goto("/settings/users", { waitUntil: "networkidle" });
    await expect(page.getByRole("button", { name: "Add User", exact: true })).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("ops-access-v3-administration-v1"))).toBeNull();
});
