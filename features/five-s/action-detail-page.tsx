"use client";
import { AuditActionDetail, useVersionedActionRecord } from "@/features/actions/audit-action-detail";
import { isV4Action } from "@/lib/actions/action-v4-policy";
import { deletedRecordHref } from "@/lib/records/record-tombstones";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { OpsDetailSection } from "@/components/ops/ops-detail-section";
import { CanonicalLinkedRecords } from "@/components/ops/ops-linked-records";
/* eslint-disable @next/next/no-img-element -- user-provided evidence uses local/data URLs and the existing fullscreen viewer. */

import { useEffect, useRef, useState } from "react";
import Link from "@/components/ops/ops-record-link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Building2, CalendarDays, Camera, ChevronDown, Circle, Check, CheckCircle2, ClipboardCheck, ExternalLink, FileText, IndianRupee, Link2, MapPin, Maximize2, Paperclip, Play, RotateCcw, Upload, UserRound, X } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { OpsCameraCapture } from "@/components/ops/ops-camera-capture";
import { PageFormActionBar } from "@/components/ops/page-form-action-bar";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getRoleVisibleActions } from "@/features/actions/action-center-data";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useRedTags } from "@/features/five-s/red-tag/store";
import type { MyAction, MyActionEvidence, MyActionType } from "@/features/five-s/types/my-actions";
import { getActionTypeLabel, ACTION_PRIORITY_CONFIG, ACTION_REVIEW_STATUSES, ACTION_STATUS_CONFIG, actionDueDays, formatShortDate, getActionSourceDefinition, getActionSourceHref, getActionSourceRecordLabel, isActionOverdue } from "@/lib/actions/action-config";
import { acknowledgeActionEscalation, useActionAttention } from "@/lib/actions/action-attention-store";
import { getActionStartError, getActionStartState, compactActionEvidenceStorage, getActionById, canUndoActionStart, undoActionStart, canEditActionContent, addActionEvidence, addActionProgressEvidence, assignActionToZoneMember, canReassignAction, canReviewAction, canEditActionDueDate, changeActionDueDate, validateActionDueDate, getActionClosureError, closeReviewedAction, reassignActionOwner, removeActionEvidence, removeActionProgressEvidence, sendActionBack, startAssignedAction, submitActionForReviewWithEvidenceStorage, updateAction, useActionStore } from "@/lib/actions/action-store";
import { resolveActionSourceBeforeEvidence } from "@/lib/actions/action-evidence";
import { useActionEvidenceUrl } from "@/lib/actions/use-action-evidence-url";
import { FIVE_S_CORRECTIVE_ACTION_CATEGORIES, getFiveSZoneConfiguration } from "@/lib/five-s/configuration";
import { ACTION_LIFECYCLE_STAGES, getActionLifecycleStage } from "@/lib/five-s/lifecycle-status";
import { useCurrentUser } from "@/lib/current-user";
import { readEvidenceFileBlob } from "@/lib/evidence-files";
import { saveGembaPhoto, deleteGembaPhoto } from "@/lib/gemba/gemba-photo-storage";
import { MAX_EVIDENCE_IMAGES } from "@/lib/evidence-images";
import { ActionSubmissionHistory } from "@/features/actions/action-submission-history";
import { formatOpsDate, formatOpsDateTime, formatOpsMoney } from "@/lib/ops-formatters";
import { cn } from "@/lib/utils";
import { OpsPersonSelect } from "@/components/ops/ops-person-select";

import { validateReturnTo } from "@/lib/navigation/return-to";

import { OpsFeedback } from "@/components/ops/ops-feedback";

type DetailSection = "overview" | "evidence" | "review";
const DETAIL_SECTIONS: Array<{ id: DetailSection; label: string }> = [
  { id: "overview", label: "Overview" }, { id: "evidence", label: "Evidence" }, { id: "review", label: "Review" },
];

export default function FiveSActionDetailPage(props: { actionId: string; initialSection?: string; returnTo?: string }) {
  const record = useVersionedActionRecord(props.actionId);
  if (record && isV4Action(record)) return <AuditActionDetail actionId={props.actionId}/>;
  return <LegacyFiveSActionDetailPage {...props}/>;
}
function LegacyFiveSActionDetailPage({ actionId, initialSection, returnTo }: { actionId: string; initialSection?: string; returnTo?: string }) {
  const router = useRouter();
  const actions = useActionStore();
  const redTags = useRedTags();
  const actor = useCurrentUser();
  const adminUsers = useAdminUsers();
  const adminUser = adminUsers.find((user) => user.id === actor.id);
  const actorWithAuthority = { id: actor.id, name: actor.name, roles: adminUser?.roles, permissions: adminUser?.permissions };
  const storedAction = actions.find((item) => item.id === actionId);
  const action = getRoleVisibleActions(actions, actor, adminUser).find((item) => item.id === actionId);
  const requestedBackTo = validateReturnTo(returnTo);
  const backTo = requestedBackTo && !deletedRecordHref(requestedBackTo) ? requestedBackTo : undefined;
  const [feedback, setFeedback] = useState<{tone: "success" | "error"; message: string}>();
  const attention = useActionAttention(actionId);
  const [section, setSection] = useState<DetailSection | null>(() => DETAIL_SECTIONS.some((item) => item.id === initialSection) ? initialSection as DetailSection : "overview");
  const [observation, setObservation] = useState("");
  const [category, setCategory] = useState("");
  const [costSaving, setCostSaving] = useState("0");
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [selectedActionType, setSelectedActionType] = useState<MyActionType | "">("");
  const [startError, setStartError] = useState("");
  const startSubmissionLock = useRef(false);
  const startState = useRef<string>("");
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [remark, setRemark] = useState("");
  const [closureRemark, setClosureRemark] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignId, setReassignId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [ownershipError, setOwnershipError] = useState("");
  const [dueDateOpen, setDueDateOpen] = useState(false);
  const [newDueDate, setNewDueDate] = useState("");
  const [dueDateReason, setDueDateReason] = useState("");
  const [dueDateError, setDueDateError] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [preview, setPreview] = useState<MyActionEvidence | null>(null);
  const [pendingTransition, setPendingTransition] = useState<"start" | "submit" | "send-back" | "close" | null>(null);
  const [overviewAttempted, setOverviewAttempted] = useState(false);
  const [evidenceAttempted, setEvidenceAttempted] = useState(false);
  const progressInputRef = useRef<HTMLInputElement | null>(null);
  const completionInputRef = useRef<HTMLInputElement | null>(null);
  const evidenceUploadLock = useRef(false);
  const submissionLock = useRef(false);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const notesRef = useRef<HTMLTextAreaElement | null>(null);
  const categoryRef = useRef<HTMLButtonElement | null>(null);
  const costSavingRef = useRef<HTMLInputElement | null>(null);
  const completionSectionRef = useRef<HTMLDivElement | null>(null);

  const persistedObservation = action?.resolutionObservation ?? action?.actionTakenDescription ?? "";
  const persistedCategory = action?.correctiveActionCategory ?? "";
  const persistedCostSaving = String(action?.costSaving ?? 0);
  const persistedActionId = action?.id;
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setObservation(persistedObservation);
      setCategory(persistedCategory);
      setCostSaving(persistedCostSaving);
    });
    return () => { cancelled = true; };
  }, [persistedActionId, persistedObservation, persistedCategory, persistedCostSaving]);

  const latestRework = [...(action?.reviewHistory ?? [])].reverse().find((item) => item.type === "sent_back");

  if (!action) return <PageContainer><div className="flex min-h-[55vh] flex-col items-center justify-center rounded-xl border border-dashed bg-card text-center"><FileText className="size-9 text-muted-foreground" /><h1 className="mt-4 text-lg font-semibold">{storedAction ? "Action access denied" : "Action not found"}</h1><p className="mt-1 text-sm text-muted-foreground">{storedAction ? "This Action is outside your permitted role or zone scope." : "This action may have been removed or is unavailable."}</p><Button className="mt-5" variant="outline" onClick={() => router.push("/actions")}><ArrowLeft className="size-4" />Back to Actions</Button></div></PageContainer>;

  const reassignment = action.reassignmentHistory?.at(-1);
  const reassignmentMessage = reassignment ? `This Action was reassigned from ${reassignment.previousOwnerName} to ${reassignment.newOwnerName} by ${reassignment.changedByName} on ${formatDateTime(reassignment.changedAt)}.` : undefined;
  const isResponsible = action.responsiblePersonId ? action.responsiblePersonId === actor.id : action.assignedTo === actor.name;
  const canEdit = canEditActionContent(action, actor);
  const zoneConfiguration = getFiveSZoneConfiguration(action.area);
  const canAssign = action.status === "Awaiting Assignment" && zoneConfiguration?.leaderId === actor.id;
  const canReview = canReviewAction(action, actorWithAuthority) && ACTION_REVIEW_STATUSES.includes(action.status);
  const canReassign = canReassignAction(action, actorWithAuthority) && Boolean(action.responsiblePersonId || action.responsiblePersonName || action.assignedTo);
  const canStart = isResponsible && ["Assigned", "Open", "Rework Required"].includes(action.status);
  const validResolution = Boolean(observation.trim()) && Boolean(category) && action.evidence.length > 0 && Number.isFinite(Number(costSaving)) && Number(costSaving) >= 0;
  const hasCompletionEvidence = action.evidence.length > 0;
  const overviewErrors = {
    observation: !observation.trim() ? "Corrective measure / responsible notes are required." : "",
    category: !category ? "Corrective action category is required." : "",
    costSaving: !Number.isFinite(Number(costSaving)) || Number(costSaving) < 0 ? "Enter a valid non-negative cost saving amount." : "",
  };
  const source = getActionSourceDefinition(action);
  const SourceIcon = source.icon;
  const sourceHref = getActionSourceHref(action);
  const resolvedBeforeEvidence = resolveActionSourceBeforeEvidence(action, redTags);
  const { evidence: sourceBeforeEvidence, description: beforeEvidenceDescription } = resolvedBeforeEvidence;
  const dueDays = actionDueDays(action);
  const urgencyLabel = dueDays === 1 ? "Due tomorrow" : dueDays === 0 ? "Due today" : dueDays < 0 ? `Overdue by ${Math.abs(dueDays)} day${Math.abs(dueDays) === 1 ? "" : "s"}` : `Due in ${dueDays} days`;
  const activeEscalation = [...attention.escalations].filter((item) => item.status !== "Resolved").sort((left, right) => right.level - left.level)[0];

  function syncFields(updated: MyAction | undefined) {
    if (!updated) return;
    setObservation(updated.resolutionObservation ?? updated.actionTakenDescription ?? "");
    setCategory(updated.correctiveActionCategory ?? "");
    setCostSaving(String(updated.costSaving ?? 0));
  }
  function setErrorFeedback(message: string) { setFeedback({ tone: "error", message }); }
  function persistOverview() {
    if (!canEdit) return undefined;
    const updated = updateAction(actionId, { actionTakenDescription: observation.trim(), resolutionObservation: observation.trim(), correctiveActionCategory: category, costSaving: Number.isFinite(Number(costSaving)) ? Number(costSaving) : undefined, currency: "INR" }, actor);
    if (!updated) setErrorFeedback("Action changes could not be saved. Check your permissions and browser storage, then retry.");
    syncFields(updated);
    if (updated) setFeedback({tone: "success", message: "Action details saved."});
    return updated;
  }
  function saveProgress() {
    persistOverview();
  }
  function focusFirst(node: HTMLElement | null) {
    window.setTimeout(() => { node?.scrollIntoView({ behavior: "smooth", block: "center" }); window.setTimeout(() => node?.focus({ preventScroll: true }), 250); }, 0);
  }
  function validateOverview() {
    setOverviewAttempted(true);
    const first = overviewErrors.observation ? notesRef.current : overviewErrors.category ? categoryRef.current : overviewErrors.costSaving ? costSavingRef.current : null;
    if (first) { focusFirst(first); return false; }
    return true;
  }
  function validateEvidence() {
    setEvidenceAttempted(true);
    if (!hasCompletionEvidence) { focusFirst(completionSectionRef.current); return false; }
    return true;
  }
  function navigateToStep(target: DetailSection) {
    const order: DetailSection[] = ["overview", "evidence", "review"];
    if (order.indexOf(target) <= order.indexOf(section ?? "overview") || !canEdit) { setSection(target); return; }
    if (section === "overview" && !validateOverview()) return;
    if (section === "overview" && !persistOverview()) return;
    if (target === "review" && !validateEvidence()) { setSection("evidence"); return; }
    setSection(target);
    focusFirst(document.getElementById(`action-section-${target}`));
  }
  function startWork() {
    if (pendingTransition) return;
    startSubmissionLock.current = false;
    startState.current = getActionStartState(action!);
    setSelectedActionType(""); setStartError(""); setStartDialogOpen(true);
  }
  function confirmStartWork() {
    if (pendingTransition || startSubmissionLock.current) return;
    const current = getActionById(actionId);
    if (!current) { setStartError("This Action is no longer available. Close and refresh."); return; }
    const error = getActionStartError(current, actorWithAuthority, selectedActionType, startState.current);
    if (error) { setStartError(error); return; }
    startSubmissionLock.current = true; setPendingTransition("start");
    const updated = startAssignedAction(actionId, actorWithAuthority, selectedActionType as MyActionType, startState.current);
    setPendingTransition(null);
    if (!updated) { startSubmissionLock.current = false; setStartError("Unable to save the start. The Action or your permissions may have changed, or browser storage is full. Close, refresh and retry."); return; }
    syncFields(updated); setStartDialogOpen(false); setFeedback({tone:"success",message:"Action started."});
  }
  function undoStart() {
    if (pendingTransition) return;
    const updated = undoActionStart(actionId, actorWithAuthority, { observation, category, costSaving: costSaving.trim() ? Number(costSaving) : undefined });
    if (!updated) { setFeedback({ tone: "error", message: "Unable to undo Start Work. Check the cost saving value, permissions or browser storage and retry." }); return; }
    setOverviewAttempted(false); setEvidenceAttempted(false);
    setFeedback({ tone: "success", message: "Returned to the pre-start state. Your details and evidence have been kept." });
  }
  async function submitForReview() {
    if (pendingTransition || submissionLock.current) return;
    if (evidenceUploadLock.current) { setErrorFeedback("Wait for the evidence upload to finish, then submit."); return; }
    if (!validateOverview()) { setSection("overview"); return; }
    if (!validateEvidence()) { setSection("evidence"); return; }
    submissionLock.current = true;
    setPendingTransition("submit");
    try {
      const updated = await submitActionForReviewWithEvidenceStorage(actionId, actorWithAuthority, { observation, correctiveActionCategory: category, costSaving: Number(costSaving) });
      if (!updated) throw new Error("Action could not be submitted. Check your permissions and browser storage, then retry. Your work has been kept.");
      syncFields(updated);
      setFeedback({ tone: "success", message: "Action submitted for review." });
    } catch (error) {
      setErrorFeedback(error instanceof Error ? error.message : "Unable to submit this Action. Your work has been kept.");
    } finally {
      submissionLock.current = false;
      setPendingTransition(null);
    }
  }
  async function addEvidenceFile(file: File | undefined, kind: "progress" | "completion") {
    const currentAction = getActionById(actionId);
    if (!file || !canEdit || !currentAction || evidenceUploadLock.current || submissionLock.current) return;
    const count = kind === "progress" ? currentAction.progressEvidence?.length ?? 0 : currentAction.evidence.length;
    if (count >= MAX_EVIDENCE_IMAGES) { setErrorFeedback(`Maximum ${MAX_EVIDENCE_IMAGES} evidence images allowed.`); return; }
    evidenceUploadLock.current = true;
    let storageKey: string | undefined;
    let saved = false;
    try {
      const blob = await readEvidenceFileBlob(file);
      await compactActionEvidenceStorage();
      const id = `EV-${crypto.randomUUID()}`;
      storageKey = `action-evidence-${id}`;
      await saveGembaPhoto(storageKey, blob);
      const latest = getActionById(actionId);
      const latestCount = kind === "progress" ? latest?.progressEvidence?.length ?? 0 : latest?.evidence.length ?? 0;
      if (latestCount >= MAX_EVIDENCE_IMAGES) throw new Error(`Maximum ${MAX_EVIDENCE_IMAGES} evidence images allowed.`);
      const evidence: MyActionEvidence = { id, name: file.name, type: file.type.startsWith("image/") ? "image" : "document", evidenceType: kind === "progress" ? "progress" : "resolution", mimeType: blob.type || file.type, uploadedAt: new Date().toISOString(), uploadedBy: actor.name, storageKey };
      saved = Boolean(kind === "progress" ? addActionProgressEvidence(actionId, evidence, actor) : addActionEvidence(actionId, evidence, actor));
      if (!saved) throw new Error("Evidence could not be saved. Check your permissions and browser storage, then retry.");
      setFeedback({ tone: "success", message: "Evidence saved." });
    } catch (error) {
      if (storageKey && !saved) {
        try { await deleteGembaPhoto(storageKey); }
        catch (cleanupError) { console.error("Unable to remove an unlinked Action evidence upload:", cleanupError); }
      }
      setErrorFeedback(error instanceof Error ? error.message : "Unable to save this evidence file.");
    } finally { evidenceUploadLock.current = false; }
  }

  async function addEvidence(event: React.ChangeEvent<HTMLInputElement>, kind: "progress" | "completion") { await addEvidenceFile(event.target.files?.[0], kind); event.target.value = ""; }
  function confirmSendBack() {
    if (!remark.trim()) return;
    setPendingTransition("send-back");
    window.setTimeout(() => { sendActionBack(actionId, actorWithAuthority, remark); setRemark(""); setSendBackOpen(false); setPendingTransition(null); }, 220);
  }
  function confirmClose() {
    setPendingTransition("close");
    window.setTimeout(() => { const error = action ? getActionClosureError(action, actorWithAuthority) : "This Action is unavailable."; const closed = !error && closeReviewedAction(actionId, actorWithAuthority, closureRemark); if (closed) { setReviewError(""); setClosureRemark(""); setCloseOpen(false); } else setReviewError(error || "Closure could not be saved. Check browser storage and retry."); setPendingTransition(null); }, 260);
  }

  return <PageContainer className="max-w-none [overflow-wrap:anywhere]">
    {feedback && <OpsFeedback {...feedback} />}
    {canEditActionDueDate(action, actorWithAuthority) && <div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={() => { setNewDueDate(action.dueDate); setDueDateReason(""); setDueDateError(""); setDueDateOpen(true); }}>Edit Due Date</Button>{action.dueDateOverride && <span className="text-xs text-muted-foreground">Approved override · Priority baseline {formatShortDate(action.priorityDueDate ?? action.dueDate)}</span>}</div>}
    {ownershipError && <p role="alert" className="text-sm text-destructive">{ownershipError}</p>}
    <FiveSPageHeader eyebrow="OPS Workspace / Actions" title={action.title} description={action.id} leading={<Button variant="ghost" size="icon-sm" onClick={() => router.push(backTo ?? "/actions")} aria-label={backTo ? "Back to Source" : "Back to Actions"}><ArrowLeft className="size-4" /></Button>} actions={<><RecordDeletionMenu module="action" recordId={action.id} returnTo="/actions" />{reassignmentMessage || action.status === "Completed" ? <>{reassignmentMessage && <ReassignmentBadge message={reassignmentMessage} />}{action.status === "Completed" && <Button variant="outline" onClick={() => router.push(`/actions/${encodeURIComponent(action.id)}/report`)}><FileText className="size-4" />View Report</Button>}</> : undefined}</>} />
    <LifecycleTimeline action={action} />

    <Card className="min-w-0 gap-0 overflow-hidden"><CardContent className={cn("grid grid-cols-2 gap-px bg-border/70 p-0 sm:grid-cols-2 sm:p-0 lg:grid-cols-4", action.status === "Completed" ? "xl:grid-cols-7" : "xl:grid-cols-8")}><HeaderMeta label="Status"><Badge variant={ACTION_STATUS_CONFIG[action.status].variant}>{ACTION_STATUS_CONFIG[action.status].label}</Badge></HeaderMeta><HeaderMeta label="Priority"><Badge variant={ACTION_PRIORITY_CONFIG[action.priority].variant}>{action.priority}</Badge></HeaderMeta>{action.status !== "Completed" && <HeaderMeta label="Attention"><div className="flex min-w-0 flex-col items-start gap-2"><Badge variant={dueDays < 0 ? "danger" : dueDays <= 1 ? "warning" : "info"} className="max-w-full whitespace-normal text-left">{urgencyLabel}</Badge>{activeEscalation && <><Badge variant="danger" className="max-w-full whitespace-normal text-left">Escalated · Level {activeEscalation.level}</Badge><p className="text-xs font-normal text-muted-foreground">{activeEscalation.toUserName} · {formatDateTime(activeEscalation.createdAt)}</p></>}{activeEscalation?.status === "Open" && activeEscalation.toUserId === actor.id && <Button className="h-auto whitespace-normal text-left" size="sm" variant="outline" onClick={() => acknowledgeActionEscalation(activeEscalation.id, actorWithAuthority)}>Acknowledge escalation</Button>}</div></HeaderMeta>}<HeaderMeta label="Due Date"><span className={cn(isActionOverdue(action) && "text-red-600 dark:text-red-400")}>{formatShortDate(action.dueDate)}</span></HeaderMeta><HeaderMeta label="Action Owner">{action.responsiblePersonName ?? action.assignedTo ?? "Unassigned"}</HeaderMeta><HeaderMeta label="Zone Leader">{action.zoneLeaderName ?? "—"}</HeaderMeta><HeaderMeta label="Assigned By">{action.assignedByName ?? action.createdByName ?? action.auditor ?? "—"}</HeaderMeta><HeaderMeta label="Source"><span className="inline-flex items-center gap-1.5"><SourceIcon className="size-3.5 text-muted-foreground" />{source.label}</span></HeaderMeta></CardContent></Card>



    {canAssign && <Panel title="Assign Action Owner" icon={<ClipboardCheck className="size-4 text-primary" />}><p className="text-sm text-muted-foreground">Assign this {action.area} Action to the person responsible for completing it.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><OpsPersonSelect people={zoneConfiguration.members} value={assigneeId} onValueChange={setAssigneeId} /><Button disabled={!assigneeId} onClick={() => { const saved = assignActionToZoneMember(action.id, actorWithAuthority, assigneeId); setOwnershipError(saved ? "" : "Assignment could not be saved. Check eligibility and browser storage, then retry."); }}>Assign Action</Button></div></Panel>}
    {canReassign && <div className="flex justify-end"><Button size="sm" variant="outline" onClick={() => { setReassignId(action.responsiblePersonId ?? ""); setReassignOpen(true); }}><UserRound className="size-3.5" />Reassign Action Owner</Button></div>}
    {action.status === "Rework Required" && latestRework && <section aria-label="Rework feedback" className="rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-3 py-2"><div className="flex items-start gap-2"><RotateCcw aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5"><p className="text-sm font-semibold text-amber-900 dark:text-amber-100">Rework Required</p><p className="text-xs text-amber-800/75 dark:text-amber-200/70">{latestRework.actorName} · {formatDateTime(latestRework.createdAt)}</p></div><p className="mt-0.5 whitespace-pre-wrap text-sm leading-5 text-amber-950 dark:text-amber-50 [overflow-wrap:anywhere]">{latestRework.remark}</p></div></div></section>}

    <ActionSummary action={action} />
    <div className="grid min-w-0 gap-5">

    <ActionDetailAccordion id="overview" label="Overview" open={section === "overview"} onToggle={() => setSection(section === "overview" ? null : "overview")}><div className="grid min-w-0 gap-5">
      <CanonicalLinkedRecords currentRecord={{module:"action",recordId:action.id}} /><Panel plain title="Origin" icon={<Link2 className="size-4 text-primary" />}><div className="grid gap-5"><div className="flex min-w-0 items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><SourceIcon className="size-5" /></span><div className="min-w-0"><p className="text-sm font-semibold">{source.label}</p><p className="mt-0.5 break-words text-xs text-muted-foreground">{getActionSourceRecordLabel(action)}</p></div>{sourceHref && <Button nativeButton={false} render={<Link href={sourceHref} />} variant="outline" size="sm" className="ml-auto"><ExternalLink className="size-3.5" />View {source.label}</Button>}</div><div className="grid gap-4 border-t pt-4 sm:grid-cols-2"><Meta label="Source Location" value={action.sourceLocation ?? `${action.plant} · ${action.area}`} icon={<MapPin className="size-3.5" />} /><Meta label="Source Record" value={getActionSourceRecordLabel(action)} icon={<FileText className="size-3.5" />} />{action.visualManagementSource && <Meta label="Performance" value={`${action.visualManagementSource.actualValueSnapshot}${action.visualManagementSource.measurementSnapshot === "percentage" ? "%" : ""} actual · ${action.visualManagementSource.statusSnapshot.toUpperCase()}`} icon={<FileText className="size-3.5" />} />}{action.sourceObservationId && !action.visualManagementSource && <Meta label="Source Observation" value={action.sourceObservationId} icon={<FileText className="size-3.5" />} />}</div><div className="rounded-lg border-l-4 border-amber-500 bg-amber-500/[0.055] px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700 dark:text-amber-400">Observation / Finding</p><p className="mt-2 text-sm font-medium leading-6">{action.sourceObservation ?? action.originalFinding ?? action.description}</p></div></div></Panel>
      <Panel plain title="Resolution Details" icon={<CheckCircle2 className="size-4 text-primary" />}>
        {canUndoActionStart(action, actor) && <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Started by mistake? Return to the pre-start state without losing your details or evidence.</p><Button variant="outline" onClick={undoStart} disabled={Boolean(pendingTransition)}><RotateCcw className="size-4" />Undo Start Work</Button></div>}

        <div className="relative isolate min-w-0"><fieldset disabled={canStart} className={cn("grid min-w-0 gap-4", canStart && "select-none opacity-45 blur-xs")}><Field label="Action Taken / Responsible Notes *" error={overviewAttempted ? overviewErrors.observation : undefined}>{canEdit ? <Textarea ref={notesRef} className={cn("min-h-28", overviewAttempted && overviewErrors.observation && "border-destructive ring-2 ring-destructive/20")} value={observation} onChange={(event) => setObservation(event.target.value)} placeholder="Describe the corrective work completed..." aria-invalid={overviewAttempted && Boolean(overviewErrors.observation)} /> : <ReadOnlyValue value={action.resolutionObservation ?? action.actionTakenDescription ?? "No responsible-person notes submitted."} />}</Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Corrective Action Category *" error={overviewAttempted ? overviewErrors.category : undefined}>{canEdit ? <Select searchLabel={"Corrective Action Category"} value={category} onValueChange={(value) => setCategory(value ?? "")}><SelectTrigger ref={categoryRef} className={cn("w-full", overviewAttempted && overviewErrors.category && "border-destructive ring-2 ring-destructive/20")} aria-invalid={overviewAttempted && Boolean(overviewErrors.category)}><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{FIVE_S_CORRECTIVE_ACTION_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select> : <ReadOnlyValue value={action.correctiveActionCategory ?? "—"} />}</Field><Field label="Actual Cost Saving *" error={overviewAttempted ? overviewErrors.costSaving : undefined}>{canEdit ? <div className="relative"><IndianRupee className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input ref={costSavingRef} className={cn("pl-8", overviewAttempted && overviewErrors.costSaving && "border-destructive ring-2 ring-destructive/20")} type="number" min="0" step="0.01" value={costSaving} onChange={(event) => setCostSaving(event.target.value)} aria-invalid={overviewAttempted && Boolean(overviewErrors.costSaving)} /></div> : <ReadOnlyValue value={action.costSaving === undefined ? "Not recorded" : `₹${action.costSaving.toLocaleString("en-IN")}`} />}</Field></div></fieldset>{canStart && <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/50 p-4"><div className="flex max-w-sm flex-col items-center gap-3 text-center"><div><p className="text-sm font-semibold">Ready to begin corrective work?</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Start work to enable resolution details and evidence.</p></div><Button onClick={startWork} disabled={pendingTransition === "start"}><Play className="size-4" />{pendingTransition === "start" ? "Starting..." : "Start Action"}</Button></div></div>}</div>
      </Panel>
    </div></ActionDetailAccordion>

    <ActionDetailAccordion id="evidence" label="Evidence" open={section === "evidence"} onToggle={() => setSection(section === "evidence" ? null : "evidence")}><div className="grid min-w-0 gap-5 xl:grid-cols-3"><EvidencePanel tone="before" title="Initial Evidence" description={beforeEvidenceDescription} evidence={sourceBeforeEvidence} onPreview={setPreview} /><OpsCameraCapture fileNamePrefix="action-progress" onCapture={(file) => addEvidenceFile(file, "progress")} trigger={(openCamera) => <EvidencePanel tone="progress" title="Progress Evidence" description="Optional evidence captured while corrective work is underway." evidence={action.progressEvidence ?? []} editable={canEdit && !canStart} onUpload={() => progressInputRef.current?.click()} onTakePhoto={openCamera} onPreview={setPreview} onRemove={(id) => removeActionProgressEvidence(action.id, id, actor)} />} /><div ref={completionSectionRef} tabIndex={-1} className={cn("rounded-xl outline-none", evidenceAttempted && !action.evidence.length && "ring-2 ring-destructive/30")}><OpsCameraCapture fileNamePrefix="action-completion" onCapture={(file) => addEvidenceFile(file, "completion")} trigger={(openCamera) => <EvidencePanel tone="completion" title="Completion Evidence" description="Evidence supporting completion and reviewer verification." evidence={action.evidence} editable={canEdit && !canStart} required error={evidenceAttempted && !action.evidence.length ? "Add completion evidence before continuing to Review." : undefined} onUpload={() => completionInputRef.current?.click()} onTakePhoto={openCamera} onPreview={setPreview} onRemove={(id) => removeActionEvidence(action.id, id, actor)} />} /></div><input ref={progressInputRef} hidden type="file" accept="image/*,.pdf,.doc,.docx" onChange={(event) => void addEvidence(event, "progress")} /><input ref={completionInputRef} hidden type="file" accept="image/*,.pdf,.doc,.docx" onChange={(event) => void addEvidence(event, "completion")} /></div></ActionDetailAccordion>
    <ActionDetailAccordion id="review" label="Review" open={section === "review"} onToggle={() => setSection(section === "review" ? null : "review")}><div className="grid min-w-0 gap-5"><Panel plain title="Review Package" icon={<ClipboardCheck className="size-4 text-primary" />}><div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Meta label="Source" value={`${source.label} · ${getActionSourceRecordLabel(action)}`} /><Meta label="Action Owner" value={action.responsiblePersonName ?? action.assignedTo} /><Meta label="Original Issue" value={action.sourceObservation ?? action.originalFinding ?? action.description} /><Meta label="Action Owner's Notes" value={observation || action.resolutionObservation || action.actionTakenDescription || "Not submitted"} /><Meta label="Action Type" value={getActionTypeLabel(action.actionType)} /><Meta label="Corrective Category" value={category || action.correctiveActionCategory || "Not submitted"} /><Meta label="Cost Saving" value={`₹${(Number(costSaving) || action.costSaving || 0).toLocaleString("en-IN")}`} /></div><div className="grid gap-5 border-t pt-4 sm:grid-cols-3"><EvidencePanel tone="before" title="Initial Evidence" description={beforeEvidenceDescription} evidence={sourceBeforeEvidence} compact onPreview={setPreview} /><EvidencePanel tone="progress" title="Progress Evidence" description="Optional work-in-progress evidence" evidence={action.progressEvidence ?? []} compact onPreview={setPreview} /><EvidencePanel tone="completion" title="Completion Evidence" description="Submitted resolution evidence" evidence={action.evidence} compact onPreview={setPreview} /></div></div></Panel>
      {canReview ? <Panel plain title="Review Decision"><p className="text-sm leading-6 text-muted-foreground">Verify the original finding, Action Owner’s notes, and completion evidence before deciding.</p><div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="outline" onClick={() => setSendBackOpen(true)}><RotateCcw className="size-4" />Send Back</Button><Button onClick={() => setCloseOpen(true)}><CheckCircle2 className="size-4" />Verify & Close</Button></div></Panel> : canEdit ? null : <Panel plain title="Review Status"><p className="text-sm text-muted-foreground">{action.status === "Completed" ? `Closed by ${action.closedBy ?? action.reviewedBy ?? action.auditor ?? "reviewer"} on ${formatShortDate(action.closedAt ?? action.completedAt ?? action.reviewedAt ?? action.createdAt)}.` : action.submittedForReviewAt ? `Awaiting review by ${action.reviewerName ?? action.createdByName ?? action.auditor ?? "the assigned reviewer"}.` : "This action has not been submitted for review."}</p></Panel>}
    </div></ActionDetailAccordion>
    </div>
    {section === "overview" && (canEdit ? <PageFormActionBar primaryLabel={"Next: Evidence"} primaryAction={() => navigateToStep("evidence")} secondaryLabel="Save Progress" secondaryAction={saveProgress} validationSummary={overviewAttempted && Object.values(overviewErrors).some(Boolean) ? "Complete the required Overview information before continuing." : undefined} /> : <div className="sticky bottom-3 z-40 mt-8 flex justify-end rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur"><Button onClick={() => navigateToStep("evidence")}>Next: Evidence</Button></div>)}
    {section === "evidence" && canEdit && <PageFormActionBar primaryLabel="Submit" submittingLabel="Submitting..." primaryAction={submitForReview} isSubmitting={pendingTransition === "submit"} primaryDisabled={canStart} validationSummary={!validResolution && (overviewAttempted || evidenceAttempted) ? "Complete the highlighted execution requirements before submitting." : undefined} />}
    {section === "review" && canEdit && <PageFormActionBar primaryLabel={action.status === "Rework Required" ? "Resubmit for Review" : "Submit for Review"} submittingLabel="Submitting..." primaryAction={submitForReview} secondaryLabel="Back: Evidence" secondaryAction={() => navigateToStep("evidence")} isSubmitting={pendingTransition === "submit"} primaryDisabled={canStart} validationSummary={!validResolution && (overviewAttempted || evidenceAttempted) ? "Complete the highlighted execution requirements before submitting." : undefined} />}

    <div className="mt-6"><ActionSubmissionHistory action={action} beforeEvidence={resolvedBeforeEvidence} /></div>
    <Dialog open={startDialogOpen} onOpenChange={setStartDialogOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Start Action</DialogTitle><DialogDescription>Choose exactly one Action Type. Category, cost and review requirements remain unchanged.</DialogDescription></DialogHeader><fieldset className="grid gap-3"><legend className="mb-3 text-sm font-medium">Action Type *</legend>{([{value:"immediate",label:"Immediate Action",hint:"Work requiring an immediate response."},{value:"corrective",label:"Corrective Action",hint:"Work addressing the underlying issue."}] as const).map(option=><label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"><input type="radio" aria-label={option.label} name="action-type" value={option.value} checked={selectedActionType===option.value} onChange={()=>{setSelectedActionType(option.value);setStartError("");}} className="mt-1" /><span className="min-w-0 text-sm"><span className="block font-medium">{option.label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.hint}</span></span></label>)}</fieldset>{startError && <p role="alert" className="text-sm text-destructive">{startError}</p>}<DialogFooter><Button variant="outline" onClick={()=>setStartDialogOpen(false)}>Cancel</Button><Button onClick={confirmStartWork} disabled={!selectedActionType || pendingTransition==="start"}>Confirm &amp; Start</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={sendBackOpen} onOpenChange={setSendBackOpen}><DialogContent><DialogHeader><DialogTitle>Send Action Back</DialogTitle><DialogDescription>Explain what the responsible person needs to correct before resubmitting.</DialogDescription></DialogHeader><Field label="Remark *"><Textarea className="min-h-28" value={remark} onChange={(event) => setRemark(event.target.value)} placeholder="Explain what needs correction..." /></Field><DialogFooter><Button variant="outline" onClick={() => setSendBackOpen(false)}>Cancel</Button><Button variant="destructive" disabled={!remark.trim() || pendingTransition === "send-back"} onClick={confirmSendBack}>{pendingTransition === "send-back" ? "Sending Back..." : "Send Back"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={dueDateOpen} onOpenChange={setDueDateOpen}><DialogContent><DialogHeader><DialogTitle>Edit Due Date</DialogTitle><DialogDescription>Current due date: {formatShortDate(action.dueDate)}. Record a reason for this override.</DialogDescription></DialogHeader><Field label="New Due Date *"><Input type="date" value={newDueDate} onChange={event => setNewDueDate(event.target.value)} /></Field><Field label="Reason *"><Textarea value={dueDateReason} onChange={event => setDueDateReason(event.target.value)} placeholder="Why does the due date need to change?" /></Field>{dueDateError && <p role="alert" className="text-sm text-destructive">{dueDateError}</p>}<DialogFooter><Button variant="outline" onClick={() => setDueDateOpen(false)}>Cancel</Button><Button onClick={() => { const error = validateActionDueDate(newDueDate) || (!dueDateReason.trim() ? "Enter a reason for changing the due date." : newDueDate === action.dueDate ? "Select a different due date." : ""); if (error) { setDueDateError(error); return; } if (changeActionDueDate(action.id, actorWithAuthority, newDueDate, dueDateReason)) setDueDateOpen(false); else setDueDateError("The due date could not be saved. Check your permission and browser storage, then retry."); }}>Save Due Date</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={closeOpen} onOpenChange={setCloseOpen}><DialogContent><DialogHeader><DialogTitle>Verify and close this Action?</DialogTitle><DialogDescription>The submitted resolution will be accepted and this Action will be marked as closed.</DialogDescription></DialogHeader><p className="text-sm text-muted-foreground">Reviewing as {actor.name}.</p>{reviewError && <p role="alert" className="text-sm text-destructive">{reviewError}</p>}<Field label="Closure remark (optional)"><Textarea className="min-h-24" value={closureRemark} onChange={(event) => setClosureRemark(event.target.value)} placeholder="Add verification or closure context..." /></Field><DialogFooter><Button variant="outline" onClick={() => setCloseOpen(false)}>Cancel</Button><Button onClick={confirmClose} disabled={pendingTransition === "close"}>{pendingTransition === "close" ? "Closing..." : "Verify & Close"}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={reassignOpen} onOpenChange={setReassignOpen}><DialogContent><DialogHeader><DialogTitle>Reassign Action Owner</DialogTitle><DialogDescription>Current owner: {action.responsiblePersonName ?? action.assignedTo ?? "Unassigned"}. Select a new owner and record why responsibility changed.</DialogDescription></DialogHeader><Field label="New Action Owner *"><OpsPersonSelect people={(zoneConfiguration?.members ?? []).filter(member => member.id !== action.responsiblePersonId)} value={reassignId} onValueChange={setReassignId} /></Field>{ownershipError && <p role="alert" className="text-sm text-destructive">{ownershipError}</p>}<Field label="Reason *"><Textarea className="min-h-24" value={reassignReason} onChange={(event) => setReassignReason(event.target.value)} placeholder="Why is this Action being reassigned?" /></Field><DialogFooter><Button variant="outline" onClick={() => setReassignOpen(false)}>Cancel</Button><Button disabled={!reassignId || !reassignReason.trim() || reassignId === action.responsiblePersonId} onClick={() => { const updated = reassignActionOwner(action.id, actorWithAuthority, reassignId, reassignReason); if (updated) { setOwnershipError(""); setReassignOpen(false); setReassignReason(""); } else { setOwnershipError("Reassignment could not be saved. Check eligibility and browser storage, then retry."); } }}>Reassign</Button></DialogFooter></DialogContent></Dialog>

    {preview && <EvidencePreview evidence={preview} previewRef={previewRef} onClose={() => setPreview(null)} />}
  </PageContainer>;
}

function LifecycleTimeline({ action }: { action: MyAction }) {
  const hasRework = action.status === "Rework Required" || [...(action.reviewHistory ?? []), ...(action.activityHistory ?? [])].some((event) => event.type === "sent_back");
  const stages = ACTION_LIFECYCLE_STAGES.filter((stage) => stage !== "Rework" || hasRework);
  const currentIndex = stages.indexOf(getActionLifecycleStage(action.status));
  const events = [...(action.activityHistory ?? []), ...(action.reviewHistory ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return <OpsDetailSection title="Workflow"><ol aria-label="Action lifecycle" className={cn("grid grid-cols-2 gap-3", stages.length === 6 ? "sm:grid-cols-3 lg:grid-cols-6" : "sm:grid-cols-5")}>{stages.map((label, index) => {
    const complete = action.status === "Completed" || index < currentIndex;
    const current = !complete && index === currentIndex;
    const state = complete ? "completed" : current ? "current" : "pending";
    const event = events.find(event => label === "Assigned" ? ["assigned", "reassigned"].includes(event.type) : label === "In Progress" ? event.type === "started" : label === "Submitted for Review" ? ["submitted", "resubmitted"].includes(event.type) : label === "Under Review" ? event.type === "reviewed" : label === "Rework" ? event.type === "sent_back" : ["closed", "verified"].includes(event.type));
    const at = event?.createdAt ?? (label === "Assigned" ? action.assignedAt : label === "Submitted for Review" ? action.submittedForReviewAt : label === "Under Review" ? action.reviewedAt : label === "Closed" ? action.closedAt ?? action.completedAt : undefined);
    const actor = event?.actorName ?? (label === "Assigned" ? action.assignedByName : label === "Submitted for Review" ? action.completedByName : label === "Under Review" ? action.reviewedBy : label === "Closed" ? action.closedBy ?? action.reviewedBy : undefined);
    return <li key={label} aria-current={current ? "step" : undefined} data-state={state} className="flex min-w-0 items-start gap-2"><span aria-hidden="true" className={cn("grid size-7 shrink-0 place-items-center rounded-full border", complete ? "border-emerald-600 bg-emerald-600 text-white" : current ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground")}>{complete ? <Check className="size-4" /> : <Circle className="size-3 fill-current" />}</span><span className="min-w-0 break-words text-xs font-semibold">{label}<span className="mt-1 block font-normal text-muted-foreground">{state}</span>{(complete || current) && <>{actor && <span className="mt-1 block font-normal text-muted-foreground">{actor}</span>}{at && <time dateTime={at} className="mt-1 block font-normal text-muted-foreground">{formatDateTime(at)}</time>}</>}</span></li>;
  })}</ol></OpsDetailSection>;
}

function ActionDetailAccordion({ id, label, open, onToggle, children }: { id: DetailSection; label: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return <section className="min-w-0 rounded-xl border bg-card shadow-sm" aria-labelledby={`action-section-${id}`}><h2><button type="button" id={`action-section-${id}`} aria-expanded={open} aria-controls={`action-section-${id}-content`} onClick={onToggle} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-5 py-4 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"><span>{label}</span><ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} /></button></h2><div id={`action-section-${id}-content`} hidden={!open} className="min-w-0 border-t p-5">{children}</div></section>;
}

function ActionSummary({ action }: { action: MyAction }) {
  return <details className="group min-w-0 rounded-xl border bg-card shadow-sm"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-5 py-4 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">Action Summary<ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary><div className="grid gap-4 border-t p-5 sm:grid-cols-2 xl:grid-cols-4"><Meta label="Action Title" value={action.title} /><Meta label="Action ID" value={action.id} /><Meta label="Description" value={action.description} /><Meta label="Action Category" value={action.actionCategory ?? "—"} /><Meta label="Action Type" value={getActionTypeLabel(action.actionType)} /><Meta label="Plant" value={action.plant} icon={<Building2 className="size-3.5" />} /><Meta label="Zone" value={action.area} icon={<MapPin className="size-3.5" />} /><Meta label="Department" value={action.department} /><Meta label="Action Owner" value={action.responsiblePersonName ?? action.assignedTo ?? "Unassigned"} icon={<UserRound className="size-3.5" />} /><Meta label="Zone Leader" value={action.zoneLeaderName ?? "—"} /><Meta label="Assigned By" value={action.assignedByName ?? action.createdByName ?? action.auditor ?? "—"} /><Meta label="Due Date" value={formatShortDate(action.dueDate)} icon={<CalendarDays className="size-3.5" />} /><Meta label="Created By" value={action.createdByName ?? action.auditor ?? "—"} /><Meta label="Created Date" value={formatDateTime(action.createdAt)} />{action.costSaving !== undefined && <Meta label="Cost Saving" value={formatOpsMoney(action.costSaving, "Not recorded")} />}</div></details>;
}

function EvidencePanel({ tone, title, description, evidence, editable = false, required = false, compact = false, error, onUpload, onTakePhoto, onPreview, onRemove = () => undefined }: { tone: "before" | "progress" | "completion"; title: string; description: string; evidence: MyActionEvidence[]; editable?: boolean; required?: boolean; compact?: boolean; error?: string; onUpload?: () => void; onTakePhoto?: () => void; onPreview: (item: MyActionEvidence) => void; onRemove?: (id: string) => void }) {
  const tones = { before: "bg-red-500", progress: "bg-amber-500", completion: "bg-emerald-500" };
  return <section className={cn("grid min-w-0 content-start gap-4", error && "rounded-lg ring-2 ring-destructive/30")}><div><div className="flex flex-col gap-3"><div><div className="flex items-center gap-2"><span className={cn("size-2 rounded-full", tones[tone])} /><h3 className="text-sm font-semibold">{title}{required && <span className="text-destructive"> *</span>}</h3></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>{error && <p role="alert" className="mt-2 text-xs font-medium text-destructive">{error}</p>}</div>{editable && <div className="grid grid-cols-2 gap-2">{onTakePhoto && <Button size="sm" variant="outline" onClick={onTakePhoto}><Camera className="size-3.5" />Take Photo</Button>}{onUpload && <Button size="sm" variant="outline" onClick={onUpload}><Upload className="size-3.5" />Upload Photo</Button>}</div>}</div></div><div className="min-w-0"><EvidenceGrid evidence={evidence} editable={editable} compact={compact} onPreview={onPreview} onRemove={onRemove} emptyLabel={`No ${title.toLowerCase()} attached`} /></div></section>;
}
function EvidenceGrid({ evidence, editable, compact, onPreview, onRemove, emptyLabel }: { evidence: MyActionEvidence[]; editable: boolean; compact: boolean; onPreview: (item: MyActionEvidence) => void; onRemove: (id: string) => void; emptyLabel: string }) {
  if (!evidence.length) return <div className="grid min-h-24 place-items-center rounded-lg border border-dashed bg-muted/15 text-center"><div><Paperclip className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-xs text-muted-foreground">{emptyLabel}</p></div></div>;
  return <div className={cn("grid gap-2", !compact && "sm:grid-cols-2 xl:grid-cols-1")}>{evidence.map((item) => <EvidenceGridItem key={item.id} item={item} editable={editable} onPreview={onPreview} onRemove={onRemove} />)}</div>;
}
function EvidenceGridItem({ item, editable, onPreview, onRemove }: { item: MyActionEvidence; editable: boolean; onPreview: (item: MyActionEvidence) => void; onRemove: (id: string) => void }) {
  const url = useActionEvidenceUrl(item);
  const resolved = url && url !== item.url ? { ...item, url } : item;
  return <div className="group flex min-w-0 items-center gap-3 rounded-lg border bg-background p-2.5"><button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => onPreview(resolved)}><span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">{item.type === "image" && url ? <img src={url} alt="" className="size-full object-cover" /> : <FileText className="size-5 text-muted-foreground" />}</span><span className="min-w-0"><span className="block truncate text-xs font-medium">{item.name}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{item.uploadedBy}</span><span className="block text-[10px] text-muted-foreground">{formatDateTime(item.uploadedAt)}</span></span></button>{editable && <Button variant="ghost" size="icon-sm" onClick={() => onRemove(item.id)} aria-label={`Remove ${item.name}`}><X className="size-4" /></Button>}</div>;
}
function EvidencePreview({ evidence, previewRef, onClose }: { evidence: MyActionEvidence; previewRef: React.RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const url = useActionEvidenceUrl(evidence);
  return <div className="fixed inset-0 z-[10020] flex flex-col bg-slate-950/95" role="dialog" aria-modal="true" aria-label={`Preview ${evidence.name}`}><div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white"><div className="min-w-0"><p className="truncate text-sm font-medium">{evidence.name}</p><p className="text-xs text-slate-400">Uploaded by {evidence.uploadedBy} · {formatDateTime(evidence.uploadedAt)}</p></div><div className="flex gap-1"><Button variant="ghost" size="icon-sm" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => void previewRef.current?.requestFullscreen?.()} aria-label="Full screen"><Maximize2 className="size-4" /></Button>{url && <Button nativeButton={false} render={<a href={url} target="_blank" rel="noreferrer" />} variant="ghost" size="icon-sm" className="text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Open original"><ExternalLink className="size-4" /></Button>}<Button variant="ghost" size="icon-sm" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close preview"><X className="size-4" /></Button></div></div><div ref={previewRef} className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-5">{evidence.type === "image" && url ? <img src={url} alt={evidence.name} className="max-h-full max-w-full object-contain" /> : <div className="rounded-xl border border-white/10 bg-slate-900 p-10 text-center text-white"><FileText className="mx-auto size-10 text-slate-400" /><p className="mt-4 text-sm">Preview unavailable for this file type.</p></div>}</div></div>;
}
function Panel({ title, icon, children, plain = false }: { title: string; icon?: React.ReactNode; children: React.ReactNode; plain?: boolean }) {
  if (plain) return <section className="grid min-w-0 gap-4 [&+section]:border-t [&+section]:pt-5"><h3 className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</h3><div className="min-w-0">{children}</div></section>;
  return <Card className="min-w-0 gap-0"><CardHeader className="border-b bg-muted/15 py-3"><CardTitle className="flex items-center gap-2 text-sm">{icon}{title}</CardTitle></CardHeader><CardContent className="pt-4">{children}</CardContent></Card>;
}

function HeaderMeta({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex min-w-0 flex-col justify-center bg-card px-4 py-3.5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p><div className="mt-1.5 min-w-0 break-words text-sm font-medium">{children}</div></div>; }
function Meta({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) { return <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p><p className="mt-1 flex items-start gap-1.5 break-words text-xs font-medium leading-5">{icon}<span className="min-w-0 [overflow-wrap:anywhere]">{value || "—"}</span></p></div>; }
function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}{error && <span role="alert" className="text-xs font-medium text-destructive">{error}</span>}</label>; }
function ReadOnlyValue({ value }: { value: string }) { return <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-sm leading-6">{value}</div>; }
function formatDateTime(value: string) { return value.includes("T") ? formatOpsDateTime(value) : formatOpsDate(value); }

function ReassignmentBadge({message}:{message:string}) {
  const [open,setOpen]=useState(false);
  return <Tooltip open={open} onOpenChange={setOpen}><TooltipTrigger type="button" aria-label="Re-assigned" closeOnClick={false} onClick={()=>setOpen(true)} className={cn(badgeVariants({variant:"info"}),"min-h-8 cursor-help outline-none focus-visible:ring-2 focus-visible:ring-ring")}>Re-assigned</TooltipTrigger><TooltipContent className="whitespace-normal leading-5 [overflow-wrap:anywhere]">{message}</TooltipContent></Tooltip>;
}
