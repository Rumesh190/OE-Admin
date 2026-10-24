"use client";
import { useAccessContext, getActiveAccessContext, isLegacyABCOperationalContext } from "@/features/five-s/administration/access-v4-context";
import { getAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { storeV4Evidence, assertV4EvidenceReferences } from "@/lib/actions/action-v4-assets";
import { dataUrlToBlob } from "@/lib/gemba/gemba-photo-storage";
import { actionV4ReadSet, readCanonicalActions } from "@/lib/actions/action-v4-policy";
import { commitAdministrationV4 } from "@/lib/administration-v4-storage";
import { isV4Audit, requireV4AuditContext, type V4AuditExpectation } from "./audit-authorization";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
import { getOrganizationAccess } from "@/lib/module-entitlements";
import { useMemo } from "react";
import { useCurrentUser } from "@/lib/current-user";
import { readAdministrationPayload, ADMINISTRATION_JOURNAL_KEY } from "@/lib/administration-storage";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { reassignAuditAdministrator } from "@/features/five-s/administration/access-v3-store";
import { requireFactoryAdministrator, resolveCurrentFactoryActor, resolveFactoryPerson } from "@/features/five-s/administration/factory-authorization";
import { auditContext, canReadScopedAudit, canExecuteScopedAudit, isScopedAudit, requiresScopedAuditPolicy, requireAuditExecution } from "./audit-authorization";
import { canDeleteOperationalRecord, deleteOperationalRecord } from "@/lib/records/record-deletion";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { activeOperationalRecords, useActiveOperationalRecords, getRecordTombstone, registerDeletionSource } from "@/lib/records/record-tombstones";


import { normalizeAuditEvidence, normalizeAuditEvidenceRecords, persistAuditEvidence } from "./audit-evidence-storage";
import { registerActionCreationSource } from "@/lib/actions/action-source-access";

import { allocateModuleRecordId, registerRecordCreationStore, previewModuleRecordId } from "@/lib/records/module-records";

import { getAuditScoringPolicy } from "@/features/settings/audit-scoring/store";
import { calculateAuditSectionTotals, auditSectionsHaveConsistentScoring, auditUsesCustomScoring, getAuditScoringValues, questionComplianceResponse, scoreForComplianceResponse } from "@/lib/five-s/scoring-policy";
import { isAuditQuestionComplete } from "@/features/settings/custom-audit-questions/checklist";
import { useSyncExternalStore } from "react";
import { getAdminUser } from "@/features/five-s/administration/store";
import { getCurrentDemoUser, type DemoUser } from "@/lib/current-user";
import { getActions } from "@/lib/actions/action-store";

import { FIVE_S_AUDITS } from "@/features/five-s/data/five-s-data";

import type { FiveSAudit } from "@/features/five-s/types/five-s";
import { safeSetStorage, safeSetStorageString } from "@/lib/browser-storage";

/* =========================================================
   STORAGE
   ========================================================= */

const STORAGE_KEY =
  "manufacturing-qms-five-s-audits-v1";

const AUDIT_NUMBER_STORAGE_KEY =
  "manufacturing-qms-five-s-next-audit-number-v1";

const AUDIT_SEQUENCE_STORAGE_KEY =
  "standalone-5s-audit-sequences-v2";

/* =========================================================
   STORE STATE
   ========================================================= */

let audits: FiveSAudit[] = [...FIVE_S_AUDITS];
let committedAudits = audits;

const listeners = new Set<() => void>();

let initializedFromStorage = false;
let lastAuditPayload: string | null | undefined;

/* =========================================================
   EMIT CHANGE
   ========================================================= */

function emitChange(): void {
  listeners.forEach((listener) => {
    listener();
  });
}

/* =========================================================
   LOAD FROM LOCAL STORAGE
   ========================================================= */

function loadFromStorage(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (initializedFromStorage) {
    return;
  }

  const versionedRaw = readAdministrationPayload(STORAGE_KEY);
  const activeContext = getActiveAccessContext();
  if (activeContext && activeContext.kind !== "platform" && activeContext.organizationId !== "abc-manufacturing") {
    const parsed: unknown = versionedRaw ? JSON.parse(versionedRaw) : [];
    if (!Array.isArray(parsed)) throw new Error("Invalid canonical Audit payload. Preserve storage.");
    audits = parsed as FiveSAudit[]; committedAudits = audits; lastAuditPayload = versionedRaw; initializedFromStorage = true; return;
  }
  if (versionedRaw) {
    const parsed: unknown = JSON.parse(versionedRaw);
    if (Array.isArray(parsed) && parsed.some(a => a && isV4Audit(a))) {
      audits = parsed as FiveSAudit[]; committedAudits = audits; lastAuditPayload = versionedRaw; initializedFromStorage = true; return;
    }
  }
  initializedFromStorage = true;

  try {
    const stored = readAdministrationPayload(STORAGE_KEY);
    lastAuditPayload = stored;

    if (!stored) {
      return;
    }

    const parsed: unknown =
      JSON.parse(stored);

    if (!Array.isArray(parsed)) {
      return;
    }

    // Existing persisted records are authoritative, including an intentionally empty list.
    audits = parsed as FiveSAudit[];
    committedAudits = audits;

    emitChange();
  } catch (error) {
    console.error(
      "Failed to load 5S audits from localStorage:",
      error
    );
  }
}

/** Reload canonical browser state after a coordinated demo/administration transaction. */
export function refreshFiveSAuditStore(): void {
  initializedFromStorage = false;
  loadFromStorage();
  emitChange();
}

/* =========================================================
   SAVE TO LOCAL STORAGE
   ========================================================= */

function persistAudits(): void {
  if (typeof window === "undefined") {
    return;
  }

  if (window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY)) { audits = committedAudits; throw new Error("Administration recovery is pending."); }
  const changed = audits.filter(a => isV4Audit(a) && JSON.stringify(a) !== JSON.stringify(committedAudits.find(old => old.id === a.id)));
  if (changed.length) {
    if (readAdministrationPayload(STORAGE_KEY) !== lastAuditPayload) { audits = committedAudits; throw new Error("Audit revision conflict."); }
    for (const a of changed) requireV4AuditContext(a);
    audits = audits.map(a => changed.includes(a) ? { ...a, revision: (committedAudits.find(old => old.id === a.id)?.revision ?? 0) + 1 } : a);
    const reads = actionV4ReadSet();
    try { commitAdministrationV4([{ key: STORAGE_KEY, before: reads.get(STORAGE_KEY)!, after: JSON.stringify(audits) }], reads, () => { for (const a of changed) requireV4AuditContext(a); }); }
    catch (e) { audits = committedAudits; throw e; }
    committedAudits = audits; lastAuditPayload = window.localStorage.getItem(STORAGE_KEY); return;
  }
  audits = audits.map(audit => isScopedAudit(audit) ? audit : normalizeAuditEvidenceRecords([audit])[0]);
  const persisted = safeSetStorage(STORAGE_KEY, audits);
  if (!persisted.success) { audits = committedAudits; throw new Error(persisted.message); }
  committedAudits = audits;
  lastAuditPayload = window.localStorage.getItem(STORAGE_KEY);
}

/* =========================================================
   SUBSCRIBE
   ========================================================= */

function subscribe(
  listener: () => void
): () => void {
  const published = () => { initializedFromStorage = false; initializeStore(); listener(); };
  window.addEventListener?.("ops-audit-v4-changed", published);
  listeners.add(listener);
  const changed = () => { initializedFromStorage = false; loadFromStorage(); emitChange(); };
  window.addEventListener?.("storage", changed);
  return () => {
    window.removeEventListener?.("storage", changed);
    listeners.delete(listener);
    window.removeEventListener?.("ops-audit-v4-changed", published);
  };
}

/* =========================================================
   SNAPSHOT
   ========================================================= */

function getSnapshot(): FiveSAudit[] {
  return audits;
}

/* =========================================================
   SERVER SNAPSHOT
   ========================================================= */

function getServerSnapshot(): FiveSAudit[] {
  return FIVE_S_AUDITS;
}

/* =========================================================
   INITIALIZE STORE
   ========================================================= */

function initializeStore(): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload = readAdministrationPayload(STORAGE_KEY);
  if (initializedFromStorage && lastAuditPayload !== payload) initializedFromStorage = false;
  loadFromStorage();
}

/* =========================================================
   REACT STORE HOOK
   ========================================================= */

export function useFiveSAuditStore(): FiveSAudit[] {
  initializeStore();

  const identity = useCurrentUser();
  useAccessContext();
  const access = useAccessV3State();
  const active = useActiveOperationalRecords("audit", useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  ));
  return useMemo(() => { void identity; void access; return active.filter(canReadScopedAudit); }, [active, identity, access]);
}

/* =========================================================
   GET ALL AUDITS
   ========================================================= */

export function getFiveSAudits(): FiveSAudit[] {
  initializeStore();

  return activeOperationalRecords("audit", audits).filter(canReadScopedAudit);
}

/* =========================================================
   GET AUDIT BY ID
   ========================================================= */

export function getFiveSAuditById(
  auditId: string
): FiveSAudit | undefined {
  if (getRecordTombstone("audit", auditId)) return undefined;
  initializeStore();

  return audits.find(
    (audit) => audit.id === auditId && canReadScopedAudit(audit)
  );
}

/* =========================================================
   AUDIT NUMBER HELPERS
   ========================================================= */

/**
 * Find the highest audit number already present.
 *
 * Supports:
 *
 * 5S-001-CHN-ASM1
 * 5S-027-HSR-WLD
 *
 * Older demo records such as:
 *
 * 5S-AUD-001
 *
 * are intentionally ignored.
 */
function getHighestAuditNumber(): number {
  let highestNumber = 0;

  for (const audit of audits) {
    const match =
      audit.title.match(
        /^5S-(\d+)-/i
      );

    if (!match) {
      continue;
    }

    const number =
      Number(match[1]);

    if (
      Number.isFinite(number) &&
      number > highestNumber
    ) {
      highestNumber = number;
    }
  }

  return highestNumber;
}

/**
 * Get the next permanent audit number.
 *
 * The number is stored separately from the audit list.
 *
 * This is important because deleting an audit must NOT
 * cause its number to be reused.
 */
export function getNextFiveSAuditTitle(plant: string, area: string): string {
  if (!plant || !area) return "";
  initializeStore();
  return previewModuleRecordId("audit", audits.map(audit => audit.id));
}

/* =========================================================
   CALCULATE MAX SCORE
   ========================================================= */

function calculateMaxScore(sections: FiveSAudit["sections"]): number { return calculateAuditSectionTotals(sections).maxScore; }
function calculateScore(sections: FiveSAudit["sections"]): number { return calculateAuditSectionTotals(sections).score; }

/* =========================================================
   CALCULATE COMPLETION
   ========================================================= */

function calculateCompletionPercentage(
  sections: FiveSAudit["sections"]
): number {
  const questions =
    sections.flatMap(
      (section) =>
        section.questions
    );

  if (
    questions.length === 0
  ) {
    return 0;
  }

  const answeredQuestions =
    questions.filter(
      (question) =>
        question.status !==
        "Not Started"
    ).length;

  return Math.round(
    (answeredQuestions /
      questions.length) *
      100
  );
}

/* =========================================================
   CREATE AUDIT
   ========================================================= */

export function createFiveSAudit(
  input: Omit<
    FiveSAudit,
    | "id"
    | "score"
    | "maxScore"
    | "completionPercentage"
    | "status"
    | "scoringPolicy"
  >,
  options: { startNow?: boolean; expectedContextSelectionId?: string } = {}
): FiveSAudit {
  if (isV4Audit(input) || (input.organizationId && input.organizationId !== "abc-manufacturing")) {
    if (input.policyVersion !== undefined && input.policyVersion !== "ops-access-v4") throw new Error("Unsupported Audit policy version.");
    input = { ...input, policyVersion: "ops-access-v4", revision: 1 };
    if (!options.expectedContextSelectionId) throw new Error("Explicit creation context is required.");
    const c = requireV4AuditContext(input);
    if (c.selectionId !== options.expectedContextSelectionId) throw new Error("Audit creation context changed.");
    const questions = input.sections.flatMap(s => s.questions);
    if (new Set(questions.map(q => q.id)).size !== questions.length || questions.some(q => q.actionId || q.evidence?.length)) throw new Error("New Audit checklist cannot contain prepublished links or evidence.");
    for (const q of questions) if (q.departmentId && !getAccessV4State().departments.some(d => d.id === q.departmentId && d.organizationId === input.organizationId && d.plantId === input.plantId && d.zoneId === input.zoneId && d.status === "Active")) throw new Error("Select an active canonical Department in this Zone.");
  }

  initializeStore();
  if (window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY)) throw new Error("Administration recovery is pending.");
  if (requiresScopedAuditPolicy(input)) {
    const context = auditContext(input);
    if (!context) throw new Error("Canonical client, factory and Zone IDs are required.");
    const resolved = resolveCurrentFactoryActor(context);
    const canStartDirectly = Boolean((options.startNow ?? true) && resolved?.valid && (resolved.clientAdmin || resolved.factoryAdmin || resolved.membership));
    const actor = canStartDirectly && resolved ? resolved.actor : requireFactoryAdministrator(context);
    if (!actor.identity.isSuperAdmin && !getOrganizationAccess(context.organizationId).audit) throw new Error("Audit module is not enabled for the selected factory.");
    if (!input.dueDate || input.dueDate < new Date().toISOString().slice(0, 10)) throw new Error("Select a valid Audit due date.");
    if (!(options.startNow ?? true)) { const error = validateFiveSAuditSchedule(input.scheduledDate ?? "", input.scheduledTime ?? ""); if (error) throw new Error(error); }
    const target = input.assignedAuditorId ? resolveFactoryPerson(input.assignedAuditorId, context) : undefined;
    if (!target?.canAuditZone && !((options.startNow ?? true) && input.assignedAuditorId === actor.user.id)) throw new Error("Select an eligible authorized auditor for this Zone.");
    if ((options.startNow ?? true) && input.assignedAuditorId !== actor.user.id) throw new Error("Schedule the assigned auditor's audit before execution.");
    const catalog = getAllOrganizationConfiguration();
    const plant = catalog.plants.find(p => p.id === context.plantId)!;
    const zone = catalog.zones.find(z => z.id === context.zoneId)!;
    input = { ...input, auditorSignature: undefined, signatureHistory: undefined, completedAt: undefined, startedAt: undefined, plant: plant.name, area: zone.name, department: zone.department, auditor: target?.person?.name ?? actor.user.name, assignmentHistory: [{ actorId: actor.user.id, at: new Date().toISOString(), previousAuditor: "", auditorId: input.assignedAuditorId!, auditor: target?.person?.name ?? actor.user.name, reason: "Initial assignment" }] };
  }
  const now = new Date();

  const scoringPolicy = Object.freeze(getAuditScoringPolicy(input.organizationId));
  const sections = (input.sections ?? []).map((section) => ({
    ...section,
    questions: section.questions.map((question) => ({
      ...question,
      ...((question.responseType ?? "Compliance") === "Compliance" ? {
        complianceResponse: questionComplianceResponse(question),
        score: scoringPolicy.fullyCompliance === 2 && scoringPolicy.partialCompliance === 1 && scoringPolicy.nonCompliance === 0 ? question.score : scoreForComplianceResponse(questionComplianceResponse(question), scoringPolicy),
        maxScore: scoringPolicy.fullyCompliance === 2 && scoringPolicy.partialCompliance === 1 && scoringPolicy.nonCompliance === 0 ? question.maxScore : scoringPolicy.fullyCompliance,
      } : {}),
      evidence: (question.evidence ?? []).map((evidence) => ({ ...evidence })),
    })),
  }));

  if (scoringPolicy.nonCompliance !== 0 || scoringPolicy.partialCompliance !== 1 || scoringPolicy.fullyCompliance !== 2) {
    sections.forEach(section => Object.assign(section, calculateAuditSectionTotals([section])));
  }

  const generatedTitle = allocateModuleRecordId("audit", audits.map(audit => audit.id));
  const startNow = options.startNow ?? true;

  const audit: FiveSAudit = {
    ...input,
    scoringPolicy,
    sections,
    createdAt: now.toISOString(),

    /**
     * Keep an internal unique ID separate
     * from the human-readable audit title.
     */
    id: generatedTitle,

    /**
     * Automatically generated title.
     */
    title: generatedTitle,

    status: startNow ? "In Progress" : "Scheduled",

    score:
      calculateScore(
        sections
      ),

    maxScore:
      calculateMaxScore(
        sections
      ),

    completionPercentage:
      calculateCompletionPercentage(
        sections
      ),

    startedAt: startNow
      ? input.startedAt ?? now.toISOString().slice(0, 10)
      : undefined,
  };

  const previousAudits = audits;
  audits = [
    audit,
    ...audits,
  ];

  if (isV4Audit(audit)) { requireV4AuditContext(audit); if (readAdministrationPayload(STORAGE_KEY) !== lastAuditPayload) { audits = previousAudits; throw new Error("Audit creation revision conflict."); } }
  const result = safeSetStorage(STORAGE_KEY, audits);
  if (!result.success) { audits = previousAudits; throw new Error(result.message); }
  lastAuditPayload = window.localStorage.getItem(STORAGE_KEY);
  committedAudits = audits;

  emitChange();

  return audit;
}

/* =========================================================
   UPDATE AUDIT
   ========================================================= */

export function updateFiveSAudit(
  auditId: string,
  updates: Partial<FiveSAudit>,
  actor: Pick<DemoUser, "id"> = getCurrentDemoUser(),
  expected?: V4AuditExpectation
): FiveSAudit | undefined {
  initializeStore();
  if (getRecordTombstone("audit", auditId)) return undefined;
  const rawAudit = audits.find(a => a.id === auditId);
  if (rawAudit) {
    assertVersionedMutation(rawAudit, expected);
    requireAuditExecution(rawAudit, actor.id);
    if (requiresScopedAuditPolicy(rawAudit)) {
      const allowed = ["sections", "auditorSignature", "score", "maxScore", "completionPercentage", "status", "id", "title", "plant", "department", "area", "auditor", "dueDate", "createdAt", "scoringPolicy", "scheduledDate", "scheduledTime", "startedAt", "completedAt", "organizationId", "plantId", "zoneId", "assignedAuditorId", "assignmentHistory", "signatureHistory", "policyVersion", "revision"];
      if (Object.keys(updates).some(key => !allowed.includes(key))) throw new Error("Unsupported Audit update.");
      for (const key of ["policyVersion", "revision", "organizationId", "plantId", "zoneId", "assignedAuditorId", "assignmentHistory", "signatureHistory", "id", "title", "plant", "department", "area", "auditor", "dueDate", "createdAt", "scoringPolicy", "scheduledDate", "scheduledTime", "startedAt", "completedAt"] as const) {
        if (key in updates && JSON.stringify(updates[key]) !== JSON.stringify(rawAudit[key])) throw new Error("Audit scope, assignment and history require their dedicated commands.");
      }
      if (updates.status && updates.status !== rawAudit.status && updates.status !== "Completed") throw new Error("Use the dedicated Audit lifecycle commands.");
      if (updates.auditorSignature && JSON.stringify(updates.auditorSignature) !== JSON.stringify(rawAudit.auditorSignature) && (updates.auditorSignature.userId !== getAuthenticatedDemoActor(actor.id)?.user.id || updates.auditorSignature.userName !== getAuthenticatedDemoActor(actor.id)?.user.name)) throw new Error("Signature must belong to the current actor.");
    }
  }
  if (rawAudit && updates.sections) validateScopedAuditSections(rawAudit, updates.sections);
  const existingPolicyAudit = getFiveSAuditById(auditId);
  if (existingPolicyAudit?.status === "Completed") return undefined;
  if (existingPolicyAudit && updates.sections && !auditSectionsHaveConsistentScoring(existingPolicyAudit, updates.sections)) return undefined;
  if (updates.status === "Completed") return completeFiveSAudit(auditId, updates.sections ?? getFiveSAuditById(auditId)?.sections ?? [], actor, expected);

  let updatedAudit:
    | FiveSAudit
    | undefined;

  audits =
    audits.map(
      (audit) => {
        if (
          audit.id !==
          auditId
        ) {
          return audit;
        }

        const signatureChanged = updates.auditorSignature !== undefined && JSON.stringify(updates.auditorSignature) !== JSON.stringify(audit.auditorSignature);
        const nextAudit = {
          ...audit,
          ...updates,
          ...(isScopedAudit(audit) && (signatureChanged || ("auditorSignature" in updates && !updates.auditorSignature)) && audit.auditorSignature ? { signatureHistory: [...(audit.signatureHistory ?? []), audit.auditorSignature] } : {}),
          createdAt: audit.createdAt,
          ...(updates.sections ? { sections: structuredClone(updates.sections) } : {}),
        };

        if (auditUsesCustomScoring(audit)) {
          nextAudit.sections = nextAudit.sections.map(section => ({ ...section, ...calculateAuditSectionTotals([section]) }));
          Object.assign(nextAudit, calculateAuditSectionTotals(nextAudit.sections));
        }

        // Generic updates cannot replace a captured policy or fabricate one for a legacy Audit.
        delete nextAudit.scoringPolicy;
        if (audit.scoringPolicy) nextAudit.scoringPolicy = Object.freeze(structuredClone(audit.scoringPolicy));

        updatedAudit = audit.status === "Draft"
          ? nextAudit
          : {
              ...nextAudit,
              id: audit.id,
              title: audit.title,
              plant: audit.plant,
              department: audit.department,
              area: audit.area,
              auditor: audit.auditor,
            };

        return updatedAudit;
      }
    );

  if (
    updatedAudit
  ) {
    persistAudits();

    emitChange();
  }

  return audits.find(row => row.id === updatedAudit?.id) ?? updatedAudit;
}

export function validateFiveSAuditSchedule(
  scheduledDate: string,
  scheduledTime: string,
  now = new Date()
): string | null {
  if (!scheduledDate || !scheduledTime) return "Choose a scheduled date and time.";

  const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}:00`);
  if (Number.isNaN(scheduledAt.getTime())) return "Choose a valid scheduled date and time.";
  if (scheduledAt.getTime() <= now.getTime()) return "Scheduled date and time must be in the future.";
  return null;
}

export function updateScheduledFiveSAuditSetup(
  auditId: string,
  updates: Pick<FiveSAudit, "dueDate" | "scheduledDate" | "scheduledTime">,
  now = new Date(),
  expected?: V4AuditExpectation
): FiveSAudit | undefined {
  initializeStore();
  const existingAudit = audits.find((audit) => audit.id === auditId);
  if (!existingAudit || existingAudit.status !== "Scheduled") return undefined;
  assertVersionedMutation(existingAudit, expected);
  if (requiresScopedAuditPolicy(existingAudit)) { if (window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY)) throw new Error("Administration recovery is pending."); const context = auditContext(existingAudit); if (!context) throw new Error("Invalid Audit scope."); requireFactoryAdministrator(context); }
  if (validateFiveSAuditSchedule(updates.scheduledDate ?? "", updates.scheduledTime ?? "", now)) return undefined;

  const updatedAudit = { ...existingAudit, ...updates };
  audits = audits.map((audit) => audit.id === auditId ? updatedAudit : audit);
  persistAudits();
  emitChange();
  return audits.find(row => row.id === updatedAudit?.id) ?? updatedAudit;
}

export function startScheduledFiveSAudit(
  auditId: string,
  now = new Date(),
  expected?: V4AuditExpectation
): FiveSAudit | undefined {
  initializeStore();
  const existingAudit = audits.find((audit) => audit.id === auditId);
  if (!existingAudit || existingAudit.status !== "Scheduled") return undefined;
  assertVersionedMutation(existingAudit, expected);

  requireAuditExecution(existingAudit, undefined, "start");
  const startedAudit: FiveSAudit = {
    ...existingAudit,
    status: "In Progress",
    startedAt: now.toISOString().slice(0, 10),
  };
  audits = audits.map((audit) => audit.id === auditId ? startedAudit : audit);
  persistAudits();
  emitChange();
  return startedAudit;
}

/* =========================================================
   SAVE AUDIT DRAFT
   ========================================================= */

export function saveFiveSAuditDraft(
  auditId: string,
  sections: FiveSAudit["sections"],
  expected?: V4AuditExpectation
): FiveSAudit | undefined {
  initializeStore();

  const existingAudit =
    getFiveSAuditById(
      auditId
    );

  if (
    !existingAudit
  ) {
    console.warn(
      `5S audit not found: ${auditId}`
    );

    return undefined;
  }

  assertVersionedMutation(existingAudit, expected);
  requireAuditExecution(existingAudit);
  if (existingAudit.status === "Completed") return existingAudit;
  validateScopedAuditSections(existingAudit, sections);

  if (!auditSectionsHaveConsistentScoring(existingAudit, sections)) return undefined;

  const updatedAudit: FiveSAudit = {
    ...existingAudit,

    status:
      existingAudit.status === "In Progress"
          ? "In Progress"
          : existingAudit.status === "Scheduled"
            ? "Scheduled"
            : "Draft",

    score:
      calculateScore(
        sections
      ),

    maxScore:
      calculateMaxScore(
        sections
      ),

    completionPercentage:
      calculateCompletionPercentage(
        sections
      ),

    sections: structuredClone(auditUsesCustomScoring(existingAudit) ? sections.map(section => ({ ...section, ...calculateAuditSectionTotals([section]) })) : sections),
  };

  audits =
    audits.map(
      (audit) =>
        audit.id ===
        auditId
          ? updatedAudit
          : audit
    );

  persistAudits();

  emitChange();

  return audits.find(row => row.id === updatedAudit?.id) ?? updatedAudit;
}

/* =========================================================
   COMPLETE AUDIT
   ========================================================= */

/** Completion authority is independent of linked Action execution/review authority. */
export function canCompleteFiveSAudit(audit: FiveSAudit, actor: Pick<DemoUser, "id"> = getCurrentDemoUser()) {
  if (requiresScopedAuditPolicy(audit)) return canExecuteScopedAudit(audit, actor.id);
  const user = getAdminUser(actor.id);
  return Boolean(user?.status === "Active" && user.permissions.includes("audits.complete")
    && (user.plant === audit.plant || user.plant === "All organizations")
    && (user.roles.includes("Admin") || (user.roles.includes("Auditor") && user.name === audit.auditor)));
}

export function getLinkedActionsForAudit(audit: FiveSAudit, actions = getActions()) {
  const questionIds = new Set(audit.sections.flatMap(section => section.questions.flatMap(question => question.actionId ? [question.actionId] : [])));
  return [...new Map(actions.filter(action => questionIds.has(action.id) || action.auditId === audit.id || action.auditId === audit.title
    || ((action.sourceModule === "audit" || ["Audit", "5S Audit"].includes(action.source)) && [audit.id, audit.title].includes(action.sourceId ?? action.sourceTitle))).map(action => [action.id, action])).values()];
}

export function completeFiveSAudit(
  auditId: string,
  sections: FiveSAudit["sections"],
  actor: Pick<DemoUser, "id"> = getCurrentDemoUser(),
  expected?: V4AuditExpectation
): FiveSAudit | undefined {
  initializeStore();

  const existingAudit =
    getFiveSAuditById(
      auditId
    );

  if (
    !existingAudit
  ) {
    console.warn(
      `5S audit not found: ${auditId}`
    );

    return undefined;
  }

  assertVersionedMutation(existingAudit, expected);
  if (!canCompleteFiveSAudit(existingAudit, actor)) return undefined;
  validateScopedAuditSections(existingAudit, sections);
  if (existingAudit.status === "Completed") return existingAudit;
  if (!auditSectionsHaveConsistentScoring(existingAudit, sections)) return undefined;
  const questions = sections.flatMap(section => section.questions);
  if (!questions.length || !questions.every(question => isAuditQuestionComplete(question, { ...question, score: question.score ?? null }, getAuditScoringValues(existingAudit)))) return undefined;

  if (isV4Audit(existingAudit)) {
    const canonical = readCanonicalActions();
    for (const q of questions) if ([0, 1].includes(questionComplianceResponse(q) ?? -1)) {
      const matches = canonical.filter(a => a.id === q.actionId && a.policyVersion === "ops-access-v4" && a.organizationId === existingAudit.organizationId && a.plantId === existingAudit.plantId && a.zoneId === existingAudit.zoneId && a.departmentId === q.departmentId && a.auditId === auditId && a.questionId === q.id && a.sourceObservationId === q.id && a.responsiblePersonId && !getRecordTombstone("action", a.id));
      if (matches.length !== 1) return undefined;
    }
  }
  if (isScopedAudit(existingAudit) && existingAudit.auditorSignature?.userId !== getAuthenticatedDemoActor(actor.id)?.user.id) return undefined;
  if (!existingAudit.auditorSignature) {
    console.warn(`Auditor signature is required before completing 5S audit: ${auditId}`);
    return undefined;
  }

  const now =
    new Date();

  const completedAudit: FiveSAudit = {
    ...existingAudit,

    status: "Completed",

    score:
      calculateScore(
        sections
      ),

    maxScore:
      calculateMaxScore(
        sections
      ),

    completionPercentage:
      calculateCompletionPercentage(
        sections
      ),

    sections: structuredClone(auditUsesCustomScoring(existingAudit) ? sections.map(section => ({ ...section, ...calculateAuditSectionTotals([section]) })) : sections),

    completedAt:
      now.toISOString(),
  };

  audits =
    audits.map(
      (audit) =>
        audit.id ===
        auditId
          ? completedAudit
          : audit
    );

  persistAudits();

  emitChange();

  return completedAudit;
}

/* =========================================================
   SET ALL AUDITS
   ========================================================= */

export function setFiveSAudits(
  nextAudits: FiveSAudit[]
): void {
  initializeStore();

  if (requiresScopedAuditPolicy() || nextAudits.some(isScopedAudit) || audits.some(isScopedAudit)) throw new Error("Bulk replacement cannot mutate scoped Audits.");
  audits = [
    ...nextAudits,
  ];

  persistAudits();

  emitChange();
}

/* =========================================================
   DELETE AUDIT
   ========================================================= */

export function canDeleteFiveSAudit(audit: FiveSAudit, actor: Pick<DemoUser, "id"> = getCurrentDemoUser()) {
  return Boolean(getAuthenticatedDemoActor(actor.id) && canDeleteOperationalRecord("audit", audit.id));
}

export function deleteFiveSAudit(auditId: string, actor: Pick<DemoUser, "id"> = getCurrentDemoUser(), confirmed = false): boolean {
  if (!getAuthenticatedDemoActor(actor.id)) return false;
  try { deleteOperationalRecord("audit", auditId, confirmed); return true; } catch { return false; }
}

/* =========================================================
   RESET DEMO DATA
   ========================================================= */

export function resetFiveSAudits(): void {
  initializeStore();
  if (!isLegacyABCOperationalContext(getActiveAccessContext()) || requiresScopedAuditPolicy() || audits.some(isScopedAudit)) throw new Error("Demo reset cannot remove scoped Audits or populate a foreign factory.");
  audits = [
    ...FIVE_S_AUDITS,
  ];

  /**
   * Reset the audit number counter too.
   *
   * The next generated audit will start after
   * the highest generated 5S number in the demo data.
   */
  if (
    typeof window !== "undefined"
  ) {
    const highest =
      getHighestAuditNumber();

    safeSetStorageString(AUDIT_NUMBER_STORAGE_KEY, String(highest + 1));

    window.localStorage.removeItem(
      AUDIT_SEQUENCE_STORAGE_KEY
    );
  }

  persistAudits();

  emitChange();
}

/* =========================================================
   CLEAR PERSISTED DATA
   ========================================================= */

export function clearFiveSAuditStorage(): void {
  initializeStore();
  if (!isLegacyABCOperationalContext(getActiveAccessContext()) || requiresScopedAuditPolicy() || audits.some(isScopedAudit)) throw new Error("Demo reset cannot remove scoped Audits or populate a foreign factory.");
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    window.localStorage.removeItem(
      STORAGE_KEY
    );

    window.localStorage.removeItem(
      AUDIT_NUMBER_STORAGE_KEY
    );

    window.localStorage.removeItem(
      AUDIT_SEQUENCE_STORAGE_KEY
    );

    audits = [
      ...FIVE_S_AUDITS,
    ];

    initializedFromStorage =
      true;

    emitChange();
  } catch (error) {
    console.error(
      "Failed to clear 5S audit storage:",
      error
    );
  }
}

registerRecordCreationStore(STORAGE_KEY, () => { initializedFromStorage = false; loadFromStorage(); });

registerActionCreationSource("audit", (input, user) => {
  const audit = input.sourceId ? getFiveSAuditById(input.sourceId) : undefined;
  const question = audit?.sections.flatMap(section => section.questions).find(item => item.id === input.sourceObservationId);
  return { record: audit, zone: audit?.area, permitted: Boolean(question && user.permissions.includes("actions.create") && user.permissions.includes("audits.view")), alreadyLinked: question?.actionId };
});

/** Durable canonical question link; a failed write leaves the Audit unchanged. */
export function linkAuditQuestionAction(auditId: string, questionId: string, actionId: string, actor: Pick<DemoUser, "id">) {
  const user = getAuthenticatedDemoActor(actor.id)?.user;
  const audit = getFiveSAuditById(auditId);
  if (audit && isV4Audit(audit)) throw new Error("Use atomic Audit-question corrective Action creation.");
  if (audit) requireAuditExecution(audit, actor.id);
  const action = getActions().find(item=>item.id===actionId);
  const question = audit?.sections.flatMap(section=>section.questions).find(item=>item.id===questionId);
  if (!user || !audit || audit.status === "Completed" || !question || (question.actionId && question.actionId !== actionId) || !action
    || !user.permissions.includes("actions.create") || !user.permissions.includes("audits.view") || action.createdByUserId !== user.id
    || action.sourceModule !== "audit" || action.sourceId !== auditId || action.questionId !== questionId || action.sourceObservationId !== questionId
    || action.plant !== audit.plant || action.area !== audit.area) return false;
  const evidence = (action.issueEvidence ?? []).map(item=>normalizeAuditEvidence({id:item.id,name:item.name,type:item.type,size:0,dataUrl:item.url ?? "",storageKey:item.storageKey,uploadedAt:item.uploadedAt,uploadedBy:item.uploadedBy}));
  const next = normalizeAuditEvidenceRecords(audits).map(item=>item.id!==auditId?item:{...item,sections:item.sections.map(section=>({...section,questions:section.questions.map(q=>q.id!==questionId?q:{...q,actionId,actionRequired:true,evidence})}))});
  if (!safeSetStorage(STORAGE_KEY,next).success) return false;
  audits=next;emitChange();return true;
}

/** Move legacy binaries only after IndexedDB confirms durability, then persist references. */
export async function compactAuditEvidenceStorage() {
  initializeStore();
  if (requiresScopedAuditPolicy()) return;
  for (const audit of audits.filter(a => !isScopedAudit(a))) for (const section of audit.sections) for (const question of section.questions) {
    for (const evidence of question.evidence ?? []) await persistAuditEvidence(evidence);
  }
  // Rebase after async asset writes so edits made while processing are retained.
  const next=audits.map(a => isScopedAudit(a) ? a : normalizeAuditEvidenceRecords([a])[0]);
  if (next.every((audit,index)=>audit===audits[index])) return;
  const result=safeSetStorage(STORAGE_KEY,next);
  if (!result.success) throw new Error(result.message);
  audits=next;emitChange();
}

registerDeletionSource("audit", id => { initializeStore(); const item = audits.find(item => item.id === id); return item ? { id: item.id, title: item.title, organizationId: "organizationId" in item && typeof item.organizationId === "string" ? item.organizationId : undefined, plant: item.plant, zone: item.area, aliases: [item.title], linkedActionIds: item.sections.flatMap(section => section.questions.flatMap(question => question.actionId ? [question.actionId] : [])) } : undefined; });

export function reassignFiveSAudit(auditId: string, auditorId: string, reason: string) {
  initializeStore();
  if (getRecordTombstone("audit", auditId)) throw new Error("Audit is deleted.");
  const result = reassignAuditAdministrator(auditId, auditorId, reason);
  audits = result.records; committedAudits = audits; lastAuditPayload = window.localStorage.getItem(STORAGE_KEY); emitChange(); return result.audit;
}
export async function persistFiveSAuditEvidence(auditId: string, evidence: Parameters<typeof persistAuditEvidence>[0], expected?: V4AuditExpectation) {
  initializeStore();
  const authorize = () => { const audit = audits.find(a => a.id === auditId); if (!audit) throw new Error("Audit not found."); requireAuditExecution(audit); };
  authorize();
  const current = audits.find(a => a.id === auditId)!;
  if (isV4Audit(current)) {
    assertVersionedMutation(current, expected);
    const blob = dataUrlToBlob(evidence.dataUrl); if (!blob) throw new Error("A valid new binary upload is required.");
    const receipt = await storeV4Evidence(auditId, blob, expected!.selectionId, () => { const latest = getFiveSAuditById(auditId); if (!latest) throw new Error("Audit unavailable."); assertVersionedMutation(latest, expected); requireAuditExecution(latest); });
    return { ...evidence, ...receipt, dataUrl: "" };
  }
  return persistAuditEvidence(evidence, auditId);
}

function validateScopedAuditSections(audit: FiveSAudit, sections: FiveSAudit["sections"]) {
  if (!requiresScopedAuditPolicy(audit)) return;
  if (isV4Audit(audit)) for (const section of sections) for (const q of section.questions) {
    const old = audit.sections.flatMap(s => s.questions).find(original => original.id === q.id);
    const mutable = new Set(["score", "complianceResponse", "status", "observation", "evidence", "actionRequired", "textResponse", "yesNoResponse"]);
    if (!old || Object.keys({ ...old, ...q }).some(k => !mutable.has(k) && JSON.stringify(old[k as keyof typeof old]) !== JSON.stringify(q[k as keyof typeof q]))) throw new Error("Canonical question snapshot/Department/link is immutable.");
    assertV4EvidenceReferences(q.evidence ?? [], audit.id, audit.organizationId!, audit.plantId!);
  }
  if (sections.length !== audit.sections.length || sections.some((section, i) => section.category !== audit.sections[i].category || section.questions.length !== audit.sections[i].questions.length || section.questions.some((q, j) => {
    const old = audit.sections[i].questions[j];
    return q.id !== old.id || q.question !== old.question || q.actionId !== old.actionId;
  }))) throw new Error("Audit checklist identity and linked Actions cannot be replaced through execution updates.");
}

function assertVersionedMutation(audit: FiveSAudit, expected?: V4AuditExpectation) {
  if (!isV4Audit(audit)) return;
  if (!expected) throw new Error("Use the displayed Audit revision and context.");
  requireV4AuditContext(audit, expected);
}
