"use client";

import { CONTINUOUS_IMPROVEMENT_SEED_RECORDS, CONTINUOUS_IMPROVEMENT_STORAGE_KEY } from "@/features/five-s/continuous-improvement/store";
import { RED_TAG_STORAGE_KEY } from "@/features/five-s/red-tag/store";
import type { RedTag, RedTagStatus } from "@/features/five-s/red-tag/types";
import { GEMBA_SEED_STATE, GEMBA_STORAGE_KEY } from "@/features/gemba/gemba-store";
import { VISUAL_IMPROVEMENT_SEED_RECORDS, VISUAL_IMPROVEMENT_STORAGE_KEY } from "@/features/visual-improvement/visual-improvement-store";
import { VISUAL_MANAGEMENT_INITIAL_STATE, VISUAL_MANAGEMENT_STORAGE_KEY } from "@/features/visual-management/visual-management-store";
import { ACCESS_V3_KEY } from "@/features/five-s/administration/access-v3-state";
import { ADMIN_USER_SEEDS, refreshAdminDirectory } from "@/features/five-s/administration/store";
import { FIVE_S_AUDITS } from "@/features/five-s/data/five-s-data";
import { MY_ACTIONS } from "@/features/five-s/data/my-actions-data";
import { V4_STORAGE_KEY } from "@/lib/administration-v4-storage";
import { refreshCanonicalActionStore } from "@/lib/actions/action-store";
import { refreshFiveSAuditStore } from "@/lib/five-s/audit-store";
import { FACTORY_MODULE_ACCESS_KEY, notifyFactoryAccessChanged, normalizeFactoryAccess } from "@/lib/module-entitlements";
import { DEFAULT_MODULE_ENTITLEMENTS } from "@/lib/modules";
import { ORGANIZATION_PLANT_SEEDS, ORGANIZATION_ZONE_SEEDS, refreshOrganizationConfiguration } from "@/lib/organization-store";
import { refreshRegisteredRecordStores } from "@/lib/records/module-records";

export const EGMORE_DEMO_MANIFEST_KEY = "ops-egmore-client-demo-v1";
const DATASET_ID = "oe-egmore-client-demo-2026-10-23";
const EGMORE_FACTORY_ID = "PLANT-EGM";
const ABC_ORGANIZATION_ID = "abc-manufacturing";
const PLATFORM_PERSON_ID = "USR-OPS-SUPER-ADMIN";
const STAMP = "2026-10-23T00:00:00.000Z";
const DIRECTORY_KEY = "five-s-administration-users-v1";
const CONFIGURATION_KEY = "ops-organization-configuration-v1";
const ACTIONS_KEY = "standalone-5s-actions";
const AUDITS_KEY = "manufacturing-qms-five-s-audits-v1";

type Row = { id: string };
type JsonObject = Record<string, unknown>;

function parse<T>(key: string, fallback: T): T {
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function reconcileRows<Current extends Row, Seed extends Row>(current: readonly Current[], seeds: readonly Seed[]): Array<Current | Seed> {
  const seedIds = new Set(seeds.map(item => item.id));
  return [...seeds, ...current.filter(item => !seedIds.has(item.id))];
}

function includeMissingRows<Current extends Row, Seed extends Row>(current: readonly Current[], seeds: readonly Seed[]): Array<Current | Seed> {
  const currentIds = new Set(current.map(item => item.id));
  return [...current, ...seeds.filter(item => !currentIds.has(item.id))];
}

function redTag(id: number, status: RedTagStatus, zone: string, itemName: string, reason: RedTag["reason"], createdAt: string): RedTag {
  const recordId = `RT-EGM-DEMO-${String(id).padStart(3, "0")}`;
  const creator = zone === "Zone B" ? { id: "USR-RUMESH", name: "Rumesh" } : zone === "Zone D" ? { id: "USR-ANAND", name: "Anand" } : { id: "USR-LAKSHMAN", name: "Lakshman" };
  const reviewed = status !== "Open";
  const decided = !["Open", "Under Review"].includes(status);
  const directKeep = status === "Awaiting Verification" || status === "Closed";
  const completedAt = "2026-10-18T11:30:00+05:30";
  return {
    id: recordId,
    tagNumber: recordId,
    plant: "Egmore Plant",
    zone,
    section: zone === "Zone D" ? "Warehouse" : zone === "Zone C" ? "Maintenance" : zone === "Zone B" ? "Quality" : "Assembly",
    department: zone === "Zone D" ? "Warehouse / Dispatch" : zone === "Zone C" ? "Maintenance" : zone === "Zone B" ? "Quality / Inspection" : "Assembly",
    itemName,
    category: id % 3 === 0 ? "Materials" : id % 2 === 0 ? "Tools" : "Equipment",
    reason,
    remarks: `${itemName} was identified during the Egmore workplace organization review and requires controlled follow-up.`,
    status,
    createdById: creator.id,
    createdByName: creator.name,
    createdAt,
    imageUrl: "/demo-5s/not-good-example.png",
    identificationEvidence: [{ id: `${recordId}-BEFORE`, name: "Identification evidence", url: "/demo-5s/not-good-example.png", mimeType: "image/png", uploadedBy: creator.name, uploadedAt: createdAt }],
    review: reviewed ? { reviewerId: "USR-LAKSHMAN", reviewerName: "Lakshman", submittedAt: createdAt, reviewedAt: "2026-10-16T10:00:00+05:30", comments: "Review completed against the local disposition standard." } : undefined,
    decisionRecord: decided ? { type: directKeep ? "keep" : id % 2 === 0 ? "relocate" : "scrap", decidedAt: "2026-10-16T11:00:00+05:30", decidedByUserId: "USR-LAKSHMAN", decidedByName: "Lakshman", comments: directKeep ? "Retain with a clearly identified location." : "Complete the recorded physical disposition." } : undefined,
    handlingMode: decided ? "direct" : undefined,
    dispositionDetails: decided && !directKeep ? { decision: id % 2 === 0 ? "relocate" : "scrap", responsiblePersonId: "USR-SIVA-KUMAR", responsiblePersonName: "Siva Kumar", targetDate: "2026-10-22", startedAt: "2026-10-17T09:00:00+05:30", startedByUserId: "USR-SIVA-KUMAR", startedByName: "Siva Kumar", executionNotes: "Disposition location and responsible owner confirmed.", evidence: [] } : undefined,
    keepConfirmation: directKeep ? { justification: "Item remains required and now has a labelled point-of-use location.", confirmedAt: completedAt, confirmedByUserId: "USR-SIVA-KUMAR", confirmedByName: "Siva Kumar" } : undefined,
    closure: status === "Closed" ? { verificationResult: "Passed", verificationDetails: "Label and defined location verified independently.", verifiedAt: "2026-10-19T09:15:00+05:30", verifiedByUserId: "USR-RUMESH", verifiedByName: "Rumesh", closedAt: "2026-10-19T09:15:00+05:30", closedByUserId: "USR-RUMESH", closedByName: "Rumesh" } : undefined,
    closedAt: status === "Closed" ? "2026-10-19T09:15:00+05:30" : undefined,
    history: [
      { id: `${recordId}-CREATED`, type: "created", label: "Red Tag created", actor: creator.name, actorId: creator.id, at: createdAt },
      ...(reviewed ? [{ id: `${recordId}-REVIEW`, type: "reviewed" as const, label: "Review completed", actor: "Lakshman", actorId: "USR-LAKSHMAN", at: "2026-10-16T10:00:00+05:30" }] : []),
      ...(decided ? [{ id: `${recordId}-DECISION`, type: "decision_recorded" as const, label: "Disposition decision recorded", actor: "Lakshman", actorId: "USR-LAKSHMAN", at: "2026-10-16T11:00:00+05:30" }] : []),
      ...(status === "Closed" ? [{ id: `${recordId}-CLOSED`, type: "closed" as const, label: "Red Tag verified and closed", actor: "Rumesh", actorId: "USR-RUMESH", at: "2026-10-19T09:15:00+05:30" }] : []),
    ],
  };
}

export const EGMORE_RED_TAG_DEMO_RECORDS: readonly RedTag[] = [
  redTag(1, "Open", "Zone A", "Unlabelled torque fixture", "No Material Labelling", "2026-10-20T09:10:00+05:30"),
  redTag(2, "Open", "Zone B", "Mixed inspection samples", "Mix Up", "2026-10-19T14:20:00+05:30"),
  redTag(3, "Open", "Zone D", "Excess returnable cartons", "Excess inventory", "2026-10-18T08:45:00+05:30"),
  redTag(4, "Under Review", "Zone C", "Obsolete maintenance jig", "Obsolete", "2026-10-17T10:30:00+05:30"),
  redTag(5, "Under Review", "Zone A", "Damaged component trolley", "Damaged", "2026-10-16T13:05:00+05:30"),
  redTag(6, "Decision Made", "Zone B", "Duplicate gauge stand", "Duplicate items", "2026-10-15T09:40:00+05:30"),
  redTag(7, "Decision Made", "Zone D", "Scrap material without boundary", "Scrap/waste", "2026-10-14T15:10:00+05:30"),
  redTag(8, "Disposition In Progress", "Zone A", "Fixture stored away from point of use", "Wrong location", "2026-10-13T11:25:00+05:30"),
  redTag(9, "Disposition In Progress", "Zone C", "Expired lubricant container", "Expired", "2026-10-12T08:30:00+05:30"),
  redTag(10, "Awaiting Verification", "Zone B", "Inspection master sample", "Unclear ownership", "2026-10-11T10:15:00+05:30"),
  redTag(11, "Closed", "Zone A", "Changeover tool shadow location", "No defined storage location", "2026-10-08T09:00:00+05:30"),
  redTag(12, "Closed", "Zone D", "Dispatch label stock", "Unknown quantity", "2026-10-06T13:40:00+05:30"),
];

const gembaExtraDefinitions = [
  ["GEM-EGM-DEMO-OBS-001", "GEM-2026-015", "Issue", "Component bins extending into the aisle", "Assembly Cell 2", "2026-10-20T09:15:00+05:30"],
  ["GEM-EGM-DEMO-OBS-002", "GEM-2026-015", "Positive", "First-piece standard visible at workstation", "Assembly Cell 1", "2026-10-20T09:28:00+05:30"],
  ["GEM-EGM-DEMO-OBS-003", "GEM-2026-014", "Opportunity", "Reduce label roll replenishment travel", "Packing Area", "2026-10-18T10:10:00+05:30"],
  ["GEM-EGM-DEMO-OBS-004", "GEM-2026-014", "Issue", "Inspection samples missing owner labels", "Quality Gate", "2026-10-18T10:24:00+05:30"],
  ["GEM-EGM-DEMO-OBS-005", "GEM-2026-016", "Issue", "Lubricant containers need expiry control", "Maintenance Store", "2026-10-17T15:10:00+05:30"],
  ["GEM-EGM-DEMO-OBS-006", "GEM-2026-011", "Positive", "Dispatch route markings remain clear", "Dispatch Lane", "2026-10-15T14:05:00+05:30"],
  ["GEM-EGM-DEMO-OBS-007", "GEM-2026-011", "Opportunity", "Add min-max levels to carton stock", "Warehouse", "2026-10-15T14:18:00+05:30"],
] as const;

const EGMORE_GEMBA_EXTRA_OBSERVATIONS = gembaExtraDefinitions.map(([id, gembaId, type, title, location, createdAt], index) => ({
  ...GEMBA_SEED_STATE.observations[index % GEMBA_SEED_STATE.observations.length],
  id, gembaId, type, title, location, createdAt, updatedAt: createdAt,
  description: `${title}. Recorded during the Egmore demonstration reporting period for operational follow-up.`,
  evidence: [], peopleInvolved: [], actionId: undefined, noActionReason: type === "Issue" ? undefined : "Recorded for local follow-up during the next team review.",
}));

const EGMORE_GEMBA_DEMO_STATE = {
  walks: GEMBA_SEED_STATE.walks.map(walk => ({ ...walk, observationIds: [...new Set([...walk.observationIds, ...EGMORE_GEMBA_EXTRA_OBSERVATIONS.filter(item => item.gembaId === walk.id).map(item => item.id)])] })),
  observations: [...GEMBA_SEED_STATE.observations, ...EGMORE_GEMBA_EXTRA_OBSERVATIONS],
};

const EGMORE_CONTINUOUS_IMPROVEMENT_RECORDS = [
  ...CONTINUOUS_IMPROVEMENT_SEED_RECORDS,
  { ...CONTINUOUS_IMPROVEMENT_SEED_RECORDS[0], id: "CI-EGM-DEMO-015", title: "Reduce inspection sample search time", status: "submitted" as const, zone: "Zone B", zoneCode: "ZB", createdAt: "2026-10-18T10:00:00+05:30", updatedAt: "2026-10-18T10:20:00+05:30", submittedAt: "2026-10-18T10:20:00+05:30", actionIds: [], timeline: [] },
  { ...CONTINUOUS_IMPROVEMENT_SEED_RECORDS[0], id: "CI-EGM-DEMO-016", title: "Standardize dispatch carton replenishment", status: "draft" as const, zone: "Zone D", zoneCode: "ZD", createdAt: "2026-10-20T14:00:00+05:30", updatedAt: "2026-10-20T14:00:00+05:30", submittedAt: undefined, actionIds: [], timeline: [] },
];

const EGMORE_VISUAL_IMPROVEMENT_RECORDS = [
  ...VISUAL_IMPROVEMENT_SEED_RECORDS,
  { ...VISUAL_IMPROVEMENT_SEED_RECORDS[4], id: "VI-EGM-DEMO-015", title: "Mark maintenance consumable locations", plant: "Egmore Plant", zone: "Zone C", location: "Maintenance Store", status: "Draft" as const, createdAt: "2026-10-19T09:00:00+05:30", updatedAt: "2026-10-19T09:00:00+05:30", actionId: undefined, activity: [] },
];

function moduleWrites() {
  const currentGemba = parse(GEMBA_STORAGE_KEY, { walks: [], observations: [] }) as typeof GEMBA_SEED_STATE;
  const currentVm = parse(VISUAL_MANAGEMENT_STORAGE_KEY, { boards: [], meetings: [], topics: [], decisions: [], escalations: [] }) as typeof VISUAL_MANAGEMENT_INITIAL_STATE;
  const access = normalizeFactoryAccess(parse<JsonObject>(FACTORY_MODULE_ACCESS_KEY, {}));
  const v3 = parse<JsonObject>(ACCESS_V3_KEY, { version: 1, clients: [], clientMemberships: [], factoryMemberships: [], zoneAllocations: [], factoryAdmins: [], factoryRequests: [], auditorGrants: [], events: [] });
  const v4 = parse<JsonObject>(V4_STORAGE_KEY, { schemaVersion: 1, policyVersion: "ops-access-v4", revision: 1, departments: [], assignments: [], events: [] });
  const roster = [
    { id: "USR-LAKSHMAN", role: "Zone Leader", zoneId: "ZONE-A" },
    { id: "USR-RUMESH", role: "Zone Leader", zoneId: "ZONE-B" },
    { id: "USR-MANOJ-GURU", role: "Zone Leader", zoneId: "ZONE-C" },
    { id: "USR-ANAND", role: "Zone Leader", zoneId: "ZONE-D" },
    { id: "USR-RITIKA", role: "Zone Member", zoneId: "ZONE-A" },
    { id: "USR-JAMES", role: "Zone Member", zoneId: "ZONE-A" },
    { id: "USR-SIVA-KUMAR", role: "Zone Member", zoneId: "ZONE-B" },
    { id: "USR-MADAVAN", role: "Zone Member", zoneId: "ZONE-C" },
    { id: "USR-MEENA", role: "Zone Member", zoneId: "ZONE-D" },
    { id: "USR-GURUMURTHI", role: "Standard User", zoneId: undefined },
  ] as const;
  const clientMemberships = roster.map(person => ({ id: `CM-EGM-DEMO-${person.id}`, userId: person.id, organizationId: ABC_ORGANIZATION_ID, status: "Active", clientAdmin: false, assignedBy: PLATFORM_PERSON_ID, assignedAt: STAMP, updatedAt: STAMP }));
  const factoryMemberships = roster.map(person => ({ id: `FM-EGM-DEMO-${person.id}`, userId: person.id, organizationId: ABC_ORGANIZATION_ID, plantId: EGMORE_FACTORY_ID, baseRole: person.role, status: "Active", assignedBy: PLATFORM_PERSON_ID, assignedAt: STAMP, updatedAt: STAMP }));
  const zoneAllocations = roster.filter(person => person.zoneId).map(person => ({ id: `ZA-EGM-DEMO-${person.id}`, userId: person.id, organizationId: ABC_ORGANIZATION_ID, plantId: EGMORE_FACTORY_ID, zoneId: person.zoneId!, responsibility: person.role === "Zone Leader" ? "Leader" : "Member", status: "Active", assignedBy: PLATFORM_PERSON_ID, assignedAt: STAMP, updatedAt: STAMP }));
  const departments = [
    { id: "DEPT-EGM-ZA-ASSEMBLY", zoneId: "ZONE-A", name: "Assembly", code: "ASSEMBLY" },
    { id: "DEPT-EGM-ZB-QUALITY", zoneId: "ZONE-B", name: "Quality / Inspection", code: "QUALITY" },
    { id: "DEPT-EGM-ZC-MAINT", zoneId: "ZONE-C", name: "Maintenance", code: "MAINT" },
    { id: "DEPT-EGM-ZD-WAREHOUSE", zoneId: "ZONE-D", name: "Warehouse / Dispatch", code: "WAREHOUSE" },
  ].map(item => ({ ...item, organizationId: ABC_ORGANIZATION_ID, plantId: EGMORE_FACTORY_ID, status: "Active", createdBy: PLATFORM_PERSON_ID, createdAt: STAMP, updatedBy: PLATFORM_PERSON_ID, updatedAt: STAMP, revision: 1 }));
  const assignments = [
    { id: "RA-EGM-CHAMPION-RITIKA", personId: "USR-RITIKA", role: "Zone Champion" },
    { id: "RA-EGM-DL-JAMES", personId: "USR-JAMES", role: "Department Leader", zoneId: "ZONE-A", departmentId: "DEPT-EGM-ZA-ASSEMBLY" },
    { id: "RA-EGM-DM-RITIKA", personId: "USR-RITIKA", role: "Department Member", zoneId: "ZONE-A", departmentId: "DEPT-EGM-ZA-ASSEMBLY" },
    { id: "RA-EGM-DL-SIVA", personId: "USR-SIVA-KUMAR", role: "Department Leader", zoneId: "ZONE-B", departmentId: "DEPT-EGM-ZB-QUALITY" },
    { id: "RA-EGM-DL-MADAVAN", personId: "USR-MADAVAN", role: "Department Leader", zoneId: "ZONE-C", departmentId: "DEPT-EGM-ZC-MAINT" },
    { id: "RA-EGM-DL-MEENA", personId: "USR-MEENA", role: "Department Leader", zoneId: "ZONE-D", departmentId: "DEPT-EGM-ZD-WAREHOUSE" },
  ].map(item => ({ ...item, organizationId: ABC_ORGANIZATION_ID, plantId: EGMORE_FACTORY_ID, status: "Active", assignedBy: PLATFORM_PERSON_ID, assignedAt: STAMP, revision: 1 }));
  const configuration = parse<{ plants: Array<Row & JsonObject>; zones: Array<Row & JsonObject> }>(CONFIGURATION_KEY, { plants: [], zones: [] });
  const rosterIds = new Set<string>(roster.map(person => person.id));
  const egmoreSeed = ORGANIZATION_PLANT_SEEDS.find(plant => plant.id === EGMORE_FACTORY_ID)!;
  const hasEgmore = configuration.plants.some(plant => plant.id === EGMORE_FACTORY_ID);
  return {
    [DIRECTORY_KEY]: includeMissingRows(parse<Row[]>(DIRECTORY_KEY, []), ADMIN_USER_SEEDS.filter(person => rosterIds.has(person.id))),
    [CONFIGURATION_KEY]: {
      ...configuration,
      plants: hasEgmore ? configuration.plants.map(plant => plant.id === EGMORE_FACTORY_ID ? { ...plant, maximumActiveUsers: Math.max(Number(plant.maximumActiveUsers) || 0, 30) } : plant) : [...configuration.plants, { ...egmoreSeed, maximumActiveUsers: 30 }],
      zones: includeMissingRows(configuration.zones ?? [], ORGANIZATION_ZONE_SEEDS.filter(zone => zone.plantId === EGMORE_FACTORY_ID)),
    },
    [ACTIONS_KEY]: reconcileRows(parse<Row[]>(ACTIONS_KEY, []), MY_ACTIONS.filter(action => action.plant === "Egmore Plant")),
    [AUDITS_KEY]: reconcileRows(parse<Row[]>(AUDITS_KEY, []), FIVE_S_AUDITS.filter(audit => audit.plant === "Egmore Plant")),
    [GEMBA_STORAGE_KEY]: { walks: reconcileRows(currentGemba.walks ?? [], EGMORE_GEMBA_DEMO_STATE.walks), observations: reconcileRows(currentGemba.observations ?? [], EGMORE_GEMBA_DEMO_STATE.observations) },
    [RED_TAG_STORAGE_KEY]: reconcileRows(parse<RedTag[]>(RED_TAG_STORAGE_KEY, []), EGMORE_RED_TAG_DEMO_RECORDS),
    [CONTINUOUS_IMPROVEMENT_STORAGE_KEY]: reconcileRows(parse(CONTINUOUS_IMPROVEMENT_STORAGE_KEY, []), EGMORE_CONTINUOUS_IMPROVEMENT_RECORDS),
    [VISUAL_IMPROVEMENT_STORAGE_KEY]: reconcileRows(parse(VISUAL_IMPROVEMENT_STORAGE_KEY, []), EGMORE_VISUAL_IMPROVEMENT_RECORDS),
    [VISUAL_MANAGEMENT_STORAGE_KEY]: {
      boards: reconcileRows(currentVm.boards ?? [], VISUAL_MANAGEMENT_INITIAL_STATE.boards),
      meetings: reconcileRows(currentVm.meetings ?? [], VISUAL_MANAGEMENT_INITIAL_STATE.meetings),
      topics: reconcileRows(currentVm.topics ?? [], VISUAL_MANAGEMENT_INITIAL_STATE.topics),
      decisions: reconcileRows(currentVm.decisions ?? [], VISUAL_MANAGEMENT_INITIAL_STATE.decisions),
      escalations: reconcileRows(currentVm.escalations ?? [], VISUAL_MANAGEMENT_INITIAL_STATE.escalations),
    },
    [FACTORY_MODULE_ACCESS_KEY]: { ...access, factories: { ...access.factories, [EGMORE_FACTORY_ID]: { ...DEFAULT_MODULE_ENTITLEMENTS, redFlag: false } } },
    [ACCESS_V3_KEY]: {
      ...v3,
      version: 1,
      clientMemberships: reconcileRows((v3.clientMemberships ?? []) as Row[], clientMemberships),
      factoryMemberships: reconcileRows((v3.factoryMemberships ?? []) as Row[], factoryMemberships),
      zoneAllocations: reconcileRows((v3.zoneAllocations ?? []) as Row[], zoneAllocations),
      factoryAdmins: reconcileRows((v3.factoryAdmins ?? []) as Row[], [{ id: "FA-EGM-DEMO-LAKSHMAN", userId: "USR-LAKSHMAN", organizationId: ABC_ORGANIZATION_ID, plantId: EGMORE_FACTORY_ID, status: "Active", assignedBy: PLATFORM_PERSON_ID, assignedAt: STAMP }]),
      auditorGrants: reconcileRows((v3.auditorGrants ?? []) as Row[], [
        { id: "AG-EGM-DEMO-LAKSHMAN", userId: "USR-LAKSHMAN", organizationId: ABC_ORGANIZATION_ID, plantId: EGMORE_FACTORY_ID, zoneIds: ["ZONE-B", "ZONE-C", "ZONE-D"], status: "Active", grantedBy: PLATFORM_PERSON_ID, grantedAt: STAMP },
        { id: "AG-EGM-DEMO-RUMESH", userId: "USR-RUMESH", organizationId: ABC_ORGANIZATION_ID, plantId: EGMORE_FACTORY_ID, zoneIds: ["ZONE-A", "ZONE-C", "ZONE-D"], status: "Active", grantedBy: PLATFORM_PERSON_ID, grantedAt: STAMP },
      ]),
    },
    [V4_STORAGE_KEY]: {
      ...v4,
      schemaVersion: 1,
      policyVersion: "ops-access-v4",
      revision: Math.max(Number(v4.revision) || 0, 1) + 1,
      departments: reconcileRows((v4.departments ?? []) as Row[], departments),
      assignments: reconcileRows((v4.assignments ?? []) as Row[], assignments),
    },
    [EGMORE_DEMO_MANIFEST_KEY]: {
      id: DATASET_ID,
      disposable: true,
      factoryId: EGMORE_FACTORY_ID,
      preparedAt: new Date().toISOString(),
      storageKeys: [DIRECTORY_KEY, CONFIGURATION_KEY, ACTIONS_KEY, AUDITS_KEY, GEMBA_STORAGE_KEY, RED_TAG_STORAGE_KEY, CONTINUOUS_IMPROVEMENT_STORAGE_KEY, VISUAL_IMPROVEMENT_STORAGE_KEY, VISUAL_MANAGEMENT_STORAGE_KEY, ACCESS_V3_KEY, V4_STORAGE_KEY],
      recordIds: {
        gembaWalks: EGMORE_GEMBA_DEMO_STATE.walks.map(item => item.id), gembaObservations: EGMORE_GEMBA_DEMO_STATE.observations.map(item => item.id),
        redTags: EGMORE_RED_TAG_DEMO_RECORDS.map(item => item.id), continuousImprovements: EGMORE_CONTINUOUS_IMPROVEMENT_RECORDS.map(item => item.id),
        visualImprovements: EGMORE_VISUAL_IMPROVEMENT_RECORDS.map(item => item.id), visualManagementBoards: VISUAL_MANAGEMENT_INITIAL_STATE.boards.map(item => item.id),
      },
    },
  };
}

export async function prepareEgmoreDemoData() {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") throw new Error("Egmore demo preparation is available in development only.");
  const writes = moduleWrites();
  const previous = new Map(Object.keys(writes).map(key => [key, window.localStorage.getItem(key)]));
  try { Object.entries(writes).forEach(([key, value]) => window.localStorage.setItem(key, JSON.stringify(value))); }
  catch (error) {
    previous.forEach((value, key) => value === null ? window.localStorage.removeItem(key) : window.localStorage.setItem(key, value));
    throw error;
  }
  refreshRegisteredRecordStores();
  refreshAdminDirectory();
  refreshOrganizationConfiguration();
  refreshCanonicalActionStore();
  refreshFiveSAuditStore();
  notifyFactoryAccessChanged();
  Object.keys(writes).forEach(key => window.dispatchEvent(new StorageEvent("storage", { key, storageArea: window.localStorage })));
}

/** Restores only records bearing the stable Egmore demo IDs. Unmarked records remain untouched. */
export async function resetEgmoreDemoData() { await prepareEgmoreDemoData(); }
