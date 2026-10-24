"use client";

import { initializeNativeRoleDemo } from "./native-demo-data";
import { EGMORE_DEMO_MANIFEST_KEY, prepareEgmoreDemoData } from "./egmore-demo-data";
import { FINAL_DEMO_KEY, getFinalDemoManifest } from "./final-demo";
import { requireDemoAccess } from "./demo-access";
import { switchFinalDemoPersona } from "./switch-final-persona";
import { ACCESS_V3_KEY, getAccessV3State, notifyAccessV3 } from "@/features/five-s/administration/access-v3-state";
import { getAccessV4State, notifyAccessV4 } from "@/features/five-s/administration/access-v4-state";
import { getCanonicalAdminUsers, refreshAdminDirectory } from "@/features/five-s/administration/store";
import { resolveFactoryPerson } from "@/features/five-s/administration/factory-authorization";
import { initializeCurrentAccessContext, notifyAccessContextChanged } from "@/features/five-s/administration/access-v4-context";
import { hasAuthenticatedDemoSession } from "@/lib/demo-session";
import { canonicalOnboardingConfiguration } from "@/features/five-s/administration/iq-onboarding";
import { notifyDemoIdentityChanged } from "@/lib/current-user";
import { refreshOrganizationConfiguration } from "@/lib/organization-store";
import { FACTORY_MODULE_ACCESS_KEY, notifyFactoryAccessChanged } from "@/lib/module-entitlements";
import { V4_STORAGE_KEY } from "@/lib/administration-v4-storage";
import { ADMINISTRATION_JOURNAL_KEY } from "@/lib/administration-storage";
import { GEMBA_STORAGE_KEY } from "@/features/gemba/gemba-store";
import { RED_TAG_STORAGE_KEY } from "@/features/five-s/red-tag/store";
import { CONTINUOUS_IMPROVEMENT_STORAGE_KEY } from "@/features/five-s/continuous-improvement/store";
import { VISUAL_IMPROVEMENT_STORAGE_KEY } from "@/features/visual-improvement/visual-improvement-store";
import { VISUAL_MANAGEMENT_STORAGE_KEY } from "@/features/visual-management/visual-management-store";

export const APPROVED_DEMO_BOOTSTRAP_KEY = "ops-approved-demo-bootstrap-v1";
/** Canonical source IDs; the assignment is validated, never inferred from this default. */
export const APPROVED_DEMO_DEFAULT = { personId: "USR-LAKSHMAN", organizationId: "abc-manufacturing", plantId: "PLANT-EGM" } as const;
const DATA_KEYS = ["five-s-administration-users-v1", "ops-organization-configuration-v1", "standalone-5s-actions", "manufacturing-qms-five-s-audits-v1", ACCESS_V3_KEY, V4_STORAGE_KEY, FACTORY_MODULE_ACCESS_KEY, GEMBA_STORAGE_KEY, RED_TAG_STORAGE_KEY, CONTINUOUS_IMPROVEMENT_STORAGE_KEY, VISUAL_IMPROVEMENT_STORAGE_KEY, VISUAL_MANAGEMENT_STORAGE_KEY, FINAL_DEMO_KEY, EGMORE_DEMO_MANIFEST_KEY];
const TRANSACTION_KEYS = [...DATA_KEYS, APPROVED_DEMO_BOOTSTRAP_KEY, "five-s-demo-role", "ops-administration-demo-person-v1", "ops-active-access-context-v1"];

function validateExistingWorkspace() {
  getAccessV3State(); getAccessV4State(); getCanonicalAdminUsers(); canonicalOnboardingConfiguration();
  const raw = localStorage.getItem(FACTORY_MODULE_ACCESS_KEY);
  if (raw !== null) {
    const modules: unknown = JSON.parse(raw);
    if (!modules || typeof modules !== "object" || Array.isArray(modules)) throw new Error("Invalid saved factory entitlements. Existing data was preserved.");
    if ("version" in modules && modules.version !== 2) throw new Error("Unsupported factory entitlement version. Existing data was preserved.");
    if ("version" in modules && (!("factories" in modules) || !modules.factories || typeof modules.factories !== "object" || Array.isArray(modules.factories))) throw new Error("Invalid saved factory entitlement map. Existing data was preserved.");
  }
}

function validateInitializedWorkspace() {
  if (!getFinalDemoManifest()) throw new Error("The saved demo hierarchy is incomplete or unsupported. Existing data was preserved.");
  const egmore: unknown = JSON.parse(localStorage.getItem(EGMORE_DEMO_MANIFEST_KEY) ?? "null");
  if (!egmore || typeof egmore !== "object" || !("factoryId" in egmore) || egmore.factoryId !== APPROVED_DEMO_DEFAULT.plantId) throw new Error("The saved Egmore demo manifest requires review. Existing data was preserved.");
  validateExistingWorkspace();
}

let pending: Promise<{ initialized: boolean; notice: string }> | undefined;
/** Run before operational children mount, in both development and authorized production. */
export function bootstrapApprovedDemo() {
  requireDemoAccess();
  if (!hasAuthenticatedDemoSession()) throw new Error("Sign in before initializing the approved demo.");
  pending ??= initialize().finally(() => { pending = undefined; });
  return pending;
}

async function initialize() {
  if (localStorage.getItem(ADMINISTRATION_JOURNAL_KEY)) throw new Error("Recover the pending administration transaction before initializing the demo. Storage was preserved.");
  const marker = localStorage.getItem(APPROVED_DEMO_BOOTSTRAP_KEY);
  if (marker !== null) {
    const parsed: unknown = JSON.parse(marker);
    if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 1) throw new Error("Unsupported demo bootstrap version. Existing data was preserved.");
    validateInitializedWorkspace();
    initializeCurrentAccessContext();
    return { initialized: false, notice: "" };
  }
  if (localStorage.getItem(FINAL_DEMO_KEY) !== null && !getFinalDemoManifest()) throw new Error("Unsupported demo hierarchy manifest. Existing data was preserved.");
  // Adopt a previously prepared, supported native + Egmore workspace without reseeding it.
  if (localStorage.getItem(FINAL_DEMO_KEY) && localStorage.getItem(EGMORE_DEMO_MANIFEST_KEY)) {
    validateInitializedWorkspace();
    localStorage.setItem(APPROVED_DEMO_BOOTSTRAP_KEY, JSON.stringify({ version: 1 }));
    initializeCurrentAccessContext();
    return { initialized: false, notice: "" };
  }
  if (DATA_KEYS.some(key => localStorage.getItem(key) !== null)) {
    validateExistingWorkspace();
    initializeCurrentAccessContext();
    return { initialized: false, notice: "Existing browser records were preserved. Use a fresh browser profile for first-time approved demo initialization." };
  }
  const before = new Map(TRANSACTION_KEYS.map(key => [key, localStorage.getItem(key)]));
  const restore = () => before.forEach((value, key) => value === null ? localStorage.removeItem(key) : localStorage.setItem(key, value));
  try {
    await initializeNativeRoleDemo();
    await prepareEgmoreDemoData();
    const actor = resolveFactoryPerson(APPROVED_DEMO_DEFAULT.personId, APPROVED_DEMO_DEFAULT);
    if (!actor.valid || !actor.factoryAdmin) throw new Error("The approved default identity has no canonical Egmore Factory Admin assignment.");
    switchFinalDemoPersona(APPROVED_DEMO_DEFAULT.personId, { kind: "factory", organizationId: APPROVED_DEMO_DEFAULT.organizationId, plantId: APPROVED_DEMO_DEFAULT.plantId });
    validateInitializedWorkspace();
    localStorage.setItem(APPROVED_DEMO_BOOTSTRAP_KEY, JSON.stringify({ version: 1 }));
    return { initialized: true, notice: "" };
  } catch (error) {
    restore();
    refreshAdminDirectory(); refreshOrganizationConfiguration(); notifyAccessV3(); notifyAccessV4(); notifyDemoIdentityChanged(); notifyFactoryAccessChanged(); notifyAccessContextChanged();
    restore(); // Refreshers may materialize source defaults; failed initialization must preserve original bytes.
    throw error;
  }
}
