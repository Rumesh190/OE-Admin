import type { AuditScoringPolicy, ComplianceResponse } from "@/lib/five-s/scoring-policy";

export type FiveSCategory =
  | "Sort"
  | "Set in Order"
  | "Shine"
  | "Standardize"
  | "Sustain";

export type FiveSAuditStage = FiveSCategory | "General";
export type AuditQuestionSource = "standard" | "custom";
export type AuditQuestionResponseType = "Compliance" | "Yes / No" | "Text";

export type FiveSAuditStatus =
  | "Draft"
  | "Scheduled"
  | "In Progress"
  | "Completed";

export type FiveSQuestionStatus =
  | "Not Started"
  | "Pass"
  | "Fail"
  | "NA";

export type FiveSActionStatus =
  | "Open"
  | "In Progress"
  | "Completed"
  | "Overdue";

/* =========================================================
   EVIDENCE
   ========================================================= */

export interface FiveSEvidence {
  id: string;
  name: string;

  type:
    | "image"
    | "document";

  size: number;

  dataUrl: string;
  /** Durable binary reference; dataUrl remains supported for historical evidence. */
  storageKey?: string;

  uploadedAt: string;

  uploadedBy: string;
}

/* =========================================================
   QUESTION
   ========================================================= */

export interface FiveSQuestion {
  /** Explicit canonical reference only; absent on all legacy snapshots. */
  departmentId?: string;
  id: string;

  category: FiveSAuditStage;

  question: string;

  description?: string;

  referenceImage?: string;

  referenceTitleKey?: string;

  referenceGuidanceKey?: string;

  referenceAltKey?: string;

  maxScore: number;

  score: number | null;

  /** Compliance identity independent of numeric policy score; absent on legacy records. */
  complianceResponse?: ComplianceResponse | null;

  status: FiveSQuestionStatus;

  observation?: string;

  evidence?: FiveSEvidence[];

  actionRequired: boolean;

  actionId?: string;

  /** Snapshot metadata. Missing values on legacy audits are treated as standard Compliance questions. */
  questionSource?: AuditQuestionSource;
  customQuestionId?: string;
  responseType?: AuditQuestionResponseType;
  mandatory?: boolean;
  requireEvidenceOnNonCompliance?: boolean;
  textResponse?: string;
  yesNoResponse?: "Yes" | "No";
}

/* =========================================================
   SECTION
   ========================================================= */

export interface FiveSSection {
  category: FiveSAuditStage;

  description: string;

  questions: FiveSQuestion[];

  score: number;

  maxScore: number;
}

/* =========================================================
   AUDIT
   ========================================================= */

export interface AuditAssignmentEvent {
  actorId: string; at: string; previousAuditorId?: string; previousAuditor: string; auditorId: string; auditor: string; reason: string;
}
export interface FiveSAudit {
  policyVersion?: "ops-access-v4";
  revision?: number;
  organizationId?: string;
  plantId?: string;
  zoneId?: string;
  assignedAuditorId?: string;
  assignmentHistory?: AuditAssignmentEvent[];
  signatureHistory?: NonNullable<FiveSAudit["auditorSignature"]>[];
  /** Absent on legacy audits; do not infer from scheduled or edited dates. */
  createdAt?: string;
  /** Immutable creation-time policy. Absent on legacy records. */
  scoringPolicy?: Readonly<AuditScoringPolicy>;
  id: string;

  title: string;

  plant: string;

  department: string;

  area: string;

  auditor: string;

  status: FiveSAuditStatus;

  score: number;

  maxScore: number;

  completionPercentage: number;

  scheduledDate?: string;

  scheduledTime?: string;

  startedAt?: string;

  completedAt?: string;

  auditorSignature?: {
    userId: string;
    userName: string;
    signedAt: string;
    signatureImage: string;
  };

  dueDate: string;

  sections: FiveSSection[];
}

/* =========================================================
   ACTION
   ========================================================= */

export interface FiveSAction {
  id: string;

  auditId: string;

  auditTitle: string;

  title: string;

  description: string;

  category: FiveSCategory;

  plant: string;

  department: string;

  area: string;

  assignedTo: string;

  status: FiveSActionStatus;

  priority:
    | "Low"
    | "Medium"
    | "High"
    | "Critical";

  dueDate: string;

  createdAt: string;

  completedAt?: string;

  evidence?: FiveSEvidence[];
}
