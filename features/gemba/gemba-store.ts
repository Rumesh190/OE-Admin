"use client";
import { canWriteLegacyOperational, requireLegacyOperationalWrite } from "@/lib/legacy-operational-write";
import { useMemo } from "react";
import { activeOperationalRecords, useRecordDeletions, getRecordTombstone, registerDeletionSource } from "@/lib/records/record-tombstones";


import { registerActionCreationSource } from "@/lib/actions/action-source-access";

import { allocateModuleRecordId, registerRecordCreationStore } from "@/lib/records/module-records";

import { resetImportedRedTagData } from "@/lib/five-s/red-tag-reset";

import { useSyncExternalStore } from "react";
import { canMutateGembaWalk } from "./gemba-access";

import { safeSetStorage } from "@/lib/browser-storage";
import { dataUrlToBlob, isGembaPhotoStorageAvailable, saveGembaPhoto } from "@/lib/gemba/gemba-photo-storage";
import { getAdminUser } from "@/features/five-s/administration/store";
import { tryCreateNotification } from "@/lib/notifications/notification-store";
import { deploymentObservationHref, getDeploymentRecipients } from "./gemba-deployment";
import { getOrganizationZones } from "@/lib/organization-store";
import type {
  GembaActor,
  GembaEvidence,
  GembaHorizontalDeployment,
  GembaHorizontalDeploymentRecipient,
  GembaObservation,
  GembaObservationType,
  GembaParticipant,
  GembaState,
  GembaVoiceNote,
  GembaWalk,
} from "./types";

export const GEMBA_STORAGE_KEY = "ops-gemba-v1";
const STORAGE_KEY = GEMBA_STORAGE_KEY;

/**
 * Defensive safeguard (not just an at-capture-time convention): strips any
 * `data:`/`blob:` URL before an observation's evidence is persisted, so a
 * future bug in the capture UI can never reintroduce embedded photo binary
 * into localStorage. The photo Blob itself lives in IndexedDB; only its
 * `storageKey` reference (or a genuinely lightweight static path, e.g. seed
 * demo assets) is safe to keep in the persisted `url` field.
 */
function sanitizeEvidenceForPersist(evidence: GembaEvidence[]): GembaEvidence[] {
  return evidence.map((item) => {
    if (typeof item.url === "string" && (item.url.startsWith("data:") || item.url.startsWith("blob:"))) {
      const { url, ...rest } = item;
      void url;
      return rest;
    }
    return item;
  });
}

const SEED_OBSERVATIONS: GembaObservation[] = [
  {
    id: "GEM-2026-014-OBS-01", gembaId: "GEM-2026-014", type: "Issue",
    title: "Material blocking emergency exit", description: "Two return-material pallets were inside the marked emergency-exit clearance area.",
    location: "Packing Area", peopleInvolved: ["Siva Kumar"],
    evidence: [{ id: "GEM-EV-014-01", name: "blocked-exit.jpg", url: "/demo-5s/not-good-example.png", mimeType: "image/jpeg", uploadedAt: "2026-09-12T10:18:00+05:30", uploadedBy: "Rumesh", note: "Exit route before correction" }],
    createdById: "USR-RUMESH", createdByName: "Rumesh", createdAt: "2026-09-12T10:18:00+05:30", updatedAt: "2026-09-12T10:24:00+05:30", actionId: "ACT-GEM-014-01",
  },
  {
    id: "GEM-2026-014-OBS-02", gembaId: "GEM-2026-014", type: "Positive",
    title: "Tools correctly stored and labelled", description: "The packing changeover tools were returned to clearly labelled shadow-board positions.",
    location: "Packing Area", peopleInvolved: ["Raj Kumar"],
    evidence: [{ id: "GEM-EV-014-02", name: "tool-board.jpg", url: "/demo-5s/good-example.png", mimeType: "image/jpeg", uploadedAt: "2026-09-12T10:26:00+05:30", uploadedBy: "Rumesh" }],
    createdById: "USR-RUMESH", createdByName: "Rumesh", createdAt: "2026-09-12T10:26:00+05:30", updatedAt: "2026-09-12T10:26:00+05:30",
  },
  {
    id: "GEM-2026-014-OBS-03", gembaId: "GEM-2026-014", type: "Opportunity",
    title: "Move label stock closer to point of use", description: "Operators walk to the far rack several times per batch to collect label rolls.",
    location: "Label Station", peopleInvolved: ["Suburamiani"], evidence: [],
    createdById: "USR-RUMESH", createdByName: "Rumesh", createdAt: "2026-09-12T10:34:00+05:30", updatedAt: "2026-09-12T10:40:00+05:30", actionId: "ACT-GEM-014-02",
  },
  {
    id: "GEM-2026-014-OBS-04", gembaId: "GEM-2026-014", type: "Issue",
    title: "Loose stretch-wrap corrected during walk", description: "Loose film created a trip risk beside the pallet wrapper and was removed immediately.",
    location: "Dispatch Lane", peopleInvolved: [], evidence: [], noActionReason: "No action required — corrected immediately.",
    createdById: "USR-RUMESH", createdByName: "Rumesh", createdAt: "2026-09-12T10:46:00+05:30", updatedAt: "2026-09-12T10:46:00+05:30",
  },
  {
    id: "GEM-2026-015-OBS-01", gembaId: "GEM-2026-015", type: "Positive",
    title: "First-piece check is clearly visible", description: "Operators can see the approved sample and acceptance points without leaving the workstation.",
    location: "Assembly Cell 2", peopleInvolved: ["Ritika"],
    evidence: [{ id: "GEM-EV-015-01", name: "first-piece-board.jpg", url: "/demo-5s/good-example.png", mimeType: "image/jpeg", uploadedAt: "2026-09-14T09:20:00+05:30", uploadedBy: "Lakshman" }],
    createdById: "USR-LAKSHMAN", createdByName: "Lakshman", createdAt: "2026-09-14T09:20:00+05:30", updatedAt: "2026-09-14T09:20:00+05:30",
  },
  {
    id: "GEM-2026-015-OBS-02", gembaId: "GEM-2026-015", type: "Issue",
    title: "Coolant container missing identification", description: "A refill container beside CNC-03 has no contents or hazard label.",
    location: "CNC-03", peopleInvolved: ["James"], evidence: [],
    createdById: "USR-LAKSHMAN", createdByName: "Lakshman", createdAt: "2026-09-14T09:31:00+05:30", updatedAt: "2026-09-14T09:31:00+05:30",
  },
  {
    id: "GEM-2026-011-OBS-01", gembaId: "GEM-2026-011", type: "Positive",
    title: "Cleaning station is maintained", description: "All cleaning equipment is present, labelled, and ready for use.",
    location: "Cleaning Point", peopleInvolved: ["Meena"], evidence: [],
    createdById: "USR-LAKSHMAN", createdByName: "Lakshman", createdAt: "2026-09-04T14:12:00+05:30", updatedAt: "2026-09-04T14:12:00+05:30",
  },
  {
    id: "GEM-2026-011-OBS-02", gembaId: "GEM-2026-011", type: "Opportunity",
    title: "Add min-max markers to consumable rack", description: "Simple markers would make replenishment needs visible before stock runs out.",
    location: "Consumables Rack", peopleInvolved: ["Vijay"], evidence: [], noActionReason: "Team will trial visual markers during the next shift.",
    createdById: "USR-LAKSHMAN", createdByName: "Lakshman", createdAt: "2026-09-04T14:28:00+05:30", updatedAt: "2026-09-04T14:28:00+05:30",
  },
];

const SEED_WALKS: GembaWalk[] = [
  {
    id: "GEM-2026-015", plant: "Egmore Plant", zone: "Zone A", leadId: "USR-LAKSHMAN", leadName: "Lakshman",
    participants: [{ id: "USR-RITIKA", name: "Ritika", role: "Zone Member" }, { id: "USR-JAMES", name: "James", role: "Zone Member" }],
    purpose: "Observe material flow and first-piece quality controls", notes: "Morning shift walk", scheduledDate: "2026-09-14", status: "In Progress",
    createdAt: "2026-09-14T09:00:00+05:30", updatedAt: "2026-09-14T09:31:00+05:30", startedAt: "2026-09-14T09:10:00+05:30",
    observationIds: ["GEM-2026-015-OBS-01", "GEM-2026-015-OBS-02"], actionIds: [],
    activity: [
      { id: "GEM-ACT-015-01", type: "walk_started", label: "Walk started", userId: "USR-LAKSHMAN", userName: "Lakshman", at: "2026-09-14T09:10:00+05:30" },
      { id: "GEM-ACT-015-02", type: "observation_added", label: "Positive observation added", userId: "USR-LAKSHMAN", userName: "Lakshman", at: "2026-09-14T09:20:00+05:30", observationId: "GEM-2026-015-OBS-01" },
      { id: "GEM-ACT-015-03", type: "photo_uploaded", label: "Photo uploaded", userId: "USR-LAKSHMAN", userName: "Lakshman", at: "2026-09-14T09:20:00+05:30", observationId: "GEM-2026-015-OBS-01" },
      { id: "GEM-ACT-015-04", type: "observation_added", label: "Issue observation added", userId: "USR-LAKSHMAN", userName: "Lakshman", at: "2026-09-14T09:31:00+05:30", observationId: "GEM-2026-015-OBS-02" },
    ],
  },
  {
    id: "GEM-2026-016", plant: "Egmore Plant", zone: "Zone C", leadId: "USR-LAKSHMAN", leadName: "Lakshman",
    participants: [{ id: "USR-NASAR", name: "Nasar", role: "Zone Member" }], purpose: "Observe end-of-shift machine care", notes: "Coordinate with maintenance", scheduledDate: "2026-09-15", status: "Scheduled",
    createdAt: "2026-09-14T12:20:00+05:30", updatedAt: "2026-09-14T12:20:00+05:30", observationIds: [], actionIds: [],
    activity: [{ id: "GEM-ACT-016-01", type: "draft_saved", label: "Walk scheduled", userId: "USR-LAKSHMAN", userName: "Lakshman", at: "2026-09-14T12:20:00+05:30" }],
  },
  {
    id: "GEM-2026-014", plant: "Egmore Plant", zone: "Zone B", leadId: "USR-RUMESH", leadName: "Rumesh",
    participants: [{ id: "USR-SIVA-KUMAR", name: "Siva Kumar", role: "Zone Member" }, { id: "USR-RAJ-KUMAR", name: "Raj Kumar", role: "Zone Member" }, { id: "USR-SUBURAMIANI", name: "Suburamiani", role: "Zone Member" }],
    purpose: "Observe packing safety and motion waste", scheduledDate: "2026-09-12", status: "Completed",
    createdAt: "2026-09-12T09:58:00+05:30", updatedAt: "2026-09-12T11:10:00+05:30", startedAt: "2026-09-12T10:05:00+05:30", completedAt: "2026-09-12T11:10:00+05:30",
    observationIds: ["GEM-2026-014-OBS-01", "GEM-2026-014-OBS-02", "GEM-2026-014-OBS-03", "GEM-2026-014-OBS-04"], actionIds: ["ACT-GEM-014-01", "ACT-GEM-014-02"],
    activity: [
      { id: "GEM-ACT-014-01", type: "walk_started", label: "Walk started", userId: "USR-RUMESH", userName: "Rumesh", at: "2026-09-12T10:05:00+05:30" },
      { id: "GEM-ACT-014-02", type: "observation_added", label: "Issue observation added", userId: "USR-RUMESH", userName: "Rumesh", at: "2026-09-12T10:18:00+05:30", observationId: "GEM-2026-014-OBS-01" },
      { id: "GEM-ACT-014-03", type: "photo_uploaded", label: "Photo uploaded", userId: "USR-RUMESH", userName: "Rumesh", at: "2026-09-12T10:18:00+05:30", observationId: "GEM-2026-014-OBS-01" },
      { id: "GEM-ACT-014-04", type: "action_created", label: "Action ACT-GEM-014-01 created", userId: "USR-RUMESH", userName: "Rumesh", at: "2026-09-12T10:24:00+05:30", observationId: "GEM-2026-014-OBS-01", actionId: "ACT-GEM-014-01" },
      { id: "GEM-ACT-014-05", type: "walk_completed", label: "Walk completed", userId: "USR-RUMESH", userName: "Rumesh", at: "2026-09-12T11:10:00+05:30" },
    ],
  },
  {
    id: "GEM-2026-011", plant: "Egmore Plant", zone: "Zone D", leadId: "USR-LAKSHMAN", leadName: "Lakshman",
    participants: [{ id: "USR-MEENA", name: "Meena", role: "Zone Member" }, { id: "USR-VIJAY", name: "Vijay", role: "Zone Member" }],
    purpose: "Observe workplace readiness and replenishment", scheduledDate: "2026-09-04", status: "Completed",
    createdAt: "2026-09-04T13:52:00+05:30", updatedAt: "2026-09-04T14:45:00+05:30", startedAt: "2026-09-04T14:00:00+05:30", completedAt: "2026-09-04T14:45:00+05:30",
    observationIds: ["GEM-2026-011-OBS-01", "GEM-2026-011-OBS-02"], actionIds: [],
    activity: [
      { id: "GEM-ACT-011-01", type: "walk_started", label: "Walk started", userId: "USR-LAKSHMAN", userName: "Lakshman", at: "2026-09-04T14:00:00+05:30" },
      { id: "GEM-ACT-011-02", type: "walk_completed", label: "Walk completed", userId: "USR-LAKSHMAN", userName: "Lakshman", at: "2026-09-04T14:45:00+05:30" },
    ],
  },
];

export const GEMBA_SEED_STATE: GembaState = { walks: SEED_WALKS, observations: SEED_OBSERVATIONS };

let state: GembaState = GEMBA_SEED_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  resetImportedRedTagData();
  loaded = true;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const parsed = JSON.parse(saved) as Partial<GembaState>;
    if (Array.isArray(parsed.walks) && Array.isArray(parsed.observations)) state = parsed as GembaState;
  } catch { /* keep the complete demo state */ }
  if (!canWriteLegacyOperational("gemba")) return;
  normalizeLegacyWalkStatuses();
  // Fire-and-forget: migrates any legacy embedded photo payloads out of this
  // already-loaded state into IndexedDB, then re-persists once. The UI keeps
  // working with the (larger) pre-migration data in the meantime; when
  // migration finishes it calls persist(), which notifies subscribers like
  // any other store mutation, so the smaller/cleaned evidence just replaces
  // it in place — no separate loading state needed.
  void migrateLegacyGembaPhotos();
}

/**
 * Backward-compatible, synchronous status normalization: legacy walks were
 * created with status "Draft" for "not started yet"; that concept is now
 * called "Scheduled". Existing persisted records are upgraded in place (once,
 * on load) rather than requiring a destructive migration or supporting two
 * parallel status names throughout the UI.
 */
function normalizeLegacyWalkStatuses() {
  if (!state.walks.some((walk) => walk.status === "Draft")) return;
  const walks = state.walks.map((walk) => (walk.status === "Draft" ? { ...walk, status: "Scheduled" as const } : walk));
  persist({ ...state, walks });
}

let migrationStarted = false;

/**
 * One-time, idempotent migration of legacy base64/data-URL Gemba photo
 * evidence into IndexedDB. Safe to call more than once (e.g. across HMR) —
 * guarded so it only runs once per page session, and each item is only
 * migrated if it still has a `data:` payload (already-migrated or
 * static/seed evidence is left untouched, making repeat runs no-ops).
 */
async function migrateLegacyGembaPhotos() {
  if (migrationStarted) return;
  migrationStarted = true;
  if (!isGembaPhotoStorageAvailable()) return;

  const pending: Array<{ observationId: string; evidenceId: string; storageKey: string; blob: Blob }> = [];
  for (const observation of state.observations) {
    for (const item of observation.evidence) {
      if (typeof item.url === "string" && item.url.startsWith("data:image")) {
        const blob = dataUrlToBlob(item.url);
        if (blob) pending.push({ observationId: observation.id, evidenceId: item.id, storageKey: item.id, blob });
      }
    }
  }
  if (!pending.length) return;

  const migrated = new Set<string>();
  for (const item of pending) {
    if (!canWriteLegacyOperational("gemba")) return;
    try {
      // Only remove the legacy embedded payload after the Blob is confirmed saved.
      await saveGembaPhoto(item.storageKey, item.blob);
      migrated.add(item.evidenceId);
    } catch (error) {
      console.error(`[gemba] failed to migrate photo evidence ${item.evidenceId}; leaving legacy payload in place for retry`, error);
    }
  }
  if (!migrated.size || !canWriteLegacyOperational("gemba")) return;

  // Re-read the freshest state (not a snapshot captured before the awaits
  // above) so a concurrent save during migration is never clobbered.
  const latest = getGembaState();
  const observations = latest.observations.map((observation) => {
    if (!observation.evidence.some((item) => migrated.has(item.id))) return observation;
    return {
      ...observation,
      evidence: observation.evidence.map((item) =>
        migrated.has(item.id) ? { ...item, url: undefined, storageKey: item.id } : item
      ),
    };
  });
  persist({ walks: latest.walks, observations });
}

let lastSaveError = "";
export function getGembaSaveError() { return lastSaveError; }
function persist(next: GembaState) {
  requireLegacyOperationalWrite("gemba");
  lastSaveError = "";
  const previous = state;
  state = next;
  const result = safeSetStorage(STORAGE_KEY, state);
  if (!result.success) { lastSaveError = result.message; state = previous; return false; }
  listeners.forEach((listener) => listener());
  return true;
}

function subscribe(listener: () => void) { load(); listeners.add(listener); return () => listeners.delete(listener); }
function snapshot() { load(); return state; }
function serverSnapshot() { return GEMBA_SEED_STATE; }

export function useGembaStore() { const raw = useSyncExternalStore(subscribe, snapshot, serverSnapshot); const deleted = useRecordDeletions(); return useMemo(() => activeGembaState(raw, deleted), [raw, deleted]); }
function activeGembaState(raw: GembaState, deleted?: ReturnType<typeof useRecordDeletions>): GembaState { const walks = activeOperationalRecords("gemba", raw.walks, deleted); const observations = activeOperationalRecords("gembaObservation", raw.observations, deleted).filter(item => !getRecordTombstone("gemba", item.gembaId)); return { ...raw, walks, observations }; }
export function getGembaState() { load(); return activeGembaState(state); }
export function getGembaWalk(id: string) { load(); if (getRecordTombstone("gemba", id)) return undefined; return state.walks.find((walk) => walk.id === id); }
export function getGembaObservations(walkId: string) { load(); return getGembaState().observations.filter((observation) => observation.gembaId === walkId); }

function nextWalkId() {
  return allocateModuleRecordId("gemba", state.walks.map(walk => walk.id));
}

function nextObservationId(walkId: string) {
  const prefix = `${walkId}-OBS-`;
  const number = state.observations.reduce((max, observation) => observation.id.startsWith(prefix) ? Math.max(max, Number(observation.id.slice(prefix.length)) || 0) : max, 0) + 1;
  return `${prefix}${String(number).padStart(2, "0")}`;
}

function event(type: GembaWalk["activity"][number]["type"], label: string, actor: GembaActor, extra: Partial<GembaWalk["activity"][number]> = {}) {
  return { id: `GEM-ACT-${crypto.randomUUID()}`, type, label, userId: actor.id, userName: actor.name, at: new Date().toISOString(), ...extra };
}

export interface CreateGembaWalkInput {
  plant: string;
  zone: string;
  leadId: string;
  leadName: string;
  participants: GembaParticipant[];
  purpose: string;
  notes?: string;
  scheduledDate: string;
  scheduledTime?: string;
}

export function createGembaWalk(input: CreateGembaWalkInput, actor: GembaActor, startNow: boolean) {
  load();
  if (!canMutateGembaWalk(input, actor)) return null;
  if (!getAdminUser(input.leadId) || getAdminUser(input.leadId)?.status !== "Active" || input.participants.some(person => getAdminUser(person.id)?.status !== "Active")) return null;
  const now = new Date().toISOString();
  const walk: GembaWalk = {
    ...input, id: nextWalkId(), status: startNow ? "In Progress" : "Scheduled", createdAt: now, updatedAt: now,
    startedAt: startNow ? now : undefined, observationIds: [], actionIds: [],
    activity: [event(startNow ? "walk_started" : "draft_saved", startNow ? "Walk started" : "Walk scheduled", actor)],
  };
  return persist({ ...state, walks: [walk, ...state.walks] }) ? walk : null;
}

export function startGembaWalk(walkId: string, actor: GembaActor) {
  load();
  const selected = getGembaWalk(walkId);
  if (!selected || selected.status !== "Scheduled" || !canMutateGembaWalk(selected, actor)) return false;
  const now = new Date().toISOString();
  const next = state.walks.map((walk) => walk.id === walkId && walk.status === "Scheduled" ? {
    ...walk, status: "In Progress" as const, startedAt: now, updatedAt: now, activity: [...walk.activity, event("walk_started", "Walk started", actor)],
  } : walk);
  return persist({ ...state, walks: next });
}

export interface GembaWalkSetupPatch {
  plant?: string;
  zone?: string;
  leadId?: string;
  leadName?: string;
  participants?: GembaParticipant[];
  purpose?: string;
  notes?: string;
  scheduledDate?: string;
  scheduledTime?: string;
}

/**
 * Updates a walk's own setup fields (plant/zone/leader/participants/purpose/
 * notes/schedule). Only allowed while the walk is still "Scheduled" — once a
 * walk is "In Progress" (or "Completed"), its original setup is locked and
 * this returns null instead of mutating anything. There is currently no UI
 * calling this yet; it exists as the enforced guard for that rule.
 */
export function updateGembaWalkSetup(walkId: string, patch: GembaWalkSetupPatch, actor: GembaActor) {
  load();
  const walk = getGembaWalk(walkId);
  if (!walk || !canMutateGembaWalk(walk, actor)) return null;
  if (walk.status !== "Scheduled" || !canMutateGembaWalk({ ...walk, ...patch }, actor)) return null;
  if (patch.leadId && getAdminUser(patch.leadId)?.status !== "Active") return null;
  if (patch.participants?.some(person => getAdminUser(person.id)?.status !== "Active")) return null;
  const now = new Date().toISOString();
  const updated: GembaWalk = { ...walk, ...patch, updatedAt: now, activity: [...walk.activity, event("draft_saved", "Walk setup updated", actor)] };
  const walks = state.walks.map((item) => (item.id === walkId ? updated : item));
  return persist({ ...state, walks }) ? updated : null;
}

export interface SaveObservationInput {
  type: GembaObservationType;
  title: string;
  description: string;
  location: string;
  peopleInvolved: string[];
  evidence: GembaEvidence[];
  voiceNote?: GembaVoiceNote;
  correctiveActionNeeded?: boolean;
  noActionReason?: string;
  horizontalDeployment?: {
    enabled: boolean;
    targetZoneIds?: string[];
  };
}

/** Legacy selected-Zone validation only; canonical saves use automatic Plant broadcast. */
export function validateGembaHorizontalDeployment(sourceZone: string, enabled: boolean, targetZoneIds: string[]) {
  if (!enabled) return null;
  const zones = getOrganizationZones().filter((zone) => zone.status === "Active");
  const source = zones.find((zone) => zone.id === sourceZone || zone.name === sourceZone);
  const validTargets = new Set(zones.filter((zone) => zone.id !== source?.id && zone.name !== sourceZone).map((zone) => zone.id));
  if (!targetZoneIds.some((zoneId) => validTargets.has(zoneId))) return "Select at least one other target zone.";
  return null;
}

/** Legacy metadata resolver retained for compatibility; never used to grant access or save broadcasts. */
export function resolveGembaHorizontalDeployment(
  sourceZone: string,
  targetZoneIds: string[],
  now: string,
  existing?: GembaHorizontalDeployment,
): GembaHorizontalDeployment {
  const zones = getOrganizationZones().filter((zone) => zone.status === "Active");
  const source = zones.find((zone) => zone.id === sourceZone || zone.name === sourceZone);
  const uniqueTargets = [...new Set(targetZoneIds)];
  const recipients: GembaHorizontalDeploymentRecipient[] = uniqueTargets.flatMap((zoneId) => {
    const zone = zones.find((candidate) => candidate.id === zoneId);
    if (!zone || zone.id === source?.id || zone.name === sourceZone) return [];
    const leader = getAdminUser(zone.leaderId);
    const previous = existing?.recipients.find((recipient) => recipient.zoneId === zone.id && recipient.leaderUserId === leader?.id);
    if (previous) return [{ ...previous, zoneName: zone.name }];
    return [{
      zoneId: zone.id,
      zoneName: zone.name,
      leaderUserId: leader?.status === "Active" ? leader.id : undefined,
      leaderName: leader?.status === "Active" ? leader.name : undefined,
      notificationStatus: leader?.status === "Active" ? "shared" as const : "unavailable" as const,
    }];
  });
  return {
    enabled: true,
    targetZoneIds: recipients.map((recipient) => recipient.zoneId),
    recipients,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

export function saveGembaObservation(walkId: string, input: SaveObservationInput, actor: GembaActor, observationId?: string): GembaObservation | null {
  if (observationId && getRecordTombstone("gembaObservation", observationId)) return null;
  load();
  const walk = getGembaWalk(walkId);
  if (!walk || !canMutateGembaWalk(walk, actor)) return null;
  if (!walk || walk.status !== "In Progress") return null;
  const now = new Date().toISOString();
  const existing = observationId ? state.observations.find((item) => item.id === observationId && item.gembaId === walkId) : undefined;
  const resolvedRecipients = input.horizontalDeployment?.enabled ? getDeploymentRecipients(walk.plant) : [];
  const personalKeys = new Map<string, string>();
  const recipients = resolvedRecipients.map(recipient => {
    if (!recipient.leaderUserId) return recipient;
    const previous = existing?.horizontalDeployment?.recipients.find(item => item.leaderUserId === recipient.leaderUserId && item.notificationKey);
    const notificationKey = personalKeys.get(recipient.leaderUserId) ?? previous?.notificationKey ?? `gemba-deployment:${walkId}:${existing?.id ?? "new"}:${crypto.randomUUID()}`;
    personalKeys.set(recipient.leaderUserId, notificationKey);
    return { ...recipient, notificationKey, notificationStatus: previous?.notificationId ? "shared" as const : "unavailable" as const, notificationId: previous?.notificationId };
  });
  const horizontalDeployment: GembaHorizontalDeployment | undefined = input.horizontalDeployment?.enabled ? {
    enabled: true, policy: "same-plant-broadcast", recipients,
    targetZoneIds: recipients.map(recipient => recipient.zoneId),
    createdAt: existing?.horizontalDeployment?.createdAt ?? now, updatedAt: now,
  } : undefined;
  const changedDeployment = existing?.horizontalDeployment && (!horizontalDeployment || JSON.stringify(existing.horizontalDeployment.recipients) !== JSON.stringify(horizontalDeployment.recipients) || existing.horizontalDeployment.policy !== horizontalDeployment.policy);
  const horizontalDeploymentHistory = changedDeployment
    ? [...(existing?.horizontalDeploymentHistory ?? []), { deployment: existing!.horizontalDeployment!, at: now, actorId: actor.id }]
    : existing?.horizontalDeploymentHistory;
  const { type, title, description, location, peopleInvolved, voiceNote, correctiveActionNeeded, noActionReason } = input;
  const observationInput = { type, title, description, location, peopleInvolved, voiceNote, correctiveActionNeeded, noActionReason };
  const sanitizedInput = { ...observationInput, evidence: sanitizeEvidenceForPersist(input.evidence), horizontalDeployment, horizontalDeploymentHistory };
  const observation: GembaObservation = existing
    ? { ...existing, ...sanitizedInput, updatedAt: now }
    : { ...sanitizedInput, id: nextObservationId(walkId), gembaId: walkId, createdById: actor.id, createdByName: actor.name, createdAt: now, updatedAt: now };
  const observations = existing ? state.observations.map((item) => item.id === observation.id ? observation : item) : [observation, ...state.observations];
  const activity = [...walk.activity, event(existing ? "observation_edited" : "observation_added", existing ? `Observation ${observation.id} edited` : `${observation.type} observation added`, actor, { observationId: observation.id })];
  const previousTargets = existing?.horizontalDeployment?.targetZoneIds ?? [];
  const nextTargets = horizontalDeployment?.targetZoneIds ?? [];
  if (!existing?.horizontalDeployment && horizontalDeployment) activity.push(event("horizontal_deployment_created", `Horizontal deployment enabled for ${nextTargets.length} zone${nextTargets.length === 1 ? "" : "s"}`, actor, { observationId: observation.id }));
  else if (existing?.horizontalDeployment && !horizontalDeployment) activity.push(event("horizontal_deployment_removed", "Horizontal deployment removed", actor, { observationId: observation.id }));
  else if (changedDeployment || previousTargets.join("|") !== nextTargets.join("|")) activity.push(event("horizontal_deployment_updated", `Horizontal deployment updated to ${nextTargets.length} zone${nextTargets.length === 1 ? "" : "s"}`, actor, { observationId: observation.id }));
  const photosAdded = Math.max(0, observation.evidence.length - (existing?.evidence.length ?? 0));
  if (photosAdded) activity.push(event("photo_uploaded", `${photosAdded} photo${photosAdded === 1 ? "" : "s"} uploaded`, actor, { observationId: observation.id }));
  if (observation.voiceNote && observation.voiceNote.id !== existing?.voiceNote?.id) activity.push(event("voice_note_added", "Voice note added", actor, { observationId: observation.id }));
  const walks = state.walks.map((item) => item.id === walkId ? { ...item, updatedAt: now, observationIds: existing ? item.observationIds : [...item.observationIds, observation.id], activity } : item);
  if (!persist({ walks, observations })) return null;

  if (!observation.horizontalDeployment) return observation;
  const notificationRecipients = observation.horizontalDeployment.recipients;
  const results = new Map<string, ReturnType<typeof tryCreateNotification>>();
  for (const recipient of notificationRecipients) {
    if (!recipient.leaderUserId || results.has(recipient.leaderUserId)) continue;
    results.set(recipient.leaderUserId, tryCreateNotification({
      recipientUserId: recipient.leaderUserId,
      deduplicationKey: recipient.notificationKey!,
      title: "Horizontal Deployment Opportunity",
      message: `${observation.title} · Shared from ${walk.zone} for review`,
      href: deploymentObservationHref(observation.id),
      context: { sourceModule: "gemba", observationId: observation.id, actorId: actor.id, zoneIds: notificationRecipients.filter(item => item.leaderUserId === recipient.leaderUserId).map(item => item.zoneId) },
    }));
  }
  const notifiedObservation: GembaObservation = {
    ...observation,
    horizontalDeployment: { ...observation.horizontalDeployment, recipients: notificationRecipients.map(recipient => {
      const result = recipient.leaderUserId ? results.get(recipient.leaderUserId) : undefined;
      return result?.success
        ? { ...recipient, notificationStatus: "shared", notificationId: result.notification.id, notificationError: undefined }
        : { ...recipient, notificationStatus: "unavailable", notificationId: undefined, notificationError: result && !result.success ? result.message : undefined };
    }) },
  };
  const notifiedObservations = state.observations.map(item => item.id === observation.id ? notifiedObservation : item);
  if (persist({ ...state, observations: notifiedObservations })) return notifiedObservation;
  // The observation is saved, but notification bookkeeping failed. The persisted
  // notification key makes a later save safe even if a notification already persisted.
  return { ...observation, horizontalDeployment: { ...observation.horizontalDeployment, recipients: notificationRecipients.map(recipient => ({ ...recipient, notificationStatus: "unavailable", notificationError: "Observation saved; notification confirmation could not be saved. Save again to retry." })) } };

}

export function linkGembaAction(walkId: string, observationId: string, actionId: string, actor: GembaActor) {
  load();
  const walk = getGembaWalk(walkId);
  if (!walk || !canMutateGembaWalk(walk, actor) || walk.status === "Completed") return false;
  const observation = state.observations.find((item) => item.id === observationId && item.gembaId === walkId);
  if (!walk || !observation || observation.actionId) return false;
  const now = new Date().toISOString();
  const observations = state.observations.map((item) => item.id === observationId && item.gembaId === walkId ? { ...item, actionId, correctiveActionNeeded: true, noActionReason: undefined, updatedAt: now } : item);
  const walks = state.walks.map((item) => item.id === walkId ? {
    ...item, updatedAt: now, actionIds: item.actionIds.includes(actionId) ? item.actionIds : [...item.actionIds, actionId],
    activity: [...item.activity, event("action_created", `Action ${actionId} created`, actor, { observationId, actionId })],
  } : item);
  return persist({ walks, observations });
}

export function linkGembaRedTag(walkId: string, observationId: string, redTagId: string, actor: GembaActor) {
  load();
  const walk = getGembaWalk(walkId);
  if (!walk || !canMutateGembaWalk(walk, actor) || walk.status === "Completed") return false;
  const observation = state.observations.find((item) => item.id === observationId && item.gembaId === walkId);
  if (!walk || !observation || observation.redTagId) return false;
  const now = new Date().toISOString();
  const observations = state.observations.map((item) => item.id === observationId && item.gembaId === walkId ? { ...item, redTagId, updatedAt: now } : item);
  const walks = state.walks.map((item) => item.id === walkId ? {
    ...item, updatedAt: now,
    activity: [...item.activity, event("red_tag_created", `Red Tag ${redTagId} created`, actor, { observationId, actionId: redTagId })],
  } : item);
  return persist({ walks, observations });
}

export function linkGembaImprovement(walkId: string, observationId: string, improvementId: string, actor: GembaActor) {
  lastSaveError = "";
  load();
  const walk = getGembaWalk(walkId);
  if (!walk || !canMutateGembaWalk(walk, actor) || walk.status === "Completed") return false;
  const observation = state.observations.find((item) => item.id === observationId && item.gembaId === walkId);
  if (!walk || !observation || observation.improvementId) return false;
  const now = new Date().toISOString();
  const observations = state.observations.map((item) => item.id === observationId && item.gembaId === walkId ? { ...item, improvementId, updatedAt: now } : item);
  const walks = state.walks.map((item) => item.id === walkId ? {
    ...item, updatedAt: now,
    activity: [...item.activity, event("red_tag_created", `Continual Improvement ${improvementId} created`, actor, { observationId, actionId: improvementId })],
  } : item);
  return persist({ walks, observations });
}

export function completeGembaWalk(walkId: string, actor: GembaActor) {
  load();
  const selected = getGembaWalk(walkId);
  if (!selected || selected.status !== "In Progress" || !canMutateGembaWalk(selected, actor)) return false;
  const now = new Date().toISOString();
  const walks = state.walks.map((walk) => walk.id === walkId && walk.status === "In Progress" ? {
    ...walk, status: "Completed" as const, completedAt: now, updatedAt: now,
    activity: [...walk.activity, event("walk_completed", "Walk completed", actor)],
  } : walk);
  return persist({ ...state, walks });
}

export function getGembaSummary(input: GembaState, now = new Date()) {
  const thisMonth = input.walks.filter((walk) => {
    const date = new Date(walk.startedAt ?? walk.scheduledDate);
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  });
  return {
    walksThisMonth: thisMonth.length,
    openObservations: input.observations.filter((item) => item.type !== "Positive" && !item.actionId && !item.noActionReason).length,
    actionsCreated: input.walks.reduce((sum, walk) => sum + walk.actionIds.length, 0),
    completedWalks: input.walks.filter((walk) => walk.status === "Completed").length,
    positiveObservations: input.observations.filter((item) => item.type === "Positive").length,
  };
}

registerRecordCreationStore(STORAGE_KEY, () => { loaded = false; load(); });

registerActionCreationSource("gemba", (input, user, identity) => {
  const current = getGembaState(), walk = current.walks.find(item => item.id === input.sourceId);
  const observation = current.observations.find(item => item.id === input.sourceObservationId && item.gembaId === walk?.id);
  return { record: walk, zone: walk?.zone, permitted: Boolean(walk && walk.status !== "Completed" && observation && observation.type !== "Positive" && canMutateGembaWalk(walk, identity)), alreadyLinked: observation?.actionId };
});

export function getGembaEvidenceArchive() { load(); return state; }
registerDeletionSource("gemba", id => { load(); const item = state.walks.find(item => item.id === id); const children = state.observations.filter(item => item.gembaId === id); return item ? { id, title: item.purpose, organizationId: "organizationId" in item && typeof item.organizationId === "string" ? item.organizationId : undefined, plant: item.plant, zone: item.zone, childIds: children.map(item => item.id), linkedActionIds: [...item.actionIds, ...children.flatMap(item => item.actionId ? [item.actionId] : [])] } : undefined; });
registerDeletionSource("gembaObservation", id => { load(); const item = state.observations.find(item => item.id === id); const walk = state.walks.find(walk => walk.id === item?.gembaId); return item && walk ? { id, title: item.title, organizationId: "organizationId" in walk && typeof walk.organizationId === "string" ? walk.organizationId : undefined, plant: walk.plant, zone: walk.zone, parentId: walk.id, linkedActionIds: item.actionId ? [item.actionId] : [] } : undefined; });
