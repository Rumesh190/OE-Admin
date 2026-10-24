"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { CanonicalLinkedRecords } from "@/components/ops/ops-linked-records";

import { useState } from "react";
import Link from "@/components/ops/ops-record-link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Edit3, ExternalLink, FileText, Link2, MapPin, Play, RotateCcw, Sparkles, UserRound, UsersRound } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CreateLinkedActionDialog, type LinkedActionContext } from "@/features/actions/create-linked-action-dialog";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useActionStore } from "@/lib/actions/action-store";
import { ACTION_STATUS_CONFIG, formatShortDate, getActionDueLabel } from "@/lib/actions/action-config";
import { useCurrentUser } from "@/lib/current-user";
import { canCreateVisualImprovementAction, canManageVisualImprovement, canReviewVisualImprovement, canViewVisualImprovement } from "./visual-improvement-access";
import { BeforeAfterEvidence, formatVisualDate, formatVisualMoney, VisualImprovementStatusBadge, VisualImprovementTabs, VisualImprovementTimeline } from "./visual-improvement-components";
import { approveVisualImprovement, linkVisualImprovementAction, planVisualImprovement, returnVisualImprovement, startVisualImprovement, useVisualImprovements } from "./visual-improvement-store";
import type { VisualImprovement } from "./types";

type DetailTab = "before-after" | "overview" | "benefits" | "actions" | "activity" | "review";
function validTab(value?: string): DetailTab { return (["before-after", "overview", "benefits", "actions", "activity", "review"] as DetailTab[]).includes(value as DetailTab) ? value as DetailTab : "before-after"; }

export default function VisualImprovementDetailPage({ improvementId, initialTab }: { improvementId: string; initialTab?: string }) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const item = useVisualImprovements().find((record) => record.id === improvementId);
  const actions = useActionStore();
  const [active, setActive] = useState<DetailTab>(() => validTab(initialTab));
  const [reviewRemark, setReviewRemark] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [actionOpen, setActionOpen] = useState(false);

  if (!item || !canViewVisualImprovement(adminUser, currentUser, item)) return <MissingImprovement />;

  const itemId = item.id;
  const mayManage = canManageVisualImprovement(adminUser, currentUser, item);
  const mayReview = canReviewVisualImprovement(adminUser, currentUser, item);
  const mayCreateAction = canCreateVisualImprovementAction(adminUser, currentUser);
  const linkedAction = item.actionId ? actions.find((action) => action.id === item.actionId) : undefined;
  const actionContext: LinkedActionContext = {
    source: "Visual Improvement", sourceModule: "visualImprovement", sourceId: item.id, sourceObservation: item.beforeDescription,
    title: item.title, description: item.expectedBenefit || item.beforeDescription, plant: item.plant, zone: item.zone, location: item.location,
    evidence: item.beforeEvidence.map((evidence) => ({ id: evidence.id, name: evidence.name, type: "image", mimeType: evidence.mimeType, uploadedAt: evidence.uploadedAt, uploadedBy: evidence.uploadedBy, url: evidence.url, evidenceType: "finding" })),
  };
  const editable = mayManage && !["Awaiting Review", "Completed"].includes(item.status);

  function review(decision: "approve" | "return") {
    if (decision === "return" && !reviewRemark.trim()) { setReviewError("A return remark is required."); return; }
    setReviewError("");
    try {
      if (decision === "approve") approveVisualImprovement(itemId, reviewRemark, currentUser);
      else returnVisualImprovement(itemId, reviewRemark, currentUser);
      setReviewRemark("");
    } catch (reason) {
      setReviewError(reason instanceof Error ? reason.message : "Unable to review this improvement.");
    }
  }

  return <PageContainer className="max-w-none">
    <FiveSPageHeader eyebrow={`Visual Improvement / ${item.id}`} title={item.title} description={`${item.plant} · ${item.zone} · ${item.location}`} leading={<Button size="icon-sm" variant="ghost" nativeButton={false} render={<Link href="/visual-improvement" />} aria-label="Back to Visual Improvement"><ArrowLeft className="size-4" /></Button>} actions={<><RecordDeletionMenu module="visualImprovement" recordId={item.id} returnTo="/visual-improvement" /><VisualImprovementStatusBadge status={item.status} />{item.status === "Draft" && mayManage && <Button size="sm" variant="outline" onClick={() => planVisualImprovement(item.id, currentUser)}>Move to Planned</Button>}{item.status === "Planned" && mayManage && <Button size="sm" onClick={() => startVisualImprovement(item.id, currentUser)}><Play className="size-3.5" />Start Work</Button>}{editable && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/visual-improvement/${encodeURIComponent(item.id)}/edit`} />}><Edit3 className="size-3.5" />Edit</Button>}{item.status === "Completed" && <Button size="sm" nativeButton={false} render={<Link href={`/visual-improvement/${encodeURIComponent(item.id)}/report`} />}><FileText className="size-3.5" />View Report</Button>}</>} />

    <section aria-label="Improvement ownership" className="grid overflow-hidden rounded-xl border bg-card sm:grid-cols-2 lg:grid-cols-4"><HeaderFact icon={UserRound} label="Owner" value={item.ownerName} /><HeaderFact icon={MapPin} label="Plant / Zone" value={`${item.plant} · ${item.zone}`} /><HeaderFact icon={Sparkles} label="Category" value={item.category} /><HeaderFact icon={CalendarDays} label="Updated" value={formatVisualDate(item.updatedAt, true)} /></section>

    <CanonicalLinkedRecords currentRecord={{module:"visualImprovement",recordId:item.id}} />
    <VisualImprovementTabs label="Visual Improvement record" active={active} onChange={(value) => setActive(value as DetailTab)} tabs={[{ id: "before-after", label: "Before & After", count: item.beforeEvidence.length + item.afterEvidence.length }, { id: "overview", label: "Overview" }, { id: "benefits", label: "Benefits" }, { id: "actions", label: "Actions", count: item.actionId ? 1 : 0 }, { id: "activity", label: "Activity", count: item.activity.length }, { id: "review", label: "Review" }]} />

    {active === "before-after" && <Card className="gap-0 overflow-hidden"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Before & After</CardTitle><p className="text-xs text-muted-foreground">The visible transformation is the primary evidence for this improvement.</p></CardHeader><CardContent className="p-4 sm:p-5"><BeforeAfterEvidence item={item} onAddAfter={editable ? () => router.push(`/visual-improvement/${encodeURIComponent(item.id)}/edit`) : undefined} /></CardContent></Card>}
    {active === "overview" && <Overview item={item} />}
    {active === "benefits" && <Benefits item={item} />}
    {active === "actions" && <ActionSection item={item} action={linkedAction} mayCreate={mayCreateAction && !item.actionId && item.status !== "Completed"} onCreate={() => setActionOpen(true)} />}
    {active === "activity" && <Card className="gap-0"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Activity Timeline</CardTitle><p className="text-xs text-muted-foreground">A compact history of evidence, ownership, work, and review.</p></CardHeader><CardContent className="p-5"><VisualImprovementTimeline activity={item.activity} /></CardContent></Card>}
    {active === "review" && <ReviewSection item={item} mayReview={mayReview} reviewRemark={reviewRemark} onRemark={setReviewRemark} error={reviewError} onApprove={() => review("approve")} onReturn={() => review("return")} />}

    <CreateLinkedActionDialog open={actionOpen} onOpenChange={setActionOpen} context={actionContext} onCreated={(action) => { linkVisualImprovementAction(item.id, action.id, currentUser); setActionOpen(false); }} />
  </PageContainer>;
}

function HeaderFact({ icon: Icon, label, value }: { icon: typeof UserRound; label: string; value: string }) { return <div className="flex min-w-0 items-center gap-3 border-b px-4 py-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-0.5 truncate text-sm font-semibold" title={value}>{value}</p></div></div>; }

function Overview({ item }: { item: VisualImprovement }) { return <div className="grid gap-4 lg:grid-cols-12"><Card className="gap-0 lg:col-span-8"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Improvement Overview</CardTitle></CardHeader><CardContent className="grid gap-5 p-5"><TextBlock label="Before opportunity" value={item.beforeDescription} /><TextBlock label="Expected benefit" value={item.expectedBenefit} /><div className="grid gap-4 border-t pt-4 sm:grid-cols-2"><Meta label="Category" value={item.category} /><Meta label="Area / Location" value={item.location} /><Meta label="Created by" value={item.createdByName} /><Meta label="Created" value={formatVisualDate(item.createdAt, true)} /><Meta label="Estimated completion" value={formatVisualDate(item.estimatedCompletionDate)} /><Meta label="Current status" value={item.status} /></div></CardContent></Card><Card className="gap-0 lg:col-span-4"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Improvement Team</CardTitle></CardHeader><CardContent className="grid gap-4 p-5"><Person label="Owner" name={item.ownerName} icon={UserRound} />{item.participants.length ? <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Participants</p><div className="grid gap-2">{item.participants.map((person) => <Person key={person.id} label="Participant" name={person.name} icon={UsersRound} />)}</div></div> : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">No additional participants.</p>}</CardContent></Card></div>; }

function Benefits({ item }: { item: VisualImprovement }) { const values = [{ label: "Proposed Cost Saving", value: formatVisualMoney(item.proposedCostSaving) }, { label: "Actual Cost Saving", value: formatVisualMoney(item.actualCostSaving) }, { label: "Time Saved", value: item.timeSaved || "—" }, { label: "Space Saved", value: item.spaceSaved || "—" }, { label: "Safety Benefit", value: item.safetyBenefit || "—" }, { label: "Quality Benefit", value: item.qualityBenefit || "—" }]; return <Card className="gap-0"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Benefits</CardTitle><p className="text-xs text-muted-foreground">Financial and practical outcomes captured without making every field mandatory.</p></CardHeader><CardContent className="grid gap-5 p-5"><div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-3">{values.map((value) => <div key={value.label} className="min-w-0 bg-card p-4"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{value.label}</p><p className="mt-2 text-sm font-semibold leading-5">{value.value}</p></div>)}</div><TextBlock label="Benefit Description" value={item.benefitDescription || item.expectedBenefit} />{item.otherBenefit && <TextBlock label="Other Benefit" value={item.otherBenefit} />}{item.completionNotes && <TextBlock label="Completion Notes" value={item.completionNotes} />}</CardContent></Card>; }

function ActionSection({ item, action, mayCreate, onCreate }: { item: VisualImprovement; action: ReturnType<typeof useActionStore>[number] | undefined; mayCreate: boolean; onCreate: () => void }) {
  if (!action) return <Card className="gap-0"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Action</CardTitle></CardHeader><CardContent className="grid min-h-48 place-items-center p-6 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground"><Link2 className="size-5" /></span><p className="mt-3 text-sm font-semibold">{item.actionId ? `Linked action ${item.actionId} is not available in this workspace.` : "No Action Required"}</p><p className="mt-1 text-xs text-muted-foreground">Visual Improvements can be completed without creating a separate Action.</p>{mayCreate && <Button className="mt-4" size="sm" onClick={onCreate}><Link2 className="size-3.5" />Create Action</Button>}</div></CardContent></Card>;
  return <Card className="gap-0"><CardHeader className="border-b pb-4"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-[15px]">Linked Action</CardTitle><p className="mt-1 font-mono text-xs text-muted-foreground">{action.id}</p></div><Badge variant={ACTION_STATUS_CONFIG[action.status].variant}>{action.status}</Badge></div></CardHeader><CardContent className="grid gap-5 p-5"><div><p className="text-base font-semibold">{action.title}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{action.description}</p></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Meta label="Assigned To" value={action.responsiblePersonName || action.assignedTo || "Awaiting assignment"} /><Meta label="Priority" value={action.priority} /><Meta label="Due Date" value={`${formatShortDate(action.dueDate)} · ${getActionDueLabel(action)}`} /><Meta label="Status" value={action.status} /></div><Button className="w-fit" nativeButton={false} render={<Link href={`/actions/${encodeURIComponent(action.id)}`} />}>View Action<ExternalLink className="size-4" /></Button></CardContent></Card>;
}

function ReviewSection({ item, mayReview, reviewRemark, onRemark, error, onApprove, onReturn }: { item: VisualImprovement; mayReview: boolean; reviewRemark: string; onRemark: (value: string) => void; error: string; onApprove: () => void; onReturn: () => void }) {
  if (item.status === "Completed") return <Card className="gap-0"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Completion Review</CardTitle></CardHeader><CardContent className="grid gap-5 p-5"><div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-4"><CheckCircle2 className="mt-0.5 size-5 text-emerald-600 dark:text-emerald-400" /><div><p className="text-sm font-semibold">Improvement completed</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Reviewed by {item.reviewedByName || "Reviewer"} on {formatVisualDate(item.reviewedAt, true)}. Completed by {item.completedByName || item.ownerName}.</p>{item.reviewRemark && <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.reviewRemark}</p>}</div></div><BeforeAfterEvidence item={item} compact /></CardContent></Card>;
  if (item.status !== "Awaiting Review") return <Card className="gap-0"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Review</CardTitle></CardHeader><CardContent className="p-5"><p className="text-sm text-muted-foreground">{item.status === "Returned" ? `Returned for changes: ${item.reviewRemark || "Review feedback is available."}` : "Submit the completed before-and-after package before review can begin."}</p>{item.status === "Returned" && <Button className="mt-4" variant="outline" nativeButton={false} render={<Link href={`/visual-improvement/${encodeURIComponent(item.id)}/edit`} />}>Update & Resubmit</Button>}</CardContent></Card>;
  return <div className="grid gap-4 xl:grid-cols-12"><Card className="gap-0 xl:col-span-8"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Review Package</CardTitle><p className="text-xs text-muted-foreground">Verify the evidence, ownership, benefit, and linked Action before deciding.</p></CardHeader><CardContent className="grid gap-5 p-5"><BeforeAfterEvidence item={item} compact /><div className="grid gap-4 border-t pt-4 sm:grid-cols-2"><Meta label="Owner" value={item.ownerName} /><Meta label="Benefit" value={item.benefitDescription || item.expectedBenefit} /><Meta label="Actual Saving" value={formatVisualMoney(item.actualCostSaving)} /><Meta label="Linked Action" value={item.actionId || "No Action Required"} /></div></CardContent></Card><Card className="gap-0 xl:col-span-4"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Review Decision</CardTitle></CardHeader><CardContent className="grid gap-4 p-5">{mayReview ? <><p className="text-sm leading-6 text-muted-foreground">Approve this visible transformation, or return it with a required remark.</p><label className="grid gap-1.5 text-sm font-medium">Review remark<Textarea value={reviewRemark} onChange={(event) => onRemark(event.target.value)} placeholder="Required when returning for changes" rows={4} /></label>{error && <p role="alert" className="text-xs font-medium text-destructive">{error}</p>}<div className="grid gap-2"><Button onClick={onApprove}><CheckCircle2 className="size-4" />Approve Improvement</Button><Button variant="outline" onClick={onReturn}><RotateCcw className="size-4" />Return for Changes</Button></div></> : <p className="text-sm text-muted-foreground">This improvement is awaiting an authorized reviewer.</p>}</CardContent></Card></div>;
}

function TextBlock({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-2 text-sm leading-6">{value}</p></div>; }
function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold">{value}</p></div>; }
function Person({ label, name, icon: Icon }: { label: string; name: string; icon: typeof UserRound }) { return <div className="flex items-center gap-3 rounded-lg border p-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/[0.08] text-primary"><Icon className="size-4" /></span><div className="min-w-0"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="truncate text-sm font-semibold">{name}</p></div></div>; }
function MissingImprovement() { return <PageContainer><FiveSPageHeader eyebrow="OPS Workspace / Visual Improvement" title="Improvement not found" description="This improvement is unavailable or outside your access." /><Card><CardContent className="grid min-h-48 place-items-center"><Button variant="outline" nativeButton={false} render={<Link href="/visual-improvement" />}>Back to Visual Improvement</Button></CardContent></Card></PageContainer>; }
