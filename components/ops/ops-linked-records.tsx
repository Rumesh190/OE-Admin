"use client";

/**
 * OPS Linked Records Component
 * 
 * PHASE 4 — Lightweight UI for displaying cross-module relationships
 * 
 * CRITICAL:
 * - Display connectivity only
 * - No module workflow logic
 * - Graceful degradation for missing records
 * - No unnecessary nested cards
 * - Enterprise SaaS appearance
 */

import React from "react";
import { OpsDetailSection } from "@/components/ops/ops-detail-section";
import { ActionLink } from "@/components/ops/ops-return-link";
import { useCanonicalLinkedRecords } from "@/lib/relationships/use-canonical-linked-records";
import type { LinkedRecordEntry } from "@/lib/relationships/canonical-records";
import Link from "next/link";
import { ArrowRight, ExternalLink, ClipboardCheck, Footprints, Tag, Lightbulb, ListTodo, LayoutDashboard, Sparkles, Flag, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OpsRecordRef, OpsRelationship } from "@/lib/relationships/types";
import {
  resolveRecordRoute,
  getRecordRefLabel,
  getModuleDisplayName,
} from "@/lib/relationships/route-resolver";

interface LinkedRecordsProps {
  records?: LinkedRecordEntry[];
  unavailable?: boolean;
  /** Relationships to display */
  relationships: OpsRelationship[];
  
  /** Current record (to determine direction) */
  currentRecord?: OpsRecordRef;
  
  /** Optional custom status resolver */
  getRecordStatus?: (ref: OpsRecordRef) => string | null;
  
  /** Compact mode (smaller spacing) */
  compact?: boolean;
  
  /** Additional CSS classes */
  className?: string;
}

/**
 * Display linked operational records
 */
export function LinkedRecords({
  records, unavailable = false,
  relationships,
  currentRecord,
  getRecordStatus,
  compact = false,
  className,
}: LinkedRecordsProps) {
  if (records) return <ResolvedRecordList records={records} unavailable={unavailable} compact={compact} className={className} />;
  if (relationships.length === 0) return <p className="text-sm text-muted-foreground">No linked records.</p>;

  return (
    <div className={cn("space-y-2", className)}>
      <h3 className="text-sm font-semibold text-muted-foreground">
        Linked Records
      </h3>
      <div className="space-y-2">
        {relationships.map((rel) => (
          <LinkedRecordItem
            key={rel.id}
            relationship={rel}
            currentRecord={currentRecord}
            getRecordStatus={getRecordStatus}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

interface LinkedRecordItemProps {
  relationship: OpsRelationship;
  currentRecord?: OpsRecordRef;
  getRecordStatus?: (ref: OpsRecordRef) => string | null;
  compact?: boolean;
}

function LinkedRecordItem({
  relationship,
  currentRecord,
  getRecordStatus,
  compact = false,
}: LinkedRecordItemProps) {
  // Determine which record to display
  const isOutgoing = currentRecord
    ? relationship.from.module === currentRecord.module &&
      relationship.from.recordId === currentRecord.recordId &&
      relationship.from.childId === currentRecord.childId
    : true;

  const displayRecord = isOutgoing ? relationship.to : relationship.from;
  const route = resolveRecordRoute(displayRecord);
  const label = getRecordRefLabel(displayRecord);
  const moduleLabel = getModuleDisplayName(displayRecord.module);
  const status = getRecordStatus?.(displayRecord);

  // Graceful degradation for missing routes
  if (!route) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground",
          compact && "px-2 py-1.5 text-xs"
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {moduleLabel} · {label}
        </span>
        <Badge variant="secondary" size="sm">
          No route
        </Badge>
      </div>
    );
  }

  return (
    <Link
      href={route}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact && "gap-2 px-2.5 py-2"
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "font-medium text-foreground",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {moduleLabel}
          </span>
          {isOutgoing && (
            <ArrowRight className={cn("text-muted-foreground", compact ? "size-3" : "size-3.5")} />
          )}
        </div>
        <div className={cn("mt-0.5 flex items-center gap-2", compact && "mt-0")}>
          <span
            className={cn(
              "truncate font-mono text-muted-foreground",
              compact ? "text-[10px]" : "text-xs"
            )}
            title={label}
          >
            {label}
          </span>
          {status && (
            <Badge
              variant="secondary"
              size="sm"
              className={cn(compact && "text-[10px] px-1.5 py-0")}
            >
              {status}
            </Badge>
          )}
        </div>
      </div>
      <ExternalLink
        className={cn(
          "text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100",
          compact ? "size-3.5" : "size-4"
        )}
      />
    </Link>
  );
}

/**
 * Simpler inline variant for displaying a single linked record
 */
export function InlineLinkedRecord({
  record,
  status,
  compact = false,
}: {
  record: OpsRecordRef;
  status?: string;
  compact?: boolean;
}) {
  const route = resolveRecordRoute(record);
  const label = getRecordRefLabel(record);
  const moduleLabel = getModuleDisplayName(record.module);

  if (!route) {
    return (
      <span className={cn("text-muted-foreground", compact ? "text-xs" : "text-sm")}>
        {moduleLabel} · {label}
      </span>
    );
  }

  return (
    <Link
      href={route}
      className={cn(
        "inline-flex items-center gap-1.5 text-primary hover:underline",
        compact ? "text-xs" : "text-sm"
      )}
    >
      <span className="font-medium">{moduleLabel}</span>
      <span className="font-mono">{label}</span>
      {status && (
        <Badge variant="secondary" size="sm" className={cn(compact && "text-[10px]")}>
          {status}
        </Badge>
      )}
    </Link>
  );
}
/** Presentation shell only; callers provide links to records already in their authorized scope. */
export function LinkedRecordsPanel({ children, title = "Linked Records" }: { children: React.ReactNode; title?: string }) {
  return <section aria-label={title} className="rounded-xl border bg-card p-4"><h2 className="mb-3 text-sm font-semibold">{title}</h2><div className="flex flex-wrap items-center gap-3">{children}</div></section>;
}


const MODULE_ICONS = {gemba:Footprints,redTag:Tag,redFlag:Flag,continuousImprovement:Lightbulb,audit:ClipboardCheck,action:ListTodo,visualManagement:LayoutDashboard,visualImprovement:Sparkles};
const RELATIONSHIP_LABELS = {'created-from':'Created from',action:'Execution Action','red-tag':'Tagged item',improvement:'Improvement',related:'Related record'};

/** Resolves canonical data inside existing access scope; never creates a relationship or record. */
export function CanonicalLinkedRecords({currentRecord,compact=false,collapsible=false}:{currentRecord:OpsRecordRef;compact?:boolean;collapsible?:boolean}) {
  const {entries,unavailable}=useCanonicalLinkedRecords(currentRecord);
  if (collapsible) return <OpsDetailSection title="Linked Records"><ResolvedRecordList records={entries} unavailable={unavailable} compact hideHeading /></OpsDetailSection>;
  return <LinkedRecords relationships={[]} records={entries} unavailable={unavailable} currentRecord={currentRecord} compact={compact} />;
}
function ResolvedRecordList({records,unavailable,compact,className,hideHeading=false}:{records:LinkedRecordEntry[];unavailable:boolean;compact:boolean;className?:string;hideHeading?:boolean}) {
  return <section aria-label="Linked Records" className={cn('min-w-0',!compact&&'rounded-xl border bg-card',className)}>
    {!hideHeading && <div className={cn('flex items-center gap-2',compact?'mb-3':'border-b px-4 py-4 sm:px-5')}><Link2 className="size-4 shrink-0 text-muted-foreground" /><h2 className="text-sm font-semibold">Linked Records</h2></div>}
    <div className="grid min-w-0 grid-cols-1 divide-y">
      {records.map(({record,relationship})=>{
        const Icon=MODULE_ICONS[record.ref.module];
        const RecordLink=record.deleted?DeletedRecordReference:record.ref.module==='action'?ActionLink:Link;
        return <RecordLink key={`${record.ref.module}:${record.ref.recordId}:${record.ref.childId??''}`} href={record.href} className={cn('group flex min-w-0 items-start gap-3 outline-none transition-colors hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',compact?'py-3':'px-4 py-3 sm:px-5')}>
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-primary/5 text-primary"><Icon className="size-4" /></span>
          <span className="min-w-0 flex-1"><span className="flex min-w-0 flex-wrap items-center gap-2"><span className="text-xs font-medium">{getModuleDisplayName(record.ref.module)}</span>{record.status&&<Badge variant="secondary" size="sm" className="max-w-full whitespace-normal break-words">{record.status}</Badge>}</span><span className="mt-1 block break-words text-sm font-medium">{record.title}</span><span className="mt-1 block break-all font-mono text-xs text-muted-foreground">{record.ref.childId??record.ref.recordId}</span><span className="mt-1 block text-xs text-muted-foreground">{RELATIONSHIP_LABELS[relationship]}</span></span>
          {!record.deleted && <ArrowRight aria-hidden className="mt-2 size-4 shrink-0 text-muted-foreground group-hover:text-primary" />}
        </RecordLink>;
      })}
      {!records.length&&<p className={cn('text-sm text-muted-foreground',compact?'py-3':'px-4 py-5 sm:px-5')}>No accessible linked records.</p>}
    </div>
    {unavailable&&<p className={cn('text-xs text-muted-foreground',compact?'pt-2':'border-t px-4 py-3 sm:px-5')}>Some linked records are unavailable or outside your access.</p>}
  </section>;
}

function DeletedRecordReference({ children, className }: { children: React.ReactNode; className?: string; href?: string }) {
  return <div className={className}>{children}</div>;
}
