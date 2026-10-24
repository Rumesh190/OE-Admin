"use client";
import { useAccessContext, isLegacyABCOperationalContext } from "@/features/five-s/administration/access-v4-context";
import { getAuthenticatedDemoActor } from "@/lib/demo-session";
import { canExecuteScopedAudit, canStartAnyScopedAudit, requiresScopedAuditPolicy } from "@/lib/five-s/audit-authorization";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { OpsTabBar } from "@/components/ops/ops-tabs";
import { OPS_LISTING_TABLE } from "@/components/ops/ops-listing";
import { useListingFilter } from "@/lib/navigation/use-listing-filter";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { newestCreatedFirst } from "@/lib/records/record-order";

import { auditScorePercentage } from "@/lib/five-s/scoring-policy";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";

import {
  type MouseEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import {
  Eye,
  FileBarChart,
  Filter,
  Play,
  Plus,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ProgressBar } from "@/components/ui/progress-bar";
import FiveSPageHeader from "./FiveSPageHeader";
import { useI18n } from "@/components/preferences/use-i18n";
import { AUDIT_LIFECYCLE_STAGES, getAuditLifecycleStage, type AuditLifecycleStage } from "@/lib/five-s/lifecycle-status";

import {
  resetFiveSAudits,
} from "@/lib/five-s/audit-store";

import type { FiveSAudit } from "../types/five-s";

/* =========================================================
   PROPS
   ========================================================= */

interface FiveSAuditListProps {
  audits: FiveSAudit[];

  onStartAudit?: () => void;

  onViewAudit?: (
    audit: FiveSAudit
  ) => void;

  onStartScheduledAudit?: (
    audit: FiveSAudit
  ) => void;


}

/* =========================================================
   FILTER TYPES
   ========================================================= */

type DateRange =
  | "all"
  | "today"
  | "7d"
  | "30d"
  | "quarter";

/* =========================================================
   DATE FILTER OPTIONS
   ========================================================= */

const DATE_RANGE_OPTIONS: {
  value: DateRange;
  label: string;
}[] = [
  {
    value: "all",
    label: "All Dates",
  },
  {
    value: "today",
    label: "Today",
  },
  {
    value: "7d",
    label: "Last 7 days",
  },
  {
    value: "30d",
    label: "Last 30 days",
  },
  {
    value: "quarter",
    label: "Last quarter",
  },
];

/* =========================================================
   STATUS BADGE
   ========================================================= */

function getLifecycleStatusVariant(stage: AuditLifecycleStage) {
  if (stage === "Completed") return "success" as const;
  if (stage === "Review") return "warning" as const;
  if (stage === "In Progress") return "info" as const;
  if (stage === "Draft") return "info" as const;
  return "muted" as const;
}

/* =========================================================
   CREATED DATE
   ========================================================= */

function getCreatedDate(
  audit: FiveSAudit
): Date | null {
  const value = audit.status === "Scheduled" ? audit.scheduledDate : audit.startedAt;
  if (!value) {
    return null;
  }

  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

/* =========================================================
   CREATED DATE LABEL
   ========================================================= */

function formatCreatedDate(
  audit: FiveSAudit,
  locale: string
): string {
  const date =
    getCreatedDate(audit);

  if (!date) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    locale,
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  ).format(date);
}

function formatAuditTiming(audit: FiveSAudit, locale: string): string {
  const date = formatCreatedDate(audit, locale);
  if (audit.status !== "Scheduled") return date;
  return `${date}${audit.scheduledTime ? ` · ${audit.scheduledTime}` : ""}`;
}

/* =========================================================
   DATE RANGE MATCH
   ========================================================= */

function matchesDateRange(
  audit: FiveSAudit,
  range: DateRange
): boolean {
  if (range === "all") {
    return true;
  }

  const createdDate =
    getCreatedDate(audit);

  if (!createdDate) {
    return false;
  }

  const now = new Date();

  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

  const createdStart = new Date(
    createdDate.getFullYear(),
    createdDate.getMonth(),
    createdDate.getDate()
  );

  const difference =
    todayStart.getTime() -
    createdStart.getTime();

  const days =
    difference /
    (1000 * 60 * 60 * 24);

  switch (range) {
    case "today":
      return days === 0;

    case "7d":
      return (
        days >= 0 &&
        days <= 7
      );

    case "30d":
      return (
        days >= 0 &&
        days <= 30
      );

    case "quarter":
      return (
        days >= 0 &&
        days <= 90
      );

    default:
      return true;
  }
}

/* =========================================================
   COMPONENT
   ========================================================= */

export default function FiveSAuditList({
  audits,
  onStartAudit,
  onViewAudit,
  onStartScheduledAudit,
}: FiveSAuditListProps) {
  const router = useRouter();
  const { context, error: contextError } = useAccessContext();
  const scopedActor = getAuthenticatedDemoActor()?.user.accessModel === "v3" || Boolean(contextError) || !isLegacyABCOperationalContext(context);
  const url = useUrlState();
  const requestedStage = url.params.get("tab");
  const tabStage = AUDIT_LIFECYCLE_STAGES.find(stage => stage === requestedStage);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreError, setRestoreError] = useState("");
  const { locale, t } = useI18n();
  const [
    search,
    setSearch,
  ] = useListingFilter<string>("search", "");

  /*
   * Keep every Select controlled from
   * the first render to avoid the Base UI
   * uncontrolled -> controlled warning.
   */

  const [
    status,
    setStatus,
  ] = useListingFilter<AuditLifecycleStage | "all">("status", "all");

  const [
    plant,
    setPlant,
  ] = useListingFilter<string>("plant", "all");

  const [
    department,
    setDepartment,
  ] = useListingFilter<string>("department", "all");

  const [
    dateRange,
    setDateRange,
  ] = useListingFilter<DateRange>("dateRange", "all");

  /* =========================================================
     UNIQUE PLANTS
     ========================================================= */

  const plants =
    useMemo(() => {
      return Array.from(
        new Set(
          audits
            .map(
              (audit) =>
                audit.plant
            )
            .filter(Boolean)
        )
      ).sort();
    }, [audits]);

  /* =========================================================
     UNIQUE DEPARTMENTS
     ========================================================= */

  const departments =
    useMemo(() => {
      return Array.from(
        new Set(
          audits
            .map(
              (audit) =>
                audit.department
            )
            .filter(Boolean)
        )
      ).sort();
    }, [audits]);

  /* =========================================================
     FILTERED AUDITS
     ========================================================= */

  const filteredAudits =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return newestCreatedFirst(audits).filter(
        (audit) => {
          const matchesSearch =
            query === "" ||
            audit.id
              .toLowerCase()
              .includes(query) ||
            audit.title
              .toLowerCase()
              .includes(query) ||
            audit.department
              .toLowerCase()
              .includes(query) ||
            audit.plant
              .toLowerCase()
              .includes(query) ||
            audit.area
              .toLowerCase()
              .includes(query) ||
            audit.auditor
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            (tabStage ? (audit.status === "Draft" ? "Draft" : getAuditLifecycleStage(audit)) === tabStage : status === "all" || (audit.status === "Draft" ? "Draft" : getAuditLifecycleStage(audit)) === status);

          const matchesPlant =
            plant === "all" ||
            audit.plant === plant;

          const matchesDepartment =
            department === "all" ||
            audit.department ===
              department;

          const matchesDate =
            matchesDateRange(
              audit,
              dateRange
            );

          return (
            matchesSearch &&
            matchesStatus &&
            matchesPlant &&
            matchesDepartment &&
            matchesDate
          );
        }
      );
    }, [
      audits,
      search,
      status,
      plant,
      department,
      dateRange,
      tabStage,
    ]);

  /* =========================================================
     ACTIVE FILTERS
     ========================================================= */

  const hasActiveFilters =
    search.trim() !== "" ||
    status !== "all" ||
    plant !== "all" ||
    department !== "all" ||
    dateRange !== "all";

  /* =========================================================
     CLEAR FILTERS
     ========================================================= */

  function clearFilters() {
    setSearch("");
    setStatus("all");
    setPlant("all");
    setDepartment("all");
    setDateRange("all");
  }

  /* =========================================================
     ROW CLICK
     ========================================================= */

  function handleRowClick(
    audit: FiveSAudit
  ) {
    onViewAudit?.(audit);
  }

  /* =========================================================
     DELETE
     ========================================================= */

  /* =========================================================
     VIEW
     ========================================================= */

  function handleView(
    event: MouseEvent<HTMLButtonElement>,
    audit: FiveSAudit
  ) {
    event.stopPropagation();

    onViewAudit?.(audit);
  }

  function handleStartScheduled(event: MouseEvent<HTMLButtonElement>, audit: FiveSAudit) {
    event.stopPropagation();
    onStartScheduledAudit?.(audit);
  }

  function handleViewReport(
    event: MouseEvent<HTMLButtonElement>,
    audit: FiveSAudit
  ) {
    event.stopPropagation();
    router.push(`/5s/audits/${encodeURIComponent(audit.id)}/report?from=listing`);
  }

  /* =========================================================
     RESTORE DEMO DATA
     ========================================================= */

  function handleRestoreDemoData(
    event: MouseEvent<HTMLButtonElement>
  ) {
    event.stopPropagation();

    setRestoreOpen(true);
  }

  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <div className={`grid min-w-0 gap-4 ${OPS_LISTING_TABLE}`}>
      <OpsConfirmDialog open={restoreOpen} onOpenChange={setRestoreOpen} title="Restore demo audits?" description="This will replace the current 5S audit list with original demo audits." confirmLabel="Restore demo audits" destructive error={restoreError} onConfirm={() => { try { resetFiveSAudits(); setRestoreError(""); setRestoreOpen(false); } catch (e) { setRestoreError(e instanceof Error ? e.message : "Unable to restore demo audits."); } }} />
      {/* =====================================================
          PAGE HEADER
          ===================================================== */}

      <FiveSPageHeader
        eyebrow="OPS Workspace"
        title="Audits"
        description={`${audits.length} audits across all plants`}
        actions={
          <>
          {/* Restore Demo Data */}

          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            onClick={
              handleRestoreDemoData
            }
            disabled={scopedActor}
            aria-label="Restore demo data"
            title="Restore demo data"
            className="text-muted-foreground"
          >
            <RefreshCcw className="size-4" />
          </Button>

          {/* Start Audit */}

          <Button
            type="button"
            disabled={scopedActor && !canStartAnyScopedAudit()}
            onClick={
              onStartAudit
            }
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" />
            {t("audit.start")}
          </Button>
          </>
        }
      />
      <OpsTabBar label="Audit views" active={tabStage ?? "all"} onChange={id => { url.update({ tab: id }, "push"); setStatus("all"); }} tabs={[{ id: "all", label: "All", count: audits.length }, ...AUDIT_LIFECYCLE_STAGES.map(stage => ({ id: stage, label: stage, count: audits.filter(audit => (audit.status === "Draft" ? "Draft" : getAuditLifecycleStage(audit)) === stage).length })), ...(!scopedActor ? [{ id: "settings", label: "Settings", href: "/audits/settings" }] : [])]} />

      {/* =====================================================
          SEARCH
          ===================================================== */}

      <div className="flex w-full min-w-0 flex-col gap-2 xl:flex-row xl:items-center">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <InputGroup className="w-full sm:w-[280px] lg:w-[320px]">
            <InputGroupAddon>
              <Search className="size-4" />
            </InputGroupAddon>

            <InputGroupInput
              type="search"
              placeholder={`${t("common.search")}...`}
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              aria-label="Search 5S audits"
            />
          </InputGroup>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={
                clearFilters
              }
            >
              <X className="size-4" />
              Clear
            </Button>
          )}
        </div>

      {/* =====================================================
          FILTER BAR
          ===================================================== */}

        <div className="grid min-w-0 flex-1 grid-cols-2 items-center gap-2 sm:grid-cols-4">
        {/* STATUS */}

        <Select
          value={tabStage ?? status}
          disabled={Boolean(tabStage)}
          onValueChange={(
            value
          ) => {
            setStatus(
              (value ??
                "all") as
                | AuditLifecycleStage
                | "all"
            );
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-10 w-full min-w-0"
            aria-label="Filter by status"
          >
            <SelectValue>
              {(
                value: string | null
              ) => {
                if (
                  value ===
                    "all" ||
                  value == null
                ) {
                  return "All statuses";
                }

                return value;
              }}
            </SelectValue>
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All statuses
            </SelectItem>

            {AUDIT_LIFECYCLE_STAGES.map((stage) => <SelectItem key={stage} value={stage}>{stage}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* PLANT */}

        <Select searchLabel={"Plant"}
          value={plant}
          onValueChange={(
            value
          ) => {
            setPlant(
              value ?? "all"
            );
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-10 w-full min-w-0"
            aria-label="Filter by plant"
          >
            <SelectValue>
              {(
                value: string | null
              ) => {
                if (
                  value ===
                    "all" ||
                  value == null
                ) {
                  return "All plants";
                }

                return value;
              }}
            </SelectValue>
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All plants
            </SelectItem>

            {plants.map(
              (item) => (
                <SelectItem
                  key={item}
                  value={item}
                >
                  {item}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        {/* DEPARTMENT */}

        <Select searchLabel={"Department"}
          value={department}
          onValueChange={(
            value
          ) => {
            setDepartment(
              value ?? "all"
            );
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-10 w-full min-w-0"
            aria-label="Filter by department"
          >
            <SelectValue>
              {(
                value: string | null
              ) => {
                if (
                  value ===
                    "all" ||
                  value == null
                ) {
                  return "All departments";
                }

                return value;
              }}
            </SelectValue>
          </SelectTrigger>

          <SelectContent>
            <SelectItem value="all">
              All departments
            </SelectItem>

            {departments.map(
              (item) => (
                <SelectItem
                  key={item}
                  value={item}
                >
                  {item}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>

        {/* DATE RANGE */}

        <Select
          value={dateRange}
          onValueChange={(
            value
          ) => {
            setDateRange(
              (value ??
                "all") as DateRange
            );
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-10 w-full min-w-0"
            aria-label="Filter by date range"
          >
            <SelectValue>
              {(
                value: string | null
              ) => {
                return (
                  DATE_RANGE_OPTIONS.find(
                    (
                      option
                    ) =>
                      option.value ===
                      value
                  )?.label ??
                  "All Dates"
                );
              }}
            </SelectValue>
          </SelectTrigger>

          <SelectContent>
            {DATE_RANGE_OPTIONS.map(
              (option) => (
                <SelectItem
                  key={
                    option.value
                  }
                  value={
                    option.value
                  }
                >
                  {
                    option.label
                  }
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
        </div>
      </div>


      {/* =====================================================
          TABLE
          ===================================================== */}

      <div className="grid gap-3 md:hidden">
        {filteredAudits.map((audit) => {
          const score = auditScorePercentage(audit);
          const canOperate = !requiresScopedAuditPolicy(audit) || canExecuteScopedAudit(audit, undefined, audit.status === "Scheduled" ? "start" : "edit");
          return <article key={audit.id} onClick={() => handleRowClick(audit)} className="min-w-0 rounded-xl border bg-card p-4 shadow-sm active:bg-muted/40">
            <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="break-words text-base font-semibold leading-6">{audit.title}</h2><p className="mt-1 break-words text-sm text-muted-foreground">{audit.area} · {audit.plant}</p></div><Badge variant={getLifecycleStatusVariant((audit.status === "Draft" ? "Draft" : getAuditLifecycleStage(audit)))}>{(audit.status === "Draft" ? "Draft" : getAuditLifecycleStage(audit))}</Badge></div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-y py-3 text-sm"><div className="min-w-0"><dt className="text-xs text-muted-foreground">{t("audit.auditor")}</dt><dd className="mt-1 break-words font-medium">{audit.auditor}</dd></div><div><dt className="text-xs text-muted-foreground">{t("audit.score")}</dt><dd className="mt-1 font-semibold">{score}%</dd></div><div><dt className="text-xs text-muted-foreground">{t("common.progress")}</dt><dd className="mt-1 font-medium">{audit.completionPercentage}%</dd></div><div><dt className="text-xs text-muted-foreground">{audit.status === "Scheduled" ? "Scheduled" : t("common.created")}</dt><dd className="mt-1 font-medium">{formatAuditTiming(audit, locale)}</dd></div></dl>
            <div className="mt-3 grid grid-cols-2 gap-2"><RecordDeletionMenu module="audit" recordId={audit.id} /><Button variant="outline" onClick={(event) => handleView(event, audit)}><Eye className="size-4" /> {t("common.view")}</Button>{audit.status === "Completed" ? <Button onClick={(event) => handleViewReport(event, audit)}><FileBarChart className="size-4" /> {t("common.report")}</Button> : canOperate && (audit.status === "Scheduled" ? <Button onClick={(event) => handleStartScheduled(event, audit)}><Play className="size-4" />Start Audit</Button> : <Button onClick={(event) => handleView(event, audit)}>{t("common.continue")}</Button>)}</div>
          </article>;
        })}
      </div>

      <Card className="hidden overflow-hidden md:block">
        <CardContent className="p-0 sm:p-0">
          <div className="w-full overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[900px] table-fixed border-collapse">
              <colgroup>
                <col className="w-[25%]" />
                <col className="w-[14%]" />
                <col className="w-[11%]" />
                <col className="w-[11%]" />
                <col className="w-[13%]" />
                <col className="w-[9%]" />
                <col className="w-[10%]" />
                <col className="w-[7%]" />
              </colgroup>

              {/* =================================================
                  HEADER
                  ================================================= */}

              <thead>
                <tr className="border-b border-border/65 bg-muted/35">
                  <th className="h-11 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Audit
                  </th>

                  <th className="h-11 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {t("audit.plant")} / {t("audit.zone")}
                  </th>

                  <th className="h-11 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {t("audit.auditor")}
                  </th>

                  <th className="h-11 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Date
                  </th>

                  <th className="h-11 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Progress
                  </th>

                  <th className="h-11 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {t("audit.score")}
                  </th>

                  <th className="h-11 px-4 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    {t("common.status")}
                  </th>

                  <th className="h-11 px-4 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>

              {/* =================================================
                  BODY
                  ================================================= */}

              <tbody>
                {filteredAudits.map(
                  (audit) => {
                    const score = auditScorePercentage(audit);
                    const canOperate = !requiresScopedAuditPolicy(audit) || canExecuteScopedAudit(audit, undefined, audit.status === "Scheduled" ? "start" : "edit");

                    const progress =
                      Math.min(
                        Math.max(
                          audit.completionPercentage,
                          0
                        ),
                        100
                      );

                    return (
                      <tr
                        key={
                          audit.id
                        }
                        onClick={() =>
                          handleRowClick(
                            audit
                          )
                        }
                        className="group cursor-pointer border-b border-border/50 transition-colors hover:bg-primary/[0.025] last:border-0 dark:hover:bg-white/[0.025]"
                      >
                        {/* AUDIT */}

                        <td className="px-4 py-3.5 align-middle">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {
                                audit.title
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {
                                audit.department
                              }
                            </p>
                          </div>
                        </td>

                        {/* PLANT / AREA */}

                        <td className="px-4 py-3.5 align-middle">
                          <div className="min-w-0">
                            <p className="truncate text-sm text-foreground">
                              {
                                audit.plant
                              }
                            </p>

                            <p className="mt-1 truncate text-xs text-muted-foreground">
                              {
                                audit.area
                              }
                            </p>
                          </div>
                        </td>

                        {/* AUDITOR */}

                        <td className="px-4 py-3.5 align-middle">
                          <p className="truncate text-sm text-foreground">
                            {
                              audit.auditor
                            }
                          </p>
                        </td>

                        {/* CREATED */}

                        <td className="px-4 py-3.5 align-middle">
                          <p className="whitespace-nowrap text-sm text-foreground">
                            {formatAuditTiming(
                              audit,
                              locale
                            )}
                          </p>
                        </td>

                        {/* PROGRESS */}

                        <td className="px-4 py-3.5 align-middle">
                          <div className="flex min-w-0 items-center gap-3">
                            <ProgressBar
                              value={
                                progress
                              }
                              className="min-w-0 flex-1"
                            />

                            <span className="w-8 shrink-0 text-right text-xs text-muted-foreground">
                              {
                                progress
                              }
                              %
                            </span>
                          </div>
                        </td>

                        {/* SCORE */}

                        <td className="px-4 py-3.5 align-middle">
                          <div>
                            <p className="text-sm font-medium text-foreground">
                              {score}%
                            </p>

                            <p className="mt-1 text-xs text-muted-foreground">
                              {
                                audit.score
                              }{" "}
                              /{" "}
                              {
                                audit.maxScore
                              }
                            </p>
                          </div>
                        </td>

                        {/* STATUS */}

                        <td className="px-4 py-3.5 align-middle">
                          <Badge variant={getLifecycleStatusVariant((audit.status === "Draft" ? "Draft" : getAuditLifecycleStage(audit)))} className="whitespace-nowrap">
                            {(audit.status === "Draft" ? "Draft" : getAuditLifecycleStage(audit))}
                          </Badge>
                        </td>

                        {/* ACTIONS */}

                        <td
                          className="px-4 py-3.5 align-middle text-right"
                          onClick={(
                            event
                          ) =>
                            event.stopPropagation()
                          }
                        >
                          <div className="flex items-center justify-end gap-1 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`View ${audit.title}`}
                              title="View audit"
                              onClick={(
                                event
                              ) =>
                                handleView(
                                  event,
                                  audit
                                )
                              }
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Eye className="size-4" />
                            </Button>

                            {audit.status === "Scheduled" && canOperate && onStartScheduledAudit && (
                              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Start ${audit.title}`} title="Start Audit" onClick={(event) => handleStartScheduled(event, audit)} className="text-primary hover:text-primary"><Play className="size-4" /></Button>
                            )}

                            {audit.status === "Completed" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                aria-label={`View report for ${audit.title}`}
                                title="View audit report"
                                onClick={(event) => handleViewReport(event, audit)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <FileBarChart className="size-4" />
                              </Button>
                            )}

                            <RecordDeletionMenu module="audit" recordId={audit.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}

                {/* =================================================
                    EMPTY STATE
                    ================================================= */}

                {filteredAudits.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center"
                    >
                      <Filter className="mx-auto size-8 text-muted-foreground/50" />

                      <p className="mt-3 text-sm font-medium text-foreground">
                        No audits found
                      </p>

                      <p className="mt-1 text-sm text-muted-foreground">
                        Try changing your
                        search or filters.
                      </p>

                      {hasActiveFilters && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={
                            clearFilters
                          }
                          className="mt-4"
                        >
                          Clear filters
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
