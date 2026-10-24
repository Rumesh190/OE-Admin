"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { OpsDetailSection } from "@/components/ops/ops-detail-section";
import { CanonicalLinkedRecords } from "@/components/ops/ops-linked-records";

import { OpsEmptyState } from "@/components/ops/ops-empty-state";
import { OpsListingLayout, OPS_LISTING_TABLE } from "@/components/ops/ops-listing";
import { useListingFilter } from "@/lib/navigation/use-listing-filter";
import { useUrlState } from "@/lib/navigation/use-url-state";
import { newestCreatedFirst } from "@/lib/records/record-order";


import { withBusinessRecordCreation } from "@/lib/records/module-records";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "@/components/ops/ops-record-link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, Camera, Check, CheckCircle2, Circle, ChevronDown, Eye, FileText, Flag, Link2, LockKeyhole, Package, Plus, Printer, QrCode as QrCodeIcon, Search, Trash2, Upload, UserRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

import { PageContainer } from "@/components/layout/page-container";
import { OpsCameraCapture } from "@/components/ops/ops-camera-capture";
import { PageFormActionBar } from "@/components/ops/page-form-action-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { CreateLinkedActionDialog, type LinkedActionContext } from "@/features/actions/create-linked-action-dialog";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { toLocalInputDate } from "@/lib/five-s/configuration";
import { useOrganizationConfiguration } from "@/lib/organization-store";
import { useCurrentUser } from "@/lib/current-user";
import { ACTION_STATUS_CONFIG, getActionDueLabel } from "@/lib/actions/action-config";
import { canEditActionContent, canReviewAction, useActionStore } from "@/lib/actions/action-store";
import { amendRedTagDecision, canAmendRedTagDecision, clearRedTagHandlingMode, completeRedTagDisposition, confirmRedTagKeep, createAndSubmitRedTagV2, createRedTagV2, linkRedTagAction, markTagPrinted, reconcileRedTagActions, recordRedTagDecision, startRedTagDisposition, submitRedTagForReview, updateFurtherEvaluationDecision, useRedTags } from "./store";
import { getRedTagIdentificationEvidence, getRedTagReasonCategoryDisplay, getRedTagReasonDisplay, RED_TAG_DECISION_LABELS, RED_TAG_DECISIONS, RED_TAG_REASON_GROUPS, RED_TAG_REASONS, RED_TAG_SECTIONS, type RedTag, type RedTagDecision, type RedTagEvidence, type RedTagReason, type RedTagReasonCategory, type RedTagStatus } from "./types";
import { useI18n } from "@/components/preferences/use-i18n";
import { MAX_EVIDENCE_IMAGES, validateEvidenceSelection, optimizeEvidenceImage } from "@/lib/evidence-images";
import { canCreateRedTag, canManageRedTag, canCreateRedTagInZone, canLinkRedTagAction, canReviewRedTag, getRedTagDepartments, getRedTagZoneLeader } from "./access";
import { getRedTagActionIds, getLinkedRedTagActions, getRedTagTimelineStages, getRedTagActionReworkEvents } from "./workflow";
import { useActionEvidenceUrl } from "@/lib/actions/use-action-evidence-url";
import { resolveActionSourceBeforeEvidence } from "@/lib/actions/action-evidence";
import { ActionSubmissionHistory } from "@/features/actions/action-submission-history";
import { OpsTimeline } from "@/components/ops/ops-timeline";
import { RedTagNav } from "./red-tag-nav";
import { getCreateRedTagQrTarget, getRedTagQrTarget, getRedTagRecordPath } from "./qr";

const STATUS_TONE: Record<RedTagStatus, "danger" | "warning" | "success" | "secondary"> = {
  Open: "danger", "Under Review": "warning", "Decision Made": "warning", "Disposition In Progress": "warning", "In Progress": "warning", "Awaiting Verification": "success", Closed: "secondary",
};

function displayDate(value: string | undefined, time = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Not recorded";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}) }).format(new Date(value));
}

export function getRedTagDispositionStartErrors(input: { responsiblePersonId?: string; targetDate: string; executionNotes: string }) {
  return {
    responsible: input.responsiblePersonId ? "" : "Select a responsible person.",
    targetDate: input.targetDate ? "" : "Select a target date.",
    executionNotes: input.executionNotes.trim() ? "" : "Enter execution notes.",
  };
}

function Summary({ tags }: { tags: RedTag[] }) {
  const items = [
    { label: "Under Review", value: tags.filter((tag) => ["Open", "Under Review"].includes(tag.status)).length },
    { label: "Awaiting Closure", value: tags.filter((tag) => ["Decision Made", "Disposition In Progress", "In Progress", "Awaiting Verification"].includes(tag.status)).length },
    { label: "Closed", value: tags.filter((tag) => tag.status === "Closed").length },
  ];
  return <div className="grid overflow-hidden rounded-xl border bg-card shadow-sm sm:grid-cols-3">
    {items.map((item) => <div key={item.label} className="border-b p-4 last:border-0 even:border-l sm:border-b-0 sm:border-l sm:first:border-l-0">
      <p className="text-xs font-medium text-muted-foreground">{item.label}</p><p className="mt-1 text-2xl font-semibold tracking-tight">{item.value}</p>
    </div>)}
  </div>;
}

export function RedTagOverviewPage() {
  const tags = useRedTags(); const router = useRouter();
  const user = useCurrentUser();
  const adminUser = useAdminUsers(true).find((item) => item.id === user.id);
  const mayCreate = canCreateRedTag(adminUser);
  const organization = useOrganizationConfiguration();
  const [createQrOpen, setCreateQrOpen] = useState(false);
  const [createQrQuantity, setCreateQrQuantity] = useState("1");
  const plant = organization.plants.find((item) => item.status === "Active" && item.name === user.plant);
  const createQrTarget = useCreateRedTagQrTarget(plant?.id);
  const attention = newestCreatedFirst(tags).filter((tag) => tag.status !== "Closed" && (tag.status === "Awaiting Verification" || Boolean(tag.actionId) || tag.status === "Under Review"));
  const qrQuantity = Number(createQrQuantity);
  const validQrQuantity = Number.isInteger(qrQuantity) && qrQuantity >= 1 && qrQuantity <= 100;
  return <PageContainer className="max-w-none"><FiveSPageHeader eyebrow="Red Tag" title="Overview" description="Current review, closure, and attention workload from the Red Tag record." actions={mayCreate ? <><Button variant="outline" onClick={() => setCreateQrOpen(true)}><QrCodeIcon className="size-4" />Create QR</Button><Button onClick={() => router.push("/5s/red/create")}><Plus className="size-4" />Create Red Tag</Button></> : undefined} /><RedTagNav /><Summary tags={tags} /><section><h2 className="text-sm font-semibold">Requires attention</h2><div className="mt-3 divide-y overflow-hidden rounded-xl border bg-card">{attention.slice(0, 8).map((tag) => <button key={tag.id} onClick={() => router.push(`/5s/red/${tag.id}`)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/25"><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{tag.itemName}</p><p className="mt-1 text-xs text-muted-foreground">{tag.reasonCategory ? `${getRedTagReasonCategoryDisplay(tag.reasonCategory)} · ` : ""}{tag.reason === "Free Text" ? tag.customReason : tag.reason}</p></div><Badge variant={STATUS_TONE[tag.status]}>{getRedTagDisplayStatus(tag)}</Badge></button>)}{!attention.length && <p className="p-8 text-center text-sm text-muted-foreground">No Red Tags currently require attention.</p>}</div></section><Dialog open={createQrOpen} onOpenChange={setCreateQrOpen}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Create Red Tag QR</DialogTitle></DialogHeader><div className="grid justify-items-center gap-4 py-3 text-center"><p className="text-xl font-black tracking-wide text-red-700">RED TAG</p><QrCode value={createQrTarget} size={220} /><div><p className="font-semibold">Scan to create a Red Tag</p><p className="mt-1 text-sm text-muted-foreground">{plant?.name ?? user.plant}</p></div><Field label="Number of QR labels"><Input className="text-center" type="number" min={1} max={100} step={1} value={createQrQuantity} onChange={(event) => setCreateQrQuantity(event.target.value)} /></Field>{!validQrQuantity && <p role="alert" className="text-sm text-destructive">Enter a whole number from 1 to 100.</p>}<Button className="w-full" disabled={!validQrQuantity} onClick={() => router.push(`/5s/red/create-qr/print?${new URLSearchParams({ ...(plant ? { plant: plant.id } : {}), quantity: String(qrQuantity) }).toString()}`)}><Printer className="size-4" />Print {validQrQuantity ? qrQuantity : ""} QR {qrQuantity === 1 ? "label" : "labels"}</Button></div></DialogContent></Dialog></PageContainer>;
}

function getRedTagDisplayStatus(tag: RedTag) {
  if (tag.status === "Closed") return "Closed";
  if (["Open", "Under Review"].includes(tag.status)) return "Under Review";
  return "Awaiting Closure";
}

export function RedTagListPage({ view = "all" }: { view?: "all" | "awaiting-closure" | "closed" }) {
  const router = useRouter();
  const { t } = useI18n();
  const tags = useRedTags();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers(true).find((item) => item.id === currentUser.id);
  const mayCreate = canCreateRedTag(adminUser);
  const [search, setSearch] = useListingFilter<string>("search", ""); const [status, setStatus] = useListingFilter<string>("status", "All"); const [section, setSection] = useListingFilter<string>("section", "All");
  const [reason, setReason] = useListingFilter<string>("reason", "All"); const [person, setPerson] = useListingFilter<string>("person", "All"); const [date, setDate] = useListingFilter<string>("date", "");
  const people = [...new Set(tags.map((tag) => tag.responsiblePersonName).filter((value): value is string => Boolean(value)))];
  const listingUrl = useUrlState();
  const underReview = view === "all" && listingUrl.params.get("tab") === "under-review";
  const scoped = tags.filter((tag) => view === "closed" ? tag.status === "Closed" : view === "awaiting-closure" ? ["Decision Made", "Disposition In Progress", "In Progress", "Awaiting Verification"].includes(tag.status) : underReview ? ["Open", "Under Review"].includes(tag.status) : true);
  const filtered = newestCreatedFirst(scoped).filter((tag) => {
    const term = search.toLowerCase();
    return (!term || `${tag.tagNumber} ${tag.itemName} ${tag.remarks}`.toLowerCase().includes(term)) &&
      ((underReview || view !== "all") || status === "All" || getRedTagDisplayStatus(tag) === status) && (section === "All" || tag.section === section) &&
      (reason === "All" || tag.reason === reason) && (person === "All" || tag.responsiblePersonName === person) &&
      (!date || tag.createdAt?.slice(0, 10) === date);
  });
  return <OpsListingLayout className={OPS_LISTING_TABLE}>
    <FiveSPageHeader eyebrow="Red Tag" title={view === "closed" ? "Closed" : view === "awaiting-closure" ? "Awaiting Closure" : "Red Tags"} description={view === "closed" ? "Completed Red Tags with retained decision, evidence, and closure history." : view === "awaiting-closure" ? "Reviewed Red Tags waiting for completion, evidence, or a linked Action." : "Identify, review, and close physical workplace items."}
      actions={mayCreate ? <Button onClick={() => router.push("/5s/red/create")}><Plus className="size-4" /> {t("redTag.create")}</Button> : undefined} />
    <RedTagNav counts={{ "red-tag": tags.length, "under-review": tags.filter(tag => ["Open", "Under Review"].includes(tag.status)).length, "awaiting-closure": tags.filter(tag => ["Decision Made", "Disposition In Progress", "In Progress", "Awaiting Verification"].includes(tag.status)).length, closed: tags.filter(tag => tag.status === "Closed").length }} />
    {view === "all" && <Summary tags={tags} />}
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="grid gap-2 border-b bg-muted/15 p-3 md:grid-cols-3 xl:grid-cols-[minmax(220px,1.5fr)_repeat(5,minmax(130px,1fr))]">
        <div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-11 pl-9 md:h-9" placeholder="Search tags or items..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        {view === "all" && !underReview && <Filter value={status} onChange={setStatus} label="All statuses" options={["Under Review", "Awaiting Closure", "Closed"]} />}
        <Filter value={section} onChange={setSection} label="All sections" options={[...RED_TAG_SECTIONS]} />
        <Filter value={reason} onChange={setReason} label="All reasons" options={[...RED_TAG_REASONS, ...Object.values(RED_TAG_REASON_GROUPS).flat()]} />
        <Filter value={person} onChange={setPerson} label="All responsible" options={people} />
        <Input className="h-11 md:h-9" type="date" aria-label="Created date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="grid gap-3 p-3 md:hidden">{filtered.map((tag) => <article key={tag.id} className="min-w-0 rounded-xl border bg-background"><button onClick={() => router.push(`/5s/red/${tag.id}`)} className="w-full min-w-0 p-4 text-left active:bg-muted/40"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="font-mono text-xs font-bold text-red-700 dark:text-red-400">{tag.tagNumber}</p><h2 className="mt-1 break-words font-semibold">{tag.itemName}</h2></div><Badge variant={STATUS_TONE[tag.status]}>{tag.status}</Badge></div><dl className="mt-4 grid grid-cols-2 gap-3 border-t pt-3 text-sm"><div><dt className="text-xs text-muted-foreground">Section</dt><dd className="mt-1 break-words font-medium">{tag.section}</dd></div><div><dt className="text-xs text-muted-foreground">Reason</dt><dd className="mt-1 break-words font-medium">{tag.reason}</dd></div><div><dt className="text-xs text-muted-foreground">Responsible</dt><dd className="mt-1 break-words font-medium">{tag.responsiblePersonName ?? "Not assigned"}</dd></div><div><dt className="text-xs text-muted-foreground">Target</dt><dd className="mt-1 font-medium">{tag.targetDate ? displayDate(tag.targetDate) : "Not set"}</dd></div></dl></button><div className="flex justify-end px-3 pb-2"><RecordDeletionMenu module="redTag" recordId={tag.id} /></div></article>)}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[1180px] text-sm"><thead className="border-b bg-muted/20 text-left text-[11px] uppercase tracking-wide text-muted-foreground"><tr>
        {["Tag ID", "Item / Issue", "Location", "Responsible Person", "Target Date", "Status", "Linked Action", "Actions"].map((h) => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
      </tr></thead><tbody>{filtered.map((tag) => <tr key={tag.id} className="border-b last:border-0 hover:bg-muted/20">
        <td className="px-4 py-3 font-mono text-xs font-semibold text-red-700 dark:text-red-400">{tag.tagNumber}</td><td className="px-4 py-3 font-medium">{tag.itemName}</td>
        <td className="px-4 py-3">{tag.zone} · {tag.section}</td><td className="px-4 py-3">{tag.responsiblePersonName ?? "Not assigned"}</td>
        <td className="px-4 py-3 whitespace-nowrap">{tag.targetDate ? displayDate(tag.targetDate) : "Not set"}</td><td className="px-4 py-3"><Badge variant={STATUS_TONE[tag.status]}>{getRedTagDisplayStatus(tag)}</Badge></td>
        <td className="px-4 py-3 font-mono text-xs">{getRedTagActionIds(tag).join(", ") || "—"}</td><td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => router.push(`/5s/red/${tag.id}`)}><Eye className="size-4" /> View</Button><RecordDeletionMenu module="redTag" recordId={tag.id} /></td>
      </tr>)}</tbody></table></div>
      {(search || status !== "All" || section !== "All" || reason !== "All" || person !== "All" || date) && <Button variant="ghost" onClick={() => { setSearch(""); setStatus("All"); setSection("All"); setReason("All"); setPerson("All"); setDate(""); }}>Clear Filters</Button>}
      {filtered.length === 0 && <OpsEmptyState title="No Red Tags match this view" description="Try changing the search or filters." />}
    </section>
  </OpsListingLayout>;
}

function Filter({ value, onChange, label, options }: { value: string; onChange: (v: string) => void; label: string; options: string[] }) {
  return <Select value={value} onValueChange={(v) => onChange(v ?? "All")}><SelectTrigger className="h-11 min-h-11 w-full min-w-0 md:h-9 md:min-h-9" aria-label={label}><SelectValue>{value === "All" ? label : value}</SelectValue></SelectTrigger><SelectContent><SelectItem value="All">{label}</SelectItem>{options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>;
}

export function RedTagCreatePage({ plantRef }: { plantRef?: string } = {}) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers(true).find((item) => item.id === currentUser.id);
  if (!canCreateRedTag(adminUser)) {
    return <PageContainer><div className="grid min-h-[50vh] place-items-center rounded-xl border border-dashed"><div className="max-w-md text-center"><LockKeyhole className="mx-auto size-9 text-muted-foreground" /><h1 className="mt-3 font-semibold">Red Tag creation unavailable</h1><p className="mt-2 text-sm text-muted-foreground">You do not have permission to create Red Tags.</p><Button className="mt-4" variant="outline" onClick={() => router.push("/5s/red")}>Back to Red Tags</Button></div></div></PageContainer>;
  }
  return <RedTagCreateForm plantRef={plantRef} />;
}

function RedTagCreateForm({ plantRef }: { plantRef?: string }) {
  const router = useRouter(); const user = useCurrentUser();
  const organization = useOrganizationConfiguration();
  const resolvedPlant = organization.plants.find(item => item.status === "Active" && (plantRef ? item.id === plantRef : item.name === user.plant)) ?? (!plantRef && user.isSuperAdmin ? organization.plants.find(item => item.status === "Active") : undefined);
  const plantName = resolvedPlant?.name ?? user.plant;
  const { t } = useI18n();
  const today = useMemo(() => toLocalInputDate(new Date()), []);
  const [zone, setZone] = useState(user.primaryZone); const [item, setItem] = useState("");
  const [reasonCategory, setReasonCategory] = useState<RedTagReasonCategory | "">(""); const [reason, setReason] = useState<RedTagReason | "">(""); const [customReason, setCustomReason] = useState(""); const [remarks, setRemarks] = useState("");
  const [department, setDepartment] = useState<string>(); const [photos, setPhotos] = useState<RedTagEvidence[]>([]); const [preview, setPreview] = useState<RedTagEvidence | null>(null);
  const imageUrl = photos[0]?.url;
  const [processingPhotos, setProcessingPhotos] = useState(false);
  const processingPhotosRef = useRef(false);
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false); const [photoError, setPhotoError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const creatingRef = useRef(false);
  const validationTargets = useRef<Record<string, HTMLElement | null>>({});
  const uploadRef = useRef<HTMLInputElement>(null);
  const configuredUsers = useAdminUsers(true);
  const creator = configuredUsers.find(item => item.id === user.id);
  const availableZones = organization.zones.filter(candidate => candidate.status === "Active" && candidate.plantId === resolvedPlant?.id && canCreateRedTagInZone(creator, plantName, candidate.name));
  const selectedZone = availableZones.some(item => item.name === zone) ? zone : availableZones[0]?.name ?? "";
  const zoneConfig = availableZones.find(item => item.name === selectedZone);
  const reviewer = getRedTagZoneLeader(plantName, selectedZone);
  const departments = getRedTagDepartments(plantName);
  const effectiveDepartment = department ?? zoneConfig?.department ?? "";
  const validationErrors = {
    item: item.trim() ? "" : "Enter an item name.",
    zone: zoneConfig ? "" : "Select a permitted zone.",
    department: departments.includes(effectiveDepartment) ? "" : "Select a configured department.",
    remarks: remarks.trim() ? "" : "Describe the item and its current condition.",
    reasonCategory: reasonCategory ? "" : "Select a tagging category.",
    reason: reason ? "" : "Select a tagging reason.",
    customReason: reason !== "Free Text" || customReason.trim() ? "" : "Enter the tagging reason.",
    photo: imageUrl ? "" : "Add a photo to create this Red Tag.",
  };
  const invalidFields = Object.entries(validationErrors).filter(([, message]) => Boolean(message));
  async function addPhotos(files: File[]) {
    if (!files.length || processingPhotosRef.current || creatingRef.current) return;
    processingPhotosRef.current = true; setProcessingPhotos(true); setPhotoError("");
    try {
      validateEvidenceSelection(files, photos.length);
      const next: RedTagEvidence[] = [];
      for (const file of files) {
        const { dataUrl } = await optimizeEvidenceImage(file);
        next.push({ id: `RTE-${crypto.randomUUID()}`, name: file.name, url: dataUrl, mimeType: "image/jpeg", uploadedBy: user.name, uploadedAt: new Date().toISOString() });
      }
      setPhotos(previous => [...previous, ...next]);
    } catch (error) { setPhotoError(error instanceof Error ? error.message : "Unable to process these images."); }
    finally { processingPhotosRef.current = false; setProcessingPhotos(false); }
  }
  async function imageChanged(e: React.ChangeEvent<HTMLInputElement>) { const files = Array.from(e.target.files ?? []); e.target.value = ""; await addPhotos(files); }
  function submit() {
    if (creatingRef.current || processingPhotosRef.current) return;
    setSubmitAttempted(true);
    if (invalidFields.length || !reasonCategory || !reason || !zoneConfig || !effectiveDepartment || !imageUrl) {
      const firstKey = invalidFields[0]?.[0];
      const target = firstKey ? validationTargets.current[firstKey] : undefined;
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      if (firstKey !== "photo") window.setTimeout(() => target?.focus({ preventScroll: true }), 250);
      return;
    }
    setCreateError(""); creatingRef.current = true; setCreating(true);
    window.setTimeout(async () => { try { const input = { plant: plantName, zone: selectedZone, section: effectiveDepartment, department: effectiveDepartment, itemName: item.trim(), reasonCategory, reason, customReason: customReason.trim() || undefined, remarks: remarks.trim(), createdById: user.id, createdByName: user.name, imageUrl, identificationEvidence: photos }; const tag = await withBusinessRecordCreation(() => reviewer && reviewer.id !== user.id ? createAndSubmitRedTagV2(input, user, { id: reviewer.id, name: reviewer.name }) : createRedTagV2(input, user)); if (!tag) { setCreateError("Unable to create Red Tag. Check the form and browser storage, then retry."); creatingRef.current = false; setCreating(false); return; } router.push(`/5s/red/${tag.id}`); } catch (error) { setCreateError(error instanceof Error ? error.message : "Unable to create Red Tag."); creatingRef.current = false; setCreating(false); } }, 240);
  }
  return <PageContainer className="max-w-none">
    <FiveSPageHeader eyebrow="Red Tags / Create" title="Create Red Tag" description="Identify a physical item and capture the context needed for review."
      leading={<Button variant="ghost" size="icon-sm" aria-label="Back to Red Tags" onClick={() => router.push("/5s/red")}><ArrowLeft className="size-4" /></Button>} />
    <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-5">
      {!availableZones.length && <p role="alert" className="text-sm text-destructive">No active Zone is available for this factory.</p>}
      {createError && <p role="alert" className="text-sm text-destructive">{createError}</p>}
      <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
        <ReadOnly label="Plant" value={plantName} /><Field label="Zone" error={submitAttempted ? validationErrors.zone : undefined}><Select searchLabel="Red Tag Zone" value={selectedZone} onValueChange={(v) => setZone(v ?? user.primaryZone)}><SelectTrigger ref={node => { validationTargets.current.zone = node; }} aria-label="Red Tag Zone"><SelectValue placeholder="Select zone" /></SelectTrigger><SelectContent>{availableZones.map((z) => <SelectItem key={z.name} value={z.name}>{z.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Department *" error={submitAttempted ? validationErrors.department : undefined}><Select searchLabel="Department" value={effectiveDepartment} onValueChange={value => setDepartment(value ?? "")}><SelectTrigger ref={node => { validationTargets.current.department = node; }} aria-label="Department"><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent>{departments.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field><ReadOnly label="Tag ID" value="RT-###### (assigned on save)" /><ReadOnly label="Date Identified" value={today} /><ReadOnly label="Identified By" value={user.name} />
      </CardContent></Card>
      <Card><CardContent className="grid gap-5 p-5">
        <div><h2 className="font-semibold">Physical Item</h2><p className="mt-1 text-xs text-muted-foreground">Record the item that needs review.</p></div>
        <div className="grid gap-4 md:grid-cols-2"><Field label="Item Name *" error={submitAttempted ? validationErrors.item : undefined} errorId="red-tag-item-error"><Input ref={(node) => { validationTargets.current.item = node; }} required value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Obsolete welding fixture" aria-invalid={submitAttempted && Boolean(validationErrors.item)} aria-describedby={submitAttempted && validationErrors.item ? "red-tag-item-error" : undefined} /></Field></div>
        <Field label="Item Description *" error={submitAttempted ? validationErrors.remarks : undefined} errorId="red-tag-remarks-error"><Textarea ref={(node) => { validationTargets.current.remarks = node; }} required value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Describe the item and its current condition." aria-invalid={submitAttempted && Boolean(validationErrors.remarks)} aria-describedby={submitAttempted && validationErrors.remarks ? "red-tag-remarks-error" : undefined} /></Field>
      </CardContent></Card>
      <Card><CardContent className="grid gap-5 p-5">
        <div><h2 className="font-semibold">Tagging Reason</h2><p className="mt-1 text-xs text-muted-foreground">Explain why this physical item needs review.</p></div>
        <Field label="Category *" error={submitAttempted ? validationErrors.reasonCategory : undefined} errorId="red-tag-reason-category-error"><div aria-invalid={submitAttempted && Boolean(validationErrors.reasonCategory)} aria-describedby={submitAttempted && validationErrors.reasonCategory ? "red-tag-reason-category-error" : undefined} className={`grid gap-2 rounded-lg sm:grid-cols-2 lg:grid-cols-5 ${submitAttempted && validationErrors.reasonCategory ? "ring-2 ring-destructive/20" : ""}`}>{(Object.keys(RED_TAG_REASON_GROUPS) as RedTagReasonCategory[]).map((option, index) => <button ref={index === 0 ? (node) => { validationTargets.current.reasonCategory = node; } : undefined} key={option} type="button" onClick={() => { setReasonCategory(option); setReason(option === "Other" ? "Free Text" : ""); setCustomReason(""); }} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${reasonCategory === option ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-background hover:border-primary/40"}`}>{getRedTagReasonCategoryDisplay(option)}</button>)}</div></Field>
        {reasonCategory && reasonCategory !== "Other" && <Field label="Reason *" error={submitAttempted ? validationErrors.reason : undefined} errorId="red-tag-reason-error"><div aria-invalid={submitAttempted && Boolean(validationErrors.reason)} aria-describedby={submitAttempted && validationErrors.reason ? "red-tag-reason-error" : undefined} className={`grid gap-2 rounded-lg sm:grid-cols-2 lg:grid-cols-3 ${submitAttempted && validationErrors.reason ? "ring-2 ring-destructive/20" : ""}`}>{RED_TAG_REASON_GROUPS[reasonCategory].map((option, index) => <button ref={index === 0 ? (node) => { validationTargets.current.reason = node; } : undefined} key={option} type="button" onClick={() => setReason(option)} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${reason === option ? "border-primary bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-background hover:border-primary/40"}`}>{reason === option && <CheckCircle2 className="mr-2 inline size-4" />}{option}</button>)}</div></Field>}
        {reasonCategory === "Other" && <Field label="Reason *" error={submitAttempted ? validationErrors.customReason : undefined} errorId="red-tag-custom-reason-error"><Input ref={(node) => { validationTargets.current.customReason = node; }} required value={customReason} onChange={(e) => setCustomReason(e.target.value)} placeholder="Describe the tagging reason..." aria-invalid={submitAttempted && Boolean(validationErrors.customReason)} aria-describedby={submitAttempted && validationErrors.customReason ? "red-tag-custom-reason-error" : undefined} /></Field>}
      </CardContent></Card>
      <Card ref={(node) => { validationTargets.current.photo = node; }} className={submitAttempted && validationErrors.photo ? "border-destructive ring-2 ring-destructive/20" : undefined}><CardContent className="grid gap-5 p-5"><div><h2 className="font-semibold">Photo Identification</h2><p className="mt-1 text-xs text-muted-foreground">Capture the image used to identify this Red Tag.</p></div>
        <Field label="Image *" error={photoError || (submitAttempted ? validationErrors.photo : undefined)} errorId="red-tag-photo-error">
          <div className="grid gap-3" aria-busy={processingPhotos} aria-invalid={Boolean(photoError || (submitAttempted && validationErrors.photo))} aria-describedby={photoError || (submitAttempted && validationErrors.photo) ? "red-tag-photo-error" : undefined}>
            <div className="flex flex-wrap gap-2">
              <OpsCameraCapture fileNamePrefix="red-tag-image" onCapture={(file) => addPhotos([file])} trigger={(openCamera) => <Button type="button" variant="outline" disabled={processingPhotos || creating || photos.length >= MAX_EVIDENCE_IMAGES} onClick={openCamera}><Camera className="size-4" />Take Photo</Button>} />
              <Button type="button" variant="outline" disabled={processingPhotos || creating || photos.length >= MAX_EVIDENCE_IMAGES} onClick={() => uploadRef.current?.click()}><Upload className="size-4" />Upload Photos</Button>
            </div>
            <p className="text-xs text-muted-foreground" role="status">{processingPhotos ? "Processing images…" : `${photos.length} of ${MAX_EVIDENCE_IMAGES} photos attached. First photo is the primary image.`}</p>
            <input ref={uploadRef} hidden multiple type="file" accept="image/*" aria-label="Attach Red Tag images" onChange={imageChanged} />
            {photos.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">{photos.map((photo, index) => <div key={photo.id} className="min-w-0 rounded-lg border">
              <button type="button" className="block w-full rounded-t-lg focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Preview image ${index + 1}`} onClick={() => setPreview(photo)}><Image unoptimized width={240} height={180} src={photo.url!} alt={photo.name} className="aspect-[4/3] w-full rounded-t-lg object-cover" /></button>
              <div className="grid gap-1 border-t p-2"><p className="truncate text-xs" title={photo.name}>{photo.name}</p><Button type="button" size="sm" variant="ghost" className="text-destructive" disabled={processingPhotos || creating} aria-label={`Remove image ${index + 1}`} onClick={() => { setPhotos(photos.filter(item => item.id !== photo.id)); setPhotoError(""); }}><Trash2 className="size-4" />Remove</Button></div>
            </div>)}</div>}
          </div>
        </Field>
      </CardContent></Card>
      <PageFormActionBar primaryLabel={t("redTag.create")} submittingLabel="Creating…" primaryType="submit" secondaryLabel={t("common.cancel")} secondaryAction={() => router.push("/5s/red")} isSubmitting={creating} primaryDisabled={processingPhotos || !availableZones.length} validationSummary={submitAttempted && invalidFields.length ? `${invalidFields.length} required ${invalidFields.length === 1 ? "field needs" : "fields need"} attention.` : undefined} />
    </form>
    <Dialog open={Boolean(preview)} onOpenChange={(open) => { if (!open) setPreview(null); }}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Identification Image</DialogTitle></DialogHeader>{preview?.url && <Image unoptimized width={1200} height={900} src={preview.url} alt={preview.name} className="max-h-[70dvh] w-full object-contain" />}</DialogContent></Dialog>
  </PageContainer>;
}

function Field({ label, children, error, errorId }: { label: string; children: React.ReactNode; error?: string; errorId?: string }) { return <div className="grid content-start gap-2"><Label>{label}</Label>{children}{error && <p id={errorId} role="alert" className="text-xs font-medium text-destructive">{error}</p>}</div>; }
function ReadOnly({ label, value }: { label: string; value: string }) { return <Field label={label}><div className="flex h-10 items-center rounded-md border bg-muted/35 px-3 text-sm font-medium">{value}</div></Field>; }

function useRedTagQrTarget(tagId: string) {
  const origin = useSyncExternalStore(() => () => undefined, () => window.location.origin, () => "");
  return getRedTagQrTarget(tagId, origin);
}

function useCreateRedTagQrTarget(plantId?: string) {
  const origin = useSyncExternalStore(() => () => undefined, () => window.location.origin, () => "");
  return getCreateRedTagQrTarget(plantId, origin);
}

export function RedTagCreateQrPrintPage({ plantRef, quantity = 1 }: { plantRef?: string; quantity?: number }) {
  const user = useCurrentUser();
  const organization = useOrganizationConfiguration();
  const plant = organization.plants.find((item) => item.id === plantRef && item.status === "Active");
  const target = useCreateRedTagQrTarget(plant?.id);
  return <PageContainer className="max-w-5xl"><FiveSPageHeader eyebrow="Red Tag" title="Print Create QR" description={`${quantity} reusable shop-floor QR ${quantity === 1 ? "label" : "labels"} linked to the canonical Create Red Tag form.`} actions={<Button onClick={() => window.print()}><Printer className="size-4" />Print {quantity}</Button>} /><div className="red-tag-print-surface grid gap-4 sm:grid-cols-2">{Array.from({ length: quantity }, (_, index) => <div key={index} className="grid break-inside-avoid justify-items-center gap-4 rounded-xl border bg-white p-8 text-center text-slate-950"><p className="text-2xl font-black tracking-[0.16em] text-red-700">RED TAG</p><p className="text-lg font-semibold">Scan to create a Red Tag</p><QrCode value={target} size={220} /><p className="text-sm font-semibold">{plant?.name ?? user.plant}</p></div>)}</div></PageContainer>;
}

export function RedTagDetailPage({ tagId }: { tagId: string }) {
  const router = useRouter();
  const tags = useRedTags();
  const actions = useActionStore();
  const user = useCurrentUser();
  const adminUsers = useAdminUsers(true);
  const adminUser = adminUsers.find((item) => item.id === user.id);
  const tag = tags.find((item) => item.id === tagId);
  const linkedActions = tag ? getLinkedRedTagActions(tag, actions) : [];
  const mayLink = tag ? canLinkRedTagAction(tag, adminUser) : false;
  const mayManage = Boolean(tag && canManageRedTag(tag, adminUser));
  const [actionOpen, setActionOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const qrTarget = useRedTagQrTarget(tagId);

  useEffect(() => { reconcileRedTagActions(actions); }, [actions, tag?.decisionRecord?.type]);
  if (!tag) return <Missing onBack={() => router.push("/5s/red")} />;
  const actionContext: LinkedActionContext = {
    source: "Red Tag", sourceModule: "redTag", sourceId: tag.id, sourceObservation: tag.decisionRecord ? `Decision · ${RED_TAG_DECISION_LABELS[tag.decisionRecord.type]} · Reason · ${getRedTagReasonDisplay(tag.reason, tag.customReason)}` : getRedTagReasonDisplay(tag.reason, tag.customReason),
    title: `Execute ${tag.tagNumber}: ${tag.itemName}`, description: tag.decisionRecord ? `${RED_TAG_DECISION_LABELS[tag.decisionRecord.type]} · ${getRedTagReasonDisplay(tag.reason, tag.customReason)} · ${tag.remarks}` : tag.requiredAction ?? tag.remarks,
    plant: tag.plant, zone: tag.zone, location: tag.section,
    evidence: [], sourceEvidenceCount: getRedTagIdentificationEvidence(tag).length,
    defaultResponsibleId: tag.dispositionDetails?.responsiblePersonId ?? tag.responsiblePersonId, defaultDueDate: tag.dispositionDetails?.targetDate ?? tag.targetDate,
  };
  return <PageContainer className="max-w-none"><FiveSPageHeader eyebrow="Red Tags / Details" title={tag.tagNumber} description={`${tag.itemName} · ${tag.section}`}
    leading={<Button variant="ghost" size="icon-sm" aria-label="Back to Red Tags" onClick={() => router.push("/5s/red")}><ArrowLeft className="size-4" /></Button>}
    actions={<><RecordDeletionMenu module="redTag" recordId={tag.id} returnTo="/5s/red" /><Button variant="outline" onClick={() => router.push(`/5s/red/${tag.id}/report`)}><FileText className="size-4" />View Report</Button><Button variant="outline" onClick={() => setQrOpen(true)}><QrCodeIcon className="size-4" /> View QR</Button><Button variant="outline" onClick={() => router.push(`/5s/red/${tag.id}/print`)}><Printer className="size-4" /> Print Red Tag</Button></>} />
    <RedTagLifecycleIndicator tag={tag} actions={linkedActions} />
    <div className="grid min-w-0 gap-5 [overflow-wrap:anywhere]">
      <OpsDetailSection title="Item Details" trailing={<Badge variant={STATUS_TONE[tag.status]}>{tag.status}</Badge>}><div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"><Meta icon={Package} label="Item / Equipment" value={tag.itemName} /><Meta label="Red Tag ID" value={tag.tagNumber} />{tag.quantity !== undefined && <Meta label="Quantity" value={String(tag.quantity)} />}<Meta label="Category" value={tag.category ?? "Not recorded"} /><Meta label="Location" value={`${tag.plant} · ${tag.zone} · ${tag.section}`} /><Meta label="Department" value={tag.department ?? "Not recorded"} /><Meta label="Reason" value={getRedTagReasonDisplay(tag.reason, tag.customReason)} />{tag.estimatedValue !== undefined && <Meta label="Estimated Value" value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(tag.estimatedValue)} />}<Meta icon={CalendarDays} label="Identified Date" value={displayDate(tag.createdAt, true)} /><Meta icon={UserRound} label="Identified By" value={tag.createdByName} /></div><section aria-labelledby="red-tag-item-description" className="grid min-w-0 gap-3 border-t pt-5"><h3 id="red-tag-item-description" className="flex items-center gap-2 text-sm font-semibold"><FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />Item Description</h3><p className={`max-w-prose whitespace-pre-wrap text-sm leading-7 [overflow-wrap:anywhere] ${tag.remarks ? "text-foreground/85" : "italic text-muted-foreground"}`}>{tag.remarks || "No description added."}</p></section></OpsDetailSection>
      <RedTagIdentificationPhotos tag={tag} />
      <CanonicalLinkedRecords currentRecord={{module:"redTag",recordId:tag.id}} collapsible />
      <RedTagReviewDecisionSection tag={tag} mayManage={tag.status === "Open" ? mayManage : canReviewRedTag(tag, adminUser)} user={user} />
      <RedTagDispositionSection tag={tag} actions={linkedActions} mayManage={tag.decisionRecord && ["keep", "further_evaluation"].includes(tag.decisionRecord.type) ? canReviewRedTag(tag, adminUser) : mayManage} user={user} users={adminUsers} onCreateAction={() => setActionOpen(true)} />
      {((tag.decisionRecord && tag.decisionRecord.type !== "keep") || linkedActions.length > 0) && <LinkedActionSection tag={tag} actions={linkedActions} mayCreate={mayLink} user={user} onCreate={() => setActionOpen(true)} />}
    </div>
    <OpsDetailSection title={`Tag History · ${tag.history.length} events`} defaultOpen={false} testId="red-tag-history"><OpsTimeline items={[...tag.history].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime()).map(event => ({ id: event.id, title: event.label, actor: event.actor, timestamp: event.at }))} /></OpsDetailSection>
    <CreateLinkedActionDialog key={tag.id} open={actionOpen} onOpenChange={setActionOpen} context={mayLink ? actionContext : null} onCreated={(created) => { const linked = linkRedTagAction(tag.id, created.id, user); if (!linked) return false; setActionOpen(false); return true; }} />
    <Dialog open={qrOpen} onOpenChange={setQrOpen}><DialogContent className="max-w-sm"><DialogHeader><DialogTitle>Red Tag QR</DialogTitle></DialogHeader><div className="grid justify-items-center gap-3 py-3 text-center"><p className="font-mono text-lg font-bold">{tag.tagNumber}</p><p className="text-sm font-semibold">{tag.itemName}</p><QrCode value={qrTarget} size={240} /><p className="text-sm font-medium">Scan to view Red Tag</p><p className="text-xs text-muted-foreground">{tag.zone} · {tag.section}</p></div></DialogContent></Dialog>
  </PageContainer>;
}

function RedTagIdentificationPhotos({ tag }: { tag: RedTag }) {
  const photos = getRedTagIdentificationEvidence(tag);
  const [preview, setPreview] = useState<RedTagEvidence | null>(null);
  if (!photos.length) return null;
  return <><OpsDetailSection title="Identification Images"><div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((photo, index) => <button type="button" key={photo.id} aria-label={`View identification image ${index + 1}`} onClick={() => setPreview(photo)} className="min-w-0 rounded-lg border text-left focus-visible:ring-2 focus-visible:ring-ring"><Image unoptimized width={400} height={300} src={photo.url} alt={photo.name} className="aspect-[4/3] w-full rounded-t-lg object-contain" /><p className="truncate border-t p-2 text-xs">{photo.name}</p></button>)}</div></OpsDetailSection><Dialog open={Boolean(preview)} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="max-w-4xl"><DialogHeader><DialogTitle>Identification Image</DialogTitle></DialogHeader>{preview && <Image unoptimized width={1200} height={900} src={preview.url} alt={preview.name} className="max-h-[70dvh] w-full object-contain" />}</DialogContent></Dialog></>;
}

export function RedTagLifecycleIndicator({ tag, actions = [] }: { tag: RedTag; actions?: ReturnType<typeof useActionStore> }) {
  const stages = getRedTagTimelineStages(tag, actions);
  const rework = getRedTagActionReworkEvents(actions);
  const completed = actions.filter(action => action.status === "Completed").length;
  return <OpsDetailSection title="Workflow"><ol aria-label="Red Tag workflow" className={`grid gap-3 ${stages.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-5"}`}>{stages.map(stage =>
    <li key={stage.label} aria-current={stage.state === "current" ? "step" : undefined} data-state={stage.state} className="flex min-w-0 items-start gap-2"><span className={`grid size-7 shrink-0 place-items-center rounded-full border ${stage.complete ? "border-emerald-600 bg-emerald-600 text-white" : stage.state === "current" ? "border-red-600 bg-red-600 text-white" : "bg-background text-muted-foreground"}`}>{stage.complete ? <Check className="size-4" /> : <Circle className="size-3 fill-current" />}</span><span className="min-w-0 break-words text-xs font-semibold">{stage.label}<span className="mt-1 block font-normal text-muted-foreground">{tag.status === "Closed" && !stage.complete ? "Not recorded" : stage.state}</span>{stage.actor && <span className="mt-1 block font-normal text-muted-foreground">{stage.actor}</span>}{stage.at && <time dateTime={stage.at} className="mt-1 block font-normal text-muted-foreground">{displayDate(stage.at, true)}</time>}</span></li>
  )}</ol>{actions.length > 0 && <p className="text-sm text-muted-foreground">Linked Actions: {completed} of {actions.length} completed</p>}{rework.length > 0 && <section className="min-w-0 border-t pt-4 [overflow-wrap:anywhere]" aria-label="Linked Action rework history"><h2 className="mb-3 text-sm font-semibold">Linked Action Rework</h2><OpsTimeline items={rework.map(event => ({ id: `${event.actionId}-${event.id}`, title: `Action ${event.actionId} sent back for rework`, actor: event.actorName, timestamp: event.createdAt, remark: event.remark, linkedRecord: <Link className="underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring" href={`/actions/${encodeURIComponent(event.actionId)}`}>{event.actionId}</Link> }))} /></section>}</OpsDetailSection>;
}

function RedTagReviewDecisionSection({ tag, mayManage, user }: { tag: RedTag; mayManage: boolean; user: ReturnType<typeof useCurrentUser> }) {
  const [decision, setDecision] = useState<RedTagDecision | "">(tag.decisionRecord?.type ?? "");
  const [editingDecision, setEditingDecision] = useState(true);
  const [amending, setAmending] = useState(false);
  const mayAmend = canAmendRedTagDecision(tag, user);
  const [commentsByDecision, setCommentsByDecision] = useState<Partial<Record<RedTagDecision, string>>>({});
  const comments = decision ? commentsByDecision[decision] ?? (amending ? "" : tag.review?.comments ?? "") : "";
  const [error, setError] = useState("");
  const [keepJustification, setKeepJustification] = useState("");
  const decisionSubmission = useRef(false);
  const assignedToCurrentUser = tag.review?.reviewerId === user.id;

  function submitForReview() {
    const leader = getRedTagZoneLeader(tag.plant, tag.zone);
    if (!leader || !submitRedTagForReview(tag.id, { reviewerId: leader.id, reviewerName: leader.name }, user)) setError("Unable to submit this Red Tag for review.");
    else setError("");
  }
  function closeKeep() {
    if (decisionSubmission.current) return;
    if (!keepJustification.trim()) { setError("Enter a justification to confirm Keep and close this Red Tag."); return; }
    decisionSubmission.current = true;
    if (!confirmRedTagKeep(tag.id, keepJustification, user, amending ? tag.decisionRecord?.decidedAt : undefined)) {
      decisionSubmission.current = false;
      setError("Unable to confirm Keep and close. Check reviewer permissions or retry saving.");
    } else setError("");
  }
  function saveDecision() {
    if (!decision || decision === "keep" || decisionSubmission.current) return;
    decisionSubmission.current = true;
    if (!(amending ? amendRedTagDecision(tag.id, { decision, comments }, tag.decisionRecord!.decidedAt, user) : recordRedTagDecision(tag.id, { decision, comments }, user))) {
      decisionSubmission.current = false;
      setError(amending ? "Unable to save this edit. The record may have changed or saving failed. Check reviewer access, reload and retry." : "Unable to record this decision. Only the assigned reviewer can complete the review.");
    } else { setError(""); setAmending(false); decisionSubmission.current = false; }
  }

  return <OpsDetailSection title="Review and Decision" description="Review the original item context and photo before recording a decision.">
    {tag.status === "Open" ? <div className="rounded-lg border border-dashed p-4"><p className="text-sm text-muted-foreground">This Red Tag is ready to enter review.</p>{mayManage ? <Button className="mt-3" onClick={submitForReview}><CheckCircle2 className="size-4" />Submit for Review</Button> : <p className="mt-2 text-xs text-muted-foreground">A user with Red Tag management permission must submit it.</p>}</div> : tag.status === "Under Review" || (amending && mayAmend) ? <div className="grid gap-5"><div className="grid gap-4 sm:grid-cols-2"><Meta icon={UserRound} label="Reviewer" value={tag.review?.reviewerName ?? "Not assigned"} /><Meta icon={CalendarDays} label="Review Date" value={tag.review?.submittedAt ? displayDate(tag.review.submittedAt, true) : "Not recorded"} /></div>{assignedToCurrentUser && mayManage ? <>{editingDecision || !decision ? <Field label="Decision"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{RED_TAG_DECISIONS.map((item) => <button key={item} type="button" aria-pressed={decision === item} onClick={() => { setDecision(item); setEditingDecision(false); setError(""); }} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${decision === item ? "border-red-500 bg-red-50 text-red-800 ring-1 ring-red-500/30 dark:bg-red-950/35 dark:text-red-200" : "bg-background hover:border-red-300"}`}>{RED_TAG_DECISION_LABELS[item]}</button>)}</div></Field> : <RedTagDecisionConfirmationForm decision={decision} comments={comments} keepJustification={keepJustification} error={error} onCommentsChange={(value) => setCommentsByDecision((current) => ({ ...current, [decision]: value }))} onKeepJustificationChange={setKeepJustification} onBack={() => { setEditingDecision(true); setError(""); }} onSubmit={decision === "keep" ? closeKeep : saveDecision} />}</> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Waiting for {tag.review?.reviewerName ?? "the assigned reviewer"} to record a decision.</p>}</div> : tag.decisionRecord ? <div className="grid gap-4 sm:grid-cols-2"><Meta label="Decision" value={RED_TAG_DECISION_LABELS[tag.decisionRecord.type]} /><Meta label="Decided By" value={tag.decisionRecord.decidedByName} /><Meta label="Decision Date" value={displayDate(tag.decisionRecord.decidedAt, true)} />{tag.decisionRecord.comments && <Meta label="Comments" value={tag.decisionRecord.comments} />}</div> : <p className="text-sm text-muted-foreground">This legacy Red Tag does not have a V2 decision record.</p>}
    {mayAmend && (amending ? <Button className="w-fit" variant="ghost" onClick={() => { setAmending(false); setError(""); }}>Cancel Edit</Button> : <Button className="w-fit" variant="outline" onClick={() => { setDecision(tag.decisionRecord!.type); setCommentsByDecision(current => ({ ...current, [tag.decisionRecord!.type]: tag.decisionRecord!.comments ?? "" })); setEditingDecision(true); decisionSubmission.current = false; setError(""); setAmending(true); }}>Edit Decision</Button>)}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </OpsDetailSection>;
}

export function RedTagDecisionConfirmationForm({ decision, comments, keepJustification, error, onCommentsChange, onKeepJustificationChange, onBack, onSubmit }: {
  decision: RedTagDecision;
  comments: string;
  keepJustification: string;
  error: string;
  onCommentsChange: (value: string) => void;
  onKeepJustificationChange: (value: string) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const isKeep = decision === "keep";
  return <section className="grid gap-4" aria-label={`${RED_TAG_DECISION_LABELS[decision]} confirmation`}>
    <div><h3 className="font-semibold">{isKeep ? "Keep Confirmation" : `${RED_TAG_DECISION_LABELS[decision]} Confirmation`}</h3>{isKeep && <p className="mt-1 text-sm text-muted-foreground">Explain why this item should remain. Confirmation records the decision and closes the Red Tag.</p>}</div>
    {isKeep ? <Field label="Keep Justification *"><Textarea aria-label="Keep Justification" required value={keepJustification} onChange={(event) => onKeepJustificationChange(event.target.value)} aria-invalid={Boolean(error) && !keepJustification.trim()} placeholder="Explain why this item should be kept." /></Field> : <Field label="Review Comments"><Textarea aria-label="Review Comments" value={comments} onChange={(event) => onCommentsChange(event.target.value)} placeholder="Add the reasoning or conditions for this decision." /></Field>}
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={onBack}>Back / Edit Decision</Button><Button onClick={onSubmit}>{isKeep ? "Confirm Keep & Close" : "Record Decision"}</Button></div>
  </section>;
}

function RedTagDispositionSection({ tag, actions, mayManage, user, users, onCreateAction }: { tag: RedTag; actions: ReturnType<typeof useActionStore>; mayManage: boolean; user: ReturnType<typeof useCurrentUser>; users: ReturnType<typeof useAdminUsers>; onCreateAction: () => void }) {
  const action = actions[0];
  const [responsibleId, setResponsibleId] = useState(tag.dispositionDetails?.responsiblePersonId ?? (tag.handlingMode === "direct" ? user.id : ""));
  const [targetDate, setTargetDate] = useState(tag.dispositionDetails?.targetDate ?? "");
  const [executionNotes, setExecutionNotes] = useState(tag.dispositionDetails?.executionNotes ?? "");
  const [approvalConfirmed, setApprovalConfirmed] = useState(false);
  const [approvalComment, setApprovalComment] = useState("");
  const [completionNotes, setCompletionNotes] = useState(tag.dispositionDetails?.completionNotes ?? "");
  const [responsibleConfirmed, setResponsibleConfirmed] = useState(false);
  const [evidenceDraft, setEvidence] = useState<RedTagEvidence[]>();
  const evidence = evidenceDraft ?? (tag.handlingMode === "linked_action" ? tag.afterEvidence ?? [] : []);
  const [completionAttempted, setCompletionAttempted] = useState(false);
  const [completing, setCompleting] = useState(false);
  const completionLock = useRef(false);
  const completionTargets = useRef<Record<string, HTMLElement | null>>({});
  const [keepJustification, setKeepJustification] = useState(tag.keepConfirmation?.justification ?? "");
  const [replacement, setReplacement] = useState<Exclude<RedTagDecision, "further_evaluation"> | "">("");
  const [replacementComments, setReplacementComments] = useState("");
  const [error, setError] = useState("");
  const [startAttempted, setStartAttempted] = useState(false);
  const startTargets = useRef<Record<string, HTMLElement | null>>({});
  const decision = tag.decisionRecord?.type;
  const eligibleUsers = users.filter((item) => item.status === "Active");
  const effectiveResponsibleId = tag.handlingMode === "direct" ? user.id : responsibleId;
  const responsible = tag.handlingMode === "direct" ? user : eligibleUsers.find((item) => item.id === effectiveResponsibleId);
  const startErrors = getRedTagDispositionStartErrors({ responsiblePersonId: responsible?.id, targetDate, executionNotes });
  const completionErrors = {
    notes: completionNotes.trim() ? "" : "Enter completion notes.",
    evidence: evidence.length ? "" : "Add an After photo to complete the disposition.",
    confirmation: responsibleConfirmed ? "" : "Confirm that the disposition work is complete.",
  };
  const incompleteLinkedAction = getRedTagActionIds(tag).some(id => !actions.some(action => action.id === id)) || actions.some(action => action.status !== "Completed");

  function start() {
    setStartAttempted(true);
    const missing = Object.entries(startErrors).filter(([, message]) => Boolean(message));
    if (missing.length) {
      setError(missing.length === 1 ? missing[0][1] : `Complete the required fields:\n${missing.map(([, message]) => `• ${message.replace(/\.$/, "")}`).join("\n")}`);
      const target = startTargets.current[missing[0][0]];
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      window.setTimeout(() => target?.focus({ preventScroll: true }), 250);
      return;
    }
    if (!responsible) return;
    if (!startRedTagDisposition(tag.id, { responsiblePersonId: responsible.id, responsiblePersonName: responsible.name, targetDate, executionNotes, approval: approvalConfirmed ? { approved: true, approvedAt: new Date().toISOString(), approvedByUserId: user.id, approvedByName: user.name, comment: approvalComment.trim() || undefined } : undefined }, user)) setError("Unable to start disposition.");
    else setError("");
  }
  function complete() {
    if (completionLock.current) return;
    setCompletionAttempted(true);
    const firstInvalid = Object.entries(completionErrors).find(([, message]) => Boolean(message));
    if (firstInvalid) {
      const [key] = firstInvalid;
      const target = completionTargets.current[key];
      target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
      if (key !== "evidence") window.setTimeout(() => target?.focus({ preventScroll: true }), 250);
      return;
    }
    if (incompleteLinkedAction) { setError(`Complete every linked Action before closing this disposition. Pending link: ${tag.actionId ?? "unavailable"}.`); return; }
    completionLock.current = true; setCompleting(true);
    if (!completeRedTagDisposition(tag.id, { evidence, completionNotes, responsibleConfirmed }, user)) setError("Unable to complete disposition.");
    else { setEvidence([]); setError(""); return; }
    completionLock.current = false; setCompleting(false);
  }
  function confirmKeep() {
    if (!keepJustification.trim()) { setError("Enter a justification to confirm Keep and close this Red Tag."); return; }
    if (!confirmRedTagKeep(tag.id, keepJustification, user)) setError("Unable to confirm this Keep decision.");
    else setError("");
  }
  function replaceDecision() {
    if (!replacement || !updateFurtherEvaluationDecision(tag.id, replacement, replacementComments, user)) setError("Select a final decision before continuing.");
    else setError("");
  }
  function goBackToHandlingChoice() {
    if (!clearRedTagHandlingMode(tag.id, user)) setError("Unable to change the handling method after disposition work has started.");
    else setError("");
  }

  if (!tag.decisionRecord) return null;
  if (decision === "further_evaluation") return <OpsDetailSection title="Further Evaluation" description="A final decision is required before disposition and closure.">{mayManage && tag.status === "Decision Made" ? <><Field label="Final Decision"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{RED_TAG_DECISIONS.filter((item) => item !== "further_evaluation").map((item) => <button type="button" key={item} onClick={() => setReplacement(item)} className={`rounded-lg border px-3 py-2 text-left text-sm font-medium ${replacement === item ? "border-red-500 bg-red-50 text-red-800 dark:bg-red-950/35 dark:text-red-200" : "bg-background"}`}>{RED_TAG_DECISION_LABELS[item]}</button>)}</div></Field><Field label="Evaluation Comments"><Textarea value={replacementComments} onChange={(event) => setReplacementComments(event.target.value)} /></Field><Button className="w-fit" disabled={!replacement} onClick={replaceDecision}>Update Decision</Button></> : <p className="text-sm text-muted-foreground">Waiting for an authorized user to update the decision.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</OpsDetailSection>;
  if (decision === "keep") return <OpsDetailSection title="Keep Confirmation" description="Confirm that the reviewed item should remain. This closes the Red Tag without disposition, After evidence, or an Action.">{tag.keepConfirmation ? <div className="grid gap-4 sm:grid-cols-2">{tag.keepConfirmation.justification && <Meta label="Confirmation Note" value={tag.keepConfirmation.justification} />}<Meta label="Confirmed By" value={`${tag.keepConfirmation.confirmedByName} · ${displayDate(tag.keepConfirmation.confirmedAt, true)}`} /><Meta label="Outcome" value="Kept · Closed" /></div> : mayManage && tag.status === "Decision Made" ? <><Field label="Keep Justification *"><Textarea value={keepJustification} onChange={(event) => setKeepJustification(event.target.value)} aria-label="Keep Justification" required aria-invalid={Boolean(error) && !keepJustification.trim()} placeholder="Explain why this item should be kept." /></Field><Button className="w-fit" onClick={confirmKeep}>Confirm Keep &amp; Close</Button></> : <p className="text-sm text-muted-foreground">Waiting for an authorized Keep confirmation.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</OpsDetailSection>;
  if (tag.status === "Decision Made" && (!tag.handlingMode || (tag.handlingMode === "linked_action" && !action))) return <OpsDetailSection title="Create Linked Action" description="Create a linked Action to track disposition work. Use Assign to me inside the Action form to handle it yourself.">{mayManage ? <Button className="min-h-12 w-full" onClick={onCreateAction}><Link2 className="size-4" />Create Linked Action</Button> : <p className="text-sm text-muted-foreground">An authorized reviewer must create the linked Action.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</OpsDetailSection>;
  if (tag.handlingMode === "linked_action" && (incompleteLinkedAction || !actions.length)) return null;

  return <OpsDetailSection title={tag.status === "Closed" ? "Disposition Outcome" : "Disposition"} description={tag.status === "Closed" ? "Completed disposition with the original and completion evidence." : `Execute the recorded ${RED_TAG_DECISION_LABELS[tag.decisionRecord.type]} decision.`}>{tag.status === "Decision Made" ? mayManage ? <><div className="grid gap-4 sm:grid-cols-2">{tag.handlingMode === "direct" ? <ReadOnly label="Responsible Person" value={responsible?.name ?? user.name} /> : <Field label="Responsible Person *" error={startAttempted ? startErrors.responsible : undefined} errorId="red-tag-start-responsible-error"><Select value={responsibleId} onValueChange={(value) => setResponsibleId(value ?? "")}><SelectTrigger ref={(node) => { startTargets.current.responsible = node; }} aria-invalid={startAttempted && Boolean(startErrors.responsible)}><SelectValue placeholder="Select responsible person" /></SelectTrigger><SelectContent>{eligibleUsers.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Field>}<Field label="Target Date *" error={startAttempted ? startErrors.targetDate : undefined} errorId="red-tag-start-target-error"><Input ref={(node) => { startTargets.current.targetDate = node; }} type="date" min={toLocalInputDate(new Date())} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} aria-invalid={startAttempted && Boolean(startErrors.targetDate)} /></Field></div><Field label="Execution Notes *" error={startAttempted ? startErrors.executionNotes : undefined} errorId="red-tag-start-notes-error"><Textarea ref={(node) => { startTargets.current.executionNotes = node; }} value={executionNotes} onChange={(event) => setExecutionNotes(event.target.value)} placeholder="Describe how this disposition will be executed." aria-invalid={startAttempted && Boolean(startErrors.executionNotes)} /></Field><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4" checked={approvalConfirmed} onChange={(event) => setApprovalConfirmed(event.target.checked)} /><span>Record approval for this disposition, if required.</span></label>{approvalConfirmed && <Field label="Approval Comment (optional)"><Input value={approvalComment} onChange={(event) => setApprovalComment(event.target.value)} /></Field>}<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={goBackToHandlingChoice}><ArrowLeft className="size-4" />Back</Button><Button onClick={start}>Start Disposition</Button></div></> : <p className="text-sm text-muted-foreground">An authorized user must start disposition.</p> : tag.dispositionDetails ? <>{tag.status === "Closed" && <div className="grid gap-4 sm:grid-cols-2"><DispositionEvidence title="Before" imageUrl={tag.imageUrl} empty="Before photo unavailable" /><DispositionEvidence title="After" imageUrl={tag.afterEvidence?.[0]?.url} storageKey={tag.afterEvidence?.[0]?.storageKey} empty="After photo unavailable" /></div>}<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Meta label="Decision" value={RED_TAG_DECISION_LABELS[tag.dispositionDetails.decision]} /><Meta label="Responsible" value={tag.dispositionDetails.responsiblePersonName} /><Meta label="Target Date" value={displayDate(tag.dispositionDetails.targetDate)} />{tag.dispositionDetails.executionNotes && <Meta label="Execution Notes" value={tag.dispositionDetails.executionNotes} />}{tag.dispositionDetails.approval?.approved && <Meta label="Approval" value={`${tag.dispositionDetails.approval.approvedByName} · ${displayDate(tag.dispositionDetails.approval.approvedAt, true)}`} />}{tag.dispositionDetails.completedAt && <Meta label="Completed" value={`${tag.dispositionDetails.completedByName ?? "—"} · ${displayDate(tag.dispositionDetails.completedAt, true)}`} />}{tag.dispositionDetails.completionNotes && <Meta label="Completion Notes" value={tag.dispositionDetails.completionNotes} />}</div>{tag.status === "Disposition In Progress" && mayManage && <div className="grid gap-4 border-t pt-5"><Field label="Completion Notes *" error={completionAttempted ? completionErrors.notes : undefined} errorId="red-tag-completion-notes-error"><Textarea ref={(node) => { completionTargets.current.notes = node; }} value={completionNotes} onChange={(event) => setCompletionNotes(event.target.value)} placeholder="Describe the completed physical work." aria-invalid={completionAttempted && Boolean(completionErrors.notes)} aria-describedby={completionAttempted && completionErrors.notes ? "red-tag-completion-notes-error" : undefined} /></Field><AfterEvidencePicker items={evidence} onChange={setEvidence} userName={user.name} error={completionAttempted ? completionErrors.evidence : undefined} targetRef={(node) => { completionTargets.current.evidence = node; }} /><div ref={(node) => { completionTargets.current.confirmation = node; }} className={`rounded-lg ${completionAttempted && completionErrors.confirmation ? "border border-destructive p-3 ring-2 ring-destructive/20" : ""}`}><label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 size-4" checked={responsibleConfirmed} onChange={(event) => setResponsibleConfirmed(event.target.checked)} aria-invalid={completionAttempted && Boolean(completionErrors.confirmation)} aria-describedby={completionAttempted && completionErrors.confirmation ? "red-tag-completion-confirmation-error" : undefined} /><span>The responsible person confirms the disposition work is complete.</span></label>{completionAttempted && completionErrors.confirmation && <p id="red-tag-completion-confirmation-error" role="alert" className="mt-2 text-xs font-medium text-destructive">{completionErrors.confirmation}</p>}</div><Button className="w-fit" disabled={completing} onClick={complete}>{completing ? "Completing…" : "Complete Disposition"}</Button>{incompleteLinkedAction && <p className="text-xs text-amber-700 dark:text-amber-400">Complete the linked Action {tag.actionId} before closing this disposition.</p>}</div>}</> : <p className="text-sm text-muted-foreground">Disposition details are unavailable.</p>}{error && <p role="alert" className="whitespace-pre-line text-sm text-destructive">{error}</p>}</OpsDetailSection>;
}

function LinkedActionSection({ tag, actions, mayCreate, user, onCreate }: { tag: RedTag; actions: ReturnType<typeof useActionStore>; mayCreate: boolean; user: ReturnType<typeof useCurrentUser>; onCreate: () => void }) {
  const missing = getRedTagActionIds(tag).filter(id => !actions.some(action => action.id === id));
  return <OpsDetailSection title="Action Plan" description="Each linked Action retains its own owner, due date, work and review history.">{mayCreate && actions.length > 0 && <Button className="w-fit justify-self-end" variant="outline" onClick={onCreate}><Link2 className="size-4" />Create Another Action</Button>}
    {!actions.length && <p className="text-sm text-muted-foreground">No Action is linked. Create one only when execution needs separate tracking.</p>}
    {missing.map(id => <p key={id} className="break-words text-sm">Linked Action <Link className="underline focus-visible:ring-2 focus-visible:ring-ring" href={`/actions/${encodeURIComponent(id)}`}>{id}</Link> is unavailable. Its historical link is retained.</p>)}
    {actions.map(action => <details key={action.id} className="group min-w-0 rounded-lg border [overflow-wrap:anywhere]" data-linked-action={action.id}>
      <summary className="cursor-pointer list-none rounded-lg p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><div className="flex min-w-0 flex-wrap items-start gap-2"><Link href={`/actions/${encodeURIComponent(action.id)}`} className="min-w-0 flex-1 break-words font-mono text-sm font-semibold underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">{action.id}</Link><Badge variant={ACTION_STATUS_CONFIG[action.status].variant}>{action.status}</Badge><ChevronDown aria-hidden="true" className="size-4 shrink-0 transition-transform group-open:rotate-180" /></div><p className="mt-2 break-words text-sm font-semibold">{action.title}</p><div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2"><span>Assignee: {action.responsiblePersonName ?? action.assignedTo}</span><span>Due: {getActionDueLabel(action)}</span></div></summary>
      <div className="grid min-w-0 gap-4 border-t p-4"><p className="whitespace-pre-wrap text-sm">{action.description}</p><div className="grid gap-3 sm:grid-cols-2"><Meta label="Priority" value={action.priority} /><Meta label="Location" value={`${action.plant} · ${action.area}`} /></div>
        {canEditActionContent(action, user) && <Link className="w-fit text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring" href={`/actions/${encodeURIComponent(action.id)}`}>Work on Action</Link>}
        {canReviewAction(action, user) && ["Pending Review", "Pending Auditor Review", "Awaiting Review"].includes(action.status) && <Link className="w-fit text-sm font-medium underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring" href={`/actions/${encodeURIComponent(action.id)}?mode=review`}>Review Action</Link>}
        <ActionSubmissionHistory action={action} beforeEvidence={resolveActionSourceBeforeEvidence(action, [tag])} />
      </div>
    </details>)}
  </OpsDetailSection>;
}

function DispositionEvidence({ title, imageUrl: directUrl, storageKey, empty }: { title: string; imageUrl?: string; storageKey?: string; empty: string }) {
  const imageUrl = useActionEvidenceUrl({ url: directUrl, storageKey });
  return <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>{imageUrl ? <Image unoptimized width={640} height={480} src={imageUrl} alt={`${title} evidence`} className="mt-2 aspect-[4/3] w-full rounded-lg border object-contain" /> : <div className="mt-2 grid aspect-[4/3] place-items-center rounded-lg border border-dashed text-sm text-muted-foreground">{empty}</div>}</div>;
}

 function AfterEvidencePicker({ items, onChange, userName, error, targetRef }: { items: RedTagEvidence[]; onChange: (items: RedTagEvidence[]) => void; userName: string; error?: string; targetRef?: (node: HTMLDivElement | null) => void }) {
  const uploadRef = useRef<HTMLInputElement>(null);
  async function addFiles(files: File[]) {
    const next: RedTagEvidence[] = [];
    for (const file of files) {
      const { dataUrl } = await optimizeEvidenceImage(file);
      next.push({ id: `RTE-${crypto.randomUUID()}`, name: file.name, url: dataUrl, mimeType: file.type, uploadedBy: userName, uploadedAt: new Date().toISOString() });
    }
    onChange([...items, ...next]);
  }
   return <div ref={targetRef} className={error ? "rounded-lg border border-destructive p-3 ring-2 ring-destructive/20" : undefined}><Field label="After Photo *" error={error} errorId="red-tag-after-photo-error"><div className="grid gap-3" aria-invalid={Boolean(error)} aria-describedby={error ? "red-tag-after-photo-error" : undefined}><div className="grid grid-cols-2 gap-2 sm:flex"><OpsCameraCapture fileNamePrefix="red-tag-after" onCapture={(file) => addFiles([file])} trigger={(openCamera) => <Button type="button" variant="outline" onClick={openCamera}><Camera className="size-4" />Take Photo</Button>} /><Button type="button" variant="outline" onClick={() => uploadRef.current?.click()}><Upload className="size-4" />Upload Photo</Button></div><input ref={uploadRef} hidden multiple type="file" accept="image/*" onChange={(event) => { void addFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }} />{items.length > 0 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{items.map((item) => <div key={item.id} className="overflow-hidden rounded-lg border"><AfterEvidenceImage evidence={item} /><div className="border-t"><button type="button" className="min-h-9 w-full text-xs font-medium text-destructive" onClick={() => onChange(items.filter((candidate) => candidate.id !== item.id))}>Remove</button></div></div>)}</div>}</div></Field></div>;
 }

function AfterEvidenceImage({ evidence }: { evidence: RedTagEvidence }) {
  const url = useActionEvidenceUrl(evidence);
  return url ? <Image unoptimized width={160} height={120} src={url} alt={evidence.name} className="aspect-[4/3] w-full object-cover" /> : <div className="grid aspect-[4/3] place-items-center text-xs text-muted-foreground">Loading evidence…</div>;
}

function Meta({ label, value, icon: Icon }: { label: string; value: string; icon?: typeof Flag }) { return <div className="min-w-0">{Icon && <Icon className="mb-2 size-4 text-red-600" />}<p className="break-words text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 break-words text-sm font-semibold [overflow-wrap:anywhere]">{value}</p></div>; }
function Missing({ onBack }: { onBack: () => void }) { return <PageContainer><div className="grid min-h-[50vh] place-items-center rounded-xl border border-dashed"><div className="text-center"><Flag className="mx-auto size-9 text-muted-foreground" /><h1 className="mt-3 font-semibold">Red Tag not found</h1><Button className="mt-4" variant="outline" onClick={onBack}>Back to Red Tags</Button></div></div></PageContainer>; }

export function RedTagPrintPage({ tagId }: { tagId: string }) {
  const router = useRouter(); const user = useCurrentUser(); const tag = useRedTags().find((item) => item.id === tagId);
  const qrTarget = useRedTagQrTarget(tagId);
  const { t } = useI18n();
  if (!tag) return <Missing onBack={() => router.push("/5s/red")} />;
  const tagIdToPrint = tag.id;
  async function print() {
    await document.fonts?.ready;
    const root = document.querySelector<HTMLElement>(".red-tag-print-surface");
    const images = root ? Array.from(root.querySelectorAll("img")) : [];
    await Promise.all(images.map(async (image) => { if (image.complete) return; try { await image.decode(); } catch { /* Print the tag even if optional evidence fails. */ } }));
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    markTagPrinted(tagIdToPrint, user);
    window.print();
  }
  return <PageContainer className="red-tag-print-page max-w-none"><style>{`@media print { @page { size: A4 portrait; margin: 10mm; } }`}</style><div className="print:hidden"><FiveSPageHeader eyebrow="Red Tags / Print Preview" title="Print Red Tag" description="Print this label and attach it to the tagged item."
    leading={<Button variant="ghost" size="icon-sm" aria-label="Back to previous page" onClick={() => router.back()}><ArrowLeft className="size-4" /></Button>}
    actions={<><Button variant="outline" onClick={() => router.push(getRedTagRecordPath(tag.id))}><Eye className="size-4" /> {t("common.view")}</Button><Button onClick={print}><Printer className="size-4" /> {t("redTag.print")}</Button></>} /></div>
    <div className="red-tag-print-surface motion-success-in grid place-items-center rounded-xl border bg-muted/25 p-4 sm:p-8"><RedTagLabel tag={tag} qrTarget={qrTarget} /></div>
  </PageContainer>;
}

function RedTagLabel({ tag, qrTarget }: { tag: RedTag; qrTarget: string }) {
  return <article className="red-tag-label w-full max-w-[430px] overflow-hidden border-[3px] border-red-700 bg-white text-black shadow-lg">
    <header className="border-b-[3px] border-red-700 px-6 py-4 text-center"><p className="text-sm font-bold uppercase tracking-[.22em] text-red-700">5S Workplace Control</p><h1 className="mt-1 text-4xl font-black tracking-[.08em] text-red-700">RED TAG</h1><p className="mt-2 font-mono text-2xl font-black">{tag.tagNumber}</p></header>
    <div className="grid gap-5 p-5"><div className="grid grid-cols-2 gap-x-5 gap-y-4"><LabelValue label="Item" value={tag.itemName} wide />{tag.quantity !== undefined && <LabelValue label="Quantity" value={String(tag.quantity)} />}<LabelValue label="Location" value={`${tag.zone} · ${tag.section}`} /><LabelValue label="Department" value={tag.department ?? "Not recorded"} />{tag.category && <LabelValue label="Category" value={tag.category} />}<LabelValue label="Reason" value={getRedTagReasonDisplay(tag.reason, tag.customReason)} wide />{tag.estimatedValue !== undefined && <LabelValue label="Estimated Value" value={new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(tag.estimatedValue)} />}<LabelValue label="Identified" value={displayDate(tag.createdAt)} /><LabelValue label="Identified By" value={tag.createdByName} wide /></div>
      <div className="grid justify-items-center border-t-2 border-red-200 pt-5"><QrCode value={qrTarget} size={188} /><p className="mt-3 text-base font-black tracking-wide text-red-700">SCAN TO VIEW RECORD</p></div>
    </div></article>;
}
function LabelValue({ label, value, wide }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? "col-span-2 min-w-0 [overflow-wrap:anywhere]" : "min-w-0 [overflow-wrap:anywhere]"}><p className="text-[11px] font-black uppercase tracking-widest text-red-700">{label}</p><p className="mt-1 text-sm font-bold leading-5">{value}</p></div>; }

function QrCode({ value, size }: { value: string; size: number }) {
  return <div className="grid justify-items-center gap-1"><QRCodeSVG value={value} size={size} level="M" marginSize={2} title={`Red Tag ${value}`} /><span className="sr-only">Open Red Tag at {value}</span></div>;
}
