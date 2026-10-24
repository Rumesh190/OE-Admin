"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { CanonicalLinkedRecords } from "@/components/ops/ops-linked-records";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { ActionLink } from "@/components/ops/ops-return-link";

import { useState } from "react";
import Link from "@/components/ops/ops-record-link";
import { ArrowLeft, CheckCircle2, FilePenLine, FileText, Link2, PauseCircle, Play, Plus, RotateCcw, Save, Send, XCircle } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { CreateLinkedActionDialog, type LinkedActionContext } from "@/features/actions/create-linked-action-dialog";
import { useActionStore } from "@/lib/actions/action-store";
import { getActionUpdatedAt } from "@/lib/actions/action-config";
import { useCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";
import { canCompleteReview, canCreateImprovementAction, canEditProposal, canImplementImprovement, canReviewProposal, canViewImprovement } from "./access";
import { formatImprovementDate, formatImprovementMoney, ImprovementBeforeAfter, ImprovementEvidencePicker, ImprovementStatusBadge, ImprovementTabs, ImprovementTimeline, ParticipantList } from "./components";
import { completeImprovementReview, linkImprovementAction, resumeImprovementReview, returnImprovementCompletion, reviewImprovement, saveImprovementImplementation, startImprovement, startImprovementReview, submitImprovementCompletion, useImprovements } from "./store";
import type { ContinuousImprovement, ImprovementEvidence } from "./types";
import { RelatedOperationalRecords } from "./related-operational-records";

type DetailTab = "proposal" | "implementation" | "actions" | "evidence" | "benefits" | "activity" | "review";
const DETAIL_TABS: DetailTab[] = ["proposal", "implementation", "actions", "evidence", "benefits", "activity", "review"];

export default function ContinuousImprovementDetailPage({ improvementId, initialTab }: { improvementId: string; initialTab?: string }) {
  const currentUser = useCurrentUser();
  const adminUsers = useAdminUsers();
  const adminUser = adminUsers.find((user) => user.id === currentUser.id);
  const item = useImprovements().find((record) => record.id === improvementId);
  const url = useUrlState();
  const requestedTab = url.params.get("tab") ?? initialTab;
  const activeTab: DetailTab = DETAIL_TABS.includes(requestedTab as DetailTab) ? requestedTab as DetailTab : "proposal";
  const setActiveTab = (tab: DetailTab) => url.update({tab});
  const [notice, setNotice] = useState("");

  if (!item || !canViewImprovement(adminUser, currentUser, item)) return <PageContainer><FiveSPageHeader eyebrow="Continual Improvement" title="Improvement not found" description="The requested improvement is unavailable or outside your permitted scope." leading={<Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/continuous-improvement" />}><ArrowLeft className="size-4" /></Button>} /></PageContainer>;

  const mayEdit = canEditProposal(adminUser, currentUser, item);
  const mayReview = canReviewProposal(adminUser, currentUser, item);
  const mayImplement = canImplementImprovement(adminUser, currentUser, item);
  const mayCompleteReview = canCompleteReview(adminUser, currentUser, item);
  const mayCreateAction = canCreateImprovementAction(adminUser, currentUser, item);
  const reviewCount = ["submitted", "under_review", "on_hold", "awaiting_completion_review"].includes(item.status) ? 1 : 0;
  const tabs = [
    { id: "proposal", label: "Proposal" }, { id: "implementation", label: "Implementation" }, { id: "actions", label: "Actions", count: item.actionIds.length }, { id: "evidence", label: "Evidence", count: item.beforeEvidence.length + item.afterEvidence.length }, { id: "benefits", label: "Benefits" }, { id: "activity", label: "Activity", count: item.timeline.length }, { id: "review", label: "Review", count: reviewCount },
  ];

  function run(action: () => unknown, successMessage: string, tab?: DetailTab) {
    setNotice("");
    try { action(); setNotice(successMessage); if (tab) setActiveTab(tab); }
    catch (reason) { setNotice(reason instanceof Error ? reason.message : "Unable to update this improvement."); }
  }

  const headerActions = <><RecordDeletionMenu module="continuousImprovement" recordId={item.id} returnTo="/continuous-improvement" />
    {mayEdit && <Button variant="outline" nativeButton={false} render={<Link href={`/continuous-improvement/${encodeURIComponent(item.id)}/edit`} />}><FilePenLine className="size-4" />Edit</Button>}
    {item.status === "approved" && mayImplement && <Button onClick={() => run(() => startImprovement(item.id, currentUser), "Implementation started.", "implementation")}><Play className="size-4" />Start Implementation</Button>}
    {item.status === "submitted" && mayReview && <Button onClick={() => run(() => startImprovementReview(item.id, currentUser), "Review started.", "review")}>Review Proposal</Button>}
    {item.status === "completed" && <Button nativeButton={false} render={<Link href={`/continuous-improvement/${encodeURIComponent(item.id)}/report`} />}><FileText className="size-4" />Report</Button>}
  </>;

  return <PageContainer className="max-w-none">
    <FiveSPageHeader eyebrow="Continual Improvement" title={item.title} description={`${item.id} · ${item.plant} · ${item.zone}`} leading={<Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/continuous-improvement" />} aria-label="Back"><ArrowLeft className="size-4" /></Button>} actions={headerActions} />
    <div className="flex flex-wrap items-center gap-2"><ImprovementStatusBadge status={item.status} /><Badge variant="secondary">{item.benefitType}</Badge><span className="text-xs text-muted-foreground">Owner: {item.ownerName}</span><span className="text-xs text-muted-foreground">Updated {formatImprovementDate(item.updatedAt, true)}</span></div>
    <CanonicalLinkedRecords currentRecord={{module:"continuousImprovement",recordId:item.id}} />
    {item.status === "completed" && <section aria-label="Completed improvement summary" className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_200px_200px_220px]"><div className="p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 dark:text-emerald-400">Completed Improvement</p><p className="mt-2 text-sm font-medium">{item.actualBenefit || item.expectedBenefit}</p><p className="mt-1 text-xs text-muted-foreground">Reviewed by {item.completionReviewedByName ?? item.completedByName ?? item.zoneLeaderName}</p></div><div className="border-t p-4 sm:border-l xl:border-t-0"><p className="text-xs text-muted-foreground">Actual Completion</p><p className="mt-1 text-sm font-semibold">{item.completedAt ? formatImprovementDate(item.completedAt, true) : "Not recorded"}</p></div><div className="border-t p-4 sm:border-l xl:border-t-0"><p className="text-xs text-muted-foreground">Proposed Saving</p><p className="mt-1 text-xl font-semibold">{formatImprovementMoney(item.proposedSaving)}</p></div><div className="border-t p-4 sm:border-l xl:border-t-0"><p className="text-xs text-muted-foreground">Actual Saving</p><p className="mt-1 text-xl font-semibold text-emerald-700 dark:text-emerald-400">{formatImprovementMoney(item.actualSaving)}</p></div></section>}
    {notice && <div role="status" className={cn("rounded-lg border px-4 py-3 text-sm", notice.toLowerCase().includes("not") || notice.toLowerCase().includes("required") || notice.toLowerCase().includes("unable") ? "border-destructive/20 bg-destructive/[0.06] text-destructive" : "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-700 dark:text-emerald-400")}>{notice}</div>}
    <ImprovementTabs tabs={tabs} active={activeTab} onChange={(id) => setActiveTab(id as DetailTab)} />
    {activeTab === "proposal" && <><ProposalTab item={item} /><RelatedOperationalRecords improvementId={item.id} editable={mayEdit} /></>}
    {activeTab === "implementation" && <ImplementationTab item={item} mayImplement={mayImplement} currentUserName={currentUser.name} onNotice={setNotice} />}
    {activeTab === "actions" && <ActionsTab item={item} mayCreate={mayCreateAction} />}
    {activeTab === "evidence" && <Card><CardContent className="p-4 sm:p-5"><ImprovementBeforeAfter item={item} /></CardContent></Card>}
    {activeTab === "benefits" && <BenefitsTab item={item} />}
    {activeTab === "activity" && <Card><CardHeader><CardTitle className="text-base">Activity Timeline</CardTitle></CardHeader><CardContent><ImprovementTimeline activity={item.timeline} /></CardContent></Card>}
    {activeTab === "review" && <ReviewTab item={item} mayReview={mayReview} mayCompleteReview={mayCompleteReview} run={run} />}
  </PageContainer>;
}

function ProposalTab({ item }: { item: ContinuousImprovement }) {
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,.7fr)]"><div className="grid gap-4"><Story eyebrow="Current State" title="Problem / Opportunity"><p>{item.issueDescription}</p></Story><Story eyebrow="Proposed Improvement" title="What should change"><p>{item.proposedImprovement}</p></Story><Story eyebrow="Expected Benefit" title="Expected outcome"><p>{item.expectedBenefit}</p></Story></div><div className="grid min-w-0 content-start gap-4"><Card><CardHeader><CardTitle className="text-base">Proposal Details</CardTitle></CardHeader><CardContent><dl className="grid gap-4"><Meta label="Plant / Zone" value={`${item.plant} / ${item.zone}`} /><Meta label="Proposed By" value={item.proposedByName} /><Meta label="Owner" value={item.ownerName} /><Meta label="Reviewer" value={item.reviewerName ?? item.zoneLeaderName} /><Meta label="Estimated Completion" value={`${item.estimatedTime} ${item.estimatedTimeUnit}`} /><Meta label="Proposed Saving" value={formatImprovementMoney(item.proposedSaving)} /></dl></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Participants</CardTitle></CardHeader><CardContent><ParticipantList participants={item.participants} /></CardContent></Card>{item.reviewDecision && <DecisionSummary item={item} />}</div></div>;
}

function ImplementationTab({ item, mayImplement, currentUserName, onNotice }: { item: ContinuousImprovement; mayImplement: boolean; currentUserName: string; onNotice: (message: string) => void }) {
  if (["draft", "submitted", "under_review", "on_hold", "rejected"].includes(item.status)) return <Card><CardContent className="grid min-h-52 place-items-center p-6 text-center"><div><p className="text-sm font-semibold">Implementation has not started</p><p className="mt-1 text-xs text-muted-foreground">The proposal must be approved before the implementation workspace opens.</p></div></CardContent></Card>;
  if (item.status !== "in_progress" || !mayImplement) return <div className="grid gap-4"><Story eyebrow="Implementation Process" title="How the improvement was implemented"><p>{item.implementationProcess || "No implementation process recorded yet."}</p></Story><Story eyebrow="Action Taken" title="Final workplace change"><p>{item.actionTaken || "No final action recorded yet."}</p>{item.progressNotes && <p className="mt-3 rounded-lg bg-muted/30 p-3 text-xs">Progress: {item.progressNotes}</p>}</Story></div>;
  return <ImplementationEditor key={`${item.id}-${item.updatedAt}`} item={item} currentUserName={currentUserName} onNotice={onNotice} />;
}

function ImplementationEditor({ item, currentUserName, onNotice }: { item: ContinuousImprovement; currentUserName: string; onNotice: (message: string) => void }) {
  const currentUser = useCurrentUser();
  const [process, setProcess] = useState(item.implementationProcess ?? "");
  const [actionTaken, setActionTaken] = useState(item.actionTaken ?? "");
  const [progress, setProgress] = useState(item.progressNotes ?? "");
  const [actualBenefit, setActualBenefit] = useState(item.actualBenefit ?? "");
  const [actualSaving, setActualSaving] = useState(item.actualSaving?.toString() ?? "");
  const [afterEvidence, setAfterEvidence] = useState<ImprovementEvidence[]>(item.afterEvidence);

  function save() {
    try { saveImprovementImplementation(item.id, { implementationProcess: process, actionTaken, progressNotes: progress, actualBenefit, actualSaving: actualSaving === "" ? undefined : Number(actualSaving), afterEvidence }, currentUser); onNotice("Implementation progress saved."); }
    catch (reason) { onNotice(reason instanceof Error ? reason.message : "Unable to save progress."); }
  }
  function submit() {
    try { submitImprovementCompletion(item.id, { implementationProcess: process, actionTaken, progressNotes: progress, actualBenefit, actualSaving: actualSaving === "" ? undefined : Number(actualSaving), afterEvidence }, currentUser); onNotice("Completion package submitted for review."); }
    catch (reason) { onNotice(reason instanceof Error ? reason.message : "Unable to submit completion."); }
  }

  return <div className="grid gap-4 pb-20 sm:pb-0"><Card className="gap-0"><CardHeader className="border-b pb-4"><CardTitle className="text-base">Implementation Process</CardTitle></CardHeader><CardContent className="grid gap-4 p-4 sm:p-5"><Field label="Implementation Process"><Textarea value={process} onChange={(event) => setProcess(event.target.value)} rows={4} placeholder="Describe the implementation method, trials, and checks." /></Field><Field label="Progress Notes"><Textarea value={progress} onChange={(event) => setProgress(event.target.value)} rows={3} placeholder="Add a concise progress update." /></Field><Field label="Final Action Taken"><Textarea value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} rows={4} placeholder="Describe the final workplace change." /></Field></CardContent></Card><Card className="gap-0"><CardHeader className="border-b pb-4"><CardTitle className="text-base">Outcome and Completion Evidence</CardTitle></CardHeader><CardContent className="grid gap-4 p-4 sm:p-5"><Field label="Actual Benefit"><Textarea value={actualBenefit} onChange={(event) => setActualBenefit(event.target.value)} rows={3} placeholder="Describe the measured or observed outcome." /></Field><Field label="Actual Cost Saving (INR)"><Input type="number" min="0" value={actualSaving} onChange={(event) => setActualSaving(event.target.value)} placeholder="Optional for non-financial improvements" /></Field><div><Label className="mb-2 block">Completion Evidence *</Label><ImprovementEvidencePicker items={afterEvidence} onChange={setAfterEvidence} uploadedBy={currentUserName} label="Upload evidence" required /></div></CardContent></Card><div className="hidden justify-end gap-2 sm:flex"><Button variant="outline" onClick={save}><Save className="size-4" />Save Progress</Button><Button onClick={submit}><Send className="size-4" />Submit Completion</Button></div><div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t bg-background/95 p-3 backdrop-blur sm:hidden"><Button variant="outline" className="min-h-11" onClick={save}><Save className="size-4" />Save</Button><Button className="min-h-11" onClick={submit}><Send className="size-4" />Submit</Button></div></div>;
}

function ActionsTab({ item, mayCreate }: { item: ContinuousImprovement; mayCreate: boolean }) {
  const actions = useActionStore();
  const linked = item.actionIds.map((id) => actions.find((action) => action.id === id)).filter(Boolean);
  const [open, setOpen] = useState(false);
  const context: LinkedActionContext = { source: "Continuous Improvement", sourceModule: "continuousImprovement", sourceId: item.id, sourceObservation: item.issueDescription, title: item.title, description: item.proposedImprovement, plant: item.plant, zone: item.zone, location: item.zone, evidence: item.beforeEvidence.map((evidence) => ({ ...evidence, type: "image" as const })) };
  const currentUser = useCurrentUser();
  return <>
    <Card className="gap-0"><CardHeader className="flex-row items-center justify-between border-b pb-4"><div><CardTitle className="text-base">Linked Actions</CardTitle><p className="mt-1 text-xs text-muted-foreground">Follow-up work remains in the shared OPS Action Center.</p></div>{mayCreate && <Button size="sm" onClick={() => setOpen(true)}><Plus className="size-3.5" />Create Action</Button>}</CardHeader><CardContent className="p-0">{linked.length ? <div className="divide-y">{linked.map((action) => action && <ActionLink key={action.id} href={`/actions/${encodeURIComponent(action.id)}`} className="grid gap-2 px-4 py-3 outline-none hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[140px_minmax(0,1fr)_140px_130px_auto] sm:items-center"><span className="font-mono text-xs font-semibold text-primary">{action.id}</span><span className="min-w-0"><span className="block truncate text-sm font-medium">{action.title}</span><span className="block truncate text-[11px] text-muted-foreground">{action.responsiblePersonName ?? action.assignedTo}</span></span><Badge variant={action.status === "Completed" ? "success" : action.status === "Overdue" ? "danger" : "warning"}>{action.status}</Badge><span className="text-xs text-muted-foreground">{formatImprovementDate(getActionUpdatedAt(action))}</span><ArrowLeft className="size-4 rotate-180 text-muted-foreground" /></ActionLink>)}</div> : <div className="grid min-h-44 place-items-center p-6 text-center"><div><Link2 className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-sm font-semibold">No linked Actions</p><p className="mt-1 text-xs text-muted-foreground">Create an Action only when implementation needs separate follow-up ownership.</p></div></div>}</CardContent></Card>
    <CreateLinkedActionDialog open={open} onOpenChange={setOpen} context={context} onCreated={(action) => { linkImprovementAction(item.id, action.id, currentUser); setOpen(false); }} />
  </>;
}

function BenefitsTab({ item }: { item: ContinuousImprovement }) {
  const variance = typeof item.actualSaving === "number" && typeof item.proposedSaving === "number" ? item.actualSaving - item.proposedSaving : undefined;
  return <div className="grid gap-4"><section className="grid gap-3 sm:grid-cols-2"><Card><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground">Proposed Saving</p><p className="mt-2 text-2xl font-semibold">{formatImprovementMoney(item.proposedSaving)}</p><p className="mt-2 text-xs text-muted-foreground">{item.expectedBenefit}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs font-medium text-muted-foreground">Actual Saving</p><p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{formatImprovementMoney(item.actualSaving)}</p><p className="mt-2 text-xs text-muted-foreground">{item.actualBenefit || "Actual outcome will be recorded during completion."}</p></CardContent></Card></section><Card><CardHeader><CardTitle className="text-base">Benefit Realization</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><Meta label="Benefit Type" value={item.benefitType} /><Meta label="Expected Benefit" value={item.expectedBenefit} /><Meta label="Actual Outcome" value={item.actualBenefit || "Pending implementation"} />{typeof variance === "number" && <Meta label="Saving Variance" value={formatImprovementMoney(variance)} />}</CardContent></Card></div>;
}

function ReviewTab({ item, mayReview, mayCompleteReview, run }: { item: ContinuousImprovement; mayReview: boolean; mayCompleteReview: boolean; run: (action: () => unknown, success: string, tab?: DetailTab) => void }) {
  const currentUser = useCurrentUser();
  const [remark, setRemark] = useState("");
  if (item.status === "draft") return <ReviewState title="Draft proposal" description="Submit this proposal before review can begin." />;
  if (item.status === "approved" || item.status === "in_progress") return <DecisionSummary item={item} />;
  if (item.status === "rejected") return <DecisionSummary item={item} />;
  if (item.status === "completed") return <div className="grid gap-4"><ReviewState title="Improvement completed" description={`Completion reviewed by ${item.completionReviewedByName ?? item.completedByName ?? "Reviewer"} on ${formatImprovementDate(item.completedAt)}.`} success />{item.completionReviewRemark && <Story eyebrow="Completion Review" title="Reviewer remarks"><p>{item.completionReviewRemark}</p></Story>}</div>;
  if (item.status === "submitted") return <div className="grid gap-4"><ReviewPackage item={item} completion={false} />{mayReview ? <Button className="w-fit" onClick={() => run(() => startImprovementReview(item.id, currentUser), "Review started.", "review")}>Start Review</Button> : <ReviewState title="Awaiting review" description={`This proposal is assigned to ${item.zoneLeaderName}.`} />}</div>;
  if (item.status === "on_hold") return <div className="grid gap-4"><DecisionSummary item={item} />{mayReview && <Card><CardHeader><CardTitle className="text-base">Continue Decision</CardTitle></CardHeader><CardContent className="grid gap-3"><Field label="Reviewer Remark"><Textarea value={remark} onChange={(event) => setRemark(event.target.value)} rows={3} placeholder="Required when rejecting" /></Field><div className="flex flex-wrap gap-2"><Button onClick={() => run(() => resumeImprovementReview(item.id, currentUser), "Review resumed.")}><RotateCcw className="size-4" />Resume Review</Button><Button variant="destructive" disabled={!remark.trim()} onClick={() => run(() => reviewImprovement(item.id, "rejected", remark, currentUser), "Improvement rejected.")}><XCircle className="size-4" />Reject</Button></div></CardContent></Card>}</div>;
  if (item.status === "awaiting_completion_review") return <div className="grid gap-4"><ReviewPackage item={item} completion />{mayCompleteReview ? <Card><CardHeader><CardTitle className="text-base">Completion Decision</CardTitle></CardHeader><CardContent className="grid gap-3"><Field label="Reviewer Remark"><Textarea value={remark} onChange={(event) => setRemark(event.target.value)} rows={3} placeholder="Required when returning for changes; optional when completing" /></Field><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!remark.trim()} onClick={() => run(() => returnImprovementCompletion(item.id, remark, currentUser), "Returned for changes.", "implementation")}><RotateCcw className="size-4" />Return for Changes</Button><Button onClick={() => run(() => completeImprovementReview(item.id, remark, currentUser), "Improvement completed.")}><CheckCircle2 className="size-4" />Complete Improvement</Button></div></CardContent></Card> : <ReviewState title="Awaiting completion review" description={`The completion package is assigned to ${item.zoneLeaderName}.`} />}</div>;
  return <div className="grid gap-4"><ReviewPackage item={item} completion={false} />{mayReview && <Card><CardHeader><CardTitle className="text-base">Proposal Decision</CardTitle></CardHeader><CardContent className="grid gap-3"><Field label="Reviewer Remark"><Textarea value={remark} onChange={(event) => setRemark(event.target.value)} rows={3} placeholder="Optional for approval; required for rejection or on hold" /></Field><div className="flex flex-wrap gap-2"><Button onClick={() => run(() => reviewImprovement(item.id, "approved", remark, currentUser), "Improvement approved.")}><CheckCircle2 className="size-4" />Approve</Button><Button variant="outline" disabled={!remark.trim()} onClick={() => run(() => reviewImprovement(item.id, "on_hold", remark, currentUser), "Improvement placed on hold.")}><PauseCircle className="size-4" />On Hold</Button><Button variant="destructive" disabled={!remark.trim()} onClick={() => run(() => reviewImprovement(item.id, "rejected", remark, currentUser), "Improvement rejected.")}><XCircle className="size-4" />Reject</Button></div></CardContent></Card>}</div>;
}

function ReviewPackage({ item, completion }: { item: ContinuousImprovement; completion: boolean }) {
  return <div className="grid gap-4"><Card><CardHeader><CardTitle className="text-base">{completion ? "Completion Review Package" : "Proposal Review Package"}</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><Meta label="Problem / Opportunity" value={item.issueDescription} /><Meta label="Proposed Improvement" value={item.proposedImprovement} /><Meta label="Expected Benefit" value={item.expectedBenefit} /><Meta label="Proposed Saving" value={formatImprovementMoney(item.proposedSaving)} /><Meta label="Estimated Completion" value={`${item.estimatedTime} ${item.estimatedTimeUnit}`} /><Meta label="Participants" value={item.memberNames.join(", ") || "None"} />{completion && <><Meta label="Approval Remarks" value={item.reviewRemark || "No approval remarks"} /><Meta label="Approved By" value={item.reviewedByName ?? item.zoneLeaderName} /><Meta label="Implementation Process" value={item.implementationProcess || "—"} /><Meta label="Final Action Taken" value={item.actionTaken || "—"} /><Meta label="Actual Benefit" value={item.actualBenefit || "—"} /><Meta label="Actual Saving" value={formatImprovementMoney(item.actualSaving)} /><Meta label="Linked Actions" value={item.actionIds.join(", ") || "No linked actions"} /></>}</CardContent></Card>{completion && <Card><CardContent className="p-4 sm:p-5"><ImprovementBeforeAfter item={item} /></CardContent></Card>}</div>;
}

function DecisionSummary({ item }: { item: ContinuousImprovement }) {
  const title = item.status === "on_hold" ? "Proposal on hold" : item.status === "rejected" ? "Proposal rejected" : "Proposal approved";
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><CardTitle className="text-base">{title}</CardTitle><ImprovementStatusBadge status={item.status} /></div></CardHeader><CardContent className="grid gap-4"><p className="text-sm leading-6 text-muted-foreground">{item.reviewRemark || "No reviewer remarks recorded."}</p><dl className="grid gap-4 sm:grid-cols-2"><Meta label="Reviewer" value={item.reviewedByName ?? item.reviewerName ?? item.zoneLeaderName} /><Meta label="Decision Date" value={formatImprovementDate(item.reviewedAt, true)} /></dl></CardContent></Card>;
}

function ReviewState({ title, description, success = false }: { title: string; description: string; success?: boolean }) { return <Card><CardContent className="grid min-h-44 place-items-center p-6 text-center"><div><span className={cn("mx-auto grid size-10 place-items-center rounded-xl", success ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/[0.08] text-primary")}>{success ? <CheckCircle2 className="size-5" /> : <FileText className="size-5" />}</span><p className="mt-3 text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div></CardContent></Card>; }
function Story({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) { return <Card><CardHeader className="pb-3"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p><CardTitle className="text-base">{title}</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">{children}</CardContent></Card>; }
function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><dt className="text-[11px] font-medium text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-medium leading-5">{value}</dd></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid gap-2 text-sm font-medium">{label}{children}</label>; }
