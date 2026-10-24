import { deletedActionSource } from "@/lib/records/record-tombstones";
import type { LucideIcon } from "lucide-react";
import { ClipboardList, Eye, Flag, Footprints, PenLine, Tag, TrendingUp } from "lucide-react";

import type {
  ActionSourceModule,
  MyAction,
  MyActionType,
  MyActionPriority,
  MyActionStatus,
} from "@/features/five-s/types/my-actions";
import type { AccessCapabilityId } from "@/lib/modules";
import { formatOpsDate } from "@/lib/ops-formatters";
import { getOpsStatusVariant, OPS_PRIORITY, OPS_SOURCE_LABELS } from "@/lib/ops-presentation";

type BadgeVariant = "secondary" | "success" | "warning" | "danger" | "info";

export interface ActionSourceDefinition {
  id: ActionSourceModule;
  label: string;
  icon: LucideIcon;
  entitlement?: AccessCapabilityId;
}

export const ACTION_SOURCE_CONFIG: readonly ActionSourceDefinition[] = [
  { id: "gemba", label: OPS_SOURCE_LABELS.gemba, icon: Footprints, entitlement: "gemba" },
  { id: "redTag", label: OPS_SOURCE_LABELS.redTag, icon: Tag, entitlement: "redTag" },
  { id: "continuousImprovement", label: OPS_SOURCE_LABELS.continuousImprovement, icon: TrendingUp, entitlement: "continuousImprovement" },
  { id: "audit", label: OPS_SOURCE_LABELS.audit, icon: ClipboardList, entitlement: "audit" },
  { id: "visualManagement", label: OPS_SOURCE_LABELS.visualManagement, icon: Eye, entitlement: "visualManagement" },
  { id: "manual", label: OPS_SOURCE_LABELS.manual, icon: PenLine },
] as const;

const LEGACY_ACTION_SOURCE_CONFIG: readonly ActionSourceDefinition[] = [
  { id: "redFlag", label: OPS_SOURCE_LABELS.redFlag, icon: Flag },
  { id: "visualImprovement", label: "Legacy Improvement", icon: Eye, entitlement: "visualImprovement" },
] as const;

const ALL_ACTION_SOURCE_CONFIG = [...ACTION_SOURCE_CONFIG, ...LEGACY_ACTION_SOURCE_CONFIG] as const;

const ACTION_STATUSES: MyActionStatus[] = ["Awaiting Assignment", "Assigned", "Open", "In Progress", "Overdue", "Pending Review", "Pending Auditor Review", "Awaiting Review", "Rework Required", "Completed"];
export const ACTION_STATUS_CONFIG = Object.fromEntries(ACTION_STATUSES.map((status) => [status, { label: status, variant: getOpsStatusVariant(status) as BadgeVariant }])) as Record<MyActionStatus, { label: string; variant: BadgeVariant }>;

export const ACTION_PRIORITY_CONFIG: Record<MyActionPriority, { label: string; variant: BadgeVariant; rank: number }> = {
  Critical: { label: "Critical", variant: OPS_PRIORITY.Critical.variant, rank: OPS_PRIORITY.Critical.rank },
  High: { label: "High", variant: OPS_PRIORITY.High.variant, rank: OPS_PRIORITY.High.rank },
  Medium: { label: "Medium", variant: OPS_PRIORITY.Medium.variant, rank: OPS_PRIORITY.Medium.rank },
  Low: { label: "Low", variant: OPS_PRIORITY.Low.variant, rank: OPS_PRIORITY.Low.rank },
};

export const ACTION_REVIEW_STATUSES: readonly MyActionStatus[] = ["Pending Review", "Pending Auditor Review", "Awaiting Review"];

export function inferActionSourceModule(action: Pick<MyAction, "source" | "sourceModule">): ActionSourceModule {
  if (action.sourceModule) return action.sourceModule;
  if (action.source === "Continuous Improvement") return "continuousImprovement";
  if (action.source === "Red Flag") return "redFlag";
  if (action.source === "Red Tag") return "redTag";
  if (action.source === "Visual Management") return "visualManagement";
  if (action.source === "Visual Improvement") return "visualImprovement";
  if (action.source === "Gemba") return "gemba";
  if (action.source === "Manual") return "manual";
  return "audit";
}

export function getActionSourceDefinition(action: Pick<MyAction, "source" | "sourceModule">) {
  const definition = ALL_ACTION_SOURCE_CONFIG.find((item) => item.id === inferActionSourceModule(action))!;
  return definition.id === "manual" ? { ...definition, label: "Manual · Created in Actions" } : definition;
}

export function normalizeActionSource(action: MyAction): MyAction {
  const sourceModule = inferActionSourceModule(action);
  const definition = ALL_ACTION_SOURCE_CONFIG.find((item) => item.id === sourceModule)!;
  return {
    ...action,
    sourceModule,
    sourceId: action.sourceId ?? action.auditId ?? (sourceModule === "manual" ? action.id : action.sourceTitle),
    sourceLabel: action.sourceLabel ?? definition.label,
    sourceLocation: action.sourceLocation ?? action.area,
    sourceObservation: action.sourceObservation ?? action.originalFinding ?? action.description,
  };
}

export function getActionSourceHref(action: MyAction) {
  const moduleId = inferActionSourceModule(action);
  if (deletedActionSource(action, moduleId)) return undefined;
  const sourceId = action.sourceId ?? action.auditId ?? action.sourceTitle;
  if (moduleId === "continuousImprovement") return `/continuous-improvement/${encodeURIComponent(sourceId)}`;
  if (moduleId === "redFlag") return sourceId.startsWith("RF-") ? `/red-flag/${encodeURIComponent(sourceId)}` : `/5s/red/${encodeURIComponent(sourceId)}`;
  if (moduleId === "redTag") return `/5s/red/${encodeURIComponent(sourceId)}`;
  if (moduleId === "visualManagement") return action.visualManagementSource?.meetingId
    ? `/visual-management/meetings/${encodeURIComponent(action.visualManagementSource.meetingId)}`
    : action.visualManagementSource?.boardId
      ? `/visual-management/boards/${encodeURIComponent(action.visualManagementSource.boardId)}`
    : `/visual-management/meetings/${encodeURIComponent(sourceId)}`;
  if (moduleId === "visualImprovement") return `/visual-improvement/${encodeURIComponent(sourceId)}`;
  if (moduleId === "gemba") {
    const href = `/gemba/${encodeURIComponent(sourceId)}`;
    return action.sourceObservationId ? `${href}?tab=observations#${encodeURIComponent(action.sourceObservationId)}` : href;
  }
  if (moduleId === "audit") {
    const auditId = action.auditId ?? action.sourceId;
    return auditId ? `/audits?audit=${encodeURIComponent(auditId)}` : "/audits";
  }
  return undefined;
}

export function getActionSourceRecordLabel(action: MyAction) {
  const deleted = deletedActionSource(action, inferActionSourceModule(action));
  if (deleted) return `Source deleted · ${action.sourceId ?? action.auditId ?? action.sourceTitle}`;
  if (inferActionSourceModule(action) === "visualManagement" && action.visualManagementSource) {
    return `${action.visualManagementSource.kpiNameSnapshot} · ${action.visualManagementSource.boardNameSnapshot} · ${action.visualManagementSource.reportingPeriod.label}`;
  }
  return action.sourceId ?? action.sourceTitle;
}

export function getEnabledActionSources(access: Record<AccessCapabilityId, boolean>) {
  return ACTION_SOURCE_CONFIG.filter((item) => !item.entitlement || access[item.entitlement]);
}

function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

export function actionDueDays(action: MyAction, now = new Date()) {
  return Math.round((startOfDay(new Date(`${action.dueDate}T00:00:00`)) - startOfDay(now)) / 86_400_000);
}

export function isActionOverdue(action: MyAction, now = new Date()) {
  return action.status !== "Completed" && (action.status === "Overdue" || actionDueDays(action, now) < 0);
}

export function getActionDueLabel(action: MyAction, now = new Date()) {
  if (action.status === "Completed") return action.completedAt ? `Completed ${formatShortDate(action.completedAt)}` : "Completed";
  const days = actionDueDays(action, now);
  const dueDate = formatShortDate(action.dueDate);
  
  // Always show actual due date with relative context (Feedback #28)
  if (days < 0) {
    const overdueDays = Math.abs(days);
    const daysLabel = overdueDays === 1 ? "1 day" : `${overdueDays} days`;
    return `${dueDate} · Overdue by ${daysLabel}`;
  }
  if (days === 0) return `${dueDate} · Due today`;
  if (days === 1) return `${dueDate} · Due tomorrow`;
  if (days <= 3) return `${dueDate} · Due in ${days} days`;
  return dueDate;
}

export function getActionUpdatedAt(action: MyAction) {
  return action.activityHistory?.at(-1)?.createdAt ?? action.reviewedAt ?? action.submittedForReviewAt ?? action.completedAt ?? action.createdAt;
}

export function sortActionsByUrgency(actions: MyAction[], now = new Date()) {
  return [...actions].sort((a, b) => {
    const urgency = (action: MyAction) =>
      (isActionOverdue(action, now) ? 1_000 : 0) +
      ACTION_PRIORITY_CONFIG[action.priority].rank * 100 +
      (actionDueDays(action, now) === 0 ? 80 : actionDueDays(action, now) <= 3 ? 40 : 0);
    return urgency(b) - urgency(a) || actionDueDays(a, now) - actionDueDays(b, now) || getActionUpdatedAt(b).localeCompare(getActionUpdatedAt(a));
  });
}

export function formatShortDate(value: string) {
  return formatOpsDate(value);
}

export const ACTION_TYPE_LABELS: Record<MyActionType, string> = { immediate: "Immediate Action", corrective: "Corrective Action" };
export function isActionType(value: unknown): value is MyActionType { return value === "immediate" || value === "corrective"; }
export function getActionTypeLabel(value?: MyActionType) { return isActionType(value) ? ACTION_TYPE_LABELS[value] : "Not recorded"; }
