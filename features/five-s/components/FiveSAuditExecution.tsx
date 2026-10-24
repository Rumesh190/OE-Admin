"use client";
import { AuditCorrectiveActionDialog } from "@/features/actions/audit-corrective-action-dialog";
import { getActiveAccessContext } from "../administration/access-v4-context";
import { isV4Audit } from "@/lib/five-s/audit-authorization";
import { useActionEvidenceUrl } from "@/lib/actions/use-action-evidence-url";
import { isScopedAudit, requireAuditExecution } from "@/lib/five-s/audit-authorization";
import { getFiveSAuditById } from "@/lib/five-s/audit-store";
import { persistFiveSAuditEvidence } from "@/lib/five-s/audit-store";
import { CanonicalLinkedRecords } from "@/components/ops/ops-linked-records";

import { getAuditScoringValues, calculateAuditSectionTotals, complianceResponseForScore, questionComplianceResponse, DEFAULT_AUDIT_SCORING, type AuditScoringValues, type ComplianceResponse } from "@/lib/five-s/scoring-policy";
import { useAuditScrollFocus } from "@/components/ops/use-audit-scroll-focus";
import { useAuditNavigationFocus } from "@/components/ops/use-audit-navigation-focus";
import { ActionLink } from "@/components/ops/ops-return-link";
import { OpsFeedback } from "@/components/ops/ops-feedback";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  AlertCircle,
  ArrowLeft,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Eye,
  FileText,
  FileBarChart,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Save,
  Upload,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OpsCameraCapture } from "@/components/ops/ops-camera-capture";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FiveSPageHeader from "./FiveSPageHeader";
import AuditorSignaturePad from "./AuditorSignaturePad";
import FiveSReferenceGuide from "./FiveSReferenceGuide";
import { useI18n } from "@/components/preferences/use-i18n";
import { auditQuestionText, auditSectionDescription, auditSectionName } from "@/lib/audit-question-translations";
import { referenceFields } from "@/lib/five-s/reference-guides";
import { readEvidenceFile } from "@/lib/evidence-files";
import { MAX_EVIDENCE_IMAGES } from "@/lib/evidence-images";

import { CreateLinkedActionDialog, type LinkedActionContext } from "@/features/actions/create-linked-action-dialog";
import type { MyAction } from "@/features/five-s/types/my-actions";
import { getActionById, updateAction, changeActionPriority, useActionStore } from "@/lib/actions/action-store";
import { compactAuditEvidenceStorage, linkAuditQuestionAction, canCompleteFiveSAudit, completeFiveSAudit, getLinkedActionsForAudit, updateFiveSAudit } from "@/lib/five-s/audit-store";
import { AUDIT_EXECUTION_LIFECYCLE_STAGES } from "@/lib/five-s/lifecycle-status";
import { useCurrentUser } from "@/lib/current-user";
import {
  getFiveSZoneConfiguration,
  toLocalInputDate,
  type FiveSActionPriority,
} from "@/lib/five-s/configuration";
import { useActiveActionCategories } from "@/lib/actions/action-category-store";
import { getPriorityDueDate, useActiveActionPriorities } from "@/lib/actions/action-configuration-store";

import type {
  FiveSAudit,
  FiveSAuditStage,
  FiveSCategory,
  FiveSEvidence,
  FiveSQuestion,
  FiveSQuestionStatus,
  FiveSSection,
} from "../types/five-s";
import { isAuditQuestionComplete } from "@/features/settings/custom-audit-questions/checklist";

interface FiveSAuditExecutionProps {
  audit: FiveSAudit;
  onBack?: () => void;
  onComplete?: (audit: FiveSAudit) => void;
}

interface QuestionState {
  complianceResponse?: ComplianceResponse | null;
  status: FiveSQuestionStatus;
  score: number | null;
  observation: string;

  actionRequired: boolean;
  actionId?: string;

  actionTitle: string;
  actionDescription: string;
  actionCategory: string;

  assignedTo: string;
  responsiblePersonId: string;

  priority:
    | "Low"
    | "Medium"
    | "High"
    | "Critical";

  dueDate: string;

  evidence: FiveSEvidence[];
  textResponse: string;
  yesNoResponse?: "Yes" | "No";
}

const CATEGORY_ORDER: FiveSAuditStage[] = [
  "Sort",
  "Set in Order",
  "Shine",
  "Standardize",
  "Sustain",
  "General",
];

function isFiveSCategory(category: FiveSAuditStage): category is FiveSCategory {
  return category !== "General";
}



const SCORE_LABELS: Record<
  number,
  string
> = {
  0: "Non Compliance",
  1: "Partially Compliance",
  2: "Fully Compliance",
};

const SCORE_STYLES: Record<
  number,
  string
> = {
  0:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300",
  1:
    "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300",
  2:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300",
};

const SCORE_SELECTED_STYLES: Record<
  number,
  string
> = {
  0:
    "border-red-500 bg-red-50 text-red-700 shadow-[inset_0_0_0_1px_rgb(239_68_68/0.08)] dark:border-red-500/70 dark:bg-red-500/10 dark:text-red-300",
  1:
    "border-amber-500 bg-amber-50 text-amber-700 shadow-[inset_0_0_0_1px_rgb(245_158_11/0.08)] dark:border-amber-500/70 dark:bg-amber-500/10 dark:text-amber-300",
  2:
    "border-green-500 bg-green-50 text-green-700 shadow-[inset_0_0_0_1px_rgb(34_197_94/0.08)] dark:border-green-500/70 dark:bg-green-500/10 dark:text-green-300",
};

const SCORE_OPTION_STYLES: Record<number, string> = {
  0: "border-border/80 hover:border-red-300 hover:bg-red-50/40 dark:hover:border-red-500/35 dark:hover:bg-red-500/5",
  1: "border-border/80 hover:border-amber-300 hover:bg-amber-50/40 dark:hover:border-amber-500/35 dark:hover:bg-amber-500/5",
  2: "border-border/80 hover:border-green-300 hover:bg-green-50/40 dark:hover:border-green-500/35 dark:hover:bg-green-500/5",
};

const SCORE_INDICATOR_STYLES: Record<number, string> = {
  0: "border-red-300 bg-red-50 text-red-700 dark:border-red-500/35 dark:bg-red-500/10 dark:text-red-300",
  1: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-300",
  2: "border-green-300 bg-green-50 text-green-700 dark:border-green-500/35 dark:bg-green-500/10 dark:text-green-300",
};

function AuditLifecycleTimeline({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="flex min-w-0 flex-1 items-center" aria-label="Audit lifecycle">
      {AUDIT_EXECUTION_LIFECYCLE_STAGES.map((label, index) => {
        const complete = index < currentIndex;
        const current = index === currentIndex;

        return (
          <div key={label} className="relative flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
            <span className={`relative z-10 flex size-5 shrink-0 items-center justify-center rounded-full border text-[9px] ${complete ? "border-emerald-500 bg-emerald-500 text-white" : current ? "border-primary bg-primary text-primary-foreground ring-4 ring-primary/10" : "border-border bg-background text-muted-foreground"}`}>
              {complete ? <Check className="size-3" /> : index + 1}
            </span>
            {index < AUDIT_EXECUTION_LIFECYCLE_STAGES.length - 1 && <span className={`absolute left-[calc(50%+10px)] right-[calc(-50%+10px)] top-2.5 h-px ${index < currentIndex ? "bg-emerald-400" : "bg-border"}`} />}
            <span className={`min-w-0 text-xs leading-4 ${current ? "font-semibold text-primary" : complete ? "font-medium text-foreground" : "font-medium text-muted-foreground"}`}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function formatEvidenceSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getEvidenceFileLabel(evidence: FiveSEvidence) {
  const extension = evidence.name.split(".").pop();

  if (extension && extension !== evidence.name) {
    return extension.toUpperCase();
  }

  return evidence.type === "image" ? "Image" : "Document";
}

function isPdfEvidence(evidence: FiveSEvidence) {
  return evidence.name.toLowerCase().endsWith(".pdf") ||
    evidence.dataUrl.startsWith("data:application/pdf");
}

function createInitialQuestionState(
  question: FiveSQuestion
): QuestionState {
  return {
    status: question.status,
    score: question.score,
    complianceResponse: questionComplianceResponse(question),

    observation:
      question.observation ?? "",

    actionRequired:
      question.actionRequired,

    actionId:
      question.actionId,

    actionTitle: "",

    actionDescription:
      question.observation ?? "",
    actionCategory: "",

    assignedTo: "",
    responsiblePersonId: "",

    priority: "Medium",

    dueDate: getPriorityDueDate("Medium"),

    evidence:
      question.evidence ?? [],
    textResponse: question.textResponse ?? "",
    yesNoResponse: question.yesNoResponse,
  };
}

/**
 * Convert score into the existing FiveSQuestionStatus
 * expected by the existing data model.
 *
 * 0 / 1 => Fail
 * 2     => Pass
 * null  => Not Started
 */
function getStatusFromScore(
  score: number | null,
  policy: Readonly<AuditScoringValues> = DEFAULT_AUDIT_SCORING
): FiveSQuestionStatus {
  if (score === null) {
    return "Not Started";
  }

  if (complianceResponseForScore(score, policy) === 2) {
    return "Pass";
  }

  return "Fail";
}

function FiveSAuditExecution({
  audit,
  onBack,
  onComplete,
}: FiveSAuditExecutionProps) {
  const creationContext = useRef(getActiveAccessContext()?.selectionId ?? "");
  const versionedExpected = () => isV4Audit(audit) ? { selectionId: creationContext.current, revision: audit.revision! } : undefined;
  const scoringPolicy = getAuditScoringValues(audit);
  const SCORE_OPTIONS = [scoringPolicy.nonCompliance, scoringPolicy.partialCompliance, scoringPolicy.fullyCompliance];
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { language, t } = useI18n();
  const initialSections = useMemo<
    FiveSSection[]
  >(
    () =>
      audit.sections
        .map((section) => ({
          ...section,

          questions:
            section.questions.map(
              (question, questionIndex) => ({
                ...question,

                ...(!isV4Audit(audit) && question.referenceImage === undefined && question.questionSource !== "custom" && isFiveSCategory(section.category) ? referenceFields(section.category, questionIndex) : {}),

                evidence:
                  question.evidence ?? [],
              })
            ),
        }))
        .sort(
          (a, b) =>
            CATEGORY_ORDER.indexOf(
              a.category
            ) -
            CATEGORY_ORDER.indexOf(
              b.category
            )
        ),
    [audit]
  );

  const [uiError, setUiError] = useState("");
  const [
    sections,
    setSections,
  ] =
    useState<FiveSSection[]>(
      initialSections
    );

  const [
    questionStates,
    setQuestionStates,
  ] =
    useState<
      Record<string, QuestionState>
    >(() => {
      const state: Record<
        string,
        QuestionState
      > = {};

      initialSections.forEach(
        (section) => {
          section.questions.forEach(
            (question) => {
              state[question.id] =
                createInitialQuestionState(
                  question
                );
            }
          );
        }
      );

      return state;
    });

  const [
    activeSectionIndex,
    setActiveSectionIndex,
  ] = useState(0);

  const [
    activeQuestionIndex,
    setActiveQuestionIndex,
  ] = useState(0);
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
    () => sections[0]?.questions[0]?.id ?? null
  );
  const [navigationDirection, setNavigationDirection] = useState<"forward" | "backward">("forward");

  const [
    showReview,
    setShowReview,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const [hasSavedDraft, setHasSavedDraft] = useState(
    audit.status === "Draft" && audit.completionPercentage > 0
  );
  const [auditorSignature, setAuditorSignature] = useState(audit.auditorSignature);
  const [fullScreen, setFullScreen] = useState(false);
  useAuditNavigationFocus(audit.status !== "Completed");
  const executionRootRef = useRef<HTMLDivElement | null>(null);
  const executionHeaderRef = useRef<HTMLDivElement | null>(null);
  const scrollFocus = useAuditScrollFocus(executionRootRef, executionHeaderRef, !fullScreen && !showReview && !uiError && audit.status !== "Completed", audit.id);

  const [
    showActionDialog,
    setShowActionDialog,
  ] = useState(false);

  const [showCompleteConfirmation, setShowCompleteConfirmation] =
    useState(false);

  const [
    activeActionQuestion,
    setActiveActionQuestion,
  ] =
    useState<FiveSQuestion | null>(
      null
    );

  const [
    actionSaving,
    setActionSaving,
  ] = useState(false);

  const [
    previewEvidence,
    setPreviewEvidence,
  ] = useState<FiveSEvidence | null>(null);

  const previewEvidenceUrl=useActionEvidenceUrl(previewEvidence ? {url:previewEvidence.dataUrl,storageKey:previewEvidence.storageKey} : null);

  const [previewZoom, setPreviewZoom] =
    useState(1);

  const previewRef =
    useRef<HTMLDivElement | null>(null);



  const fileInputRefs =
    useRef<
      Record<
        string,
        HTMLInputElement | null
      >
    >({});

  const questionScrollRef =
    useRef<HTMLDivElement | null>(null);
  const questionListRef =
    useRef<HTMLDivElement | null>(null);

  const questionItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const completionSnapshotRef = useRef<Record<string, boolean> | null>(null);
  const autosaveReadyRef = useRef(false);

  const activeSection =
    sections[activeSectionIndex];

  const allQuestions = useMemo(
    () =>
      sections.flatMap(
        (section) =>
          section.questions
      ),
    [sections]
  );

  const answeredQuestions = allQuestions.filter(isQuestionComplete).length;

  const questionsRequiringActions =
    allQuestions.filter(
      (question) => {
        const state =
          questionStates[
            question.id
          ];

        return (
          state?.complianceResponse === 0 ||
          state?.complianceResponse === 1
        );
      }
    ).length;

  const questionsWithActions =
    allQuestions.filter(
      (question) =>
        questionStates[
          question.id
        ]?.actionId
    ).length;

  const completionPercentage =
    allQuestions.length > 0
      ? Math.round(
          (answeredQuestions /
            allQuestions.length) *
            100
        )
      : 0;

  const auditReadyForCompletion =
    allQuestions.length > 0 && answeredQuestions === allQuestions.length;
  const canonicalActions = useActionStore();
  const auditActions = getLinkedActionsForAudit(audit, canonicalActions);
  const openAuditActions = auditActions.filter(action => action.status !== "Completed");
  const isFinalQuestion = Boolean(
    activeSection &&
    activeSectionIndex === sections.length - 1 &&
    activeQuestionIndex === activeSection.questions.length - 1
  );

  const auditLifecycleIndex =
    audit.status === "Completed"
      ? 3
      : auditReadyForCompletion || showReview
        ? 2
        : audit.status === "In Progress" || answeredQuestions > 0 || hasSavedDraft
          ? 1
          : 0;

  const totalMaxScore = sections.reduce((total, section) => total + calculateSectionMaxScore(section), 0);
  const totalScore = sections.reduce((total, section) => total + calculateSectionScore(section), 0);

  const scorePercentage =
    totalMaxScore > 0
      ? Math.round(
          (totalScore /
            totalMaxScore) *
            100
        )
      : 0;

  useEffect(() => {
    if (!fullScreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const exitOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !showActionDialog && !previewEvidence) setFullScreen(false);
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", exitOnEscape);
    };
  }, [fullScreen, previewEvidence, showActionDialog]);

  /**
   * ---------------------------------------------------------
   * SECTION LOCKING
   * ---------------------------------------------------------
   */

  function isQuestionComplete(
    question: FiveSQuestion
  ) {
    const state =
      questionStates[
        question.id
      ];

    if (!state) {
      return false;
    }

    return isAuditQuestionComplete(question, state, scoringPolicy);
  }

  function isSectionComplete(
    section: FiveSSection
  ) {
    return section.questions.every(
      (question) =>
        isQuestionComplete(
          question
        )
    );
  }

  function isSectionUnlocked(
    index: number
  ) {
    if (index === 0) {
      return true;
    }

    return isSectionComplete(
      sections[index - 1]
    );
  }

  useEffect(() => {
    const snapshot = Object.fromEntries(
      allQuestions.map((question) => {
        const state = questionStates[question.id];
        return [question.id, Boolean(state && isAuditQuestionComplete(question, state, scoringPolicy))];
      })
    );

    if (!completionSnapshotRef.current) {
      completionSnapshotRef.current = snapshot;
      return;
    }

    const activeId = activeSection?.questions[activeQuestionIndex]?.id;
    const activeScore = activeId ? questionStates[activeId]?.score : null;
    const justCompleted = Boolean(
      activeId && snapshot[activeId] && !completionSnapshotRef.current[activeId]
    );
    completionSnapshotRef.current = snapshot;

    if (!justCompleted || !activeSection || activeScore !== 2) return;

    const nextQuestionIndex = activeSection.questions.findIndex(
      (question, index) => index > activeQuestionIndex && !snapshot[question.id]
    );

    let nextSectionIndex = activeSectionIndex;
    let targetQuestionIndex = nextQuestionIndex;

    if (targetQuestionIndex < 0) {
      nextSectionIndex = sections.findIndex(
        (section, index) =>
          index > activeSectionIndex &&
          section.questions.some((question) => !snapshot[question.id])
      );

      if (nextSectionIndex >= 0) {
        targetQuestionIndex = sections[nextSectionIndex].questions.findIndex(
          (question) => !snapshot[question.id]
        );
      }
    }

    if (nextSectionIndex < 0 || targetQuestionIndex < 0) return;

    const targetId = sections[nextSectionIndex].questions[targetQuestionIndex].id;
    const timer = window.setTimeout(() => {
      setNavigationDirection("forward");
      setActiveSectionIndex(nextSectionIndex);
      setActiveQuestionIndex(targetQuestionIndex);
      setExpandedQuestionId(targetId);
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          questionItemRefs.current[targetId]?.scrollIntoView({
            behavior: "smooth",
            block: fullScreen ? "start" : "center",
          });
        });
      });
    }, 210);

    return () => window.clearTimeout(timer);
  }, [activeQuestionIndex, activeSection, activeSectionIndex, allQuestions, fullScreen, questionStates, sections, scoringPolicy]);

  /**
   * ---------------------------------------------------------
   * QUESTION UPDATE
   * ---------------------------------------------------------
   */

  function updateQuestionState(
    questionId: string,
    updates: Partial<QuestionState>
  ) {
    try { const latest = getFiveSAuditById(audit.id); if (!latest) throw new Error("Audit is unavailable."); requireAuditExecution(latest); } catch (e) { setUiError(e instanceof Error ? e.message : "Audit execution denied."); return; }
    if (updates.score !== undefined) updates = { ...updates, complianceResponse: complianceResponseForScore(updates.score, scoringPolicy) };
    setQuestionStates(
      (current) => ({
        ...current,

        [questionId]: {
          ...current[
            questionId
          ],
          ...updates,
        },
      })
    );

    setSections(
      (currentSections) =>
        currentSections.map(
          (section) => ({
            ...section,

            questions:
              section.questions.map(
                (question) => {
                  if (
                    question.id !==
                    questionId
                  ) {
                    return question;
                  }

                  const nextScore =
                    updates.score !==
                    undefined
                      ? updates.score
                      : question.score;

                  return {
                    ...question,

                    score:
                      nextScore,
                    complianceResponse: updates.score !== undefined ? complianceResponseForScore(nextScore, scoringPolicy) : question.complianceResponse,

                    status:
                      updates.status ??
                      getStatusFromScore(
                        nextScore, scoringPolicy
                      ),

                    observation:
                      updates.observation !==
                      undefined
                        ? updates.observation
                        : question.observation,

                    actionRequired:
                      updates.actionRequired ??
                      question.actionRequired,

                    actionId:
                      updates.actionId ??
                      question.actionId,

                    evidence:
                      updates.evidence ??
                      question.evidence ??
                      [],
                    textResponse: updates.textResponse ?? question.textResponse,
                    yesNoResponse: updates.yesNoResponse ?? question.yesNoResponse,
                  };
                }
              ),
          })
        )
    );
  }

  /**
   * ---------------------------------------------------------
   * SCORE
   * ---------------------------------------------------------
   */

  function handleScoreChange(
    question: FiveSQuestion,
    score: number
  ) {
    if (!SCORE_OPTIONS.includes(score)) return;
    const safeScore = score;

    const nextScore =
      questionStates[question.id]?.score === safeScore
        ? null
        : safeScore;

    const requiresAction =
      complianceResponseForScore(nextScore, scoringPolicy) === 0 ||
      complianceResponseForScore(nextScore, scoringPolicy) === 1;

    updateQuestionState(
      question.id,
      {
        score: nextScore,

        status:
          getStatusFromScore(
            nextScore, scoringPolicy
          ),

        actionRequired:
          requiresAction ||
          Boolean(
            questionStates[
              question.id
            ]?.actionId
          ),
      }
    );
  }

  /**
   * ---------------------------------------------------------
   * OBSERVATION
   * ---------------------------------------------------------
   */

  function handleObservationChange(
    questionId: string,
    observation: string
  ) {
    const actionId = questionStates[questionId]?.actionId;

    updateQuestionState(
      questionId,
      {
        observation,
        actionDescription: observation,
      }
    );

    if (actionId && !isScopedAudit(audit)) {
      const existingAction = getActionById(actionId);

      if (existingAction?.status === "Awaiting Assignment") {
        updateAction(actionId, {
          description: observation,
          originalFinding: observation,
        }, currentUser);
      }
    }
  }

  /**
   * ---------------------------------------------------------
   * ACTION DIALOG
   * ---------------------------------------------------------
   */

  function openActionDialog(
    question: FiveSQuestion
  ) {
    if (isScopedAudit(audit) && !isV4Audit(audit)) { setUiError("Linked Action creation and assignment for v3 identities awaits D10 approval. Existing Action and completion requirements remain in force."); return; }
    const currentState = questionStates[question.id];
    const existingAction = currentState?.actionId ? getActionById(currentState.actionId) : undefined;
    if (existingAction) {
      const synchronizedDescription = currentState?.observation ?? existingAction.description;
      updateQuestionState(question.id, {
        actionTitle: existingAction.title,
        actionDescription: synchronizedDescription,
        observation: synchronizedDescription,
        actionCategory: existingAction.actionCategory ?? "",
        priority: existingAction.priority,
        dueDate: existingAction.dueDate,
        evidence: (existingAction.issueEvidence ?? []).map((evidence) => ({ id: evidence.id, name: evidence.name, type: evidence.type, size: 0, dataUrl: evidence.url ?? "", storageKey: evidence.storageKey, uploadedAt: evidence.uploadedAt, uploadedBy: evidence.uploadedBy })),
      });
    }
    setActiveActionQuestion(
      question
    );

    if (isV4Audit(audit)) {
      const linkedId = questionStates[question.id]?.actionId;
      if (linkedId) { router.push(`/actions/${encodeURIComponent(linkedId)}`); return; }
      if (!saveExecutionUpdate(buildCurrentAudit())) return;
    }
    setShowActionDialog(true);
  }

  function renderAuditActionDialog() {
    if (!showActionDialog || !activeActionQuestion) return null;
    const state = questionStates[activeActionQuestion.id];
    if (!state) return null;
    if (state.actionId) return null;
    if (isV4Audit(audit)) return <AuditCorrectiveActionDialog audit={getFiveSAuditById(audit.id) ?? audit} questionId={activeActionQuestion.id} onClose={() => setShowActionDialog(false)} onCreated={action => { updateQuestionState(activeActionQuestion.id, { actionRequired: true, actionId: action.id, responsiblePersonId: action.responsiblePersonId ?? "", assignedTo: action.assignedTo }); setShowActionDialog(false); }}/ >;
    const section = sections.find(item=>item.questions.some(question=>question.id===activeActionQuestion.id));
    const context: LinkedActionContext = {
      source:"Audit",sourceModule: "audit",sourceId: audit.id,sourceTitle: audit.title,sourceObservationId: activeActionQuestion.id,
      sourceObservation:state.observation.trim() || activeActionQuestion.question,
      title:state.actionTitle.trim() || state.observation.trim() || `Corrective action required for ${section?.category ?? "Audit"}`,
      description:state.actionDescription.trim() || state.observation.trim() || activeActionQuestion.question,
      plant:audit.plant,zone:audit.area,location:audit.department,
      defaultResponsibleId:getFiveSZoneConfiguration(audit.area)?.leaderId,defaultPriority:state.priority,defaultDueDate:state.dueDate,
      requiresEvidence:(state.complianceResponse===0 || state.complianceResponse===1) && (activeActionQuestion.questionSource!=="custom" || Boolean(activeActionQuestion.requireEvidenceOnNonCompliance)),
      evidence:state.evidence.map(item=>({id:item.id,name:item.name,type:item.type,evidenceType:"finding",url:item.dataUrl || undefined,storageKey:item.storageKey,uploadedAt:item.uploadedAt,uploadedBy:item.uploadedBy})),
      auditQuestion:{auditId:audit.id,questionId:activeActionQuestion.id,questionText:activeActionQuestion.question,questionSource:activeActionQuestion.questionSource ?? "standard",customQuestionId:activeActionQuestion.customQuestionId,sectionId:section?.category,category:section?.category},
    };
    return <CreateLinkedActionDialog key={`audit-${activeActionQuestion.id}`} open={showActionDialog} onOpenChange={setShowActionDialog} context={context} onCreated={(action: MyAction)=>{
      if (!linkAuditQuestionAction(audit.id,activeActionQuestion.id,action.id,currentUser)) return false;
      updateQuestionState(activeActionQuestion.id,{actionRequired:true,actionId:action.id,actionTitle:action.title,actionDescription:action.description,actionCategory:action.actionCategory ?? "",priority:action.priority,dueDate:action.dueDate,responsiblePersonId:action.responsiblePersonId ?? "",assignedTo:action.assignedTo,evidence:(action.issueEvidence ?? []).map(item=>({id:item.id,name:item.name,type:item.type,size:0,dataUrl:item.url ?? "",storageKey:item.storageKey,uploadedAt:item.uploadedAt,uploadedBy:item.uploadedBy}))});
      return true;
    }} />;
  }

  function closeActionDialog() {
    if (actionSaving) {
      return;
    }

    setShowActionDialog(false);
    setActiveActionQuestion(
      null
    );
  }

  async function handleCreateAction() {
    try {
    if (
      !activeActionQuestion
    ) {
      return;
    }

    const question =
      activeActionQuestion;

    const state =
      questionStates[
        question.id
      ];

    if (!state) {
      return;
    }

    const today = toLocalInputDate(new Date());

    if (
      !state.actionTitle.trim() ||
      !state.actionCategory ||
      !state.dueDate ||
      state.dueDate < today ||
      ((state.complianceResponse === 0 || state.complianceResponse === 1) &&
        (question.questionSource !== "custom" || question.requireEvidenceOnNonCompliance) &&
        state.evidence.length === 0)
    ) {
      return;
    }

    const section =
      sections.find((item) =>
        item.questions.some(
          (itemQuestion) =>
            itemQuestion.id ===
            question.id
        )
      );

    if (!section) {
      return;
    }

    setActionSaving(true);

    const title =
      state.actionTitle.trim() ||
      state.observation.trim() ||
      `Corrective action required for ${section.category}`;

    const description =
      state.actionDescription.trim() ||
      state.observation.trim() ||
      question.question;

    if (state.actionId) {
      const existingAction = getActionById(state.actionId);
      if (existingAction?.status !== "Awaiting Assignment") {
        setActionSaving(false);
        closeActionDialog();
        return;
      }
      const prioritySaved = changeActionPriority(state.actionId, currentUser, state.priority);
      const saved = prioritySaved && updateAction(state.actionId, {
        title,
        description,
        actionCategory: state.actionCategory,
        originalFinding: state.observation,
        issueEvidence: state.evidence.map((evidence) => ({ id: evidence.id, actionId: state.actionId, evidenceType: "finding" as const, name: evidence.name, type: evidence.type, uploadedAt: evidence.uploadedAt, uploadedBy: evidence.uploadedBy, url: evidence.dataUrl || undefined, storageKey: evidence.storageKey })),
      }, currentUser);
      if (!saved) { setActionSaving(false); setUiError("Action setup could not be saved. Check your permissions and browser storage, then retry."); return; }
      window.setTimeout(() => { setUiError(""); setActionSaving(false); setShowActionDialog(false); setActiveActionQuestion(null); }, 220);
      return;
    }

    setActionSaving(false);

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save this record. Please retry.";
      setUiError(message); setActionSaving(false);
    }
  }

  /**
   * ---------------------------------------------------------
   * EVIDENCE
   * ---------------------------------------------------------
   */

  async function createEvidenceFromFile(
    questionId: string,
    file: File
  ) {
    const current = questionStates[questionId]?.evidence ?? [];
    if (current.length >= MAX_EVIDENCE_IMAGES) { setUiError("Maximum 5 evidence images allowed."); return; }
    try {
      const { dataUrl, size } = await readEvidenceFile(file);

      const evidence:
        FiveSEvidence = await persistFiveSAuditEvidence(audit.id, {
        id: createAuditEvidenceId(),

        name: file.name,

        type:
          file.type.startsWith(
            "image/"
          )
            ? "image"
            : "document",

        size,

        dataUrl,

        uploadedAt:
          new Date()
            .toISOString(),

        uploadedBy:
          currentUser.name,
      }, versionedExpected());
      if (!isScopedAudit(audit)) await compactAuditEvidenceStorage();

      const nextEvidence = [
        ...current,
        evidence,
      ];

      updateQuestionState(
        questionId,
        {
          evidence: nextEvidence,
        }
      );

      const actionId =
        questionStates[
          questionId
        ]?.actionId;

      if (actionId) {
        updateAction(
          actionId,
          {
            issueEvidence:
              nextEvidence.map(
                (item) => ({
                  id: item.id,
                  actionId,
                  evidenceType: "finding" as const,
                  name: item.name,
                  type: item.type,
                  uploadedAt:
                    item.uploadedAt,
                  uploadedBy:
                    item.uploadedBy,
                  url: item.dataUrl || undefined,
                  storageKey: item.storageKey,
                })
              ),
          },
          currentUser
        );
      }
    } catch (error) { setUiError(error instanceof Error ? error.message : "Unable to process this image."); }
  }

  function handleEvidenceUpload(
    questionId: string,
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    void createEvidenceFromFile(
      questionId,
      file
    );

    event.target.value = "";
  }

  function removeEvidence(
    questionId: string,
    evidenceId: string
  ) {
    const current =
      questionStates[
        questionId
      ]?.evidence ?? [];

    const nextEvidence =
      current.filter(
        (item) =>
          item.id !==
          evidenceId
      );

    updateQuestionState(
      questionId,
      {
        evidence:
          nextEvidence,
      }
    );

    const actionId =
      questionStates[
        questionId
      ]?.actionId;

    if (actionId) {
      updateAction(
        actionId,
        {
          issueEvidence:
            nextEvidence.map(
              (item) => ({
                id: item.id,
                actionId,
                evidenceType: "finding" as const,
                name: item.name,
                type: item.type,
                uploadedAt:
                  item.uploadedAt,
                uploadedBy:
                  item.uploadedBy,
                url: item.dataUrl || undefined,
                  storageKey: item.storageKey,
              })
            ),
        },
        currentUser
      );
    }
  }

  /**
   * ---------------------------------------------------------
   * SECTION SCORE
   * ---------------------------------------------------------
   */

  function currentSectionTotals(section: FiveSSection) {
    return calculateAuditSectionTotals([{ ...section, questions: section.questions.map(question => {
      const state = questionStates[question.id];
      return state ? { ...question, score: state.score, status: state.status } : question;
    }) }]);
  }

  function calculateSectionScore(section: FiveSSection) { return currentSectionTotals(section).score; }
  function calculateSectionMaxScore(section: FiveSSection) { return currentSectionTotals(section).maxScore; }

  /**
   * ---------------------------------------------------------
   * NEXT / PREVIOUS
   * ---------------------------------------------------------
   */

  function resetQuestionScroll() {
    window.requestAnimationFrame(() => {
      questionScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
      questionListRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function scrollQuestionToStart(questionId: string) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const element = questionItemRefs.current[questionId];
        if (!element) return;
        const list = questionListRef.current;
        const outer = questionScrollRef.current;
        const container = list && list.scrollHeight > list.clientHeight ? list : outer;
        if (!container) return;
        const top = container.scrollTop + element.getBoundingClientRect().top - container.getBoundingClientRect().top;
        container.scrollTo({ top, behavior: "smooth" });
      });
    });
  }

  function revealQuestionOnMobile(questionId: string) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (!window.matchMedia("(max-width: 1023px), (pointer: coarse)").matches) return;
        const element = questionItemRefs.current[questionId];
        if (!element) return;
        const bounds = element.getBoundingClientRect();
        if (bounds.top < 72 || bounds.bottom > window.innerHeight - 16) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    });
  }

  function expandQuestion(questionId: string, questionIndex: number) {
    setNavigationDirection(questionIndex >= activeQuestionIndex ? "forward" : "backward");
    setActiveQuestionIndex(questionIndex);
    setExpandedQuestionId(questionId);
    revealQuestionOnMobile(questionId);
  }

  function navigateToSection(sectionIndex: number) {
    setNavigationDirection(sectionIndex >= activeSectionIndex ? "forward" : "backward");
    setActiveSectionIndex(sectionIndex);
    const firstQuestion = sections[sectionIndex]?.questions[0];
    setActiveQuestionIndex(0);
    setExpandedQuestionId(firstQuestion?.id ?? null);
    resetQuestionScroll();
  }

  function navigateQuestion(direction: -1 | 1) {
    if (!activeSection) return;
    if (direction === 1 && !isQuestionComplete(activeSection.questions[activeQuestionIndex])) return;

    let sectionIndex = activeSectionIndex;
    let questionIndex = activeQuestionIndex + direction;
    if (questionIndex < 0 && sectionIndex > 0) {
      sectionIndex -= 1;
      questionIndex = sections[sectionIndex].questions.length - 1;
    } else if (questionIndex >= activeSection.questions.length && sectionIndex < sections.length - 1) {
      sectionIndex += 1;
      questionIndex = 0;
    }
    if (sectionIndex === activeSectionIndex && questionIndex === activeQuestionIndex) return;
    setNavigationDirection(direction === 1 ? "forward" : "backward");
    setActiveSectionIndex(sectionIndex);
    setActiveQuestionIndex(questionIndex);
    const targetQuestionId = sections[sectionIndex]?.questions[questionIndex]?.id ?? null;
    setExpandedQuestionId(targetQuestionId);
    if (fullScreen && targetQuestionId) scrollQuestionToStart(targetQuestionId);
    else resetQuestionScroll();
  }

  /**
   * ---------------------------------------------------------
   * SAVE
   * ---------------------------------------------------------
   */

  function saveExecutionUpdate(updates: Partial<FiveSAudit>) {
    try { return updateFiveSAudit(audit.id, updates, currentUser, versionedExpected()); }
    catch (e) { setUiError(e instanceof Error ? e.message : "Audit could not be saved."); return undefined; }
  }
  function handleSaveDraft() {
    setSaving(true);
    setDraftSaved(false);

    window.setTimeout(() => {
      const status = audit.status === "In Progress" ? "In Progress" : "Draft";
      const saved = saveExecutionUpdate(buildCurrentAudit({ status }));
      setSaving(false);
      if (!saved) return;
      setDraftSaved(true);
      setHasSavedDraft(true);
      window.setTimeout(() => setDraftSaved(false), 1400);
    }, 600);
  }

  /**
   * ---------------------------------------------------------
   * COMPLETE AUDIT
   * ---------------------------------------------------------
   */

  function buildCurrentAudit(
    updates: Partial<FiveSAudit> = {}
  ): FiveSAudit {
    return {
      ...audit,
      score:
        totalScore,
      maxScore:
        totalMaxScore,
      completionPercentage:
        completionPercentage,
      sections:
        sections.map(
          (section) => ({
            ...section,

            score:
              calculateSectionScore(
                section
              ),

            maxScore:
              calculateSectionMaxScore(
                section
              ),

            questions:
              section.questions.map(
                (question) => {
                  const state =
                    questionStates[
                      question.id
                    ];

                  return {
                    ...question,

                    status:
                      state?.status ??
                      question.status,

                    score:
                      state
                        ? state.score
                        : question.score,
                    complianceResponse: state ? state.complianceResponse : question.complianceResponse,

                    observation:
                      state?.observation ??
                      question.observation,

                    actionRequired:
                      state?.actionRequired ??
                      question.actionRequired,

                    actionId:
                      state?.actionId ??
                      question.actionId,

                    evidence:
                      state?.evidence ??
                      question.evidence ??
                      [],
                    textResponse: state?.textResponse ?? question.textResponse,
                    yesNoResponse: state?.yesNoResponse ?? question.yesNoResponse,
                  };
                }
              ),
          })
        ),
      ...updates,
    };
  }

  useEffect(() => {
    if (!autosaveReadyRef.current) {
      autosaveReadyRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      const status = audit.status === "In Progress" ? "In Progress" : "Draft";
      const saved = saveExecutionUpdate(buildCurrentAudit({ status }));
      if (saved && answeredQuestions > 0) setHasSavedDraft(true);
    }, 450);

    return () => window.clearTimeout(timer);
    // The answer-state transition is the autosave trigger; the remaining values
    // are the matching render snapshot intentionally persisted with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionStates]);

  function handleGenerateReport() {
    if (!auditReadyForCompletion && audit.status !== "Completed") return;

    if (audit.status !== "Completed") {
      const reportAudit = buildCurrentAudit();
      if (!saveExecutionUpdate(reportAudit)) return;
    }
    router.push(`/5s/audits/${encodeURIComponent(audit.id)}/report?from=audit`);
  }

  function handleCompleteAudit() {
    if (!auditReadyForCompletion || !auditorSignature || !canCompleteFiveSAudit(audit, currentUser)) return;
    const snapshot = buildCurrentAudit();
    const completedAudit = isV4Audit(audit) ? completeFiveSAudit(audit.id, snapshot.sections, currentUser, versionedExpected()) : completeFiveSAudit(audit.id, snapshot.sections, currentUser);
    if (!completedAudit) { setUiError("The Audit could not be completed. Check required answers, evidence, signature and your completion access."); return; }
    onComplete?.(completedAudit);
    setShowCompleteConfirmation(false);
    router.push("/5s/audits");
  }

  function requestAuditCompletion() {
    if (!auditReadyForCompletion || !canCompleteFiveSAudit(audit, currentUser)) return;
    setShowCompleteConfirmation(true);
  }

  function handleSignatureConfirm(signatureImage: string) {
    const signature = { userId: currentUser.id, userName: currentUser.name, signedAt: new Date().toISOString(), signatureImage };
    if (saveExecutionUpdate(buildCurrentAudit({ auditorSignature: signature }))) setAuditorSignature(signature);
  }

  function handleSignatureClear() {
    if (saveExecutionUpdate(buildCurrentAudit({ auditorSignature: undefined }))) setAuditorSignature(undefined);
  }

  /**
   * ---------------------------------------------------------
   * REVIEW
   * ---------------------------------------------------------
   */

  if (showReview) {
    return (
      <div className="flex min-w-0 flex-col md:min-h-[calc(100dvh-7rem)]">
        {isScopedAudit(audit) && !isV4Audit(audit) && <p role="status" className="border-b px-4 py-3 text-sm text-muted-foreground">Linked Action creation for v3 identities awaits D10 approval. Non-compliant findings still require a linked Action before completion.</p>}
      {uiError && <OpsFeedback tone="error" message={uiError} />}
        <div className="sticky top-14 z-30 min-w-0 border-b bg-background/95 px-0 py-3 backdrop-blur md:top-0 md:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() =>
                  setShowReview(
                    false
                  )
                }
              >
                <ArrowLeft className="size-4" />
              </Button>

              <div className="min-w-0">
                <h1 className="text-xl font-semibold">
                  Review 5S Audit
                </h1>

                <p className="mt-1 text-xs text-muted-foreground">
                  Review all questions
                  before completing
                  the audit.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="print:hidden"
                onClick={handleGenerateReport}
              >
                <FileBarChart className="mr-2 size-4" />
                {t("audit.generateReport")}
              </Button>

              <Button
                type="button"
                className="print:hidden"
                onClick={requestAuditCompletion}
              >
                <CheckCircle2 className="mr-2 size-4" />
                {t("audit.complete")}
              </Button>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 px-0 py-5 md:overflow-y-auto md:px-6 lg:px-8">
          <div className="w-full max-w-none space-y-5">
            <CanonicalLinkedRecords currentRecord={{module:"audit",recordId:audit.id}} />
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Completion
                  </p>

                  <p className="mt-1 text-xl font-semibold">
                    {completionPercentage}%
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {answeredQuestions}{" "}
                    of{" "}
                    {allQuestions.length}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Score
                  </p>

                  <p className="mt-1 text-xl font-semibold">
                    {scorePercentage}%
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {totalScore} /{" "}
                    {totalMaxScore}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Corrective Actions
                  </p>

                  <p className="mt-1 text-xl font-semibold">
                    {
                      questionsWithActions
                    }
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    {
                      questionsRequiringActions
                    }{" "}
                    required
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">
                    Stage
                  </p>

                  <p className="mt-1 text-xl font-semibold">
                    Review
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    Ready for completion
                  </p>
                </CardContent>
              </Card>
            </div>

            {sections.map(
              (section) => (
                <Card
                  key={
                    section.category
                  }
                >
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {
                            section.category
                          }
                        </CardTitle>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {
                            auditSectionDescription(language, section.category, section.description)
                          }
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">
                          {calculateSectionScore(
                            section
                          )}{" "}
                          /{" "}
                          {calculateSectionMaxScore(
                            section
                          )}
                        </Badge>

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="print:hidden"
                          disabled={
                            !isSectionUnlocked(
                              sections.findIndex(
                                (item) =>
                                  item.category ===
                                  section.category
                              )
                            )
                          }
                          onClick={() => {
                            const sectionIndex =
                              sections.findIndex(
                                (item) =>
                                  item.category ===
                                  section.category
                              );

                            if (
                              sectionIndex >= 0 &&
                              isSectionUnlocked(
                                sectionIndex
                              )
                            ) {
                              navigateToSection(sectionIndex);

                              setShowReview(
                                false
                              );
                            }
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <div className="space-y-2">
                      {section.questions.map(
                        (
                          question,
                          reviewQuestionIndex
                        ) => {
                          const state =
                            questionStates[
                              question.id
                            ];

                          return (
                            <div
                              key={
                                question.id
                              }
                              className="rounded-lg border p-3"
                            >
                              <div className="flex min-w-0 flex-col items-start gap-3 sm:flex-row sm:justify-between">
                                <p className="min-w-0 flex-1 break-words text-sm font-medium">
                                  {
                                    auditQuestionText(language, section.category, reviewQuestionIndex, question.question)
                                  }
                                </p>

                                <div className="flex max-w-full flex-wrap items-center gap-2 sm:shrink-0">
                                  {state?.score !==
                                    null &&
                                    state?.score !==
                                      undefined && (
                                      <Badge
                                        className={
                                          SCORE_STYLES[
                                            state.complianceResponse ?? -1
                                          ]
                                        }
                                      >
                                        {
                                          state.score
                                        }{" "}
                                        ·{" "}
                                        {
                                          SCORE_LABELS[
                                            state.complianceResponse ?? -1
                                          ]
                                        }
                                      </Badge>
                                    )}

                                  {state?.actionId && (
                                    <Badge variant="success">
                                      Action
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              {state?.observation && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  {
                                    state.observation
                                  }
                                </p>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </div>

        {showActionDialog && activeActionQuestion && questionStates[activeActionQuestion.id]?.actionId ? (<ActionDialog
            error={uiError}
              question={
                activeActionQuestion
              }
              zone={audit.area}
              state={
                questionStates[
                  activeActionQuestion.id
                ]
              }
              onClose={
                closeActionDialog
              }
              onCreate={
                handleCreateAction
              }
              onUpdate={(updates) =>
                updateQuestionState(
                  activeActionQuestion.id,
                  updates
                )
              }
              onEvidenceUpload={(event) => handleEvidenceUpload(activeActionQuestion.id, event)}
              onEvidenceFile={(file) => createEvidenceFromFile(activeActionQuestion.id, file)}
              onEvidenceRemove={(evidenceId) => removeEvidence(activeActionQuestion.id, evidenceId)}
              onEvidencePreview={(evidence) => { setPreviewZoom(1); setPreviewEvidence(evidence); }}
              saving={actionSaving}
            />) : renderAuditActionDialog()}
        <CompleteAuditDialog
        error={uiError}
          open={showCompleteConfirmation}
          questionCount={allQuestions.length}
          outstandingActionCount={openAuditActions.length}
          auditor={isScopedAudit(audit) ? currentUser.name : audit.auditor}
          signature={auditorSignature}
          onOpenChange={setShowCompleteConfirmation}
          onSignatureConfirm={handleSignatureConfirm}
          onSignatureClear={handleSignatureClear}
          onConfirm={handleCompleteAudit}
        />
      </div>
    );
  }

  /**
   * ---------------------------------------------------------
   * MAIN AUDIT VIEW
   * ---------------------------------------------------------
   */

  return (
    <div ref={executionRootRef} style={{ overflowAnchor: "none" }} data-audit-execution className={fullScreen ? "fixed inset-0 z-[60] flex h-[100dvh] w-screen min-w-0 flex-col overflow-hidden bg-background motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-[0.99] motion-safe:duration-200" : "flex w-full min-w-0 max-w-full flex-col md:h-[calc(100dvh-7rem)] md:min-h-0"}>
      {uiError && <OpsFeedback tone="error" message={uiError} />}
      {/* FIXED HEADER */}

      {!fullScreen && <div ref={executionHeaderRef} data-audit-controls data-collapsed={scrollFocus} aria-hidden={scrollFocus} inert={scrollFocus} className="grid w-full min-w-0 max-w-full shrink-0 transition-[grid-template-rows] duration-[180ms] ease-out motion-reduce:transition-none" style={{ gridTemplateRows: scrollFocus ? "0fr" : "1fr" }}>
        <div className="min-h-0 overflow-hidden"><div className="border-b bg-background px-0 pt-1 md:px-2 lg:px-3">
        <FiveSPageHeader
          eyebrow=""
          title={`5S Audit · ${audit.title}`}
          description={`${audit.plant} · ${audit.area} · ${audit.department} · Auditor: ${audit.auditor}`}
          className="border-b-0 pb-2 [&_h1]:text-lg md:[&_h1]:text-xl"
          leading={onBack ? (
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Exit audit" className="md:-ml-2">
              <ArrowLeft className="size-4" />
            </Button>
          ) : undefined}
          actions={
            audit.status === "Completed" ? (
              <Button type="button" variant="outline" onClick={handleGenerateReport}>
                <FileBarChart className="mr-2 size-4" />
                View Report
              </Button>
            ) : auditReadyForCompletion ? (
              <>
                <Button type="button" variant="outline" onClick={handleGenerateReport}>
                  <FileBarChart className="mr-2 size-4" />
                  {t("audit.generateReport")}
                </Button>
                <Button type="button" onClick={requestAuditCompletion}>
                  <CheckCircle2 className="mr-2 size-4" />
                  {t("audit.complete")}
                </Button>
              </>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={handleSaveDraft} disabled={saving}>
                  <Save className="mr-2 size-4" />
                  {saving ? "Saving..." : draftSaved ? `✓ ${t("common.save")}` : t("audit.saveDraft")}
                </Button>
                <Button type="button" onClick={() => setShowReview(true)}>
                  {t("audit.review")}
                </Button>
              </>
            )
          }
          toolbar={
            <div className="flex w-full min-w-0 items-center overflow-x-auto pb-0.5">
              <AuditLifecycleTimeline currentIndex={auditLifecycleIndex} />
            </div>
          }
        />

        </div></div>
      </div>}

      {/* AUDIT SECTION RAIL + QUESTION WORKSPACE */}

      <div
        ref={questionScrollRef}
        data-audit-question-scroll
        className={`w-full min-w-0 max-w-full flex-1 touch-pan-y px-0 [-webkit-overflow-scrolling:touch] md:min-h-0 md:px-2 lg:px-3 ${fullScreen ? "min-h-0 overflow-y-auto overscroll-contain py-2 md:py-3" : "overflow-visible py-2 md:overflow-y-auto lg:overflow-hidden"}`}
      >
        <div className={`grid w-full min-w-0 max-w-none gap-3 lg:h-full lg:min-h-0 ${fullScreen ? "" : "lg:grid-cols-[180px_minmax(0,1fr)] xl:grid-cols-[200px_minmax(0,1fr)]"}`}>
          <aside className={fullScreen ? "hidden" : "hidden min-w-0 lg:block lg:h-full lg:min-h-0"}>
            <div className="flex h-full min-w-0 flex-col rounded-xl border border-border/75 bg-card p-3 shadow-sm">
              <div className="border-b border-border/60 px-2 pb-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">5S Audit</p>
                <p className="mt-1 truncate text-sm font-semibold" title={audit.title}>{audit.title}</p>
                <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{audit.plant}<br />{audit.area} · {audit.department}<br />Auditor: {audit.auditor}</p>
              </div>

              <nav className="mt-2 flex-1 space-y-1" aria-label="5S audit sections">
                {sections.map((section, index) => {
                  const completed = section.questions.filter(isQuestionComplete).length;
                  const active = index === activeSectionIndex;
                  const complete = completed === section.questions.length;
                  const unlocked = isSectionUnlocked(index);
                  return (
                    <button
                      key={section.category}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => unlocked && navigateToSection(index)}
                      className={`relative flex w-full min-w-0 items-center gap-2 rounded-md py-2.5 pl-3 pr-2 text-left text-xs transition-colors ${active ? "bg-primary/[0.07] font-semibold text-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary" : unlocked ? "text-muted-foreground hover:bg-muted/50 hover:text-foreground" : "cursor-not-allowed text-muted-foreground opacity-45"}`}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px]">
                        {complete ? <Check className="size-3 text-emerald-600" /> : index + 1}
                      </span>
                      <span className="min-w-0 flex-1 break-words">{auditSectionName(language, section.category)}</span>
                      <span className={active ? "text-primary" : "text-muted-foreground"}>{completed}/{section.questions.length}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-3 border-t border-border/60 px-2 pt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Overall progress</p>
                <div className="mt-2 flex items-end justify-between gap-2"><p className="text-xs font-medium">{answeredQuestions} of {allQuestions.length} completed</p><p className="text-sm font-semibold text-primary">{completionPercentage}%</p></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${completionPercentage}%` }} /></div>
              </div>
            </div>
          </aside>

          <div className={fullScreen ? "hidden" : "min-w-0 lg:hidden"}>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground" htmlFor="audit-section-selector">5S section</label>
            <Select searchLabel={"Checklist section"} value={String(activeSectionIndex)} onValueChange={(value) => navigateToSection(Number(value))}>
              <SelectTrigger id="audit-section-selector" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sections.map((section, index) => {
                  const completed = section.questions.filter(isQuestionComplete).length;
                  return <SelectItem key={section.category} value={String(index)} disabled={!isSectionUnlocked(index)}>{auditSectionName(language, section.category)} · {completed}/{section.questions.length}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground"><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${completionPercentage}%` }} /></div><span>{answeredQuestions}/{allQuestions.length} · {completionPercentage}%</span></div>
          </div>

          <section aria-label="Audit question workspace" className="min-w-0 lg:h-full lg:min-h-0">
          {activeSection && (
            <Card className="gap-0 overflow-hidden lg:h-full lg:min-h-0">
              {/* REDUCED SECTION HEADER */}

              <CardHeader data-audit-section-header className={`shrink-0 border-b border-border/55 transition-[padding] duration-[180ms] motion-reduce:transition-none ${scrollFocus ? "py-2" : "py-3"}`}>
                <div className={`flex min-w-0 flex-col md:flex-row md:items-center md:justify-between transition-[gap] duration-[180ms] motion-reduce:transition-none ${scrollFocus ? "gap-2" : "gap-3"}`}>
                  <div className="flex min-w-0 items-center gap-2">
                    <div className={`flex shrink-0 items-center justify-center rounded-lg border border-primary/35 bg-primary/[0.035] text-xs font-semibold text-primary transition-[width,height] duration-[180ms] motion-reduce:transition-none ${scrollFocus ? "size-8" : "size-10"}`}>
                      {String(activeSectionIndex + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0">
                      <CardTitle className="text-base">
                        {
                          auditSectionName(language, activeSection.category)
                        }
                      </CardTitle>

                      <div className="grid transition-[grid-template-rows] duration-[180ms] motion-reduce:transition-none" style={{ gridTemplateRows: scrollFocus ? "0fr" : "1fr" }}><div className="min-h-0 overflow-hidden"><p className="whitespace-normal break-words text-[11px] leading-4 text-muted-foreground">
                        {
                          auditSectionDescription(language, activeSection.category, activeSection.description)
                        }
                      </p></div></div>
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-left md:text-right">
                    <Button type="button" size="sm" variant="outline" onClick={() => setFullScreen((value) => !value)} aria-label={fullScreen ? "Exit full screen" : "Enter full screen"}>
                      {fullScreen ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
                      {fullScreen ? "Exit" : "Full Screen"}
                    </Button>
                    <div>
                    <p className="text-xs font-semibold">{activeSection.questions.filter(isQuestionComplete).length} / {activeSection.questions.length} {t("common.completed")}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {Math.round((activeSection.questions.filter(isQuestionComplete).length / activeSection.questions.length) * 100)}% {t("audit.sectionProgress")}
                    </p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${(activeSection.questions.filter(isQuestionComplete).length / activeSection.questions.length) * 100}%` }} />
                </div>
              </CardHeader>

              <CardContent ref={questionListRef} data-audit-question-list data-audit-question-scroll className="min-w-0 p-3 md:p-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:p-4">
                <div className="space-y-3">
                  {activeSection.questions.map(
                    (
                      question,
                      questionIndex
                    ) => {
                      const state =
                        questionStates[
                          question.id
                        ];

                      if (!state) {
                        return null;
                      }

                      const requiresAction =
                        state.complianceResponse ===
                          0 ||
                        state.complianceResponse ===
                          1;
                      const responseType = question.responseType ?? "Compliance";
                      const requiresEvidence = requiresAction && (question.questionSource !== "custom" || Boolean(question.requireEvidenceOnNonCompliance));

                      const questionUnlocked = true;
                      const expanded = question.id === expandedQuestionId;
                      const complete = isQuestionComplete(question);
                      const createdAction = state.actionId
                        ? getActionById(state.actionId)
                        : undefined;

                      if (!expanded) {
                        return (
                          <div
                            key={question.id}
                            ref={(element) => { questionItemRefs.current[question.id] = element; }}
                            className="relative min-w-0 scroll-mt-20 pl-8 before:absolute before:bottom-[-0.75rem] before:left-[11px] before:top-8 before:w-px before:bg-border last:before:hidden"
                          >
                            <span className={`absolute left-0 top-3.5 z-10 flex size-6 items-center justify-center rounded-full border bg-background ${state.complianceResponse === 2 ? "border-emerald-500 text-emerald-600" : state.complianceResponse === 1 ? "border-amber-500 text-amber-600" : state.complianceResponse === 0 ? "border-red-500 text-red-600" : "border-border text-muted-foreground"}`}>
                              {complete ? <Check className="size-3.5" /> : state.complianceResponse === 0 ? <AlertCircle className="size-3.5" /> : <span className="size-1.5 rounded-full bg-current" />}
                            </span>
                            <div className="flex min-w-0 items-start gap-1">
                            <button
                              type="button"
                              aria-expanded="false"
                              aria-controls={`audit-question-panel-${question.id}`}
                              onClick={() => expandQuestion(question.id, questionIndex)}
                              className="flex min-h-12 min-w-0 flex-1 touch-manipulation items-start gap-3 rounded-lg border border-border/70 bg-background px-3 py-3 text-left transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="pt-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">{String(questionIndex + 1).padStart(2, "0")}</span>
                              <span className="min-w-0 flex-1">
                                <span className="flex flex-wrap items-center gap-2 whitespace-normal break-words text-sm font-medium leading-5 [overflow-wrap:anywhere]">{auditQuestionText(language, activeSection.category, questionIndex, question.question)}{question.questionSource === "custom" && <Badge variant="outline" className="text-[10px]">Custom</Badge>}</span>
                                <span className="mt-1 block text-[11px] text-muted-foreground">
                                  {state.observation.trim() ? t("audit.observationAdded") : t("audit.noObservation")}
                                  {state.actionId ? ` · ${t("audit.oneAction")}` : ""}
                                  {state.evidence.length ? ` · ${state.evidence.length} ${t("audit.evidence")}` : ""}
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-2">
                                {responseType === "Compliance" && state.score !== null ? <Badge className={SCORE_STYLES[state.complianceResponse ?? -1]}><span className="sm:hidden" aria-hidden="true">{state.score}</span><span className="hidden sm:inline">{state.score} · {state.complianceResponse === 0 ? t("score.zero") : state.complianceResponse === 1 ? t("score.one") : t("score.two")}</span><span className="sr-only sm:hidden">{state.complianceResponse === 0 ? t("score.zero") : state.complianceResponse === 1 ? t("score.one") : t("score.two")}</span></Badge> : responseType === "Yes / No" && state.yesNoResponse ? <Badge variant="outline">{state.yesNoResponse}</Badge> : responseType === "Text" && state.textResponse.trim() ? <Badge variant="outline">Answered</Badge> : <span className="hidden text-[11px] text-muted-foreground sm:inline">{question.mandatory === false ? "Optional" : t("audit.notAnswered")}</span>}
                                <ChevronDown className="size-4 text-muted-foreground" />
                              </span>
                            </button>
                            <FiveSReferenceGuide question={question} questionText={auditQuestionText(language, activeSection.category, questionIndex, question.question)} />
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={
                            question.id
                          }
                          ref={(element) => { questionItemRefs.current[question.id] = element; }}
                          className={`relative min-w-0 scroll-mt-24 pl-8 before:absolute before:bottom-[-0.75rem] before:left-[11px] before:top-8 before:w-px before:bg-border last:before:hidden ${navigationDirection === "forward" ? "motion-question-forward" : "motion-question-backward"}`}
                        >
                          {/* QUESTION */}

                          <span className="absolute left-0 top-3.5 z-10 flex size-6 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground shadow-sm">
                            <span className="size-1.5 rounded-full bg-current" />
                          </span>

                          <div className="min-w-0 rounded-lg border border-primary/35 bg-primary/[0.018] p-3 shadow-sm">
                          <div className="flex min-w-0 items-start gap-1">
                          <button
                            type="button"
                            aria-expanded="true"
                            aria-controls={`audit-question-panel-${question.id}`}
                            onClick={() => setExpandedQuestionId(null)}
                            className="flex min-h-11 w-full min-w-0 max-w-full touch-manipulation gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {questionIndex + 1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0 max-w-full">
                                  <div className="flex flex-wrap items-center gap-2"><p className="max-w-5xl whitespace-normal break-words text-lg font-semibold leading-[1.35] tracking-[-0.01em] [overflow-wrap:anywhere] md:leading-7">
                                    {
                                      auditQuestionText(language, activeSection.category, questionIndex, question.question)
                                    }
                                  </p>{question.questionSource === "custom" && <Badge variant="outline" className="text-[10px]">Custom</Badge>}</div>

                                  {question.description && (
                                    <p className="mt-1 max-w-full whitespace-normal break-words text-xs leading-5 text-muted-foreground [overflow-wrap:anywhere]">
                                      {question.questionSource === "custom" || question.description !== "Assess the workplace against the defined 5S requirement." ? question.description : t("audit.assessRequirement")}
                                    </p>
                                  )}
                                </div>

                                {state.score !==
                                  null && (
                                  <Badge
                                    className={
                                      SCORE_STYLES[
                                        state.complianceResponse ?? -1
                                      ]
                                    }
                                  >
                                    {
                                      state.score
                                    }{" "}
                                    ·{" "}
                                    {
                                      state.complianceResponse === 0 ? t("score.zero") : state.complianceResponse === 1 ? t("score.one") : t("score.two")
                                    }
                                  </Badge>
                                )}
                                <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                              </div>
                            </div>
                          </button>
                          <FiveSReferenceGuide question={question} questionText={auditQuestionText(language, activeSection.category, questionIndex, question.question)} />
                          </div>

                            <div id={`audit-question-panel-${question.id}`} className="mt-4 min-w-0 md:pl-11">

                              {/* SCORE */}

                              {responseType === "Compliance" ? <div className="mt-4">
                                <p className="mb-2 text-xs font-medium">
                                  {t("audit.score")}
                                </p>

                                <div className="grid min-w-0 gap-2 md:grid-cols-3">
                                  {SCORE_OPTIONS.map(
                                    (
                                      score, response
                                    ) => {
                                      const selected =
                                        state.score ===
                                        score;

                                      return (
                                        <button
                                          key={
                                            score
                                          }
                                          type="button"
                                          aria-pressed={selected}
                                          disabled={!questionUnlocked}
                                          onClick={() =>
                                            handleScoreChange(
                                              question,
                                              score
                                            )
                                          }
                                          className={[
                                            "group relative flex min-h-[76px] w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-[background-color,border-color,box-shadow,color,transform] duration-150 ease-out active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100",

                                            selected
                                              ? SCORE_SELECTED_STYLES[
                                                  response
                                                ]
                                              : SCORE_OPTION_STYLES[
                                                  response
                                                ],

                                          ].join(
                                            " "
                                          )}
                                        >
                                          <span
                                            className={[
                                              "flex size-6 items-center justify-center rounded-full border text-xs font-bold",

                                              SCORE_INDICATOR_STYLES[
                                                response
                                              ],
                                            ].join(
                                              " "
                                            )}
                                          >
                                            {
                                              score
                                            }
                                          </span>

                                          <span className="text-xs font-medium">
                                            {
                                              response === 0 ? t("score.zero") : response === 1 ? t("score.one") : t("score.two")
                                            }
                                          </span>

                                          {selected && (
                                            <Check className="motion-success-in absolute right-3 top-3 size-3.5" aria-hidden="true" />
                                          )}
                                        </button>
                                      );
                                    }
                                  )}
                                </div>
                              </div> : responseType === "Yes / No" ? <div className="mt-4"><p className="mb-2 text-xs font-medium">Response {question.mandatory && <span className="text-destructive">*</span>}</p><div className="grid grid-cols-2 gap-2">{(["Yes", "No"] as const).map((value) => <Button key={value} type="button" variant={state.yesNoResponse === value ? "default" : "outline"} aria-pressed={state.yesNoResponse === value} onClick={() => updateQuestionState(question.id, { yesNoResponse: value, status: "Pass" })}>{value}</Button>)}</div></div> : <div className="mt-4"><div className="flex items-center justify-between gap-3"><Label htmlFor={`text-response-${question.id}`} className="text-xs">Response {question.mandatory && <span className="text-destructive">*</span>}</Label><span className="text-[11px] text-muted-foreground">{state.textResponse.length} / 2000</span></div><Textarea id={`text-response-${question.id}`} value={state.textResponse} maxLength={2000} onChange={(event) => updateQuestionState(question.id, { textResponse: event.target.value, status: event.target.value.trim() ? "Pass" : "Not Started" })} className="mt-2 min-h-28" placeholder="Record your response..." /></div>}

                              {/* OBSERVATION */}

                              <div className="mt-4">
                                <div className="flex items-center justify-between gap-3">
                                <label
                                  htmlFor={`observation-${question.id}`}
                                  className="text-xs font-medium"
                                >
                                  {t("audit.observation")} <span className="font-normal text-muted-foreground">({requiresAction ? t("common.required") : t("common.optional")})</span>
                                  {requiresAction && (
                                    <span className="ml-1 text-destructive">
                                      *
                                    </span>
                                  )}
                                </label>
                                <span className="text-[11px] tabular-nums text-muted-foreground">
                                  {state.observation.length} / 1000
                                </span>
                                </div>

                                <Textarea
                                  id={`observation-${question.id}`}
                                  value={
                                    state.observation
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    handleObservationChange(
                                      question.id,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  placeholder={t("audit.recordObservation")}
                                    className="mt-2 min-h-24 w-full min-w-0 max-w-full"
                                  disabled={!questionUnlocked}
                                />
                              </div>

                              {/* CORRECTIVE ACTION */}

                              <div className="mt-4 grid min-w-0 items-stretch gap-3 xl:grid-cols-2">
                              <div className="flex min-h-32 min-w-0 max-w-full flex-col gap-3 rounded-lg border border-border/75 bg-muted/20 p-4">
                                <div className="flex min-w-0 items-center gap-2">
                                  <AlertCircle
                                    className={[
                                      "size-4",

                                      requiresAction
                                        ? "text-destructive"
                                        : "text-muted-foreground",
                                    ].join(
                                      " "
                                    )}
                                  />

                                  <div className="min-w-0">
                                    <p className="text-xs font-medium">
                                      {t("audit.action")} <span className="font-normal text-muted-foreground">({requiresAction ? t("common.required") : t("common.optional")})</span>
                                    </p>

                                    <p className="text-[11px] text-muted-foreground">
                                      {requiresAction
                                        ? t("audit.requiredForLowScore")
                                        : t("common.optional")}
                                    </p>
                                  </div>
                                </div>

                                {createdAction ? (
                                  <div className="min-w-0 rounded-lg border border-emerald-500/20 bg-background/80 p-3 shadow-sm">
                                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">
                                      <CheckCircle2 className="size-3.5" />
                                      {t("audit.actionCreated")}
                                    </div>
                                    <p className="mt-1.5 line-clamp-2 text-sm font-semibold leading-5">{createdAction.title}</p>
                                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] sm:grid-cols-3">
                                      <div className="min-w-0"><dt className="text-muted-foreground">Responsible</dt><dd className="mt-0.5 truncate font-medium">{createdAction.responsiblePersonName || createdAction.assignedTo || createdAction.zoneLeaderName || "Unassigned"}</dd></div>
                                      <div><dt className="text-muted-foreground">Priority</dt><dd className="mt-0.5"><Badge size="sm" variant={createdAction.priority === "Critical" || createdAction.priority === "High" ? "danger" : createdAction.priority === "Medium" ? "warning" : "info"}>{createdAction.priority}</Badge></dd></div>
                                      <div><dt className="text-muted-foreground">Due</dt><dd className="mt-0.5 font-medium">{new Date(`${createdAction.dueDate}T00:00:00`).toLocaleDateString(undefined, { day: "2-digit", month: "short" })}</dd></div>
                                      <div><dt className="text-muted-foreground">Status</dt><dd className="mt-0.5"><Badge size="sm" variant={createdAction.status === "Completed" ? "success" : createdAction.status === "Overdue" || createdAction.status === "Rework Required" ? "danger" : createdAction.status === "In Progress" || createdAction.status === "Pending Review" ? "warning" : "info"}>{createdAction.status}</Badge></dd></div>
                                      {createdAction.actionCategory && <div className="min-w-0"><dt className="text-muted-foreground">Category</dt><dd className="mt-0.5 truncate font-medium">{createdAction.actionCategory}</dd></div>}
                                      {createdAction.issueEvidence?.length ? <div><dt className="text-muted-foreground">Evidence</dt><dd className="mt-0.5 font-medium">{createdAction.issueEvidence.length} attached</dd></div> : null}
                                    </dl>
                                    <div className="mt-3 flex justify-end border-t border-border/60 pt-2">
                                      <Button type="button" size="sm" variant="ghost" disabled={!questionUnlocked} onClick={() => openActionDialog(question)}>
                                        <Eye className="mr-1.5 size-3.5" />
                                        {t("common.view")} {t("audit.action")} <span aria-hidden="true">→</span>
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="self-center"
                                    disabled={!questionUnlocked || (isScopedAudit(audit) && !isV4Audit(audit))}
                                    variant={requiresAction ? "default" : "outline"}
                                    onClick={() => openActionDialog(question)}
                                  >
                                    <Plus className="mr-1.5 size-3.5" />
                                    {t("audit.addAction")}
                                  </Button>
                                )}
                              </div>

                              {/* EVIDENCE */}

                              <div className="min-h-32 min-w-0 rounded-lg border border-border/75 bg-muted/20 p-4">
                                <div className="flex flex-col gap-3">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <FileText className="size-4 text-muted-foreground" />

                                      <p className="text-xs font-medium">
                                        {t("audit.evidence")} <span className="font-normal text-muted-foreground">({requiresEvidence ? t("common.required") : t("common.optional")})</span>
                                        {requiresEvidence && <span className="ml-1 text-destructive">*</span>}
                                      </p>
                                    </div>

                                    <p className="mt-1 text-[11px] text-muted-foreground">
                                      {t("audit.attachEvidence")}
                                    </p>
                                  </div>

                                  <div className="flex flex-wrap justify-center gap-2">
                                    <input
                                      ref={(
                                        element
                                      ) => {
                                        fileInputRefs.current[
                                          question.id
                                        ] =
                                          element;
                                      }}
                                      type="file"
                                      accept="image/*,.pdf,.doc,.docx"
                                      className="hidden"
                                      onChange={(
                                        event
                                      ) =>
                                        handleEvidenceUpload(
                                          question.id,
                                          event
                                        )
                                      }
                                    />

                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      className="order-2 sm:order-1"
                                      disabled={!questionUnlocked}
                                      onClick={() =>
                                        fileInputRefs.current[
                                          question.id
                                        ]?.click()
                                      }
                                    >
                                      <Upload className="mr-1.5 size-3.5" />
                                      Upload Photo
                                    </Button>

                                    <OpsCameraCapture disabled={!questionUnlocked} fileNamePrefix="audit-evidence" onCapture={(file) => createEvidenceFromFile(question.id, file)} trigger={(openCamera) => <Button type="button" size="sm" variant="outline" className="order-1 sm:order-2" disabled={!questionUnlocked} onClick={openCamera}><Camera className="mr-1.5 size-3.5" />Take Photo</Button>} />
                                  </div>
                                </div>

                                {state.evidence.length > 0 && (
                                  <div className="mt-4 border-t border-border/60 pt-3">
                                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                      {t("audit.uploadedEvidence")}
                                    </p>

                                    <div className="grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                                    {state.evidence.map(
                                      (
                                        evidence
                                      ) => (
                                        <div
                                          key={
                                            evidence.id
                                          }
                                          className="motion-attachment-in group flex min-w-0 items-center gap-2.5 rounded-lg border border-border/75 bg-background p-2 transition-colors hover:border-border hover:bg-muted/30"
                                        >
                                          <button
                                            type="button"
                                            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                            onClick={() => {
                                              setPreviewZoom(1);
                                              setPreviewEvidence(evidence);
                                            }}
                                            aria-label={`Preview ${evidence.name}`}
                                          >
                                            {evidence.type === "image" ? (
                                              <AuditEvidenceThumbnail evidence={evidence} />
                                            ) : (
                                              <span className="flex size-11 shrink-0 items-center justify-center rounded-md border border-border/70 bg-muted/50 text-muted-foreground">
                                                <FileText className="size-5" />
                                              </span>
                                            )}

                                            <span className="min-w-0 flex-1">
                                              <span className="block truncate text-xs font-medium" title={evidence.name}>
                                                {evidence.name}
                                              </span>
                                              <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground">
                                                {getEvidenceFileLabel(evidence)} · {formatEvidenceSize(evidence.size)}
                                              </span>
                                              <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                                                <Eye className="size-3" /> View
                                              </span>
                                            </span>
                                          </button>

                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                                            aria-label={`Remove ${evidence.name}`}
                                            title="Remove attachment"
                                            onClick={() =>
                                              removeEvidence(
                                                question.id,
                                                evidence.id
                                              )
                                            }
                                          >
                                            <Trash2 className="size-3.5" />
                                          </Button>
                                        </div>
                                      )
                                    )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </CardContent>

            </Card>
          )}
          </section>
        </div>
      </div>

      {fullScreen && activeSection && (
        <footer className="mobile-safe-bottom sticky bottom-0 z-40 flex shrink-0 items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 shadow-[0_-10px_30px_-24px_rgb(15_23_42/0.5)] backdrop-blur md:px-8">
          <Button type="button" variant="outline" disabled={activeSectionIndex === 0 && activeQuestionIndex === 0} onClick={() => navigateQuestion(-1)}>Previous</Button>
          <p className="hidden text-xs text-muted-foreground sm:block">{auditSectionName(language, activeSection.category)} · Question {activeQuestionIndex + 1} of {activeSection.questions.length}</p>
          {isFinalQuestion ? (
            <Button type="button" disabled={!auditReadyForCompletion || !isQuestionComplete(activeSection.questions[activeQuestionIndex])} onClick={requestAuditCompletion}>
              <CheckCircle2 className="size-4" />
              Complete Audit
            </Button>
          ) : (
            <Button type="button" disabled={!isQuestionComplete(activeSection.questions[activeQuestionIndex])} onClick={() => navigateQuestion(1)}>Save &amp; Next <span aria-hidden="true">→</span></Button>
          )}
        </footer>
      )}

      {/* ACTION DIALOG */}

      {showActionDialog && activeActionQuestion && questionStates[activeActionQuestion.id]?.actionId ? (<ActionDialog
            error={uiError}
              question={
                activeActionQuestion
              }
              zone={audit.area}
              state={
                questionStates[
                  activeActionQuestion.id
                ]
              }
              onClose={
                closeActionDialog
              }
              onCreate={
                handleCreateAction
              }
              onUpdate={(updates) =>
                updateQuestionState(
                  activeActionQuestion.id,
                  updates
                )
              }
              onEvidenceUpload={(event) => handleEvidenceUpload(activeActionQuestion.id, event)}
              onEvidenceFile={(file) => createEvidenceFromFile(activeActionQuestion.id, file)}
              onEvidenceRemove={(evidenceId) => removeEvidence(activeActionQuestion.id, evidenceId)}
              onEvidencePreview={(evidence) => { setPreviewZoom(1); setPreviewEvidence(evidence); }}
              saving={actionSaving}
            />) : renderAuditActionDialog()}

      <Dialog
        open={previewEvidence !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewEvidence(null);
            setPreviewZoom(1);
          }
        }}
      >
        <DialogContent
          className="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden bg-background p-0 sm:h-[calc(100dvh-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-none"
          showCloseButton={false}
        >
          {previewEvidence && (
            <>
              <DialogHeader className="min-w-0 flex-row items-center justify-between gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <DialogTitle className="truncate pr-2" title={previewEvidence.name}>
                    {previewEvidence.name}
                  </DialogTitle>
                  <DialogDescription className="mt-1 text-xs">
                    {getEvidenceFileLabel(previewEvidence)} · {formatEvidenceSize(previewEvidence.size)}
                  </DialogDescription>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setPreviewEvidence(null)}
                  aria-label="Close attachment preview"
                >
                  <X className="size-4" />
                </Button>
              </DialogHeader>

              <div
                ref={previewRef}
                className="flex min-h-0 items-center justify-center overflow-auto bg-slate-950/95 p-4 sm:p-6"
              >
                {previewEvidence.type === "image" ? (
                  // Preserve the source file's natural aspect ratio in the viewer.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewEvidenceUrl}
                    alt={previewEvidence.name}
                    className="max-h-full max-w-full object-contain transition-transform duration-150"
                    style={{ transform: `scale(${previewZoom})` }}
                  />
                ) : isPdfEvidence(previewEvidence) ? (
                  <iframe
                    src={previewEvidenceUrl}
                    title={`Preview ${previewEvidence.name}`}
                    className="h-full min-h-[60vh] w-full max-w-6xl rounded-md border-0 bg-white"
                  />
                ) : (
                  <div className="flex max-w-md flex-col items-center rounded-xl border border-white/10 bg-slate-900 px-8 py-10 text-center text-slate-100 shadow-sm">
                    <FileText className="size-10 text-slate-400" />
                    <p className="mt-4 max-w-full truncate text-sm font-medium" title={previewEvidence.name}>
                      {previewEvidence.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      Preview unavailable for this file type.
                    </p>
                    <Button
                      nativeButton={false}
                      render={<a href={previewEvidenceUrl} target="_blank" rel="noreferrer" />}
                      size="sm"
                      variant="secondary"
                      className="mt-5"
                    >
                        <ExternalLink className="mr-1.5 size-3.5" /> Open File
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 bg-muted/25 px-4 py-2.5 sm:px-5">
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {formatEvidenceSize(previewEvidence.size)} · {getEvidenceFileLabel(previewEvidence)}
                </span>

                <div className="flex items-center gap-1">
                  {previewEvidence.type === "image" && (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={previewZoom <= 0.5}
                        onClick={() => setPreviewZoom((zoom) => Math.max(0.5, zoom - 0.25))}
                        aria-label="Zoom out"
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
                        {Math.round(previewZoom * 100)}%
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={previewZoom >= 3}
                        onClick={() => setPreviewZoom((zoom) => Math.min(3, zoom + 0.25))}
                        aria-label="Zoom in"
                      >
                        <Plus className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setPreviewZoom(1)}
                        aria-label="Reset zoom to fit"
                        title="Fit to screen"
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    </>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => void previewRef.current?.requestFullscreen?.()}
                    aria-label="Enter full screen"
                    title="Full screen"
                  >
                    <Maximize2 className="size-4" />
                  </Button>

                  <Button
                    nativeButton={false}
                    render={<a href={previewEvidenceUrl} target="_blank" rel="noreferrer" />}
                    variant="ghost"
                    size="sm"
                  >
                      <ExternalLink className="mr-1.5 size-3.5" /> Open original
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <CompleteAuditDialog
        error={uiError}
        open={showCompleteConfirmation}
        questionCount={allQuestions.length}
          outstandingActionCount={openAuditActions.length}
        auditor={isScopedAudit(audit) ? currentUser.name : audit.auditor}
        signature={auditorSignature}
        onOpenChange={setShowCompleteConfirmation}
        onSignatureConfirm={handleSignatureConfirm}
        onSignatureClear={handleSignatureClear}
        onConfirm={handleCompleteAudit}
      />

    </div>
  );
}

function createAuditEvidenceId() { return `EV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }

export function CompleteAuditDialog({
  error,
  open,
  questionCount,
  outstandingActionCount = 0,
  auditor,
  signature,
  onOpenChange,
  onSignatureConfirm,
  onSignatureClear,
  onConfirm,
}: {
  open: boolean;
  error?: string;
  questionCount: number;
  outstandingActionCount?: number;
  auditor: string;
  signature?: FiveSAudit["auditorSignature"];
  onOpenChange: (open: boolean) => void;
  onSignatureConfirm: (signatureImage: string) => void;
  onSignatureClear: () => void;
  onConfirm: () => void;
}) {
  const { t } = useI18n();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-h-[calc(100dvh-1.5rem)] max-w-3xl overflow-y-auto overscroll-contain">
        {error && <OpsFeedback tone="error" message={error} />}
        <AlertDialogHeader>
          <AlertDialogTitle>{t("signature.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            All {questionCount} questions are complete. Sign below to approve the audit, then select Complete Audit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {outstandingActionCount > 0 && <p role="status" className="rounded-lg border bg-muted/30 p-3 text-sm">This Audit has {outstandingActionCount} outstanding {outstandingActionCount === 1 ? "Action" : "Actions"}. You can complete the Audit now; {outstandingActionCount === 1 ? "this Action will remain open" : "these Actions will remain open"} in Action Center.</p>}
        <AuditorSignaturePad auditor={auditor} signature={signature} onConfirm={onSignatureConfirm} onClear={onSignatureClear} />
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction disabled={!signature} onClick={onConfirm}>{t("audit.complete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * ---------------------------------------------------------
 * ACTION DIALOG
 * ---------------------------------------------------------
 */

interface ActionDialogProps {
  error?: string;
  question: FiveSQuestion;
  zone: string;
  state: QuestionState;
  onClose: () => void;
  onCreate: () => void;
  onUpdate: (
    updates: Partial<QuestionState>
  ) => void;
  onEvidenceUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onEvidenceFile: (file: File) => void | Promise<void>;
  onEvidenceRemove: (evidenceId: string) => void;
  onEvidencePreview: (evidence: FiveSEvidence) => void;
  saving: boolean;
}

function ActionDialog({
  error,
  question,
  zone,
  state,
  onClose,
  onCreate,
  onUpdate,
  onEvidenceUpload,
  onEvidenceFile,
  onEvidenceRemove,
  onEvidencePreview,
  saving,
}: ActionDialogProps) {
  const { actionCategoryLabel, t } = useI18n();
  const actionCategories = useActiveActionCategories();
  const actionPriorities = useActiveActionPriorities();
  const evidenceInputRef = useRef<HTMLInputElement | null>(null);
  const requiresAction =
    state.complianceResponse === 0 ||
    state.complianceResponse === 1;
  const requiresEvidence = requiresAction && (question.questionSource !== "custom" || Boolean(question.requireEvidenceOnNonCompliance));

  const today = toLocalInputDate(new Date());
  const selectedZone = getFiveSZoneConfiguration(zone);
  const existingAction = state.actionId ? getActionById(state.actionId) : undefined;
  const canEditCreatedAction = !state.actionId || existingAction?.status === "Awaiting Assignment";
  const dueDateInvalid = !state.dueDate || state.dueDate < today;

  const selectedPriority = actionPriorities.find((item) => item.id === state.priority);

  useEffect(() => {
    if (!existingAction && !selectedPriority && actionPriorities[0]) onUpdate({ priority: actionPriorities[0].id, dueDate: getPriorityDueDate(actionPriorities[0].id) });
  }, [actionPriorities, existingAction, onUpdate, selectedPriority]);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="motion-success-in w-full max-w-2xl overflow-hidden rounded-xl border bg-background shadow-2xl">
        {error && <OpsFeedback tone="error" message={error} />}
        {/* DIALOG HEADER */}

        <div className="flex items-start justify-between border-b px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <AlertCircle
                className={[
                  "size-4",

                  requiresAction
                    ? "text-destructive"
                    : "text-primary",
                ].join(" ")}
              />

              <h2 className="text-base font-semibold">
                {t("audit.action")}
              </h2>
            </div>

            <p className="mt-2 text-sm font-medium leading-5">
              {question.question}
            </p>

            {state.score !==
              null && (
              <Badge
                className={`mt-2 ${
                  SCORE_STYLES[
                    state.complianceResponse ?? -1
                  ]
                }`}
              >
                {t("audit.score")}{" "}
                {state.score} ·{" "}
                {
                  state.complianceResponse === 0 ? t("score.zero") : state.complianceResponse === 1 ? t("score.one") : t("score.two")
                }
              </Badge>
            )}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={saving}
          >
            <X className="size-4" />
          </Button>
        </div>

        {/* DIALOG BODY */}

        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium">
                {t("action.title")}
              </label>

              <Input
                value={
                  state.actionTitle
                }
                onChange={(event) =>
                  onUpdate({
                    actionTitle:
                      event.target
                        .value,
                  })
                }
                placeholder={t("action.enterTitle")}
                className="mt-1.5"
                disabled={!canEditCreatedAction}
              />
            </div>

            <div>
              <label className="text-xs font-medium">
                {t("action.description")}
              </label>

              <Textarea
                value={
                  state.actionDescription
                }
                onChange={(event) =>
                  onUpdate({
                    actionDescription:
                      event.target
                        .value,
                    observation:
                      event.target
                        .value,
                  })
                }
                placeholder={t("action.enterDescription")}
                className="mt-1.5 min-h-24"
                disabled={!canEditCreatedAction}
              />
            </div>

            <div className={`rounded-lg border p-4 ${requiresEvidence && state.evidence.length === 0 ? "border-destructive/45 bg-destructive/[0.035]" : "bg-muted/10"}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-muted-foreground" />
                    <p className="text-xs font-medium">{t("action.originalEvidence")} {requiresEvidence ? <span className="text-destructive">*</span> : <span className="font-normal text-muted-foreground">({t("common.optional")})</span>}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t("action.evidenceHelp")}</p>
                </div>
                {canEditCreatedAction && <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <input ref={evidenceInputRef} type="file" accept="image/*,.pdf,.doc,.docx" className="hidden" onChange={onEvidenceUpload} />
                  <Button type="button" size="sm" variant="outline" className="order-2 flex-1 sm:order-1 sm:flex-none" onClick={() => evidenceInputRef.current?.click()}><Upload className="mr-1.5 size-3.5" />Upload Photo</Button>
                  <OpsCameraCapture fileNamePrefix="audit-action-evidence" onCapture={onEvidenceFile} trigger={(openCamera) => <Button type="button" size="sm" variant="outline" className="order-1 flex-1 sm:order-2 sm:flex-none" onClick={openCamera}><Camera className="mr-1.5 size-3.5" />Take Photo</Button>} />
                </div>}
              </div>
              {state.evidence.length > 0 ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{state.evidence.map((evidence) => <div key={evidence.id} className="flex min-w-0 items-center gap-2 rounded-lg border bg-background p-2"><button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onEvidencePreview(evidence)}>{evidence.type === "image" ? <AuditEvidenceThumbnail evidence={evidence} /> : <span className="grid size-11 shrink-0 place-items-center rounded bg-muted"><FileText className="size-5" /></span>}<span className="min-w-0"><span className="block truncate text-xs font-medium">{evidence.name}</span><span className="text-[10px] text-muted-foreground">{getEvidenceFileLabel(evidence)} · {formatEvidenceSize(evidence.size)}</span></span></button>{canEditCreatedAction && <Button type="button" size="icon-sm" variant="ghost" onClick={() => onEvidenceRemove(evidence.id)} aria-label={`Remove ${evidence.name}`}><Trash2 className="size-3.5" /></Button>}</div>)}</div> : requiresEvidence && <p className="mt-3 text-[11px] font-medium text-destructive">At least one evidence attachment is required for Non Compliance or Partial Compliance.</p>}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">
                  {t("action.category")} <span className="text-destructive">*</span>
                </label>

                <Select searchLabel={"Action Category"}
                  value={state.actionCategory}
                  onValueChange={(value) => {
                    onUpdate({ actionCategory: value ?? "" });
                  }}
                  disabled={!canEditCreatedAction}
                >
                  <SelectTrigger className="mt-1.5 w-full" aria-required="true" aria-invalid={!state.actionCategory}>
                    <SelectValue placeholder={t("action.selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    {actionCategories.map((category) => <SelectItem key={category} value={category}>{actionCategoryLabel(category)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className={`mt-1.5 text-[11px] ${state.actionCategory ? "text-muted-foreground" : "font-medium text-destructive"}`}>{t("action.categoryRequired")}</p>
              </div>

              <div>
                <label className="text-xs font-medium">
                  {t("action.priority")}
                </label>

                <Select
                  value={state.priority}
                  onValueChange={(value) => {
                    if (!value) return;
                    const priority = value as FiveSActionPriority;
                    onUpdate({
                      priority,
                      dueDate: existingAction?.dueDateOverride ?? getPriorityDueDate(priority),
                    });
                  }}
                  disabled={!canEditCreatedAction}
                >
                  <SelectTrigger className="mt-1.5 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionPriorities.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2"><div><label className="text-xs font-medium">Target Zone</label><div className="mt-1.5 rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">{zone}</div></div><div><label className="text-xs font-medium">Zone Leader</label><div className="mt-1.5 rounded-md border bg-muted/30 px-3 py-2 text-sm font-medium">{selectedZone?.leader ?? "Not configured"}</div></div></div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium">Due Date</label>
                <Input
                  type="date"
                  value={state.dueDate}
                  min={today}
                  onChange={(event) =>
                    onUpdate({ dueDate: event.target.value })
                  }
                  className="mt-1.5"
                  disabled={!canEditCreatedAction || Boolean(existingAction)}
                />
                {existingAction && <ActionLink className="mt-1.5 inline-block text-xs text-primary underline" href={`/actions/${encodeURIComponent(existingAction.id)}`}>Edit due date in Action details (reason required)</ActionLink>}
                <p className={`mt-1.5 text-[11px] ${dueDateInvalid ? "text-destructive" : "text-muted-foreground"}`}>
                  {dueDateInvalid ? "Due Date cannot be in the past." : `Defaulted to ${selectedPriority?.dueOffsetDays ?? 0} day${selectedPriority?.dueOffsetDays === 1 ? "" : "s"} from today based on ${selectedPriority?.label ?? state.priority} priority`}
                </p>
              </div>
            </div>

            {requiresAction && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                An Action is
                required because this
                question received a
                score of{" "}
                {state.score}.
              </div>
            )}
          </div>
        </div>

        {/* DIALOG FOOTER */}

        <div className="flex items-center justify-end gap-2 border-t px-5 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={saving}
          >
            {t("common.cancel")}
          </Button>

          {canEditCreatedAction && (
            <Button
              type="button"
              onClick={onCreate}
              disabled={
                saving ||
                !state.actionTitle.trim() ||
                !state.actionCategory ||
                dueDateInvalid ||
                (requiresEvidence && state.evidence.length === 0)
              }
            >
              {saving ? (
                state.actionId ? "Updating..." : "Creating..."
              ) : (
                <>
                  <Plus className="mr-2 size-4" />
                  {state.actionId ? t("action.update") : t("action.create")}
                </>
              )}
            </Button>
          )}

          {state.actionId && !canEditCreatedAction && (
            <Button
              type="button"
              onClick={onClose}
            >
              <CheckCircle2 className="mr-2 size-4" />
              {t("audit.actionCreated")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default FiveSAuditExecution;

function AuditEvidenceThumbnail({evidence}:{evidence:FiveSEvidence}) {
  const url=useActionEvidenceUrl({url:evidence.dataUrl,storageKey:evidence.storageKey});
  // Local evidence is resolved to a data/blob URL; framework optimization is not applicable.
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img src={url} alt="" className="size-11 shrink-0 rounded-md border border-border/70 object-cover" /> : <span className="size-11 shrink-0 rounded bg-muted" aria-label="Loading evidence" />;
}
