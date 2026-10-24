"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { ActionLink } from "@/components/ops/ops-return-link";

import { useMemo, useState } from "react";
import Link from "@/components/ops/ops-record-link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock3, Eye, FileText, Footprints, MapPin, Play, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageContainer } from "@/components/layout/page-container";
import { OpsTimeline } from "@/components/ops/ops-timeline";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { ACTION_PRIORITY_CONFIG, ACTION_STATUS_CONFIG, formatShortDate } from "@/lib/actions/action-config";
import { useActionStore } from "@/lib/actions/action-store";
import { useCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";
import { CompactEmpty, GembaStatusBadge, GembaTabBar, ObservationCard, OBSERVATION_TYPE_STYLE } from "./gemba-components";
import { canConductGembaWalk, canViewGembaWalk } from "./gemba-access";
import { startGembaWalk, useGembaStore } from "./gemba-store";
import { formatGembaZoneLabel } from "./gemba-zone-labels";
import type { GembaObservationType } from "./types";

type DetailTab = "overview" | "observations" | "actions" | "activity";

export default function GembaDetailPage({ walkId, initialTab }: { walkId: string; initialTab?: string }) {
  const router = useRouter();
  const state = useGembaStore();
  const allActions = useActionStore();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const candidate = state.walks.find((item) => item.id === walkId);
  const walk = candidate && canViewGembaWalk(candidate, currentUser, adminUser?.roles) ? candidate : undefined;
  const observations = useMemo(() => state.observations.filter((item) => item.gembaId === walkId), [state.observations, walkId]);
  const actions = walk ? allActions.filter((action) => walk.actionIds.includes(action.id)) : [];
  const url = useUrlState();
  const requestedTab = url.params.get("tab") ?? initialTab;
  const active: DetailTab = ["overview", "observations", "actions", "activity"].includes(requestedTab as DetailTab) ? requestedTab as DetailTab : "overview";
  const setActive = (tab: DetailTab) => url.update({tab});
  const [observationFilter, setObservationFilter] = useState<"All" | GembaObservationType>("All");

  if (!walk) return <PageContainer><FiveSPageHeader eyebrow="Gemba" title="Walk not found" description="This Gemba walk does not exist or is no longer available." /><Button className="w-fit" nativeButton={false} render={<Link href="/gemba" />}>Return to Gemba</Button></PageContainer>;
  const filteredObservations = observationFilter === "All" ? observations : observations.filter((item) => item.type === observationFilter);
  const counts = (["Positive", "Opportunity", "Issue"] as GembaObservationType[]).map((type) => ({ type, value: observations.filter((item) => item.type === type).length }));

  return <PageContainer className="max-w-none">
    <FiveSPageHeader eyebrow={`Gemba Walk · ${walk.id}`} title={walk.purpose} description={`${walk.plant} · ${formatGembaZoneLabel(walk.zone)} · Lead: ${walk.leadName}`} leading={<Button size="icon-sm" variant="ghost" nativeButton={false} render={<Link href="/gemba" />} aria-label="Back to Gemba"><ArrowLeft className="size-4" /></Button>} actions={<><RecordDeletionMenu module="gemba" recordId={walk.id} returnTo="/gemba" />{walk.status === "Scheduled" && canConductGembaWalk(adminUser?.roles, currentUser) && <Button onClick={() => { startGembaWalk(walk.id, currentUser); router.push(`/gemba/${walk.id}/walk`); }}><Play className="size-4" />Start Walk</Button>}{walk.status === "In Progress" && canConductGembaWalk(adminUser?.roles, currentUser) && <Button nativeButton={false} render={<Link href={`/gemba/${walk.id}/walk`} />}><Footprints className="size-4" />Continue Walk</Button>}{walk.status === "Completed" && <Button variant="outline" nativeButton={false} render={<Link href={`/gemba/${walk.id}/report`} />}><FileText className="size-4" />View Report</Button>}<GembaStatusBadge status={walk.status} /></>} />

    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4"><DetailMetric label="Observations" value={observations.length} /><DetailMetric label="Positive" value={counts.find((item) => item.type === "Positive")?.value ?? 0} tone="positive" /><DetailMetric label="Issues" value={counts.find((item) => item.type === "Issue")?.value ?? 0} tone="issue" /><DetailMetric label="Actions Created" value={actions.length} tone="action" /></section>
    <GembaTabBar active={active} onChange={(id) => setActive(id as DetailTab)} label="Walk details" tabs={[{ id: "overview", label: "Overview" }, { id: "observations", label: "Observations", count: observations.length }, { id: "actions", label: "Actions", count: actions.length }, { id: "activity", label: "Activity", count: walk.activity.length }]} />

    {active === "overview" && <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)]"><Card className="gap-0"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Walk Overview</CardTitle></CardHeader><CardContent className="grid gap-x-8 gap-y-5 p-5 sm:grid-cols-2"><Meta icon={<FileText />} label="Walk ID" value={walk.id} mono /><Meta icon={<MapPin />} label="Plant / Zone" value={`${walk.plant} · ${formatGembaZoneLabel(walk.zone)}`} /><Meta icon={<Users />} label="Walk Lead" value={walk.leadName} /><Meta icon={<Users />} label="Participants" value={walk.participants.length ? walk.participants.map((item) => item.name).join(", ") : "No participants selected"} /><Meta icon={<CalendarDays />} label="Scheduled Date" value={walk.scheduledTime ? `${formatShortDate(walk.scheduledDate)} · ${walk.scheduledTime}` : formatShortDate(walk.scheduledDate)} /><Meta icon={<Clock3 />} label="Duration" value={durationLabel(walk.startedAt, walk.completedAt)} /><div className="sm:col-span-2"><Meta icon={<Eye />} label="Purpose" value={walk.purpose} /></div>{walk.notes && <div className="sm:col-span-2"><Meta icon={<FileText />} label="Notes" value={walk.notes} /></div>}</CardContent></Card><Card className="gap-0"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Observation Summary</CardTitle></CardHeader><CardContent className="grid gap-3 p-5">{counts.map((item) => <div key={item.type} className="flex items-center justify-between rounded-lg border bg-muted/[0.12] px-3 py-2.5"><span className="inline-flex items-center gap-2 text-sm"><span className={cn("size-2 rounded-full", OBSERVATION_TYPE_STYLE[item.type].dot)} />{item.type}</span><strong className="tabular-nums">{item.value}</strong></div>)}<div className="flex items-center justify-between border-t pt-3 text-sm"><span className="text-muted-foreground">Converted to actions</span><strong className="text-primary">{actions.length}</strong></div></CardContent></Card></div>}

    {active === "observations" && <div className="grid gap-4"><div className="flex min-w-0 gap-1 overflow-x-auto">{(["All", "Positive", "Opportunity", "Issue"] as const).map((item) => <Button key={item} size="sm" variant={observationFilter === item ? "secondary" : "ghost"} onClick={() => setObservationFilter(item)}>{item}<span className="ml-1 tabular-nums text-muted-foreground">{item === "All" ? observations.length : counts.find((count) => count.type === item)?.value}</span></Button>)}</div><div className="grid gap-3">{filteredObservations.map((observation) => <ObservationCard key={observation.id} observation={observation} action={observation.actionId ? actions.find((item) => item.id === observation.actionId) : undefined} />)}{filteredObservations.length === 0 && <Card className="gap-0"><CompactEmpty title="No observations in this view" description="Choose another observation type to see the walk record." /></Card>}</div></div>}

    {active === "actions" && <Card className="min-w-0 gap-0 overflow-hidden"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-sm"><thead className="border-b bg-muted/25 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Action</th><th className="px-4 py-3">Observation</th><th className="px-4 py-3">Action Owner</th><th className="px-4 py-3">Priority</th><th className="px-4 py-3">Due Date</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-border/65">{actions.map((action) => <tr key={action.id} className="hover:bg-muted/25"><td className="max-w-xs px-4 py-3"><ActionLink className="block truncate text-xs font-medium hover:underline" href={`/actions/${action.id}`}>{action.title}</ActionLink><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{action.id}</p></td><td className="px-4 py-3 font-mono text-xs text-muted-foreground">{action.sourceObservationId ?? "—"}</td><td className="px-4 py-3 text-xs">{action.responsiblePersonName ?? action.assignedTo}</td><td className="px-4 py-3"><Badge variant={ACTION_PRIORITY_CONFIG[action.priority].variant}>{action.priority}</Badge></td><td className="whitespace-nowrap px-4 py-3 text-xs">{formatShortDate(action.dueDate)}</td><td className="px-4 py-3"><Badge variant={ACTION_STATUS_CONFIG[action.status].variant}>{action.status}</Badge></td></tr>)}</tbody></table></div><div className="grid gap-2 p-3 md:hidden">{actions.map((action) => <ActionLink href={`/actions/${action.id}`} key={action.id} className="rounded-lg border bg-background p-4"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm font-semibold">{action.title}</p><Badge variant={ACTION_PRIORITY_CONFIG[action.priority].variant}>{action.priority}</Badge></div><p className="mt-1 font-mono text-[10px] text-muted-foreground">{action.id} · {action.sourceObservationId}</p><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{action.responsiblePersonName ?? action.assignedTo}</span><Badge variant={ACTION_STATUS_CONFIG[action.status].variant}>{action.status}</Badge></div></ActionLink>)}</div>{actions.length === 0 && <CompactEmpty title="No actions created" description="Opportunity and issue observations can be converted to Actions without duplicating the work record." />}</Card>}

    {active === "activity" && <Card className="gap-0 overflow-hidden"><CardContent className="p-4 sm:p-5"><OpsTimeline items={[...walk.activity].sort((a, b) => b.at.localeCompare(a.at)).map((item) => ({ id: item.id, title: item.label, actor: item.userName, timestamp: item.at, linkedRecord: item.observationId ? <Link href={`/gemba/${walk.id}?tab=observations#${item.observationId}`} className="font-mono text-primary hover:underline">{item.observationId}</Link> : item.actionId ? <ActionLink href={`/actions/${item.actionId}`} className="font-mono text-primary hover:underline">{item.actionId}</ActionLink> : undefined }))} /></CardContent></Card>}
  </PageContainer>;
}

function DetailMetric({ label, value, tone = "neutral" }: { label: string; value: number; tone?: "neutral" | "positive" | "issue" | "action" }) { const color = { neutral: "bg-slate-400", positive: "bg-emerald-500", issue: "bg-red-500", action: "bg-sky-500" }; return <div className="relative overflow-hidden rounded-xl border bg-card p-3 shadow-sm"><span className={cn("absolute inset-y-3 left-0 w-0.5 rounded-r-full", color[tone])} /><p className="truncate text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>; }
function Meta({ icon, label, value, mono = false }: { icon: React.ReactElement; label: string; value: string; mono?: boolean }) { return <div className="flex min-w-0 items-start gap-2.5"><span className="mt-0.5 text-muted-foreground [&>svg]:size-4">{icon}</span><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className={cn("mt-1 text-sm leading-5", mono && "font-mono text-xs")}>{value}</p></div></div>; }
function durationLabel(start?: string, end?: string) { if (!start) return "Not started"; const minutes = Math.max(0, Math.round(((end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()) / 60_000)); return end ? `${minutes} minutes` : `${minutes} minutes so far`; }
