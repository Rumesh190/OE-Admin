"use client";
/* eslint-disable @next/next/no-img-element -- uploaded evidence uses dynamic data URLs and existing local evidence assets. */

import { OpsTabBar } from "@/components/ops/ops-tabs";
import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, CheckCircle2, Clock3, FileEdit, ImageIcon, Link2, RotateCcw, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OpsCameraCapture } from "@/components/ops/ops-camera-capture";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_EVIDENCE_IMAGES, optimizeEvidenceImage, validateEvidenceSelection } from "@/lib/evidence-images";
import { cn } from "@/lib/utils";
import type { VisualImprovement, VisualImprovementActivity, VisualImprovementEvidence, VisualImprovementStatus } from "./types";

export const VISUAL_STATUS_STYLE: Record<VisualImprovementStatus, { variant: "secondary" | "info" | "warning" | "success" | "danger"; dot: string }> = {
  Draft: { variant: "secondary", dot: "bg-slate-400" },
  Planned: { variant: "info", dot: "bg-sky-500" },
  "In Progress": { variant: "warning", dot: "bg-amber-500" },
  "Awaiting Review": { variant: "info", dot: "bg-blue-500" },
  Completed: { variant: "success", dot: "bg-emerald-500" },
  Returned: { variant: "danger", dot: "bg-rose-500" },
};

export function VisualImprovementStatusBadge({ status }: { status: VisualImprovementStatus }) {
  const style = VISUAL_STATUS_STYLE[status];
  return <Badge variant={style.variant}><span className={cn("mr-1 size-1.5 rounded-full", style.dot)} />{status}</Badge>;
}

export function VisualImprovementTabs({ tabs, active, onChange, label = "Visual Improvement views" }: {
  tabs: Array<{ id: string; label: string; count?: number }>;
  active: string;
  onChange: (id: string) => void;
  label?: string;
}) {
  return <OpsTabBar tabs={tabs} active={active} onChange={onChange} label={label} />;
}

export function VisualEvidencePicker({ items, onChange, uploadedBy, label = "Add photos", required = false }: {
  items: VisualImprovementEvidence[];
  onChange: (items: VisualImprovementEvidence[]) => void;
  uploadedBy: string;
  label?: string;
  required?: boolean;
}) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function selected(list: FileList | File[] | null) {
    if (!list) return;
    const files = Array.from(list);
    setError("");
    try {
      validateEvidenceSelection(files, items.length);
      setBusy(true);
      const next: VisualImprovementEvidence[] = [];
      for (const file of files) {
        const optimized = await optimizeEvidenceImage(file);
        next.push({ id: `VI-EV-${crypto.randomUUID()}`, name: file.name, url: optimized.dataUrl, mimeType: file.type, caption: caption.trim() || undefined, uploadedAt: new Date().toISOString(), uploadedBy });
      }
      onChange([...items, ...next]);
      setCaption("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to process this image.");
    } finally {
      setBusy(false);
      if (uploadRef.current) uploadRef.current.value = "";
    }
  }

  return <div className="grid gap-3">
    <input ref={uploadRef} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => void selected(event.target.files)} />
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <Input value={caption} onChange={(event) => setCaption(event.target.value)} placeholder="Short caption for selected photos" />
      <OpsCameraCapture disabled={busy || items.length >= MAX_EVIDENCE_IMAGES} fileNamePrefix="visual-improvement" onCapture={(file) => selected([file])} trigger={(openCamera) => <Button type="button" variant="outline" className="min-h-11" onClick={openCamera} disabled={busy || items.length >= MAX_EVIDENCE_IMAGES}><Camera className="size-4" />Take Photo</Button>} />
      <Button type="button" variant="outline" className="min-h-11" aria-label={`${label}: Upload Photo`} onClick={() => uploadRef.current?.click()} disabled={busy || items.length >= MAX_EVIDENCE_IMAGES}><Upload className="size-4" />{busy ? "Processing..." : "Upload Photo"}</Button>
    </div>
    <p className={cn("text-[11px]", error ? "text-destructive" : "text-muted-foreground")}>{error || `${required ? "Required · " : ""}${items.length}/${MAX_EVIDENCE_IMAGES} photos · JPG, PNG, or camera capture`}</p>
    {items.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">{items.map((item) => <figure key={item.id} className="group relative overflow-hidden rounded-lg border bg-muted/25"><img src={item.url} alt={item.caption || item.name} className="aspect-[4/3] w-full object-cover" /><button type="button" onClick={() => onChange(items.filter((candidate) => candidate.id !== item.id))} aria-label={`Remove ${item.name}`} className="absolute right-1 top-1 grid size-8 place-items-center rounded-md bg-black/70 text-white outline-none hover:bg-black focus-visible:ring-2 focus-visible:ring-white"><Trash2 className="size-3.5" /></button><figcaption className="truncate px-2 py-1.5 text-[10px] text-muted-foreground">{item.caption || item.name}</figcaption></figure>)}</div>}
  </div>;
}

export function BeforeAfterEvidence({ item, onAddAfter, compact = false }: { item: VisualImprovement; onAddAfter?: () => void; compact?: boolean }) {
  const [preview, setPreview] = useState<{ title: string; evidence: VisualImprovementEvidence } | null>(null);
  const before = item.beforeEvidence[0];
  const after = item.afterEvidence[0];
  return <>
    <div className={cn("grid gap-3 md:grid-cols-2", compact && "gap-2")}>
      <EvidenceSide label="Before" tone="before" evidence={before} description={item.beforeDescription} compact={compact} onPreview={() => before && setPreview({ title: "Before", evidence: before })} />
      {after ? <EvidenceSide label="After" tone="after" evidence={after} description={item.afterDescription || "Improvement outcome"} compact={compact} onPreview={() => setPreview({ title: "After", evidence: after })} /> : <div className={cn("grid overflow-hidden rounded-xl border border-dashed bg-muted/[0.12]", compact ? "min-h-40" : "min-h-[290px]")}><div className="grid place-items-center p-5 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-primary/[0.08] text-primary"><ImageIcon className="size-5" /></span><p className="mt-3 text-sm font-semibold">Improvement in progress</p><p className="mt-1 text-xs text-muted-foreground">After evidence will appear here when the work is complete.</p>{onAddAfter && <Button size="sm" className="mt-4" onClick={onAddAfter}><Camera className="size-3.5" />Add After Evidence</Button>}</div></div></div>}
      {(item.beforeEvidence.length > 1 || item.afterEvidence.length > 1) && <div className="grid gap-3 rounded-xl border bg-muted/[0.1] p-3 md:col-span-2 sm:grid-cols-2"><EvidenceStrip label="More before photos" evidence={item.beforeEvidence.slice(1)} onPreview={(selected) => setPreview({ title: "Before", evidence: selected })} /><EvidenceStrip label="More after photos" evidence={item.afterEvidence.slice(1)} onPreview={(selected) => setPreview({ title: "After", evidence: selected })} /></div>}
    </div>
    <Dialog open={Boolean(preview)} onOpenChange={(open) => !open && setPreview(null)}><DialogContent className="h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden bg-zinc-950 p-0 text-white ring-white/15 sm:h-[calc(100dvh-2rem)] sm:w-[calc(100vw-2rem)] sm:max-w-6xl"><DialogHeader className="border-b border-white/10 px-4 py-3"><DialogTitle>{preview?.title} · {item.title}</DialogTitle><DialogDescription className="text-zinc-400">{preview?.evidence.caption || preview?.evidence.name}</DialogDescription></DialogHeader>{preview && <div className="flex min-h-0 items-center justify-center overflow-auto p-3 sm:p-6"><img src={preview.evidence.url} alt={preview.evidence.caption || preview.evidence.name} className="max-h-full max-w-full object-contain" /></div>}</DialogContent></Dialog>
  </>;
}

function EvidenceStrip({ label, evidence, onPreview }: { label: string; evidence: VisualImprovementEvidence[]; onPreview: (evidence: VisualImprovementEvidence) => void }) {
  if (!evidence.length) return <div />;
  return <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><div className="flex gap-2 overflow-x-auto">{evidence.map((item) => <button key={item.id} type="button" onClick={() => onPreview(item)} className="shrink-0 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"><img src={item.url} alt={item.caption || item.name} loading="lazy" className="aspect-[4/3] w-24 object-cover" /></button>)}</div></div>;
}

function EvidenceSide({ label, tone, evidence, description, compact, onPreview }: { label: string; tone: "before" | "after"; evidence?: VisualImprovementEvidence; description: string; compact: boolean; onPreview: () => void }) {
  return <div className="min-w-0 overflow-hidden rounded-xl border bg-card"><div className="flex items-center justify-between border-b px-3 py-2"><span className="inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"><span className={cn("size-1.5 rounded-full", tone === "before" ? "bg-amber-500" : "bg-emerald-500")} />{label}</span>{evidence && <span className="text-[10px] text-muted-foreground">Click to expand</span>}</div>{evidence ? <button type="button" onClick={onPreview} className="block w-full overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><img src={evidence.url} alt={evidence.caption || evidence.name} loading={compact ? "lazy" : "eager"} className={cn("w-full object-cover transition-transform duration-300 hover:scale-[1.015]", compact ? "aspect-[16/9]" : "aspect-[16/10]")} /></button> : <div className={cn("grid place-items-center bg-muted/25 text-xs text-muted-foreground", compact ? "aspect-[16/9]" : "aspect-[16/10]")}>No {label.toLowerCase()} evidence</div>}<p className={cn("text-sm leading-6 text-muted-foreground", compact ? "line-clamp-2 p-3 text-xs leading-5" : "p-4")}>{description}</p></div>;
}

export function TransformationCard({ item }: { item: VisualImprovement }) {
  return <Link href={`/visual-improvement/${encodeURIComponent(item.id)}`} className="group min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm outline-none transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring">
    <div className="grid grid-cols-2 gap-px bg-border"><CardImage label="Before" evidence={item.beforeEvidence[0]} /><CardImage label="After" evidence={item.afterEvidence[0]} /></div>
    <div className="p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{item.zone} · {item.location}</p></div><ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div><div className="mt-3 flex flex-wrap items-center gap-2"><Badge variant="secondary">{item.category}</Badge><VisualImprovementStatusBadge status={item.status} /></div><div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-xs"><span className="truncate text-muted-foreground">{item.ownerName}</span><span className="shrink-0 font-semibold text-emerald-700 dark:text-emerald-400">{formatBenefit(item)}</span></div></div>
  </Link>;
}

function CardImage({ label, evidence }: { label: string; evidence?: VisualImprovementEvidence }) {
  return <div className="relative min-w-0 bg-muted"><span className="absolute left-2 top-2 z-10 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">{label}</span>{evidence ? <img src={evidence.url} alt={evidence.caption || evidence.name} loading="lazy" className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center"><ImageIcon className="size-5 text-muted-foreground" /></div>}</div>;
}

const ACTIVITY_ICON: Record<VisualImprovementActivity["type"], typeof Clock3> = {
  created: FileEdit, planned: Clock3, started: Clock3, before_evidence_added: Camera, after_evidence_added: Camera, action_created: Link2, submitted: Clock3, returned: RotateCcw, resubmitted: Clock3, completed: CheckCircle2, updated: FileEdit,
};

export function VisualImprovementTimeline({ activity }: { activity: VisualImprovementActivity[] }) {
  return <ol className="grid gap-0">{[...activity].reverse().map((item, index) => { const Icon = ACTIVITY_ICON[item.type]; return <li key={item.id} className="grid grid-cols-[32px_minmax(0,1fr)] gap-3"><div className="relative flex justify-center"><span className="z-10 grid size-8 place-items-center rounded-full border bg-card text-muted-foreground"><Icon className="size-3.5" /></span>{index < activity.length - 1 && <span className="absolute bottom-0 top-8 w-px bg-border" />}</div><div className="min-w-0 pb-5"><div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1"><p className="text-sm font-medium">{item.label}</p><time className="text-[11px] text-muted-foreground" dateTime={item.at}>{formatVisualDate(item.at, true)}</time></div><p className="mt-0.5 text-xs text-muted-foreground">{item.actorName}</p>{item.remark && <p className="mt-2 rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">{item.remark}</p>}</div></li>; })}</ol>;
}

export function VisualImprovementEmpty({ title = "No visual improvements yet", description = "Capture a workplace improvement with before-and-after evidence.", action }: { title?: string; description?: string; action?: React.ReactNode }) {
  return <div className="grid min-h-48 place-items-center px-5 py-8 text-center"><div><span className="mx-auto grid size-10 place-items-center rounded-xl bg-primary/[0.08] text-primary"><ImageIcon className="size-5" /></span><p className="mt-3 text-sm font-semibold">{title}</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p>{action && <div className="mt-4">{action}</div>}</div></div>;
}

export function formatVisualDate(value?: string, time = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(date);
}

export function formatVisualMoney(value?: number) {
  if (typeof value !== "number") return "Non-financial";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export function formatBenefit(item: VisualImprovement) {
  if (typeof item.actualCostSaving === "number") return `${formatVisualMoney(item.actualCostSaving)}/year`;
  if (typeof item.proposedCostSaving === "number") return `${formatVisualMoney(item.proposedCostSaving)}/year`;
  return item.spaceSaved || item.timeSaved || "Non-financial benefit";
}
