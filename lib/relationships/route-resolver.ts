/**
 * OPS Route Resolver
 * 
 * PHASE 4 — Centralized route resolution for OpsRecordRef
 * 
 * CRITICAL:
 * - Uses existing application routes
 * - Does NOT create new routes
 * - Returns null for unsupported/missing records
 * - Centralizes module route logic
 */

import { deletedRecordRef } from "@/lib/records/record-tombstones";
import type { OpsRecordRef } from "./types";

/**
 * Resolve an OpsRecordRef to its application route
 * 
 * Returns null if:
 * - Module is not supported
 * - Record type cannot be reliably routed
 * - Route structure is unclear
 * 
 * DO NOT invent destinations
 */
export function resolveRecordRoute(ref: OpsRecordRef): string | null {
  if (deletedRecordRef(ref)) return null;
  switch (ref.module) {
    case "action":
      // Canonical action route
      return `/actions/${encodeURIComponent(ref.recordId)}`;

    case "redTag":
      // Red Tag V2 route
      return `/5s/red/${encodeURIComponent(ref.recordId)}`;

    case "gemba":
      // Gemba walk or observation
      if (ref.childId) {
        // Observation within walk
        return `/gemba/${encodeURIComponent(ref.recordId)}?tab=observations#${encodeURIComponent(ref.childId)}`;
      }
      // Walk detail
      return `/gemba/${encodeURIComponent(ref.recordId)}`;

    case "continuousImprovement":
      // CI detail route
      return `/continuous-improvement/${encodeURIComponent(ref.recordId)}`;

    case "redFlag":
      // Red Flag detail route
      return `/red-flag/${encodeURIComponent(ref.recordId)}`;

    case "visualManagement":
      // Visual Management - context-dependent
      // Could be board, meeting, topic, escalation
      // Without additional context, route to meetings if childId suggests meeting
      if (ref.childId && ref.childId.startsWith("VMM-")) {
        return `/visual-management/meetings/${encodeURIComponent(ref.childId)}`;
      }
      // Fallback: boards list or board detail
      if (ref.recordId.startsWith("VM-")) {
        return `/visual-management/boards/${encodeURIComponent(ref.recordId)}`;
      }
      return `/visual-management`;

    case "audit":
      // Audit execution/detail is selected from the canonical Audit workspace.
      // Child references safely fall back to the parent Audit until a dedicated
      // finding route exists.
      return `/audits?audit=${encodeURIComponent(ref.recordId)}`;

    case "visualImprovement":
      // Legacy improvement route
      return `/visual-improvement/${encodeURIComponent(ref.recordId)}`;

    default:
      // Unsupported module
      return null;
  }
}

/**
 * Get a human-readable label for a record reference
 * 
 * Uses the provided label if available, otherwise generates a default
 */
export function getRecordRefLabel(ref: OpsRecordRef): string {
  if (ref.label) {
    return ref.label;
  }

  // Generate default label
  switch (ref.module) {
    case "action":
      return `Action ${ref.recordId}`;
    case "redTag":
      return `Red Tag ${ref.recordId}`;
    case "gemba":
      return ref.childId
        ? `Observation ${ref.childId}`
        : `Gemba Walk ${ref.recordId}`;
    case "continuousImprovement":
      return `Improvement ${ref.recordId}`;
    case "redFlag":
      return `Red Flag ${ref.recordId}`;
    case "visualManagement":
      return ref.childId ? `VM ${ref.childId}` : `Board ${ref.recordId}`;
    case "audit":
      return ref.childId ? `Finding ${ref.childId}` : `Audit ${ref.recordId}`;
    case "visualImprovement":
      return `Improvement ${ref.recordId}`;
    default:
      return `${ref.module} ${ref.recordId}`;
  }
}

/**
 * Get module display name
 */
export function getModuleDisplayName(module: OpsRecordRef["module"]): string {
  switch (module) {
    case "action":
      return "Action";
    case "redTag":
      return "Red Tag";
    case "gemba":
      return "Gemba";
    case "continuousImprovement":
      return "Continual Improvement";
    case "redFlag":
      return "Red Flag";
    case "visualManagement":
      return "Visual Management";
    case "audit":
      return "Audit";
    case "visualImprovement":
      return "Visual Improvement";
    default:
      return module;
  }
}
