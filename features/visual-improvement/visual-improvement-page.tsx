"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { useListingFilter } from "@/lib/navigation/use-listing-filter";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { newestCreatedFirst, compareNewestCreated, compareOldestCreated } from "@/lib/records/record-order";


import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, BarChart3, Plus, Search, Sparkles } from "lucide-react";
import { OpsListingLayout as PageContainer } from "@/components/ops/ops-listing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { useCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";
import { canCreateVisualImprovement, canViewVisualImprovement } from "./visual-improvement-access";
import { VISUAL_IMPROVEMENT_CATEGORIES, VISUAL_IMPROVEMENT_STATUSES } from "./visual-improvement-config";
import { formatBenefit, formatVisualDate, formatVisualMoney, TransformationCard, VisualImprovementEmpty, VisualImprovementStatusBadge, VisualImprovementTabs } from "./visual-improvement-components";
import { getVisualImprovementSummary, useVisualImprovements } from "./visual-improvement-store";
import type { VisualImprovement, VisualImprovementStatus } from "./types";

type LandingTab = "overview" | "improvements" | "gallery" | "awaiting-review" | "completed";
type SortMode = "Newest" | "Oldest" | "Highest Saving" | "Recently Completed";
type DateFilter = "All dates" | "This Month" | "Last 30 Days";
type SavingFilter = "Any benefit" | "With saving" | "Non-financial";

function validTab(value?: string): LandingTab {
  return (["overview", "improvements", "gallery", "awaiting-review", "completed"] as LandingTab[]).includes(value as LandingTab) ? value as LandingTab : "improvements";
}

export default function VisualImprovementPage({ initialTab, initialStatus }: { initialTab?: string; initialStatus?: string }) {
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const all = useVisualImprovements();
  const visible = useMemo(() => all.filter((item) => canViewVisualImprovement(adminUser, currentUser, item)), [adminUser, all, currentUser]);
  const url = useUrlState();
  const active = validTab(url.params.get("tab") ?? initialTab);
  const setActive = (value: LandingTab) => url.update({ tab: value, status: "All" }, "push");
  const mayCreate = canCreateVisualImprovement(adminUser, currentUser);
  const summary = getVisualImprovementSummary(visible);
  const awaiting = visible.filter((item) => item.status === "Awaiting Review");
  const completed = visible.filter((item) => item.status === "Completed");
  const initialStatusValue = VISUAL_IMPROVEMENT_STATUSES.includes(initialStatus as VisualImprovementStatus) ? initialStatus as VisualImprovementStatus : "All";

  return <PageContainer className="max-w-none">
    <FiveSPageHeader eyebrow="OPS Workspace" title="Visual Improvement" description="Capture workplace improvements through clear before-and-after evidence." actions={mayCreate ? <Button nativeButton={false} render={<Link href="/visual-improvement/new" />}><Plus className="size-4" />Add Visual Improvement</Button> : undefined} />

    <VisualImprovementTabs active={active} onChange={(value) => setActive(value as LandingTab)} tabs={[
      { id: "overview", label: "Overview" },
      { id: "improvements", label: "All", count: visible.length },
      { id: "gallery", label: "Gallery", count: completed.length },
      { id: "awaiting-review", label: "Awaiting Review", count: awaiting.length },
      { id: "completed", label: "Completed", count: completed.length },
    ]} />

    <section aria-label="Visual Improvement summary" className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card shadow-sm sm:grid-cols-5">
      <Metric label="Active Improvements" value={String(summary.active)} tone="info" />
      <Metric label="Completed This Month" value={String(summary.completedThisMonth)} tone="success" />
      <Metric label="Awaiting Review" value={String(summary.awaitingReview)} tone="warning" />
      <Metric label="Estimated Savings" value={formatVisualMoney(summary.estimatedSavings)} tone="success" />
      <Metric label="Areas Improved" value={String(summary.areasImproved)} tone="info" />
    </section>



    {active === "overview" && <VisualOverview records={visible} mayCreate={mayCreate} />}
    {active === "improvements" && <ImprovementLibrary records={visible} initialStatus={initialStatusValue} mayCreate={mayCreate} />}
    {active === "gallery" && <Gallery records={completed} />}
    {active === "awaiting-review" && <ImprovementLibrary records={awaiting} initialStatus="All" mayCreate={mayCreate} compactFilters />}
    {active === "completed" && <ImprovementLibrary records={completed} initialStatus="All" mayCreate={mayCreate} compactFilters />}
  </PageContainer>;
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "info" | "success" | "warning" }) {
  const tones = { info: "bg-sky-500", success: "bg-emerald-500", warning: "bg-amber-500" };
  return <div className="relative min-w-0 border-b p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0 sm:p-4"><span className={cn("absolute inset-y-3 left-0 w-0.5 rounded-r-full", tones[tone])} /><p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p><p className="mt-1 truncate text-xl font-semibold tabular-nums text-foreground" title={value}>{value}</p></div>;
}

function VisualOverview({ records, mayCreate }: { records: VisualImprovement[]; mayCreate: boolean }) {
  const completed = newestCreatedFirst(records.filter((item) => item.status === "Completed"));
  const categoryCounts = VISUAL_IMPROVEMENT_CATEGORIES.map((category) => ({ label: category, value: records.filter((item) => item.category === category).length })).filter((item) => item.value).sort((a, b) => b.value - a.value).slice(0, 5);
  const zoneCounts = Array.from(new Set(records.map((item) => item.zone))).map((zone) => ({ label: zone, value: records.filter((item) => item.zone === zone).length })).sort((a, b) => b.value - a.value);
  const maxCategory = Math.max(1, ...categoryCounts.map((item) => item.value));
  const maxZone = Math.max(1, ...zoneCounts.map((item) => item.value));
  const savings = getVisualImprovementSummary(records).totalSavings;
  return <div className="grid min-w-0 gap-4 xl:grid-cols-12">
    <Card className="min-w-0 gap-0 xl:col-span-5"><CardHeader className="border-b pb-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary"><BarChart3 className="size-4" /></span><div><CardTitle className="text-[15px]">Top Improvement Categories</CardTitle><p className="mt-1 text-xs text-muted-foreground">Where visible changes are being made</p></div></div></CardHeader><CardContent className="grid gap-4 p-5">{categoryCounts.map((item) => <Bar key={item.label} {...item} max={maxCategory} />)}</CardContent></Card>
    <Card className="min-w-0 gap-0 xl:col-span-3"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Improvements by Zone</CardTitle><p className="text-xs text-muted-foreground">Current module activity</p></CardHeader><CardContent className="grid gap-4 p-5">{zoneCounts.map((item) => <Bar key={item.label} {...item} max={maxZone} />)}</CardContent></Card>
    <Card className="min-w-0 gap-0 xl:col-span-4"><CardHeader className="border-b pb-4"><CardTitle className="text-[15px]">Measured Benefits</CardTitle><p className="text-xs text-muted-foreground">Completed improvements only</p></CardHeader><CardContent className="grid gap-4 p-5"><div className="rounded-xl bg-emerald-500/[0.07] p-4"><p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Total realized saving</p><p className="mt-2 text-2xl font-semibold text-emerald-700 dark:text-emerald-300">{formatVisualMoney(savings)}</p></div><div className="grid grid-cols-2 gap-3"><SmallStat label="Completed" value={String(completed.length)} /><SmallStat label="Non-financial" value={String(completed.filter((item) => item.actualCostSaving === undefined).length)} /></div><p className="text-xs leading-5 text-muted-foreground">Financial and practical benefits remain visible together so smaller workplace wins are not overlooked.</p></CardContent></Card>
    <section className="min-w-0 xl:col-span-12" aria-labelledby="recent-transformations"><div className="mb-3 flex items-end justify-between gap-3"><div><div className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /><h2 id="recent-transformations" className="text-sm font-semibold">Recent Transformations</h2></div><p className="mt-1 text-xs text-muted-foreground">The latest completed before-and-after improvements</p></div>{completed.length > 3 && <span className="text-xs text-muted-foreground">Showing 3 of {completed.length}</span>}</div>{completed.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{completed.slice(0, 3).map((item) => <TransformationCard key={item.id} item={item} />)}</div> : <Card><VisualImprovementEmpty action={mayCreate ? <Button size="sm" nativeButton={false} render={<Link href="/visual-improvement/new" />}><Plus className="size-3.5" />Add Visual Improvement</Button> : undefined} /></Card>}</section>
  </div>;
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return <div><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate text-muted-foreground">{label}</span><span className="font-semibold tabular-nums">{value}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: `${Math.max(value ? 8 : 0, value / max * 100)}%` }} /></div></div>;
}
function SmallStat({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-background p-3"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>; }

function Gallery({ records }: { records: VisualImprovement[] }) {
  const [plant, setPlant] = useState("All");
  const [zone, setZone] = useState("All");
  const [category, setCategory] = useState("All");
  const [date, setDate] = useState<DateFilter>("All dates");
  const filtered = filterRecords(records, { search: "", status: "All", plant, zone, category, owner: "All", date, saving: "Any benefit" }).filter((item) => item.afterEvidence.length);
  return <div className="grid gap-4"><Card className="gap-0"><CardContent className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4"><CompactSelect value={plant} onChange={setPlant} all="All plants" allValue="All" options={unique(records.map((item) => item.plant))} /><CompactSelect value={zone} onChange={setZone} all="All zones" allValue="All" options={unique(records.filter((item) => plant === "All" || item.plant === plant).map((item) => item.zone))} /><CompactSelect value={category} onChange={setCategory} all="All categories" allValue="All" options={VISUAL_IMPROVEMENT_CATEGORIES} /><CompactSelect value={date} onChange={(value) => setDate(value as DateFilter)} all="All dates" options={["This Month", "Last 30 Days"]} /></CardContent></Card>{filtered.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((item) => <TransformationCard key={item.id} item={item} />)}</div> : <Card><VisualImprovementEmpty title="No completed transformations found for these filters." description="Adjust the gallery filters to view more before-and-after improvements." /></Card>}</div>;
}

function ImprovementLibrary({ records, initialStatus, mayCreate, compactFilters = false }: { records: VisualImprovement[]; initialStatus: VisualImprovementStatus | "All"; mayCreate: boolean; compactFilters?: boolean }) {
  const [search, setSearch] = useListingFilter<string>("search", "");
  const [status, setStatus] = useListingFilter<VisualImprovementStatus | "All">("status", initialStatus);
  const [plant, setPlant] = useListingFilter<string>("plant", "All");
  const [zone, setZone] = useListingFilter<string>("zone", "All");
  const [category, setCategory] = useListingFilter<string>("category", "All");
  const [owner, setOwner] = useListingFilter<string>("owner", "All");
  const [date, setDate] = useListingFilter<DateFilter>("date", "All dates");
  const [saving, setSaving] = useListingFilter<SavingFilter>("saving", "Any benefit");
  const [sort, setSort] = useListingFilter<SortMode>("sort", "Newest");
  const filtered = sortRecords(filterRecords(records, { search, status: compactFilters ? "All" : status, plant, zone, category, owner, date, saving }), sort);
  return <Card className="min-w-0 gap-0 overflow-hidden"><CardContent className="grid gap-2 border-b p-3"><div className="grid gap-2 md:grid-cols-[minmax(220px,1fr)_180px_190px]"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search improvements, owners, or locations..." /></div>{!compactFilters ? <CompactSelect value={status} onChange={(value) => setStatus(value as VisualImprovementStatus | "All")} all="All statuses" allValue="All" options={VISUAL_IMPROVEMENT_STATUSES} /> : <div className="hidden md:block" />}<CompactSelect value={sort} onChange={(value) => setSort(value as SortMode)} all="Newest" options={["Oldest", "Highest Saving", "Recently Completed"]} /></div>{!compactFilters && <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6"><CompactSelect value={plant} onChange={setPlant} all="All plants" allValue="All" options={unique(records.map((item) => item.plant))} /><CompactSelect value={zone} onChange={setZone} all="All zones" allValue="All" options={unique(records.filter((item) => plant === "All" || item.plant === plant).map((item) => item.zone))} /><CompactSelect value={category} onChange={setCategory} all="All categories" allValue="All" options={VISUAL_IMPROVEMENT_CATEGORIES} /><CompactSelect value={owner} onChange={setOwner} all="All owners" allValue="All" options={unique(records.map((item) => item.ownerName))} /><CompactSelect value={date} onChange={(value) => setDate(value as DateFilter)} all="All dates" options={["This Month", "Last 30 Days"]} /><CompactSelect value={saving} onChange={(value) => setSaving(value as SavingFilter)} all="Any benefit" options={["With saving", "Non-financial"]} /></div>}{(search || status !== "All" || plant !== "All" || zone !== "All" || category !== "All" || owner !== "All" || date !== "All dates" || saving !== "Any benefit" || sort !== "Newest") && <Button className="w-fit" variant="ghost" onClick={() => { setSearch(""); setStatus("All"); setPlant("All"); setZone("All"); setCategory("All"); setOwner("All"); setDate("All dates"); setSaving("Any benefit"); setSort("Newest"); }}>Clear Filters</Button>}</CardContent>
    <div className="grid gap-3 p-3 lg:hidden">{filtered.map((item) => <article key={item.id} className="min-w-0 rounded-xl border bg-background"><Link href={`/visual-improvement/${encodeURIComponent(item.id)}`} className="block p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-[11px] font-semibold text-primary">{item.id}</p><p className="mt-1 line-clamp-2 text-sm font-semibold">{item.title}</p></div><VisualImprovementStatusBadge status={item.status} /></div><p className="mt-3 text-xs text-muted-foreground">{item.plant} · {item.zone} · {item.ownerName}</p><div className="mt-3 flex items-center justify-between gap-3 border-t pt-3 text-xs"><Badge variant="secondary">{item.category}</Badge><span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatBenefit(item)}</span></div></Link><div className="flex justify-end px-3 pb-2"><RecordDeletionMenu module="visualImprovement" recordId={item.id} /></div></article>)}</div>
    <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[1160px] text-sm"><thead className="border-b bg-muted/25 text-left text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Improvement</th><th className="px-4 py-3">Plant / Zone</th><th className="px-4 py-3">Category</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Benefit</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Updated</th><th className="px-4 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-border/65">{filtered.map((item) => <tr key={item.id} className="hover:bg-muted/25"><td className="max-w-xs px-4 py-3"><Link href={`/visual-improvement/${encodeURIComponent(item.id)}`} className="block truncate text-xs font-semibold hover:text-primary hover:underline">{item.title}</Link><span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{item.id}</span></td><td className="px-4 py-3"><p className="text-xs font-medium">{item.plant}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{item.zone}</p></td><td className="px-4 py-3"><Badge variant="secondary">{item.category}</Badge></td><td className="px-4 py-3 text-xs">{item.ownerName}</td><td className="whitespace-nowrap px-4 py-3 text-xs">{formatVisualDate(item.createdAt)}</td><td className="whitespace-nowrap px-4 py-3 text-xs font-medium">{formatBenefit(item)}</td><td className="px-4 py-3"><VisualImprovementStatusBadge status={item.status} /></td><td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatVisualDate(item.updatedAt)}</td><td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" nativeButton={false} render={<Link href={`/visual-improvement/${encodeURIComponent(item.id)}`} />}>View<ArrowRight className="size-3.5" /></Button><RecordDeletionMenu module="visualImprovement" recordId={item.id} /></td></tr>)}</tbody></table></div>
    {!filtered.length && <VisualImprovementEmpty action={mayCreate ? <Button size="sm" nativeButton={false} render={<Link href="/visual-improvement/new" />}><Plus className="size-3.5" />Add Visual Improvement</Button> : undefined} />}
  </Card>;
}

function CompactSelect({ value, onChange, all, allValue = all, options }: { value: string; onChange: (value: string) => void; all: string; allValue?: string; options: readonly string[] }) {
  return <Select searchLabel={all} value={value} onValueChange={(next) => onChange(next ?? allValue)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={allValue}>{all}</SelectItem>{options.filter((option) => option !== allValue).map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select>;
}

function unique(values: string[]) { return [...new Set(values)].sort(); }

function filterRecords(records: VisualImprovement[], filters: { search: string; status: VisualImprovementStatus | "All"; plant: string; zone: string; category: string; owner: string; date: DateFilter; saving: SavingFilter }) {
  const now = new Date();
  const start30 = new Date(now); start30.setDate(start30.getDate() - 30);
  return records.filter((item) => {
    const searchable = [item.id, item.title, item.plant, item.zone, item.location, item.category, item.ownerName].join(" ").toLowerCase();
    const itemDate = new Date(item.createdAt);
    const dateMatch = filters.date === "All dates" || (filters.date === "This Month" ? itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth() : itemDate >= start30);
    const savingMatch = filters.saving === "Any benefit" || (filters.saving === "With saving" ? typeof (item.actualCostSaving ?? item.proposedCostSaving) === "number" : item.actualCostSaving === undefined && item.proposedCostSaving === undefined);
    return searchable.includes(filters.search.toLowerCase()) && (filters.status === "All" || item.status === filters.status) && (filters.plant === "All" || item.plant === filters.plant) && (filters.zone === "All" || item.zone === filters.zone) && (filters.category === "All" || item.category === filters.category) && (filters.owner === "All" || item.ownerName === filters.owner) && dateMatch && savingMatch;
  });
}

function sortRecords(records: VisualImprovement[], sort: SortMode) {
  return [...records].sort((a, b) => sort === "Oldest" ? compareOldestCreated(a, b) : sort === "Highest Saving" ? (b.actualCostSaving ?? b.proposedCostSaving ?? -1) - (a.actualCostSaving ?? a.proposedCostSaving ?? -1) : sort === "Recently Completed" ? (b.completedAt || "").localeCompare(a.completedAt || "") : compareNewestCreated(a, b));
}
