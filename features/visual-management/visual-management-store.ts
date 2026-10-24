"use client";
import { requireLegacyOperationalWrite } from "@/lib/legacy-operational-write";
import { activeOperationalRecords, useRecordDeletions, getRecordTombstone, registerDeletionSource } from "@/lib/records/record-tombstones";


import { registerActionCreationSource } from "@/lib/actions/action-source-access";

import { allocateModuleRecordId, registerRecordCreationStore } from "@/lib/records/module-records";
import { canOperateVisualManagementBoard, type VisualManagementActor } from "./visual-management-access";

import { useMemo, useSyncExternalStore } from "react";
import type { MyAction } from "@/features/five-s/types/my-actions";
import { getActionById } from "@/lib/actions/action-store";
import { getAdminUser, getAdminUsers, useAdminUsers } from "@/features/five-s/administration/store";
import { safeSetStorage } from "@/lib/browser-storage";
import { getOrganizationPlants, getOrganizationZones, useOrganizationConfiguration } from "@/lib/organization-store";
import { createDefaultKpiEntries, nextTier } from "./visual-management-config";
import { getVisualManagementConfiguration, useVisualManagementConfiguration } from "./visual-management-configuration-store";
import { getKpiExecution, createMeetingKpiReviewSnapshots } from "./kpi-execution-store";
import type {
  VisualManagementBoard,
  VisualManagementDecision,
  VisualManagementEscalation,
  VisualManagementEscalationStatus,
  VisualManagementFollowUpType,
  VisualManagementKpiEntry,
  VisualManagementKpiSection,
  VisualManagementMeeting,
  VisualManagementParticipant,
  VisualManagementPerson,
  VisualManagementState,
  VisualManagementTopic,
} from "./types";

export const VISUAL_MANAGEMENT_STORAGE_KEY = "ops-visual-management-v1";
const STORAGE_KEY = VISUAL_MANAGEMENT_STORAGE_KEY;

const PEOPLE = {
  lakshman: { id: "USR-LAKSHMAN", name: "Lakshman" },
  rumesh: { id: "USR-RUMESH", name: "Rumesh" },
  ritika: { id: "USR-RITIKA", name: "Ritika" },
  siva: { id: "USR-SIVA-KUMAR", name: "Siva Kumar" },
  manoj: { id: "USR-MANOJ-GURU", name: "Manoj Guru" },
  meena: { id: "USR-MEENA", name: "Meena" },
  anand: { id: "USR-ANAND", name: "Anand" },
  madavan: { id: "USR-MADAVAN", name: "Madavan" },
} as const;

function board(input: Pick<VisualManagementBoard, "id" | "name" | "zone" | "tier" | "owner" | "members" | "meetingFrequency"> & { statuses?: Parameters<typeof createDefaultKpiEntries>[0] }): VisualManagementBoard {
  return {
    ...input,
    plant: "Egmore Plant",
    sections: createDefaultKpiEntries(input.statuses),
    status: "Active",
    createdAt: "2026-08-01T09:00:00+05:30",
    updatedAt: "2026-09-14T08:55:00+05:30",
  };
}

export const VISUAL_MANAGEMENT_SEED_BOARDS: VisualManagementBoard[] = [
  board({ id: "VM-ZA-T1", name: "Zone A Daily Management", zone: "Zone A", tier: "Tier 1", owner: PEOPLE.lakshman, members: [PEOPLE.lakshman, PEOPLE.ritika, PEOPLE.siva, PEOPLE.manoj], meetingFrequency: "Daily · 08:45", statuses: { Delivery: "Amber" } }),
  board({ id: "VM-ZB-T1", name: "Zone B Production Review", zone: "Zone B", tier: "Tier 1", owner: PEOPLE.madavan, members: [PEOPLE.madavan, PEOPLE.meena, PEOPLE.anand], meetingFrequency: "Weekly · 09:00", statuses: { Quality: "Red", Delivery: "Amber" } }),
  board({ id: "VM-ZC-T1", name: "Zone C Daily Management", zone: "Zone C", tier: "Tier 1", owner: PEOPLE.rumesh, members: [PEOPLE.rumesh, PEOPLE.siva, PEOPLE.meena], meetingFrequency: "Daily · 09:15", statuses: { People: "Amber" } }),
  board({ id: "VM-ZD-T1", name: "Zone D Daily Management", zone: "Zone D", tier: "Tier 1", owner: PEOPLE.ritika, members: [PEOPLE.ritika, PEOPLE.manoj, PEOPLE.anand], meetingFrequency: "Daily · 09:30" }),
  board({ id: "VM-PLANT-T2", name: "Plant Operations", tier: "Tier 2", owner: PEOPLE.rumesh, members: [PEOPLE.rumesh, PEOPLE.lakshman, PEOPLE.ritika, PEOPLE.siva], meetingFrequency: "Daily · 10:30", statuses: { Delivery: "Amber", Cost: "Amber" } }),
  board({ id: "VM-LEAD-T3", name: "Leadership Review", tier: "Tier 3", owner: PEOPLE.rumesh, members: [PEOPLE.rumesh, PEOPLE.lakshman, PEOPLE.ritika], meetingFrequency: "Weekly · Monday 15:00", statuses: { Cost: "Amber" } }),
];

const SEED_TOPICS: VisualManagementTopic[] = [
  { id: "VMT-014-01", meetingId: "VMM-2026-014", section: "Quality", title: "Torque rejection above threshold", description: "Three fastener torque rejections were recorded on the first shift.", owner: PEOPLE.madavan, followUpType: "Escalation", escalationId: "VME-2026-004", createdBy: PEOPLE.lakshman, createdAt: "2026-09-14T09:08:00+05:30" },
  { id: "VMT-013-01", meetingId: "VMM-2026-013", section: "Delivery", title: "Material replenishment delay", description: "Line-side replenishment missed the 20-minute response target.", owner: PEOPLE.siva, decision: "Move one replenishment trolley to Zone A for the week.", followUpType: "Action", linkedActionId: "ACT-VM-001", createdBy: PEOPLE.lakshman, createdAt: "2026-09-14T08:51:00+05:30" },
  { id: "VMT-012-01", meetingId: "VMM-2026-012", section: "Safety", title: "Repeated pallet in pedestrian lane", description: "The same staging issue has appeared in three daily meetings.", owner: PEOPLE.ritika, followUpType: "Red Flag", linkedRedFlagId: "RF-2026-013", createdBy: PEOPLE.rumesh, createdAt: "2026-09-13T10:38:00+05:30" },
  { id: "VMT-012-02", meetingId: "VMM-2026-012", section: "Delivery", title: "Material replenishment delay", description: "The replenishment delay repeated at plant review and requires a sustainable countermeasure.", owner: PEOPLE.siva, followUpType: "Continuous Improvement", linkedCIId: "CI-2026-013", createdBy: PEOPLE.rumesh, createdAt: "2026-09-13T10:43:00+05:30" },
  { id: "VMT-010-02", meetingId: "VMM-2026-010", section: "Quality", title: "Supplier label mismatch", description: "Incoming labels do not consistently match the approved material specification.", owner: PEOPLE.siva, followUpType: "Escalation", escalationId: "VME-2026-003", createdBy: PEOPLE.lakshman, createdAt: "2026-09-12T08:52:00+05:30" },
];

const SEED_DECISIONS: VisualManagementDecision[] = [
  { id: "VMD-013-01", meetingId: "VMM-2026-013", decision: "Move one replenishment trolley to Zone A for the week.", owner: PEOPLE.siva, relatedTopicId: "VMT-013-01", linkedActionId: "ACT-VM-001", createdAt: "2026-09-14T08:56:00+05:30" },
];

function attendance(people: readonly VisualManagementPerson[], absentIds: string[] = []): VisualManagementParticipant[] {
  return people.map((person) => ({ ...person, attendance: absentIds.includes(person.id) ? "Absent" : "Present" }));
}

const SEED_MEETINGS: VisualManagementMeeting[] = [
  { id: "VMM-2026-014", boardId: "VM-ZB-T1", boardName: "Zone B Production Review", plant: "Egmore Plant", zone: "Zone B", tier: "Tier 1", lead: PEOPLE.madavan, participants: attendance(VISUAL_MANAGEMENT_SEED_BOARDS[1].members, [PEOPLE.anand.id]), startedAt: "2026-09-14T09:00:00+05:30", kpiEntries: createDefaultKpiEntries({ Quality: "Red", Delivery: "Amber" }), topicIds: ["VMT-014-01"], decisionIds: [], actionIds: [], redFlagIds: [], continuousImprovementIds: [], gembaIds: [], escalationIds: ["VME-2026-004"], status: "In Progress" },
  { id: "VMM-2026-013", boardId: "VM-ZA-T1", boardName: "Zone A Daily Management", plant: "Egmore Plant", zone: "Zone A", tier: "Tier 1", lead: PEOPLE.lakshman, participants: attendance(VISUAL_MANAGEMENT_SEED_BOARDS[0].members), startedAt: "2026-09-14T08:45:00+05:30", completedAt: "2026-09-14T09:02:00+05:30", kpiEntries: createDefaultKpiEntries({ Delivery: "Amber" }), topicIds: ["VMT-013-01"], decisionIds: ["VMD-013-01"], actionIds: ["ACT-VM-001"], redFlagIds: [], continuousImprovementIds: [], gembaIds: [], escalationIds: [], status: "Completed" },
  { id: "VMM-2026-012", boardId: "VM-PLANT-T2", boardName: "Plant Operations", plant: "Egmore Plant", tier: "Tier 2", lead: PEOPLE.rumesh, participants: attendance(VISUAL_MANAGEMENT_SEED_BOARDS[4].members), startedAt: "2026-09-13T10:30:00+05:30", completedAt: "2026-09-13T10:58:00+05:30", kpiEntries: createDefaultKpiEntries({ Safety: "Red", Delivery: "Amber" }), topicIds: ["VMT-012-01", "VMT-012-02"], decisionIds: [], actionIds: [], redFlagIds: ["RF-2026-013"], continuousImprovementIds: ["CI-2026-013"], gembaIds: [], escalationIds: [], status: "Completed" },
  { id: "VMM-2026-010", boardId: "VM-ZA-T1", boardName: "Zone A Daily Management", plant: "Egmore Plant", zone: "Zone A", tier: "Tier 1", lead: PEOPLE.lakshman, participants: attendance(VISUAL_MANAGEMENT_SEED_BOARDS[0].members), startedAt: "2026-09-12T08:45:00+05:30", completedAt: "2026-09-12T09:01:00+05:30", kpiEntries: createDefaultKpiEntries({ Quality: "Amber" }), topicIds: ["VMT-010-02"], decisionIds: [], actionIds: [], redFlagIds: [], continuousImprovementIds: [], gembaIds: [], escalationIds: ["VME-2026-003"], status: "Completed" },
];

const SEED_ESCALATIONS: VisualManagementEscalation[] = [
  { id: "VME-2026-004", sourceBoardId: "VM-ZB-T1", sourceMeetingId: "VMM-2026-014", targetBoardId: "VM-PLANT-T2", topicId: "VMT-014-01", reason: "Torque rejection needs maintenance and quality support beyond Zone B authority.", status: "Open", createdBy: PEOPLE.lakshman, createdAt: "2026-09-14T09:12:00+05:30", updatedAt: "2026-09-14T09:12:00+05:30" },
  { id: "VME-2026-003", sourceBoardId: "VM-ZA-T1", sourceMeetingId: "VMM-2026-010", targetBoardId: "VM-PLANT-T2", topicId: "VMT-010-02", reason: "Recurring supplier label mismatch requires plant-level purchasing support.", status: "Resolved", createdBy: PEOPLE.lakshman, createdAt: "2026-09-12T08:55:00+05:30", updatedAt: "2026-09-13T10:45:00+05:30" },
];

export const VISUAL_MANAGEMENT_INITIAL_STATE: VisualManagementState = {
  boards: VISUAL_MANAGEMENT_SEED_BOARDS,
  meetings: SEED_MEETINGS,
  topics: SEED_TOPICS,
  decisions: SEED_DECISIONS,
  escalations: SEED_ESCALATIONS,
};

let state = VISUAL_MANAGEMENT_INITIAL_STATE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = { ...VISUAL_MANAGEMENT_INITIAL_STATE, ...JSON.parse(stored) } as VisualManagementState;
      state = { ...parsed, meetings: parsed.meetings.map((meeting) => ({ ...meeting, boardName: meeting.boardName ?? parsed.boards.find((board) => board.id === meeting.boardId)?.name ?? meeting.boardId })) };
    }
  } catch {
    state = VISUAL_MANAGEMENT_INITIAL_STATE;
  }
}

function persist(next: VisualManagementState) {
  requireLegacyOperationalWrite("visualManagement");
  const previous = state;
  state = next;
  const result = typeof window === "undefined" ? { success: true } : safeSetStorage(STORAGE_KEY, state);
  if (!result.success) { state = previous; return false; }
  listeners.forEach((listener) => listener());
  return true;
}

function subscribe(listener: () => void) { load(); listeners.add(listener); return () => listeners.delete(listener); }
function snapshot() { load(); return state; }
function serverSnapshot() { return VISUAL_MANAGEMENT_INITIAL_STATE; }

function configureBoards(current: VisualManagementState, configuration = getVisualManagementConfiguration(), plants = getOrganizationPlants(), zones = getOrganizationZones(), users = getAdminUsers()): VisualManagementState {
  const boards = configuration.boards.map((configured) => {
    const existing = current.boards.find((item) => item.id === configured.id);
    const tier = configuration.tiers.find((item) => item.id === configured.tierId);
    const plant = plants.find((item) => item.id === configured.plantId);
    const zone = zones.find((item) => item.id === configured.zoneId);
    const ownerUser = users.find((item) => item.id === configured.ownerId);
    const owner = ownerUser ? { id: ownerUser.id, name: ownerUser.name } : existing?.owner ?? { id: configured.ownerId, name: "Unavailable user" };
    const members = configured.memberIds.map((id) => users.find((item) => item.id === id)).filter((item) => item?.status === "Active").map((item) => ({ id: item!.id, name: item!.name }));
    const sections = configuration.kpiSections.filter((item) => item.active && configured.kpiSectionIds.includes(item.id)).sort((a, b) => a.order - b.order).map((section) => existing?.sections.find((item) => item.section === section.name) ?? createDefaultKpiEntries({}, [section.name])[0]);
    const meetingFrequency = [configured.meetingFrequency, configured.customFrequency, configured.meetingTime].filter(Boolean).join(" · ");
    return { id: configured.id, name: configured.name, plant: plant?.name ?? existing?.plant ?? configured.plantId, zone: zone?.name, tier: tier?.name ?? existing?.tier ?? configured.tierId, owner, members: members.some((item) => item.id === owner.id) ? members : [owner, ...members], meetingFrequency, sections, status: configured.status, createdAt: configured.createdAt, updatedAt: configured.updatedAt } satisfies VisualManagementBoard;
  });
  return { ...current, boards };
}
export function useVisualManagementStore() { const current = useSyncExternalStore(subscribe, snapshot, serverSnapshot); const deleted = useRecordDeletions(); const configuration = useVisualManagementConfiguration(); const organization = useOrganizationConfiguration(); const users = useAdminUsers(); return useMemo(() => activeVmState(configureBoards(current, configuration, organization.plants, organization.zones, users), deleted), [configuration, current, organization.plants, organization.zones, users, deleted]); }
function getVisualManagementArchive() { load(); return configureBoards(state); }
export function getVisualManagementState() { return activeVmState(getVisualManagementArchive()); }
export function getVisualManagementBoard(id: string) { return getVisualManagementState().boards.find((item) => item.id === id); }
export function getVisualManagementMeeting(id: string) { return getVisualManagementState().meetings.find((item) => item.id === id); }

function uid(prefix: string) {
  const suffix = globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now()}`;
  return `${prefix}-${suffix}`;
}

export function startVisualManagementMeeting(boardId: string, actor: VisualManagementPerson, scheduled?: { scheduleId: string; occurrenceDate: string; scheduledTime: string; durationMinutes: number; attendees: VisualManagementParticipant[] }, lead?: VisualManagementPerson) {
  if (!canOperateVisualManagementBoard(getVisualManagementBoard(boardId), actor)) return null;

  const current = getVisualManagementArchive();
  const active = current.meetings.find((item) => item.boardId === boardId && item.status === "In Progress" && !getRecordTombstone("vmMeeting", item.id));
  if (active) return active;
  if (scheduled && current.meetings.some((item) => item.scheduleId === scheduled.scheduleId && item.occurrenceDate === scheduled.occurrenceDate)) return null;
  const selected = current.boards.find((item) => item.id === boardId);
  if (!selected || selected.status !== "Active") return null;
  if (lead && (getAdminUser(lead.id)?.status !== "Active" || ![selected.owner.id, ...selected.members.map(member => member.id)].includes(lead.id))) return null;
  const meetingId = allocateModuleRecordId("visualManagement", current.meetings.map(item => item.id));
  const meeting: VisualManagementMeeting = {
    id: meetingId,
    boardId: selected.id,
    boardName: selected.name,
    plant: selected.plant,
    zone: selected.zone,
    tier: selected.tier,
    lead: { id: lead?.id ?? actor.id, name: getAdminUser(lead?.id ?? actor.id)?.name ?? actor.name },
    participants: scheduled ? scheduled.attendees.map((person) => ({ ...person, attendance: "Absent", expected: true })) : attendance(selected.members).map((person) => ({ ...person, expected: true })),
    scheduleId: scheduled?.scheduleId,
    occurrenceDate: scheduled?.occurrenceDate,
    scheduledTime: scheduled?.scheduledTime,
    scheduledDurationMinutes: scheduled?.durationMinutes,
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    kpiEntries: selected.sections.map((item) => ({ ...item, evidence: item.evidence?.map((evidence) => ({ ...evidence })) })),
    configuredKpiReviews: createMeetingKpiReviewSnapshots(meetingId, selected.id, actor.id),
    topicIds: [], decisionIds: [], actionIds: [], redFlagIds: [], continuousImprovementIds: [], gembaIds: [], escalationIds: [],
    status: "In Progress",
  };
  return persist({ ...current, meetings: [meeting, ...current.meetings] }) ? meeting : null;
}

function canMutateMeeting(id: string, actor: VisualManagementActor | undefined) { const meeting = getVisualManagementMeeting(id); return Boolean(meeting?.status === "In Progress" && canOperateVisualManagementBoard(getVisualManagementBoard(meeting.boardId), actor)); }

function updateMeeting(id: string, updater: (meeting: VisualManagementMeeting) => VisualManagementMeeting) {
  if (getRecordTombstone("vmMeeting", id)) return null;
  const current = getVisualManagementArchive();
  const meeting = current.meetings.find((item) => item.id === id);
  if (!meeting) return null;
  const updated = updater(meeting);
  return persist({ ...current, meetings: current.meetings.map((item) => item.id === id ? updated : item) }) ? updated : null;
}

export function setMeetingAttendance(meetingId: string, personId: string, attendanceValue: VisualManagementParticipant["attendance"], actor?: VisualManagementActor) {
  if (!canMutateMeeting(meetingId, actor)) return null;

  if (getVisualManagementMeeting(meetingId)?.status !== "In Progress") return null;
  return updateMeeting(meetingId, (meeting) => ({ ...meeting, participants: meeting.participants.map((person) => person.id === personId ? { ...person, attendance: attendanceValue } : person) }));
}

export function addMeetingAttendee(meetingId: string, person: VisualManagementPerson, actor?: VisualManagementActor) {
  if (!canMutateMeeting(meetingId, actor) || getAdminUser(person.id)?.status !== "Active") return null;

  const meeting = getVisualManagementMeeting(meetingId);
  if (meeting?.status !== "In Progress" || !person.id || !person.name.trim() || meeting.participants.some((entry) => entry.id === person.id)) return null;
  return updateMeeting(meetingId, (current) => ({ ...current, participants: [...current.participants, { ...person, attendance: "Present", expected: false, manuallyAdded: true }] }));
}

export function addMeetingGuest(meetingId: string, name: string, companyOrRole?: string, actor?: VisualManagementActor) {
  if (!canMutateMeeting(meetingId, actor)) return null;

  if (!name.trim() || getVisualManagementMeeting(meetingId)?.status !== "In Progress") return null;
  return updateMeeting(meetingId, (meeting) => ({ ...meeting, participants: [...meeting.participants, { id: uid("GUEST"), name: name.trim(), companyOrRole: companyOrRole?.trim() || undefined, attendance: "Present", guest: true, expected: false, manuallyAdded: true }] }));
}

export function removeMeetingAttendee(meetingId: string, personId: string, actor?: VisualManagementActor) {
  if (!canMutateMeeting(meetingId, actor)) return null;

  const meeting = getVisualManagementMeeting(meetingId);
  if (meeting?.status !== "In Progress" || !meeting.participants.some((person) => person.id === personId && (person.manuallyAdded || person.guest))) return null;
  return updateMeeting(meetingId, (current) => ({ ...current, participants: current.participants.filter((person) => person.id !== personId) }));
}

export function updateMeetingKpi(meetingId: string, section: VisualManagementKpiSection, values: Partial<VisualManagementKpiEntry>, actor?: VisualManagementActor) {
  if (!canMutateMeeting(meetingId, actor)) return null;

  const current = getVisualManagementArchive();
  const meeting = current.meetings.find((item) => item.id === meetingId);
  if (!meeting) return null;
  const updated = { ...meeting, kpiEntries: meeting.kpiEntries.map((entry) => entry.section === section ? { ...entry, ...values, section } : entry) };
  const boards = current.boards.map((board) => board.id === meeting.boardId ? {
    ...board,
    sections: board.sections.map((entry) => entry.section === section ? { ...entry, ...values, section } : entry),
    updatedAt: new Date().toISOString(),
  } : board);
  return persist({ ...current, boards, meetings: current.meetings.map((item) => item.id === meetingId ? updated : item) }) ? updated : null;
}

export function addMeetingTopic(meetingId: string, input: Pick<VisualManagementTopic, "section" | "title" | "description" | "owner" | "decision" | "followUpRequired">, actor: VisualManagementPerson) {
  if (!canMutateMeeting(meetingId, actor)) return null;

  if (!input.title.trim()) return null;
  const current = getVisualManagementArchive();
  const meeting = current.meetings.find((item) => item.id === meetingId);
  if (!meeting) return null;
  const topic: VisualManagementTopic = { ...input, id: uid("VMT"), meetingId, title: input.title.trim(), description: input.description.trim(), createdBy: actor, createdAt: new Date().toISOString() };
  return persist({ ...current, topics: [...current.topics, topic], meetings: current.meetings.map((item) => item.id === meetingId ? { ...item, topicIds: [...item.topicIds, topic.id] } : item) }) ? topic : null;
}

export function linkTopicFollowUp(topicId: string, type: VisualManagementFollowUpType, linkedId?: string, actor?: VisualManagementActor) {
  const parent = getVisualManagementState().topics.find(item => item.id === topicId); if (!parent || !canMutateMeeting(parent.meetingId, actor)) return null;

  const current = getVisualManagementArchive();
  const topic = current.topics.find((item) => item.id === topicId);
  if (!topic) return null;
  const key = type === "Action" ? "linkedActionId" : type === "Red Flag" ? "linkedRedFlagId" : type === "Continuous Improvement" ? "linkedCIId" : type === "Gemba" ? "linkedGembaId" : undefined;
  if (key && topic[key] && topic[key] !== linkedId) return null;
  const updated = { ...topic, followUpRequired: type !== "Information Only", followUpType: type, ...(key && linkedId ? { [key]: linkedId } : {}) };
  const referenceKey = type === "Action" ? "actionIds" : type === "Red Flag" ? "redFlagIds" : type === "Continuous Improvement" ? "continuousImprovementIds" : type === "Gemba" ? "gembaIds" : undefined;
  const meetings = referenceKey && linkedId ? current.meetings.map((meeting) => meeting.id === topic.meetingId ? { ...meeting, [referenceKey]: Array.from(new Set([...meeting[referenceKey], linkedId])) } : meeting) : current.meetings;
  return persist({ ...current, topics: current.topics.map((item) => item.id === topicId ? updated : item), meetings }) ? updated : null;
}

export function addMeetingDecision(meetingId: string, decisionText: string, owner?: VisualManagementPerson, relatedTopicId?: string, linkedActionId?: string, actor?: VisualManagementActor) {
  if (!canMutateMeeting(meetingId, actor)) return null;

  if (!decisionText.trim()) return null;
  const current = getVisualManagementArchive();
  const decision: VisualManagementDecision = { id: uid("VMD"), meetingId, decision: decisionText.trim(), owner, relatedTopicId, linkedActionId, createdAt: new Date().toISOString() };
  const topics = relatedTopicId
    ? current.topics.map((item) => item.id === relatedTopicId && item.meetingId === meetingId ? { ...item, decision: decision.decision } : item)
    : current.topics;
  return persist({ ...current, topics, decisions: [...current.decisions, decision], meetings: current.meetings.map((item) => item.id === meetingId ? { ...item, decisionIds: [...item.decisionIds, decision.id] } : item) }) ? decision : null;
}

export function getEscalationTargets(sourceBoardId: string) {
  const current = getVisualManagementState();
  const source = current.boards.find((item) => item.id === sourceBoardId);
  const targetTier = source ? nextTier(source.tier) : undefined;
  return targetTier ? current.boards.filter((item) => item.tier === targetTier && item.status === "Active") : [];
}

export function createMeetingEscalation(topicId: string, targetBoardId: string, reason: string, actor: VisualManagementPerson) {
  const parent = getVisualManagementState().topics.find(item => item.id === topicId); if (!parent || !canMutateMeeting(parent.meetingId, actor)) return null;

  const current = getVisualManagementArchive();
  const topic = current.topics.find((item) => item.id === topicId);
  const meeting = topic ? current.meetings.find((item) => item.id === topic.meetingId) : undefined;
  if (!topic || !meeting || !getEscalationTargets(meeting.boardId).some((item) => item.id === targetBoardId) || !reason.trim()) return null;
  const escalation: VisualManagementEscalation = { id: allocateModuleRecordId("visualManagement", current.escalations.map(item => item.id)), sourceBoardId: meeting.boardId, sourceMeetingId: meeting.id, targetBoardId, topicId, reason: reason.trim(), status: "Open", createdBy: actor, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  const topics = current.topics.map((item) => item.id === topic.id ? { ...item, followUpType: "Escalation" as const, escalationId: escalation.id } : item);
  const meetings = current.meetings.map((item) => item.id === meeting.id ? { ...item, escalationIds: [...item.escalationIds, escalation.id] } : item);
  return persist({ ...current, topics, meetings, escalations: [escalation, ...current.escalations] }) ? escalation : null;
}

export function escalateExistingEscalation(escalationId: string, targetBoardId: string, actor: VisualManagementPerson) {
  const parent = getVisualManagementState().escalations.find(item => item.id === escalationId); if (!parent || !canOperateVisualManagementBoard(getVisualManagementBoard(parent.targetBoardId), actor)) return null;

  const current = getVisualManagementArchive();
  const existing = current.escalations.find((item) => item.id === escalationId);
  if (!existing || !getEscalationTargets(existing.targetBoardId).some((item) => item.id === targetBoardId)) return null;
  const now = new Date().toISOString();
  const escalation: VisualManagementEscalation = {
    id: allocateModuleRecordId("visualManagement", current.escalations.map(item => item.id)),
    sourceBoardId: existing.targetBoardId,
    sourceMeetingId: existing.sourceMeetingId,
    targetBoardId,
    topicId: existing.topicId,
    reason: existing.reason,
    status: "Open",
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
  const escalations = current.escalations
    .map((item) => item.id === existing.id ? { ...item, status: "In Progress" as const, updatedAt: now } : item);
  return persist({ ...current, escalations: [escalation, ...escalations] }) ? escalation : null;
}

export function updateEscalationStatus(id: string, status: VisualManagementEscalationStatus, actor?: VisualManagementActor) {
  const parent = getVisualManagementState().escalations.find(item => item.id === id); if (!parent || !canOperateVisualManagementBoard(getVisualManagementBoard(parent.targetBoardId), actor)) return null;

  const current = getVisualManagementArchive();
  const item = current.escalations.find((entry) => entry.id === id);
  if (!item) return null;
  if (status === "Resolved" && item.actionId && getActionById(item.actionId)?.status !== "Completed") {
    throw new Error(`Complete linked Action ${item.actionId} before resolving this escalation.`);
  }
  const updated = { ...item, status, updatedAt: new Date().toISOString() };
  return persist({ ...current, escalations: current.escalations.map((entry) => entry.id === id ? updated : entry) }) ? updated : null;
}

export function linkEscalationAction(escalationId: string, actionId: string, actor?: VisualManagementActor) {
  const parent = getVisualManagementState().escalations.find(item => item.id === escalationId); if (!parent || !canOperateVisualManagementBoard(getVisualManagementBoard(parent.targetBoardId), actor)) return null;

  const current = getVisualManagementArchive();
  const escalation = current.escalations.find((item) => item.id === escalationId);
  if (!escalation || !actionId) return null;
  if (escalation.actionId) return escalation.actionId === actionId ? escalation : null;
  const updated = { ...escalation, actionId, updatedAt: new Date().toISOString() };
  const meetings = current.meetings.map((meeting) => meeting.id === escalation.sourceMeetingId
    ? { ...meeting, actionIds: Array.from(new Set([...meeting.actionIds, actionId])) }
    : meeting);
  const topics = current.topics.map((topic) => topic.id === escalation.topicId
    ? { ...topic, linkedActionId: actionId }
    : topic);
  return persist({
    ...current,
    escalations: current.escalations.map((item) => item.id === escalationId ? updated : item),
    meetings,
    topics,
  }) ? updated : null;
}

export function completeVisualManagementMeeting(meetingId: string, actor?: VisualManagementActor) {
  const completed = getVisualManagementMeeting(meetingId);
  if (completed?.status === "Completed" && canOperateVisualManagementBoard(getVisualManagementBoard(completed.boardId), actor)) return completed;
  if (!canMutateMeeting(meetingId, actor)) return null;

  const existing = getVisualManagementMeeting(meetingId);
  if (!existing) return null;
  if (existing.status === "Completed") return existing;
  return updateMeeting(meetingId, (meeting) => {
    const configuredKpiReviews = createMeetingKpiReviewSnapshots(meeting.id, meeting.boardId, meeting.lead.id);
    const actionIds = Array.from(new Set([...meeting.actionIds, ...configuredKpiReviews.flatMap((review) => review.actionId ? [review.actionId] : [])]));
    return { ...meeting, configuredKpiReviews, actionIds, status: "Completed", completedAt: new Date().toISOString() };
  });
}

export function meetingDurationMinutes(meeting: VisualManagementMeeting, now = new Date()) {
  return Math.max(1, Math.round(((meeting.completedAt ? new Date(meeting.completedAt) : now).getTime() - new Date(meeting.startedAt).getTime()) / 60_000));
}

export function getVisualManagementMetrics(current: VisualManagementState, actions: readonly MyAction[] = [], now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const meetingsToday = current.meetings.filter((meeting) => meeting.startedAt.slice(0, 10) === day);
  const openEscalations = current.escalations.filter((item) => !["Resolved", "Returned"].includes(item.status));
  const redKpis = current.boards.flatMap((item) => item.sections).filter((entry) => entry.status === "Red");
  const meetingActions = actions.filter((action) => action.sourceModule === "visualManagement" || action.source === "Visual Management");
  const completed = current.meetings.filter((meeting) => meeting.status === "Completed");
  return {
    meetingsToday: meetingsToday.length,
    meetingsConducted: completed.length,
    meetingCompletionRate: current.meetings.length ? Math.round((completed.length / current.meetings.length) * 100) : 0,
    openEscalations: openEscalations.length,
    redKpiCount: redKpis.length,
    actionsFromMeetings: meetingActions.length,
    openActions: meetingActions.filter((action) => action.status !== "Completed").length,
    overdueActions: meetingActions.filter((action) => action.status === "Overdue" || (action.status !== "Completed" && new Date(`${action.dueDate}T23:59:59`).getTime() < now.getTime())).length,
    averageMeetingDuration: completed.length ? Math.round(completed.reduce((sum, meeting) => sum + meetingDurationMinutes(meeting, now), 0) / completed.length) : 0,
  };
}

registerRecordCreationStore(STORAGE_KEY, () => { loaded = false; load(); });

registerActionCreationSource("visualManagement", (input, user, identity) => {
  const meeting = input.sourceId ? getVisualManagementMeeting(input.sourceId) : undefined;
  const board = getVisualManagementBoard(meeting?.boardId ?? input.sourceId ?? "");
  const topic = meeting ? getVisualManagementState().topics.find(item => item.id === input.sourceObservationId && item.meetingId === meeting.id) : undefined;
  const deviation = !meeting ? getKpiExecution().deviations.find(item => item.id === input.sourceObservationId && item.boardId === board?.id) : undefined;
  const metadata = input.visualManagementSource;
  if (metadata) {
    const referencedMeeting = metadata.meetingId ? getVisualManagementMeeting(metadata.meetingId) : undefined;
    const entry = getKpiExecution().actualEntries.find(item => item.id === metadata.actualEntryId && item.boardId === board?.id && item.kpiId === metadata.configuredKpiId);
    if (metadata.boardId !== board?.id || (metadata.meetingId && referencedMeeting?.boardId !== board?.id) || !entry || deviation?.id !== metadata.deviationId || deviation.kpiActualEntryId !== entry.id) return { permitted: false };
  }
  return { record: board, zone: meeting?.zone ?? board?.zone ?? input.area, permitted: Boolean(board && canOperateVisualManagementBoard(board, identity) && (topic || deviation)), alreadyLinked: topic?.linkedActionId ?? deviation?.actionId };
});

function activeVmState(raw: VisualManagementState, deleted?: ReturnType<typeof useRecordDeletions>): VisualManagementState { return { ...raw, boards: activeOperationalRecords("vmBoard", raw.boards, deleted), meetings: activeOperationalRecords("vmMeeting", raw.meetings, deleted), topics: raw.topics.filter(topic => !getRecordTombstone("vmMeeting", topic.meetingId)), decisions: raw.decisions.filter(item => !getRecordTombstone("vmMeeting", item.meetingId)) }; }
registerDeletionSource("vmBoard", id => { load(); const item = configureBoards(state).boards.find(item => item.id === id); const meetings = state.meetings.filter(item => item.boardId === id); return item ? { id, title: item.name, boardAccess: { plant: item.plant, zone: item.zone, owner: item.owner, members: item.members }, organizationId: "organizationId" in item && typeof item.organizationId === "string" ? item.organizationId : undefined, plant: item.plant, zone: item.zone, childIds: meetings.map(item => item.id), linkedActionIds: meetings.flatMap(item => item.actionIds) } : undefined; });
registerDeletionSource("vmMeeting", id => { load(); const item = state.meetings.find(item => item.id === id); const board = configureBoards(state).boards.find(board => board.id === item?.boardId); return item && board ? { id, title: item.boardName ?? board.name, organizationId: "organizationId" in board && typeof board.organizationId === "string" ? board.organizationId : undefined, plant: board.plant, zone: board.zone, parentId: board.id, linkedActionIds: [...item.actionIds, ...state.topics.filter(topic => topic.meetingId === id).flatMap(topic => topic.linkedActionId ? [topic.linkedActionId] : [])] } : undefined; });
