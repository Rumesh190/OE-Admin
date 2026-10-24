"use client";
import { getIQOnboardingReadiness } from "./iq-onboarding";
import { getAccessV3State } from "./access-v3-state";
import { getAccessV4State } from "./access-v4-state";
import { resolveFactoryPerson } from "./factory-authorization";
import { readCanonicalActions, validV4Selection, eligibleWorkCapacity } from "@/lib/actions/action-v4-policy";
import { DEFAULT_MODULE_ENTITLEMENTS } from "@/lib/modules";
import { getFactoryAccess } from "@/lib/module-entitlements";
import { ADMINISTRATION_JOURNAL_KEY } from "@/lib/administration-storage";
/** Read-only diagnosis. No caller-supplied boolean can activate or certify acceptance. */
export function getIQAuditActivationReadiness() {
  const onboarding = getIQOnboardingReadiness();
  if (!onboarding) return null;
  const org = onboarding.client?.id; const factory = onboarding.factory?.id;
  const scoped = { organizationId: org ?? "", plantId: factory ?? "" };
  const grants = getAccessV3State().auditorGrants.filter(g => g.organizationId === org && g.plantId === factory && g.status === "Active");
  const tasks = readCanonicalActions().filter(a => a.policyVersion === "ops-access-v4" && a.organizationId === org && a.plantId === factory);
  let auditOnly = false;
  try { const access = org && factory ? getFactoryAccess(org, factory) : undefined; auditOnly = Boolean(access && Object.keys(DEFAULT_MODULE_ENTITLEMENTS).every(key => access[key as keyof typeof DEFAULT_MODULE_ENTITLEMENTS] === (key === "audit" || key === "actions"))); } catch { auditOnly = false; }
  const checks = [
    { id: "ownership", met: Boolean(org && factory), detail: "Independent canonical IQ Client/Factory ownership" },
    { id: "clientAdmin", met: Boolean(onboarding.administrator), detail: "Verified distinct IQ Client Admin" },
    { id: "factoryAdmin", met: onboarding.factoryAdmin, detail: "Reviewed explicit Factory Admin membership" },
    { id: "zones", met: onboarding.steps.find(s => s.id === "zones")?.status === "complete", detail: "Confirmed Zone codes" },
    { id: "departments", met: false, detail: "Approved Department configuration evidence is not recorded; record existence alone is insufficient" },
    { id: "users", met: false, detail: "Approved operational roster/allocation evidence is not recorded" },
    { id: "auditors", met: grants.some(g => g.zoneIds.some(zoneId => resolveFactoryPerson(g.userId, { ...scoped, zoneId }).canAuditZone)), detail: "Effective explicit Auditor authorization with own-Zone exclusions" },
    { id: "scopeImplementation", met: true, detail: "Versioned Audit/context and durable evidence guards implemented; runtime acceptance still required" },
    { id: "d10Implementation", met: true, detail: "Atomic canonical Audit-question Action service implemented; runtime acceptance still required" },
    { id: "verifiers", met: tasks.length > 0 && tasks.every(a => a.v4 && eligibleWorkCapacity(a, a.v4.workCapacity) && validV4Selection(a)), detail: "Actual eligible owner capacities and independent verifier arrangements" },
    { id: "recovery", met: typeof window !== "undefined" && !window.localStorage.getItem(ADMINISTRATION_JOURNAL_KEY), detail: "No pending unsafe administration/source recovery" },
    { id: "auditOnly", met: auditOnly, detail: "Explicit Audit-only target entitlements; Staged clients remain denied regardless of this map" },
    { id: "acceptance", met: false, detail: "Consolidated regression/security/browser acceptance has not been approved" },
    { id: "businessApproval", met: false, detail: "Explicit business authorization to activate is not recorded" },
  ];
  void getAccessV4State(); // Unsupported persisted administration versions fail closed.
  return { readyToActivate: checks.every(c => c.met), executableActivation: false as const, checks };
}
