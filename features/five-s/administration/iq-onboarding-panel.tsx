"use client";
import { getFinalDemoManifest } from "@/lib/demo/final-demo";
import { getIQAuditActivationReadiness } from "./iq-audit-readiness";
import { useState, type ReactNode } from "react";
import { useAccessContext } from "./access-v4-context";
import { useAccessV3State } from "./access-v3-state";
import { useAccessV4State } from "./access-v4-state";
import { IQ_PLAN, getIQOnboardingReadiness, captureOnboardingExpectation, type OnboardingExpectation, type IQOnboardingReadiness } from "./iq-onboarding";
import { createIQStagedClient, createIQFactory, attachIQLakshman, appointIQFactoryAdministrator, createIQZone } from "./iq-onboarding-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
type Operation = "client" | "factory" | "attach" | "factoryAdmin" | "zone";
function Field({ label, children }: { label: string; children: ReactNode }) { return <label className="grid gap-1.5 text-sm font-medium">{label}{children}</label>; }
export function IQOnboardingPanel() {
  const { context, ready } = useAccessContext(); useAccessV3State(); useAccessV4State();
  const [opened, setOpened] = useState<{ operation: Operation; expected: OnboardingExpectation; zoneName?: string; selectionId: string; clientId?: string; factoryId?: string }>();
  const [error, setError] = useState("");
  let readiness: IQOnboardingReadiness | null = null; let readError = "";
  if (ready && context) { try { readiness = getIQOnboardingReadiness(); } catch (e) { readError = e instanceof Error ? e.message : "Onboarding configuration cannot be read safely."; } }
  if (ready && getFinalDemoManifest()) return null;
  if (!readiness && !readError) return null;
  function open(operation: Operation, zoneName?: string) {
    try { const expected = captureOnboardingExpectation(); setOpened({ operation, zoneName, expected, selectionId: expected.selectionId, clientId: readiness?.client?.id, factoryId: readiness?.factory?.id }); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Select a valid context."); }
  }
  let auditReadiness: ReturnType<typeof getIQAuditActivationReadiness> = null;
  if (readiness) { try { auditReadiness = getIQAuditActivationReadiness(); } catch (e) { readError = e instanceof Error ? e.message : "Audit activation readiness cannot be read safely. Activation remains blocked."; } }
  const platform = context?.kind === "platform";
  const clientAdmin = context?.kind === "client" && context.personId === readiness?.administrator?.id;
  const factoryAdmin = context?.kind === "factory" && context.plantId === readiness?.factory?.id;
  return <section id="iq-onboarding" aria-label="IQ staged onboarding" className="grid min-w-0 gap-4 border-t pt-5">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">{readiness?.demo ? "IQ demo configuration" : "IQ staged onboarding"}</h2><Badge variant="outline">{readiness?.demo ? "Disposable demo · " : ""}{readiness?.operationalState ?? "Review required"}</Badge></div>
    <p className="text-sm text-muted-foreground">IQ → IQ Factory 1 · IQF · Chennai. Steps reflect canonical records. No operational module is activated by setup.</p>
    {(error || readError) && <p role="alert" className="text-sm text-destructive">{error || readError}</p>}
    {readiness && <><ol className="divide-y">{readiness.steps.map(step => <li key={step.id} className="flex flex-wrap items-start justify-between gap-2 py-3"><div className="min-w-0"><p className="font-medium">{step.label}</p><p className="break-words text-sm text-muted-foreground">{step.detail}</p></div><Badge variant={step.status === "complete" ? "outline" : "muted"}>{step.status === "complete" ? "Recorded" : "Pending"}</Badge></li>)}</ol>
      <div className="flex flex-wrap gap-2">
        {platform && !readiness.client && <Button onClick={() => open("client")}>Create staged IQ client</Button>}
        {clientAdmin && !readiness.factory && <Button onClick={() => open("factory")}>Create IQ Factory 1</Button>}
        {platform && readiness.client && readiness.administrator && readiness.factory && !readiness.attached && <Button variant="outline" disabled={!readiness.lakshman} onClick={() => open("attach")}>Review and attach existing Lakshman</Button>}
        {clientAdmin && readiness.factory && readiness.attached && !readiness.factoryAdmin && <Button onClick={() => open("factoryAdmin")}>Appoint Lakshman as Factory Admin</Button>}
      </div>
      {platform && readiness.administrator && <p className="text-sm text-muted-foreground">Next actor: use the existing demo identity switcher for the recorded IQ Client Admin, then select IQ Client administration. No temporary Factory Admin promotion is needed.</p>}
      {clientAdmin && readiness.factoryAdmin && <p className="text-sm text-muted-foreground">Next actor: switch to canonical Lakshman and select the IQ factory context to configure approved Zones.</p>}
      {factoryAdmin && readiness.factoryAdmin && <div className="grid gap-3 sm:grid-cols-2">{IQ_PLAN.zones.map(zone => {
        const actual = readiness.zones.find(z => z.name === zone.name);
        return <div key={zone.name} className="flex flex-wrap items-center justify-between gap-3 border-b py-3"><div><p className="font-medium">{zone.name}</p><p className="text-sm text-muted-foreground">{actual ? `${actual.id} · ${actual.code}${actual.approved ? " · Confirmed" : " · Code approval required"}` : `Proposed code ${zone.proposedCode} · Confirmation required`}</p></div>{!actual && <Button variant="outline" size="sm" onClick={() => open("zone", zone.name)}>Configure Zone</Button>}</div>;
      })}</div>}
      <p className="text-sm text-muted-foreground">Departments and operational personnel remain configuration required. No Department names, codes, leaders or members have been approved or generated.</p>
      {auditReadiness && <details><summary className="cursor-pointer text-sm font-medium">Audit activation prerequisites</summary>{auditReadiness.checks.map(check => <p key={check.id} className="py-1 text-sm">{check.met ? "Recorded / implemented" : "Required"} · {check.detail}</p>)}</details>}
      <div><Button disabled variant="outline" aria-describedby="iq-activation-gate">Audit activation unavailable</Button><p id="iq-activation-gate" className="mt-2 text-sm text-muted-foreground">Requires approved configuration, explicit scoped Audit authorization, D10, consolidated regression/security acceptance and business activation approval. Audit, general Actions and all other operational modules remain disabled.</p></div>
    </>}
    {opened && readiness && opened.selectionId === context?.selectionId && <IQStepDialog {...opened} readiness={readiness} onClose={() => setOpened(undefined)}/>}
  </section>;
}
function IQStepDialog({ operation, expected, zoneName, clientId, factoryId, readiness, onClose }: { operation: Operation; expected: OnboardingExpectation; zoneName?: string; clientId?: string; factoryId?: string; readiness: IQOnboardingReadiness; onClose: () => void }) {
  const [personId, setPersonId] = useState(""); const [email, setEmail] = useState(""); const [employeeId, setEmployeeId] = useState(""); const [reason, setReason] = useState(""); const [code, setCode] = useState(""); const [confirmed, setConfirmed] = useState(false); const [pending, setPending] = useState(false); const [error, setError] = useState("");
  const titles: Record<Operation, string> = { client: "Create staged IQ client", factory: "Create IQ Factory 1", attach: "Review existing Lakshman identity", factoryAdmin: "Appoint IQ Factory Admin", zone: `Configure ${zoneName ?? "Zone"}` };
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{titles[operation]}</DialogTitle><DialogDescription>Only the current authorized actor can complete this step. Existing ABC records and memberships remain unchanged; IQ stays staged.</DialogDescription></DialogHeader>
    <form className="grid gap-4" onSubmit={async e => { e.preventDefault(); setError(""); setPending(true); try {
      if (operation === "client") await createIQStagedClient(expected);
      else if (operation === "factory" && clientId) await createIQFactory(clientId, expected);
      else if (operation === "attach" && clientId) await attachIQLakshman(clientId, { personId, email, employeeId, reason }, expected);
      else if (operation === "factoryAdmin" && clientId && factoryId) await appointIQFactoryAdministrator(clientId, factoryId, personId, expected);
      else if (operation === "zone" && clientId && factoryId && zoneName) await createIQZone(clientId, factoryId, zoneName, code, confirmed, expected);
      else throw new Error("Canonical prerequisites changed. Reopen this step.");
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to complete onboarding step."); } finally { setPending(false); } }}>
      {operation === "client" && <p className="text-sm">IQ · Manufacturing · Staged. IQ Manoj is provisioned atomically as its default Client Administrator. No factory, person or entitlement is copied from ABC.</p>}
      {operation === "factory" && <p className="text-sm">IQ Factory 1 · IQF · Chennai. Parent client: {clientId}. Factory Admin is assigned in a separate step.</p>}
      {operation === "attach" && <><p className="break-words text-sm">Canonical candidate: {readiness.lakshman?.id} · {readiness.lakshman?.email} · {readiness.lakshman?.employeeId}. Verify these attributes before confirming; display name alone is insufficient.</p><Field label="Confirm canonical person ID"><Input required value={personId} onChange={e => setPersonId(e.target.value)}/></Field><Field label="Confirm existing email"><Input required type="email" value={email} onChange={e => setEmail(e.target.value)}/></Field><Field label="Confirm existing Employee ID"><Input required value={employeeId} onChange={e => setEmployeeId(e.target.value)}/></Field><Field label="Identity review reason"><Input required value={reason} onChange={e => setReason(e.target.value)}/></Field></>}
      {operation === "factoryAdmin" && <><p className="text-sm">Appoint the platform-reviewed existing person {IQ_PLAN.lakshmanPersonId} to factory {factoryId}. This preserves ABC assignments and does not grant a Zone role or Auditor authorization.</p><Field label="Confirm Lakshman's canonical person ID"><Input required value={personId} onChange={e => setPersonId(e.target.value)}/></Field></>}
      {operation === "zone" && <><p className="text-sm">{zoneName} under {factoryId}. Proposed code: {IQ_PLAN.zones.find(z => z.name === zoneName)?.proposedCode}. Enter and explicitly confirm the approved code. This creates no Department or leader.</p><Field label="Approved Zone code"><Input required placeholder="Enter confirmed code" value={code} onChange={e => { setCode(e.target.value); setConfirmed(false); }}/></Field><label className="flex items-start gap-2 text-sm"><Checkbox checked={confirmed} onCheckedChange={checked => setConfirmed(checked === true)}/>I explicitly confirm this Zone code for creation.</label></>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || (operation === "zone" && !confirmed)}>{pending ? "Saving…" : "Confirm step"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
