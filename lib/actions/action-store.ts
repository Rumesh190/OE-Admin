"use client";
import { isV4Action, canReadV4Action, canWorkV4Action, canVerifyV4Action, persistV4ActionUpdate, withV4ActionWrite } from "./action-v4-policy";
import { readAdministrationPayload, ADMINISTRATION_JOURNAL_KEY } from "@/lib/administration-storage";
import { getActiveAccessContext } from "@/features/five-s/administration/access-v4-context";
import { useAccessContext } from "@/features/five-s/administration/access-v4-context";
import { activeOperationalRecords, useActiveOperationalRecords, getRecordTombstone, registerDeletionSource, registerDeletionActionReader } from "@/lib/records/record-tombstones";


import { allocateModuleRecordId, registerRecordCreationStore } from "@/lib/records/module-records";

import { authorizeActionCreation } from "./action-creation-access";
import { prepareActionEvidenceCompaction } from "./action-evidence-storage";
import { resetImportedRedTagData } from "@/lib/five-s/red-tag-reset";

import { useSyncExternalStore } from "react";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { DEMO_ORGANIZATION, getOrganizationAccess } from "@/lib/module-entitlements";
import { getCurrentDemoUser } from "@/lib/current-user";
import { getAdminUser } from "@/features/five-s/administration/store";

import {
  MY_ACTIONS,
} from "@/features/five-s/data/my-actions-data";

import type {
  MyAction,
  MyActionType,
  MyActionActivity,
  MyActionSubmissionRevision,
} from "@/features/five-s/types/my-actions";
import { createNotification } from "@/lib/notifications/notification-store";
import { getFiveSZoneConfiguration, getPriorityDueDate } from "@/lib/five-s/configuration";
import { safeSetStorage } from "@/lib/browser-storage";
import { getActionTypeLabel, isActionType, getActionSourceDefinition, normalizeActionSource, inferActionSourceModule } from "@/lib/actions/action-config";

export interface ActionActor {
  id: string;
  name: string;
  roles?: readonly string[];
  permissions?: readonly string[];
  v4Expectation?: { selectionId: string; revision: number };
}

type CreateActionInput = Omit<
  MyAction,
  "id" | "createdAt" | "completedAt" | "evidence" | "submissionRevisions"
>;

type ActionEvidence =
  MyAction["evidence"][number];

const STORAGE_KEY =
  "standalone-5s-actions";

let hasLoadedFromStorage = false;
let lastCanonicalPayload: string | null | undefined;

let actions: MyAction[] = MY_ACTIONS.map(normalizeEvidence);


const listeners =
  new Set<() => void>();

/* =========================================================
   STORAGE
   ========================================================= */

function loadFromStorage() {
  if (typeof window !== "undefined") {
    const raw = readAdministrationPayload(STORAGE_KEY);
    if (hasLoadedFromStorage && raw === lastCanonicalPayload) return;
    if (hasLoadedFromStorage && raw !== lastCanonicalPayload) hasLoadedFromStorage = false;
    lastCanonicalPayload = raw;
    const context = getActiveAccessContext();
    if (context && context.kind !== "platform" && context.organizationId !== DEMO_ORGANIZATION.id) {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) throw new Error("Invalid canonical Action payload. Preserve storage.");
      actions = parsed as MyAction[]; hasLoadedFromStorage = true; return;
    }
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.some(a => a && isV4Action(a))) {
        actions = parsed as MyAction[]; hasLoadedFromStorage = true; return;
      }
    }
  }
  if (
    hasLoadedFromStorage ||
    typeof window === "undefined"
  ) {
    return;
  }

  resetImportedRedTagData();
  hasLoadedFromStorage = true;

  try {
    const stored =
      readAdministrationPayload(STORAGE_KEY);

    if (!stored) {
      actions = MY_ACTIONS.map(normalizeEvidence);

      saveToStorage();

      return;
    }

    const parsed =
      JSON.parse(stored);

    if (Array.isArray(parsed)) {
      const storedActions = parsed as MyAction[];
      // An existing collection is authoritative; cleanup must not resurrect samples.
      actions = storedActions.map(normalizeEvidence);
    }
  } catch (error) {
    console.error(
      "Failed to load actions from localStorage:",
      error
    );

    actions = MY_ACTIONS.map(normalizeEvidence);
  }
}

function saveToStorage() {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  if (window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY) || (hasLoadedFromStorage && window.localStorage.getItem(STORAGE_KEY) !== lastCanonicalPayload)) return { success: false as const, reason: "unavailable" as const, message: "Action state changed or recovery is pending; reload before retrying." };
  const result = safeSetStorage(STORAGE_KEY, actions);
  if (result.success) lastCanonicalPayload = window.localStorage.getItem(STORAGE_KEY);
  return result;
}

/** Preserve legacy arrays while making evidence purpose explicit. */
function normalizeEvidence(action: MyAction): MyAction {
  return normalizeActionSource({
    ...action,
    issueEvidence: (action.issueEvidence ?? []).map((evidence) => ({
      ...evidence,
      actionId: evidence.actionId ?? action.id,
      evidenceType: "finding",
    })),
    evidence: (action.evidence ?? []).map((evidence) => ({
      ...evidence,
      actionId: evidence.actionId ?? action.id,
      evidenceType: "resolution",
    })),
    progressEvidence: (action.progressEvidence ?? []).map((evidence) => ({
      ...evidence,
      actionId: evidence.actionId ?? action.id,
      evidenceType: "progress",
    })),
  });
}

/* =========================================================
   STORE
   ========================================================= */

function emitChange() {
  saveToStorage();

  listeners.forEach(
    (listener) => listener()
  );
}

function subscribe(
  listener: () => void
) {
  loadFromStorage();

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  loadFromStorage();

  return actions;
}

function getServerSnapshot() {
  return MY_ACTIONS;
}

/**
 * Shared 5S action store.
 *
 * Frontend-only MVP store with
 * localStorage persistence.
 */
export function useActionStore() {
  useAccessContext();
  const active = useActiveOperationalRecords("action", useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  ));
  return active.filter(visibleCanonicalAction);
}

/**
 * Return all current actions.
 */
function visibleCanonicalAction(a: MyAction) {
  if (isV4Action(a)) return canReadV4Action(a);
  try { const c = getActiveAccessContext(); return !c || (c.kind === "factory" && c.organizationId === DEMO_ORGANIZATION.id && c.plantId === "PLANT-EGM"); } catch { return false; }
}
export function refreshCanonicalActionStore() { hasLoadedFromStorage = false; loadFromStorage(); listeners.forEach(l => l()); window.dispatchEvent?.(new Event("ops-action-v4-changed")); }
export function getActions():
  MyAction[] {
  loadFromStorage();

  return activeOperationalRecords("action", actions).filter(visibleCanonicalAction);
}

/**
 * Find an action by ID.
 */
export function getActionById(
  actionId: string
): MyAction | undefined {
  if (getRecordTombstone("action", actionId)) return undefined;
  loadFromStorage();

  return actions.find(
    (action) =>
      action.id === actionId && visibleCanonicalAction(action)
  );
}

/**
 * Create a new action.
 */
export function createAction(
  input: CreateActionInput
): MyAction {
  // Reject unauthorized calls before the normal loader can initialize fixture storage.
  authorizeActionCreation(input, actions);
  loadFromStorage();
  const { user, owner, sourceModule, sourceId } = authorizeActionCreation(input, actions);
  const actionId = allocateModuleRecordId("actions", actions.map(item => item.id));

  const action: MyAction = normalizeEvidence({
    ...input,
    sourceModule, sourceId,
    createdByUserId: user.id, createdByName: user.name, auditor: user.name,
    ...(owner ? { responsiblePersonId: owner.id, responsiblePersonName: owner.name, assignedTo: owner.name } : {}),
    ...(input.assignedByUserId ? { assignedByUserId: user.id, assignedByName: user.name } : {}),
    submissionRevisions: [],

    id: actionId,

    createdAt: new Date().toISOString(),

    issueEvidence: (input.issueEvidence ?? []).map((evidence) => ({
      ...evidence,
      actionId,
      evidenceType: "finding",
    })),
    evidence: [],
    progressEvidence: input.progressEvidence ?? [],

    activityHistory: [createActivity("created", { id: user.id, name: user.name })],
  });

  const previousActions = actions;
  actions = [
    action,
    ...actions,
  ];

  const result = saveToStorage();
  if (!result?.success) {
    actions = previousActions;
    throw new Error(result?.message ?? "Unable to save this Action. Please try again.");
  }
  listeners.forEach((listener) => listener());

  if (action.status === "Awaiting Assignment" && action.zoneLeaderId) {
    createNotification({ recipientUserId: action.zoneLeaderId, title: "New Action Requires Assignment", message: `${action.title} · Raised by: ${action.createdByName ?? action.auditor ?? "Auditor"} · Source: ${getActionSourceDefinition(action).label} ${action.sourceId ?? action.sourceTitle} · Zone: ${action.area} · Priority: ${action.priority}`, href: `/5s/actions/${encodeURIComponent(action.id)}` });
  } else if (action.responsiblePersonId) {
    createNotification({
      recipientUserId: action.responsiblePersonId,
      title: "New action assigned",
      message: `${action.title} · Assigned by: ${action.createdByName ?? action.auditor ?? "Auditor"} · Source: ${getActionSourceDefinition(action).label} ${action.sourceId ?? action.sourceTitle} · Zone: ${action.area} · Priority: ${action.priority} · Due: ${action.dueDate}`,
      href: `/5s/actions/${encodeURIComponent(action.id)}`,
    });
  }

  return action;
}

/** Removes only a just-created Action when its source-link transaction fails. */
export function rollbackCreatedAction(actionId: string, actor?: ActionActor): boolean {
  loadFromStorage();
  const action = actions.find((item) => item.id === actionId);
  if (!action || isV4Action(action) || !activeActionActor(action, actor) || !isCreator(action, getAdminUser(actor!.id)!) || (action.activityHistory?.length ?? 0) > 1 || action.activityHistory?.[0]?.type !== "created") return false;
  const previousActions = actions;
  actions = actions.filter((item) => item.id !== actionId);
  const result = saveToStorage();
  if (!result?.success) { actions = previousActions; return false; }
  listeners.forEach((listener) => listener());
  return true;
}

export function assignActionToZoneMember(actionId: string, actor: ActionActor, memberId: string) {
  const action = getActionById(actionId);
  const zone = action ? getFiveSZoneConfiguration(action.area) : undefined;
  const member = zone?.members.find((item) => item.id === memberId);
  if (!action || action.status !== "Awaiting Assignment" || !zone || zone.leaderId !== actor.id || !member) return undefined;
  const assignedAt = new Date().toISOString();
  const updated = updateActionInternal(actionId, { status: "Assigned", assignedTo: member.name, responsiblePersonId: member.id, responsiblePersonName: member.name, assignedByUserId: actor.id, assignedByName: actor.name, assignedAt, activityHistory: appendActivity(action, createActivity("assigned", actor, `Assigned to ${member.name}`)) });
  if (updated) createNotification({ recipientUserId: member.id, title: "New Action Assigned", message: `${action.title} · Assigned by: ${actor.name} · Raised by: ${action.createdByName ?? action.auditor ?? "Auditor"} · Zone: ${action.area} · Priority: ${action.priority} · Due: ${action.dueDate}`, href: `/5s/actions/${encodeURIComponent(action.id)}` });
  return updated;
}

function createActivity(
  type: MyActionActivity["type"],
  actor: ActionActor,
  remark?: string
): MyActionActivity {
  return {
    id: `ACTIVITY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    actorId: actor.id,
    actorName: actor.name,
    createdAt: new Date().toISOString(),
    remark,
  };
}

function responsibleId(action: MyAction) {
  return action.responsiblePersonId ?? action.assignedTo;
}

function creatorId(action: MyAction) {
  return action.createdByUserId ?? action.auditor;
}

function reviewerRecipientId(action: MyAction) {
  return action.reviewerId ?? creatorId(action);
}

function isResponsible(action: MyAction, actor: ActionActor) {
  return action.responsiblePersonId
    ? action.responsiblePersonId === actor.id
    : action.assignedTo === actor.name;
}

function isCreator(action: MyAction, actor: ActionActor) {
  if (action.createdByUserId) return action.createdByUserId === actor.id;
  if (action.createdByName) return action.createdByName === actor.name;
  return Boolean(action.auditor && action.auditor === actor.name);
}

/** Current configured leadership, not historical Action ownership metadata. */
function isZoneLeader(action: MyAction, actor: ActionActor) {
  const user = getAdminUser(actor.id);
  return Boolean(user?.status === "Active" && user.roles.includes("Zone Leader") && user.permissions.includes("actions.assign") && user.plant === action.plant && getFiveSZoneConfiguration(action.area)?.leaderId === user.id);
}

export function canEditActionDueDate(action: MyAction, actor: ActionActor) {
  if (isV4Action(action)) return false;
  const user = getAdminUser(actor.id);
  return action.status !== "Completed" && Boolean(user?.status === "Active" && ((user.roles.includes("Admin") && user.permissions.includes("actions.assign") && (user.plant === action.plant || user.plant === "All organizations")) || isZoneLeader(action, actor)));
}

export function validateActionDueDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Select a valid due date.";
  const date = new Date(`${value}T12:00:00`);
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== Number(value.slice(0, 4)) || date.getMonth() + 1 !== Number(value.slice(5, 7)) || date.getDate() !== Number(value.slice(8, 10))) return "Select a valid calendar date.";
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return value < today ? "The new due date cannot be in the past." : "";
}

export function changeActionDueDate(actionId: string, actor: ActionActor, newDate: string, reason: string) {
  const action = getActionById(actionId);
  if (!action || !canEditActionDueDate(action, actor) || validateActionDueDate(newDate) || !reason.trim() || newDate === action.dueDate) return undefined;
  const user = getAdminUser(actor.id)!;
  const change = { previousDate: action.dueDate, newDate, reason: reason.trim(), actorId: user.id, actorName: user.name, changedAt: new Date().toISOString() };
  return updateActionInternal(actionId, { priorityDueDate: action.priorityDueDate ?? action.dueDate, dueDateOverride: newDate, dueDate: newDate, dueDateHistory: [...(action.dueDateHistory ?? []), change], activityHistory: appendActivity(action, createActivity("due_date_changed", user, `${change.previousDate} → ${newDate}. ${change.reason}`)) });
}

export function canReviewAction(action: MyAction, actor: ActionActor) {
  if (isV4Action(action)) return canVerifyV4Action(action, actor.id);
  const user = getAdminUser(actor.id);
  if (user?.status !== "Active" || isResponsible(action, user)) return false;
  if (user.roles.includes("Zone Leader") && !user.roles.some(role => ["Admin", "Auditor", "Reviewer"].includes(role)) && !isZoneLeader(action, user)) return false;
  const designated = action.reviewerId ? action.reviewerId === user.id
    : action.reviewerName ? action.reviewerName === user.name
    : action.auditor ? action.auditor === user.name
    : (action.createdByUserId || action.createdByName) ? isCreator(action, user)
    : user.roles.includes("Admin") && user.permissions.includes("actions.review") && user.permissions.includes("actions.close");
  if (inferActionSourceModule(action) === "audit") return designated;
  const ownerId = action.responsiblePersonId ?? getFiveSZoneConfiguration(action.area)?.members.find(member => member.name === (action.responsiblePersonName ?? action.assignedTo))?.id;
  const eligibleOwner = getFiveSZoneConfiguration(action.area)?.members.some(member => member.id === ownerId);
  return designated || Boolean(eligibleOwner && isZoneLeader(action, user));
}

/** Shared readiness checks for designated reviewers and scoped delegated reviewers. */
export function getActionClosureError(action: MyAction, actor: ActionActor) {
  const user = getAdminUser(actor.id);
  if (user?.status !== "Active") return "You are not authorized to review this Action.";
  if (isResponsible(action, user)) return "Action owners cannot approve their own work.";
  if (!canReviewAction(action, user)) return "You are not authorized to review this Action.";
  if (!["Pending Review", "Pending Auditor Review", "Awaiting Review"].includes(action.status) || !action.submittedForReviewAt) return "The Action owner must submit the completed work for review first.";
  if (!action.evidence.length) return "Completion evidence is required before verification and closure.";
  if (!(action.resolutionObservation ?? action.actionTakenDescription)?.trim() || !action.correctiveActionCategory) return "Completion notes and corrective action category are required.";
  if (!Number.isFinite(action.costSaving) || action.costSaving! < 0) return "A valid non-negative cost saving amount is required.";
  return "";
}

export function canReassignAction(action: MyAction, actor: ActionActor) {
  if (isV4Action(action)) return false;
  const user = getAdminUser(actor.id);
  if (action.status === "Completed" || user?.status !== "Active") return false;
  return Boolean(user.roles.includes("Admin") || getFiveSZoneConfiguration(action.area)?.leaderId === actor.id || isCreator(action, actor));
}

function appendActivity(action: MyAction, activity: MyActionActivity) {
  return [...(action.activityHistory ?? []), activity];
}

function activeActionActor(action: MyAction, actor?: ActionActor) {
  if (isV4Action(action)) return actor && canReadV4Action(action) ? getAuthenticatedDemoActor(actor.id)?.user : undefined;
  const user = actor?.id ? getAdminUser(actor.id) : undefined;
  return user?.status === "Active" && (user.plant === action.plant || user.plant === "All organizations") ? user : undefined;
}

export function canEditActionContent(action: MyAction, actor?: ActionActor) {
  if (isV4Action(action)) return Boolean(actor && canWorkV4Action(action, actor.id));
  const user = activeActionActor(action, actor);
  return Boolean(user && (user.permissions.includes("actions.work") || isZoneLeader(action, user)) && isResponsible(action, user)
    && ["Assigned", "Open", "In Progress", "Rework Required"].includes(action.status)
    && (user.roles.includes("Admin") || user.zoneMemberships.some(membership => membership.zone === action.area)));
}

function canEditActionSetup(action: MyAction, actor?: ActionActor) {
  if (isV4Action(action)) return false;
  const user = activeActionActor(action, actor);
  return Boolean(user && action.status === "Awaiting Assignment" && user.permissions.includes("actions.create") && (user.roles.includes("Admin") || isCreator(action, user)));
}

function canEditAuditFinding(action: MyAction, actor?: ActionActor) {
  if (isV4Action(action)) return false;
  const user = activeActionActor(action, actor);
  return Boolean(user && action.status !== "Completed" && inferActionSourceModule(action) === "audit" && user.permissions.includes("actions.create") && isCreator(action, user));
}

/** Token for the ownership/lifecycle state shown when the selection dialog opened. */
export function getActionStartState(action: MyAction) {
  return JSON.stringify([action.status, action.responsiblePersonId, action.assignedTo, action.reviewerId, action.actionType,
    action.activityHistory?.at(-1)?.id, action.submittedForReviewAt]);
}
function authenticatedActionWorker(action: MyAction, actor: ActionActor) {
  if (isV4Action(action)) return canWorkV4Action(action, actor.id) ? getAuthenticatedDemoActor(actor.id)?.user : undefined;
  const current = getAuthenticatedDemoActor(actor.id);
  const scoped: MyAction & { organizationId?: string } = action;
  const access = getOrganizationAccess();
  const source = getActionSourceDefinition(action);
  return current && (!scoped.organizationId || scoped.organizationId === DEMO_ORGANIZATION.id)
    && access.actions && (!source.entitlement || access[source.entitlement])
    && (source.id !== "redFlag" || access.redFlag) && canEditActionContent(action, current.user) ? current.user : undefined;
}
export function getActionStartError(action: MyAction, actor: ActionActor, actionType: unknown, expectedState?: string) {
  if (!isActionType(actionType)) return "Select Immediate Action or Corrective Action.";
  if (!authenticatedActionWorker(action, actor)) return "You are not authorized to start this Action. Check your current session, ownership and module access.";
  if (expectedState !== undefined && expectedState !== getActionStartState(action)) return "This Action has changed. Close this dialog and refresh before starting again.";
  if (!["Assigned", "Open", "Rework Required"].includes(action.status)) return "This Action cannot be started in its current status. Refresh to see the latest state.";
  return "";
}
export function startAssignedAction(actionId: string, actor: ActionActor, actionType?: MyActionType, expectedState?: string) {
  // Reject forged callers and missing/invalid selections before initializing any storage.
  if (!getAuthenticatedDemoActor(actor.id) || !isActionType(actionType)) return undefined;
  // Re-read durable state so a stale tab cannot overwrite a newer assignment/start/review.
  hasLoadedFromStorage = false;
  const action = getActionById(actionId);
  if (!action || getActionStartError(action, actor, actionType, expectedState)) return undefined;
  const user = getAuthenticatedDemoActor(actor.id)!.user;
  return updateActionInternal(actionId, {
    status: "In Progress", actionType,
    activityHistory: appendActivity(action, { ...createActivity("started", user, `Previous status: ${action.status}; Action type: ${getActionTypeLabel(actionType)}`), actionType }),
  }, actor);
}

export function canUndoActionStart(action: MyAction, actor: ActionActor) {
  const started = [...(action.activityHistory ?? [])].reverse().find(event => event.type === "started");
  return action.status === "In Progress" && Boolean(authenticatedActionWorker(action, actor)) && getCurrentDemoUser().id === actor.id
    && canEditActionContent(action, actor) && started?.actorId === actor.id;
}

export function undoActionStart(actionId: string, actor: ActionActor, draft?: { observation: string; category: string; costSaving?: number }) {
  if (!getAuthenticatedDemoActor(actor.id)) return undefined;
  hasLoadedFromStorage = false;
  const action = getActionById(actionId);
  if (!action || !canUndoActionStart(action, actor)) return undefined;
  if (draft?.costSaving !== undefined && (!Number.isFinite(draft.costSaving) || draft.costSaving < 0)) return undefined;
  const events = action.activityHistory ?? [];
  const startIndex = events.findLastIndex(event => event.type === "started");
  const previous = events[startIndex].remark?.replace("Previous status: ", "").split(";")[0];
  const priorEvent = events.slice(0, startIndex).reverse().find(event => ["assigned", "reassigned", "sent_back", "submitted", "resubmitted"].includes(event.type));
  const status = previous === "Open" || previous === "Assigned" || previous === "Rework Required"
    ? previous : priorEvent?.type === "sent_back" ? "Rework Required" : "Assigned";
  return updateActionInternal(actionId, {
    status, actionType: undefined,
    ...(draft ? { actionTakenDescription: draft.observation, resolutionObservation: draft.observation,
      correctiveActionCategory: draft.category || undefined, costSaving: draft.costSaving } : {}),
    activityHistory: appendActivity(action, { ...createActivity("start_undone", getAdminUser(actor.id)!, `Start Work undone; returned to ${status}. Saved details and evidence retained.`), actionType: action.actionType }),
  }, actor);
}

/** Compact legacy binaries before the revision snapshot duplicates their references. */
export async function submitActionForReviewWithEvidenceStorage(
  actionId: string,
  actor: ActionActor,
  resolution: Parameters<typeof submitActionForReview>[2]
) {
  const action = getActionById(actionId);
  if (!action || !canEditActionContent(action, actor)) return undefined;
  if (!resolution.observation.trim() || !resolution.correctiveActionCategory || action.evidence.length === 0 || !Number.isFinite(resolution.costSaving) || resolution.costSaving < 0) return undefined;
  if (!isV4Action(action)) await compactActionEvidenceStorage();
  // The synchronous command rechecks current permissions and status after the async write.
  return submitActionForReview(actionId, actor, resolution);
}

export function submitActionForReview(
  actionId: string,
  actor: ActionActor,
  resolution: { observation: string; correctiveActionCategory: string; costSaving: number }
) {
  const action = getActionById(actionId);
  if (!action || !canEditActionContent(action, actor)) return undefined;
  if (!resolution.observation.trim() || !resolution.correctiveActionCategory || action.evidence.length === 0 || !Number.isFinite(resolution.costSaving) || resolution.costSaving < 0) return undefined;
  const isResubmission = action.status === "Rework Required" || (action.reviewHistory?.length ?? 0) > 0;
  const now = new Date().toISOString();
  const owner = getAdminUser(actor.id)!;
  const submitted = createActivity(isResubmission ? "resubmitted" : "submitted", owner);
  const revision: MyActionSubmissionRevision = {
    id: submitted.id, number: (action.submissionRevisions?.length ?? 0) + 1, submittedAt: now,
    submittedByUserId: owner.id, submittedByName: owner.name,
    actionType: action.actionType, observation: resolution.observation.trim(), correctiveActionCategory: resolution.correctiveActionCategory,
    costSaving: resolution.costSaving, currency: action.currency ?? "INR",
    evidence: structuredClone(action.evidence), progressEvidence: structuredClone(action.progressEvidence ?? []),
  };
  const updated = updateActionInternal(actionId, {
    status: "Pending Auditor Review",
    actionTakenDescription: resolution.observation.trim(),
    resolutionObservation: resolution.observation.trim(),
    correctiveActionCategory: resolution.correctiveActionCategory,
    costSaving: resolution.costSaving,
    currency: action.currency ?? "INR",
    submittedForReviewAt: now,
    completedAt: undefined,
    activityHistory: appendActivity(action, submitted),
    submissionRevisions: [...(action.submissionRevisions ?? []), revision],
  }, actor);
  if (updated && !isV4Action(action) && reviewerRecipientId(action)) createNotification({
    recipientUserId: reviewerRecipientId(action)!,
    title: isResubmission ? "Action resubmitted for review" : "Action submitted for review",
    message: `${action.title} · Submitted by: ${actor.name} · Source: ${getActionSourceDefinition(action).label} ${action.sourceId ?? action.sourceTitle} · Zone: ${action.area}`,
    href: `/5s/actions/${encodeURIComponent(action.id)}?mode=review`,
  });
  return updated;
}

export function sendActionBack(actionId: string, actor: ActionActor, remark: string) {
  const action = getActionById(actionId);
  if (!action || !canReviewAction(action, actor) || !["Pending Review", "Pending Auditor Review", "Awaiting Review"].includes(action.status) || !remark.trim()) return undefined;
  const review = createActivity("sent_back", getAdminUser(actor.id)!, remark.trim());
  const updated = updateActionInternal(actionId, {
    status: "Rework Required",
    reviewedAt: undefined,
    reviewedBy: undefined,
    completedAt: undefined,
    reviewHistory: [...(action.reviewHistory ?? []), review],
    activityHistory: appendActivity(action, review),
    submissionRevisions: reviewSubmissionRevision(action, review),
  }, actor);
  if (updated && !isV4Action(action)) createNotification({
    recipientUserId: responsibleId(action),
    title: "Action sent back for rework",
    message: `${action.title} · Reviewer: ${actor.name} · ${remark.trim()}`,
    href: `/5s/actions/${encodeURIComponent(action.id)}`,
  });
  return updated;
}

/** Capture only the existing latest legacy package, with provenance; never fabricate lost revisions. */
function reviewSubmissionRevision(action: MyAction, review: MyActionActivity) {
  let revisions = action.submissionRevisions ?? [];
  if (!revisions.length && action.submittedForReviewAt) {
    const submitted = [...(action.activityHistory ?? [])].reverse().find(event => ["submitted", "resubmitted"].includes(event.type));
    revisions = [{ id: submitted?.id ?? crypto.randomUUID(), number: 1, submittedAt: action.submittedForReviewAt,
      submittedByUserId: submitted?.actorId, submittedByName: submitted?.actorName,
      observation: action.resolutionObservation ?? action.actionTakenDescription ?? "",
      actionType: action.actionType, correctiveActionCategory: action.correctiveActionCategory, costSaving: action.costSaving, currency: action.currency,
      evidence: structuredClone(action.evidence), progressEvidence: structuredClone(action.progressEvidence ?? []), legacyCapturedAt: review.createdAt }];
  }
  return revisions.map((revision, index) => index === revisions.length - 1 && !revision.reviewEventId
    ? { ...revision, reviewEventId: review.id } : revision);
}

export function closeReviewedAction(actionId: string, actor: ActionActor, closureRemark?: string) {
  const action = getActionById(actionId);
  if (!action || getActionClosureError(action, actor)) return undefined;
  const reviewer = getAdminUser(actor.id)!;
  const now = new Date().toISOString();
  const reviewedActivity = createActivity("verified", reviewer, closureRemark?.trim() || undefined);
  const closedActivity = createActivity("closed", reviewer);
  const updated = updateActionInternal(actionId, {
    status: "Completed",
    reviewedBy: reviewer.name,
    reviewedAt: now,
    completedAt: now,
    closedByUserId: reviewer.id,
    closedBy: reviewer.name,
    closedAt: now,
    closureRemark: closureRemark?.trim() || undefined,
    completedByUserId: action.responsiblePersonId,
    completedByName: action.responsiblePersonName ?? action.assignedTo,
    reviewHistory: [...(action.reviewHistory ?? []), reviewedActivity, closedActivity],
    submissionRevisions: reviewSubmissionRevision(action, reviewedActivity),
    activityHistory: [...(action.activityHistory ?? []), reviewedActivity, closedActivity],
  }, actor);
  if (updated && !isV4Action(action)) createNotification({
    recipientUserId: responsibleId(action),
    title: "Action approved and closed",
    message: `${action.title} · Reviewed by: ${reviewer.name} · Cost Saving: ₹${(action.costSaving ?? 0).toLocaleString("en-IN")}`,
    href: `/5s/actions/${encodeURIComponent(action.id)}`,
  });
  return updated;
}

export function reassignActionOwner(actionId: string, actor: ActionActor, memberId: string, reason: string) {
  const action = getActionById(actionId);
  const zone = action ? getFiveSZoneConfiguration(action.area) : undefined;
  const member = zone?.members.find((item) => item.id === memberId);
  if (!action || !zone || !member || member.id === action.responsiblePersonId || !reason.trim() || !canReassignAction(action, actor)) return undefined;
  const changedAt = new Date().toISOString();
  const previousOwnerName = action.responsiblePersonName ?? action.assignedTo ?? "Unassigned";
  const reassignment = {
    id: `REASSIGN-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    previousOwnerId: action.responsiblePersonId,
    previousOwnerName,
    newOwnerId: member.id,
    newOwnerName: member.name,
    changedByUserId: actor.id,
    changedByName: actor.name,
    changedAt,
    reason: reason.trim(),
  };
  const updated = updateActionInternal(actionId, {
    assignedTo: member.name,
    responsiblePersonId: member.id,
    responsiblePersonName: member.name,
    assignedByUserId: actor.id,
    assignedByName: actor.name,
    assignedAt: changedAt,
    status: action.status === "Awaiting Assignment" ? "Assigned" : action.status,
    reassignmentHistory: [...(action.reassignmentHistory ?? []), reassignment],
    activityHistory: appendActivity(action, createActivity("reassigned", actor, `${previousOwnerName} → ${member.name}. ${reason.trim()}`)),
  });
  if (updated) createNotification({ recipientUserId: member.id, title: "Action reassigned to you", message: `${action.title} · Changed by: ${actor.name} · ${reason.trim()}`, href: `/actions/${encodeURIComponent(action.id)}` });
  return updated;
}

/**
 * Update an existing action.
 */
function updateActionInternal(
  actionId: string,
  updates: Partial<MyAction>,
  actor?: ActionActor
): MyAction | undefined {
  loadFromStorage();
  const versioned = actions.find(a => a.id === actionId);
  if (versioned && isV4Action(versioned)) {
    const updated = persistV4ActionUpdate(versioned, updates, actor);
    actions = actions.map(a => a.id === actionId ? updated : a);
    lastCanonicalPayload = window.localStorage.getItem(STORAGE_KEY);
    listeners.forEach(l => l()); window.dispatchEvent?.(new Event("ops-action-v4-changed")); return updated;
  }

  const previousActions = actions;
  let updatedAction:
    MyAction | undefined;

  actions =
    actions.map((action) => {
      if (
        action.id !== actionId
      ) {
        return action;
      }

      updatedAction = {
        ...action,
        ...updates,
      };

      return updatedAction;
    });

  if (typeof window !== "undefined" && !saveToStorage()?.success) {
    actions = previousActions;
    return undefined;
  }
  listeners.forEach((listener) => listener());

  return updatedAction;
}

/** Rebase onto current records after asynchronous asset writes; preserve concurrent workflow changes. */
export async function compactActionEvidenceStorage() {
  loadFromStorage();
  const apply = await prepareActionEvidenceCompaction(actions.filter(a => !isV4Action(a)));
  hasLoadedFromStorage = false; loadFromStorage();
  const previous = actions;
  const compacted = apply(previous.filter(a => !isV4Action(a)));
  const next = previous.map(a => isV4Action(a) ? a : compacted.find(r => r.id === a.id) ?? a);
  if (next.every((action, index) => action === previous[index])) return;
  actions = next;
  const result = saveToStorage();
  if (!result?.success) { actions = previous; throw new Error(result && !result.success ? result.message : "Unable to save Action evidence references."); }
  listeners.forEach(listener => listener());
}

export function canEditActionPriority(action: MyAction, actor: ActionActor) {
  if (isV4Action(action)) return false;
  const user = getAdminUser(actor.id);
  return canEditActionDueDate(action, actor) || Boolean(action.status === "Awaiting Assignment" && user?.status === "Active" && user.plant === action.plant && user.permissions.includes("actions.create") && isCreator(action, user));
}

/** Existing Audit creators retain priority setup authority before assignment. */
export function changeActionPriority(actionId: string, actor: ActionActor, priority: MyAction["priority"]) {
  const action = getActionById(actionId);
  if (!action || !["Low", "Medium", "High", "Critical"].includes(priority) || !canEditActionPriority(action, actor)) return undefined;
  if (priority === action.priority) return action;
  const baseline = getPriorityDueDate(priority);
  return updateActionInternal(actionId, { priority, priorityDueDate: baseline, dueDate: action.dueDateOverride ?? baseline });
}

/** Attention automation may only append its own event types, never replace lifecycle history. */
export function appendActionAttentionActivity(actionId: string, activity: MyActionActivity) {
  const action = getActionById(actionId);
  if (!action || isV4Action(action) || action.status === "Completed" || !["reminder_generated", "escalated", "escalation_acknowledged"].includes(activity.type)) return undefined;
  if (action.activityHistory?.some(event => event.id === activity.id)) return action;
  return updateActionInternal(actionId, { activityHistory: appendActivity(action, activity) });
}

/** Generic edits cannot write identity, source, ownership, dates or lifecycle metadata. */
export function updateAction(actionId: string, updates: Partial<MyAction>, actor?: ActionActor): MyAction | undefined {
  const action = getActionById(actionId);
  if (action && isV4Action(action) && Object.keys(updates).some(k => ["evidence", "progressEvidence", "issueEvidence"].includes(k))) return undefined;
  if (!action || !activeActionActor(action, actor) || !Object.keys(updates).length) return undefined;
  const content = new Set(["title", "description", "actionCategory"]);
  const finding = new Set(["originalFinding", "issueEvidence"]);
  const completion = new Set(["actionTakenDescription", "resolutionObservation", "correctiveActionCategory", "costSaving", "currency", "evidence", "progressEvidence"]);
  for (const key of Object.keys(updates)) {
    if (key === "priority") { if (!canEditActionPriority(action, actor!)) return undefined; }
    else if (content.has(key)) { if (!canEditActionContent(action, actor) && !canEditActionSetup(action, actor)) return undefined; }
    else if (finding.has(key)) { if (!canEditActionSetup(action, actor) && !canEditAuditFinding(action, actor)) return undefined; }
    else if (completion.has(key)) { if (!canEditActionContent(action, actor)) return undefined; }
    else return undefined;
  }
  for (const key of ["evidence", "progressEvidence", "issueEvidence"] as const) {
    if (key in updates && (!Array.isArray(updates[key]) || updates[key]!.some(item => !item || typeof item !== "object" || typeof item.id !== "string"))) return undefined;
  }
  const safeUpdates = structuredClone(updates);
  for (const key of ["evidence", "progressEvidence", "issueEvidence"] as const) {
    if (safeUpdates[key]) safeUpdates[key] = safeUpdates[key]!.map(item => ({ ...item, actionId, evidenceType: key === "issueEvidence" ? "finding" : key === "progressEvidence" ? "progress" : "resolution" }));
  }
  if ("priority" in updates) {
    if (!updates.priority || !["Low", "Medium", "High", "Critical"].includes(updates.priority)) return undefined;
    const baseline = updates.priority === action.priority ? action.priorityDueDate ?? action.dueDate : getPriorityDueDate(updates.priority);
    return updateActionInternal(actionId, { ...safeUpdates, priorityDueDate: baseline, dueDate: action.dueDateOverride ?? baseline });
  }
  return updateActionInternal(actionId, safeUpdates, actor);
}

/**
 * Add evidence to an action.
 */
export function addActionEvidence(
  actionId: string,
  evidence: ActionEvidence,
  actor?: ActionActor,
): MyAction | undefined {
  const action =
    getActionById(
      actionId
    );

  if (!action || !canEditActionContent(action, actor)) {
    return undefined;
  }
  const user = getAdminUser(actor!.id)!;

  return updateActionInternal(
    actionId,
    {
      evidence: [
        ...action.evidence,
        { ...structuredClone(evidence), actionId, evidenceType: "resolution", uploadedBy: user.name },
      ],
      activityHistory: appendActivity(action, createActivity("evidence_uploaded", user, `Completion evidence: ${evidence.name}`)),
    }
  );
}

export function addActionProgressEvidence(actionId: string, evidence: ActionEvidence, actor?: ActionActor) {
  const action = getActionById(actionId);
  if (!action || !canEditActionContent(action, actor)) return undefined;
  const user = getAdminUser(actor!.id)!;
  return updateActionInternal(actionId, {
    progressEvidence: [...(action.progressEvidence ?? []), { ...structuredClone(evidence), actionId, evidenceType: "progress", uploadedBy: user.name }],
    activityHistory: appendActivity(action, createActivity("evidence_uploaded", user, `Progress evidence: ${evidence.name}`)),
  });
}

/**
 * Remove evidence from an action.
 */
export function removeActionEvidence(
  actionId: string,
  evidenceId: string,
  actor?: ActionActor
): MyAction | undefined {
  const action =
    getActionById(
      actionId
    );

  if (!action) {
    return undefined;
  }

  return updateAction(
    actionId,
    {
      evidence:
        action.evidence.filter(
          (evidence) =>
            evidence.id !==
            evidenceId
        ),
    },
    actor
  );
}

export function removeActionProgressEvidence(actionId: string, evidenceId: string, actor?: ActionActor) {
  const action = getActionById(actionId);
  if (!action) return undefined;
  return updateAction(actionId, { progressEvidence: (action.progressEvidence ?? []).filter((evidence) => evidence.id !== evidenceId) }, actor);
}

/**
 * Replace all actions.
 */
export function setActions(
  nextActions: MyAction[]
) {
  if (process.env.NODE_ENV !== "test") throw new Error("Action fixture replacement is test-only.");
  actions = [
    ...nextActions,
  ];

  emitChange();
}

/**
 * Reset actions to original demo data.
 */
export function resetActions() {
  if (process.env.NODE_ENV !== "test") throw new Error("Action fixture reset is test-only.");
  actions = MY_ACTIONS.map(normalizeEvidence);

  emitChange();
}

/**
 * Clear saved actions completely.
 *
 * Useful if you want a fresh demo.
 */
export function clearSavedActions() {
  if (process.env.NODE_ENV !== "test") throw new Error("Action fixture reset is test-only.");
  if (
    typeof window !==
    "undefined"
  ) {
    window.localStorage.removeItem(
      STORAGE_KEY
    );
  }

  hasLoadedFromStorage =
    false;

  actions = [
    ...MY_ACTIONS,
  ];

  emitChange();
}

registerRecordCreationStore(STORAGE_KEY, () => { hasLoadedFromStorage = false; loadFromStorage(); });

registerDeletionSource("action", id => { loadFromStorage(); const item = actions.find(item => item.id === id); return item ? { id: item.id, title: item.title, organizationId: "organizationId" in item && typeof item.organizationId === "string" ? item.organizationId : undefined, plant: item.plant, zone: item.area, aliases: [], linkedActionIds: [] } : undefined; });
registerDeletionActionReader(() => { loadFromStorage(); return actions; });

/** Reuse existing canonical transitions, with explicit revision/context and cooperating writer lock. */
export async function executeV4ActionTransition(actionId: string, expected: NonNullable<ActionActor["v4Expectation"]>, input:
  | { operation: "start"; actionType: MyActionType }
  | { operation: "submit"; observation: string; correctiveActionCategory: string; costSaving: number }
  | { operation: "undo"; observation: string; correctiveActionCategory: string; costSaving: number }
  | { operation: "rework"; reason: string }
  | { operation: "close"; reason: string }
  | { operation: "save"; observation: string; correctiveActionCategory: string; costSaving: number }) {
  return withV4ActionWrite(() => {
    const actor = getAuthenticatedDemoActor(); if (!actor) throw new Error("Actual authenticated owner/reviewer required.");
    const current = getActionById(actionId); if (!current || !isV4Action(current)) throw new Error("Versioned Audit task unavailable.");
    const subject = { id: actor.user.id, name: actor.user.name, v4Expectation: expected };
    if (input.operation === "start") return startAssignedAction(actionId, subject, input.actionType);
    if (input.operation === "undo") return undoActionStart(actionId, subject, { observation: input.observation, category: input.correctiveActionCategory, costSaving: input.costSaving });
    if (input.operation === "submit") return submitActionForReview(actionId, subject, input);
    if (input.operation === "rework") return sendActionBack(actionId, subject, input.reason);
    if (input.operation === "close") return closeReviewedAction(actionId, subject, input.reason);
    return updateAction(actionId, { actionTakenDescription: input.observation, resolutionObservation: input.observation, correctiveActionCategory: input.correctiveActionCategory, costSaving: input.costSaving }, subject);
  });
}
