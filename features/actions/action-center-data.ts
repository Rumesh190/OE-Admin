import { newestCreatedFirst } from "@/lib/records/record-order";
import { canReviewAction } from "@/lib/actions/action-store";
import type { AdminUser } from "@/features/five-s/administration/types";
import type { ActionSourceModule, MyAction, MyActionPriority, MyActionStatus } from "@/features/five-s/types/my-actions";
import type { DemoUser } from "@/lib/current-user";
import {
  ACTION_REVIEW_STATUSES,
  getActionUpdatedAt,
  inferActionSourceModule,
  isActionOverdue,
} from "@/lib/actions/action-config";

export type ActionCenterTab = "all" | "my-actions" | "created-by-me" | "team-actions" | "awaiting-review" | "completed";
export type ActionStatusFilter = "All" | "Open" | "Overdue" | MyActionStatus;
export type ActionDueFilter = "All" | "Overdue" | "Today" | "Tomorrow" | "Next 7 days";
export type ActionQuickFilter = "open" | "overdue";

export interface ActionCenterFilters {
  search: string;
  source: "All" | ActionSourceModule;
  status: ActionStatusFilter;
  priority: "All" | MyActionPriority;
  plant: string;
  zone: string;
  assignedTo: string;
  due: ActionDueFilter;
}

export const ACTION_CENTER_TABS: ReadonlyArray<{ id: ActionCenterTab; label: string }> = [
  { id: "all", label: "All" },
  { id: "my-actions", label: "My Actions" },
  { id: "created-by-me", label: "Created by Me" },
  { id: "team-actions", label: "Team Actions" },
  { id: "awaiting-review", label: "Awaiting Review" },
  { id: "completed", label: "Completed" },
];

function isResponsible(action: MyAction, user: DemoUser) {
  return action.responsiblePersonId ? action.responsiblePersonId === user.id : action.responsiblePersonName === user.name || action.assignedTo === user.name;
}

function isCreator(action: MyAction, user: DemoUser) {
  return action.createdByUserId ? action.createdByUserId === user.id : action.createdByName === user.name || action.auditor === user.name;
}

function isReviewer(action: MyAction, user: DemoUser, adminUser?: AdminUser) {
  if (adminUser && adminUser.id !== user.id) return false;
  return canReviewAction(action, user);
}

export function canViewTeamActions(adminUser: AdminUser | undefined) {
  return Boolean(adminUser?.roles.some((role) => role === "Admin" || role === "Zone Leader" || role === "Auditor"));
}

/** Preserves the existing role visibility while making each tab's intent explicit. */
export function getRoleVisibleActions(actions: MyAction[], user: DemoUser, adminUser?: AdminUser) {
  if (adminUser?.roles.includes("Admin")) return actions.filter((action) => user.plant === "All organizations" || action.plant === user.plant);
  if (adminUser?.roles.includes("Zone Leader")) return actions.filter((action) => action.area === user.primaryZone || isReviewer(action, user, adminUser));
  if (adminUser?.roles.includes("Auditor")) return actions.filter((action) => isCreator(action, user) || isReviewer(action, user, adminUser));
  return actions.filter((action) => isResponsible(action, user) || isReviewer(action, user, adminUser));
}

export function getActionsForTab(actions: MyAction[], tab: ActionCenterTab, user: DemoUser, adminUser?: AdminUser) {
  const visible = getRoleVisibleActions(actions, user, adminUser);
  if (tab === "all") return visible;
  if (tab === "my-actions") return visible.filter((action) => isResponsible(action, user));
  if (tab === "created-by-me") return visible.filter((action) => isCreator(action, user));
  if (tab === "team-actions") return canViewTeamActions(adminUser) ? visible.filter((action) => action.status !== "Completed") : [];
  if (tab === "awaiting-review") return visible.filter((action) => isReviewer(action, user, adminUser) && ACTION_REVIEW_STATUSES.includes(action.status));
  return visible.filter((action) => action.status === "Completed");
}

export function matchesActionQuickFilter(action: MyAction, filter: ActionQuickFilter, now = new Date()) {
  return filter === "open" ? action.status !== "Completed" : isActionOverdue(action, now);
}

function dueDays(action: MyAction, now: Date) {
  const due = new Date(`${action.dueDate}T00:00:00`);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function filterActionCenterItems(actions: MyAction[], filters: ActionCenterFilters, now = new Date()) {
  const query = filters.search.trim().toLowerCase();
  return newestCreatedFirst(actions.filter((action) => {
    const matchesSearch = !query || [action.id, action.title, action.description, action.sourceTitle, action.sourceId, action.plant, action.area, action.responsiblePersonName, action.assignedTo].some((value) => value?.toLowerCase().includes(query));
    const matchesSource = filters.source === "All" || inferActionSourceModule(action) === filters.source;
    const matchesStatus = filters.status === "All" ||
      (filters.status === "Open" && matchesActionQuickFilter(action, "open", now)) ||
      (filters.status === "Overdue" && matchesActionQuickFilter(action, "overdue", now)) ||
      action.status === filters.status;
    const matchesPriority = filters.priority === "All" || action.priority === filters.priority;
    const matchesPlant = filters.plant === "All" || action.plant === filters.plant;
    const matchesZone = filters.zone === "All" || action.area === filters.zone;
    const responsible = action.responsiblePersonName ?? action.assignedTo;
    const matchesAssigned = filters.assignedTo === "All" || responsible === filters.assignedTo;
    const days = dueDays(action, now);
    const matchesDue = filters.due === "All" ||
      (filters.due === "Overdue" && isActionOverdue(action, now)) ||
      (filters.due === "Today" && days === 0) ||
      (filters.due === "Tomorrow" && days === 1) ||
      (filters.due === "Next 7 days" && days >= 0 && days <= 7);
    return matchesSearch && matchesSource && matchesStatus && matchesPriority && matchesPlant && matchesZone && matchesAssigned && matchesDue;
  }));
}

export function getActionCenterCounts(actions: MyAction[], user: DemoUser, adminUser: AdminUser | undefined, now = new Date()) {
  const visible = getRoleVisibleActions(actions, user, adminUser);
  const tabs = Object.fromEntries(ACTION_CENTER_TABS.map((tab) => [tab.id, getActionsForTab(actions, tab.id, user, adminUser).length])) as Record<ActionCenterTab, number>;
  return {
    tabs,
    open: visible.filter((action) => matchesActionQuickFilter(action, "open", now)).length,
    overdue: visible.filter((action) => matchesActionQuickFilter(action, "overdue", now)).length,
    critical: visible.filter((action) => action.status !== "Completed" && action.priority === "Critical").length,
    awaitingReview: visible.filter((action) => ACTION_REVIEW_STATUSES.includes(action.status)).length,
    completedThisMonth: visible.filter((action) => {
      if (action.status !== "Completed" || !action.completedAt) return false;
      const completed = new Date(action.completedAt);
      return completed.getMonth() === now.getMonth() && completed.getFullYear() === now.getFullYear();
    }).length,
    plants: [...new Set(visible.map((action) => action.plant))].sort(),
    zones: [...new Set(visible.map((action) => action.area))].sort(),
    assignees: [...new Set(visible.map((action) => action.responsiblePersonName ?? action.assignedTo).filter(Boolean))].sort(),
  };
}

export function getReviewAgeLabel(action: MyAction, now = new Date()) {
  const submittedAt = action.submittedForReviewAt ?? getActionUpdatedAt(action);
  const days = Math.max(0, Math.floor((now.getTime() - new Date(submittedAt).getTime()) / 86_400_000));
  if (days === 0) return "Submitted today";
  return `Submitted ${days} day${days === 1 ? "" : "s"} ago`;
}
