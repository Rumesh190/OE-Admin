"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Download,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { useUrlState } from "@/lib/navigation/use-url-state";
import { OpsListingLayout as PageContainer } from "@/components/ops/ops-listing";
import { OpsEmptyState } from "@/components/ops/ops-empty-state";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { getRoleVisibleActions } from "@/features/actions/action-center-data";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { canSeeImprovement, useImprovements } from "@/features/five-s/continuous-improvement/store";
import { useGembaStore } from "@/features/gemba/gemba-store";
import { visibleGembaWalks } from "@/features/gemba/gemba-access";
import { visibleRedFlags } from "@/features/red-flag/red-flag-access";
import { useRedFlagStore } from "@/features/red-flag/red-flag-store";
import { useRedTags } from "@/features/five-s/red-tag/store";
import { useVisualManagementStore } from "@/features/visual-management/visual-management-store";
import { visibleVisualManagementBoards, visibleVisualManagementMeetings } from "@/features/visual-management/visual-management-access";
import { useActionStore } from "@/lib/actions/action-store";
import { useCurrentUser } from "@/lib/current-user";
import { useFiveSAuditStore } from "@/lib/five-s/audit-store";
import { useModuleEntitlements } from "@/lib/module-entitlements";
import { formatOpsDate } from "@/lib/ops-formatters";
import {
  buildReportLibrary,
  filterReportLibrary,
  getEnabledReportModules,
  type ReportLibraryFilters,
  type ReportLibraryItem,
  type ReportStatus,
} from "./report-data";
import { downloadCsv } from "./report-export";
import { getReportType, type ReportModuleId } from "./report-registry";
import { reportLibraryToCsv } from "./report-summary-data";

type ReportTab = "all" | ReportModuleId;

const DEFAULT_FILTERS: ReportLibraryFilters = {
  search: "", module: "All", plant: "All", zone: "All", dateFrom: "", dateTo: "",
  generatedBy: "All", status: "All", sort: "Newest",
};

function validTab(value: string | undefined): ReportTab {
  const aliases: Record<string, ReportTab> = { audits: "audit", improvements: "continuousImprovement" };
  const normalized = value ? aliases[value] ?? value : "all";
  return ["all", "audit", "actions", "continuousImprovement", "redTag", "visualManagement", "gemba"].includes(normalized) ? normalized as ReportTab : "all";
}

function ExportMenu({ exportVisibleList, hasReports }: { exportVisibleList: () => void; hasReports: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Download className="size-4" />
        Export
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Current report list</DropdownMenuLabel>
          <DropdownMenuItem onClick={exportVisibleList} disabled={!hasReports}>
            <FileSpreadsheet className="size-4" />
            Export visible rows (.csv)
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ReportsPage({ initialTab, initialSearch = "", initialSort }: { initialTab?: string; initialSearch?: string; initialSort?: string }) {
  const access = useModuleEntitlements();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const audits = useFiveSAuditStore();
  const allActions = useActionStore();
  const allImprovements = useImprovements();
  const allRedFlags = useRedFlagStore();
  const redTags = useRedTags();
  const visualManagement = useVisualManagementStore();
  const allGemba = useGembaStore();
  const enabledModules = getEnabledReportModules(access);
  const url = useUrlState();
  const requestedTab = validTab(url.params.get("tab") ?? initialTab);
  const safeInitialTab = requestedTab === "all" || enabledModules.some((module) => module.id === requestedTab) ? requestedTab : "all";
  const activeTab = safeInitialTab;
  function setActiveTab(value: ReportTab) { url.update({ tab: value }, "push"); setFilters(current => ({ ...current, module: "All" })); }
  const [filters, setFilters] = useState<ReportLibraryFilters>(() => ({
    ...DEFAULT_FILTERS,
    search: initialSearch,
    sort: initialSort === "Oldest" ? "Oldest" : "Newest",
  }));
  const [moreFilters, setMoreFilters] = useState(false);

  const sources = useMemo(() => {
    const actions = getRoleVisibleActions(allActions, currentUser, adminUser);
    const improvements = allImprovements.filter((record) => canSeeImprovement(record, currentUser));
    const redFlags = visibleRedFlags(allRedFlags, adminUser, currentUser);
    const walks = visibleGembaWalks(allGemba.walks, currentUser, adminUser?.roles);
    const walkIds = new Set(walks.map((walk) => walk.id));
    const boards = visibleVisualManagementBoards(visualManagement.boards, currentUser, adminUser?.roles);
    const meetings = visibleVisualManagementMeetings(visualManagement.meetings, visualManagement.boards, currentUser, adminUser?.roles);
    const boardIds = new Set(boards.map((board) => board.id));
    const meetingIds = new Set(meetings.map((meeting) => meeting.id));
    const visibleVisualManagement = {
      ...visualManagement,
      boards,
      meetings,
      topics: visualManagement.topics.filter((topic) => meetingIds.has(topic.meetingId)),
      decisions: visualManagement.decisions.filter((decision) => meetingIds.has(decision.meetingId)),
      escalations: visualManagement.escalations.filter((item) => boardIds.has(item.sourceBoardId) || boardIds.has(item.targetBoardId)),
    };
    return {
      audits,
      actions: access.actions ? actions : [],
      improvements: access.continuousImprovement ? improvements : [],
      redTags: access.redTag ? redTags : [],
      redFlags: access.redFlag ? redFlags : [],
      visualManagement: access.visualManagement ? visibleVisualManagement : { ...visibleVisualManagement, boards: [], meetings: [], topics: [], decisions: [], escalations: [] },
      gemba: {
        walks: access.gemba ? walks : [],
        observations: access.gemba ? allGemba.observations.filter((observation) => walkIds.has(observation.gembaId)) : [],
      },
    };
  }, [access, adminUser, allActions, allGemba, allImprovements, allRedFlags, audits, currentUser, redTags, visualManagement]);

  const library = useMemo(() => buildReportLibrary({ ...sources, access }), [access, sources]);
  const visibleReports = useMemo(() => filterReportLibrary(library, {
    ...filters,
    module: activeTab === "all" ? filters.module : activeTab,
  }), [activeTab, filters, library]);
  const plants = unique(library.map((report) => report.plant));
  const zones = unique(library.filter((report) => filters.plant === "All" || report.plant === filters.plant).map((report) => report.zone));
  const generators = unique(library.map((report) => report.generatedBy));
  const activeFilterCount = [filters.module !== "All", filters.plant !== "All", filters.zone !== "All", Boolean(filters.dateFrom), Boolean(filters.dateTo), filters.generatedBy !== "All", filters.status !== "All"].filter(Boolean).length;

  function update<K extends keyof ReportLibraryFilters>(key: K, value: ReportLibraryFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value, ...(key === "plant" ? { zone: "All" } : {}) }));
  }

  function exportVisibleList() {
    const rows = visibleReports.map((report) => ({
      Report: report.title, Module: report.moduleLabel, Reference: report.reference, Plant: report.plant,
      Zone: report.zone, "Generated By": report.generatedBy, Date: report.date, Status: report.status,
    }));
    downloadCsv("ops-report-library.csv", reportLibraryToCsv(rows));
  }

  return <PageContainer className="max-w-none">
    <FiveSPageHeader
      eyebrow="OPS Workspace"
      title="Reports"
      description="View, filter, export, and print reports generated across OPS."
      actions={<ExportMenu exportVisibleList={exportVisibleList} hasReports={visibleReports.length > 0} />}
    />

    <OpsTabBar label="Report modules" active={activeTab} onChange={(id) => setActiveTab(id as ReportTab)} tabs={[{ id: "all", label: "All", count: library.length }, ...enabledModules.map((module) => ({ id: module.id, label: module.label, count: library.filter(report => report.module === module.id).length }))]} />

    <section aria-label="Report summary" className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card sm:grid-cols-4">
      <Metric label="Reports Generated" value={library.length} />
      <Metric label="Audit Reports" value={library.filter((report) => report.module === "audit").length} />
      <Metric label="Action Reports" value={library.filter((report) => report.module === "actions").length} />
      <Metric label="Meeting Reports" value={library.filter((report) => report.module === "visualManagement").length} />
    </section>



    <section className="min-w-0 overflow-hidden rounded-xl border bg-card" aria-labelledby="report-library-title">
      <div className="border-b p-3 sm:p-4">
        <div className="flex flex-col gap-2 xl:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={filters.search} onChange={(event) => update("search", event.target.value)} className="pl-9" placeholder="Search report, reference, plant, zone, or person..." />
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:shrink-0">
            {activeTab === "all" && <ReportSelect label="Module" value={filters.module} onChange={(value) => update("module", value as ReportLibraryFilters["module"])} options={enabledModules.map((module) => ({ value: module.id, label: module.label }))} allLabel="All modules" />}
            <ReportSelect label="Plant" value={filters.plant} onChange={(value) => update("plant", value)} options={plants.map(option)} allLabel="All plants" />
            <ReportSelect label="Zone" value={filters.zone} onChange={(value) => update("zone", value)} options={zones.map(option)} allLabel="All zones" />
            <ReportSelect label="Sort" value={filters.sort} onChange={(value) => update("sort", value as ReportLibraryFilters["sort"])} options={[option("Newest"), option("Oldest")]} hideAll />
            <Button variant="outline" onClick={() => setMoreFilters((open) => !open)} aria-expanded={moreFilters} className="relative">
              <SlidersHorizontal className="size-4" />More filters{activeFilterCount > 0 && <Badge className="ml-1 min-w-5 px-1" size="sm">{activeFilterCount}</Badge>}
            </Button>
          </div>
        </div>
        {moreFilters && <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(150px,1fr))_auto] lg:items-end">
          <DateField label="Date from" value={filters.dateFrom} onChange={(value) => update("dateFrom", value)} />
          <DateField label="Date to" value={filters.dateTo} min={filters.dateFrom} onChange={(value) => update("dateTo", value)} />
          <ReportSelect label="Generated By" value={filters.generatedBy} onChange={(value) => update("generatedBy", value)} options={generators.map(option)} allLabel="Anyone" withLabel />
          <ReportSelect label="Status" value={filters.status} onChange={(value) => update("status", value as "All" | ReportStatus)} options={[option("Draft"), option("Final"), option("Archived")]} allLabel="All statuses" withLabel />
          <Button variant="ghost" onClick={() => setFilters((current) => ({ ...DEFAULT_FILTERS, search: current.search }))}><X className="size-4" />Clear filters</Button>
        </div>}
      </div>

      <div className="flex items-center justify-between gap-3 border-b bg-muted/[0.14] px-4 py-2.5">
        <div><h2 id="report-library-title" className="text-sm font-semibold">Report Library</h2><p className="mt-0.5 text-[11px] text-muted-foreground">{visibleReports.length} report{visibleReports.length === 1 ? "" : "s"} in this view</p></div>
        <p className="hidden text-[11px] text-muted-foreground sm:block">Reports stay linked to their source records</p>
      </div>

      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="border-b bg-muted/20 text-left text-[10px] font-semibold uppercase tracking-[.08em] text-muted-foreground"><tr>
            <th className="px-4 py-3">Report</th><th className="px-4 py-3">Module</th><th className="px-4 py-3">Reference</th><th className="px-4 py-3">Plant / Zone</th><th className="px-4 py-3">Generated By</th><th className="px-4 py-3">Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-border/65">{visibleReports.map((report) => <ReportRow key={report.id} report={report} />)}</tbody>
        </table>
      </div>
      <div className="grid gap-2 p-3 lg:hidden">{visibleReports.map((report) => <ReportCard key={report.id} report={report} />)}</div>
      {!visibleReports.length && <OpsEmptyState icon={FileText} title="No reports match this view" description="Try another module, search term, or filter." />}
    </section>
  </PageContainer>;
}

function ReportRow({ report }: { report: ReportLibraryItem }) {
  const type = getReportType(report.reportTypeId);
  return <tr className="group hover:bg-muted/20"><td className="max-w-sm px-4 py-3"><Link href={report.previewHref} className="block truncate text-xs font-semibold hover:underline">{report.title}</Link><p className="mt-0.5 text-[10px] text-muted-foreground">{type?.label}</p></td><td className="px-4 py-3"><Badge variant="secondary" size="sm">{report.moduleLabel}</Badge></td><td className="px-4 py-3 font-mono text-[11px]">{report.reference}</td><td className="px-4 py-3"><p className="text-xs font-medium">{report.plant}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{report.zone}</p></td><td className="px-4 py-3 text-xs">{report.generatedBy}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatReportDate(report.date)}</td><td className="px-4 py-3"><StatusBadge status={report.status} /></td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" nativeButton={false} render={<Link href={report.previewHref} />}><Eye className="size-3.5" />View</Button><Button size="icon-sm" variant="ghost" nativeButton={false} render={<Link href={report.sourceHref} />} aria-label={`View source record ${report.reference}`}><ExternalLink className="size-3.5" /></Button></div></td></tr>;
}

function ReportCard({ report }: { report: ReportLibraryItem }) {
  const type = getReportType(report.reportTypeId);
  return <article className="min-w-0 rounded-lg border bg-background p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><Badge variant="secondary" size="sm">{report.moduleLabel}</Badge><h3 className="mt-2 line-clamp-2 text-sm font-semibold">{report.title}</h3><p className="mt-1 font-mono text-[10px] text-muted-foreground">{report.reference}</p></div><StatusBadge status={report.status} /></div><div className="mt-3 grid grid-cols-2 gap-3 border-y py-3 text-xs"><Meta label="Plant / Zone" value={`${report.plant} · ${report.zone}`} /><Meta label="Generated By" value={report.generatedBy} /><Meta label="Report Type" value={type?.label ?? "Report"} /><Meta label="Date" value={formatReportDate(report.date)} /></div><div className="mt-3 grid grid-cols-2 gap-2"><Button size="sm" nativeButton={false} render={<Link href={report.previewHref} />}><Eye className="size-3.5" />View Report</Button><Button size="sm" variant="outline" nativeButton={false} render={<Link href={report.sourceHref} />}><ExternalLink className="size-3.5" />View Source</Button></div></article>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="relative min-w-0 border-b p-3 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-primary/70" /><p className="truncate text-[11px] text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>; }
function Meta({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 truncate text-xs" title={value}>{value}</p></div>; }
function DateField({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (value: string) => void }) { return <label><span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span><Input type="date" value={value} min={min || undefined} onChange={(event) => onChange(event.target.value)} /></label>; }
function ReportSelect({ label, value, options, allLabel, hideAll, withLabel, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; allLabel?: string; hideAll?: boolean; withLabel?: boolean; onChange: (value: string) => void }) { return <label className="min-w-0"><span className={withLabel ? "mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" : "sr-only"}>{label}</span><Select searchLabel={label} value={value} onValueChange={(next) => onChange(next ?? (hideAll ? options[0]?.value ?? "" : "All"))}><SelectTrigger className="w-full xl:min-w-36"><SelectValue /></SelectTrigger><SelectContent>{!hideAll && <SelectItem value="All">{allLabel ?? `All ${label.toLowerCase()}`}</SelectItem>}{options.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></label>; }
function option(value: string) { return { value, label: value }; }
function unique(values: string[]) { return Array.from(new Set(values.filter(Boolean))).sort(); }
function formatReportDate(value: string) { return formatOpsDate(value); }
