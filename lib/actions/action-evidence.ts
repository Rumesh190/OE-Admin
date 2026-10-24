import { getRedTagEvidenceArchive } from "@/features/five-s/red-tag/store";
import { getGembaEvidenceArchive } from "@/features/gemba/gemba-store";
import { deletedActionSource } from "@/lib/records/record-tombstones";
import { getRedTagIdentificationEvidence, type RedTag } from "@/features/five-s/red-tag/types";
import type { MyAction, MyActionEvidence } from "@/features/five-s/types/my-actions";
import type { GembaState } from "@/features/gemba/types";
import { getGembaState } from "@/features/gemba/gemba-store";
import { getActionSourceRecordLabel, inferActionSourceModule } from "./action-config";

export interface ResolvedActionSourceEvidence {
  evidence: MyActionEvidence[];
  state: "available" | "not-captured" | "unavailable";
  provenance: string;
  description: string;
  readOnly: true;
}

/**
 * Canonical source-owned Before evidence resolver used by both Action execution
 * and Action reporting. It returns presentation references and never persists or
 * copies evidence into the Action record.
 */
export function resolveActionSourceBeforeEvidence(action: MyAction, redTags: RedTag[], gemba?: GembaState): ResolvedActionSourceEvidence {
  if (action.issueEvidence?.length && (inferActionSourceModule(action) !== "gemba" || action.issueEvidence.every(item => item.url || item.storageKey))) return {
    evidence: action.issueEvidence,
    state: "available",
    provenance: "Action issue evidence",
    description: "Original condition captured when this action was created.",
    readOnly: true,
  };

  if (inferActionSourceModule(action) === "gemba") {
    const observationId = action.sourceObservationId;
    const observation = observationId
      ? (deletedActionSource(action, "gemba") ? getGembaEvidenceArchive() : gemba ?? getGembaState()).observations.find((item) => item.id === observationId && (!action.sourceId || item.gembaId === action.sourceId))
      : undefined;
    const sourceLabel = `Gemba · ${getActionSourceRecordLabel(action)}`;
    if (!observation) return {
      evidence: [], state: "unavailable", provenance: sourceLabel,
      description: `Source: ${sourceLabel}`, readOnly: true,
    };
    const evidence = observation.evidence.map((item) => ({
      id: item.id,
      name: item.name,
      type: "image" as const,
      evidenceType: "finding" as const,
      uploadedAt: item.uploadedAt,
      uploadedBy: item.uploadedBy,
      mimeType: item.mimeType,
      url: item.url,
      storageKey: item.storageKey,
    }));
    return {
      evidence,
      state: evidence.length ? "available" : "not-captured",
      provenance: sourceLabel,
      description: `Source: ${sourceLabel}`,
      readOnly: true,
    };
  }

  if (inferActionSourceModule(action) !== "redTag") return {
    evidence: [],
    state: "not-captured",
    provenance: "Source record",
    description: "Original condition captured by the source record.",
    readOnly: true,
  };

  const sourceId = action.sourceId ?? action.sourceTitle;
  const source = (deletedActionSource(action, "redTag") ? getRedTagEvidenceArchive() : redTags).find((tag) => tag.id === sourceId || tag.tagNumber === sourceId);
  const sourceLabel = source ? `Red Tag · ${source.tagNumber}` : `Red Tag · ${getActionSourceRecordLabel(action)}`;

  if (!source) return {
    evidence: [], state: "unavailable", provenance: sourceLabel,
    description: `Source: ${sourceLabel}`, readOnly: true,
  };
  if (!source.imageUrl?.trim()) return {
    evidence: [], state: "not-captured", provenance: sourceLabel,
    description: `Source: ${sourceLabel}`, readOnly: true,
  };

  return {
    evidence: getRedTagIdentificationEvidence(source).map(photo => ({ ...photo, type: "image", evidenceType: "finding" })),
    state: "available",
    provenance: sourceLabel,
    description: `Source: ${sourceLabel}`,
    readOnly: true,
  };
}

export function actionEvidenceEmptyText(state: ResolvedActionSourceEvidence["state"]) {
  return state === "unavailable" ? "Evidence unavailable" : "No evidence captured";
}
