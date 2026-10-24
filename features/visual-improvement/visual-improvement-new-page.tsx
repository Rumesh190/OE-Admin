"use client";

import { withBusinessRecordCreation } from "@/lib/records/module-records";
import { OpsPersonSelect } from "@/components/ops/ops-person-select";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Camera, Check, Link2, Save, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CreateLinkedActionDialog, type LinkedActionContext } from "@/features/actions/create-linked-action-dialog";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useFiveSZoneConfiguration } from "@/lib/five-s/configuration";
import { useOrganizationConfiguration } from "@/lib/organization-store";
import { useCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";
import { canCreateVisualImprovement, canCreateVisualImprovementAction } from "./visual-improvement-access";
import { VISUAL_IMPROVEMENT_CATEGORIES } from "./visual-improvement-config";
import { VisualEvidencePicker } from "./visual-improvement-components";
import { createVisualImprovement, linkVisualImprovementAction } from "./visual-improvement-store";
import type { VisualImprovement, VisualImprovementCategory, VisualImprovementEvidence, VisualImprovementPerson } from "./types";

export default function VisualImprovementNewPage() {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const zoneConfiguration = useFiveSZoneConfiguration();
  const organization = useOrganizationConfiguration();
  const mayUseAnyZone = canCreateVisualImprovement(adminUser, currentUser);
  const availableZones = mayUseAnyZone ? zoneConfiguration : zoneConfiguration.filter((item) => adminUser?.zoneMemberships.some((membership) => membership.zone === item.name));
  const defaultZone = availableZones.some((item) => item.name === currentUser.primaryZone) ? currentUser.primaryZone : availableZones[0]?.name ?? zoneConfiguration[0]?.name ?? "";
  const [title, setTitle] = useState("");
  const [plant, setPlant] = useState(currentUser.plant === "All organizations" ? organization.plants[0]?.name ?? "" : adminUser?.plant ?? currentUser.plant);
  const [zone, setZone] = useState(defaultZone);
  const people = useMemo(() => peopleForZone(zone, zoneConfiguration), [zone, zoneConfiguration]);
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState<VisualImprovementCategory | "">("");
  const [ownerId, setOwnerId] = useState<string>(currentUser.id);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [beforeDescription, setBeforeDescription] = useState("");
  const [beforeEvidence, setBeforeEvidence] = useState<VisualImprovementEvidence[]>([]);
  const [expectedBenefit, setExpectedBenefit] = useState("");
  const [proposedCostSaving, setProposedCostSaving] = useState("");
  const [estimatedCompletionDate, setEstimatedCompletionDate] = useState("");
  const [createActionWanted, setCreateActionWanted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<VisualImprovement | null>(null);
  const [actionOpen, setActionOpen] = useState(false);
  const mayCreate = canCreateVisualImprovement(adminUser, currentUser);
  const mayCreateAction = canCreateVisualImprovementAction(adminUser, currentUser);
  const owner = people.find((person) => person.id === ownerId) ?? people[0];
  const participants = people.filter((person) => participantIds.includes(person.id) && person.id !== owner?.id);

  const actionContext: LinkedActionContext | null = created ? {
    source: "Visual Improvement", sourceModule: "visualImprovement", sourceId: created.id, sourceObservation: created.beforeDescription,
    title: created.title, description: created.expectedBenefit || created.beforeDescription, plant: created.plant, zone: created.zone, location: created.location,
    evidence: created.beforeEvidence.map((item) => ({ id: item.id, name: item.name, type: "image", mimeType: item.mimeType, uploadedAt: item.uploadedAt, uploadedBy: item.uploadedBy, url: item.url, evidenceType: "finding" })),
  } : null;

  function changeZone(value: string) {
    setZone(value);
    const nextPeople = peopleForZone(value, zoneConfiguration);
    setOwnerId(nextPeople.some((person) => person.id === currentUser.id) ? currentUser.id : nextPeople[0]?.id ?? "");
    setParticipantIds([]);
  }

  async function submit(saveAsDraft: boolean) {
    if (!mayCreate || busy) return;
    if (!title.trim()) { setError("Enter an improvement title."); return; }
    if (!location.trim()) { setError("Enter the area or location."); return; }
    if (!category) { setError("Select an improvement category."); return; }
    if (!owner) { setError("Select an owner."); return; }
    if (!beforeDescription.trim()) { setError("Describe the before state and opportunity."); return; }
    if (!beforeEvidence.length) { setError("Before evidence is required for every Visual Improvement."); return; }
    if (!expectedBenefit.trim()) { setError("Describe the expected benefit."); return; }
    if (proposedCostSaving && (!Number.isFinite(Number(proposedCostSaving)) || Number(proposedCostSaving) < 0)) { setError("Estimated cost saving must be zero or more."); return; }
    setBusy(true); setError("");
    try {
      const item = await withBusinessRecordCreation(() => createVisualImprovement({ title, plant, zone, location, category, owner, participants, beforeDescription, beforeEvidence, expectedBenefit, proposedCostSaving: proposedCostSaving ? Number(proposedCostSaving) : undefined, estimatedCompletionDate: estimatedCompletionDate || undefined }, currentUser, saveAsDraft));
      if (!item) { setError("The improvement could not be saved. Check browser storage and try again."); return; }
      if (createActionWanted && mayCreateAction) { setCreated(item); setActionOpen(true); return; }
      router.push(`/visual-improvement/${encodeURIComponent(item.id)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create this improvement.");
    } finally {
      setBusy(false);
    }
  }

  if (!mayCreate) return <PageContainer><FiveSPageHeader eyebrow="OPS Workspace" title="Add Visual Improvement" description="Capture a visible workplace improvement." /><Card><CardContent className="grid min-h-48 place-items-center p-6 text-center"><div><Sparkles className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 text-sm font-semibold">You do not have permission to create Visual Improvements.</p><Button className="mt-4" variant="outline" nativeButton={false} render={<Link href="/visual-improvement" />}>Back to Visual Improvement</Button></div></CardContent></Card></PageContainer>;

  return <PageContainer className="max-w-5xl pb-24 sm:pb-8">
    <FiveSPageHeader eyebrow="OPS Workspace / Visual Improvement" title="Add Visual Improvement" description="Start with clear before evidence, then assign ownership for the transformation." leading={<Button size="icon-sm" variant="ghost" nativeButton={false} render={<Link href="/visual-improvement" />} aria-label="Back to Visual Improvement"><ArrowLeft className="size-4" /></Button>} />

    <Card className="gap-0 overflow-hidden"><CardHeader className="border-b pb-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary"><Camera className="size-4" /></span><div><CardTitle className="text-base">Before state</CardTitle><p className="mt-1 text-xs text-muted-foreground">Capture what exists today and the opportunity you can see.</p></div></div></CardHeader><CardContent className="grid gap-5 p-4 sm:p-5"><Field label="Title *"><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Improve tool storage layout" maxLength={120} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Plant *"><OpsPersonSelect label="Plant" clearable={false} entityLabel="Plant" entityPlural="Plants" people={organization.plants.filter(item => item.status === "Active").map(item => ({ id: item.name, name: item.name }))} value={plant} onValueChange={setPlant} /></Field><Field label="Zone *"><OpsPersonSelect label="Zone" clearable={false} entityLabel="Zone" entityPlural="Zones" people={availableZones.map(item => ({ id: item.name, name: item.name }))} value={zone} onValueChange={changeZone} /></Field><Field label="Area / Location *"><Input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Line, station, rack, aisle, or room" /></Field><Field label="Category *"><Select searchLabel={"Category"} value={category} onValueChange={(value) => setCategory((value ?? "") as VisualImprovementCategory | "")}><SelectTrigger className="w-full"><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent>{VISUAL_IMPROVEMENT_CATEGORIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Field></div><Field label="Before Description *"><Textarea value={beforeDescription} onChange={(event) => setBeforeDescription(event.target.value)} placeholder="What is visible today? Describe the opportunity without framing it as an audit finding." rows={4} /></Field><div><Label className="mb-2 block">Before Evidence *</Label><VisualEvidencePicker items={beforeEvidence} onChange={setBeforeEvidence} uploadedBy={currentUser.name} label="Upload photos" required /></div></CardContent></Card>

    <Card className="gap-0 overflow-hidden"><CardHeader className="border-b pb-4"><CardTitle className="text-base">Ownership and expected benefit</CardTitle><p className="text-xs text-muted-foreground">Keep the team focused and the intended outcome easy to understand.</p></CardHeader><CardContent className="grid gap-5 p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Owner *"><OpsPersonSelect label="Improvement Owner" clearable={false} people={people} value={owner?.id ?? ""} onValueChange={value => { setOwnerId(value); setParticipantIds(current => current.filter(id => id !== value)); }} /></Field><Field label="Estimated Completion Date"><Input type="date" value={estimatedCompletionDate} onChange={(event) => setEstimatedCompletionDate(event.target.value)} /></Field></div><div><Label className="mb-2 block">Participants</Label><div className="flex flex-wrap gap-2">{people.filter((person) => person.id !== owner?.id).map((person) => { const selected = participantIds.includes(person.id); return <button type="button" key={person.id} onClick={() => setParticipantIds((current) => selected ? current.filter((id) => id !== person.id) : [...current, person.id])} className={cn("inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", selected ? "border-primary/30 bg-primary/[0.06] text-primary" : "bg-background hover:bg-muted/40")}><span className={cn("grid size-4 place-items-center rounded border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input")}>{selected && <Check className="size-3" />}</span>{person.name}</button>; })}</div></div><Field label="Expected Benefit *"><Textarea value={expectedBenefit} onChange={(event) => setExpectedBenefit(event.target.value)} placeholder="What will become easier, safer, faster, cleaner, or more reliable?" rows={3} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Estimated Cost Saving (INR / year)"><Input type="number" min="0" value={proposedCostSaving} onChange={(event) => setProposedCostSaving(event.target.value)} placeholder="Optional" /></Field></div></CardContent></Card>

    {mayCreateAction && <button type="button" onClick={() => setCreateActionWanted((value) => !value)} className={cn("flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring", createActionWanted && "border-primary/30 bg-primary/[0.035]")}><span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded border text-xs", createActionWanted ? "border-primary bg-primary text-primary-foreground" : "border-input")}>{createActionWanted ? <Check className="size-3.5" /> : null}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2 text-sm font-semibold">Create a linked Action <Badge variant="secondary">Optional</Badge></span><span className="mt-1 block text-xs leading-5 text-muted-foreground">Before evidence and improvement context will be carried into the shared Action Center. Ownership details are selected after saving.</span></span><Link2 className="size-4 shrink-0 text-muted-foreground" /></button>}
    {error && <p role="alert" className="rounded-lg border border-destructive/25 bg-destructive/[0.06] px-3 py-2 text-sm text-destructive">{error}</p>}
    <div className="hidden justify-end gap-2 sm:flex"><Button variant="outline" onClick={() => submit(true)} disabled={busy}><Save className="size-4" />Save Draft</Button><Button onClick={() => submit(false)} disabled={busy}><Sparkles className="size-4" />{busy ? "Creating..." : "Create Improvement"}</Button></div>
    <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-2 gap-2 border-t bg-background/95 p-3 backdrop-blur sm:hidden"><Button variant="outline" className="h-11" onClick={() => submit(true)} disabled={busy}>Save Draft</Button><Button className="h-11" onClick={() => submit(false)} disabled={busy}>Create Improvement</Button></div>

    <CreateLinkedActionDialog key={created?.id ?? "new-visual-action"} open={actionOpen} onOpenChange={(open) => { setActionOpen(open); if (!open && created) router.push(`/visual-improvement/${encodeURIComponent(created.id)}`); }} context={actionContext} onCreated={(action) => { if (!created) return; linkVisualImprovementAction(created.id, action.id, currentUser); router.push(`/visual-improvement/${encodeURIComponent(created.id)}`); }} />
  </PageContainer>;
}

function peopleForZone(zoneName: string, zones: ReturnType<typeof useFiveSZoneConfiguration>): VisualImprovementPerson[] {
  const zone = zones.find((item) => item.name === zoneName);
  if (!zone) return [];
  return [{ id: zone.leaderId, name: zone.leader }, ...zone.members.map((member) => ({ id: member.id, name: member.name }))];
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid min-w-0 gap-1.5 text-sm font-medium">{label}{children}</label>; }
