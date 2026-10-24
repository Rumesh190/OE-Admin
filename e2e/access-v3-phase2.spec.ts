import { test, expect, type Page } from "@playwright/test";
import { ADMIN_USER_SEEDS } from "../features/five-s/administration/store";
import { ORGANIZATION_PLANT_SEEDS, ORGANIZATION_ZONE_SEEDS } from "../lib/organization-store";
import type { AccessV3State } from "../features/five-s/administration/access-v3-types";
import type { AdminUser } from "../features/five-s/administration/types";
import { seed, settle } from "./ui-batch2-helpers";
test.use({ actionTimeout: 15000 });
const stamp = "2026-10-20T10:00:00Z";
const ids = { org: "ORG-P2", plant: "PLANT-P2", second: "PLANT-P2-SECOND", fa: "USR-P2-FA", first: "USR-P2-FIRST", replacement: "USR-P2-SECOND", member: "USR-P2-MEMBER" };
async function fixture(page: Page) {
    await seed(page);
    const people: AdminUser[] = [[ids.fa, "Phase Two Factory Admin"], [ids.first, "Authorized Leader"], [ids.replacement, "Replacement Leader"], [ids.member, "Factory Member"]].map(([id, name]) => ({ id, name, email: `${id}@test.invalid`, employeeId: id, plant: "", status: "Active", roles: [], permissions: [], zoneMemberships: [], accessModel: "v3", updatedAt: stamp }));
    const state: AccessV3State = { version: 1, clients: [{ id: ids.org, name: "Phase Two Client", industry: "Manufacturing", plants: 2, users: 4, status: "Active", lastUpdated: stamp }], clientMemberships: people.map(p => ({ id: `CM-${p.id}`, userId: p.id, organizationId: ids.org, status: "Active", clientAdmin: false, assignedBy: "USR-OPS-SUPER-ADMIN", assignedAt: stamp, updatedAt: stamp })), factoryAdmins: [ids.plant, ids.second].map(plantId => ({ id: `FA-${plantId}`, userId: ids.fa, organizationId: ids.org, plantId, status: "Active", assignedBy: "USR-OPS-SUPER-ADMIN", assignedAt: stamp })), factoryMemberships: people.filter(p => p.id !== ids.fa).map(p => ({ id: `FM-${p.id}`, userId: p.id, organizationId: ids.org, plantId: ids.plant, baseRole: p.id === ids.member ? "Zone Member" : "Zone Leader", status: "Active", assignedBy: ids.fa, assignedAt: stamp, updatedAt: stamp })), zoneAllocations: [ids.first, ids.replacement].map((userId, i) => ({ id: `ZA-${userId}`, userId, organizationId: ids.org, plantId: ids.plant, zoneId: `ZONE-P2-${i === 0 ? "A" : "C"}`, responsibility: "Leader", status: "Active", assignedBy: ids.fa, assignedAt: stamp, updatedAt: stamp })), auditorGrants: [], factoryRequests: [], events: [] };
    state.factoryMemberships.push({ ...state.factoryMemberships[0], id: "FM-SECOND", plantId: ids.second, baseRole: "Zone Member" });
    const plants = [ids.plant, ids.second].map((id, i) => ({ id, name: i ? "Second Factory" : "First Factory", organizationId: ids.org, code: i ? "SECOND" : "FIRST", location: "Test", managerId: "", managerName: "", status: "Active", codeLocked: true }));
    const zones = ["A", "B", "C"].map(code => ({ id: `ZONE-P2-${code}`, name: `Zone ${code}`, code, plantId: ids.plant, leaderId: "", leaderName: "", department: "Production", status: "Active" }));
    zones.push({ ...zones[0], id: "ZONE-P2-SECOND-A", plantId: ids.second });
    await page.addInitScript(({ state, people, plants, zones, seeds, plantSeeds, zoneSeeds, fa }) => {
        if (localStorage.getItem("phase2-seeded"))
            return;
        localStorage.setItem("phase2-seeded", "1");
        localStorage.setItem("ops-administration-demo-person-v1", fa);
        localStorage.setItem("ops-access-v3-administration-v1", JSON.stringify(state));
        localStorage.setItem("five-s-administration-users-v1", JSON.stringify([...people, ...seeds]));
        localStorage.setItem("ops-organization-configuration-v1", JSON.stringify({ plants: [...plants, ...plantSeeds], zones: [...zones, ...zoneSeeds] }));
        localStorage.setItem("manufacturing-qms-five-s-audits-v1", JSON.stringify([{ id: "AUD-P2-OWN", title: "AUD-P2-OWN", organizationId: state.clients[0].id, plantId: plants[0].id, zoneId: zones[0].id, assignedAuditorId: people[1].id, auditor: people[1].name, plant: plants[0].name, area: zones[0].name, department: "Production", status: "Scheduled", score: 0, maxScore: 2, completionPercentage: 0, sections: [], dueDate: "2099-01-02", scheduledDate: "2099-01-01", scheduledTime: "12:00" }]));
    }, { state, people, plants, zones, seeds: ADMIN_USER_SEEDS, plantSeeds: ORGANIZATION_PLANT_SEEDS, zoneSeeds: ORGANIZATION_ZONE_SEEDS, fa: ids.fa });
}
async function subject(page: Page, id: string) { await page.evaluate(id => localStorage.setItem("ops-administration-demo-person-v1", id), id); await page.reload({ waitUntil: "networkidle" }); }
async function choose(page: Page, label: string, name: string) { await page.getByRole("combobox", { name: label, exact: true }).click(); await page.getByRole("option", { name, exact: true }).click(); }
async function choosePerson(page: Page, label: string, name: string) { await page.getByRole("combobox", { name: label, exact: true }).click(); await page.getByRole("option", { name, exact: true }).click(); }
async function administration(page: Page) { await page.goto("/settings/administration", { waitUntil: "networkidle" }); await page.getByRole("tab", { name: "Auditor Authorization", exact: true }).click(); }
async function grant(page: Page, name: string) { await page.getByRole("button", { name: "Grant authorization", exact: true }).click(); await choose(page, "Eligible Zone Leader", name); if (name === "Authorized Leader")
    await page.getByRole("checkbox").filter({ visible: true }).first().check(); await page.getByRole("checkbox").filter({ visible: true }).nth(1).check(); await page.getByRole("button", { name: "Confirm authorization", exact: true }).click(); await expect(page.getByRole("dialog")).toHaveCount(0); }
for (const width of [375, 1440])
    test(`Phase 2 grant, scheduling, revocation and reassignment at ${width}px`, async ({ page }, info) => {
        test.setTimeout(180000);
        await page.setViewportSize({ width, height: 900 });
        await fixture(page);
        const errors: string[] = [];
        page.on("pageerror", e => errors.push(e.message));
        page.on("console", m => { if (m.type() === "error" || /hydration|base ui|invalid dom|nested/i.test(m.text()))
            errors.push(m.text()); });
        await administration(page);
        await grant(page, "Authorized Leader");
        await grant(page, "Replacement Leader");
        await settle(page);
        const shell = await page.evaluate(() => { const main = document.querySelector<HTMLElement>("[data-app-main]")!; const sidebar = document.querySelector<HTMLElement>(".app-left-nav")!; return { headingLeft: document.querySelector("h1")!.getBoundingClientRect().left, scrollX, mainScroll: main.scrollLeft, mainLeft: main.getBoundingClientRect().left, sidebarRight: sidebar.getBoundingClientRect().right, mode: document.documentElement.dataset.sidebar, padding: getComputedStyle(document.querySelector(".app-workspace-shell")!).paddingLeft }; });
        await info.attach("shell-layout.json", { body: JSON.stringify(shell), contentType: "application/json" });
        if (width >= 1024) { expect(shell.mainLeft, JSON.stringify(shell)).toBeGreaterThanOrEqual(shell.sidebarRight); expect(shell.headingLeft, JSON.stringify(shell)).toBeGreaterThanOrEqual(shell.sidebarRight); }
        await page.screenshot({ path: info.outputPath("auditor-authorizations.png"), fullPage: true, animations: "disabled" });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        await choose(page, "Factory", "Second Factory");
        await page.getByRole("tab", { name: "Auditor Authorization", exact: true }).click();
        await expect(page.getByText("No Auditor authorizations.", { exact: false })).toBeVisible();
        await choose(page, "Factory", "First Factory");
        await page.goto("/audits", { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Start Audit", exact: true }).first().click();
        await choosePerson(page, "Zone", "Zone B");
        await choosePerson(page, "Assigned auditor", "Authorized Leader");
        await page.getByLabel("Scheduled Date", { exact: true }).fill("2099-01-01");
        await page.getByLabel("Scheduled Time", { exact: true }).fill("12:00");
        await page.getByLabel("Due Date", { exact: true }).fill("2099-01-02");
        await page.getByRole("button", { name: "Schedule Audit", exact: true }).click();
        await expect(page.getByText("Pre-start setup", { exact: true })).toBeVisible();
        const audit = await page.evaluate(() => JSON.parse(localStorage.getItem("manufacturing-qms-five-s-audits-v1")!).find((a: {
            id: string;
        }) => a.id !== "AUD-P2-OWN" && a.id.startsWith("AUD-")));
        await subject(page, ids.first);
        await page.goto("/audits", { waitUntil: "networkidle" });
        await expect(page.getByRole("button", { name: "Start Audit", exact: true }).first()).toBeDisabled();
        await page.goto("/audits?audit=AUD-P2-OWN", { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { name: "Audit execution unavailable" })).toBeVisible();
        await page.goto(`/audits?audit=${audit.id}`, { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Start Audit", exact: true }).first().click();
        await expect(page.locator("[data-audit-execution]")).toBeVisible();
        await page.locator('input[type="file"]').first().setInputFiles({ name: "phase2-original.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64") });
        await expect.poll(() => page.evaluate(id => JSON.parse(localStorage.getItem("manufacturing-qms-five-s-audits-v1")!).find((a: {
            id: string;
        }) => a.id === id).sections[0].questions[0].evidence.length, audit.id)).toBe(1);
        const saved = await page.evaluate(id => JSON.parse(localStorage.getItem("manufacturing-qms-five-s-audits-v1")!).find((a: {
            id: string;
        }) => a.id === id), audit.id);
        await subject(page, ids.fa);
        await administration(page);
        const row = page.getByRole("region", { name: "Auditor Authorization", exact: true }).locator("div").filter({ has: page.locator("p", { hasText: /^Authorized Leader · Active/ }) }).filter({ has: page.getByRole("button", { name: "Revoke authorization", exact: true }) }).last();
        await row.getByRole("button", { name: "Revoke authorization", exact: true }).click();
        await expect(page.getByRole("dialog")).toContainText(audit.id);
        await page.getByRole("button", { name: "Confirm revocation", exact: true }).click();
        await subject(page, ids.first);
        await page.goto(`/audits?audit=${audit.id}`, { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { name: "Audit execution unavailable" })).toBeVisible();
        await subject(page, ids.fa);
        await administration(page);
        const assignment = page.locator("div").filter({ has: page.locator("p", { hasText: new RegExp(`^${audit.id} ·`) }) }).filter({ has: page.getByRole("button", { name: "Reassign auditor", exact: true }) }).last();
        await assignment.getByRole("button", { name: "Reassign auditor", exact: true }).click();
        await choose(page, "Replacement auditor", "Replacement Leader");
        await page.getByLabel("Reassignment reason").fill("Revoked grant; explicit replacement");
        await page.getByRole("button", { name: "Confirm reassignment", exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const after = await page.evaluate(id => JSON.parse(localStorage.getItem("manufacturing-qms-five-s-audits-v1")!).find((a: {
            id: string;
        }) => a.id === id), audit.id);
        expect(after.sections).toEqual(saved.sections);
        expect(after.status).toBe("In Progress");
        expect(after.assignmentHistory.at(-1)).toMatchObject({ actorId: ids.fa, previousAuditorId: ids.first, auditorId: ids.replacement, reason: "Revoked grant; explicit replacement" });
        await subject(page, ids.replacement);
        await page.goto(`/audits?audit=${audit.id}`, { waitUntil: "networkidle" });
        await expect(page.locator("[data-audit-execution]")).toBeVisible();
        await page.getByRole("button", { name: "Preview phase2-original.png", exact: true }).click();
        await expect(page.getByRole("img", { name: "phase2-original.png", exact: true })).toBeVisible();
        await subject(page, ids.fa);
        await page.goto("/audits", { waitUntil: "networkidle" });
        await page.getByRole("button", { name: "Start Audit", exact: true }).first().click();
        await choosePerson(page, "Zone", "Zone A");
        await page.getByRole("button", { name: "Execute directly as Factory Admin", exact: true }).click();
        await page.getByLabel("Due Date", { exact: true }).fill("2099-01-02");
        await page.getByRole("button", { name: "Start Audit", exact: true }).click();
        await expect(page.locator("[data-audit-execution]")).toBeVisible();
        await subject(page, ids.member);
        await page.goto(`/5s/audits/${audit.id}/report`, { waitUntil: "networkidle" });
        await expect(page.getByRole("heading", { name: "Audit report unavailable" })).toBeVisible();
        expect(errors).toEqual([]);
    });
