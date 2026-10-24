"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { withBusinessRecordCreation } from "@/lib/records/module-records";

import { useMemo, useRef, useState } from "react";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { withActionReturn, currentReturnPath } from "@/lib/navigation/return-to";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Eye,
  FileText,
  Paperclip,
  Plus,
  Search,
  X,
} from "lucide-react";

import { OpsDataTable } from "@/components/ops/ops-data-table";
import { OpsFilterBar } from "@/components/ops/ops-filter-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { OpsListingLayout as PageContainer } from "@/components/ops/ops-listing";
import { OpsEmptyState } from "@/components/ops/ops-empty-state";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { hasPermission } from "@/features/five-s/administration/permissions";
import type { MyAction, MyActionEvidence, MyActionPriority } from "@/features/five-s/types/my-actions";
import {
  ACTION_PRIORITY_CONFIG,
  ACTION_STATUS_CONFIG,
  actionDueDays,
  formatShortDate,
  getActionDueLabel,
  getActionSourceDefinition,
  getActionSourceRecordLabel,
  getActionUpdatedAt,
  getEnabledActionSources,
  isActionOverdue,
} from "@/lib/actions/action-config";
import { getActionEscalations } from "@/lib/actions/action-attention-store";
import { createAction, useActionStore } from "@/lib/actions/action-store";
import { useCurrentUser } from "@/lib/current-user";
import { hasPlatformLegacyOperationalAccess } from "@/lib/platform-operational-access";
import { canCreateDemoModuleRecord } from "@/lib/demo/demo-module-creation";
import { OpsPersonSelect } from "@/components/ops/ops-person-select";
import { MAX_EVIDENCE_IMAGES, optimizeEvidenceImage, validateEvidenceSelection } from "@/lib/evidence-images";
import { useFiveSZoneConfiguration } from "@/lib/five-s/configuration";
import { useActiveActionCategories } from "@/lib/actions/action-category-store";
import { getPriorityDueDate, useActiveActionPriorities } from "@/lib/actions/action-configuration-store";
import { useModuleEntitlements } from "@/lib/module-entitlements";
import { cn } from "@/lib/utils";
import {
  ACTION_CENTER_TABS,
  canViewTeamActions,
  filterActionCenterItems,
  getActionCenterCounts,
  getActionsForTab,
  getRoleVisibleActions,
  getReviewAgeLabel,
  type ActionCenterFilters,
  type ActionCenterTab,
  type ActionDueFilter,
  type ActionStatusFilter,
} from "./action-center-data";

interface ActionCenterPageProps {
  initialTab?: string;
  initialStatus?: string;
  initialSource?: string;
  initialPlant?: string;
  initialZone?: string;
}

const STATUS_FILTERS: ActionStatusFilter[] = ["All", "Open", "Overdue", "Awaiting Assignment", "Assigned", "In Progress", "Pending Auditor Review", "Rework Required", "Completed"];
const DUE_FILTERS: ActionDueFilter[] = ["All", "Overdue", "Today", "Tomorrow", "Next 7 days"];
const PRIORITIES: Array<"All" | MyActionPriority> = ["All", "High", "Medium", "Low"];

function validTab(value?: string): ActionCenterTab {
  return ACTION_CENTER_TABS.some((tab) => tab.id === value) ? value as ActionCenterTab : "all";
}

function validStatus(value?: string): ActionStatusFilter {
  const normalized = value === "open" ? "Open" : value === "overdue" ? "Overdue" : value;
  return STATUS_FILTERS.includes(normalized as ActionStatusFilter) ? normalized as ActionStatusFilter : "All";
}

export default function ActionCenterPage({ initialTab, initialStatus, initialSource, initialPlant, initialZone }: ActionCenterPageProps) {
  const router = useRouter();
  const actions = useActionStore();
  const hasLegacyCritical = actions.some((action) => action.priority === "Critical");
  const currentUser = useCurrentUser();
  const adminUsers = useAdminUsers();
  const access = useModuleEntitlements();
  const adminUser = adminUsers.find((user) => user.id === currentUser.id);
  const canCreate = canCreateDemoModuleRecord("actions", currentUser.id) || (currentUser.isSuperAdmin ? hasPlatformLegacyOperationalAccess("actions") : hasPermission(adminUser, "actions.create"));
  const url = useUrlState();
  const activeTab = validTab(url.params.get("tab") ?? initialTab);
  const setActiveTab = (value: ActionCenterTab) => url.update({tab:value, status:"All", due:"All"}, "push");
  const [moreFilters, setMoreFilters] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const urlPath = url.path;
  const filters: ActionCenterFilters = useMemo(() => { const params = new URLSearchParams(urlPath.split("?")[1]?.split("#")[0]); const requestedSource = params.get("source") ?? initialSource; return ({
    search: params.get("search") ?? "",
    source: getEnabledActionSources(access).some(source => source.id === requestedSource) ? requestedSource as ActionCenterFilters["source"] : "All",
    status: validStatus(params.get("status") ?? initialStatus),
    priority: (params.get("priority") ?? "All") as ActionCenterFilters["priority"],
    plant: params.get("plant") ?? initialPlant ?? "All",
    zone: params.get("zone") ?? initialZone ?? "All",
    assignedTo: params.get("assignedTo") ?? "All",
    due: (params.get("due") ?? ((params.get("status") ?? initialStatus) === "overdue" ? "Overdue" : "All")) as ActionCenterFilters["due"],
  }); }, [urlPath, access, initialSource, initialStatus, initialPlant, initialZone]);
  function setFilters(next: ActionCenterFilters | ((current: ActionCenterFilters) => ActionCenterFilters)) {
    url.update({ ...(typeof next === "function" ? next(filters) : next) });
  }

  const now = useMemo(() => new Date(), []);
  const counts = useMemo(() => getActionCenterCounts(actions, currentUser, adminUser, now), [actions, currentUser, adminUser, now]);
  const tabActions = useMemo(() => getActionsForTab(actions, activeTab, currentUser, adminUser), [actions, activeTab, currentUser, adminUser]);
  const activeQuickFilter = filters.status === "Open" ? "open" : filters.status === "Overdue" ? "overdue" : undefined;
  const roleVisibleActions = useMemo(() => getRoleVisibleActions(actions, currentUser, adminUser), [actions, currentUser, adminUser]);
  const filtered = useMemo(() => filterActionCenterItems(activeQuickFilter ? roleVisibleActions : tabActions, filters, now), [activeQuickFilter, filters, now, roleVisibleActions, tabActions]);
  const sourceOptions = getEnabledActionSources(access);
  const tabs = ACTION_CENTER_TABS.filter((tab) => tab.id !== "team-actions" || canViewTeamActions(adminUser));
  const activeFilterCount = [filters.source, filters.status, filters.priority, filters.plant, filters.zone, filters.assignedTo, filters.due].filter((value) => value !== "All").length;

  function updateFilter<K extends keyof ActionCenterFilters>(key: K, value: ActionCenterFilters[K]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ search: "", source: "All", status: "All", priority: "All", plant: "All", zone: "All", assignedTo: "All", due: "All" });
  }

  function toggleQuickFilter(filter: "open" | "overdue") {
    const selected = activeQuickFilter === filter;
    setFilters((current) => ({
      ...current,
      status: selected ? "All" : filter === "open" ? "Open" : "Overdue",
      due: selected || filter === "open" ? "All" : "Overdue",
    }));
  }

  function updateStatusFilter(value: ActionStatusFilter) {
    setFilters((current) => ({ ...current, status: value, due: value === "Overdue" ? "Overdue" : current.due === "Overdue" ? "All" : current.due }));
  }

  return <PageContainer className="max-w-none">
    <FiveSPageHeader eyebrow="OPS Workspace" title="Actions" description="Track, complete, review, and close actions created across OPS." actions={canCreate ? <Button onClick={() => setCreateOpen(true)}><Plus className="size-4" />Create Action</Button> : undefined} />

    <OpsTabBar label="Actions sections" active={activeQuickFilter ? "" : activeTab} onChange={(id) => setActiveTab(id as ActionCenterTab)} tabs={[...tabs.map((tab) => ({ ...tab, count: counts.tabs[tab.id] })), { id: "settings", label: "Settings", href: "/actions/settings" }]} />

    <p className="text-xs text-muted-foreground">Summary across all Actions visible to your role. Open and Overdue show that full visible scope.</p>
    <section aria-label="All visible Action summary" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <SummaryMetric label="Open" value={counts.open} tone="warning" selected={activeQuickFilter === "open"} onClick={() => toggleQuickFilter("open")} />
      <SummaryMetric label="Overdue" value={counts.overdue} tone="danger" selected={activeQuickFilter === "overdue"} onClick={() => toggleQuickFilter("overdue")} />
      <SummaryMetric label="Critical" value={counts.critical} tone="danger" onClick={() => updateFilter("priority", "Critical")} />
      <SummaryMetric label="Awaiting Review" value={counts.awaitingReview} tone="info" onClick={() => setActiveTab("awaiting-review")} />
      <SummaryMetric label="Completed This Month" value={counts.completedThisMonth} tone="success" onClick={() => setActiveTab("completed")} />
    </section>

    <Card className="min-w-0 gap-0 overflow-hidden">
      <CardContent className="p-0">
        {activeQuickFilter && <div className="mb-3 flex min-w-0 items-center justify-between gap-3 rounded-lg bg-primary/[0.06] px-3 py-2 text-xs"><p className="min-w-0 truncate"><span className="font-semibold">{activeQuickFilter === "open" ? "Open actions" : "Overdue actions"}</span><span className="text-muted-foreground"> · {filtered.length} {filtered.length === 1 ? "record" : "records"}</span></p><Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => toggleQuickFilter(activeQuickFilter)}><X className="size-3.5" />Clear</Button></div>}
        <OpsFilterBar onClear={resetFilters} hasFilters={Boolean(filters.search || activeFilterCount)} expanded={moreFilters} onToggle={() => setMoreFilters(value => !value)} activeCount={activeFilterCount} className="lg:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_170px_160px_auto]" primary={<>          <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} className="pl-9" placeholder="Search actions, source, person..." /></div>
          <FilterSelect value={filters.source} onChange={(value) => updateFilter("source", value as ActionCenterFilters["source"])} ariaLabel="Source module"><SelectItem value="All">All sources</SelectItem>{sourceOptions.map((source) => <SelectItem key={source.id} value={source.id}>{source.label}</SelectItem>)}</FilterSelect>
          <FilterSelect value={filters.status} onChange={(value) => updateStatusFilter(value as ActionStatusFilter)} ariaLabel="Status"><SelectItem value="All">All statuses</SelectItem>{STATUS_FILTERS.filter((item) => item !== "All").map((item) => <SelectItem key={item} value={item}>{item === "Open" ? "Open / Active" : item}</SelectItem>)}</FilterSelect>
          <FilterSelect value={filters.priority} onChange={(value) => updateFilter("priority", value as ActionCenterFilters["priority"])} ariaLabel="Priority"><SelectItem value="All">All priorities</SelectItem>{PRIORITIES.filter((item) => item !== "All").map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}{hasLegacyCritical && <SelectItem value="Critical">Legacy: Critical</SelectItem>}</FilterSelect>
</>} extra={<>          <FilterSelect value={filters.plant} onChange={(value) => updateFilter("plant", value)} ariaLabel="Plant"><SelectItem value="All">All plants</SelectItem>{counts.plants.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</FilterSelect>
          <FilterSelect value={filters.zone} onChange={(value) => updateFilter("zone", value)} ariaLabel="Zone"><SelectItem value="All">All zones</SelectItem>{counts.zones.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</FilterSelect>
          <FilterSelect value={filters.assignedTo} onChange={(value) => updateFilter("assignedTo", value)} ariaLabel="Action Owner"><SelectItem value="All">All Action Owners</SelectItem>{counts.assignees.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</FilterSelect>
          <FilterSelect value={filters.due} onChange={(value) => updateFilter("due", value as ActionDueFilter)} ariaLabel="Due date"><SelectItem value="All">Any due date</SelectItem>{DUE_FILTERS.filter((item) => item !== "All").map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</FilterSelect>
        </>} />
      </CardContent>

      <OpsDataTable label="Actions" headers={["Action", "Source", "Action Owner", "Priority", "Due / Review Age", "Status", "Updated", "Actions"]} mobile={<>{filtered.map((action) => <ActionMobileCard key={action.id} action={action} reviewMode={!activeQuickFilter && activeTab === "awaiting-review"} onOpen={() => router.push(withActionReturn(action.id, currentReturnPath("/actions")))} />)}</>}>{filtered.map((action) => <ActionTableRow key={action.id} action={action} reviewMode={!activeQuickFilter && activeTab === "awaiting-review"} onOpen={() => router.push(withActionReturn(action.id, currentReturnPath("/actions")))} onReport={() => router.push(`/actions/${encodeURIComponent(action.id)}/report`)} />)}</OpsDataTable>

      {filtered.length === 0 && <OpsEmptyState icon={CheckCircle2} title={activeQuickFilter === "overdue" ? "No overdue actions" : activeQuickFilter === "open" ? "No open actions" : `No actions in ${ACTION_CENTER_TABS.find((tab) => tab.id === activeTab)?.label ?? "this view"}`} description={activeQuickFilter ? activeQuickFilter === "overdue" ? "You’re up to date." : "No active work matches the current filters." : "Try changing the current filters."} action={activeFilterCount > 0 ? <Button size="sm" variant="outline" onClick={resetFilters}>Clear filters</Button> : undefined} />}
    </Card>

    <ManualActionDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={(action) => router.push(withActionReturn(action.id, currentReturnPath("/actions")))} />
  </PageContainer>;
}

function SummaryMetric({ label, value, tone, selected = false, onClick }: { label: string; value: number; tone: "warning" | "danger" | "info" | "success"; selected?: boolean; onClick: () => void }) {
  const tones = { warning: "bg-amber-500", danger: "bg-red-500", info: "bg-sky-500", success: "bg-emerald-500" };
  return <button type="button" aria-pressed={selected} onClick={onClick} className={cn("relative min-h-16 min-w-0 overflow-hidden rounded-xl border bg-card p-3 text-left shadow-sm outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring", selected && "border-primary/45 bg-primary/[0.07] ring-1 ring-inset ring-primary/35")}><span className={cn("absolute inset-y-3 left-0 w-0.5 rounded-r-full", tones[tone])} /><p className="truncate text-[11px] font-medium text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold leading-none tabular-nums">{value}</p></button>;
}

function FilterSelect({ value, onChange, ariaLabel, children }: { value: string; onChange: (value: string) => void; ariaLabel: string; children: React.ReactNode }) {
  return <Select searchLabel={ariaLabel} value={value} onValueChange={(next) => onChange(next ?? "All")}><SelectTrigger className="w-full" aria-label={ariaLabel}><SelectValue>{value === "All" ? ({"Source module":"All sources","Status":"All statuses","Priority":"All priorities","Plant":"All plants","Zone":"All zones","Action Owner":"All Action Owners","Due date":"Any due date"}[ariaLabel] ?? "All") : value === "Open" && ariaLabel === "Status" ? "Open / Active" : value === "Critical" && ariaLabel === "Priority" ? "Legacy: Critical" : undefined}</SelectValue></SelectTrigger><SelectContent>{children}</SelectContent></Select>;
}

function SourceBadge({ action }: { action: MyAction }) {
  const source = getActionSourceDefinition(action);
  const Icon = source.icon;
  return <Badge variant="outline" size="sm" className="gap-1 border-border/80 bg-muted/25 font-normal text-muted-foreground"><Icon className="size-3" />{source.label}</Badge>;
}

function ActionTableRow({ action, reviewMode, onOpen, onReport }: { action: MyAction; reviewMode: boolean; onOpen: () => void; onReport: () => void }) {
  const status = ACTION_STATUS_CONFIG[action.status];
  const priority = ACTION_PRIORITY_CONFIG[action.priority];
  const overdue = isActionOverdue(action);
  return <tr className="transition-colors hover:bg-muted/25">
    <td className="max-w-[300px] px-4 py-3"><button type="button" onClick={onOpen} title={action.title} className="block w-full min-w-0 text-left outline-none focus-visible:underline"><span className="block break-words font-medium">{action.title}</span><span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{action.id}</span><span className="mt-0.5 block text-[10px] text-muted-foreground">Created {formatShortDate(action.createdAt)}</span></button></td>
    <td className="max-w-[190px] px-4 py-3"><SourceBadge action={action} /><p className="mt-1 truncate text-[11px] text-muted-foreground" title={getActionSourceRecordLabel(action)}>{getActionSourceRecordLabel(action)}</p></td>
    <td className="max-w-[150px] px-4 py-3"><p className="truncate text-xs font-medium">{action.responsiblePersonName ?? action.assignedTo ?? "Unassigned"}</p><p className="mt-0.5 truncate text-[11px] text-muted-foreground">{action.area}</p></td>
    <td className="px-4 py-3"><Badge variant={priority.variant} size="sm">{priority.label}</Badge></td>
    <td className="px-4 py-3"><p className={cn("whitespace-nowrap text-xs font-medium", overdue && "text-red-600 dark:text-red-400")}>{reviewMode ? getReviewAgeLabel(action) : getActionDueLabel(action)}</p>{reviewMode && <p className="mt-0.5 text-[10px] text-muted-foreground">{formatShortDate(action.submittedForReviewAt ?? getActionUpdatedAt(action))}</p>}</td>
    <td className="px-4 py-3"><div className="flex flex-wrap gap-1"><StatusBadge variant={status.variant} status={status.label} /><ActionAttentionBadges action={action} /></div></td>
    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{formatShortDate(getActionUpdatedAt(action))}</td>
    <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" onClick={onOpen} aria-label={`View ${action.id}`}><Eye className="size-4" /></Button>{action.status === "Completed" && <Button size="icon-sm" variant="ghost" onClick={onReport} aria-label={`View report for ${action.id}`}><FileText className="size-4" /></Button>}<RecordDeletionMenu module="action" recordId={action.id} /></div></td>
  </tr>;
}

function ActionMobileCard({ action, reviewMode, onOpen }: { action: MyAction; reviewMode: boolean; onOpen: () => void }) {
  const priority = ACTION_PRIORITY_CONFIG[action.priority];
  const status = ACTION_STATUS_CONFIG[action.status];
  return <article className="min-w-0 rounded-xl border bg-background"><button type="button" onClick={onOpen} className="w-full min-w-0 p-4 text-left outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="line-clamp-2 text-sm font-semibold">{action.title}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{action.id}</p><p className="mt-0.5 text-[10px] text-muted-foreground">Created {formatShortDate(action.createdAt)}</p></div><Badge variant={priority.variant} size="sm">{priority.label}</Badge></div><div className="mt-3 flex flex-wrap items-center gap-2"><SourceBadge action={action} /><StatusBadge variant={status.variant} status={status.label} /><ActionAttentionBadges action={action} /></div><div className="mt-3 flex items-center justify-between gap-3 text-xs"><span className={cn("inline-flex items-center gap-1 text-muted-foreground", isActionOverdue(action) && "text-red-600 dark:text-red-400")}><CalendarDays className="size-3.5" />{reviewMode ? getReviewAgeLabel(action) : getActionDueLabel(action)}</span><span className="truncate text-muted-foreground">{action.area}</span></div></button><div className="flex justify-end px-3 pb-2"><RecordDeletionMenu module="action" recordId={action.id} /></div></article>;
}

function ActionAttentionBadges({ action }: { action: MyAction }) {
  if (action.status === "Completed") return null;
  const escalation = getActionEscalations(action.id).find((item) => item.status !== "Resolved");
  const days = actionDueDays(action);
  return <>{days === 1 && <Badge variant="warning" size="sm">Due Soon</Badge>}{days < 0 && <Badge variant="danger" size="sm">Overdue</Badge>}{escalation && <Badge variant="danger" size="sm">Escalated · L{escalation.level}</Badge>}</>;
}

export function ManualActionDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (action: MyAction) => void }) {
  const actionCategories = useActiveActionCategories();
  const actionPriorities = useActiveActionPriorities();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const currentPlant = adminUser?.plant ?? currentUser.plant;
  const zones = useFiveSZoneConfiguration();
  const defaultZone = zones.find((item) => item.name === currentUser.primaryZone) ?? zones[0];
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [zoneName, setZoneName] = useState(defaultZone?.name ?? "");
  const [priority, setPriority] = useState<MyActionPriority>("Medium");
  const [category, setCategory] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [evidence, setEvidence] = useState<MyActionEvidence[]>([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const busyRef = useRef(false);
  const zone = zones.find((item) => item.name === zoneName) ?? defaultZone;
  const effectivePriority = actionPriorities.some((item) => item.id === priority) ? priority : actionPriorities[0]?.id ?? priority;
  const dueDate = getPriorityDueDate(effectivePriority);
  const valid = title.trim() && description.trim() && category && responsibleId && zone;

  async function addEvidence(files: FileList | null) {
    if (!files || busyRef.current) return;
    busyRef.current = true; setBusy(true); setFormError("");
    try {
      const selected = Array.from(files);
      validateEvidenceSelection(selected, evidence.length);
      const next: MyActionEvidence[] = [];
      for (const file of selected) {
        const optimized = await optimizeEvidenceImage(file);
        next.push({ id: `EV-${crypto.randomUUID()}`, evidenceType: "finding", name: file.name, type: "image", mimeType: file.type, uploadedAt: new Date().toISOString(), uploadedBy: currentUser.name, url: optimized.dataUrl });
      }
      setEvidence(items => [...items, ...next]);
    } catch (error) { setFormError(error instanceof Error ? error.message : "Unable to add this image."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  async function submit() {
    if (!valid || !zone || busyRef.current) return;
    const responsible = zone.members.find((member) => member.id === responsibleId);
    if (!responsible) return;
    busyRef.current = true; setBusy(true); setFormError("");
    try {
    const action = await withBusinessRecordCreation(() => createAction({
      title: title.trim(), description: description.trim(), source: "Manual", sourceTitle: "Manual action", sourceModule: "manual", sourceLabel: "Manual", sourceLocation: zone.name, sourceObservation: description.trim(),
      plant: currentPlant, department: zone.department, area: zone.name, zoneId: zone.name, assignedTo: responsible.name,
      responsiblePersonId: responsible.id, responsiblePersonName: responsible.name, zoneLeaderId: zone.leaderId, zoneLeaderName: zone.leader,
      assignedByUserId: currentUser.id, assignedByName: currentUser.name, assignedAt: new Date().toISOString(),
      createdByUserId: currentUser.id, createdByName: currentUser.name, auditor: currentUser.name, status: "Assigned", priority: effectivePriority, dueDate,
      actionCategory: category, issueEvidence: evidence,
    }));
    onOpenChange(false);
    setBusy(false);
    onCreated(action);
    } catch (error) { setFormError(error instanceof Error ? error.message : "Unable to create this Action. Please try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Create Action</DialogTitle><DialogDescription>Choose the Action details and owner. Actions created here use Manual as their source.</DialogDescription></DialogHeader><div className="grid gap-4 py-1"><Field label="Action Title *"><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Describe the required action" /></Field><Field label="Description *"><Textarea className="min-h-24" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Explain what needs to be completed..." /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Plant"><Input value={currentPlant} disabled /></Field><Field label="Zone *"><OpsPersonSelect label="Zone" clearable={false} entityLabel="Zone" entityPlural="Zones" people={zones.map(item => ({ id: item.name, name: item.name }))} value={zoneName} onValueChange={value => { setZoneName(value); setResponsibleId(""); }} /></Field><Field label="Priority *"><Select searchLabel={"Priority"} value={effectivePriority} onValueChange={(value) => setPriority((value ?? actionPriorities[0]?.id ?? "Medium") as MyActionPriority)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{actionPriorities.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></Field><Field label="Due Date"><Input type="date" value={dueDate} disabled /></Field><Field label="Action Category *"><Select searchLabel={"Action Category"} value={category} onValueChange={(value) => setCategory(value ?? "")}><SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{actionCategories.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field><Field label="Zone Leader"><Input value={zone?.leader ?? "—"} disabled /></Field><div className="grid min-w-0 gap-1.5 text-sm font-medium"><p>Action Owner *</p><OpsPersonSelect people={zone?.members ?? []} value={responsibleId} onValueChange={setResponsibleId} label="Action Owner" /></div><Field label="Assigned By"><Input value={currentUser.name} disabled /></Field><Field label="Source"><Input value="Manual · Created in Actions" disabled /></Field></div><div className="grid min-w-0 gap-1.5 text-sm font-medium"><p>Initial Evidence</p><label className="flex min-h-20 cursor-pointer items-center justify-center rounded-lg border border-dashed bg-muted/15 px-4 text-center text-xs text-muted-foreground hover:bg-muted/30"><input hidden type="file" accept="image/*" multiple onChange={(event) => { void addEvidence(event.target.files); event.target.value = ""; }} /><span><Paperclip className="mx-auto mb-1 size-4" />Add up to {MAX_EVIDENCE_IMAGES} images</span></label>{evidence.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{evidence.map((item) => <span key={item.id} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs"><span className="max-w-40 truncate">{item.name}</span><button type="button" onClick={() => setEvidence((items) => items.filter((evidenceItem) => evidenceItem.id !== item.id))} aria-label={`Remove ${item.name}`}><X className="size-3" /></button></span>)}</div>}</div>{formError && <p role="alert" className="text-sm text-destructive">{formError}</p>}</div><DialogFooter><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button><Button disabled={!valid || busy} onClick={submit}>{busy ? "Creating..." : "Create Action"}</Button></DialogFooter></DialogContent></Dialog>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{label}{children}</label>;
}
