import { describe, expect, it } from "vitest";
import { getActionCenterCounts, getActionsForTab, getRoleVisibleActions, filterActionCenterItems } from "@/features/actions/action-center-data";
import { ADMIN_USER_SEEDS } from "@/features/five-s/administration/store";
import { DEMO_USERS } from "@/lib/current-user";
import type { MyAction, MyActionStatus } from "@/features/five-s/types/my-actions";

const statuses: MyActionStatus[] = ["Awaiting Assignment", "Assigned", "Open", "In Progress", "Overdue", "Pending Review", "Pending Auditor Review", "Awaiting Review", "Rework Required", "Completed"];
const user = DEMO_USERS.auditor;
const admin = ADMIN_USER_SEEDS.find(item => item.id === user.id);
const records: MyAction[] = statuses.map((status, index) => ({ id: `ACT-LIST-${index}`, title: `Listing ${status}`, description: "Preserve historical records", source: "Manual", sourceModule: "manual", sourceTitle: "Manual", plant: user.plant, area: user.primaryZone, department: "Production", assignedTo: user.name, responsiblePersonId: user.id, responsiblePersonName: user.name, createdByUserId: user.id, createdByName: user.name, status, priority: "Medium", dueDate: "2030-12-01", createdAt: `2026-10-${String(index + 1).padStart(2, "0")}`, evidence: [] }));
const filters = { search: "", source: "All" as const, status: "All" as const, priority: "All" as const, plant: "All", zone: "All", assignedTo: "All", due: "All" as const };

describe("OPS authorized listing scopes", () => {
  it("All includes every supported Action status and counts the same authorized records", () => {
    const all = getActionsForTab(records, "all", user, admin);
    expect(all.map(item => item.status)).toEqual(statuses);
    expect(getActionCenterCounts(records, user, admin).tabs.all).toBe(all.length);
    expect(getActionsForTab(records, "my-actions", user, admin)).toEqual(all);
    expect(getActionsForTab(records, "created-by-me", user, admin)).toEqual(all);
    expect(getActionsForTab(records, "completed", user, admin).map(item => item.status)).toEqual(["Completed"]);
  });
  it("All never broadens the existing role visibility", () => {
    for (const identity of Object.values(DEMO_USERS)) {
      const account = ADMIN_USER_SEEDS.find(item => item.id === identity.id);
      expect(getActionsForTab(records, "all", identity, account)).toEqual(getRoleVisibleActions(records, identity, account));
    }
  });
  it("excludes an unrelated Zone record from member All scope", () => {
    const member = DEMO_USERS.responsible;
    const account = ADMIN_USER_SEEDS.find(item => item.id === member.id);
    const unrelated = { ...records[0], id: "UNRELATED", area: "Zone D", responsiblePersonId: "OTHER", responsiblePersonName: "Other", assignedTo: "Other", createdByUserId: "OTHER", createdByName: "Other", reviewerId: "OTHER" };
    expect(getActionsForTab([unrelated], "all", member, account)).toEqual([]);
  });
  it("combines search/status and restores newest-first historical records when cleared", () => {
    expect(filterActionCenterItems(records, { ...filters, search: "completed", status: "Completed" }).map(item => item.status)).toEqual(["Completed"]);
    expect(filterActionCenterItems(records, { ...filters, search: "completed", status: "Assigned" })).toEqual([]);
    expect(filterActionCenterItems(records, filters).map(item => item.id)).toEqual([...records].reverse().map(item => item.id));
    expect(records.map(item => item.status)).toEqual(statuses);
  });
});
