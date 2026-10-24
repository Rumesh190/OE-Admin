import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  Eye,
  Flag,
  Footprints,
  ListTodo,
  Tag,
  TrendingUp,
} from "lucide-react";

export type OperationalModuleId =
  | "audit"
  | "continuousImprovement"
  | "redFlag"
  | "redTag"
  | "visualManagement"
  | "visualImprovement"
  | "gemba";

export type SharedCapabilityId = "actions" | "dashboards" | "reports";
export type LegacyModuleId = never;
export type AccessCapabilityId = OperationalModuleId | SharedCapabilityId | LegacyModuleId;
export type NavigationGroupId = "overview" | "operationalExcellence" | "execution" | "visualize" | "analytics" | "system";
export type ConceptStage = "observe" | "identify" | "dispose" | "improve" | "sustain" | "execute" | "visualize" | "analyze";

interface NavigationMetadata {
  navigationGroup: Exclude<NavigationGroupId, "overview" | "system">;
  conceptStage: ConceptStage;
  stageLabel?: string;
  order: number;
}

export interface OperationalModule extends NavigationMetadata {
  id: OperationalModuleId;
  label: string;
  route: string;
  legacyRoutes?: readonly string[];
  description: string;
  icon: LucideIcon;
  enabled: boolean;
  group: "operations";
}

export interface SharedCapability extends NavigationMetadata {
  id: SharedCapabilityId;
  label: string;
  route: string;
  legacyRoutes?: readonly string[];
  description: string;
  icon: LucideIcon;
  enabled: boolean;
  group: "shared";
}

export const OPERATIONAL_MODULES: readonly OperationalModule[] = [
  {
    id: "gemba",
    label: "Gemba",
    route: "/gemba",
    description: "Observe work where it happens.",
    icon: Footprints,
    enabled: true,
    group: "operations",
    navigationGroup: "operationalExcellence",
    conceptStage: "observe",
    stageLabel: "Observe",
    order: 10,
  },
  {
    id: "redTag",
    label: "Red Tag",
    route: "/5s/red",
    description: "Raise workplace issues, plan work, execute and review completion.",
    icon: Tag,
    enabled: true,
    group: "operations",
    navigationGroup: "operationalExcellence",
    conceptStage: "dispose",
    stageLabel: "Plan & Execute",
    order: 25,
  },
  {
    id: "continuousImprovement",
    label: "Continuous Improvement",
    route: "/continuous-improvement",
    legacyRoutes: ["/5s/continuous-improvement"],
    description: "Manage structured improvement from idea to realized benefit.",
    icon: TrendingUp,
    enabled: true,
    group: "operations",
    navigationGroup: "operationalExcellence",
    conceptStage: "improve",
    stageLabel: "Improve",
    order: 30,
  },
  {
    id: "audit",
    label: "Audit",
    route: "/audits",
    legacyRoutes: ["/5s/audits", "/5s/listing"],
    description: "Sustain operational standards through structured audits.",
    icon: ClipboardList,
    enabled: true,
    group: "operations",
    navigationGroup: "operationalExcellence",
    conceptStage: "sustain",
    stageLabel: "Sustain",
    order: 40,
  },
  {
    id: "visualImprovement",
    label: "Visual Improvement",
    route: "/visual-improvement",
    description: "Document visual before-and-after workplace improvements.",
    icon: Eye,
    enabled: true,
    group: "operations",
    navigationGroup: "visualize",
    conceptStage: "visualize",
    stageLabel: "Improve visually",
    order: 44,
  },
  {
    id: "visualManagement",
    label: "Visual Management",
    route: "/visual-management",
    description: "Run tier meetings and make performance and abnormalities visible.",
    icon: Eye,
    enabled: true,
    group: "operations",
    navigationGroup: "operationalExcellence",
    conceptStage: "visualize",
    stageLabel: "Visualize",
    order: 45,
  },
] as const;

export const SHARED_CAPABILITIES: readonly SharedCapability[] = [
  { id: "actions", label: "Actions", route: "/actions", legacyRoutes: ["/5s/actions"], description: "Execute corrective and improvement work.", icon: ListTodo, enabled: true, group: "shared", navigationGroup: "execution", conceptStage: "execute", order: 50 },
  { id: "reports", label: "Reports", route: "/reports", legacyRoutes: ["/5s/reports"], description: "Generate formal operational records and summaries.", icon: BarChart3, enabled: true, group: "shared", navigationGroup: "analytics", conceptStage: "analyze", order: 80 },
] as const;

export const ACCESS_CAPABILITIES = [...OPERATIONAL_MODULES, ...SHARED_CAPABILITIES] as const;

/** Retains stored organization values and old bookmarks without exposing a second Dashboard capability. */
const LEGACY_SHARED_CAPABILITIES: readonly SharedCapability[] = [
  { id: "dashboards", label: "Dashboards", route: "/analytics/dashboards", description: "Legacy analytics dashboard access.", icon: BarChart3, enabled: true, group: "shared", navigationGroup: "analytics", conceptStage: "analyze", order: 70 },
] as const;

/** Kept outside product-facing registries so historical records and bookmarks remain readable. */
export const LEGACY_MODULES = [] as const;

/** Compatibility-only: retained for stored entitlements, old URLs, Actions, and relationships. */
const LEGACY_OPERATIONAL_MODULES: readonly OperationalModule[] = [{
  id: "redFlag", label: "Red Flag", route: "/red-flag", description: "Historical operational abnormality records.", icon: Flag,
  enabled: false, group: "operations", navigationGroup: "operationalExcellence", conceptStage: "identify", stageLabel: "Identify", order: 20,
}];

const ALL_ACCESS_CAPABILITIES = [...ACCESS_CAPABILITIES, ...LEGACY_OPERATIONAL_MODULES, ...LEGACY_SHARED_CAPABILITIES, ...LEGACY_MODULES] as const;

export const NAVIGATION_GROUPS: ReadonlyArray<{ id: NavigationGroupId; label: string; order: number }> = [
  { id: "overview", label: "Overview", order: 0 },
  { id: "operationalExcellence", label: "Operational Excellence", order: 10 },
  { id: "execution", label: "Execution", order: 50 },
  { id: "visualize", label: "Visualize", order: 60 },
  { id: "analytics", label: "Analytics", order: 70 },
  { id: "system", label: "System", order: 80 },
];

export function getEnabledNavigationGroups(access: Record<AccessCapabilityId, boolean>) {
  return NAVIGATION_GROUPS
    .filter((group) => group.id !== "overview" && group.id !== "system")
    .map((group) => ({
      ...group,
      items: ACCESS_CAPABILITIES
        .filter((capability) => capability.navigationGroup === group.id && access[capability.id])
        .sort((left, right) => left.order - right.order),
    }))
    .filter((group) => group.items.length > 0);
}

export function getNavigationGroup(id: NavigationGroupId) {
  return NAVIGATION_GROUPS.find((group) => group.id === id)!;
}

export const DEFAULT_MODULE_ENTITLEMENTS: Record<AccessCapabilityId, boolean> =
  Object.fromEntries(ALL_ACCESS_CAPABILITIES.map((moduleConfig) => [moduleConfig.id, moduleConfig.enabled])) as Record<
    AccessCapabilityId,
    boolean
  >;

export function getOperationalModule(id: OperationalModuleId) {
  return [...OPERATIONAL_MODULES, ...LEGACY_OPERATIONAL_MODULES].find((module) => module.id === id)!;
}

export function getAccessCapability(id: AccessCapabilityId) {
  return ALL_ACCESS_CAPABILITIES.find((capability) => capability.id === id)!;
}

export function isModuleRouteActive(pathname: string, module: OperationalModule) {
  return [module.route, ...(module.legacyRoutes ?? [])].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isAccessCapabilityRouteActive(pathname: string, capability: OperationalModule | SharedCapability) {
  return [capability.route, ...(capability.legacyRoutes ?? [])].some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
