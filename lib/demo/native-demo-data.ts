"use client";
import { requireDemoAccess } from "./demo-access";

import { refreshCanonicalActionStore } from "@/lib/actions/action-store";
import { refreshFiveSAuditStore } from "@/lib/five-s/audit-store";
import { MY_ACTIONS } from "@/features/five-s/data/my-actions-data";
import { FIVE_S_AUDITS } from "@/features/five-s/data/five-s-data";
import { ORGANIZATION_PLANT_SEEDS, ORGANIZATION_ZONE_SEEDS, refreshOrganizationConfiguration } from "@/lib/organization-store";
import { notifyAccessV3 } from "@/features/five-s/administration/access-v3-state";
import { notifyAccessV4 } from "@/features/five-s/administration/access-v4-state";
import { ADMIN_USER_SEEDS, refreshAdminDirectory } from "@/features/five-s/administration/store";
import { NEW_FACTORY_ACCESS } from "@/lib/module-entitlements";
import { switchFinalDemoPersona } from "./switch-final-persona";

const DIRECTORY_KEY = "five-s-administration-users-v1";
const CONFIGURATION_KEY = "ops-organization-configuration-v1";
const ACTIONS_KEY = "standalone-5s-actions";
const AUDITS_KEY = "manufacturing-qms-five-s-audits-v1";
const ACCESS_V3_KEY = "ops-access-v3-administration-v1";
const ACCESS_V4_KEY = "ops-access-v4-administration-v1";
const MODULES_KEY = "ops-organization-modules-v1";
const MANIFEST_KEY = "ops-final-role-demo-v1";
const PLATFORM_PERSON_ID = "USR-OPS-SUPER-ADMIN";
const DATASET_ID = "ops-iq-v4-demo-v1";

const FIXTURE_GZIP_BASE64 = "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";

type JsonObject = Record<string, unknown>;
type Fixture = { version: 1; dataset: string; storage: Record<string, string> };

function object(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} is invalid. Existing browser data was not changed.`);
  return value as JsonObject;
}

function array(value: unknown, label: string): JsonObject[] {
  if (!Array.isArray(value) || value.some(item => !item || typeof item !== "object" || Array.isArray(item))) throw new Error(`${label} is invalid. Existing browser data was not changed.`);
  return value as JsonObject[];
}

function parse(raw: string | null, fallback: unknown, label: string): unknown {
  if (raw === null) return fallback;
  try { return JSON.parse(raw); }
  catch { throw new Error(`${label} contains malformed JSON. Existing browser data was not changed.`); }
}

async function fixture(): Promise<Fixture> {
  const bytes = Uint8Array.from(atob(FIXTURE_GZIP_BASE64), character => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  const decoded = JSON.parse(await new Response(stream).text()) as Fixture;
  if (decoded.version !== 1 || decoded.dataset !== "ops-v4-native-role-demo-v1") throw new Error("The embedded demo dataset is invalid.");
  return decoded;
}

function scoped(item: JsonObject, organizations: Set<string>) {
  return typeof item.organizationId === "string" && organizations.has(item.organizationId);
}

function mergeRows(current: JsonObject[], seeded: JsonObject[], remove: (row: JsonObject) => boolean) {
  const ids = new Set(seeded.map(row => row.id).filter((id): id is string => typeof id === "string"));
  return [...current.filter(row => !remove(row) && (typeof row.id !== "string" || !ids.has(row.id))), ...seeded];
}

function includeMissingRows(current: JsonObject[], canonical: JsonObject[]) {
  const ids = new Set(current.map(row => row.id).filter((id): id is string => typeof id === "string"));
  return [...current, ...canonical.filter(row => typeof row.id !== "string" || !ids.has(row.id))];
}

const IQ_ORGANIZATION_ID = "ORG-7e3a7444-ab9b-4338-a09e-296a2ccfaf9a";
const IQ_BYD_PLANT_ID = "PLANT-cd757fcd-3d35-4348-aad0-015d603110e0";
const IQ_COLD_START_PLANT_ID = "PLANT-DEMO-IQ-COLD-START";
const ABC_ADMIN = { id: "USR-DEMO-ABC-ADMIN", name: "ABC Manufacturing Admin", email: "abc-manufacturing.admin@oe-demo.invalid", employeeId: "OE-ABC-MANUFACTURING-ADMIN" } as const;
const ADDITIONAL_CLIENTS = [
  {
    id: "ORG-DEMO-MITSUBISHI",
    name: "Mitsubishi",
    industry: "Manufacturing",
    personId: "USR-DEMO-MITSUBISHI-ADMIN",
    admin: "Mitsubishi Admin",
    factories: [
      { id: "PLANT-DEMO-MITSUBISHI-01", name: "Mitsubishi Factory 1", code: "MITSU-01" },
      { id: "PLANT-DEMO-MITSUBISHI-02", name: "Mitsubishi Factory 2", code: "MITSU-02" },
    ],
  },
  {
    id: "ORG-DEMO-HYUNDAI",
    name: "Hyundai",
    industry: "Manufacturing",
    personId: "USR-DEMO-HYUNDAI-ADMIN",
    admin: "Hyundai Admin",
    factories: [
      { id: "PLANT-DEMO-HYUNDAI-01", name: "Hyundai Factory 1", code: "HYUN-01" },
      { id: "PLANT-DEMO-HYUNDAI-02", name: "Hyundai Factory 2", code: "HYUN-02" },
    ],
  },
] as const;
const OBSOLETE_DEMO_ORGANIZATION_IDS = ["xyz-components", "ORG-DEMO-KAVERY-HOSPITAL"] as const;
const OBSOLETE_DEMO_PERSON_IDS = new Set(["USR-DEMO-KAVERY-ADMIN"]);

function extendMvpAccess(seed: JsonObject): JsonObject {
  const generatedAt = "2026-10-23T00:00:00.000Z";
  const marker = { id: DATASET_ID, disposable: true, generatedAt, authorizedBy: "product-owner" };
  const clients = array(seed.clients, "Embedded clients");
  const iq = clients.find(item => item.id === IQ_ORGANIZATION_ID) ?? clients[0];
  const clientMemberships = array(seed.clientMemberships ?? [], "Embedded client memberships");
  const factoryMemberships = array(seed.factoryMemberships ?? [], "Embedded factory memberships");
  const factoryAdmins = array(seed.factoryAdmins ?? [], "Embedded Factory Admins");
  const iqFactoryAdmin = factoryAdmins.find(item => item.organizationId === IQ_ORGANIZATION_ID && item.status === "Active");
  const iqFactoryAdminMembership = factoryMemberships.find(item => item.userId === iqFactoryAdmin?.userId && item.organizationId === IQ_ORGANIZATION_ID);
  return {
    ...seed,
    clients: [
      { ...iq, id: IQ_ORGANIZATION_ID, name: "IQ", industry: "Fictional manufacturing demonstration", plants: 4, users: clientMemberships.filter(item => item.organizationId === IQ_ORGANIZATION_ID && item.status === "Active").length, operationalState: "Active", demoDataset: marker },
      ...ADDITIONAL_CLIENTS.map(item => ({ id: item.id, name: item.name, industry: item.industry, plants: item.factories.length, users: 1, status: "Active", operationalState: "Active", lastUpdated: "Today", demoDataset: marker })),
    ],
    clientMemberships: [
      ...clientMemberships,
      ...ADDITIONAL_CLIENTS.map((item, index) => ({ id: `CM-DEMO-CLIENT-ADMIN-${index + 1}`, userId: item.personId, organizationId: item.id, status: "Active", clientAdmin: true, assignedBy: PLATFORM_PERSON_ID, assignedAt: generatedAt, updatedAt: generatedAt })),
    ],
    factoryMemberships: [
      ...factoryMemberships,
      ...(iqFactoryAdmin && iqFactoryAdminMembership ? ["PLANT-IQ-MAHINDRA", "PLANT-IQ-BOAT"].map((plantId, index) => ({ ...iqFactoryAdminMembership, id: `FM-IQ-FACTORY-ADMIN-${index + 2}`, plantId, assignedAt: generatedAt, updatedAt: generatedAt })) : []),
    ],
    factoryAdmins: [
      ...factoryAdmins,
      ...(iqFactoryAdmin ? ["PLANT-IQ-MAHINDRA", "PLANT-IQ-BOAT"].map((plantId, index) => ({ ...iqFactoryAdmin, id: `FA-IQ-${index + 2}`, plantId, assignedAt: generatedAt })) : []),
    ],
    factoryRequests: [],
  };
}

function extendMvpDirectory(seed: JsonObject[], abcAdministrator?: JsonObject): JsonObject[] {
  return [...seed, ...(abcAdministrator ? [abcAdministrator] : []), ...ADDITIONAL_CLIENTS.map(item => ({ id: item.personId, name: item.admin, email: `${item.id.replace("ORG-DEMO-", "").toLowerCase()}@demo.invalid`, employeeId: item.personId.replace("USR-", "EMP-"), status: "Active", roles: [], permissions: [], plant: "", zoneMemberships: [], updatedAt: "2026-10-23T00:00:00.000Z", accessModel: "v3" }))];
}

function extendMvpConfiguration(seed: JsonObject): JsonObject {
  const plants = array(seed.plants, "Embedded plants");
  const zones = array(seed.zones, "Embedded Zones");
  const marker = { id: DATASET_ID, disposable: true, generatedAt: "2026-10-23T00:00:00.000Z", authorizedBy: "product-owner" };
  const hasTambaram = plants.some(plant => (plant.organizationId === undefined || plant.organizationId === "abc-manufacturing") && String(plant.name).toLowerCase().includes("tambaram"));
  return {
    ...seed,
    plants: [
      ...plants.map(plant => plant.id === "PLANT-EGM" ? { ...plant, maximumActiveUsers: 20 } : (plant.organizationId === undefined || plant.organizationId === "abc-manufacturing") && String(plant.name).toLowerCase().includes("tambaram") ? { ...plant, maximumActiveUsers: 50 } : plant.id === IQ_BYD_PLANT_ID ? { ...plant, organizationId: IQ_ORGANIZATION_ID, name: "BYD", code: "BYD", location: "Fictional IQ demo factory", description: "IQ demonstration factory", maximumActiveUsers: 25, demoDataset: marker } : plant),
      ...(!hasTambaram ? [{ id: "PLANT-DEMO-ABC-TAMBARAM", organizationId: "abc-manufacturing", name: "Tambaram", code: "TAMBARAM", location: "Chennai", description: "Disposable ABC Manufacturing demonstration factory", managerId: "", managerName: "", status: "Active", codeLocked: true, maximumActiveUsers: 50, demoDataset: marker }] : []),
      { id: "PLANT-IQ-MAHINDRA", organizationId: IQ_ORGANIZATION_ID, name: "Mahindra", code: "MAHINDRA", location: "Fictional IQ demo factory", description: "IQ demonstration factory", managerId: "", managerName: "", status: "Active", codeLocked: true, maximumActiveUsers: 25, demoDataset: marker },
      { id: "PLANT-IQ-BOAT", organizationId: IQ_ORGANIZATION_ID, name: "Boat", code: "BOAT", location: "Fictional IQ demo factory", description: "IQ demonstration factory", managerId: "", managerName: "", status: "Active", codeLocked: true, maximumActiveUsers: 25, demoDataset: marker },
      { id: IQ_COLD_START_PLANT_ID, organizationId: IQ_ORGANIZATION_ID, name: "IQ Get Started Demo", code: "IQ-START", location: "Fictional IQ demo factory", description: "Disposable empty factory for the first-time onboarding demonstration", managerId: "", managerName: "", status: "Active", codeLocked: true, maximumActiveUsers: 5, demoDataset: marker },
      ...ADDITIONAL_CLIENTS.flatMap(client => client.factories.map(factory => ({
        ...factory,
        organizationId: client.id,
        location: "Fictional demo factory",
        description: `${client.name} demonstration factory`,
        managerId: "",
        managerName: "",
        status: "Active",
        codeLocked: true,
        maximumActiveUsers: 25,
        demoDataset: marker,
      }))),
    ],
    zones: [
      ...zones,
      { id: "ZONE-IQ-MAHINDRA-01", organizationId: IQ_ORGANIZATION_ID, plantId: "PLANT-IQ-MAHINDRA", accessModel: "v4", name: "Operations Zone", code: "OPS", department: "", leaderId: "", leaderName: "", status: "Active", codeApprovedBy: PLATFORM_PERSON_ID, codeApprovedAt: "2026-10-23T00:00:00.000Z" },
      { id: "ZONE-IQ-BOAT-01", organizationId: IQ_ORGANIZATION_ID, plantId: "PLANT-IQ-BOAT", accessModel: "v4", name: "Operations Zone", code: "OPS", department: "", leaderId: "", leaderName: "", status: "Active", codeApprovedBy: PLATFORM_PERSON_ID, codeApprovedAt: "2026-10-23T00:00:00.000Z" },
    ],
  };
}

function extendMvpV4(seed: JsonObject): JsonObject {
  const departments = array(seed.departments, "Embedded Departments");
  return { ...seed, departments: [...departments,
    { id: "DEPT-IQ-MAHINDRA-OPS", organizationId: IQ_ORGANIZATION_ID, plantId: "PLANT-IQ-MAHINDRA", zoneId: "ZONE-IQ-MAHINDRA-01", name: "Operations", code: "OPS", status: "Active", createdBy: PLATFORM_PERSON_ID, createdAt: "2026-10-23T00:00:00.000Z", updatedBy: PLATFORM_PERSON_ID, updatedAt: "2026-10-23T00:00:00.000Z", revision: 1 },
    { id: "DEPT-IQ-BOAT-OPS", organizationId: IQ_ORGANIZATION_ID, plantId: "PLANT-IQ-BOAT", zoneId: "ZONE-IQ-BOAT-01", name: "Operations", code: "OPS", status: "Active", createdBy: PLATFORM_PERSON_ID, createdAt: "2026-10-23T00:00:00.000Z", updatedBy: PLATFORM_PERSON_ID, updatedAt: "2026-10-23T00:00:00.000Z", revision: 1 },
  ] };
}

function extendMvpModules(seed: JsonObject, configuration: JsonObject): JsonObject {
  const plants = array(configuration.plants, "Factory module migration plants");
  if (seed.version === 2 && seed.factories && typeof seed.factories === "object" && !Array.isArray(seed.factories)) {
    const factories = { ...(seed.factories as JsonObject) };
    factories[IQ_COLD_START_PLANT_ID] ??= { ...NEW_FACTORY_ACCESS, audit: true, reports: true };
    return { ...seed, factories };
  }
  const legacy = seed;
  const fallback = object(legacy["abc-manufacturing"] ?? {}, "ABC module entitlements");
  return { version: 2, factories: Object.fromEntries(plants.map(plant => {
    const organizationId = typeof plant.organizationId === "string" ? plant.organizationId : "abc-manufacturing";
    const previous = legacy[organizationId];
    const access = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : organizationId === "abc-manufacturing" ? fallback : {};
    return [String(plant.id), plant.id === IQ_COLD_START_PLANT_ID ? { ...NEW_FACTORY_ACCESS, audit: true, reports: true } : { ...NEW_FACTORY_ACCESS, ...access }];
  })) };
}

function extendMvpManifest(seed: JsonObject, abcAdministrator: JsonObject, current: JsonObject, disposableOrganizations: Set<string>): JsonObject {
  const personas: JsonObject[] = array(seed.personas, "Embedded personas").map(persona => ({ ...persona, organizationId: persona.role === "Platform Super Admin" ? undefined : IQ_ORGANIZATION_ID, plantId: persona.role === "Client Administrator" || persona.role === "Platform Super Admin" ? undefined : IQ_BYD_PLANT_ID }));
  const canonical = [...personas, { personId: abcAdministrator.id, name: abcAdministrator.name, role: "Client Administrator", organizationId: "abc-manufacturing" }, ...ADDITIONAL_CLIENTS.map(item => ({ personId: item.personId, name: item.admin, role: "Client Administrator", organizationId: item.id }))];
  const ids = new Set(canonical.map(persona => String(persona.personId)));
  const preserved = array(current.personas ?? [], "Current persona manifest").filter(persona => typeof persona.organizationId === "string" && !disposableOrganizations.has(persona.organizationId) && !ids.has(String(persona.personId)));
  return { ...seed, organizationId: IQ_ORGANIZATION_ID, plantId: IQ_BYD_PLANT_ID, personas: [...canonical, ...preserved] };
}

function decodeSeed(data: Fixture, key: string) {
  const raw = data.storage[key];
  if (typeof raw !== "string") throw new Error(`The embedded demo dataset is missing ${key}.`);
  return JSON.parse(raw) as unknown;
}

function notify(keys: string[]) {
  refreshAdminDirectory();
  refreshOrganizationConfiguration();
  refreshCanonicalActionStore();
  refreshFiveSAuditStore();
  notifyAccessV3();
  notifyAccessV4();
  keys.forEach(key => window.dispatchEvent(new StorageEvent("storage", { key, storageArea: window.localStorage })));
}

async function rebuildNativeRoleDemo(): Promise<void> {
  requireDemoAccess();
  if (typeof window === "undefined") throw new Error("Demo initialization requires a browser.");
  const data = await fixture();
  const seedV3 = extendMvpAccess(object(decodeSeed(data, ACCESS_V3_KEY), "Embedded access data"));
  const seedClients = array(seedV3.clients, "Embedded clients");
  const targetOrganizationId = String(seedClients[0]?.id ?? "");
  if (!targetOrganizationId) throw new Error("The embedded demo client is invalid.");

  const currentV3 = object(parse(localStorage.getItem(ACCESS_V3_KEY), { version: 1, auditorGrants: [], clients: [], clientMemberships: [], factoryMemberships: [], zoneAllocations: [], factoryAdmins: [], factoryRequests: [], events: [] }, "Administration data"), "Administration data");
  const currentClients = array(currentV3.clients, "Administration clients");
  const currentUsers = includeMissingRows(
    array(parse(localStorage.getItem(DIRECTORY_KEY), [], "User directory"), "User directory"),
    array(ADMIN_USER_SEEDS, "Canonical ABC directory"),
  );
  const currentMemberships = array(currentV3.clientMemberships ?? [], "Administration client memberships");
  const abcAdministratorMemberships = currentMemberships.filter(membership => membership.organizationId === "abc-manufacturing" && membership.clientAdmin === true);
  const activeAbcAdministratorMemberships = abcAdministratorMemberships.filter(membership => membership.status === "Active");
  if (activeAbcAdministratorMemberships.length > 1 || (activeAbcAdministratorMemberships.length === 0 && abcAdministratorMemberships.length > 0)) throw new Error("ABC Manufacturing Client Administrator history requires review. Existing assignments were not changed.");
  let repairAbcAdministrator = false;
  let abcAdministrator: JsonObject;
  if (activeAbcAdministratorMemberships.length === 1) {
    const people = currentUsers.filter(person => person.id === activeAbcAdministratorMemberships[0].userId && person.status === "Active");
    if (people.length !== 1) throw new Error("The existing ABC Manufacturing Client Administrator identity requires review. Existing assignments were not changed.");
    abcAdministrator = people[0];
  } else {
    const matches = currentUsers.filter(person => person.id === ABC_ADMIN.id || String(person.email).toLowerCase() === ABC_ADMIN.email || String(person.employeeId).toLowerCase() === ABC_ADMIN.employeeId.toLowerCase());
    if (matches.length > 1 || (matches.length === 1 && (matches[0].id !== ABC_ADMIN.id || matches[0].name !== ABC_ADMIN.name || matches[0].email !== ABC_ADMIN.email || matches[0].employeeId !== ABC_ADMIN.employeeId || matches[0].status !== "Active"))) throw new Error("The default ABC Manufacturing administrator identity conflicts with an existing profile. Existing users were not changed.");
    abcAdministrator = matches[0] ?? { ...ABC_ADMIN, status: "Active", roles: [], permissions: [], plant: "", zoneMemberships: [], updatedAt: "2026-10-23T00:00:00.000Z", accessModel: "v3" };
    seedV3.clientMemberships = [...array(seedV3.clientMemberships ?? [], "Embedded client memberships"), { id: "CM-DEMO-ABC-ADMIN", userId: abcAdministrator.id, organizationId: "abc-manufacturing", status: "Active", clientAdmin: true, assignedBy: PLATFORM_PERSON_ID, assignedAt: "2026-10-23T00:00:00.000Z", updatedAt: "2026-10-23T00:00:00.000Z" }];
    repairAbcAdministrator = true;
  }
  const disposableOrganizations = new Set(currentClients.filter(client => {
    const marker = client.demoDataset;
    return marker && typeof marker === "object" && !Array.isArray(marker) && (marker as JsonObject).id === DATASET_ID && (marker as JsonObject).disposable === true;
  }).map(client => String(client.id)));
  OBSOLETE_DEMO_ORGANIZATION_IDS.forEach(id => disposableOrganizations.add(id));
  disposableOrganizations.add(targetOrganizationId);
  seedClients.forEach(client => disposableOrganizations.add(String(client.id)));

  const nextV3: JsonObject = { ...currentV3, version: 1 };
  for (const field of ["clients", "clientMemberships", "factoryMemberships", "zoneAllocations", "factoryAdmins", "factoryRequests", "auditorGrants", "events"] as const) {
    nextV3[field] = mergeRows(array(currentV3[field] ?? [], `Administration ${field}`), array(seedV3[field] ?? [], `Embedded ${field}`), row => field === "clients" ? disposableOrganizations.has(String(row.id)) : scoped(row, disposableOrganizations));
  }

  const seedUsers = extendMvpDirectory(array(decodeSeed(data, DIRECTORY_KEY), "Embedded directory"), repairAbcAdministrator ? abcAdministrator : undefined);
  const demoPersonIds = new Set(seedUsers.map(person => String(person.id)));
  const nextUsers = mergeRows(currentUsers, seedUsers, person => demoPersonIds.has(String(person.id)) || OBSOLETE_DEMO_PERSON_IDS.has(String(person.id)) || (typeof person.employeeId === "string" && person.employeeId.startsWith("IQ-DEMO-")));

  const seedConfiguration = extendMvpConfiguration(object(decodeSeed(data, CONFIGURATION_KEY), "Embedded organization configuration"));
  const currentConfiguration = object(parse(localStorage.getItem(CONFIGURATION_KEY), { plants: [], zones: [] }, "Organization configuration"), "Organization configuration");
  const currentPlants = includeMissingRows(
    array(currentConfiguration.plants ?? [], "Organization plants"),
    array(ORGANIZATION_PLANT_SEEDS, "Canonical ABC plants"),
  );
  const currentZones = includeMissingRows(
    array(currentConfiguration.zones ?? [], "Organization Zones"),
    array(ORGANIZATION_ZONE_SEEDS, "Canonical ABC Zones"),
  );
  const disposablePlants = new Set(currentPlants.filter(plant => scoped(plant, disposableOrganizations)).map(plant => String(plant.id)));
  array(seedConfiguration.plants, "Embedded plants").forEach(plant => disposablePlants.add(String(plant.id)));
  const nextConfiguration = {
    ...currentConfiguration,
    plants: mergeRows(currentPlants, array(seedConfiguration.plants, "Embedded plants"), plant => scoped(plant, disposableOrganizations) || disposablePlants.has(String(plant.id))),
    zones: mergeRows(currentZones, array(seedConfiguration.zones, "Embedded Zones"), zone => scoped(zone, disposableOrganizations) || disposablePlants.has(String(zone.plantId))),
  };

  const seedV4 = extendMvpV4(object(decodeSeed(data, ACCESS_V4_KEY), "Embedded v4 administration"));
  const currentV4 = object(parse(localStorage.getItem(ACCESS_V4_KEY), { schemaVersion: 1, policyVersion: "ops-access-v4", revision: 0, departments: [], assignments: [], events: [] }, "V4 administration"), "V4 administration");
  const nextV4 = {
    ...currentV4,
    schemaVersion: 1,
    policyVersion: "ops-access-v4",
    revision: Math.max(Number(currentV4.revision) || 0, Number(seedV4.revision) || 0) + 1,
    departments: mergeRows(array(currentV4.departments ?? [], "Departments"), array(seedV4.departments, "Embedded Departments"), row => scoped(row, disposableOrganizations)),
    assignments: mergeRows(array(currentV4.assignments ?? [], "Role assignments"), array(seedV4.assignments, "Embedded role assignments"), row => scoped(row, disposableOrganizations)),
    events: mergeRows(array(currentV4.events ?? [], "Role history"), array(seedV4.events, "Embedded role history"), row => scoped(row, disposableOrganizations)),
  };

  const mergeOperational = (key: string, label: string, canonical: JsonObject[]) => mergeRows(includeMissingRows(array(parse(localStorage.getItem(key), [], label), label), canonical), array(decodeSeed(data, key), `Embedded ${label}`).map(row => row.organizationId === IQ_ORGANIZATION_ID && row.plantId === IQ_BYD_PLANT_ID ? { ...row, plant: "BYD" } : row), row => scoped(row, disposableOrganizations));
  const currentModules = object(parse(localStorage.getItem(MODULES_KEY), {}, "Module entitlements"), "Module entitlements");
  const embeddedModules = object(decodeSeed(data, MODULES_KEY), "Embedded module entitlements");
  const legacyModules = currentModules.version === 2 ? embeddedModules : { ...embeddedModules, ...currentModules };
  const seedModules = extendMvpModules(legacyModules, nextConfiguration);
  const activeFactoryIds = new Set(array(nextConfiguration.plants, "Factory module migration plants").map(plant => String(plant.id)));
  const currentFactoryModules = currentModules.version === 2 && currentModules.factories && typeof currentModules.factories === "object" && !Array.isArray(currentModules.factories)
    ? Object.fromEntries(Object.entries(currentModules.factories as JsonObject).filter(([plantId]) => activeFactoryIds.has(plantId)))
    : {};
  const nextModules = currentModules.version === 2 && currentModules.factories && typeof currentModules.factories === "object" && !Array.isArray(currentModules.factories)
    ? { version: 2, factories: { ...(seedModules.factories as JsonObject), ...currentFactoryModules } }
    : seedModules;
  const currentManifest = object(parse(localStorage.getItem(MANIFEST_KEY), { personas: [] }, "Persona manifest"), "Persona manifest");

  const writes: Record<string, unknown> = {
    [DIRECTORY_KEY]: nextUsers,
    [CONFIGURATION_KEY]: nextConfiguration,
    [ACTIONS_KEY]: mergeOperational(ACTIONS_KEY, "Actions", array(MY_ACTIONS, "Canonical ABC Actions")),
    [AUDITS_KEY]: mergeOperational(AUDITS_KEY, "Audits", array(FIVE_S_AUDITS, "Canonical ABC Audits")),
    [ACCESS_V3_KEY]: nextV3,
    [ACCESS_V4_KEY]: nextV4,
    [MODULES_KEY]: nextModules,
    [MANIFEST_KEY]: extendMvpManifest(object(decodeSeed(data, MANIFEST_KEY), "Embedded persona manifest"), abcAdministrator, currentManifest, disposableOrganizations),
  };
  const previous = new Map(Object.keys(writes).map(key => [key, localStorage.getItem(key)]));
  try {
    Object.entries(writes).forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));
  } catch (error) {
    previous.forEach((value, key) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
    throw error;
  }
  notify(Object.keys(writes));
  switchFinalDemoPersona(PLATFORM_PERSON_ID);
}

/** First-time initialization is deliberately separate from the explicitly confirmed reset. */
export async function initializeNativeRoleDemo(): Promise<void> {
  requireDemoAccess();
  if (typeof window === "undefined") throw new Error("Demo initialization requires a browser.");
  const manifest = localStorage.getItem(MANIFEST_KEY);
  if (manifest !== null) {
    const { getFinalDemoManifest } = await import("./final-demo");
    if (!getFinalDemoManifest()) throw new Error("Unsupported or incomplete demo manifest. Existing data was preserved; review the saved dataset.");
    const { getAccessV3State } = await import("@/features/five-s/administration/access-v3-state");
    const { getAccessV4State } = await import("@/features/five-s/administration/access-v4-state");
    getAccessV3State(); getAccessV4State();
    return; // Do not reset identity, assignments, edits, revisions or history on repeated initialization.
  }
  if ([DIRECTORY_KEY, CONFIGURATION_KEY, ACTIONS_KEY, AUDITS_KEY, ACCESS_V3_KEY, ACCESS_V4_KEY].some(key => localStorage.getItem(key) !== null)) {
    throw new Error("This browser already contains workspace data. Initialization did not change it. Use a fresh browser profile for the demo, or review the explicit reset separately.");
  }
  await rebuildNativeRoleDemo();
}

export const resetNativeRoleDemo = rebuildNativeRoleDemo;
