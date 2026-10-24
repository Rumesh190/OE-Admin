"use client";
import { requireLegacyOperationalWrite } from "@/lib/legacy-operational-write";
import { activeOperationalRecords, useActiveOperationalRecords, getRecordTombstone, registerDeletionSource } from "@/lib/records/record-tombstones";


import { registerActionCreationSource } from "@/lib/actions/action-source-access";

import { allocateModuleRecordId, registerRecordCreationStore } from "@/lib/records/module-records";

import { canViewVisualImprovement, canCreateVisualImprovementAction } from "./visual-improvement-access";
import { useSyncExternalStore } from "react";
import { safeSetStorage, safeSetStorageString } from "@/lib/browser-storage";
import { getActionById } from "@/lib/actions/action-store";
import type {
  CreateVisualImprovementInput,
  UpdateVisualImprovementInput,
  VisualImprovement,
  VisualImprovementActivity,
  VisualImprovementActivityType,
  VisualImprovementActor,
  VisualImprovementEvidence,
} from "./types";

export const VISUAL_IMPROVEMENT_STORAGE_KEY = "ops-visual-improvements-v1";
const STORAGE_KEY = VISUAL_IMPROVEMENT_STORAGE_KEY;
const FIXTURE_VERSION_KEY = "ops-visual-improvements-fixture-version";
const FIXTURE_VERSION = "visual-improvement-workflow-v1";

function evidence(id: string, name: string, url: string, caption: string, uploadedBy: string, uploadedAt: string): VisualImprovementEvidence {
  return { id, name, url, caption, uploadedBy, uploadedAt, mimeType: url.endsWith(".svg") ? "image/svg+xml" : url.endsWith(".webp") ? "image/webp" : "image/png" };
}

function history(id: string, type: VisualImprovementActivityType, label: string, actorId: string, actorName: string, at: string, remark?: string, actionId?: string): VisualImprovementActivity {
  return { id, type, label, actorId, actorName, at, remark, actionId };
}

const BEFORE_STORAGE = evidence("VI-EV-014-B", "Tool storage before", "/demo-5s/not-good-example.png", "Mixed dies and fixtures made retrieval slow and condition checks difficult.", "Siva Kumar", "2026-09-11T09:10:00+05:30");
const AFTER_STORAGE = evidence("VI-EV-014-A", "Tool storage after", "/demo-5s/good-example.png", "Frequently used tooling is grouped, labelled, and visible at a glance.", "Siva Kumar", "2026-09-14T09:25:00+05:30");

export const VISUAL_IMPROVEMENT_SEED_RECORDS: readonly VisualImprovement[] = [
  {
    id: "VI-2026-014", title: "Improve tool storage layout", plant: "Egmore Plant", zone: "Zone B", location: "Tool Storage Rack 2", category: "Organization & Layout",
    ownerId: "USR-SIVA-KUMAR", ownerName: "Siva Kumar", participants: [{ id: "USR-RAMAN", name: "Raman" }, { id: "USR-RAJ-KUMAR", name: "Raj Kumar" }], status: "Awaiting Review",
    beforeDescription: "Tooling was mixed across shelves with inconsistent location labels, causing repeated search time and unnecessary handling.", beforeEvidence: [BEFORE_STORAGE],
    afterDescription: "Tool families are now grouped by use, with shelf labels and a simple return-location standard.", afterEvidence: [AFTER_STORAGE],
    expectedBenefit: "Reduce retrieval time and make missing tooling immediately visible.", proposedCostSaving: 12000, actualCostSaving: 14400, benefitDescription: "Retrieval time reduced by approximately 12 minutes per shift and weekly stock checks are faster.", timeSaved: "12 minutes per shift", actionId: "ACT-VI-014", estimatedCompletionDate: "2026-09-14", completionNotes: "Team verified the arrangement across two shifts.",
    createdById: "USR-LAKSHMAN", createdByName: "Lakshman", createdAt: "2026-09-11T09:00:00+05:30", updatedAt: "2026-09-14T09:30:00+05:30", startedAt: "2026-09-12T08:30:00+05:30", submittedAt: "2026-09-14T09:30:00+05:30",
    activity: [
      history("VI-014-H1", "created", "Improvement created", "USR-LAKSHMAN", "Lakshman", "2026-09-11T09:00:00+05:30"),
      history("VI-014-H2", "before_evidence_added", "Before evidence uploaded", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-11T09:10:00+05:30"),
      history("VI-014-H3", "action_created", "Action ACT-VI-014 created", "USR-LAKSHMAN", "Lakshman", "2026-09-11T09:30:00+05:30", undefined, "ACT-VI-014"),
      history("VI-014-H4", "started", "Work started", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-12T08:30:00+05:30"),
      history("VI-014-H5", "after_evidence_added", "After evidence uploaded", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-14T09:25:00+05:30"),
      history("VI-014-H6", "submitted", "Submitted for review", "USR-SIVA-KUMAR", "Siva Kumar", "2026-09-14T09:30:00+05:30"),
    ],
  },
  {
    id: "VI-2026-013", title: "Create point-of-use cleaning station", plant: "Egmore Plant", zone: "Zone A", location: "Assembly Cell 2", category: "Cleanliness & Hygiene",
    ownerId: "USR-RITIKA", ownerName: "Ritika", participants: [{ id: "USR-JAMES", name: "James" }], status: "In Progress",
    beforeDescription: "Cleaning tools are shared between cells and are often unavailable at shift change.", beforeEvidence: [evidence("VI-EV-013-B", "Shared cleaning equipment", "/demo-5s/reference-images/shine/shine-03.webp", "Cleaning equipment stored away from the point of use.", "Ritika", "2026-09-12T10:10:00+05:30")],
    afterEvidence: [], expectedBenefit: "Improve cleaning ownership and shorten shift handover.", benefitDescription: "Expected to improve daily cleaning consistency.", estimatedCompletionDate: "2026-09-18",
    createdById: "USR-RITIKA", createdByName: "Ritika", createdAt: "2026-09-12T10:00:00+05:30", updatedAt: "2026-09-13T08:40:00+05:30", startedAt: "2026-09-13T08:40:00+05:30",
    activity: [history("VI-013-H1", "created", "Improvement created", "USR-RITIKA", "Ritika", "2026-09-12T10:00:00+05:30"), history("VI-013-H2", "started", "Work started", "USR-RITIKA", "Ritika", "2026-09-13T08:40:00+05:30")],
  },
  {
    id: "VI-2026-012", title: "Introduce labelled component bins", plant: "Egmore Plant", zone: "Zone C", location: "CNC Supermarket", category: "Storage",
    ownerId: "USR-MADAVAN", ownerName: "Madavan", participants: [{ id: "USR-NASAR", name: "Nasar" }], status: "Completed",
    beforeDescription: "Components were held in mixed cartons without fixed rack addresses.", beforeEvidence: [evidence("VI-EV-012-B", "Mixed component storage", "/demo-5s/reference-images/set-in-order/set-in-order-05.webp", "Mixed containers before rack addressing.", "Madavan", "2026-09-04T09:00:00+05:30")],
    afterDescription: "Colour-coded bins and large rack addresses now guide replenishment and picking.", afterEvidence: [evidence("VI-EV-012-A", "Labelled component bins", "/demo-5s/reference-images/set-in-order/set-in-order-02.webp", "Fixed, labelled bin locations after implementation.", "Madavan", "2026-09-08T15:20:00+05:30")],
    expectedBenefit: "Reduce picking errors and searching.", proposedCostSaving: 24000, actualCostSaving: 21600, benefitDescription: "Picking errors reduced and approximately 18 minutes saved per replenishment round.", timeSaved: "18 minutes per round", qualityBenefit: "Clear part identification reduces mixed-component picks.", completionNotes: "Rack address audit passed with no missing labels.",
    createdById: "USR-MANOJ-GURU", createdByName: "Manoj Guru", createdAt: "2026-09-04T08:50:00+05:30", updatedAt: "2026-09-09T11:10:00+05:30", startedAt: "2026-09-05T08:30:00+05:30", submittedAt: "2026-09-08T15:30:00+05:30", reviewedById: "USR-LAKSHMAN", reviewedByName: "Lakshman", reviewedAt: "2026-09-09T11:10:00+05:30", completedById: "USR-MADAVAN", completedByName: "Madavan", completedAt: "2026-09-09T11:10:00+05:30",
    activity: [history("VI-012-H1", "created", "Improvement created", "USR-MANOJ-GURU", "Manoj Guru", "2026-09-04T08:50:00+05:30"), history("VI-012-H2", "started", "Work started", "USR-MADAVAN", "Madavan", "2026-09-05T08:30:00+05:30"), history("VI-012-H3", "after_evidence_added", "After evidence uploaded", "USR-MADAVAN", "Madavan", "2026-09-08T15:20:00+05:30"), history("VI-012-H4", "submitted", "Submitted for review", "USR-MADAVAN", "Madavan", "2026-09-08T15:30:00+05:30"), history("VI-012-H5", "completed", "Improvement approved and completed", "USR-LAKSHMAN", "Lakshman", "2026-09-09T11:10:00+05:30")],
  },
  {
    id: "VI-2026-011", title: "Add visual replenishment markers", plant: "Egmore Plant", zone: "Zone B", location: "Fastener Point of Use", category: "Visual Management",
    ownerId: "USR-RAJ-KUMAR", ownerName: "Raj Kumar", participants: [{ id: "USR-SIVA-KUMAR", name: "Siva Kumar" }], status: "Returned",
    beforeDescription: "Operators could not see reorder levels without counting every fastener bin.", beforeEvidence: [evidence("VI-EV-011-B", "Fastener bins before", "/demo-5s/reference-images/set-in-order/set-in-order-04.webp", "Bins before minimum-level markers.", "Raj Kumar", "2026-09-06T10:00:00+05:30")],
    afterDescription: "Minimum and maximum markers were added, but the night-shift labels need stronger contrast.", afterEvidence: [evidence("VI-EV-011-A", "Initial replenishment markers", "/demo-5s/reference-images/standardize/standardize-01.webp", "First version of the visual standard.", "Raj Kumar", "2026-09-10T16:00:00+05:30")],
    expectedBenefit: "Prevent stock-outs without manual counting.", proposedCostSaving: 6000, benefitDescription: "Faster replenishment checks.", reviewRemark: "Increase label contrast and add a photograph taken under night-shift lighting before resubmission.",
    createdById: "USR-RUMESH", createdByName: "Rumesh", createdAt: "2026-09-06T09:45:00+05:30", updatedAt: "2026-09-11T10:30:00+05:30", startedAt: "2026-09-07T08:20:00+05:30", submittedAt: "2026-09-10T16:10:00+05:30", reviewedById: "USR-RUMESH", reviewedByName: "Rumesh", reviewedAt: "2026-09-11T10:30:00+05:30",
    activity: [history("VI-011-H1", "created", "Improvement created", "USR-RUMESH", "Rumesh", "2026-09-06T09:45:00+05:30"), history("VI-011-H2", "started", "Work started", "USR-RAJ-KUMAR", "Raj Kumar", "2026-09-07T08:20:00+05:30"), history("VI-011-H3", "submitted", "Submitted for review", "USR-RAJ-KUMAR", "Raj Kumar", "2026-09-10T16:10:00+05:30"), history("VI-011-H4", "returned", "Returned for changes", "USR-RUMESH", "Rumesh", "2026-09-11T10:30:00+05:30", "Increase label contrast and add a photograph taken under night-shift lighting before resubmission.")],
  },
  {
    id: "VI-2026-010", title: "Relocate packing consumables", plant: "Egmore Plant", zone: "Zone D", location: "Packing Line 1", category: "Workflow",
    ownerId: "USR-MEENA", ownerName: "Meena", participants: [], status: "Draft",
    beforeDescription: "Tape and protective sleeves are stored behind the operator, creating repeated turning and walking.", beforeEvidence: [evidence("VI-EV-010-B", "Packing consumables before", "/demo-5s/reference-images/sort/sort-04.webp", "Consumables away from the packing sequence.", "Meena", "2026-09-13T14:20:00+05:30")],
    afterEvidence: [], expectedBenefit: "Create a smoother packing sequence and reduce motion.", proposedCostSaving: 4800,
    createdById: "USR-MEENA", createdByName: "Meena", createdAt: "2026-09-13T14:15:00+05:30", updatedAt: "2026-09-13T14:20:00+05:30",
    activity: [history("VI-010-H1", "created", "Draft improvement created", "USR-MEENA", "Meena", "2026-09-13T14:15:00+05:30"), history("VI-010-H2", "before_evidence_added", "Before evidence uploaded", "USR-MEENA", "Meena", "2026-09-13T14:20:00+05:30")],
  },
  {
    id: "VI-2026-009", title: "Improve inspection bench accessibility", plant: "Egmore Plant", zone: "Zone A", location: "Final Inspection", category: "Ergonomics",
    ownerId: "USR-VASANTH", ownerName: "Vasanth", participants: [{ id: "USR-GURUMURTHI", name: "Gurumurthi" }], status: "Planned",
    beforeDescription: "Frequently used gauges are below knee height and require repeated bending.", beforeEvidence: [evidence("VI-EV-009-B", "Inspection bench before", "/demo-5s/reference-images/sustain/sustain-04.webp", "Gauge storage below the main work surface.", "Vasanth", "2026-09-08T13:00:00+05:30")],
    afterEvidence: [], expectedBenefit: "Reduce bending and make the most-used gauges easier to reach.", safetyBenefit: "Reduce repetitive bending.", estimatedCompletionDate: "2026-09-20",
    createdById: "USR-LAKSHMAN", createdByName: "Lakshman", createdAt: "2026-09-08T12:50:00+05:30", updatedAt: "2026-09-08T13:00:00+05:30",
    activity: [history("VI-009-H1", "created", "Improvement created", "USR-LAKSHMAN", "Lakshman", "2026-09-08T12:50:00+05:30"), history("VI-009-H2", "planned", "Improvement planned", "USR-LAKSHMAN", "Lakshman", "2026-09-08T13:00:00+05:30")],
  },
  {
    id: "VI-2026-008", title: "Clear dispatch staging aisle", plant: "Egmore Plant", zone: "Zone D", location: "Dispatch Staging", category: "Space Utilization",
    ownerId: "USR-ANAND", ownerName: "Anand", participants: [{ id: "USR-MEENA", name: "Meena" }], status: "Completed",
    beforeDescription: "Temporary cartons occupied the marked movement aisle and obscured the staging boundary.", beforeEvidence: [evidence("VI-EV-008-B", "Dispatch aisle before", "/demo-5s/before-zone-d.svg", "Cartons inside the marked movement aisle.", "Anand", "2026-09-01T08:10:00+05:30")],
    afterDescription: "The aisle is clear and a fixed staging boundary prevents overflow.", afterEvidence: [evidence("VI-EV-008-A", "Dispatch aisle after", "/demo-5s/after-zone-d.svg", "Clear route after staging boundary reset.", "Meena", "2026-09-02T15:40:00+05:30")],
    expectedBenefit: "Recover floor space and preserve safe material movement.", benefitDescription: "Recovered 18 m² of usable staging space without capital spend.", spaceSaved: "18 m²", safetyBenefit: "Unobstructed pedestrian and trolley route.", completionNotes: "Verified during morning dispatch peak.",
    createdById: "USR-ANAND", createdByName: "Anand", createdAt: "2026-09-01T08:00:00+05:30", updatedAt: "2026-09-03T10:15:00+05:30", startedAt: "2026-09-01T11:00:00+05:30", submittedAt: "2026-09-02T15:45:00+05:30", reviewedById: "USR-LAKSHMAN", reviewedByName: "Lakshman", reviewedAt: "2026-09-03T10:15:00+05:30", completedById: "USR-MEENA", completedByName: "Meena", completedAt: "2026-09-03T10:15:00+05:30",
    activity: [history("VI-008-H1", "created", "Improvement created", "USR-ANAND", "Anand", "2026-09-01T08:00:00+05:30"), history("VI-008-H2", "started", "Work started", "USR-MEENA", "Meena", "2026-09-01T11:00:00+05:30"), history("VI-008-H3", "submitted", "Submitted for review", "USR-MEENA", "Meena", "2026-09-02T15:45:00+05:30"), history("VI-008-H4", "completed", "Improvement approved and completed", "USR-LAKSHMAN", "Lakshman", "2026-09-03T10:15:00+05:30")],
  },
] as const;

let records: VisualImprovement[] = [...VISUAL_IMPROVEMENT_SEED_RECORDS];
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) records = parsed as VisualImprovement[];
    }
    if (window.localStorage.getItem(FIXTURE_VERSION_KEY) !== FIXTURE_VERSION) {
      const savedIds = new Set(records.map((item) => item.id));
      records = [...VISUAL_IMPROVEMENT_SEED_RECORDS.filter((item) => !savedIds.has(item.id)), ...records];
      safeSetStorage(STORAGE_KEY, records);
      safeSetStorageString(FIXTURE_VERSION_KEY, FIXTURE_VERSION);
    }
  } catch {
    records = [...VISUAL_IMPROVEMENT_SEED_RECORDS];
  }
}

function persist(next: VisualImprovement[]) {
  requireLegacyOperationalWrite("visualImprovement");
  const previous = records;
  records = next;
  if (typeof window !== "undefined") {
    const result = safeSetStorage(STORAGE_KEY, records);
    if (!result.success) { records = previous; return false; }
  }
  listeners.forEach((listener) => listener());
  return true;
}

function subscribe(listener: () => void) { load(); listeners.add(listener); return () => listeners.delete(listener); }
function snapshot() { load(); return records; }
function event(type: VisualImprovementActivityType, label: string, actor: VisualImprovementActor, remark?: string, actionId?: string): VisualImprovementActivity {
  return { id: `VI-H-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, label, actorId: actor.id, actorName: actor.name, at: new Date().toISOString(), remark, actionId };
}
function updateRecord(id: string, updater: (record: VisualImprovement) => VisualImprovement) {
  if (getRecordTombstone("visualImprovement", id)) return null;
  load();
  const current = records.find((record) => record.id === id);
  if (!current) return null;
  const updated = updater(current);
  return persist(records.map((record) => record.id === id ? updated : record)) ? updated : null;
}

export function useVisualImprovements() { return useActiveOperationalRecords("visualImprovement", useSyncExternalStore(subscribe, snapshot, () => VISUAL_IMPROVEMENT_SEED_RECORDS)); }
export function getVisualImprovements() { load(); return activeOperationalRecords("visualImprovement", records); }
export function getVisualImprovementById(id: string) {
  if (getRecordTombstone("visualImprovement", id)) return undefined; load(); return records.find((record) => record.id === id); }
export function setVisualImprovements(next: VisualImprovement[]) { records = next; loaded = true; listeners.forEach((listener) => listener()); }

export function createVisualImprovement(input: CreateVisualImprovementInput, actor: VisualImprovementActor, saveAsDraft = false) {
  requireLegacyOperationalWrite("visualImprovement");
  load();
  if (!input.title.trim() || !input.plant || !input.zone || !input.location.trim() || !input.beforeDescription.trim() || !input.beforeEvidence.length) throw new Error("Title, location, before description, and before evidence are required.");
  const now = new Date().toISOString();
  const id = allocateModuleRecordId("visualImprovement", records.map(item => item.id));
  const status = saveAsDraft ? "Draft" as const : "Planned" as const;
  const activity = [event("created", saveAsDraft ? "Draft improvement created" : "Improvement created", actor), event("before_evidence_added", `${input.beforeEvidence.length} before evidence photo${input.beforeEvidence.length === 1 ? "" : "s"} added`, actor)];
  if (!saveAsDraft) activity.push(event("planned", "Improvement planned", actor));
  const { owner, ...details } = input;
  const item: VisualImprovement = {
    id, ...details, title: input.title.trim(), location: input.location.trim(), beforeDescription: input.beforeDescription.trim(), expectedBenefit: input.expectedBenefit.trim(),
    participants: input.participants.filter((person, index, all) => all.findIndex((candidate) => candidate.id === person.id) === index && person.id !== owner.id),
    ownerId: owner.id, ownerName: owner.name, status, afterEvidence: [], createdById: actor.id, createdByName: actor.name, createdAt: now, updatedAt: now, activity,
  };
  return persist([item, ...records]) ? item : null;
}

export function saveVisualImprovement(id: string, input: UpdateVisualImprovementInput, actor: VisualImprovementActor) {
  return updateRecord(id, (record) => {
    if (["Awaiting Review", "Completed"].includes(record.status)) return record;
    const beforeAdded = Math.max(0, (input.beforeEvidence?.length ?? record.beforeEvidence.length) - record.beforeEvidence.length);
    const afterAdded = Math.max(0, (input.afterEvidence?.length ?? record.afterEvidence.length) - record.afterEvidence.length);
    const activity = [...record.activity];
    if (beforeAdded) activity.push(event("before_evidence_added", `${beforeAdded} before evidence photo${beforeAdded === 1 ? "" : "s"} added`, actor));
    if (afterAdded) activity.push(event("after_evidence_added", `${afterAdded} after evidence photo${afterAdded === 1 ? "" : "s"} added`, actor));
    activity.push(event("updated", "Improvement details updated", actor));
    return { ...record, ...input, updatedAt: new Date().toISOString(), activity };
  });
}

export function planVisualImprovement(id: string, actor: VisualImprovementActor) {
  return updateRecord(id, (record) => record.status !== "Draft" ? record : { ...record, status: "Planned", updatedAt: new Date().toISOString(), activity: [...record.activity, event("planned", "Improvement planned", actor)] });
}

export function startVisualImprovement(id: string, actor: VisualImprovementActor) {
  return updateRecord(id, (record) => record.status !== "Planned" ? record : { ...record, status: "In Progress", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), activity: [...record.activity, event("started", "Work started", actor)] });
}

export function submitVisualImprovement(id: string, actor: VisualImprovementActor) {
  return updateRecord(id, (record) => {
    if (!["In Progress", "Returned"].includes(record.status) || !record.afterDescription?.trim() || !record.afterEvidence.length) return record;
    const resubmission = record.status === "Returned";
    const now = new Date().toISOString();
    return { ...record, status: "Awaiting Review", submittedAt: now, updatedAt: now, reviewRemark: resubmission ? undefined : record.reviewRemark, activity: [...record.activity, event(resubmission ? "resubmitted" : "submitted", resubmission ? "Resubmitted for review" : "Submitted for review", actor)] };
  });
}

export function returnVisualImprovement(id: string, remark: string, actor: VisualImprovementActor) {
  if (!remark.trim()) return null;
  return updateRecord(id, (record) => {
    if (record.status !== "Awaiting Review") return record;
    const now = new Date().toISOString();
    return { ...record, status: "Returned", reviewRemark: remark.trim(), reviewedById: actor.id, reviewedByName: actor.name, reviewedAt: now, updatedAt: now, activity: [...record.activity, event("returned", "Returned for changes", actor, remark.trim())] };
  });
}

export function approveVisualImprovement(id: string, remark: string, actor: VisualImprovementActor) {
  const current = getVisualImprovementById(id);
  if (current?.actionId && getActionById(current.actionId)?.status !== "Completed") {
    throw new Error(`Complete linked Action ${current.actionId} before approving this improvement.`);
  }
  return updateRecord(id, (record) => {
    if (record.status !== "Awaiting Review" || !record.afterDescription?.trim() || !record.afterEvidence.length) return record;
    const now = new Date().toISOString();
    return { ...record, status: "Completed", reviewRemark: remark.trim() || undefined, reviewedById: actor.id, reviewedByName: actor.name, reviewedAt: now, completedById: record.ownerId, completedByName: record.ownerName, completedAt: now, updatedAt: now, activity: [...record.activity, event("completed", "Improvement approved and completed", actor, remark.trim() || undefined)] };
  });
}

export function linkVisualImprovementAction(id: string, actionId: string, actor: VisualImprovementActor) {
  return updateRecord(id, (record) => record.actionId ? record : { ...record, actionId, updatedAt: new Date().toISOString(), activity: [...record.activity, event("action_created", `Action ${actionId} created`, actor, undefined, actionId)] });
}

export function getVisualImprovementSummary(input: readonly VisualImprovement[], now = new Date()) {
  const active = input.filter((item) => ["Draft", "Planned", "In Progress", "Returned"].includes(item.status));
  const completed = input.filter((item) => item.status === "Completed");
  const completedThisMonth = completed.filter((item) => item.completedAt && new Date(item.completedAt).getFullYear() === now.getFullYear() && new Date(item.completedAt).getMonth() === now.getMonth());
  return {
    active: active.length,
    completedThisMonth: completedThisMonth.length,
    awaitingReview: input.filter((item) => item.status === "Awaiting Review").length,
    estimatedSavings: input.reduce((sum, item) => sum + (item.proposedCostSaving ?? 0), 0),
    totalSavings: completed.reduce((sum, item) => sum + (item.actualCostSaving ?? 0), 0),
    areasImproved: new Set(completed.map((item) => `${item.plant}/${item.zone}/${item.location}`)).size,
  };
}

registerRecordCreationStore(STORAGE_KEY, () => { loaded = false; load(); });

registerActionCreationSource("visualImprovement", (input, user, identity) => {
  const item = input.sourceId ? getVisualImprovementById(input.sourceId) : undefined;
  return { record: item, zone: item?.zone, permitted: Boolean(item && canViewVisualImprovement(user, identity, item) && canCreateVisualImprovementAction(user, identity)), alreadyLinked: item?.actionId };
});

registerDeletionSource("visualImprovement", id => { load(); const item = records.find(item => item.id === id); return item ? { id: item.id, title: item.title, organizationId: "organizationId" in item && typeof item.organizationId === "string" ? item.organizationId : undefined, plant: item.plant, zone: item.zone, aliases: [], linkedActionIds: item.actionId ? [item.actionId] : [] } : undefined; });
