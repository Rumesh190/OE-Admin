import type { WorkCapacitySnapshot, VerifierSelectionSnapshot, VerifierReplacementHistoryEvent } from "../administration/access-v4-models";
export type MyActionType = "immediate" | "corrective";

export type MyActionStatus =
  | "Awaiting Assignment"
  | "Assigned"
  | "Open"
  | "In Progress"
  | "Overdue"
  | "Pending Review"
  | "Pending Auditor Review"
  | "Awaiting Review"
  | "Rework Required"
  | "Completed";

export type MyActionActivityType =
  | "created"
  | "awaiting_assignment"
  | "assigned"
  | "started"
  | "start_undone"
  | "evidence_uploaded"
  | "submitted"
  | "resubmitted"
  | "reviewed"
  | "verified"
  | "sent_back"
  | "reminder_generated"
  | "escalated"
  | "escalation_acknowledged"
  | "due_date_changed"
  | "reassigned"
  | "closed";

export interface MyActionActivity {
  id: string;
  type: MyActionActivityType;
  actorId: string;
  actorName: string;
  createdAt: string;
  remark?: string;
  /** Selection recorded at this event; absent on historical events. */
  actionType?: MyActionType;
}

/** Immutable submission content; reviewEventId refers to canonical Action history. */
export interface MyActionSubmissionRevision {
  id: string;
  number: number;
  submittedAt: string;
  submittedByUserId?: string;
  submittedByName?: string;
  observation: string;
  actionType?: MyActionType;
  correctiveActionCategory?: string;
  costSaving?: number;
  currency?: string;
  evidence: MyActionEvidence[];
  progressEvidence: MyActionEvidence[];
  reviewEventId?: string;
  /** Existing latest work captured at review time, not reconstructed older revisions. */
  legacyCapturedAt?: string;
}

export interface MyActionReassignment {
  id: string;
  previousOwnerId?: string;
  previousOwnerName: string;
  newOwnerId: string;
  newOwnerName: string;
  changedByUserId: string;
  changedByName: string;
  changedAt: string;
  reason: string;
}

export type MyActionPriority =
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export type ActionSourceModule =
  | "audit"
  | "continuousImprovement"
  | "redFlag"
  | "redTag"
  | "visualManagement"
  | "visualImprovement"
  | "gemba"
  | "manual";

export type MyActionSource =
  | "5S Audit"
  | "Audit"
  | "Continuous Improvement"
  | "Red Flag"
  | "Red Tag"
  | "Visual Management"
  | "Visual Improvement"
  | "Gemba"
  | "Manual";

export interface MyActionEvidence {
  id: string;
  /** Action-level ownership metadata; optional for legacy evidence. */
  actionId?: string;
  evidenceType?: "finding" | "progress" | "resolution";
  name: string;

  type:
    | "image"
    | "document";

  uploadedAt: string;
  uploadedBy: string;
  mimeType?: string;

  url?: string;
  /** Durable binary reference in the shared local asset database; used by Gemba and Action uploads. */
  storageKey?: string;
}

export interface VisualManagementActionSource {
  boardId: string;
  /** Exact meeting origin for new records; absent on historical Actions. */
  meetingId?: string;
  configuredKpiId: string;
  actualEntryId: string;
  deviationId: string;
  reportingPeriod: { type: "daily" | "weekly" | "monthly" | "custom"; key: string; label: string };
  boardNameSnapshot: string;
  kpiNameSnapshot: string;
  actualValueSnapshot: number;
  targetSnapshot: number;
  measurementSnapshot: "count" | "percentage" | "number";
  statusSnapshot: "amber" | "red";
  deviationSnapshot: string;
}

export interface MyAction {
  policyVersion?: "ops-access-v4";
  organizationId?: string;
  plantId?: string;
  departmentId?: string;
  v4?: {
    version: 1; revision: number; workCapacity: WorkCapacitySnapshot;
    verifierSelection?: VerifierSelectionSnapshot;
    verifierHistory: VerifierReplacementHistoryEvent[];
    actualCompleterIds: string[];
  };
  id: string;

  /** Stable audit link for newly created actions; legacy records use sourceTitle. */
  auditId?: string;
  questionId?: string;
  questionText?: string;
  questionSource?: "standard" | "custom";
  customQuestionId?: string;
  sectionId?: string;
  zoneId?: string;

  title: string;
  description: string;

  source: MyActionSource;
  sourceTitle: string;

  /** Cross-module source metadata. Legacy audit records are normalized at read time. */
  sourceModule?: ActionSourceModule;
  sourceId?: string;
  sourceLabel?: string;
  sourceLocation?: string;
  sourceObservationId?: string;
  sourceObservation?: string;
  /** Exact VM references plus immutable display snapshots for KPI-created Actions. */
  visualManagementSource?: VisualManagementActionSource;

  category?: string;

  /** Operational classification selected when the action is created. */
  actionCategory?: string;
  /** Explicit selection made by the owner at Start Action; absent before start and on legacy records. */
  actionType?: MyActionType;
  /** Resolution classification selected by the responsible member. */
  correctiveActionCategory?: string;
  improvementTheme?: string;
  improvementClassification?: "Basic Improvement" | "Improvement Case" | "Trouble / Corrective Case";
  originalFinding?: string;

  plant: string;
  department: string;
  area: string;

  assignedTo: string;

  responsiblePersonId?: string;
  responsiblePersonName?: string;
  zoneLeaderId?: string;
  zoneLeaderName?: string;
  assignedByUserId?: string;
  assignedByName?: string;
  assignedAt?: string;
  createdByUserId?: string;
  createdByName?: string;

  /**
   * Auditor responsible for verifying the completed action.
   * Optional so existing/demo actions continue to work.
   */
  auditor?: string;

  status: MyActionStatus;
  priority: MyActionPriority;

  /** Effective date retained for existing filters and integrations. */
  dueDate: string;
  priorityDueDate?: string;
  dueDateOverride?: string;
  dueDateHistory?: Array<{ previousDate: string; newDate: string; reason: string; actorId: string; actorName: string; changedAt: string }>;

  createdAt: string;

  /**
   * Description entered by the responsible person
   * before submitting the action for auditor review.
   */
  actionTakenDescription?: string;
  resolutionObservation?: string;
  costSaving?: number;
  currency?: string;

  /**
   * Date the responsible person submitted the action
   * to the auditor for verification.
   */
  submittedForReviewAt?: string;
  submissionRevisions?: MyActionSubmissionRevision[];

  /**
   * Final auditor verification details.
   */
  reviewedAt?: string;
  reviewedBy?: string;
  reviewerId?: string;
  reviewerName?: string;

  completedAt?: string;
  completedByUserId?: string;
  completedByName?: string;
  reviewHistory?: MyActionActivity[];
  activityHistory?: MyActionActivity[];
  reassignmentHistory?: MyActionReassignment[];

  /** Explicit closure metadata. Legacy records continue to fall back to review/completion fields. */
  closedByUserId?: string;
  closedBy?: string;
  closedAt?: string;
  closureRemark?: string;

  /**
   * Evidence captured when the issue was originally
   * identified during the audit.
   *
   * Used as BEFORE evidence in the closure report.
   */
  issueEvidence?: MyActionEvidence[];

  /** Optional work-in-progress evidence; completion evidence remains in `evidence`. */
  progressEvidence?: MyActionEvidence[];

  /**
   * Evidence uploaded by the action owner when
   * completing the corrective action.
   *
   * Used as AFTER evidence in the closure report.
   */
  evidence: MyActionEvidence[];
}
