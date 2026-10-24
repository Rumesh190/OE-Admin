"use client";
import { requireLegacyOperationalWrite } from "@/lib/legacy-operational-write";
import { hasPlatformLegacyOperationalAccess } from "@/lib/platform-operational-access";
import { activeOperationalRecords, useActiveOperationalRecords, getRecordTombstone, registerDeletionSource } from "@/lib/records/record-tombstones";


import { registerActionCreationSource } from "@/lib/actions/action-source-access";

import { allocateModuleRecordId, registerRecordCreationStore } from "@/lib/records/module-records";

import { useSyncExternalStore } from "react";
import { ORGANIZATION_ZONE_SEEDS } from "@/lib/organization-store";
import { selectableImprovementOwners } from "./owner";
import { canCreateDemoModuleRecord } from "@/lib/demo/demo-module-creation";
import { getAdminUser } from "@/features/five-s/administration/store";
import { safeSetStorage, safeSetStorageString, STORAGE_FULL_MESSAGE } from "@/lib/browser-storage";
import type { DemoUser } from "@/lib/current-user";
import { getFiveSZoneConfiguration } from "@/lib/five-s/configuration";
import { createNotification } from "@/lib/notifications/notification-store";
import { getActionById } from "@/lib/actions/action-store";
import {
  canCompleteReview,
  canCreateImprovementAction,
  canEditProposal,
  canImplementImprovement,
  canReviewProposal,
  canViewImprovement,
} from "./access";
import { IMPROVEMENT_STATUSES, matchesImprovementQuickFilter } from "./config";
import type {
  ContinuousImprovement,
  CreateImprovementInput,
  ImplementationUpdateInput,
  ImprovementActor,
  ImprovementEvent,
  ImprovementEventType,
  ImprovementEvidence,
  ImprovementStatus,
  ProposalUpdateInput,
} from "./types";

export const CONTINUOUS_IMPROVEMENT_STORAGE_KEY = "five-s-continuous-improvements-v1";
const STORAGE_KEY = CONTINUOUS_IMPROVEMENT_STORAGE_KEY;
const FIXTURE_VERSION_KEY = "five-s-continuous-improvements-fixture-version";
const FIXTURE_VERSION = "ops-ci-workflow-v2";

const before = (id: string, name: string, uploadedBy: string, at: string): ImprovementEvidence => ({ id, name, url: "/demo-5s/not-good-example.png", uploadedAt: at, uploadedBy, mimeType: "image/png", caption: name });
const after = (id: string, name: string, uploadedBy: string, at: string): ImprovementEvidence => ({ id, name, url: "/demo-5s/good-example.png", uploadedAt: at, uploadedBy, mimeType: "image/png", caption: name });
const seedEvent = (id: string, type: ImprovementEventType, actorId: string, actorName: string, at: string, remark?: string): ImprovementEvent => ({ id, type, actorId, actorName, at, remark });

function seed(input: Partial<ContinuousImprovement> & Pick<ContinuousImprovement, "id" | "title" | "status" | "createdAt">): ContinuousImprovement {
  const zone = input.zone ?? "Zone B";
  const zoneConfig = ORGANIZATION_ZONE_SEEDS.find(item => item.name === zone)!;
  const proposedById = input.proposedById ?? "USR-SIVA-KUMAR";
  const proposedByName = input.proposedByName ?? "Siva Kumar";
  const ownerId = input.ownerId ?? proposedById;
  const ownerName = input.ownerName ?? proposedByName;
  const memberIds = input.memberIds ?? [ownerId];
  const memberNames = input.memberNames ?? [ownerName];
  const beforeEvidence = input.beforeEvidence ?? input.existingPhotos ?? [];
  const afterEvidence = input.afterEvidence ?? input.evidence ?? [];
  return {
    plant: "Egmore Plant",
    zone,
    zoneCode: zoneConfig.code,
    zoneLeaderId: zoneConfig.leaderId,
    zoneLeaderName: zoneConfig.leaderName,
    issueDescription: "The current method adds avoidable motion and makes the work less consistent.",
    proposedImprovement: "Rearrange the point of use and introduce a clear visual standard.",
    expectedBenefit: "Reduce handling time and make the improved method easier to sustain.",
    benefitType: "Productivity Benefit",
    estimatedTime: 2,
    estimatedTimeUnit: "Days",
    proposedById,
    proposedByName,
    ownerId,
    ownerName,
    memberIds,
    memberNames,
    participants: memberIds.map((id, index) => ({ id, name: memberNames[index] ?? id })),
    actionIds: [],
    updatedAt: input.createdAt,
    timeline: [seedEvent(`${input.id}-CREATED`, "created", proposedById, proposedByName, input.createdAt)],
    ...input,
    proposedSaving: input.proposedSaving ?? 0,
    beforeEvidence,
    afterEvidence,
    existingPhotos: beforeEvidence,
    evidence: afterEvidence,
  };
}

export const CONTINUOUS_IMPROVEMENT_SEED_RECORDS: readonly ContinuousImprovement[] = [
  seed({
    id: "CI-2026-014", title: "Reduce material movement in packing area", status: "under_review", createdAt: "2026-09-12T08:40:00+05:30", updatedAt: "2026-09-12T10:00:00+05:30",
    issueDescription: "Packing operators walk to a shared material rack for every batch, adding repeated handling and queueing.", proposedImprovement: "Move high-use packing materials to a controlled point-of-use rack and add replenishment markers.", expectedBenefit: "Reduce material travel and stabilize packing cycle time.", benefitType: "Cost Saving", proposedSaving: 18000, estimatedTime: 2, estimatedTimeUnit: "Weeks", memberIds: ["USR-SIVA-KUMAR", "USR-RAMAN"], memberNames: ["Siva Kumar", "Raman"], participants: [{ id: "USR-SIVA-KUMAR", name: "Siva Kumar" }, { id: "USR-RAMAN", name: "Raman" }], beforeEvidence: [before("CI-014-BEFORE", "Packing material travel path", "Siva Kumar", "2026-09-12T08:35:00+05:30")], submittedAt: "2026-09-12T09:00:00+05:30", reviewerId: "USR-RUMESH", reviewerName: "Rumesh", timeline: [seedEvent("CI-014-C", "created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-12T08:40:00+05:30"), seedEvent("CI-014-S", "submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-12T09:00:00+05:30"), seedEvent("CI-014-R", "review_started", "USR-RUMESH", "Rumesh", "2026-09-12T10:00:00+05:30")],
  }),
  seed({
    id: "CI-2026-013", title: "Introduce ergonomic lift table at sub-assembly", status: "in_progress", createdAt: "2026-09-08T09:15:00+05:30", updatedAt: "2026-09-13T14:10:00+05:30",
    issueDescription: "Operators repeatedly lift trays from floor-level dollies to the assembly fixture.", proposedImprovement: "Trial an adjustable lift table and document the correct working height.", expectedBenefit: "Reduce manual lifting exposure and improve operator comfort.", benefitType: "Safety Benefit", proposedSaving: 0, estimatedTime: 3, estimatedTimeUnit: "Weeks", reviewDecision: "approved", reviewRemark: "Proceed with the controlled trial and capture operator feedback.", reviewedAt: "2026-09-09T10:30:00+05:30", reviewedById: "USR-RUMESH", reviewedByName: "Rumesh", reviewerId: "USR-RUMESH", reviewerName: "Rumesh", startedAt: "2026-09-10T08:20:00+05:30", implementationProcess: "Lift table trial started on the day shift with baseline handling observations recorded.", progressNotes: "Two operators have completed the first feedback cycle.", actionIds: ["ACT-CI-013-01", "ACT-CI-013-02"], beforeEvidence: [before("CI-013-BEFORE", "Floor-level tray handling", "Siva Kumar", "2026-09-08T09:10:00+05:30")], timeline: [seedEvent("CI-013-C", "created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-08T09:15:00+05:30"), seedEvent("CI-013-S", "submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-08T09:30:00+05:30"), seedEvent("CI-013-A", "approved", "USR-RUMESH", "Rumesh", "2026-09-09T10:30:00+05:30", "Proceed with the controlled trial and capture operator feedback."), seedEvent("CI-013-I", "started", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-10T08:20:00+05:30"), seedEvent("CI-013-L1", "action_created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-10T09:00:00+05:30", "ACT-CI-013-01"), seedEvent("CI-013-L2", "action_created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-10T09:10:00+05:30", "ACT-CI-013-02")],
  }),
  seed({
    id: "CI-2026-012", title: "Standardize changeover tool preparation", status: "awaiting_completion_review", createdAt: "2026-09-04T11:00:00+05:30", updatedAt: "2026-09-13T16:20:00+05:30",
    issueDescription: "Changeover tools are collected after the line stops, extending planned downtime.", proposedImprovement: "Prepare a model-specific tool trolley before each changeover using a visual checklist.", expectedBenefit: "Shorten changeover duration and reduce missing-tool delays.", benefitType: "Time Saving", proposedSaving: 12000, estimatedTime: 1, estimatedTimeUnit: "Weeks", implementationProcess: "Built the trolley standard, trialled it on three changeovers, and updated the checklist after operator feedback.", actionTaken: "Released one labelled changeover trolley with model-specific shadow locations.", actualBenefit: "Average tool preparation delay reduced by 14 minutes per changeover.", actualSaving: 14600, reviewDecision: "approved", reviewRemark: "Validate on three consecutive changeovers.", reviewedAt: "2026-09-05T09:00:00+05:30", reviewedById: "USR-RUMESH", reviewedByName: "Rumesh", completionSubmittedAt: "2026-09-13T16:20:00+05:30", beforeEvidence: [before("CI-012-BEFORE", "Unprepared changeover tools", "Siva Kumar", "2026-09-04T10:55:00+05:30")], afterEvidence: [after("CI-012-AFTER", "Prepared changeover trolley", "Raman", "2026-09-13T16:10:00+05:30")], timeline: [seedEvent("CI-012-C", "created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-04T11:00:00+05:30"), seedEvent("CI-012-S", "submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-04T11:15:00+05:30"), seedEvent("CI-012-A", "approved", "USR-RUMESH", "Rumesh", "2026-09-05T09:00:00+05:30"), seedEvent("CI-012-I", "started", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-06T08:00:00+05:30"), seedEvent("CI-012-CS", "completion_submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-13T16:20:00+05:30")],
  }),
  seed({
    id: "CI-2026-011", title: "Create point-of-use fastener storage", status: "completed", createdAt: "2026-08-27T08:45:00+05:30", updatedAt: "2026-09-10T15:30:00+05:30",
    issueDescription: "Operators travel approximately 20 metres to retrieve frequently used fasteners.", proposedImprovement: "Move high-use fasteners beside the workstation with labelled min/max locations.", expectedBenefit: "Reduce retrieval time and material handling.", benefitType: "Cost Saving", proposedSaving: 18000, estimatedTime: 2, estimatedTimeUnit: "Days", implementationProcess: "Observed usage, selected the highest-frequency fasteners, and validated the new locations on both shifts.", actionTaken: "Installed a labelled point-of-use rack and introduced min/max stock markers.", actualBenefit: "Handling time reduced by 18% and stock-outs were eliminated during the trial.", actualSaving: 21500, reviewDecision: "approved", reviewRemark: "Maintain the replenishment check for four weeks.", reviewedAt: "2026-08-28T10:15:00+05:30", reviewedById: "USR-RUMESH", reviewedByName: "Rumesh", completionSubmittedAt: "2026-09-10T14:45:00+05:30", completionReviewRemark: "Result verified at the workstation.", completionReviewedAt: "2026-09-10T15:30:00+05:30", completionReviewedById: "USR-RUMESH", completionReviewedByName: "Rumesh", completedAt: "2026-09-10T15:30:00+05:30", completedById: "USR-RUMESH", completedByName: "Rumesh", beforeEvidence: [before("CI-011-BEFORE", "Remote fastener rack", "Siva Kumar", "2026-08-27T08:40:00+05:30")], afterEvidence: [after("CI-011-AFTER", "Point-of-use fastener rack", "Siva Kumar", "2026-09-10T14:40:00+05:30")], timeline: [seedEvent("CI-011-C", "created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-08-27T08:45:00+05:30"), seedEvent("CI-011-S", "submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-08-27T09:00:00+05:30"), seedEvent("CI-011-A", "approved", "USR-RUMESH", "Rumesh", "2026-08-28T10:15:00+05:30"), seedEvent("CI-011-I", "started", "USR-SIVA-KUMAR", "Siva Kumar", "2026-08-29T08:30:00+05:30"), seedEvent("CI-011-CS", "completion_submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-10T14:45:00+05:30"), seedEvent("CI-011-D", "completed", "USR-RUMESH", "Rumesh", "2026-09-10T15:30:00+05:30", "Result verified at the workstation.")],
  }),
  seed({
    id: "CI-2026-010", title: "Relocate inspection gauge cabinet", status: "on_hold", createdAt: "2026-09-06T08:30:00+05:30", updatedAt: "2026-09-07T12:10:00+05:30",
    issueDescription: "The gauge cabinet location causes cross-traffic between inspection and assembly.", proposedImprovement: "Move the cabinet to the inspection boundary and create a controlled return point.", expectedBenefit: "Reduce walking and protect calibrated equipment.", benefitType: "Quality Benefit", proposedSaving: 4500, estimatedTime: 2, estimatedTimeUnit: "Weeks", reviewDecision: "on_hold", reviewRemark: "Confirm metrology environmental requirements before moving the cabinet.", holdReason: "Confirm metrology environmental requirements before moving the cabinet.", heldAt: "2026-09-07T12:10:00+05:30", heldById: "USR-RUMESH", heldByName: "Rumesh", reviewedAt: "2026-09-07T12:10:00+05:30", reviewedById: "USR-RUMESH", reviewedByName: "Rumesh", timeline: [seedEvent("CI-010-C", "created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-06T08:30:00+05:30"), seedEvent("CI-010-S", "submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-06T08:45:00+05:30"), seedEvent("CI-010-H", "on_hold", "USR-RUMESH", "Rumesh", "2026-09-07T12:10:00+05:30", "Confirm metrology environmental requirements before moving the cabinet.")],
  }),
  seed({
    id: "CI-2026-009", title: "Remove final inspection checkpoint", status: "rejected", createdAt: "2026-09-03T10:20:00+05:30", updatedAt: "2026-09-04T15:00:00+05:30",
    issueDescription: "The final inspection checkpoint adds queue time before dispatch.", proposedImprovement: "Remove the checkpoint and rely only on operator self-inspection.", expectedBenefit: "Reduce dispatch lead time.", benefitType: "Time Saving", proposedSaving: 9000, estimatedTime: 1, estimatedTimeUnit: "Weeks", reviewDecision: "rejected", reviewRemark: "Customer control plan requires independent final inspection; propose reducing the inspection queue instead.", reviewedAt: "2026-09-04T15:00:00+05:30", reviewedById: "USR-RUMESH", reviewedByName: "Rumesh", timeline: [seedEvent("CI-009-C", "created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-03T10:20:00+05:30"), seedEvent("CI-009-S", "submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-03T10:30:00+05:30"), seedEvent("CI-009-R", "rejected", "USR-RUMESH", "Rumesh", "2026-09-04T15:00:00+05:30", "Customer control plan requires independent final inspection; propose reducing the inspection queue instead.")],
  }),
  seed({
    id: "CI-2026-008", title: "Add visual replenishment markers to consumables", status: "approved", zone: "Zone A", zoneCode: "ZA", zoneLeaderId: "USR-LAKSHMAN", zoneLeaderName: "Lakshman", proposedById: "USR-RITIKA", proposedByName: "Ritika", ownerId: "USR-RITIKA", ownerName: "Ritika", memberIds: ["USR-RITIKA", "USR-JAMES"], memberNames: ["Ritika", "James"], participants: [{ id: "USR-RITIKA", name: "Ritika" }, { id: "USR-JAMES", name: "James" }], createdAt: "2026-09-11T09:00:00+05:30", updatedAt: "2026-09-12T11:20:00+05:30", issueDescription: "Consumable bins are replenished only after operators discover they are empty.", proposedImprovement: "Add visible minimum levels and a two-bin replenishment trigger.", expectedBenefit: "Prevent shortages and reduce interruption time.", benefitType: "Productivity Benefit", proposedSaving: 7200, estimatedTime: 4, estimatedTimeUnit: "Days", reviewDecision: "approved", reviewRemark: "Start with the five highest-use consumables.", reviewedAt: "2026-09-12T11:20:00+05:30", reviewedById: "USR-LAKSHMAN", reviewedByName: "Lakshman", timeline: [seedEvent("CI-008-C", "created", "USR-RITIKA", "Ritika", "2026-09-11T09:00:00+05:30"), seedEvent("CI-008-S", "submitted", "USR-RITIKA", "Ritika", "2026-09-11T09:15:00+05:30"), seedEvent("CI-008-A", "approved", "USR-LAKSHMAN", "Lakshman", "2026-09-12T11:20:00+05:30", "Start with the five highest-use consumables.")],
  }),
  seed({ id: "CI-2026-007", title: "Reduce label roll change time", status: "submitted", createdAt: "2026-09-13T12:20:00+05:30", updatedAt: "2026-09-13T12:35:00+05:30", issueDescription: "Replacement label rolls are stored away from the packing printer.", proposedImprovement: "Create a controlled label-roll location beside the printer.", expectedBenefit: "Reduce printer idle time during roll changes.", benefitType: "Time Saving", proposedSaving: 3200, estimatedTime: 2, estimatedTimeUnit: "Days", submittedAt: "2026-09-13T12:35:00+05:30", timeline: [seedEvent("CI-007-C", "created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-13T12:20:00+05:30"), seedEvent("CI-007-S", "submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-13T12:35:00+05:30")] }),
  seed({ id: "CI-2026-006", title: "Improve empty-bin return route", status: "draft", createdAt: "2026-09-14T08:10:00+05:30", issueDescription: "Empty bins cross the supplied-material route during peak replenishment.", proposedImprovement: "Trial a one-way empty-bin return route.", expectedBenefit: "Reduce aisle congestion.", benefitType: "Safety Benefit", proposedSaving: undefined, estimatedTime: 3, estimatedTimeUnit: "Days" }),
  seed({
    id: "CI-EGM-ZB-001", title: "Reduce material retrieval time near assembly rack", status: "completed", createdAt: "2026-08-27T08:45:00+05:30", updatedAt: "2026-08-27T14:30:00+05:30", issueDescription: "Operators walk approximately 20 metres to retrieve frequently used fasteners, increasing assembly cycle time.", proposedImprovement: "Move frequently used fasteners closer to the workstation and maintain clear min/max stock levels.", expectedBenefit: "Reduce retrieval time and improve material availability.", benefitType: "Cost Saving", proposedSaving: 10000, estimatedTime: 2, estimatedTimeUnit: "Hours", memberIds: ["USR-SIVA-KUMAR", "USR-RAMAN"], memberNames: ["Siva Kumar", "Raman"], participants: [{ id: "USR-SIVA-KUMAR", name: "Siva Kumar" }, { id: "USR-RAMAN", name: "Raman" }], reviewDecision: "approved", reviewRemark: "Approved. Move the frequently used material closer to the workstation and maintain clear min/max stock levels.", reviewedAt: "2026-08-27T10:15:00+05:30", reviewedById: "USR-RUMESH", reviewedByName: "Rumesh", implementationProcess: "Reviewed retrieval frequency and installed the most-used bins at point of use.", actionTaken: "Moved frequently used fasteners to a labelled rack beside the workstation and introduced min/max inventory markings.", actualBenefit: "Material retrieval travel was removed from the normal assembly cycle.", actualSaving: 8600, startedAt: "2026-08-27T10:30:00+05:30", completedAt: "2026-08-27T14:30:00+05:30", completedById: "USR-SIVA-KUMAR", completedByName: "Siva Kumar", afterEvidence: [after("CI-EV-001", "Completed improvement", "Siva Kumar", "2026-08-27T14:15:00+05:30")], timeline: [seedEvent("CIH-1", "created", "USR-SIVA-KUMAR", "Siva Kumar", "2026-08-27T08:45:00+05:30"), seedEvent("CIH-2", "submitted", "USR-SIVA-KUMAR", "Siva Kumar", "2026-08-27T09:00:00+05:30"), seedEvent("CIH-3", "approved", "USR-RUMESH", "Rumesh", "2026-08-27T10:15:00+05:30"), seedEvent("CIH-4", "started", "USR-SIVA-KUMAR", "Siva Kumar", "2026-08-27T10:30:00+05:30"), seedEvent("CIH-5", "completed", "USR-SIVA-KUMAR", "Siva Kumar", "2026-08-27T14:30:00+05:30")],
  }),
] as const;

let records: ContinuousImprovement[] = [...CONTINUOUS_IMPROVEMENT_SEED_RECORDS];
let loaded = false;
const listeners = new Set<() => void>();

function normalizeRecord(value: ContinuousImprovement): ContinuousImprovement {
  const zone = getFiveSZoneConfiguration(value.zone);
  const beforeEvidence = value.beforeEvidence ?? value.existingPhotos ?? [];
  const afterEvidence = value.afterEvidence ?? value.evidence ?? [];
  const memberIds = value.memberIds ?? [];
  const memberNames = value.memberNames ?? [];
  const participants = value.participants ?? memberIds.map((id, index) => ({ id, name: memberNames[index] ?? id }));
  const validStatus = IMPROVEMENT_STATUSES.includes(value.status) ? value.status : "submitted";
  const completedAt = value.completedAt ?? (validStatus === "completed" ? [...(value.timeline ?? [])].reverse().find((item) => item.type === "completed")?.at : undefined);
  return {
    ...value,
    zoneCode: value.zoneCode ?? zone?.code ?? "ZA",
    zoneLeaderId: value.zoneLeaderId ?? zone?.leaderId ?? "",
    zoneLeaderName: value.zoneLeaderName ?? zone?.leader ?? "",
    proposedImprovement: value.proposedImprovement ?? value.actionTaken ?? "Implement the proposed workplace improvement.",
    expectedBenefit: value.expectedBenefit ?? "Improve the current workplace condition.",
    benefitType: value.benefitType ?? (typeof value.proposedSaving === "number" && value.proposedSaving > 0 ? "Cost Saving" : "Other"),
    proposedSaving: value.proposedSaving ?? 0,
    ownerId: value.ownerId ?? "",
    ownerName: getAdminUser(value.ownerId)?.name ?? value.ownerName ?? "Owner unavailable",
    memberIds,
    memberNames,
    participants,
    status: validStatus,
    completedAt,
    actionIds: value.actionIds ?? [],
    beforeEvidence,
    afterEvidence,
    existingPhotos: beforeEvidence,
    evidence: afterEvidence,
    updatedAt: value.updatedAt ?? value.timeline?.at(-1)?.at ?? value.createdAt,
    timeline: value.timeline ?? [],
  };
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      records = [...CONTINUOUS_IMPROVEMENT_SEED_RECORDS];
      safeSetStorage(STORAGE_KEY, records);
      safeSetStorageString(FIXTURE_VERSION_KEY, FIXTURE_VERSION);
      return;
    }
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return;
    const normalized = parsed.map((item) => normalizeRecord(item as ContinuousImprovement));
    if (window.localStorage.getItem(FIXTURE_VERSION_KEY) !== FIXTURE_VERSION) {
      const storedIds = new Set(normalized.map((item) => item.id));
      records = [...CONTINUOUS_IMPROVEMENT_SEED_RECORDS.filter((item) => !storedIds.has(item.id)), ...normalized];
      safeSetStorage(STORAGE_KEY, records);
      safeSetStorageString(FIXTURE_VERSION_KEY, FIXTURE_VERSION);
    } else {
      records = normalized;
    }
  } catch {
    records = [...CONTINUOUS_IMPROVEMENT_SEED_RECORDS];
  }
}

function persist(next: ContinuousImprovement[]) {
  requireLegacyOperationalWrite("continuousImprovement");
  if (typeof window === "undefined") return false;
  const result = safeSetStorage(STORAGE_KEY, next);
  if (!result.success) {
    window.alert(result.reason === "quota" ? STORAGE_FULL_MESSAGE : result.message);
    return false;
  }
  records = next;
  listeners.forEach((listener) => listener());
  return true;
}

function subscribe(listener: () => void) { load(); listeners.add(listener); return () => listeners.delete(listener); }
function snapshot() { load(); return records; }
function event(type: ImprovementEventType, actor: ImprovementActor, remark?: string): ImprovementEvent { return { id: `CIH-${crypto.randomUUID()}`, type, actorId: actor.id, actorName: actor.name, at: new Date().toISOString(), remark }; }
function actor(user: DemoUser): ImprovementActor { return { id: user.id, name: user.name }; }
function update(id: string, transform: (item: ContinuousImprovement) => ContinuousImprovement) {
  if (getRecordTombstone("continuousImprovement", id)) return null;
  load();
  const current = records.find((item) => item.id === id);
  if (!current) return null;
  const next = transform(current);
  return persist(records.map((item) => item.id === id ? next : item)) ? next : null;
}

export function useImprovements() { return useActiveOperationalRecords("continuousImprovement", useSyncExternalStore(subscribe, snapshot, () => CONTINUOUS_IMPROVEMENT_SEED_RECORDS as ContinuousImprovement[])); }
export function getImprovements() { load(); return activeOperationalRecords("continuousImprovement", records); }
export function getImprovementById(id: string) {
  if (getRecordTombstone("continuousImprovement", id)) return undefined; load(); return records.find((item) => item.id === id); }
export function setImprovements(next: ContinuousImprovement[]) { records = next; loaded = true; listeners.forEach((listener) => listener()); }
/** Match User Management's existing non-completed assignment scope, by owner only. */
export function getOutstandingUserImprovements(userId: string) {
  return getImprovements().filter(item => item.ownerId === userId && item.status !== "completed");
}

/** Administrative transfer for deactivation; does not edit proposal content or lifecycle. */
export function reassignImprovementOwnerForDeactivation(id: string, previousOwnerId: string, replacementId: string, reason: string, actorId: string) {
  const current = getImprovementById(id);
  const manager = getAdminUser(actorId);
  const replacement = getAdminUser(replacementId);
  if (!current || current.status === "completed" || !reason.trim() || manager?.status !== "Active" || !manager.roles.includes("Admin") || !manager.permissions.includes("administration.manage_users") || (manager.plant !== current.plant && manager.plant !== "All organizations")) return null;
  if (!replacement || replacement.id === previousOwnerId || !selectableImprovementOwners([replacement], current.plant, current.zone).length) return null;
  if (current.ownerId === replacement.id) return current;
  if (current.ownerId !== previousOwnerId) return null;
  return update(id, item => ({ ...item, ownerId: replacement.id, ownerName: replacement.name,
    timeline: [...item.timeline, event("owner_changed", { id: manager.id, name: manager.name }, `${item.ownerName} → ${replacement.name}. ${reason.trim()}`)],
  }));
}

export function isZoneMember(user: DemoUser) { return Boolean(getFiveSZoneConfiguration(user.primaryZone)?.members.some((member) => member.id === user.id)); }
export function canSeeImprovement(item: ContinuousImprovement, user: DemoUser) { return canViewImprovement(getAdminUser(user.id), user, item); }

export function createImprovement(input: CreateImprovementInput, user: DemoUser, saveAsDraft = false) {
  load();
  const adminUser = getAdminUser(user.id);
  const zone = getFiveSZoneConfiguration(input.zone ?? user.primaryZone);
  const hasBroadScope = Boolean(adminUser?.roles.includes("Admin"));
  const permittedZones = new Set(adminUser?.zoneMemberships.map((membership) => membership.zone) ?? []);
  const platformAccess = user.isSuperAdmin && hasPlatformLegacyOperationalAccess("continuousImprovement", input.plant ?? user.plant);
  const demoCreate = canCreateDemoModuleRecord("continuousImprovement", user.id);
  if (!zone || !adminUser || (!demoCreate && (!adminUser.permissions.includes("ci.create") || (!platformAccess && (!hasBroadScope && !permittedZones.has(zone.name)))))) throw new Error("Only active factory users can create improvements in this factory.");
  const allowed = new Set(zone.members.map((member) => member.id));
  const ownerId = input.ownerId ?? user.id;
  const owner = getAdminUser(ownerId);
  const ownerInScope = owner?.roles.includes("Admin") || owner?.zoneMemberships.some((membership) => membership.zone === zone.name);
  if (!owner || owner.status !== "Active" || owner.plant !== (input.plant ?? user.plant) || (!demoCreate && (!owner.permissions.includes("ci.implement") || !ownerInScope))) throw new Error("Select an active CI Owner for this Zone.");
  if (input.memberIds.some((id) => !allowed.has(id))) throw new Error("Team members must belong to your Zone.");
  if (!input.title.trim() || !input.issueDescription.trim() || input.estimatedTime <= 0) throw new Error("Proposal requirements are not met.");
  const now = new Date().toISOString();
  const id = allocateModuleRecordId("continuousImprovement", records.map(item => item.id));
  const beforeEvidence = input.beforeEvidence ?? input.existingPhotos ?? [];
  const memberIds = [...new Set([...(allowed.has(user.id) ? [user.id] : []), ...input.memberIds])];
  const memberNames = memberIds.map((id) => zone.members.find((member) => member.id === id)?.name ?? (id === user.id ? user.name : id));
  const item: ContinuousImprovement = {
    id, plant: input.plant ?? user.plant, zone: zone.name, zoneCode: zone.code, zoneLeaderId: zone.leaderId, zoneLeaderName: zone.leader,
    title: input.title.trim(), issueDescription: input.issueDescription.trim(), proposedImprovement: input.proposedImprovement?.trim() || "Implement the proposed workplace improvement.", expectedBenefit: input.expectedBenefit?.trim() || "Improve the current workplace condition.", benefitType: input.benefitType ?? (typeof input.proposedSaving === "number" && input.proposedSaving > 0 ? "Cost Saving" : "Other"), proposedSaving: input.proposedSaving ?? 0, estimatedTime: input.estimatedTime, estimatedTimeUnit: input.estimatedTimeUnit,
    proposedById: user.id, proposedByName: user.name, ownerId: owner.id, ownerName: owner.name, memberIds, memberNames, participants: memberIds.map((memberId, index) => ({ id: memberId, name: memberNames[index] })),
    status: saveAsDraft ? "draft" : "submitted", reviewerId: zone.leaderId, reviewerName: zone.leader, actionIds: [], existingPhotos: beforeEvidence, evidence: [], beforeEvidence, afterEvidence: [], createdAt: now, updatedAt: now, submittedAt: saveAsDraft ? undefined : now,
    timeline: saveAsDraft ? [event("created", actor(user))] : [event("created", actor(user)), event("submitted", actor(user))],
  };
  if (!persist([item, ...records])) return null;
  if (!saveAsDraft) notifyReviewer(item, "New Improvement Proposal", `${item.title} · Proposed by ${user.name}`);
  return item;
}

export function updateImprovementProposal(id: string, input: ProposalUpdateInput, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || !canEditProposal(getAdminUser(user.id), user, current)) throw new Error("This proposal cannot be edited.");
  const zone = getFiveSZoneConfiguration(current.zone)!;
  const allowed = new Set(zone.members.map((member) => member.id));
  const ownerId = input.ownerId ?? current.ownerId;
  const owner = getAdminUser(ownerId);
  const ownerInScope = owner?.roles.includes("Admin") || owner?.zoneMemberships.some((membership) => membership.zone === current.zone);
  if (!owner || owner.status !== "Active" || owner.plant !== current.plant || !owner.permissions.includes("ci.implement") || !ownerInScope) throw new Error("Select an active CI Owner for this Zone.");
  if (input.memberIds.some((memberId) => !allowed.has(memberId)) || !input.title.trim() || !input.issueDescription.trim() || !input.proposedImprovement.trim() || !input.expectedBenefit.trim() || input.estimatedTime <= 0) throw new Error("Proposal requirements are not met.");
  const memberIds = [...new Set(input.memberIds)];
  const memberNames = memberIds.map((memberId) => zone.members.find((member) => member.id === memberId)?.name ?? memberId);
  return update(id, (item) => ({ ...item, ...input, ownerId: owner.id, ownerName: owner.name, title: input.title.trim(), issueDescription: input.issueDescription.trim(), proposedImprovement: input.proposedImprovement.trim(), expectedBenefit: input.expectedBenefit.trim(), proposedSaving: input.proposedSaving ?? 0, memberIds, memberNames, participants: memberIds.map((memberId, index) => ({ id: memberId, name: memberNames[index] })), existingPhotos: input.beforeEvidence, beforeEvidence: input.beforeEvidence, updatedAt: new Date().toISOString(), timeline: [...item.timeline, ...(item.ownerId !== owner.id ? [event("owner_changed", actor(user), `${item.ownerName || "Owner unavailable"} → ${owner.name}`)] : []), event("updated", actor(user), "Proposal details updated")] }));
}

export function submitImprovement(id: string, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || current.status !== "draft" || !canEditProposal(getAdminUser(user.id), user, current)) throw new Error("This draft cannot be submitted.");
  const now = new Date().toISOString();
  const updated = update(id, (item) => ({ ...item, status: "submitted", submittedAt: now, updatedAt: now, timeline: [...item.timeline, event("submitted", actor(user))] }));
  if (updated) notifyReviewer(updated, "New Improvement Proposal", `${updated.title} · Proposed by ${user.name}`);
  return updated;
}

export function startImprovementReview(id: string, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || current.status !== "submitted" || !canReviewProposal(getAdminUser(user.id), user, current)) throw new Error("This review is not permitted.");
  return update(id, (item) => ({ ...item, status: "under_review", reviewerId: user.id, reviewerName: user.name, updatedAt: new Date().toISOString(), timeline: [...item.timeline, event("review_started", actor(user))] }));
}

export function reviewImprovement(id: string, decision: Extract<ImprovementStatus, "approved" | "rejected" | "on_hold">, remark: string, user: DemoUser) {
  const current = getImprovementById(id);
  const allowedStatus = current && ["submitted", "under_review", "on_hold"].includes(current.status);
  if (!current || !allowedStatus || !canReviewProposal(getAdminUser(user.id), user, current) || ((decision === "rejected" || decision === "on_hold") && !remark.trim()) || (current.status === "on_hold" && decision === "on_hold")) throw new Error("This review is not permitted.");
  const now = new Date().toISOString();
  const reviewStarted = current.status === "submitted" ? [event("review_started", actor(user))] : [];
  const updated = update(id, (item) => ({
    ...item, status: decision, reviewerId: user.id, reviewerName: user.name, reviewDecision: decision, reviewRemark: remark.trim() || undefined, reviewedAt: now, reviewedById: user.id, reviewedByName: user.name,
    holdReason: decision === "on_hold" ? remark.trim() : item.holdReason, heldAt: decision === "on_hold" ? now : item.heldAt, heldById: decision === "on_hold" ? user.id : item.heldById, heldByName: decision === "on_hold" ? user.name : item.heldByName,
    updatedAt: now, timeline: [...item.timeline, ...reviewStarted, event(decision, actor(user), remark.trim() || undefined)],
  }));
  if (updated) notifyParticipants(updated, decision === "approved" ? "Improvement Approved" : decision === "rejected" ? "Improvement Rejected" : "Improvement On Hold", `${updated.title}${remark.trim() ? ` · ${remark.trim()}` : ""}`);
  return updated;
}

export function resumeImprovementReview(id: string, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || current.status !== "on_hold" || !canReviewProposal(getAdminUser(user.id), user, current)) throw new Error("This review cannot be resumed.");
  return update(id, (item) => ({ ...item, status: "under_review", updatedAt: new Date().toISOString(), timeline: [...item.timeline, event("review_resumed", actor(user))] }));
}

export function startImprovement(id: string, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || current.status !== "approved" || !canImplementImprovement(getAdminUser(user.id), user, current)) throw new Error("Only the approved team can start this improvement.");
  const now = new Date().toISOString();
  return update(id, (item) => ({ ...item, status: "in_progress", startedAt: now, updatedAt: now, timeline: [...item.timeline, event("started", actor(user))] }));
}

export function saveImprovementImplementation(id: string, input: ImplementationUpdateInput, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || current.status !== "in_progress" || !canImplementImprovement(getAdminUser(user.id), user, current)) throw new Error("Implementation updates are not permitted.");
  const afterEvidence = input.afterEvidence ?? current.afterEvidence;
  const evidenceAdded = afterEvidence.length > current.afterEvidence.length;
  const activity = [event("progress_updated", actor(user), input.progressNotes?.trim() || "Implementation details updated")];
  if (evidenceAdded) activity.push(event("evidence_uploaded", actor(user), `${afterEvidence.length - current.afterEvidence.length} completion photo${afterEvidence.length - current.afterEvidence.length === 1 ? "" : "s"} added`));
  return update(id, (item) => ({ ...item, ...input, implementationProcess: input.implementationProcess?.trim(), actionTaken: input.actionTaken?.trim(), progressNotes: input.progressNotes?.trim(), actualBenefit: input.actualBenefit?.trim(), evidence: afterEvidence, afterEvidence, updatedAt: new Date().toISOString(), timeline: [...item.timeline, ...activity] }));
}

export function linkImprovementAction(id: string, actionId: string, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || !actionId.trim()) throw new Error("Action link is not valid.");
  if (current.actionIds.includes(actionId)) return current;
  return update(id, (item) => ({ ...item, actionIds: [...item.actionIds, actionId], updatedAt: new Date().toISOString(), timeline: [...item.timeline, event("action_created", actor(user), actionId)] }));
}

export function submitImprovementCompletion(id: string, input: Required<Pick<ImplementationUpdateInput, "implementationProcess" | "actionTaken" | "actualBenefit" | "afterEvidence">> & Pick<ImplementationUpdateInput, "actualSaving" | "progressNotes">, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || current.status !== "in_progress" || !canImplementImprovement(getAdminUser(user.id), user, current) || !input.implementationProcess.trim() || !input.actionTaken.trim() || !input.actualBenefit.trim() || !input.afterEvidence.length || (typeof input.actualSaving === "number" && (!Number.isFinite(input.actualSaving) || input.actualSaving < 0))) throw new Error("Completion requirements are not met.");
  const now = new Date().toISOString();
  const resubmitted = current.timeline.some((item) => item.type === "completion_returned");
  const updated = update(id, (item) => ({ ...item, implementationProcess: input.implementationProcess.trim(), actionTaken: input.actionTaken.trim(), progressNotes: input.progressNotes?.trim(), actualBenefit: input.actualBenefit.trim(), actualSaving: input.actualSaving, evidence: input.afterEvidence, afterEvidence: input.afterEvidence, status: "awaiting_completion_review", completionSubmittedAt: now, updatedAt: now, timeline: [...item.timeline, event(resubmitted ? "completion_resubmitted" : "completion_submitted", actor(user))] }));
  if (updated) notifyReviewer(updated, "Improvement Completion Review", `${updated.title} · Submitted by ${user.name}`);
  return updated;
}

export function returnImprovementCompletion(id: string, remark: string, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || current.status !== "awaiting_completion_review" || !remark.trim() || !canCompleteReview(getAdminUser(user.id), user, current)) throw new Error("Completion review is not permitted.");
  const now = new Date().toISOString();
  const updated = update(id, (item) => ({ ...item, status: "in_progress", completionReviewRemark: remark.trim(), completionReviewedAt: now, completionReviewedById: user.id, completionReviewedByName: user.name, updatedAt: now, timeline: [...item.timeline, event("completion_returned", actor(user), remark.trim())] }));
  if (updated) notifyParticipants(updated, "Improvement Returned for Changes", `${updated.title} · ${remark.trim()}`);
  return updated;
}

export function completeImprovementReview(id: string, remark: string, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || current.status !== "awaiting_completion_review" || !canCompleteReview(getAdminUser(user.id), user, current)) throw new Error("Completion review is not permitted.");
  assertLinkedActionsCompleted(current.actionIds);
  const now = new Date().toISOString();
  const updated = update(id, (item) => ({ ...item, status: "completed", completionReviewRemark: remark.trim() || undefined, completionReviewedAt: now, completionReviewedById: user.id, completionReviewedByName: user.name, completedAt: now, completedById: user.id, completedByName: user.name, updatedAt: now, timeline: [...item.timeline, event("completed", actor(user), remark.trim() || undefined)] }));
  if (updated) notifyParticipants(updated, "Improvement Completed", updated.title);
  return updated;
}

/** Legacy direct-completion API retained for compatibility with the original 5S CI surface. */
export function completeImprovement(id: string, input: { actionTaken: string; actualSaving: number; evidence: ImprovementEvidence[] }, user: DemoUser) {
  const current = getImprovementById(id);
  if (!current || current.status !== "in_progress" || !canImplementImprovement(getAdminUser(user.id), user, current) || !input.actionTaken.trim() || !Number.isFinite(input.actualSaving) || input.actualSaving < 0 || !input.evidence.length) throw new Error("Completion requirements are not met.");
  assertLinkedActionsCompleted(current.actionIds);
  const now = new Date().toISOString();
  return update(id, (item) => ({ ...item, status: "completed", implementationProcess: item.implementationProcess || input.actionTaken.trim(), actionTaken: input.actionTaken.trim(), actualBenefit: item.actualBenefit || "Improvement completed and verified through uploaded evidence.", actualSaving: input.actualSaving, evidence: input.evidence, afterEvidence: input.evidence, completedAt: now, completedById: user.id, completedByName: user.name, updatedAt: now, timeline: [...item.timeline, event("completed", actor(user))] }));
}

function assertLinkedActionsCompleted(actionIds: readonly string[]) {
  const unfinished = actionIds.filter((actionId) => getActionById(actionId)?.status !== "Completed");
  if (unfinished.length) throw new Error(`Complete linked Action${unfinished.length === 1 ? "" : "s"} ${unfinished.join(", ")} before completing this improvement.`);
}

export function getContinuousImprovementSummary(input: readonly ContinuousImprovement[], now = new Date()) {
  const month = now.getMonth();
  const year = now.getFullYear();
  const completed = input.filter((item) => item.status === "completed");
  const reviewed = input.filter((item) => ["approved", "rejected", "on_hold", "in_progress", "awaiting_completion_review", "completed"].includes(item.status));
  const approved = reviewed.filter((item) => !["rejected", "on_hold"].includes(item.status));
  const completionDays = completed.flatMap((item) => item.completedAt ? [(new Date(item.completedAt).getTime() - new Date(item.createdAt).getTime()) / 86_400_000] : []);
  return {
    proposed: input.filter((item) => matchesImprovementQuickFilter(item, "proposal")).length,
    underReview: input.filter((item) => matchesImprovementQuickFilter(item, "under-review")).length,
    approved: input.filter((item) => item.status === "approved").length,
    inProgress: input.filter((item) => matchesImprovementQuickFilter(item, "in-progress")).length,
    active: input.filter((item) => ["approved", "in_progress", "awaiting_completion_review"].includes(item.status)).length,
    pendingReviews: input.filter((item) => ["submitted", "under_review", "on_hold", "awaiting_completion_review"].includes(item.status)).length,
    completed: completed.length,
    completedThisMonth: completed.filter((item) => item.completedAt && new Date(item.completedAt).getMonth() === month && new Date(item.completedAt).getFullYear() === year).length,
    proposedSavings: input.reduce((total, item) => total + (item.proposedSaving ?? 0), 0),
    actualSavings: completed.reduce((total, item) => total + (item.actualSaving ?? 0), 0),
    approvalRate: reviewed.length ? Math.round((approved.length / reviewed.length) * 100) : 0,
    averageCompletionDays: completionDays.length ? Math.round(completionDays.reduce((total, value) => total + value, 0) / completionDays.length) : 0,
  };
}

function notifyReviewer(item: ContinuousImprovement, title: string, message: string) {
  createNotification({ recipientUserId: item.zoneLeaderId, title, message, href: `/continuous-improvement/${encodeURIComponent(item.id)}?tab=review` });
}

function notifyParticipants(item: ContinuousImprovement, title: string, message: string) {
  for (const recipientUserId of new Set([item.proposedById, item.ownerId, ...item.memberIds].filter(Boolean))) createNotification({ recipientUserId, title, message, href: `/continuous-improvement/${encodeURIComponent(item.id)}` });
}

registerRecordCreationStore(STORAGE_KEY, () => { loaded = false; load(); });

registerActionCreationSource("continuousImprovement", (input, user, identity) => {
  const item = input.sourceId ? getImprovementById(input.sourceId) : undefined;
  return { record: item, zone: item?.zone, permitted: Boolean(item && canCreateImprovementAction(user, identity, item)) };
});

registerDeletionSource("continuousImprovement", id => { load(); const item = records.find(item => item.id === id); return item ? { id: item.id, title: item.title, organizationId: "organizationId" in item && typeof item.organizationId === "string" ? item.organizationId : undefined, plant: item.plant, zone: item.zone, aliases: [], linkedActionIds: item.actionIds ?? [] } : undefined; });
