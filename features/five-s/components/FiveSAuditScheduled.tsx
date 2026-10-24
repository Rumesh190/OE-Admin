"use client";

import { useState } from "react";
import { ArrowLeft, CalendarClock, Play } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FiveSAudit } from "@/features/five-s/types/five-s";
import { toLocalInputDate } from "@/lib/five-s/configuration";
import { validateFiveSAuditSchedule } from "@/lib/five-s/audit-store";
import { auditContext, isV4Audit } from "@/lib/five-s/audit-authorization";
import { resolveCurrentFactoryActor } from "@/features/five-s/administration/factory-authorization";
import FiveSPageHeader from "./FiveSPageHeader";

interface FiveSAuditScheduledProps {
  audit: FiveSAudit;
  onBack: () => void;
  onStart: (audit: FiveSAudit) => void;
  onUpdate: (
    audit: FiveSAudit,
    updates: Pick<FiveSAudit, "dueDate" | "scheduledDate" | "scheduledTime">,
  ) => FiveSAudit | undefined;
}

export default function FiveSAuditScheduled({ audit, onBack, onStart, onUpdate }: FiveSAuditScheduledProps) {
  const today = toLocalInputDate(new Date());
  const [scheduledDate, setScheduledDate] = useState(audit.scheduledDate ?? "");
  const [scheduledTime, setScheduledTime] = useState(audit.scheduledTime ?? "");
  const [dueDate, setDueDate] = useState(audit.dueDate);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const [formRevision, setFormRevision] = useState(audit.revision);
  const stale = isV4Audit(audit) && formRevision !== audit.revision;
  const scope = auditContext(audit);
  const canEdit = !scope || Boolean(resolveCurrentFactoryActor(scope)?.factoryAdmin);
  function startAudit() { try { if (stale) throw new Error("Audit revision changed. Reload setup before starting."); onStart(audit); } catch(e) { setError(e instanceof Error ? e.message : "Unable to start Audit."); } }
  function saveSetup() {
    try {
    if (!canEdit || stale) throw new Error("Setup authority or revision changed. Reload before saving.");
    const scheduleError = validateFiveSAuditSchedule(scheduledDate, scheduledTime);
    if (scheduleError) { setError(scheduleError); setNotice(""); return; }
    if (!dueDate || dueDate < today) { setError("Due date cannot be in the past."); setNotice(""); return; }
    const updated = onUpdate(audit, { scheduledDate, scheduledTime, dueDate });
    if (!updated) { setError("Scheduled setup could not be updated."); setNotice(""); return; }
    setFormRevision(updated.revision);
    setError("");
    setNotice("Scheduled audit setup updated.");
    } catch(e) { setError(e instanceof Error ? e.message : "Unable to save scheduled setup."); setNotice(""); }
  }

  return <PageContainer>
    <FiveSPageHeader
      eyebrow="Scheduled Audit"
      title={audit.title}
      description={`${audit.plant} · ${audit.area} · ${audit.department}`}
      leading={<Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back to audits"><ArrowLeft className="size-4" /></Button>}
      actions={<><Badge variant="muted">Scheduled</Badge><Button type="button" disabled={stale} onClick={startAudit}><Play className="size-4" />Start Audit</Button></>}
    />

    <Card className="gap-0 overflow-hidden">
      <CardHeader className="border-b bg-muted/[0.16] pb-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-primary/[0.08] text-primary"><CalendarClock className="size-4" /></span><div><CardTitle className="text-base">Pre-start setup</CardTitle><p className="mt-1 text-xs text-muted-foreground">Timing may be updated before execution. Audit identity and structural setup remain locked.</p></div></div></CardHeader>
      <CardContent className="grid gap-5 p-4 sm:p-6">
        <dl className="grid gap-4 rounded-lg border bg-muted/[0.12] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Plant" value={audit.plant} />
          <Summary label="Zone" value={audit.area} />
          <Summary label="Auditor" value={audit.auditor} />
          <Summary label="Audit ID" value={audit.title} mono />
        </dl>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Scheduled Date *" htmlFor="scheduled-audit-date"><Input disabled={!canEdit || stale} id="scheduled-audit-date" type="date" min={today} value={scheduledDate} onChange={(event) => { setScheduledDate(event.target.value); setError(""); setNotice(""); }} /></Field>
          <Field label="Scheduled Time *" htmlFor="scheduled-audit-time"><Input disabled={!canEdit || stale} id="scheduled-audit-time" type="time" value={scheduledTime} onChange={(event) => { setScheduledTime(event.target.value); setError(""); setNotice(""); }} /></Field>
          <Field label="Due Date *" htmlFor="scheduled-audit-due"><Input disabled={!canEdit || stale} id="scheduled-audit-due" type="date" min={today} value={dueDate} onChange={(event) => { setDueDate(event.target.value); setError(""); setNotice(""); }} /></Field>
        </div>
        {!canEdit && <p className="text-sm text-muted-foreground">Only an assigned Factory Admin can change scheduled setup. Auditor execution follows the existing authorization.</p>}
        {stale && <div><p className="text-sm">This Audit changed. Reload its recorded setup before editing or starting.</p><Button variant="outline" onClick={() => { setScheduledDate(audit.scheduledDate ?? ""); setScheduledTime(audit.scheduledTime ?? ""); setDueDate(audit.dueDate); setFormRevision(audit.revision); setError(""); }}>Reload Audit setup</Button></div>}
        {error && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" disabled={!canEdit || stale} onClick={saveSetup}>Save Setup</Button><Button type="button" disabled={stale} onClick={startAudit}><Play className="size-4" />Start Audit</Button></div>
      </CardContent>
    </Card>
  </PageContainer>;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return <div className="grid gap-2"><Label htmlFor={htmlFor}>{label}</Label>{children}</div>;
}

function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</dt><dd className={`mt-1 truncate text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</dd></div>;
}
