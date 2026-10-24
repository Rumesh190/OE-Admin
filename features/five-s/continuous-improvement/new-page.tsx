"use client";

import { withBusinessRecordCreation } from "@/lib/records/module-records";
import { OpsPersonSelect } from "@/components/ops/ops-person-select";
import { getCurrentDemoUser } from "@/lib/current-user";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, FileEdit, Lightbulb, Save, Send, Sparkles, Target } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { linkTopicFollowUp } from "@/features/visual-management/visual-management-store";
import { useCurrentUser } from "@/lib/current-user";
import { useFiveSZoneConfiguration } from "@/lib/five-s/configuration";
import { cn } from "@/lib/utils";
import { canCreateImprovement } from "./access";
import { ImprovementEvidencePicker } from "./components";
import { IMPROVEMENT_BENEFIT_TYPES } from "./config";
import { selectableImprovementOwners } from "./owner";
import { createImprovement } from "./store";
import { RelatedOperationalRecords } from "./related-operational-records";
import { connectImprovementOperationalRecord } from "./relationships";
import type { ImprovementBenefitType, ImprovementEvidence, TimeUnit } from "./types";
import type { OpsRecordRef } from "@/lib/relationships/types";

export default function ContinuousImprovementNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useCurrentUser();
  const adminUsers = useAdminUsers();
  const zoneConfiguration = useFiveSZoneConfiguration();
  const adminUser = adminUsers.find((user) => user.id === currentUser.id);
  const currentPlant = adminUser?.plant ?? currentUser.plant;
  const hasBroadScope = canCreateImprovement(adminUser, currentUser);
  const availableZones = hasBroadScope ? zoneConfiguration : zoneConfiguration.filter((item) => adminUser?.zoneMemberships.some((membership) => membership.zone === item.name));
  const meetingReference = searchParams.get("meetingId");
  const requestedZone = searchParams.get("zone");
  const [zoneName, setZoneName] = useState(availableZones.find((item) => item.name === requestedZone)?.name ?? availableZones.find((item) => item.name === currentUser.primaryZone)?.name ?? availableZones[0]?.name ?? currentUser.primaryZone);
  const zone = zoneConfiguration.find((item) => item.name === zoneName);
  const ownerOptions = selectableImprovementOwners(adminUsers, currentPlant, zoneName);
  const allowed = canCreateImprovement(adminUser, currentUser) && Boolean(zone);
  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [problem, setProblem] = useState(() => { const value = searchParams.get("description") ?? ""; return meetingReference ? `${value}\n\nIdentified during Visual Management meeting ${meetingReference}.` : value; });
  const [proposal, setProposal] = useState(meetingReference ? "Investigate the meeting topic, confirm root cause, and implement a sustainable countermeasure." : "");
  const [expectedBenefit, setExpectedBenefit] = useState(meetingReference ? "Resolve the recurring KPI exception and prevent repeat discussion in the daily tier meeting." : "");
  const [benefitType, setBenefitType] = useState<ImprovementBenefitType>("Cost Saving");
  const [proposedSaving, setProposedSaving] = useState("");
  const [estimatedTime, setEstimatedTime] = useState(meetingReference ? "5" : "");
  const [estimatedTimeUnit, setEstimatedTimeUnit] = useState<TimeUnit>("Days");
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [ownerId, setOwnerId] = useState(ownerOptions.some((owner) => owner.id === currentUser.id) ? currentUser.id : ownerOptions[0]?.id ?? "");
  const [beforeEvidence, setBeforeEvidence] = useState<ImprovementEvidence[]>([]);
  const [relatedRecords, setRelatedRecords] = useState<OpsRecordRef[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!allowed || !zone) return <PageContainer><FiveSPageHeader eyebrow="Continual Improvement" title="New Improvement" description="Your current role cannot create an improvement proposal." leading={<Button variant="ghost" size="icon" nativeButton={false} render={<Link href="/continuous-improvement" />}><ArrowLeft className="size-4" /></Button>} /><Card><CardContent className="grid min-h-52 place-items-center p-6 text-center"><div><p className="text-sm font-medium">Creation is not available for your current role or zone.</p><Button className="mt-4" variant="outline" nativeButton={false} render={<Link href="/continuous-improvement" />}>Back to Improvements</Button></div></CardContent></Card></PageContainer>;

  async function submit(saveAsDraft: boolean) {
    setError("");
    if (!title.trim() || !problem.trim() || !proposal.trim() || !expectedBenefit.trim() || !estimatedTime || Number(estimatedTime) <= 0 || !ownerOptions.some((owner) => owner.id === ownerId)) {
      setError("Complete the title, owner, current state, proposed improvement, expected benefit, and estimated completion time.");
      return;
    }
    setBusy(true);
    try {
      const item = await withBusinessRecordCreation(() => createImprovement({ title, plant: searchParams.get("plant") ?? currentPlant, zone: zoneName, issueDescription: problem, proposedImprovement: proposal, expectedBenefit, benefitType, proposedSaving: proposedSaving === "" ? undefined : Number(proposedSaving), estimatedTime: Number(estimatedTime), estimatedTimeUnit, ownerId, memberIds, beforeEvidence }, currentUser, saveAsDraft));
      if (item) {
        for (const record of relatedRecords) {
          try { connectImprovementOperationalRecord(item.id, record); }
          catch (relationshipError) { console.error("Improvement saved, but an optional operational connection failed:", relationshipError); }
        }
        const sourceTopicId = searchParams.get("topicId");
        if (meetingReference && sourceTopicId) linkTopicFollowUp(sourceTopicId, "Continuous Improvement", item.id, getCurrentDemoUser());
        router.push(`/continuous-improvement/${encodeURIComponent(item.id)}`);
      }
      else setBusy(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this proposal.");
      setBusy(false);
    }
  }

  function toggleMember(id: string) { setMemberIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]); }

  return <PageContainer className="pb-24 sm:pb-8">
    <FiveSPageHeader eyebrow={meetingReference ? `Visual Management / ${meetingReference}` : "Continual Improvement"} title="New Improvement" description={meetingReference ? "Meeting context has been carried into the Continual Improvement workflow." : "Turn a workplace opportunity into a focused, measurable proposal."} leading={<Button variant="ghost" size="icon" nativeButton={false} render={<Link href={meetingReference ? `/visual-management/meetings/${meetingReference}` : "/continuous-improvement"} />} aria-label="Back"><ArrowLeft className="size-4" /></Button>} />
    <div className="rounded-xl border border-primary/15 bg-primary/[0.045] px-4 py-3"><p className="flex items-center gap-2 text-sm font-medium"><Lightbulb className="size-4 text-primary" />Keep the proposal focused on the opportunity, the change, and the expected benefit.</p></div>
    {error && <div role="alert" className="rounded-lg border border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive">{error}</div>}
    <Card className="gap-0"><CardHeader className="border-b pb-4"><SectionHeading icon={FileEdit} eyebrow="Current State" title="What is happening today?" /></CardHeader><CardContent className="grid gap-5 p-4 sm:p-5"><Field label="Title *"><Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Example: Reduce material movement in packing area" /></Field><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Field label="Plant *"><Select searchLabel={"Plant"} value={currentPlant}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value={currentPlant}>{currentPlant}</SelectItem></SelectContent></Select></Field><Field label="Zone *"><OpsPersonSelect label="Zone" clearable={false} entityLabel="Zone" entityPlural="Zones" showEligibleCount={false} people={availableZones.map(item => ({ id: item.name, name: item.name }))} value={zoneName} onValueChange={nextZone => { const nextOwners = selectableImprovementOwners(adminUsers, currentPlant, nextZone); setZoneName(nextZone); setMemberIds([]); setOwnerId(nextOwners.some(owner => owner.id === currentUser.id) ? currentUser.id : nextOwners[0]?.id ?? ""); }} /></Field><Field label="Proposed By"><Input value={currentUser.name} disabled /></Field><Field label="Owner *"><OpsPersonSelect label="Owner" clearable={false} people={ownerOptions.map(owner => ({ ...owner, description: owner.zoneMemberships.find(membership => membership.zone === zoneName)?.responsibility ?? "Admin" }))} value={ownerId} onValueChange={setOwnerId} /></Field></div><Field label="Problem / Opportunity *"><Textarea value={problem} onChange={(event) => setProblem(event.target.value)} rows={5} maxLength={1200} placeholder="Describe the current method, waste, delay, or opportunity without framing it as an incident." /></Field><div><Label className="mb-2 block">Current-state Evidence</Label><ImprovementEvidencePicker items={beforeEvidence} onChange={setBeforeEvidence} uploadedBy={currentUser.name} label="Upload evidence" /></div></CardContent></Card>
    <Card className="gap-0"><CardHeader className="border-b pb-4"><SectionHeading icon={Sparkles} eyebrow="Proposed Improvement" title="What should change?" /></CardHeader><CardContent className="grid gap-5 p-4 sm:p-5"><Field label="Proposed Improvement *"><Textarea value={proposal} onChange={(event) => setProposal(event.target.value)} rows={5} maxLength={1400} placeholder="Explain the proposed change and how it will work." /></Field><Field label="Participants"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{zone.members.map((member) => <button key={member.id} type="button" onClick={() => toggleMember(member.id)} className={cn("flex min-h-11 items-center gap-3 rounded-lg border px-3 text-left text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", memberIds.includes(member.id) ? "border-primary/35 bg-primary/[0.06]" : "hover:bg-muted/30")}><span className={cn("grid size-5 shrink-0 place-items-center rounded border", memberIds.includes(member.id) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{memberIds.includes(member.id) && <Check className="size-3.5" />}</span><span><span className="block font-medium">{member.name}</span><span className="text-[11px] text-muted-foreground">{member.role}</span></span></button>)}</div><p className="text-xs text-muted-foreground">Select only the zone members who will participate in implementation.</p></Field></CardContent></Card>
    <Card className="gap-0"><CardHeader className="border-b pb-4"><SectionHeading icon={Target} eyebrow="Expected Benefit" title="What improvement is expected?" /></CardHeader><CardContent className="grid gap-5 p-4 sm:p-5"><Field label="Expected Benefit Description *"><Textarea value={expectedBenefit} onChange={(event) => setExpectedBenefit(event.target.value)} rows={4} maxLength={900} placeholder="Describe the expected measurable or observable outcome." /></Field><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Field label="Benefit Type"><Select searchLabel={"Benefit Type"} value={benefitType} onValueChange={(value) => setBenefitType((value ?? "Other") as ImprovementBenefitType)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{IMPROVEMENT_BENEFIT_TYPES.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field><Field label="Proposed Cost Saving (INR)"><Input type="number" min="0" value={proposedSaving} onChange={(event) => setProposedSaving(event.target.value)} placeholder="Optional" /></Field><Field label="Estimated Completion Time *"><Input type="number" min="1" value={estimatedTime} onChange={(event) => setEstimatedTime(event.target.value)} placeholder="Example: 2" /></Field><Field label="Time Unit"><Select searchLabel={"Time Unit"} value={estimatedTimeUnit} onValueChange={(value) => setEstimatedTimeUnit((value ?? "Days") as TimeUnit)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{(["Hours", "Days", "Weeks"] as TimeUnit[]).map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field></div></CardContent></Card>
    <RelatedOperationalRecords pendingRecords={relatedRecords} onPendingRecordsChange={setRelatedRecords} editable />
    <div className="hidden justify-end gap-2 sm:flex"><Button variant="outline" disabled={busy} onClick={() => submit(true)}><Save className="size-4" />Save Draft</Button><Button disabled={busy} onClick={() => submit(false)}><Send className="size-4" />Submit for Review</Button></div>
    <div className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-2 gap-2 border-t bg-background/95 p-3 backdrop-blur sm:hidden"><Button variant="outline" className="min-h-11" disabled={busy} onClick={() => submit(true)}><Save className="size-4" />Save Draft</Button><Button className="min-h-11" disabled={busy} onClick={() => submit(false)}><Send className="size-4" />Submit</Button></div>
  </PageContainer>;
}

function SectionHeading({ icon: Icon, eyebrow, title }: { icon: typeof FileEdit; eyebrow: string; title: string }) { return <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/[0.08] text-primary"><Icon className="size-4" /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p><CardTitle className="mt-1 text-base">{title}</CardTitle></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="grid min-w-0 gap-2 text-sm font-medium">{label}{children}</label>; }
