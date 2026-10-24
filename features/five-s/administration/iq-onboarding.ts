"use client";
/** Approved plan is configuration, never fixture data or a provisioning side effect. */
import { getCanonicalAdminUsers } from "./store";
import { getAccessV3State, ACCESS_V3_KEY } from "./access-v3-state";
import { getAccessV4State } from "./access-v4-state";
import { getActiveAccessContext } from "./access-v4-context";
import { getOrganizations, ORGANIZATIONS, type Organization } from "@/lib/organizations";
import { getAllOrganizationConfiguration, type OrganizationPlant, type OrganizationZone } from "@/lib/organization-store";
import { readAdministrationPayload } from "@/lib/administration-storage";
import { resolveFactoryPerson } from "./factory-authorization";
import type { AdminUser } from "./types";
export const IQ_PLAN = {
  client: { name: "IQ", industry: "Manufacturing" },
  administrator: { name: "IQ Manoj", email: "manoj@iq-demo.invalid", employeeId: "IQ-DEMO-CA" },
  factory: { name: "IQ Factory 1", code: "IQF", location: "Chennai", maximumActiveUsers: 25 },
  lakshmanPersonId: "USR-LAKSHMAN",
  zones: [ { name: "Zone A", proposedCode: "ZA" }, { name: "Zone B", proposedCode: "ZB" }, { name: "Zone C", proposedCode: "ZC" }, { name: "Zone D", proposedCode: "ZD" } ],
} as const;
export const CONFIGURATION_KEY = "ops-organization-configuration-v1";
export const DIRECTORY_KEY = "five-s-administration-users-v1";
export function canonicalOnboardingPeople(): AdminUser[] {
  return getCanonicalAdminUsers();
}
export function canonicalOnboardingConfiguration(): ReturnType<typeof getAllOrganizationConfiguration> {
  const raw = readAdministrationPayload(CONFIGURATION_KEY);
  const config: ReturnType<typeof getAllOrganizationConfiguration> = raw === null ? getAllOrganizationConfiguration() : JSON.parse(raw);
  if (!config || !Array.isArray(config.plants) || !Array.isArray(config.zones) || config.plants.some(p => !p || typeof p.id !== "string") || config.zones.some(z => !z || typeof z.id !== "string") || new Set(config.plants.map(p => p.id)).size !== config.plants.length || new Set(config.zones.map(z => z.id)).size !== config.zones.length) throw new Error("Canonical factory configuration requires review. Preserve its original payload.");
  return config;
}
const sameText = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export function canonicalIQClient(id?: string): Organization | undefined {
  const candidates = getOrganizations().filter(o => sameText(o.name, IQ_PLAN.client.name));
  if (candidates.length > 1) throw new Error("IQ client identity is ambiguous; no duplicate client will be created.");
  const client = candidates[0];
  if (id && client?.id !== id) throw new Error("The requested canonical client is not the approved IQ client.");
  if (client && ORGANIZATIONS.some(existing => existing.id === client.id)) throw new Error("IQ must have an independent canonical client ID; an existing client cannot be renamed or converted.");
  if (client && (client.status !== "Active" || (client.operationalState !== "Staged" && !(client.operationalState === "Active" && client.demoDataset?.id === "ops-iq-v4-demo-v1" && client.demoDataset.disposable)) || !sameText(client.industry, IQ_PLAN.client.industry))) throw new Error("Existing IQ configuration conflicts with the approved staged plan. No client will be renamed or reset.");
  return client;
}
export function canonicalIQFactory(organizationId: string): OrganizationPlant | undefined {
  const candidates = canonicalOnboardingConfiguration().plants.filter(p => p.organizationId === organizationId && (sameText(p.name, IQ_PLAN.factory.name) || sameText(p.code, IQ_PLAN.factory.code)));
  if (candidates.length > 1 || candidates.some(p => p.id === "PLANT-EGM" || p.status !== "Active" || !sameText(p.name, IQ_PLAN.factory.name) || !sameText(p.code, IQ_PLAN.factory.code) || !sameText(p.location, IQ_PLAN.factory.location))) throw new Error("IQ factory configuration conflicts with the approved plan. No factory will be moved or overwritten.");
  return candidates[0];
}
/** A matching contact is reusable here only as the already-appointed, distinct IQ CA. */
export function existingIQClientAdministrator(organizationId: string): AdminUser | undefined {
  const people = canonicalOnboardingPeople();
  const matches = people.filter(p => sameText(p.email, IQ_PLAN.administrator.email) || sameText(p.employeeId, IQ_PLAN.administrator.employeeId));
  if (!matches.length) return undefined;
  const p = matches[0];
  const memberships = getAccessV3State().clientMemberships.filter(m => m.userId === p.id && m.organizationId === organizationId);
  if (matches.length !== 1 || p.id === "USR-MANOJ-GURU" || p.status !== "Active" || !sameText(p.name, IQ_PLAN.administrator.name) || !sameText(p.email, IQ_PLAN.administrator.email) || !sameText(p.employeeId, IQ_PLAN.administrator.employeeId) || memberships.length !== 1 || memberships[0].status !== "Active" || !memberships[0].clientAdmin) throw new Error("IQ Client Admin contact collision or unreviewed existing identity. Do not merge or create a replacement profile.");
  return p;
}
export function iqLakshmanMembership(organizationId: string) {
  const people = canonicalOnboardingPeople().filter(p => p.id === IQ_PLAN.lakshmanPersonId);
  if (people.length !== 1 || people[0].status !== "Active") throw new Error("Lakshman's canonical identity requires platform review; name matching is insufficient.");
  const memberships = getAccessV3State().clientMemberships.filter(m => m.userId === people[0].id && m.organizationId === organizationId);
  if (memberships.length > 1 || memberships.some(m => m.status !== "Active")) throw new Error("Existing/inactive IQ membership requires review.");
  return memberships[0];
}
export function hasReviewedIQAttachment(organizationId: string) {
  const m = iqLakshmanMembership(organizationId);
  const person = canonicalOnboardingPeople().find(p => p.id === IQ_PLAN.lakshmanPersonId);
  return Boolean(m && person && getAccessV3State().events.some(e => {
    const after = e.after as { membership?: { id?: string }; identityReview?: { personId?: string; email?: string; employeeId?: string; confirmedBy?: string } } | undefined;
    const review = after?.identityReview;
    return e.operation === "person.clientAttached" && e.actorId === "USR-OPS-SUPER-ADMIN" && e.organizationId === organizationId && e.targetId === m.id && m.assignedBy === e.actorId && after?.membership?.id === m.id && review?.personId === person.id && review.confirmedBy === e.actorId && typeof review.email === "string" && typeof review.employeeId === "string" && sameText(review.email, person.email) && sameText(review.employeeId, person.employeeId);
  }));
}
export interface IQReadinessStep { id: string; label: string; status: "complete" | "pending"; detail: string }
export interface IQOnboardingReadiness {
  authorized: true; client?: { id: string; name: string }; administrator?: { id: string; name: string };
  factory?: { id: string; name: string; code: string; location: string }; zones: { id: string; name: string; code: string; approved: boolean }[];
  lakshman?: { id: string; email: string; employeeId: string }; attached: boolean; factoryAdmin: boolean; demo: boolean;
  steps: IQReadinessStep[]; activationAvailable: false; operationalState: "Staged" | "Active" | "Not created";
}
/** UI projection: unauthorized subjects receive no foreign IDs, counts, people or links. */
export function getIQOnboardingReadiness(): IQOnboardingReadiness | null {
  const context = getActiveAccessContext();
  if (!context) return null;
  if (context.kind !== "platform") {
    const client = getOrganizations().find(o => o.id === context.organizationId);
    if (!client || !sameText(client.name, IQ_PLAN.client.name)) return null;
    if (context.kind === "factory" && !resolveFactoryPerson(context.personId, context).factoryAdmin) return null;
  }
  const client = canonicalIQClient();
  const factory = client ? canonicalIQFactory(client.id) : undefined;
  if (context.kind === "factory" && (!factory || context.plantId !== factory.id)) return null;
  const ca = client ? existingIQClientAdministrator(client.id) : undefined;
  const attached = Boolean(client && hasReviewedIQAttachment(client.id));
  const admins = client && factory ? getAccessV3State().factoryAdmins.filter(a => a.organizationId === client.id && a.plantId === factory.id && a.userId === IQ_PLAN.lakshmanPersonId) : [];
  const fa = Boolean(attached && admins.filter(a => a.status === "Active").length === 1 && admins.filter(a => a.status === "Active").every(a => resolveFactoryPerson(a.userId, { organizationId: client!.id, plantId: factory!.id }).factoryAdmin));
  const zones = factory ? canonicalOnboardingConfiguration().zones.filter(z => z.plantId === factory.id && z.organizationId === client?.id && z.status === "Active").map(z => ({ id: z.id, name: z.name, code: z.code, approved: z.accessModel === "v4" && Boolean(z.codeApprovedBy && z.codeApprovedAt) })) : [];
  const allZones = IQ_PLAN.zones.every(expected => zones.filter(z => z.name === expected.name && z.approved).length === 1);
  const demo = client?.demoDataset?.id === "ops-iq-v4-demo-v1" && client.demoDataset.disposable === true;
  const step = (id: string, label: string, complete: boolean, detail: string): IQReadinessStep => ({ id, label, status: complete ? "complete" : "pending", detail });
  const steps = [
    step("client", demo ? "IQ disposable demo client" : "IQ staged client", Boolean(client), client?.id ?? "Platform Super Admin must create the independent client."),
    step("administrator", "Default IQ Client Admin", Boolean(ca), ca?.id ?? "Automatic Client Administrator provisioning requires repair."),
    step("factory", "IQ Factory 1", Boolean(factory), factory ? `${factory.id} · ${factory.code} · ${factory.location}` : "IQ Client Admin must create the approved factory."),
    step("attachment", "Reviewed Lakshman attachment", attached, attached ? "Platform attachment recorded; existing memberships retained." : "Platform identity confirmation and reason required."),
    step("factoryAdmin", "Explicit Factory Admin appointment", fa, fa ? "Lakshman has an explicit IQ Factory Admin assignment." : "IQ Client Admin must explicitly appoint the reviewed existing person."),
    step("zones", "Zone A–D configuration", allZones, allZones ? "All four canonical Zones have recorded code confirmation." : "Proposed codes require explicit confirmation by Factory Admin."),
    step("departments", demo ? "Generated demo Departments" : "Approved Departments", Boolean(demo && factory && getAccessV4State().departments.some(d => d.plantId === factory.id && d.status === "Active")), demo ? "Product-owner-authorized generated demo configuration; not production approval." : "Configuration approval required: no Department names or codes have been approved; no placeholders are created."),
    step("personnel", demo ? "Generated demo roster" : "Approved users and allocations", Boolean(demo && factory && getAccessV3State().factoryMemberships.some(m => m.plantId === factory.id && m.status === "Active")), demo ? "Generated demo memberships and explicit roles; production personnel approval remains separate." : "Operational people, Department Leaders/Members and allocations remain unapproved."),
    step("audit", "Scoped Audit authorization", Boolean(demo && client?.operationalState === "Active"), demo ? "Audit-only disposable demo access; scoped Auditor grants and own-Zone exclusions still apply." : "Scoped Audit activation remains pending."),
    step("d10", "Canonical D10 corrective Actions", false, "Batch 3 canonical D10 service implemented; operational acceptance and activation remain pending. General Actions entitlement remains disabled."),
    step("acceptance", "Regression and authorization acceptance", false, "Consolidated quality gate follows Batch 3."),
    step("approval", "Explicit business activation approval", false, "Audit activation is unavailable during Batch 2."),
  ];
  const lakshman = context.kind === "platform" ? canonicalOnboardingPeople().find(p => p.id === IQ_PLAN.lakshmanPersonId && p.status === "Active") : undefined;
  return { authorized: true, client: client ? { id: client.id, name: client.name } : undefined, administrator: ca ? { id: ca.id, name: ca.name } : undefined, factory: factory ? { id: factory.id, name: factory.name, code: factory.code, location: factory.location } : undefined, zones, lakshman: lakshman ? { id: lakshman.id, email: lakshman.email, employeeId: lakshman.employeeId } : undefined, attached, factoryAdmin: fa, demo, steps, activationAvailable: false, operationalState: client ? client.operationalState ?? "Staged" : "Not created" };
}
export interface OnboardingExpectation {
  selectionId: string; revision: number; v3Payload: string | null; directoryPayload: string | null; configurationPayload: string | null;
}
export function captureOnboardingExpectation(): OnboardingExpectation {
  const context = getActiveAccessContext();
  if (!context) throw new Error("Select an explicit administration context.");
  return { selectionId: context.selectionId, revision: getAccessV4State().revision, v3Payload: readAdministrationPayload(ACCESS_V3_KEY), directoryPayload: readAdministrationPayload(DIRECTORY_KEY), configurationPayload: readAdministrationPayload(CONFIGURATION_KEY) };
}
/** Common projected compatibility discriminator; existing Zone strings remain untouched. */
export function isDepartmentlessV4Zone(zone: OrganizationZone) { return zone.accessModel === "v4" && zone.department === "" && Boolean(zone.organizationId); }
