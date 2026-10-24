import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ACTION_SOURCE_CONFIG } from "@/lib/actions/action-config";
import { DEFAULT_MODULE_ENTITLEMENTS, getEnabledNavigationGroups, OPERATIONAL_MODULES, type AccessCapabilityId } from "@/lib/modules";
import { VISUAL_MANAGEMENT_SECTIONS } from "@/features/visual-management/visual-management-config";
import { VISUAL_MANAGEMENT_INITIAL_STATE } from "@/features/visual-management/visual-management-store";

afterEach(() => vi.unstubAllGlobals());

describe("Visual Management module migration", () => {
  it("exposes only the simplified daily-management IA and redirects advanced settings", () => {
    const nav = readFileSync(resolve(process.cwd(), "features/visual-management/visual-management-components.tsx"), "utf8");
    for (const label of ["Overview", "All Boards", "All Meetings", "Settings"]) expect(nav).toContain(`label: "${label}"`);
    for (const hidden of ["KPI Configuration", "Tier Structure", "KPI Sections", "Escalations", "Decisions"]) expect(nav).not.toContain(`label: "${hidden}"`);
    for (const path of ["kpi-configuration", "kpi-sections", "tiers", "boards"]) {
      expect(readFileSync(resolve(process.cwd(), `app/(app)/visual-management/settings/${path}/page.tsx`), "utf8")).toContain('redirect("/visual-management/settings")');
    }
  });

  it("uses the board-first dashboard and one configured metric system", () => {
    const route = readFileSync(resolve(process.cwd(), "app/(app)/visual-management/page.tsx"), "utf8");
    const overview = readFileSync(resolve(process.cwd(), "features/visual-management/daily-management-overview-page.tsx"), "utf8");
    expect(route).toContain("DailyManagementOverviewPage");
    expect(overview).toContain('>Board<Select');
    expect(overview).toContain('label="Dashboard period"');
    expect(overview).toContain('label: "Daily"');
    expect(overview).toContain('label: "Weekly"');
    expect(overview).toContain('label: "Monthly"');
    expect(overview).toContain("<ConfiguredKpiBoard board={board}");
    expect(overview).not.toContain("board.sections.map");
  });
  it("registers only the new product module in the operational excellence order", () => {
    expect(OPERATIONAL_MODULES.map((module) => module.id)).toEqual(["gemba", "redTag", "continuousImprovement", "audit", "visualManagement"]);
    expect(OPERATIONAL_MODULES.find((module) => module.id === "visualManagement")).toMatchObject({ label: "Visual Management", route: "/visual-management", enabled: true, group: "operations" });
    expect(OPERATIONAL_MODULES.some((module) => (module.id as string) === "visualImprovement")).toBe(false);
    expect(DEFAULT_MODULE_ENTITLEMENTS.visualManagement).toBe(true);
    expect(DEFAULT_MODULE_ENTITLEMENTS.visualImprovement).toBe(true);
  });

  it("creates every required App Router page and gates the route family", () => {
    const files = [
      "app/(app)/visual-management/page.tsx",
      "app/(app)/visual-management/boards/page.tsx",
      "app/(app)/visual-management/boards/[id]/page.tsx",
      "app/(app)/visual-management/boards/[id]/meeting/page.tsx",
      "app/(app)/visual-management/meetings/page.tsx",
      "app/(app)/visual-management/meetings/[id]/page.tsx",
      "app/(app)/visual-management/escalations/page.tsx",
      "app/(app)/visual-management/layout.tsx",
    ];
    expect(files.every((file) => existsSync(resolve(process.cwd(), file)))).toBe(true);
    expect(readFileSync(resolve(process.cwd(), "app/(app)/visual-management/layout.tsx"), "utf8")).toContain('ModuleGate id="visualManagement"');
  });

  it("uses the registry for desktop, collapsed-tooltip, and mobile navigation", () => {
    const sidebarSource = readFileSync(resolve(process.cwd(), "components/navigation/sidebar-nav.tsx"), "utf8");
    const mobileSource = readFileSync(resolve(process.cwd(), "components/navigation/mobile-nav-drawer.tsx"), "utf8");
    expect(sidebarSource).toContain("getEnabledNavigationGroups(entitlements)");
    expect(sidebarSource).toContain("<TooltipContent side=\"right\">{tooltip}</TooltipContent>");
    expect(mobileSource).toContain("<SidebarNav onNavigate=");
  });

  it("groups enabled capabilities by lifecycle and removes empty groups", () => {
    const groups = getEnabledNavigationGroups({ ...DEFAULT_MODULE_ENTITLEMENTS });
    expect(groups.map((group) => group.id)).toEqual(["operationalExcellence", "execution", "analytics"]);
    expect(groups.flatMap((group) => group.items.map((item) => item.id))).toEqual([
      "gemba", "redTag", "continuousImprovement", "audit", "visualManagement", "actions", "reports",
    ]);

    expect(getEnabledNavigationGroups({ ...DEFAULT_MODULE_ENTITLEMENTS, gemba: false }).find((group) => group.id === "operationalExcellence")?.items.map((item) => item.id)).not.toContain("gemba");
    const withoutIdentifyAndImprove = getEnabledNavigationGroups({ ...DEFAULT_MODULE_ENTITLEMENTS, redFlag: false, continuousImprovement: false });
    expect(withoutIdentifyAndImprove.find((group) => group.id === "operationalExcellence")?.items.map((item) => item.id)).toEqual(["gemba", "redTag", "audit", "visualManagement"]);

    const auditOnly = Object.fromEntries(
      Object.keys(DEFAULT_MODULE_ENTITLEMENTS).map((id) => [id, ["audit", "actions", "dashboards", "reports"].includes(id)]),
    ) as Record<AccessCapabilityId, boolean>;
    expect(getEnabledNavigationGroups(auditOnly).map((group) => group.id)).toEqual(["operationalExcellence", "execution", "analytics"]);
  });

  it("provides six manufacturing boards and centralized SQDCP sections", () => {
    expect(VISUAL_MANAGEMENT_INITIAL_STATE.boards.map((board) => board.name)).toEqual([
      "Zone A Daily Management", "Zone B Production Review", "Zone C Daily Management", "Zone D Daily Management", "Plant Operations", "Leadership Review",
    ]);
    expect(VISUAL_MANAGEMENT_SECTIONS).toEqual(["Safety", "Quality", "Delivery", "Cost", "People"]);
    expect(VISUAL_MANAGEMENT_INITIAL_STATE.boards.every((board) => board.sections.map((entry) => entry.section).join() === VISUAL_MANAGEMENT_SECTIONS.join())).toBe(true);
  });

  it("keeps meeting mode focused on KPI review, actions, and discussion", () => {
    const meetingModeSource = readFileSync(resolve(process.cwd(), "features/visual-management/meeting-mode-page.tsx"), "utf8");
    expect(meetingModeSource).toContain("<details open");
    expect(meetingModeSource).toContain('title="Attendance"');
    expect(meetingModeSource).toContain('title="KPI Review"');
    expect(meetingModeSource).toContain('title="Previous Actions"');
    expect(meetingModeSource).toContain("Today&apos;s Discussion");
    expect(meetingModeSource).not.toContain('title="Decisions"');
    expect(meetingModeSource).not.toContain('title="Escalations"');
  });

  it("preserves legacy escalation and decision records for compatibility while meetings remain completable", async () => {
    const values = new Map<string, string>();
    vi.stubGlobal("window", { localStorage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) } });
    vi.resetModules();
    const store = await import("@/features/visual-management/visual-management-store");
    const meeting = store.startVisualManagementMeeting("VM-ZD-T1", { id: "USR-RITIKA", name: "Ritika" });
    expect(meeting?.boardId).toBe("VM-ZD-T1");
    store.setMeetingAttendance(meeting!.id, meeting!.participants[0].id, "Absent", { id: "USR-LAKSHMAN" });
    store.updateMeetingKpi(meeting!.id, "Safety", { status: "Red", actual: "1 near miss", note: "Guard issue observed" }, { id: "USR-LAKSHMAN" });
    const topic = store.addMeetingTopic(meeting!.id, { section: "Safety", title: "Guard issue", description: "Machine guard needs plant support" }, { id: "USR-RITIKA", name: "Ritika" });
    const escalation = store.createMeetingEscalation(topic!.id, "VM-PLANT-T2", "Requires maintenance support", { id: "USR-RITIKA", name: "Ritika" });
    const linkedEscalation = store.linkEscalationAction(escalation!.id, "ACT-ESC-001", { id: "USR-LAKSHMAN" });
    const actionStore = await import("@/lib/actions/action-store");
    const { MY_ACTIONS } = await import("@/features/five-s/data/my-actions-data");
    actionStore.setActions([{ ...MY_ACTIONS[0], id: "ACT-ESC-001", status: "In Progress" }]);
    expect(() => store.updateEscalationStatus(escalation!.id, "Resolved", { id: "USR-LAKSHMAN" })).toThrow(/Complete linked Action ACT-ESC-001/);
    expect(store.getVisualManagementState().escalations.find((item) => item.id === escalation!.id)?.status).toBe("Open");
    actionStore.setActions([{ ...MY_ACTIONS[0], id: "ACT-ESC-001", status: "Completed" }]);
    expect(store.updateEscalationStatus(escalation!.id, "Resolved", { id: "USR-LAKSHMAN" })?.status).toBe("Resolved");
    const duplicateLink = store.linkEscalationAction(escalation!.id, "ACT-ESC-002", { id: "USR-LAKSHMAN" });
    expect(store.linkTopicFollowUp(topic!.id, "Action", "ACT-TEST-001", { id: "USR-LAKSHMAN" })).toBeNull();
    expect(store.getVisualManagementState().topics.find(item => item.id === topic!.id)?.linkedActionId).toBe("ACT-ESC-001");
    const separateTopic = store.addMeetingTopic(meeting!.id, { section: "Safety", title: "Separate follow-up", description: "Independent Action relationship" }, { id: "USR-LAKSHMAN", name: "Lakshman" })!;
    expect(store.linkTopicFollowUp(separateTopic.id, "Action", "ACT-TEST-001", { id: "USR-LAKSHMAN" })?.linkedActionId).toBe("ACT-TEST-001");
    store.linkTopicFollowUp(topic!.id, "Red Flag", "RF-TEST-001", { id: "USR-LAKSHMAN" });
    store.linkTopicFollowUp(topic!.id, "Continuous Improvement", "CI-TEST-001", { id: "USR-LAKSHMAN" });
    store.linkTopicFollowUp(topic!.id, "Gemba", "GW-TEST-001", { id: "USR-LAKSHMAN" });
    const decision = store.addMeetingDecision(meeting!.id, "Stop the machine until the guard is verified.", { id: "USR-RITIKA", name: "Ritika" }, topic!.id, "ACT-TEST-001", { id: "USR-LAKSHMAN" });
    const onward = store.escalateExistingEscalation(escalation!.id, "VM-LEAD-T3", { id: "USR-RUMESH", name: "Rumesh" });
    const completed = store.completeVisualManagementMeeting(meeting!.id, { id: "USR-LAKSHMAN" });
    expect(escalation).toMatchObject({ sourceBoardId: "VM-ZD-T1", targetBoardId: "VM-PLANT-T2", status: "Open" });
    expect(linkedEscalation).toMatchObject({ id: escalation!.id, actionId: "ACT-ESC-001" });
    expect(duplicateLink).toBeNull();
    expect(onward).toMatchObject({ sourceBoardId: "VM-PLANT-T2", targetBoardId: "VM-LEAD-T3", status: "Open" });
    expect(decision?.relatedTopicId).toBe(topic!.id);
    expect(decision?.linkedActionId).toBe("ACT-TEST-001");
    expect(completed?.status).toBe("Completed");
    expect(store.getVisualManagementMeeting(meeting!.id)?.kpiEntries.find((entry) => entry.section === "Safety")).toMatchObject({ status: "Red", actual: "1 near miss" });
    expect(store.getVisualManagementBoard("VM-ZD-T1")?.sections.find((entry) => entry.section === "Safety")).toMatchObject({ status: "Red", actual: "1 near miss" });
    expect(store.getVisualManagementMeeting(meeting!.id)).toMatchObject({ actionIds: ["ACT-ESC-001", "ACT-TEST-001"], redFlagIds: ["RF-TEST-001"], continuousImprovementIds: ["CI-TEST-001"], gembaIds: ["GW-TEST-001"] });
    expect(store.getVisualManagementState().topics.find((item) => item.id === topic!.id)?.decision).toBe("Stop the machine until the guard is verified.");
  });

  it("uses the new action source and keeps the legacy source out of selectors", () => {
    expect(ACTION_SOURCE_CONFIG.map((source) => source.id)).toEqual([
      "gemba", "redTag", "continuousImprovement", "audit", "visualManagement", "manual",
    ]);
  });

  it("shows Visual Management, not the legacy feature, in Super Admin's registry-backed module cards", () => {
    const superAdminSource = readFileSync(resolve(process.cwd(), "features/super-admin/super-admin.tsx"), "utf8");
    expect(superAdminSource).toContain("capabilities={OPERATIONAL_MODULES}");
    expect(OPERATIONAL_MODULES.find((module) => module.id === "visualManagement")?.description).toBe("Run tier meetings and make performance and abnormalities visible.");
    expect(OPERATIONAL_MODULES.map((module) => module.label)).not.toContain("Visual Improvement");
  });
});
