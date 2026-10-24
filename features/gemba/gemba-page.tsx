"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { newestCreatedFirst } from "@/lib/records/record-order";

import { useListingFilter } from "@/lib/navigation/use-listing-filter";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { ActionLink } from "@/components/ops/ops-return-link";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, FileText, Footprints, Play, Plus, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OpsListingLayout as PageContainer } from "@/components/ops/ops-listing";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useAdminUsers } from "@/features/five-s/administration/store";
import type { MyAction } from "@/features/five-s/types/my-actions";
import { useActionStore } from "@/lib/actions/action-store";
import { formatShortDate } from "@/lib/actions/action-config";
import { useCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import { CompactEmpty, GembaStatusBadge, ObservationTypeBadge, OBSERVATION_TYPE_STYLE } from "./gemba-components";
import { useOrganizationConfiguration } from "@/lib/organization-store";
import ReceivedDeployments from "./received-deployments";
import { receivedGembaObservations, canConductGembaWalk, visibleGembaWalks } from "./gemba-access";
import { getGembaSummary, startGembaWalk, useGembaStore } from "./gemba-store";
import { formatGembaZoneLabel } from "./gemba-zone-labels";
import type { GembaObservation, GembaObservationType, GembaWalk } from "./types";

export function walkDestination(walk: GembaWalk, mayConduct: boolean) {
  return walk.status === "In Progress" && mayConduct ? `/gemba/${walk.id}/walk` : `/gemba/${walk.id}`;
}

type LandingTab = "overview" | "walks" | "observations";
type ObservationActionFilter = "All" | "No Action" | "Open Action" | "Completed Action";
type ObservationDateFilter = "All" | "This Month" | "Last 30 Days";

export default function GembaPage({ initialTab }: { initialTab?: string }) {
  const router = useRouter();
  const state = useGembaStore();
  const actions = useActionStore();
  const currentUser = useCurrentUser();
  const adminUsers = useAdminUsers();
  useOrganizationConfiguration();
  const received = receivedGembaObservations(state, currentUser.id);
  const url = useUrlState();
  const observationView = url.params.get("view") === "received" ? "received" : "observations";
  const setObservationView = (view: string) => url.update({view});
  const adminUser = adminUsers.find((user) => user.id === currentUser.id);
  const requestedTab = url.params.get("tab") ?? initialTab;
  const active: LandingTab = ["overview", "walks", "observations"].includes(requestedTab ?? "") ? requestedTab as LandingTab : "walks";
  const setActive = (tab: LandingTab) => url.update({tab}, "push");
  const walks = useMemo(() => visibleGembaWalks(state.walks, currentUser, adminUser?.roles), [adminUser?.roles, currentUser, state.walks]);
  const observations = useMemo(() => state.observations.filter((item) => walks.some((walk) => walk.id === item.gembaId)), [state.observations, walks]);
  const summary = getGembaSummary({ walks, observations });
  const mayConduct = canConductGembaWalk(adminUser?.roles, currentUser);

  function startDraft(walk: GembaWalk) {
    startGembaWalk(walk.id, currentUser);
    router.push(`/gemba/${encodeURIComponent(walk.id)}/walk`);
  }

  return <PageContainer className="max-w-none">
    <FiveSPageHeader eyebrow="OPS Workspace" title="Gemba" description="Observe work where it happens, capture insight quickly, and turn follow-up into action." actions={mayConduct ? <Button nativeButton={false} render={<Link href="/gemba/new" />}><Plus className="size-4" />Start Gemba Walk</Button> : undefined} />

    <OpsTabBar
      label="Gemba sections"
      active={active}
      onChange={(id) => setActive(id as LandingTab)}
      tabs={[
        { id: "overview", label: "Overview" },
        { id: "walks", label: "All Walks", count: walks.length },
        { id: "observations", label: "All Observations", count: observations.length },
      ]}
    />

    <section aria-label="Gemba summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      <Metric label="Walks This Month" value={summary.walksThisMonth} tone="info" />
      <Metric label="Open Observations" value={summary.openObservations} tone={summary.openObservations ? "warning" : "success"} />
      <Metric label="Actions Created" value={summary.actionsCreated} tone="info" />
      <Metric label="Completed Walks" value={summary.completedWalks} tone="success" />
      <Metric label="Positive Observations" value={summary.positiveObservations} tone="success" />
    </section>

    {active === "overview" && <GembaOverview walks={walks} observations={observations} actionsCreated={summary.actionsCreated} />}
    {active === "walks" && <WalkLibrary walks={walks} mayConduct={mayConduct} onStart={startDraft} />}
    {active === "observations" && <div className="grid gap-4"><OpsTabBar label="Observation views" active={observationView} onChange={setObservationView} tabs={[{ id: "observations", label: "All Observations", count: observations.length }, { id: "received", label: "Received Deployments", count: received.length }]} />{observationView === "received" ? <ReceivedDeployments observations={received} /> : <ObservationLibrary walks={walks} observations={observations} actions={actions} />}</div>}
  </PageContainer>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: "info" | "success" | "warning" }) {
  const tones = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500" };
  return <div className="relative min-w-0 overflow-hidden rounded-xl border bg-card p-3 shadow-sm"><span className={cn("absolute inset-y-3 left-0 w-0.5 rounded-r-full", tones[tone])} /><p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold leading-none tabular-nums">{value}</p></div>;
}

function GembaOverview({ walks, observations, actionsCreated }: { walks: GembaWalk[]; observations: GembaObservation[]; actionsCreated: number }) {
  const mix = (["Positive", "Opportunity", "Issue"] as GembaObservationType[]).map((type) => ({ type, value: observations.filter((item) => item.type === type).length }));
  const maxMix = Math.max(1, ...mix.map((item) => item.value));
  const zones = Array.from(new Set(walks.map((walk) => walk.zone))).map((zone) => ({ zone, value: observations.filter((item) => walks.find((walk) => walk.id === item.gembaId)?.zone === zone).length })).sort((a, b) => b.value - a.value).slice(0, 4);
  const maxZone = Math.max(1, ...zones.map((item) => item.value));
  const recent = newestCreatedFirst(walks).slice(0, 4);
  return <div className="grid min-w-0 gap-4 xl:grid-cols-12">
    <Card className="min-w-0 gap-0 xl:col-span-4"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Observation Mix</CardTitle><p className="text-xs text-muted-foreground">What teams are seeing on the floor</p></CardHeader><CardContent className="grid gap-4 p-5">{mix.map((item) => <div key={item.type}><div className="flex items-center justify-between gap-3 text-xs"><span className="inline-flex items-center gap-2 text-muted-foreground"><span className={cn("size-2 rounded-full", OBSERVATION_TYPE_STYLE[item.type].dot)} />{item.type}</span><span className="font-semibold tabular-nums">{item.value}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full", OBSERVATION_TYPE_STYLE[item.type].dot)} style={{ width: `${(item.value / maxMix) * 100}%` }} /></div></div>)}</CardContent></Card>
    <Card className="min-w-0 gap-0 xl:col-span-4"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Top Zones by Observations</CardTitle><p className="text-xs text-muted-foreground">Areas with the most captured insight</p></CardHeader><CardContent className="grid gap-4 p-5">{zones.map((item) => <div key={item.zone}><div className="flex justify-between gap-3 text-xs"><span className="text-muted-foreground">{formatGembaZoneLabel(item.zone)}</span><span className="font-semibold tabular-nums">{item.value}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: `${(item.value / maxZone) * 100}%` }} /></div></div>)}{zones.length === 0 && <p className="text-xs text-muted-foreground">No zone observations yet.</p>}</CardContent></Card>
    <Card className="min-w-0 gap-0 xl:col-span-4"><CardHeader className="border-b pb-4"><div className="flex items-start justify-between gap-3"><div><CardTitle className="text-[15px]">Actions from Gemba</CardTitle><p className="mt-1 text-xs text-muted-foreground">Follow-up created from observations</p></div><p className="text-2xl font-semibold tabular-nums text-primary">{actionsCreated}</p></div></CardHeader><CardContent className="p-0"><div className="divide-y divide-border/65">{recent.map((walk) => <Link href={`/gemba/${encodeURIComponent(walk.id)}`} key={walk.id} className="group flex min-w-0 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary"><Footprints className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{formatGembaZoneLabel(walk.zone)} · {walk.purpose}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{walk.id} · {formatShortDate(walk.scheduledDate)}</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" /></Link>)}</div></CardContent></Card>
  </div>;
}

function WalkLibrary({ walks, mayConduct, onStart }: { walks: GembaWalk[]; mayConduct: boolean; onStart: (walk: GembaWalk) => void }) {
  const router = useRouter();
  const [search, setSearch] = useListingFilter<string>("walk-search", "");
  const [status, setStatus] = useListingFilter<string>("walk-status", "All");
  const filtered = newestCreatedFirst(walks).filter((walk) => (status === "All" || walk.status === status) && [walk.id, walk.plant, walk.zone, walk.leadName, walk.purpose].join(" ").toLowerCase().includes(search.toLowerCase()));
  return <Card className="min-w-0 gap-0 overflow-hidden">
    <CardContent className="grid gap-2 border-b p-3 sm:grid-cols-[minmax(240px,1fr)_180px]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search walks, zone, or lead..." /></div><Select value={status} onValueChange={(value) => setStatus(value ?? "All")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">All statuses</SelectItem><SelectItem value="Scheduled">Scheduled</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem></SelectContent></Select>{(search || status !== "All") && <Button variant="ghost" onClick={() => { setSearch(""); setStatus("All"); }}>Clear Filters</Button>}</CardContent>
    <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1100px] text-sm"><thead className="border-b bg-muted/25 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Walk ID</th><th className="px-4 py-3">Plant / Zone</th><th className="px-4 py-3">Lead</th><th className="px-4 py-3">Participants</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Observations</th><th className="px-4 py-3">Actions</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border/65">{filtered.map((walk) => { const destination = walkDestination(walk, mayConduct); return <tr key={walk.id} tabIndex={0} role="link" aria-label={`Open ${walk.id}`} onClick={() => router.push(destination)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); router.push(destination); } }} className="cursor-pointer outline-none hover:bg-muted/25 focus-visible:bg-muted/25 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><td className="px-4 py-3 font-mono text-xs font-medium">{walk.id}</td><td className="px-4 py-3"><p className="text-xs font-medium">{walk.plant}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{formatGembaZoneLabel(walk.zone)}</p></td><td className="px-4 py-3 text-xs">{walk.leadName}</td><td className="px-4 py-3 text-xs tabular-nums">{walk.participants.length}</td><td className="whitespace-nowrap px-4 py-3 text-xs">{formatShortDate(walk.scheduledDate)}</td><td className="px-4 py-3 text-xs tabular-nums">{walk.observationIds.length}</td><td className="px-4 py-3 text-xs tabular-nums">{walk.actionIds.length}</td><td className="px-4 py-3"><GembaStatusBadge status={walk.status} /></td><td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatShortDate(walk.updatedAt)}</td><td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><div className="flex justify-end gap-1">{walk.status === "Scheduled" && mayConduct ? <Button size="sm" variant="outline" onClick={() => onStart(walk)}><Play className="size-3.5" />Start</Button> : walk.status === "In Progress" && mayConduct ? <Button size="sm" nativeButton={false} render={<Link href={`/gemba/${walk.id}/walk`} />}><Footprints className="size-3.5" />Continue</Button> : <Button size="icon-sm" variant="ghost" nativeButton={false} render={<Link href={`/gemba/${walk.id}`} />} aria-label={`View ${walk.id}`}><Eye className="size-4" /></Button>}{walk.status === "Completed" && <Button size="icon-sm" variant="ghost" nativeButton={false} render={<Link href={`/gemba/${walk.id}/report`} />} aria-label={`Report for ${walk.id}`}><FileText className="size-4" /></Button>}<RecordDeletionMenu module="gemba" recordId={walk.id} /></div></td></tr>; })}</tbody></table></div>
    <div className="grid gap-2 p-3 lg:hidden">{filtered.map((walk) => <article key={walk.id} className="min-w-0 rounded-xl border bg-background"><Link href={walkDestination(walk, mayConduct)} className="block p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs font-semibold">{walk.id}</p><p className="mt-1 line-clamp-2 text-sm font-medium">{walk.purpose}</p></div><GembaStatusBadge status={walk.status} /></div><p className="mt-3 text-xs text-muted-foreground">{walk.plant} · {formatGembaZoneLabel(walk.zone)} · {formatShortDate(walk.scheduledDate)}</p><div className="mt-3 flex gap-4 text-xs"><span><strong>{walk.observationIds.length}</strong> observations</span><span><strong>{walk.actionIds.length}</strong> actions</span></div></Link><div className="flex justify-end px-3 pb-2"><RecordDeletionMenu module="gemba" recordId={walk.id} /></div></article>)}</div>
    {filtered.length === 0 && <CompactEmpty title="No Gemba walks found" description="Try changing the current search or status filter." />}
  </Card>;
}

function ObservationLibrary({ walks, observations, actions }: { walks: GembaWalk[]; observations: GembaObservation[]; actions: MyAction[] }) {
  const [search, setSearch] = useListingFilter<string>("observation-search", "");
  const [plant, setPlant] = useListingFilter<string>("observation-plant", "All");
  const [zone, setZone] = useListingFilter<string>("observation-zone", "All");
  const [type, setType] = useListingFilter<"All" | GembaObservationType>("observation-type", "All");
  const [date, setDate] = useListingFilter<ObservationDateFilter>("observation-date", "All");
  const [action, setAction] = useListingFilter<ObservationActionFilter>("observation-action", "All");
  const plants = Array.from(new Set(walks.map((walk) => walk.plant))).sort();
  const zones = Array.from(new Set(walks.filter((walk) => plant === "All" || walk.plant === plant).map((walk) => walk.zone))).sort();
  const now = new Date();
  const actionMap = new Map(actions.map((item) => [item.id, item]));
  const filtered = newestCreatedFirst(observations).filter((item) => {
    const walk = walks.find((candidate) => candidate.id === item.gembaId);
    if (!walk) return false;
    const itemDate = new Date(item.createdAt);
    const last30 = new Date(now); last30.setDate(last30.getDate() - 30);
    return [item.id, item.title, item.description, item.location, walk.id].join(" ").toLowerCase().includes(search.toLowerCase())
      && (plant === "All" || walk.plant === plant) && (zone === "All" || walk.zone === zone) && (type === "All" || item.type === type)
      && (action === "All" || (action === "No Action" ? !item.actionId : action === "Completed Action" ? item.actionId ? actionMap.get(item.actionId)?.status === "Completed" : false : item.actionId ? actionMap.get(item.actionId)?.status !== "Completed" : false))
      && (date === "All" || (date === "This Month" ? itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth() : itemDate >= last30));
  });
  return <Card className="min-w-0 gap-0 overflow-hidden">
    <CardContent className="border-b p-3"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-[minmax(220px,1fr)_repeat(5,minmax(135px,.45fr))]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search observations..." /></div><LibrarySelect value={plant} onChange={(value) => { setPlant(value); setZone("All"); }} options={plants} all="All plants" /><LibrarySelect value={zone} onChange={setZone} options={zones} all="All zones" /><LibrarySelect value={type} onChange={(value) => setType(value as typeof type)} options={["Positive", "Opportunity", "Issue"]} all="All types" /><LibrarySelect value={date} onChange={(value) => setDate(value as ObservationDateFilter)} options={["This Month", "Last 30 Days"]} all="Any date" /><LibrarySelect value={action} onChange={(value) => setAction(value as ObservationActionFilter)} options={["No Action", "Open Action", "Completed Action"]} all="Any action status" /></div>{(search || plant !== "All" || zone !== "All" || type !== "All" || date !== "All" || action !== "All") && <Button variant="ghost" className="mt-2" onClick={() => { setSearch(""); setPlant("All"); setZone("All"); setType("All"); setDate("All"); setAction("All"); }}>Clear Filters</Button>}</CardContent>
    <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[880px] text-sm"><thead className="border-b bg-muted/25 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Observation</th><th className="px-4 py-3">Walk</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Location</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Date</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border/65">{filtered.map((item) => { const walk = walks.find((candidate) => candidate.id === item.gembaId)!; const linkedAction = item.actionId ? actionMap.get(item.actionId) : undefined; return <tr key={item.id} className="hover:bg-muted/25"><td className="max-w-sm px-4 py-3"><Link href={`/gemba/${walk.id}?tab=observations#${item.id}`} className="block truncate text-xs font-medium hover:underline">{item.title}</Link><p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.id}</p></td><td className="px-4 py-3 font-mono text-xs"><Link href={`/gemba/${walk.id}`} className="hover:underline">{walk.id}</Link></td><td className="px-4 py-3"><ObservationTypeBadge type={item.type} /></td><td className="px-4 py-3 text-xs text-muted-foreground">{formatGembaZoneLabel(walk.zone)} · {item.location}</td><td className="px-4 py-3">{item.actionId ? <ActionLink href={`/actions/${item.actionId}`}><Badge variant={linkedAction?.status === "Completed" ? "success" : linkedAction ? "info" : "secondary"}>{linkedAction?.status ?? item.actionId}</Badge></ActionLink> : <span className="text-xs text-muted-foreground">None</span>}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatShortDate(item.createdAt)}</td><td className="px-4 py-3 text-right"><RecordDeletionMenu module="gembaObservation" recordId={item.id} /></td></tr>; })}</tbody></table></div>
    <div className="grid gap-2 p-3 md:hidden">{filtered.map((item) => <article key={item.id} className="min-w-0 rounded-xl border bg-background"><Link href={`/gemba/${item.gembaId}?tab=observations#${item.id}`} className="block p-4"><div className="flex items-start justify-between gap-3"><p className="line-clamp-2 text-sm font-semibold">{item.title}</p><ObservationTypeBadge type={item.type} /></div><p className="mt-2 text-xs text-muted-foreground">{item.gembaId} · {item.location}</p><div className="mt-3 flex items-center justify-between"><span className="font-mono text-[10px] text-muted-foreground">{item.id.split("-").slice(-2).join("-")}</span>{item.actionId && <Badge variant="info">Action linked</Badge>}</div></Link><div className="flex justify-end px-3 pb-2"><RecordDeletionMenu module="gembaObservation" recordId={item.id} /></div></article>)}</div>
    {filtered.length === 0 && <CompactEmpty title="No observations match" description="Adjust the filters to find a repeated pattern or observation." />}
  </Card>;
}

function LibrarySelect({ value, onChange, options, all }: { value: string; onChange: (value: string) => void; options: string[]; all: string }) {
  return <Select searchLabel={all} value={value} onValueChange={(next) => onChange(next ?? "All")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="All">{all}</SelectItem>{options.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>;
}
