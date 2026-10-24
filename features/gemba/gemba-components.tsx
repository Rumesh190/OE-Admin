"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { getRedTagCreationError } from "@/features/five-s/red-tag/access";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { useCurrentUser } from "@/lib/current-user";
import { useGembaStore } from "./gemba-store";
import { CanonicalLinkedRecords } from "@/components/ops/ops-linked-records";
/* eslint-disable @next/next/no-img-element -- local and user-captured evidence uses dynamic data URLs. */

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Camera, Eye, FileCheck2, ImageIcon, Lightbulb, MapPin, Mic, Pencil, Plus, Share2, Tag, UserRound, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { OpsEmptyState } from "@/components/ops/ops-empty-state";
import { OpsEvidenceViewer } from "@/components/ops/ops-evidence-viewer";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { MyAction } from "@/features/five-s/types/my-actions";
import { ACTION_STATUS_CONFIG } from "@/lib/actions/action-config";
import { cn } from "@/lib/utils";
import { resolveGembaCorrectiveActionNeeded, type GembaEvidence, type GembaObservation, type GembaObservationType, type GembaWalkStatus } from "./types";
import { useGembaEvidenceUrl } from "./use-gemba-evidence-url";
import { formatGembaZoneLabel } from "./gemba-zone-labels";

export const OBSERVATION_TYPE_STYLE: Record<GembaObservationType, {
  variant: "success" | "warning" | "danger";
  dot: string;
  border: string;
  soft: string;
  text: string;
}> = {
  Positive: { variant: "success", dot: "bg-emerald-500", border: "border-l-emerald-500", soft: "bg-emerald-500/[0.055]", text: "text-emerald-600 dark:text-emerald-400" },
  Opportunity: { variant: "warning", dot: "bg-amber-500", border: "border-l-amber-500", soft: "bg-amber-500/[0.055]", text: "text-amber-600 dark:text-amber-400" },
  Issue: { variant: "danger", dot: "bg-red-500", border: "border-l-red-500", soft: "bg-red-500/[0.055]", text: "text-red-600 dark:text-red-400" },
};

export function GembaStatusBadge({ status }: { status: GembaWalkStatus }) {
  return <StatusBadge status={status} />;
}

export function ObservationTypeBadge({ type }: { type: GembaObservationType }) {
  return <Badge variant={OBSERVATION_TYPE_STYLE[type].variant}><span className={cn("mr-1 size-1.5 rounded-full", OBSERVATION_TYPE_STYLE[type].dot)} />{type}</Badge>;
}

export function GembaTabBar({ tabs, active, onChange, label = "Gemba views" }: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  return <OpsTabBar tabs={tabs} active={active} onChange={onChange} label={label} />;
}

export function ObservationCard({ observation, action, onEdit, onCreateAction, onCreateRedTag, onCreateImprovement, compact = false }: {
  observation: GembaObservation;
  action?: MyAction;
  onEdit?: () => void;
  onCreateAction?: () => void;
  onCreateRedTag?: () => void;
  onCreateImprovement?: () => void;
  compact?: boolean;
}) {
  const [viewOpen, setViewOpen] = useState(false);
  const [preview, setPreview] = useState<GembaObservation["evidence"][number] | null>(null);
  const style = OBSERVATION_TYPE_STYLE[observation.type];
  const hasRedTag = Boolean(observation.redTagId);
  const hasImprovement = Boolean(observation.improvementId);
  const hasAction = Boolean(action);
  const correctiveActionNeeded = resolveGembaCorrectiveActionNeeded(observation);
  const canCreateAction = onCreateAction && observation.type !== "Positive" && !observation.actionId;
  const actor = useCurrentUser();
  const directoryUser = useAdminUsers().find(user => user.id === actor.id);
  const sourceWalk = useGembaStore().walks.find(walk => walk.id === observation.gembaId);
  const redTagError = sourceWalk ? getRedTagCreationError(directoryUser, sourceWalk.plant, sourceWalk.zone) : "Source walk unavailable.";
  const canCreateRedTag = onCreateRedTag && observation.type === "Issue" && !hasRedTag;
  const canCreateImprovement = onCreateImprovement && observation.type === "Opportunity" && !hasImprovement;
  
  return <>
    <article id={observation.id} className={cn("scroll-mt-24 overflow-hidden rounded-xl border border-l-[3px] bg-card shadow-sm", style.border)}>
      <div className={cn("flex min-w-0 items-start gap-3", compact ? "p-3" : "p-4")}>
        {observation.evidence[0] ? <button type="button" onClick={() => setPreview(observation.evidence[0])} className="relative size-16 shrink-0 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring sm:size-[72px]" aria-label={`Preview ${observation.evidence[0].name}`}><GembaEvidenceImage evidence={observation.evidence[0]} className="size-full object-cover" />{observation.evidence.length > 1 && <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">+{observation.evidence.length - 1}</span>}</button> : <span className="grid size-16 shrink-0 place-items-center rounded-lg border border-dashed bg-muted/20 text-muted-foreground sm:size-[72px]"><ImageIcon className="size-5" /></span>}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2"><RecordDeletionMenu module="gembaObservation" recordId={observation.id} /><ObservationTypeBadge type={observation.type} /><span className="font-mono text-[10px] text-muted-foreground">{observation.id.split("-").slice(-2).join("-")}</span></div>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5">{observation.title}</h3>
          {!compact && <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{observation.description}</p>}
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span className="inline-flex min-w-0 items-center gap-1"><MapPin className="size-3 shrink-0" /><span className="truncate">{observation.location}</span></span><span>{observation.evidence.length} photo{observation.evidence.length === 1 ? "" : "s"}</span>{observation.horizontalDeployment?.enabled && <span className="inline-flex items-center gap-1 text-primary"><Share2 className="size-3" />Horizontal Deployment · {observation.horizontalDeployment.targetZoneIds.length} zone{observation.horizontalDeployment.targetZoneIds.length === 1 ? "" : "s"}</span>}</div>
          {observation.type !== "Positive" && <p className="mt-2 text-[11px] text-muted-foreground">Action: <span className="font-medium text-foreground">{correctiveActionNeeded === true ? "Required" : correctiveActionNeeded === false ? "Not required" : "Not decided"}</span></p>}
          {observation.noActionReason && !hasAction && !hasRedTag && <p className={cn("mt-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground", style.soft)}>{observation.noActionReason}</p>}
        </div>
      </div>
      <footer className="flex min-w-0 flex-wrap items-center gap-1 border-t bg-muted/[0.18] px-3 py-2">
        <Button size="sm" variant="ghost" onClick={() => setViewOpen(true)}><Eye className="size-3.5" />View</Button>
        {onEdit && <Button size="sm" variant="ghost" onClick={onEdit}><Pencil className="size-3.5" />Edit</Button>}
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1">
          {hasAction && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/actions/${encodeURIComponent(action!.id)}`} />}><FileCheck2 className="size-3.5" />{action!.id}<Badge size="sm" variant={ACTION_STATUS_CONFIG[action!.status].variant} className="ml-1 hidden sm:inline-flex">{action!.status}</Badge></Button>}
          {hasRedTag && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/5s/red/${encodeURIComponent(observation.redTagId!)}`} />}><Tag className="size-3.5" />{observation.redTagId}</Button>}
          {hasImprovement && <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/continuous-improvement/${encodeURIComponent(observation.improvementId!)}`} />}><Lightbulb className="size-3.5" />{observation.improvementId}</Button>}
          {canCreateAction && <Button size="sm" variant="outline" onClick={onCreateAction}><Plus className="size-3.5" />Create Action</Button>}
          {canCreateRedTag && <Button size="sm" variant="outline" disabled={Boolean(redTagError)} onClick={onCreateRedTag}><Tag className="size-3.5" />Create Red Tag</Button>}
          {canCreateRedTag && redTagError && <p className="w-full text-xs text-muted-foreground">{redTagError}</p>}
          {canCreateImprovement && <Button size="sm" variant="outline" onClick={onCreateImprovement}><Plus className="size-3.5" />Create Improvement</Button>}
          {!hasAction && !hasRedTag && !hasImprovement && !canCreateAction && !canCreateRedTag && !canCreateImprovement && <span className="text-[11px] text-muted-foreground">No action needed</span>}
        </div>
      </footer>
    </article>

    <Dialog open={viewOpen} onOpenChange={setViewOpen}><DialogContent showCloseButton={false} className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-1rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 shadow-xl sm:w-[calc(100vw-3rem)] sm:max-w-[900px]"><div className="flex min-w-0 items-center gap-4 border-b bg-muted/20 px-5 py-3 sm:px-7"><div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2"><ObservationTypeBadge type={observation.type} /><span className="min-w-0 break-all font-mono text-[11px] text-muted-foreground">{observation.id}</span></div><DialogClose render={<Button variant="ghost" size="icon" className="shrink-0" />} aria-label="Close"><X className="size-5" /></DialogClose></div><div role="region" aria-label="Observation details" tabIndex={0} className="min-h-0 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><DialogHeader className="border-b px-5 py-5 sm:px-7 sm:py-6"><DialogTitle className="break-words pt-2 text-xl font-semibold leading-7 tracking-tight sm:text-2xl">{observation.title}</DialogTitle><DialogDescription className="flex flex-wrap gap-x-4 gap-y-2 pt-1 text-xs [&>span]:min-w-0 [&>span]:break-words [&_svg]:shrink-0"><span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{observation.location}</span><span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" />{observation.createdByName}</span><span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(observation.createdAt))}</span></DialogDescription></DialogHeader><div className="break-words px-5 py-5 sm:px-7 sm:py-6"><div className="grid min-w-0 grid-cols-1 gap-6"><section><h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Observation</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{observation.description}</p>{observation.peopleInvolved.length > 0 && <p className="mt-3 text-sm"><span className="text-muted-foreground">People involved:</span> {observation.peopleInvolved.join(", ")}</p>}</section>{observation.evidence.length > 0 && <section className="border-t pt-5"><h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Evidence · {observation.evidence.length}</h3><div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">{observation.evidence.map((item) => <button type="button" key={item.id} onClick={() => setPreview(item)} aria-label={`View full size: ${item.note || item.name}`} className="group min-w-0 overflow-hidden rounded-xl border bg-muted/20 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 outline-none focus-visible:ring-2 focus-visible:ring-ring"><GembaEvidenceImage evidence={item} alt={item.note || item.name} className="aspect-[16/9] max-h-56 w-full object-contain" /><span className="flex items-center gap-2 border-t bg-background px-3 py-3 text-xs"><span className="min-w-0 flex-1 break-words">{item.note || item.name}</span><Eye className="size-4 shrink-0 text-muted-foreground group-hover:text-primary" /></span></button>)}</div></section>}{observation.voiceNote && <section className="border-t pt-5"><VoiceNotePlayback voiceNote={observation.voiceNote} /></section>}{observation.type !== "Positive" && <section className="border-t pt-5"><h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Follow-up</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><DetailValue label="Action" value={correctiveActionNeeded === true ? "Required" : correctiveActionNeeded === false ? "Not required" : "Not decided"} />{observation.noActionReason && <DetailValue label="Why no Action" value={observation.noActionReason} wide />}</div>{hasAction && <div className="mt-4 border-l-2 border-primary/30 pl-4"><p className="text-sm font-semibold">{action!.title}</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{action!.description}</p><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-muted-foreground">Action Status</dt><dd>{action!.status}</dd></div><div><dt className="text-muted-foreground">Assigned Owner</dt><dd>{action!.responsiblePersonName ?? action!.assignedTo ?? "Unassigned"}</dd></div></dl></div>}{observation.actionId && !hasAction && <p className="mt-3 text-sm text-muted-foreground">Linked Action unavailable.</p>}</section>}<CanonicalLinkedRecords currentRecord={{module:"gemba",recordId:observation.gembaId,childId:observation.id}} compact />{observation.horizontalDeployment?.enabled && <section className="border-t pt-5"><h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground"><Share2 className="size-3.5" />Horizontal Deployment</h3><div className="mt-3 divide-y rounded-xl border">{observation.horizontalDeployment.recipients.map((recipient) => <div key={recipient.zoneId} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span><span className="block font-medium">{formatGembaZoneLabel(recipient.zoneName)}</span><span className="block text-xs text-muted-foreground">{recipient.leaderName ? `Zone Leader · ${recipient.leaderName}` : "Zone Leader not assigned"}</span></span><Badge size="sm" variant={recipient.notificationStatus === "shared" ? "success" : "secondary"}>{recipient.notificationStatus === "shared" ? "Shared" : "Notification unavailable"}</Badge></div>)}</div></section>}</div></div></div></DialogContent>
      <GembaEvidenceLightbox evidence={preview} onOpenChange={(open) => !open && setPreview(null)} />
    </Dialog>
  </>;
}

function DetailValue({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={cn("rounded-lg bg-muted/[0.18] px-4 py-3", wide && "sm:col-span-2")}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium leading-6">{value}</p></div>; }

/** Renders one piece of Gemba photo evidence, resolving its URL from IndexedDB when only a `storageKey` reference is available (e.g. after a page refresh). */
export function GembaEvidenceImage({ evidence, className, alt = "" }: { evidence: GembaEvidence; className?: string; alt?: string }) {
  const url = useGembaEvidenceUrl(evidence);
  if (!url) return <span className={cn("grid place-items-center bg-muted text-muted-foreground", className)}><ImageIcon className="size-4 animate-pulse" /></span>;
  return <img src={url} alt={alt} className={className} />;
}

export function GembaEvidenceLightbox({ evidence, onOpenChange }: { evidence: GembaEvidence | null; onOpenChange: (open: boolean) => void }) {
  const url = useGembaEvidenceUrl(evidence);
  return <OpsEvidenceViewer open={Boolean(evidence)} onOpenChange={onOpenChange} src={url} title={evidence?.name} description={evidence?.note || "Gemba observation evidence"} alt={evidence?.note || evidence?.name} />;
}

export function CompactEmpty({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <OpsEmptyState title={title} description={description} action={action} icon={Camera} compact />;
}

function VoiceNotePlayback({ voiceNote }: { voiceNote: NonNullable<GembaObservation["voiceNote"]> }) {
  const [unavailable, setUnavailable] = useState(false);
  const canPlay = Boolean(voiceNote.audioUrl) && !unavailable;
  return <div className="rounded-lg border bg-muted/[0.18] p-3">
    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground"><Mic className="size-3.5" />Voice Note</p>
    {canPlay ? <audio controls src={voiceNote.audioUrl} onError={() => setUnavailable(true)} className="mt-2 w-full"><track kind="captions" /></audio> : <p className="mt-2 text-[11px] text-muted-foreground">Recording ({voiceNote.durationSeconds}s) — audio playback is unavailable in this session.</p>}
    {voiceNote.transcript && <p className="mt-2 text-xs leading-5 text-muted-foreground">&quot;{voiceNote.transcript}&quot;</p>}
  </div>;
}
