"use client";
import { useAccessContext } from "@/features/five-s/administration/access-v4-context";
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { OpsPersonSelect } from "@/components/ops/ops-person-select";

import { useMemo, useState } from "react";
import { ArrowLeft, Check, Info, LoaderCircle, LockKeyhole } from "lucide-react";

import { getNextFiveSAuditTitle, validateFiveSAuditSchedule } from "@/lib/five-s/audit-store";
import { useCurrentUser } from "@/lib/current-user";
import {
  canAuditZone,
  toLocalInputDate,
  useFiveSZoneConfiguration,
} from "@/lib/five-s/configuration";
import FiveSPageHeader from "./FiveSPageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/components/preferences/use-i18n";
import { useAdminUsers } from "@/features/five-s/administration/store";

import { useAccessV3State } from "../administration/access-v3-state";
import { resolveCurrentFactoryActor } from "../administration/factory-authorization";
import { getAllOrganizationConfiguration } from "@/lib/organization-store";
import { DEMO_ORGANIZATION } from "@/lib/organizations";
import { canScheduleAnyScopedAudit, eligibleAuditAssignees } from "@/lib/five-s/audit-authorization";

export interface FiveSAuditCreateProps {
  onBack: () => void;
  onStart: (audit: {
    organizationId?: string; plantId?: string; zoneId?: string; assignedAuditorId?: string; departmentId?: string; expectedContextSelectionId?: string;
    title: string;
    plant: string;
    department: string;
    area: string;
    auditor: string;
    dueDate: string;
    startNow: boolean;
    scheduledDate?: string;
    scheduledTime?: string;
  }) => void | Promise<void>;
}

function formatDate(value: string, locale: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function FieldInfo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`More information about ${label}`}
          />
        }
      >
        <Info className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 text-xs leading-5">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function ReadOnlyField({ label, value, placeholder, mono = false, helper }: { label: string; value?: string; placeholder: string; mono?: boolean; helper?: string }) {
  return (
    <div className="grid gap-2">
      <div className="flex min-h-5 items-center gap-1.5">
        <Label>{label}</Label>
        {helper && <FieldInfo label={label}>{helper}</FieldInfo>}
      </div>
      <div
        className="flex h-11 min-h-11 items-center gap-2 rounded-md border border-input bg-muted/35 px-3 text-sm text-foreground"
        aria-label={`${label}: ${value || placeholder}`}
      >
        <LockKeyhole className="size-3.5 shrink-0 text-muted-foreground" />
        <span className={value ? (mono ? "font-mono font-medium" : "font-medium") : "text-muted-foreground"}>
          {value || placeholder}
        </span>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

export default function FiveSAuditCreate(props: FiveSAuditCreateProps) {
  const current = useCurrentUser(); const people = useAdminUsers(true); useAccessV3State();
  if (people.find(p => p.id === current.id)?.accessModel === "v3" || canScheduleAnyScopedAudit()) return <ScopedFiveSAuditCreate {...props}/>;
  return <LegacyFiveSAuditCreate {...props}/>;
}
function LegacyFiveSAuditCreate({ onBack, onStart }: FiveSAuditCreateProps) {
  const { locale, t } = useI18n();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const currentPlant = adminUser?.plant ?? currentUser.plant;
  const currentZone = adminUser?.zoneMemberships[0]?.zone ?? currentUser.primaryZone;
  const zoneConfiguration = useFiveSZoneConfiguration();
  const createdAt = useMemo(() => new Date(), []);
  const today = useMemo(() => toLocalInputDate(createdAt), [createdAt]);
  const defaultDueDate = useMemo(() => {
    const date = new Date(createdAt);
    date.setDate(date.getDate() + 2);
    return toLocalInputDate(date);
  }, [createdAt]);

  const [zone, setZone] = useState<string>("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [scheduleError, setScheduleError] = useState("");
  const [starting, setStarting] = useState(false);

  const selectedZone = zoneConfiguration.find((item) => item.name === zone);
  const generatedAuditTitle = zone
    ? getNextFiveSAuditTitle(currentPlant, zone)
    : "";

  const createdDate = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(createdAt);
  const createdTime = new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(createdAt);

  const ownZoneSelected = Boolean(zone && !canAuditZone({ primaryZone: currentZone }, zone));
  const scheduleIsValid = mode === "now" || !validateFiveSAuditSchedule(scheduledDate, scheduledTime, createdAt);
  const isValid = Boolean(selectedZone && generatedAuditTitle && dueDate >= today && !ownZoneSelected && scheduleIsValid);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    try {
    event.preventDefault();
    const nextScheduleError = mode === "schedule" ? validateFiveSAuditSchedule(scheduledDate, scheduledTime, new Date()) : null;
    setScheduleError(nextScheduleError ?? "");
    if (nextScheduleError || !isValid || !selectedZone || starting || !canAuditZone({ primaryZone: currentZone }, selectedZone.name)) return;

    setStarting(true);
    await onStart({ title: generatedAuditTitle, plant: currentPlant, department: selectedZone.department, area: selectedZone.name, auditor: currentUser.name, dueDate, startNow: mode === "now", scheduledDate: mode === "schedule" ? scheduledDate : undefined, scheduledTime: mode === "schedule" ? scheduledTime : undefined });

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save this record. Please retry.";
      setScheduleError(message); setStarting(false);
    }
  }

  return (
    <div className="min-h-full w-full">
      <div className="sticky top-(--app-header-height) z-30 border-b border-border bg-background/95 pt-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <FiveSPageHeader
          eyebrow=""
          title="Create 5S Audit"
          description={generatedAuditTitle || t("audit.selectZoneForId")}
          className="border-b-0 pb-3"
          leading={
            <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label={t("common.back")} className="-ml-2 shrink-0">
              <ArrowLeft className="size-4" />
            </Button>
          }
          actions={
            <>
              <Button type="button" variant="outline" onClick={onBack}>{t("common.cancel")}</Button>
              <Button type="submit" form="five-s-audit-form" disabled={!isValid || starting}>
                {starting ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Check className="size-4" />}
                {starting ? t("audit.starting") : mode === "schedule" ? "Schedule Audit" : t("audit.startAction")}
              </Button>
            </>
          }
        />
      </div>

      <div className="w-full px-6 py-5 lg:px-8 lg:py-6">
        <form id="five-s-audit-form" onSubmit={handleSubmit} className="mx-auto grid w-full max-w-[1600px] gap-5">
          <Card className="gap-0">
            <CardContent className="p-5 lg:p-6">
              <section>
                <h2 className="text-sm font-semibold">{t("audit.workplaceInformation")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("audit.workplaceHelp")}</p>

                <div className="mt-4 grid min-w-0 gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  <ReadOnlyField label={t("audit.plant")} value={currentPlant} placeholder={t("audit.profilePlantUnavailable")} />

                  <div className="grid gap-2">
                    <Label>{t("audit.zone")}</Label>
                    <OpsPersonSelect label={t("audit.zone")} clearable={false} entityLabel="Zone" entityPlural="Zones" showEligibleCount={false} value={zone} onValueChange={setZone} placeholder={t("audit.selectZone")} triggerClassName="h-11 min-h-11 w-full px-3" people={zoneConfiguration.map(item => ({ id: item.name, name: item.name, disabled: item.name === currentZone, description: item.name === currentZone ? t("audit.ownZone") : undefined }))} />
                  </div>

                  <div key={`leader-${zone}`} className="motion-success-in"><ReadOnlyField label={t("audit.zoneLeader")} value={selectedZone?.leader} placeholder={t("audit.selectZoneFirst")} /></div>
                  <div key={`audit-${generatedAuditTitle}`} className="motion-success-in"><ReadOnlyField
                    label={t("audit.auditId")}
                    value={generatedAuditTitle}
                    placeholder={t("audit.generatedAfterZone")}
                    mono
                    helper={t("audit.generatedIdHelp")}
                  /></div>
                </div>
              </section>

              <section className="mt-5 border-t border-border/65 pt-5">
                <h2 className="text-sm font-semibold">When</h2>
                <p className="mt-1 text-sm text-muted-foreground">Start the audit now or save it for a planned time.</p>
                <div className="mt-4 grid max-w-xl grid-cols-2 gap-2">
                  <button type="button" onClick={() => { setMode("now"); setScheduleError(""); }} className={`min-h-11 rounded-lg border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${mode === "now" ? "border-primary bg-primary/[0.08] text-primary" : "bg-background hover:bg-muted/30"}`}>Start now</button>
                  <button type="button" onClick={() => setMode("schedule")} className={`min-h-11 rounded-lg border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${mode === "schedule" ? "border-primary bg-primary/[0.08] text-primary" : "bg-background hover:bg-muted/30"}`}>Schedule</button>
                </div>
                {mode === "schedule" && <div className="mt-4 grid gap-4 md:max-w-xl md:grid-cols-2">
                  <div className="grid gap-2"><Label htmlFor="five-s-scheduled-date">Date *</Label><Input id="five-s-scheduled-date" type="date" min={today} value={scheduledDate} onChange={(event) => { setScheduledDate(event.target.value); setScheduleError(""); }} className="h-11 min-h-11 px-3" /></div>
                  <div className="grid gap-2"><Label htmlFor="five-s-scheduled-time">Time *</Label><Input id="five-s-scheduled-time" type="time" value={scheduledTime} onChange={(event) => { setScheduledTime(event.target.value); setScheduleError(""); }} className="h-11 min-h-11 px-3" /></div>
                </div>}
                {scheduleError && <p role="alert" className="mt-3 text-sm text-destructive">{scheduleError}</p>}
              </section>

              <section className="mt-5 border-t border-border/65 pt-5">
                <h2 className="text-sm font-semibold">{t("audit.details")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("audit.detailsHelp")}</p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <ReadOnlyField label={t("audit.auditor")} value={currentUser.name} placeholder={t("audit.auditorUnavailable")} />
                  <div className="grid gap-2">
                    <div className="flex min-h-5 items-center gap-1.5">
                      <Label htmlFor="five-s-due-date">{t("audit.dueDate")}</Label>
                      <FieldInfo label={t("audit.dueDate")}>
                        {formatDate(defaultDueDate, locale)}. {t("audit.dueDateHelp")}
                      </FieldInfo>
                    </div>
                    <Input
                      id="five-s-due-date"
                      type="date"
                      value={dueDate}
                      min={today}
                      onChange={(event) => setDueDate(event.target.value)}
                      className="h-11 min-h-11 px-3"
                    />
                  </div>
                </div>
              </section>

              <section className="mt-5 border-t border-border/65 pt-5">
                <div className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <h2 className="text-sm font-semibold">{t("audit.summary")}</h2>
                  <div className="mt-4 grid min-w-0 gap-x-5 gap-y-4 sm:grid-cols-2 2xl:grid-cols-4">
                    <SummaryItem label={t("audit.auditId")} value={generatedAuditTitle || t("audit.pendingZoneSelection")} mono />
                    <SummaryItem label={t("audit.plant")} value={currentPlant} />
                    <SummaryItem label={t("audit.zone")} value={selectedZone?.name || t("common.notSelected")} />
                    <SummaryItem label={t("audit.zoneLeader")} value={selectedZone?.leader || t("common.pending")} />
                    <SummaryItem label={t("audit.auditor")} value={currentUser.name} />
                    <SummaryItem label={t("common.created")} value={`${createdDate} · ${createdTime}`} />
                    <SummaryItem label={t("audit.schedule")} value={mode === "schedule" && scheduledDate && scheduledTime ? `${formatDate(scheduledDate, locale)} · ${scheduledTime}` : "Start now"} />
                    <SummaryItem label={t("audit.dueDate")} value={formatDate(dueDate, locale)} />
                  </div>
                </div>
              </section>
            </CardContent>
          </Card>

        </form>
      </div>
    </div>
  );
}

function ScopedFiveSAuditCreate({ onBack, onStart }: FiveSAuditCreateProps) {
  const current = useCurrentUser(); useAccessV3State();
  const { context: selectedContext } = useAccessContext(); const hierarchy = useAccessV4State(); const [departmentId, setDepartmentId] = useState("");
  const catalog = getAllOrganizationConfiguration();
  const factories = catalog.plants.filter(p => {
    if (selectedContext && (selectedContext.kind !== "factory" || p.id !== selectedContext.plantId || (p.organizationId ?? DEMO_ORGANIZATION.id) !== selectedContext.organizationId)) return false;
    if (current.isSuperAdmin) return selectedContext?.kind === "factory";
    const actor = resolveCurrentFactoryActor({ organizationId: p.organizationId ?? DEMO_ORGANIZATION.id, plantId: p.id });
    return Boolean(actor?.valid && (actor.clientAdmin || actor.factoryAdmin || actor.membership));
  });
  const plantId = factories[0]?.id ?? ""; const [zoneId, setZoneId] = useState(""); const [auditorId, setAuditorId] = useState("");
  const plant = factories.find(p => p.id === plantId); const organizationId = plant?.organizationId ?? DEMO_ORGANIZATION.id;
  const selectedActor = plantId && plant ? resolveCurrentFactoryActor({ organizationId: plant.organizationId ?? DEMO_ORGANIZATION.id, plantId }) : undefined;
  const canSchedule = Boolean(current.isSuperAdmin || selectedActor?.factoryAdmin);
  const [mode, setMode] = useState("now"); const [dueDate, setDueDate] = useState(() => { const date = new Date(); date.setDate(date.getDate() + 2); return toLocalInputDate(date); }); const [scheduledDate, setScheduledDate] = useState(""); const [scheduledTime, setScheduledTime] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const zones = catalog.zones.filter(z => z.plantId === plantId && z.status === "Active"); const zone = zones.find(z => z.id === zoneId);
  const eligible = zone ? eligibleAuditAssignees({ organizationId, plantId, zoneId }) : [];
  const title = plant && zone ? getNextFiveSAuditTitle(plant.name, zone.name) : `${plant?.name ?? "Selected factory"} · Select Zone`;
  return <div className="mx-auto grid w-full max-w-4xl gap-5 p-4 sm:p-6"><FiveSPageHeader title={canSchedule ? "Create 5S Audit" : "Start Audit"} description={title} actions={<Button variant="outline" onClick={onBack}>Cancel</Button>}/>
  {!factories.length ? <p role="alert">An active factory membership is required to start an Audit.</p> : <form className="grid gap-5" onSubmit={async e => { e.preventDefault(); if (!plant || !zone || pending) return; setPending(true); setError(""); try { if (!dueDate || dueDate < toLocalInputDate(new Date())) throw new Error("Select a valid due date."); if (mode === "schedule") { const invalid = validateFiveSAuditSchedule(scheduledDate, scheduledTime); if (invalid) throw new Error(invalid); if (!eligible.some(p => p.id === auditorId)) throw new Error("Select an eligible auditor."); } await onStart({ organizationId, plantId, zoneId, departmentId: departmentId || undefined, expectedContextSelectionId: selectedContext?.selectionId, assignedAuditorId: mode === "now" ? current.id : auditorId, title, plant: plant.name, department: zone.department, area: zone.name, auditor: mode === "now" ? current.name : eligible.find(p => p.id === auditorId)!.name, dueDate, startNow: mode === "now", scheduledDate: mode === "schedule" ? scheduledDate : undefined, scheduledTime: mode === "schedule" ? scheduledTime : undefined }); } catch(e) { setError(e instanceof Error ? e.message : "Unable to create Audit."); } finally { setPending(false); } }}>
  <OpsPersonSelect label="Zone" entityLabel="Zone" entityPlural="Zones" clearable={false} value={zoneId} people={zones} onValueChange={id => { setZoneId(id); setAuditorId(""); setDepartmentId(""); }}/>
  {organizationId !== DEMO_ORGANIZATION.id && <><OpsPersonSelect label="Canonical Department (optional)" entityLabel="Department" entityPlural="Departments" value={departmentId} people={hierarchy.departments.filter(d => d.organizationId === organizationId && d.plantId === plantId && d.zoneId === zoneId && d.status === "Active")} onValueChange={setDepartmentId}/><p className="text-sm text-muted-foreground">Without an explicit Department, corrective Action owner eligibility is unavailable; no Department is fabricated.</p></>}
  {canSchedule && <div className="flex flex-wrap gap-2"><Button type="button" variant={mode === "now" ? "default" : "outline"} onClick={() => setMode("now")}>Start now</Button><Button type="button" variant={mode === "schedule" ? "default" : "outline"} onClick={() => setMode("schedule")}>Schedule for auditor</Button></div>}
  {mode === "schedule" && <><OpsPersonSelect label="Assigned auditor" entityLabel="Auditor" entityPlural="Auditors" clearable={false} value={auditorId} people={eligible} onValueChange={setAuditorId}/>{zone && !eligible.length && <p role="status" className="text-sm text-muted-foreground">No eligible auditor for this Zone. Grant authorization to an active Zone Leader who does not lead this Zone before scheduling.</p>}<label className="grid gap-2 text-sm">Scheduled Date<Input aria-label="Scheduled Date" type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}/></label><label className="grid gap-2 text-sm">Scheduled Time<Input aria-label="Scheduled Time" type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}/></label></>}
  <label className="grid gap-2 text-sm">Due Date<Input aria-label="Due Date" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></label>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button disabled={pending || !zone || (mode === "schedule" && !eligible.some(p => p.id === auditorId))} type="submit">{pending ? "Saving…" : mode === "schedule" ? "Schedule Audit" : "Start Audit"}</Button></form>}</div>;
}
