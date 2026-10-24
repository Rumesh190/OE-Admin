"use client";
import { canWriteLegacyOperational, requireLegacyOperationalWrite } from "@/lib/legacy-operational-write";
import { activeOperationalRecords, useActiveOperationalRecords, getRecordTombstone, registerDeletionSource } from "@/lib/records/record-tombstones";


import { registerActionCreationSource } from "@/lib/actions/action-source-access";

import { allocateModuleRecordId, registerRecordCreationStore, previewModuleRecordId } from "@/lib/records/module-records";

import { resetImportedRedTagData } from "@/lib/five-s/red-tag-reset";

import { useSyncExternalStore } from "react";
import { getCurrentDemoUser, type DemoUser } from "@/lib/current-user";
import { getAdminUser } from "@/features/five-s/administration/store";
import type { MyAction, MyActionStatus } from "@/features/five-s/types/my-actions";
import { RED_TAG_DECISIONS, RED_TAG_REASON_GROUPS, type RedTag, type RedTagDecision, type RedTagDisposition, type RedTagEvidence, type RedTagHistoryEvent, type RedTagStatus } from "./types";
import { canCreateRedTag, canAccessRedTagZone, canCreateRedTagInZone, canManageRedTag, canReviewRedTag, canLinkRedTagAction, getRedTagSessionActor, getRedTagZoneLeader, getRedTagDepartments } from "./access";
import { getRedTagActionIds, getLinkedRedTagActions } from "./workflow";
import { getActionById, getActions } from "@/lib/actions/action-store";
import { MAX_EVIDENCE_IMAGES } from "@/lib/evidence-images";
import { getOrganizationAccess } from "@/lib/module-entitlements";
import { hasPermission } from "@/features/five-s/administration/permissions";
import { DEMO_ORGANIZATION } from "@/lib/organizations";
import { getOrganizationPlant, getOrganizationZone } from "@/lib/organization-store";
import { safeSetStorage, STORAGE_FULL_MESSAGE } from "@/lib/browser-storage";

export const RED_TAG_STORAGE_KEY = "five-s-red-tags-v1";
const DEMO_TAG: RedTag = {
  id: "RT-EGM-ZA-001", tagNumber: "RT-EGM-ZA-001", plant: "Egmore Plant", zone: "Zone A",
  section: "Production", itemName: "Hydraulic Press 04", quantity: 1, reason: "Unclean Area",
  remarks: "Oil residue and unwanted material found around the machine base.",
  requiredAction: "Clean the machine area, remove unwanted material and inspect for leakage.",
  responsiblePersonId: "USR-SIVA", responsiblePersonName: "Siva", targetDate: "2026-08-26", status: "Open",
  createdById: "USR-LAKSHMAN", createdByName: "Lakshman", createdAt: "2026-08-25T10:30:00+05:30",
  imageUrl: "/demo-5s/not-good-example.png",
  history: [{ id: "RTH-001", type: "created", label: "Red Tag created", actor: "Lakshman", at: "2026-08-25T10:30:00+05:30" }],
};

let tags: RedTag[] = [DEMO_TAG];
const SERVER_TAGS: RedTag[] = [DEMO_TAG];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  resetImportedRedTagData();
  loaded = true;
  try {
    const saved = window.localStorage.getItem(RED_TAG_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as unknown;
      if (Array.isArray(parsed)) tags = parsed.map((item) => normalizeRedTag(item as RedTag));
    }
  } catch { /* retain demo data */ }
}
/** Keep the photo once on disk; legacy imageUrl readers receive the same alias on load. */
export function compactRedTagPhotoAliases(next: readonly RedTag[]): RedTag[] {
  return next.map(tag => {
    if (!tag.imageUrl?.startsWith("data:") || tag.imageUrl.length < 1000 || tag.identificationEvidence?.[0]?.url !== tag.imageUrl) return tag;
    const stored = { ...tag }; delete stored.imageUrl; return stored;
  });
}
function persist(next: RedTag[]) {
  requireLegacyOperationalWrite("redTag");
  const result = safeSetStorage(RED_TAG_STORAGE_KEY, compactRedTagPhotoAliases(next));
  if (!result.success) {
    if (typeof window !== "undefined") window.alert(result.reason === "quota" ? STORAGE_FULL_MESSAGE : result.message);
    return false;
  }
  tags = next;
  listeners.forEach((listener) => listener());
  return true;
}
function subscribe(listener: () => void) { load(); listeners.add(listener); return () => listeners.delete(listener); }
function snapshot() { load(); return tags; }
function serverSnapshot() { return SERVER_TAGS; }

export function useRedTags() { return useActiveOperationalRecords("redTag", useSyncExternalStore(subscribe, snapshot, serverSnapshot)); }
export function getRedTags() { load(); return activeOperationalRecords("redTag", tags); }
export function getRedTag(id: string) {
  if (getRecordTombstone("redTag", id)) return undefined; load(); return tags.find((item) => item.id === id); }

export function normalizeRedTagStatus(status: string, tag?: Partial<RedTag>): RedTagStatus {
  if (status === "Resolved") return "Awaiting Verification";
  if (status === "In Progress") return tag?.decisionRecord ? "Disposition In Progress" : "Under Review";
  if (["Open", "Under Review", "Decision Made", "Disposition In Progress", "Awaiting Verification", "Closed"].includes(status)) return status as RedTagStatus;
  return "Open";
}

export function normalizeRedTag(tag: RedTag): RedTag {
  if (!tag.imageUrl && tag.identificationEvidence?.[0]?.url) tag = { ...tag, imageUrl: tag.identificationEvidence[0].url };
  const legacyStatus = String((tag as { status?: string }).status ?? "Open");
  const afterEvidence = tag.afterEvidence?.length ? tag.afterEvidence : tag.dispositionDetails?.evidence?.length ? tag.dispositionDetails.evidence : tag.closure?.evidence ?? [];
  const normalizedStatus = normalizeRedTagStatus(legacyStatus, tag);
  const hasRequiredDispositionSetup = Boolean(
    tag.dispositionDetails?.responsiblePersonId && tag.dispositionDetails.responsiblePersonName?.trim() &&
    tag.dispositionDetails.targetDate && tag.dispositionDetails.executionNotes?.trim(),
  );
  const isPhysicalDisposition = Boolean(tag.decisionRecord && !["keep", "further_evaluation"].includes(tag.decisionRecord.type));
  const legacyDispositionCanClose = getRedTagActionIds(tag).length <= 1 && tag.decisionRecord?.type !== "keep" && normalizedStatus === "Awaiting Verification" && hasRequiredDispositionSetup && Boolean(
    tag.imageUrl?.trim() && afterEvidence.length && tag.dispositionDetails?.completedAt &&
    tag.dispositionDetails.completionNotes?.trim() && tag.dispositionDetails.responsibleConfirmed,
  ) && allLinkedActionsComplete(tag);
  const legacyDispositionCanResume = normalizedStatus === "Awaiting Verification" && !legacyDispositionCanClose && hasRequiredDispositionSetup && isPhysicalDisposition;
  return {
    ...tag,
    status: legacyDispositionCanClose ? "Closed" : legacyDispositionCanResume ? "Disposition In Progress" : normalizedStatus,
    closedAt: legacyDispositionCanClose ? tag.closedAt ?? tag.dispositionDetails?.completedAt : tag.closedAt,
    afterEvidence,
    removalConfirmed: tag.removalConfirmed ?? false,
    history: tag.history ?? [],
    actionIds: getRedTagActionIds(tag),
    dispositionDetails: tag.dispositionDetails ? { ...tag.dispositionDetails, evidence: tag.dispositionDetails.evidence ?? [] } : undefined,
  };
}

function history(type: RedTagHistoryEvent["type"], label: string, actor: Pick<DemoUser, "id" | "name">, at = new Date().toISOString()): RedTagHistoryEvent {
  return { id: `RTH-${crypto.randomUUID()}`, type, label, actor: actor.name, actorId: actor.id, at };
}

function updateTag(id: string, updater: (tag: RedTag) => RedTag) {
  load();
  const current = tags.find((item) => item.id === id);
  if (!current) return undefined;
  const updated = updater(current);
  const next = tags.map((item) => item.id === id ? updated : item);
  return persist(next) ? updated : undefined;
}

export const RED_TAG_VALID_TRANSITIONS: Readonly<Record<RedTagStatus, readonly RedTagStatus[]>> = {
  Open: ["Under Review"],
  "Under Review": ["Decision Made"],
  "Decision Made": ["Disposition In Progress", "Closed"],
  "Disposition In Progress": ["Closed"],
  "Awaiting Verification": ["Closed"],
  Closed: [],
  "In Progress": [],
};

function canTransition(from: RedTagStatus, to: RedTagStatus) {
  return RED_TAG_VALID_TRANSITIONS[from].includes(to);
}
export function getNextTagNumber() {
  load();
  return previewModuleRecordId("redTag", tags.map(tag => tag.id));
}

function hasCreationWorkflowInput(input: Partial<RedTag>) {
  return [input.actionId, input.actionIds, input.review, input.decisionRecord, input.handlingMode, input.dispositionDetails,
    input.keepConfirmation, input.closure, input.closedAt, input.afterEvidence, input.verifiedAt, input.removedAt].some(value => value !== undefined) || ("organizationId" in input && input.organizationId !== DEMO_ORGANIZATION.id);
}

function buildRedTag<T extends Omit<RedTag, "id" | "tagNumber" | "status" | "createdAt" | "history">>(input: T, actor: { id: string; name: string }): RedTag & T {
  load();
  const tagNumber = allocateModuleRecordId("redTag", tags.map(tag => tag.id));
  const createdAt = new Date().toISOString();
  return { ...input, plant: getOrganizationPlant(input.plant)!.name, zone: getOrganizationZone(input.zone)!.name, createdById: actor.id, createdByName: actor.name, id: tagNumber, tagNumber, status: "Open", createdAt,
    history: [history("created", "Red Tag created", actor, createdAt)],
  } as RedTag & T;
}

export function createRedTag<T extends Omit<RedTag, "id" | "tagNumber" | "status" | "createdAt" | "history">>(input: T, user: DemoUser): RedTag & T {
  const actor = getRedTagSessionActor(user.id);
  if (!actor || !canCreateRedTagInZone(actor, input.plant, input.zone) || hasCreationWorkflowInput(input)) throw new Error("You are not authorized to create a Red Tag in this zone or supply workflow metadata.");
  const tag = buildRedTag(input, actor);
  if (!persist([tag, ...tags])) throw new Error("Unable to save this Red Tag. Please try again.");
  return tag;
}

export type CreateRedTagV2Input = Omit<RedTag, "id" | "tagNumber" | "status" | "createdAt" | "history" | "requiredAction" | "responsiblePersonId" | "responsiblePersonName" | "targetDate"> &
  Required<Pick<RedTag, "department" | "imageUrl">>;

function validRedTagCreation(input: CreateRedTagV2Input, user: DemoUser) {
  const actor = getRedTagSessionActor(user.id);
  if (!actor || !canCreateRedTagInZone(actor, input.plant, input.zone) || hasCreationWorkflowInput(input)) return undefined;
  if (!input.itemName?.trim() || !input.remarks?.trim() || !input.department?.trim() || !input.imageUrl?.trim()) return undefined;
  if (input.identificationEvidence && (!input.identificationEvidence.length || input.identificationEvidence.length > MAX_EVIDENCE_IMAGES || input.identificationEvidence[0].url !== input.imageUrl || input.identificationEvidence.some(item => !item.url?.trim()) || new Set(input.identificationEvidence.map(item => item.id)).size !== input.identificationEvidence.length)) return undefined;
  if (!getRedTagDepartments(input.plant).includes(input.department.trim())) return undefined;
  if (input.reason === "Free Text" && !input.customReason?.trim()) return undefined;
  if (input.reasonCategory && !RED_TAG_REASON_GROUPS[input.reasonCategory].includes(input.reason as never)) return undefined;
  if (input.estimatedValue !== undefined && (!Number.isFinite(input.estimatedValue) || input.estimatedValue < 0)) return undefined;
  return actor;
}

export function createRedTagV2(input: CreateRedTagV2Input, user: DemoUser) {
  const actor = validRedTagCreation(input, user);
  if (!actor) return undefined;
  const tag = buildRedTag(input, actor);
  return persist([tag, ...tags]) ? tag : undefined;
}

/** Create and submit in one durable write; invalid/missing leadership never leaves an orphan draft. */
export function createAndSubmitRedTagV2(input: CreateRedTagV2Input, user: DemoUser, reviewer: Pick<DemoUser, "id" | "name">) {
  const actor = validRedTagCreation(input, user);
  const leader = getRedTagZoneLeader(input.plant, input.zone);
  if (!actor || !leader || reviewer.id !== leader.id || leader.id === actor.id) return undefined;
  const draft = buildRedTag(input, actor);
  const tag: RedTag = { ...draft, status: "Under Review", review: { reviewerId: leader.id, reviewerName: leader.name, submittedAt: draft.createdAt },
    history: [...draft.history, history("review_submitted", `Submitted for review to ${leader.name}`, actor, draft.createdAt)] };
  return persist([tag, ...tags]) ? tag : undefined;
}

export function setRedTagHandlingMode(id: string, mode: "direct" | "linked_action", actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || !user || !canManageRedTag(tag, user)) return undefined;
  actor = { ...actor, name: user.name };
  if (!tag || tag.status !== "Decision Made" || !tag.decisionRecord || tag.decisionRecord.type === "keep") return undefined;
  return updateTag(id, (current) => ({ ...current, handlingMode: mode, history: [...current.history, history("disposition_started", mode === "direct" ? "Direct handling selected" : "Linked Action selected", actor)] }));
}

export function clearRedTagHandlingMode(id: string, actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || !user || !canManageRedTag(tag, user)) return undefined;
  actor = { ...actor, name: user.name };
  if (!tag || tag.status !== "Decision Made" || !tag.handlingMode || getRedTagActionIds(tag).length || tag.dispositionDetails) return undefined;
  return updateTag(id, (current) => ({
    ...current,
    handlingMode: undefined,
    history: [...current.history, history("disposition_started", "Handling method selection cleared", actor)],
  }));
}
export function markTagPrinted(id: string, user: DemoUser) {
  load();
  const tag = tags.find((item) => item.id === id);
  if (!tag || tag.history.some((event) => event.type === "printed")) return;
  const next = tags.map((item) => item.id === id ? { ...item, history: [...item.history, {
    id: `RTH-${crypto.randomUUID()}`, type: "printed" as const, label: "Tag printed", actor: user.name, at: new Date().toISOString(),
  }] } : item);
  persist(next);
}

export function linkRedTagAction(id: string, actionId: string, actor: DemoUser) {
  const current = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  const action = getActionById(actionId);
  if (!current || !user || !canLinkRedTagAction(current, user) || !action || action.plant !== current.plant || action.area !== current.zone
    || action.sourceModule !== "redTag" || action.sourceId !== current.id || getRedTagActionIds(current).includes(actionId)) return undefined;
  return updateTag(id, tag => ({ ...tag, actionId: tag.actionId ?? actionId, actionIds: [...getRedTagActionIds(tag), actionId],
    handlingMode: "linked_action", syncedActionStatus: tag.actionId ? tag.syncedActionStatus : action.status,
    history: [...tag.history, history("action_created", `Action ${actionId} created`, user)],
  }));
}

export interface SubmitRedTagForReviewInput {
  reviewerId: string;
  reviewerName: string;
  comments?: string;
}

export function submitRedTagForReview(id: string, input: SubmitRedTagForReviewInput, actor: DemoUser) {
  const tag = getRedTag(id);
  if (!tag || !canTransition(tag.status, "Under Review") || !input.reviewerId || !input.reviewerName.trim()) return undefined;
  const user = getRedTagSessionActor(actor.id);
  const leader = getRedTagZoneLeader(tag.plant, tag.zone);
  if (!user || !canCreateRedTag(user) || !getOrganizationAccess().redTag || !canAccessRedTagZone(user, tag.plant, tag.zone) || !leader || input.reviewerId !== leader.id || leader.id === tag.createdById || !(hasPermission(leader, "red_tag.manage") || hasPermission(leader, "actions.review"))) return undefined;
  input = { ...input, reviewerName: leader.name };
  const now = new Date().toISOString();
  return updateTag(id, (current) => ({
    ...current,
    status: "Under Review",
    review: { reviewerId: input.reviewerId, reviewerName: input.reviewerName.trim(), submittedAt: now, comments: input.comments?.trim() || undefined },
    history: [...current.history, history("review_submitted", `Submitted for review to ${input.reviewerName.trim()}`, actor, now)],
  }));
}

export interface RecordRedTagDecisionInput {
  decision: RedTagDecision;
  comments?: string;
}

export function recordRedTagDecision(id: string, input: RecordRedTagDecisionInput, actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || !user || !canReviewRedTag(tag, user) || !canTransition(tag.status, "Decision Made") || !tag.review || !RED_TAG_DECISIONS.includes(input.decision)) return undefined;
  actor = { ...actor, name: user.name };
  const now = new Date().toISOString();
  const comments = input.comments?.trim() || tag.review.comments;
  return updateTag(id, (current) => ({
    ...current,
    status: "Decision Made",
    review: { ...current.review!, reviewedAt: now, comments },
    decisionRecord: { type: input.decision, decidedAt: now, decidedByUserId: actor.id, decidedByName: actor.name, comments },
    history: [...current.history, history("reviewed", "Red Tag review completed", actor, now), history("decision_recorded", `Decision recorded: ${input.decision}`, actor, now)],
  }));
}

export function canAmendRedTagDecision(tag: RedTag, actor: DemoUser) {
  const user = getRedTagSessionActor(actor.id);
  return Boolean(user && canReviewRedTag(tag, user) && tag.status === "Decision Made" && tag.decisionRecord
    && !tag.keepConfirmation && !tag.closure && !tag.dispositionDetails
    && getRedTagActionIds(tag).length === 0 && getLinkedRedTagActions(tag, getActions()).length === 0);
}

function previousDecisionLabel(tag: RedTag) {
  const decision = tag.decisionRecord!;
  return `${decision.type} by ${decision.decidedByName} at ${decision.decidedAt}${decision.comments ? `; comments: ${decision.comments}` : ""}`;
}

export function amendRedTagDecision(id: string, input: RecordRedTagDecisionInput, expectedDecisionAt: string, actor: DemoUser) {
  const tag = getRedTag(id);
  if (!tag || !canAmendRedTagDecision(tag, actor) || tag.decisionRecord?.decidedAt !== expectedDecisionAt
    || !RED_TAG_DECISIONS.includes(input.decision) || input.decision === "keep") return undefined;
  const comments = input.comments?.trim() || undefined;
  // An authorized unchanged edit succeeds without a write or duplicate history event.
  if (tag.decisionRecord.type === input.decision && tag.decisionRecord.comments === comments) return tag;
  const user = getRedTagSessionActor(actor.id)!;
  const now = new Date().toISOString();
  return updateTag(id, current => ({ ...current, handlingMode: undefined,
    review: { ...current.review!, reviewedAt: now, comments },
    decisionRecord: { type: input.decision, decidedAt: now, decidedByUserId: user.id, decidedByName: user.name, comments },
    history: [...current.history, history("decision_updated", `Decision updated from ${previousDecisionLabel(current)} to ${input.decision}${comments ? `; comments: ${comments}` : ""}`, { ...actor, name: user.name }, now)],
  }));
}

export interface StartRedTagDispositionInput {
  responsiblePersonId: string;
  responsiblePersonName: string;
  targetDate: string;
  executionNotes?: string;
  approval?: { approved: boolean; approvedAt: string; approvedByUserId: string; approvedByName: string; comment?: string };
}

export function startRedTagDisposition(id: string, input: StartRedTagDispositionInput, actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || !user || !canManageRedTag(tag, user)) return undefined;
  actor = { ...actor, name: user.name };
  if (!tag || !canTransition(tag.status, "Disposition In Progress") || !tag.decisionRecord) return undefined;
  if (["keep", "further_evaluation"].includes(tag.decisionRecord.type)) return undefined;
  if (!input.responsiblePersonId || !input.responsiblePersonName.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate) || !input.executionNotes?.trim()) return undefined;
  const now = new Date().toISOString();
  return updateTag(id, (current) => ({
    ...current,
    status: "Disposition In Progress",
    dispositionDetails: {
      decision: current.decisionRecord!.type,
      responsiblePersonId: input.responsiblePersonId,
      responsiblePersonName: input.responsiblePersonName.trim(),
      targetDate: input.targetDate,
      startedAt: now,
      startedByUserId: actor.id,
      startedByName: actor.name,
      executionNotes: input.executionNotes?.trim() || undefined,
      evidence: [],
      approval: input.approval,
    },
    history: [...current.history, history("disposition_started", "Disposition started", actor, now)],
  }));
}

export interface CompleteRedTagDispositionInput {
  evidence: RedTagEvidence[];
  completionNotes?: string;
  responsibleConfirmed?: boolean;
}

export function completeRedTagDisposition(id: string, evidenceOrInput: RedTagEvidence[] | CompleteRedTagDispositionInput, actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || !user || !canManageRedTag(tag, user)) return undefined;
  actor = { ...actor, name: user.name };
  if (!tag || !canTransition(tag.status, "Closed") || !tag.decisionRecord || !tag.dispositionDetails || !tag.imageUrl?.trim()) return undefined;
  if (["keep", "further_evaluation"].includes(tag.decisionRecord.type)) return undefined;
  if (!tag.dispositionDetails.responsiblePersonId || !tag.dispositionDetails.responsiblePersonName.trim() || !tag.dispositionDetails.targetDate || !tag.dispositionDetails.executionNotes?.trim()) return undefined;
  const linkedIds = getRedTagActionIds(tag);
  const linked = getLinkedRedTagActions(tag, getActions());
  if ((tag.handlingMode === "linked_action" && !linked.length) || linkedIds.some(actionId => !linked.some(action => action.id === actionId)) || linked.some(action => action.status !== "Completed")) return undefined;
  const input = Array.isArray(evidenceOrInput) ? { evidence: evidenceOrInput } : evidenceOrInput;
  if (!input.evidence.length || !input.completionNotes?.trim() || input.responsibleConfirmed !== true) return undefined;
  const now = new Date().toISOString();
  return updateTag(id, (current) => ({
    ...current,
    status: "Closed",
    closedAt: now,
    dispositionDetails: { ...current.dispositionDetails!, completedAt: now, completedByUserId: actor.id, completedByName: actor.name, completionNotes: input.completionNotes?.trim() || undefined, responsibleConfirmed: input.responsibleConfirmed, evidence: mergeRedTagEvidence(current.dispositionDetails!.evidence, input.evidence) },
    afterEvidence: mergeRedTagEvidence(current.afterEvidence ?? [], input.evidence),
    history: [...current.history, history("disposition_completed", "Disposition completed", actor, now), history("closed", "Red Tag closed", actor, now)],
  }));
}

function mergeRedTagEvidence(existing: RedTagEvidence[], incoming: RedTagEvidence[]) {
  const byId = new Map(existing.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()];
}

export interface VerifyRedTagDispositionInput {
  passed: boolean;
  details: string;
  evidence?: RedTagEvidence[];
}

export function verifyRedTagDisposition(id: string, input: VerifyRedTagDispositionInput, actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || tag.createdById === actor.id || !user || !canManageRedTag(tag, user)) return undefined;
  actor = { ...actor, name: user.name };
  const readyForVerification = tag?.decisionRecord?.type === "keep" ? Boolean(tag.keepConfirmation) : Boolean(tag?.dispositionDetails?.completedAt);
  if (!allLinkedActionsComplete(tag) || tag.decisionRecord?.type === "further_evaluation" || tag.status !== "Awaiting Verification" || !readyForVerification || !input.details.trim()) return undefined;
  const afterEvidence = [...(tag.afterEvidence ?? []), ...(input.evidence ?? [])];
  if (input.passed && (!tag.imageUrl?.trim() || !afterEvidence.length)) return undefined;
  const now = new Date().toISOString();
  return updateTag(id, (current) => ({
    ...current,
    afterEvidence,
    closure: { verificationResult: input.passed ? "Passed" : "Failed", verificationDetails: input.details.trim(), verifiedAt: now, verifiedByUserId: actor.id, verifiedByName: actor.name, evidence: input.evidence ?? [] },
    history: [...current.history, history(input.passed ? "verified" : "verification_failed", input.passed ? "Disposition verified" : "Disposition verification failed", actor, now)],
  }));
}

export function confirmRedTagKeep(id: string, justification: string, actor: DemoUser, expectedDecisionAt?: string) {
  const tag = getRedTag(id);
  const confirmer = getAdminUser(actor.id);
  const directReview = tag?.status === "Under Review" && tag.review?.reviewerId === actor.id && !tag.decisionRecord;
  const historicalDecision = tag?.status === "Decision Made" && tag.decisionRecord?.type === "keep";
  const amendedDecision = Boolean(expectedDecisionAt && tag && tag.decisionRecord?.decidedAt === expectedDecisionAt && tag.decisionRecord.type !== "keep" && canAmendRedTagDecision(tag, actor));
  if (!tag || (!directReview && !historicalDecision && !amendedDecision) || tag.keepConfirmation || !justification.trim()) return undefined;
  if (getCurrentDemoUser().id !== actor.id || confirmer?.status !== "Active" || !canReviewRedTag(tag, confirmer)) return undefined;
  const confirmedActor = { ...actor, name: confirmer.name };
  const now = new Date().toISOString();
  return updateTag(id, (current) => ({
    ...current,
    status: "Closed",
    closedAt: now,
    review: directReview || amendedDecision ? { ...current.review!, reviewedAt: now } : current.review,
    decisionRecord: directReview || amendedDecision ? { type: "keep", decidedAt: now, decidedByUserId: confirmedActor.id, decidedByName: confirmedActor.name } : current.decisionRecord,
    handlingMode: amendedDecision ? undefined : current.handlingMode,
    keepConfirmation: { justification: justification.trim(), confirmedAt: now, confirmedByUserId: actor.id, confirmedByName: confirmedActor.name },
    history: [...current.history, ...(amendedDecision ? [history("decision_updated", `Decision updated from ${previousDecisionLabel(current)} to keep`, confirmedActor, now)] : []), ...(directReview ? [history("reviewed", "Red Tag review completed", confirmedActor, now), history("decision_recorded", "Decision recorded: keep", confirmedActor, now)] : []), history("keep_confirmed", "Keep decision confirmed", confirmedActor, now), history("closed", "Red Tag closed after Keep confirmation", confirmedActor, now)],
  }));
}

export function updateFurtherEvaluationDecision(id: string, decision: Exclude<RedTagDecision, "further_evaluation">, comments: string | undefined, actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || !user || !canReviewRedTag(tag, user) || tag.status !== "Decision Made" || tag.decisionRecord?.type !== "further_evaluation" || !RED_TAG_DECISIONS.includes(decision)) return undefined;
  actor = { ...actor, name: user.name };
  const now = new Date().toISOString();
  return updateTag(id, (current) => ({
    ...current,
    decisionRecord: { type: decision, decidedAt: now, decidedByUserId: actor.id, decidedByName: actor.name, comments: comments?.trim() || undefined },
    history: [...current.history, history("decision_updated", `Decision updated from Further Evaluation to ${decision}`, actor, now)],
  }));
}

function allLinkedActionsComplete(tag: RedTag) {
  const ids = getRedTagActionIds(tag);
  const linked = getLinkedRedTagActions(tag, getActions());
  return (tag.handlingMode !== "linked_action" || linked.length > 0) && ids.every(id => linked.some(action => action.id === id)) && linked.every(action => action.status === "Completed");
}

export function closeRedTag(id: string, actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || !user || !canManageRedTag(tag, user)) return undefined;
  actor = { ...actor, name: user.name };
  if (!tag || !allLinkedActionsComplete(tag) || tag.decisionRecord?.type === "keep" || !canTransition(tag.status, "Closed") || tag.closure?.verificationResult !== "Passed" || !tag.imageUrl?.trim() || !(tag.afterEvidence?.length)) return undefined;
  const now = new Date().toISOString();
  return updateTag(id, (current) => ({
    ...current,
    status: "Closed",
    closedAt: now,
    closure: { ...current.closure!, closedAt: now, closedByUserId: actor.id, closedByName: actor.name },
    history: [...current.history, history("closed", "Red Tag closed", actor, now)],
  }));
}

function isActiveActionStatus(status: MyActionStatus) {
  return ["In Progress", "Overdue", "Pending Review", "Pending Auditor Review", "Awaiting Review", "Rework Required"].includes(status);
}

export function reconcileRedTagActions(actions: MyAction[]) {
  if (!canWriteLegacyOperational("redTag")) return false;
  load();
  let changed = false;
  const system = { id: "SYSTEM", name: "OPS" } as DemoUser;
  const next = tags.map(tag => {
    if (getRecordTombstone("redTag", tag.id)) return tag;
    if (tag.status === "Closed") return tag;
    const linked = getLinkedRedTagActions(tag, actions);
    if (!linked.length) return tag;
    const isLegacyExecution = !tag.review && !tag.decisionRecord && Boolean(tag.requiredAction || tag.responsiblePersonId || tag.targetDate);
    const ids = getRedTagActionIds(tag);
    const allCompleted = linked.every(action => action.status === "Completed") && ids.every(id => linked.some(action => action.id === id));
    const first = linked.find(action => action.id === tag.actionId) ?? linked[0];
    let updated: RedTag = tag;
    if (first.status !== tag.syncedActionStatus) updated = { ...updated, syncedActionStatus: first.status };
    if (allCompleted && tag.handlingMode === "linked_action" && tag.decisionRecord && !["keep", "further_evaluation"].includes(tag.decisionRecord.type)) {
      const completionEvidence: RedTagEvidence[] = linked.flatMap(action => action.evidence.filter(item => item.type === "image" && Boolean(item.url || item.storageKey))
        .map(item => ({ id: item.id, name: item.name, url: item.url ?? "", ...(item.storageKey ? { storageKey: item.storageKey } : {}), mimeType: item.mimeType, uploadedBy: item.uploadedBy, uploadedAt: item.uploadedAt })));
      const merged = mergeRedTagEvidence(tag.afterEvidence ?? [], completionEvidence);
      if (tag.status !== "Disposition In Progress" || merged.length !== (tag.afterEvidence ?? []).length || !tag.dispositionDetails) {
        updated = { ...updated, status: "Disposition In Progress", afterEvidence: merged,
          dispositionDetails: tag.dispositionDetails ?? { decision: tag.decisionRecord.type,
            responsiblePersonId: first.responsiblePersonId ?? "LEGACY-ACTION-OWNER", responsiblePersonName: first.responsiblePersonName ?? first.assignedTo,
            targetDate: first.dueDate, startedAt: first.createdAt, startedByUserId: first.createdByUserId ?? "SYSTEM", startedByName: first.createdByName ?? first.auditor ?? "OPS", executionNotes: first.description, evidence: completionEvidence },
          history: [...tag.history, history("disposition_started", `All ${linked.length} linked Actions completed; completion evidence imported`, system)] };
      }
    } else if (allCompleted && isLegacyExecution && tag.status !== "Awaiting Verification") {
      updated = { ...updated, status: "Awaiting Verification", history: [...tag.history, history("awaiting_verification", "All linked Actions completed; awaiting physical verification", system)] };
    } else if (isLegacyExecution && tag.status === "Open" && linked.some(action => isActiveActionStatus(action.status))) {
      updated = { ...updated, status: "In Progress", history: [...tag.history, history("started", "Linked Action in progress", system)] };
    }
    if (updated !== tag) changed = true;
    return updated;
  });
  return changed ? persist(next) : false;
}

export function addRedTagAfterEvidence(id: string, evidence: RedTagEvidence[], actor: DemoUser) {
  if (!evidence.length) return undefined;
  const tag = getRedTag(id);
  if (!tag || tag.status === "Closed") return undefined;
  return updateTag(id, (tag) => ({
    ...tag,
    afterEvidence: [...(tag.afterEvidence ?? []), ...evidence],
    history: [...tag.history, history("started", `${evidence.length} after-evidence photo${evidence.length === 1 ? "" : "s"} added`, actor)],
  }));
}

export interface VerifyRedTagInput {
  disposition: RedTagDisposition;
  dispositionNote?: string;
  verificationRemark: string;
}

export function verifyRedTag(id: string, action: MyAction | undefined, input: VerifyRedTagInput, actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || tag.createdById === actor.id || !user || !canManageRedTag(tag, user)) return undefined;
  actor = { ...actor, name: user.name };
  // Phase 3A keeps this client-specific verifier only for legacy records. V2
  // records must use verifyRedTagDisposition(), which enforces completed disposition.
  if (tag?.decisionRecord || tag?.dispositionDetails || (tag && !allLinkedActionsComplete(tag))) return undefined;
  if (!tag || tag.status !== "Awaiting Verification" || !tag.actionId || action?.id !== tag.actionId || action.status !== "Completed") return undefined;
  if (!(tag.afterEvidence?.length) || !input.disposition || !input.verificationRemark.trim()) return undefined;
  if (input.disposition === "Other" && !input.dispositionNote?.trim()) return undefined;
  const now = new Date().toISOString();
  return updateTag(id, (current) => ({
    ...current,
    disposition: input.disposition,
    dispositionNote: input.dispositionNote?.trim() || undefined,
    verificationRemark: input.verificationRemark.trim(),
    verifiedByUserId: actor.id,
    verifiedByName: actor.name,
    verifiedAt: now,
    history: [...current.history, history("verified", "Physical condition and disposition verified", actor)],
  }));
}

export function closeRedTagAfterRemoval(id: string, action: MyAction | undefined, removalConfirmed: boolean, actor: DemoUser) {
  const tag = getRedTag(id);
  const user = getRedTagSessionActor(actor.id);
  if (!tag || !user || !canManageRedTag(tag, user)) return undefined;
  actor = { ...actor, name: user.name };
  // Legacy compatibility only; V2 closure goes through closeRedTag().
  if (tag?.decisionRecord || tag?.dispositionDetails || (tag && !allLinkedActionsComplete(tag))) return undefined;
  if (!tag || tag.status !== "Awaiting Verification" || !tag.actionId || action?.id !== tag.actionId || action.status !== "Completed") return undefined;
  if (!tag.imageUrl?.trim() || !tag.verifiedAt || !tag.verificationRemark || !tag.disposition || !(tag.afterEvidence?.length) || !removalConfirmed) return undefined;
  const now = new Date().toISOString();
  return updateTag(id, (current) => ({
    ...current,
    status: "Closed",
    removalConfirmed: true,
    removedByUserId: actor.id,
    removedByName: actor.name,
    removedAt: now,
    closedAt: now,
    history: [...current.history, history("removed", "Physical Red Tag removal confirmed", actor), history("closed", "Red Tag closed", actor)],
  }));
}

registerRecordCreationStore(RED_TAG_STORAGE_KEY, () => { loaded = false; load(); });

registerActionCreationSource("redTag", (input, user) => {
  const tag = input.sourceId ? getRedTag(input.sourceId) : undefined;
  return { record: tag, zone: tag?.zone, permitted: Boolean(tag && canLinkRedTagAction(tag, user)) };
});

registerDeletionSource("redTag", id => { load(); const item = tags.find(item => item.id === id); return item ? { id: item.id, title: item.itemName, organizationId: "organizationId" in item && typeof item.organizationId === "string" ? item.organizationId : undefined, plant: item.plant, zone: item.zone, aliases: [item.tagNumber], linkedActionIds: [...(item.actionIds ?? []), ...(item.actionId ? [item.actionId] : [])] } : undefined; });
export function getRedTagEvidenceArchive() { load(); return tags; }
