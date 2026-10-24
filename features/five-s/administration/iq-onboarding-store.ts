"use client";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { ADMINISTRATION_JOURNAL_KEY, readAdministrationPayload } from "@/lib/administration-storage";
import { commitAdministrationV4, withAdministrationLock } from "@/lib/administration-v4-storage";
import { refreshOrganizationConfiguration, type OrganizationZone } from "@/lib/organization-store";
import { getAccessV3State, ACCESS_V3_KEY, notifyAccessV3 } from "./access-v3-state";
import { getAccessV4State } from "./access-v4-state";
import { requireAccessContext } from "./access-v4-context";
import { resolveFactoryPerson } from "./factory-authorization";
import { refreshAdminDirectory } from "./store";
import { saveClientProfile, saveFactory, assignFactoryAdministrator } from "./access-v3-store";
import { attachPersonToClient } from "./access-v4-store";
import { IQ_PLAN, CONFIGURATION_KEY, DIRECTORY_KEY, canonicalOnboardingPeople, canonicalOnboardingConfiguration, canonicalIQClient, canonicalIQFactory, existingIQClientAdministrator, iqLakshmanMembership, hasReviewedIQAttachment, type OnboardingExpectation } from "./iq-onboarding";
import type { FactoryScope } from "./access-v4-models";
function assertExpected(expected: OnboardingExpectation) {
  if (window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY)) throw new Error("Administration recovery is required before onboarding can continue.");
  if (getAccessV4State().revision !== expected.revision || readAdministrationPayload(ACCESS_V3_KEY) !== expected.v3Payload || readAdministrationPayload(DIRECTORY_KEY) !== expected.directoryPayload || readAdministrationPayload(CONFIGURATION_KEY) !== expected.configurationPayload) throw new Error("Onboarding revision conflict. Reload and review the current canonical records.");
}
function platform(expected: OnboardingExpectation) {
  const context = requireAccessContext(expected.selectionId, { organizationId: "" }, "platform");
  const actor = getAuthenticatedDemoActor(context.personId);
  if (!actor?.identity.isSuperAdmin || actor.user.id !== "USR-OPS-SUPER-ADMIN") throw new Error("Platform Super Admin is required.");
  return actor;
}
function clientAdmin(organizationId: string, expected: OnboardingExpectation) {
  const context = requireAccessContext(expected.selectionId, { organizationId }, "client");
  const actor = getAuthenticatedDemoActor(context.personId);
  const memberships = getAccessV3State().clientMemberships.filter(m => m.userId === context.personId && m.organizationId === organizationId);
  if (!actor || actor.identity.isSuperAdmin || memberships.length !== 1 || memberships[0].status !== "Active" || !memberships[0].clientAdmin) throw new Error("The actual assigned IQ Client Admin is required; platform authority does not grant factory management.");
  canonicalIQClient(organizationId);
  return actor;
}
function freshCanonicalInputs(expected: OnboardingExpectation) {
  assertExpected(expected);
  canonicalOnboardingPeople(); canonicalOnboardingConfiguration();
  // Legacy commands read caches; refresh only after validating the raw canonical payloads.
  refreshAdminDirectory(); refreshOrganizationConfiguration();
  assertExpected(expected);
}
export function createIQStagedClient(expected: OnboardingExpectation) {
  return withAdministrationLock(() => {
    const actor = platform(expected); freshCanonicalInputs(expected);
    const existing = canonicalIQClient();
    if (existing) return existing;
    platform(expected); assertExpected(expected);
    return saveClientProfile({ ...IQ_PLAN.client }, actor.user.id);
  });
}
export function createIQFactory(organizationId: string, expected: OnboardingExpectation) {
  return withAdministrationLock(() => {
    const actor = clientAdmin(organizationId, expected); freshCanonicalInputs(expected);
    const administrator = existingIQClientAdministrator(organizationId);
    if (!administrator || administrator.id !== actor.user.id) throw new Error("The verified, distinct IQ Client Admin must create this factory.");
    const existing = canonicalIQFactory(organizationId);
    if (existing) return existing;
    clientAdmin(organizationId, expected); assertExpected(expected);
    return saveFactory(organizationId, { ...IQ_PLAN.factory }, actor.user.id);
  });
}
export async function attachIQLakshman(organizationId: string, confirmation: { personId: string; email: string; employeeId: string; reason: string }, expected: OnboardingExpectation) {
  platform(expected); assertExpected(expected); canonicalIQClient(organizationId);
  if (!existingIQClientAdministrator(organizationId) || !canonicalIQFactory(organizationId)) throw new Error("Create and verify the IQ Client Admin and factory before reviewing the attachment.");
  if (confirmation.personId !== IQ_PLAN.lakshmanPersonId || !confirmation.reason.trim() || !confirmation.email.trim() || !confirmation.employeeId.trim()) throw new Error("Confirm Lakshman's canonical ID, email and Employee ID, with a review reason.");
  const membership = iqLakshmanMembership(organizationId);
  if (membership) {
    // A retry is a read, never a grant or overwrite; still validate review and current contact.
    const person = canonicalOnboardingPeople().find(p => p.id === confirmation.personId)!;
    if (!hasReviewedIQAttachment(organizationId) || person.email.trim().toLowerCase() !== confirmation.email.trim().toLowerCase() || person.employeeId.trim().toLowerCase() !== confirmation.employeeId.trim().toLowerCase()) throw new Error("Existing IQ attachment or identity confirmation requires platform review.");
    return Promise.resolve(membership);
  }
  return attachPersonToClient({ personId: confirmation.personId, confirmedPersonId: confirmation.personId, organizationId, reason: confirmation.reason, expectedV3Payload: expected.v3Payload, expectedDirectoryPayload: expected.directoryPayload, identityConfirmation: { email: confirmation.email, employeeId: confirmation.employeeId } }, expected);
}
export function appointIQFactoryAdministrator(organizationId: string, plantId: string, confirmedPersonId: string, expected: OnboardingExpectation) {
  return withAdministrationLock(() => {
    const actor = clientAdmin(organizationId, expected); freshCanonicalInputs(expected);
    const administrator = existingIQClientAdministrator(organizationId);
    const plant = canonicalIQFactory(organizationId);
    if (!administrator || actor.user.id !== administrator.id || plant?.id !== plantId || confirmedPersonId !== IQ_PLAN.lakshmanPersonId || !hasReviewedIQAttachment(organizationId)) throw new Error("Verified IQ Client Admin, correct factory and platform-reviewed canonical Lakshman attachment are required.");
    const assignments = getAccessV3State().factoryAdmins.filter(a => a.userId === confirmedPersonId && a.organizationId === organizationId && a.plantId === plantId);
    if (assignments.length) {
      if (assignments.length === 1 && assignments[0].status === "Active" && resolveFactoryPerson(confirmedPersonId, { organizationId, plantId }).factoryAdmin) return assignments[0];
      throw new Error("Existing/inactive Factory Admin history requires review; no automatic reactivation.");
    }
    clientAdmin(organizationId, expected); assertExpected(expected);
    return assignFactoryAdministrator(organizationId, plantId, confirmedPersonId, actor.user.id);
  });
}
/** V4 Zone creation is separate from the legacy required-Department command. */
export function createV4FactoryZone(scope: FactoryScope, input: { name: string; code: string; codeConfirmed: boolean }, expected: OnboardingExpectation) {
  return withAdministrationLock(() => {
    const permission = () => {
      const context = requireAccessContext(expected.selectionId, scope, "factory");
      const actor = getAuthenticatedDemoActor(context.personId);
      if (!actor || !resolveFactoryPerson(context.personId, scope).factoryAdmin) throw new Error("An explicit Factory Admin assignment is required to configure Zones.");
      return actor;
    };
    const actor = permission(); freshCanonicalInputs(expected);
    if (!input.name.trim() || !input.code.trim() || input.codeConfirmed !== true) throw new Error("Zone name and explicitly confirmed code are required. Proposed codes are not approvals.");
    const configuration = structuredClone(canonicalOnboardingConfiguration());
    const matches = configuration.zones.filter(z => z.plantId === scope.plantId && (z.name.trim().toLowerCase() === input.name.trim().toLowerCase() || z.code.trim().toLowerCase() === input.code.trim().toLowerCase()));
    if (matches.length) {
      const z = matches[0];
      if (matches.length === 1 && z.accessModel === "v4" && z.organizationId === scope.organizationId && z.status === "Active" && z.name === input.name.trim() && z.code === input.code.trim().toUpperCase() && z.department === "" && z.codeApprovedBy && z.codeApprovedAt) return z;
      throw new Error("Zone name/code conflicts with an existing record. Legacy Zones are never converted, moved or overwritten.");
    }
    const at = new Date().toISOString();
    const zone: OrganizationZone = { id: `ZONE-${crypto.randomUUID()}`, organizationId: scope.organizationId, plantId: scope.plantId, accessModel: "v4", name: input.name.trim(), code: input.code.trim().toUpperCase(), department: "", leaderId: "", leaderName: "", status: "Active", codeApprovedBy: actor.user.id, codeApprovedAt: at };
    configuration.zones.push(zone);
    const state = structuredClone(getAccessV3State());
    state.events.push({ id: `ADM-${crypto.randomUUID()}`, actorId: actor.user.id, organizationId: scope.organizationId, plantId: scope.plantId, targetId: zone.id, operation: "zone.v4Created", at, after: zone });
    const reads = new Map([[ACCESS_V3_KEY, expected.v3Payload], [CONFIGURATION_KEY, expected.configurationPayload], [DIRECTORY_KEY, expected.directoryPayload]]);
    const originalConfig = expected.configurationPayload ? JSON.parse(expected.configurationPayload) as Record<string, unknown> : {};
    commitAdministrationV4([{ key: CONFIGURATION_KEY, before: expected.configurationPayload, after: JSON.stringify({ ...originalConfig, ...configuration }) }, { key: ACCESS_V3_KEY, before: expected.v3Payload, after: JSON.stringify(state) }], reads, () => { permission(); assertExpected(expected); });
    refreshOrganizationConfiguration(); notifyAccessV3(); return zone;
  });
}
export async function createIQZone(organizationId: string, plantId: string, zoneName: string, code: string, codeConfirmed: boolean, expected: OnboardingExpectation) {
  canonicalIQClient(organizationId);
  if (canonicalIQFactory(organizationId)?.id !== plantId || !IQ_PLAN.zones.some(z => z.name === zoneName)) throw new Error("Select one approved IQ Zone name in the canonical IQ factory.");
  if (!hasReviewedIQAttachment(organizationId) || !resolveFactoryPerson(IQ_PLAN.lakshmanPersonId, { organizationId, plantId }).factoryAdmin) throw new Error("The reviewed Lakshman Factory Admin appointment must be complete before IQ Zone setup.");
  return createV4FactoryZone({ organizationId, plantId }, { name: zoneName, code, codeConfirmed }, expected);
}
