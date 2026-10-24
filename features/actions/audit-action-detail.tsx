"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/current-user";
import { useAccessContext, getActiveAccessContext } from "@/features/five-s/administration/access-v4-context";
import { useAccessV3State } from "@/features/five-s/administration/access-v3-state";
import { useAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { readAdministrationPayload } from "@/lib/administration-storage";
import { ACTIONS_KEY, readCanonicalActions, canReadV4Action, canWorkV4Action, canVerifyV4Action, eligibleV4Coordinator, v4VerifierCandidates, requireV4ActionBase, validV4Selection, pendingV4Recovery } from "@/lib/actions/action-v4-policy";
import { executeV4ActionTransition, canUndoActionStart } from "@/lib/actions/action-store";
import { selectAuditActionVerifier, uploadAuditActionEvidence } from "@/lib/actions/audit-corrective-actions";
import { assertV4EvidenceReferences } from "@/lib/actions/action-v4-assets";
import { getGembaPhoto } from "@/lib/gemba/gemba-photo-storage";
import { getActionSourceHref } from "@/lib/actions/action-config";
import { canReadScopedAudit } from "@/lib/five-s/audit-authorization";
import type { MyAction, MyActionEvidence, MyActionType } from "@/features/five-s/types/my-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { OpsPersonSelect } from "@/components/ops/ops-person-select";
function subscribe(l: () => void) { window.addEventListener("storage", l); window.addEventListener("ops-action-v4-changed", l); return () => { window.removeEventListener("storage", l); window.removeEventListener("ops-action-v4-changed", l); }; }
export function useVersionedActionRecord(actionId: string) {
  const raw = useSyncExternalStore(subscribe, () => readAdministrationPayload(ACTIONS_KEY), () => null);
  try { const rows: MyAction[] = raw ? JSON.parse(raw) : []; return rows.find(a => a.id === actionId); } catch { return undefined; }
}
export function AuditActionDetail({ actionId }: { actionId: string }) {
  const user = useCurrentUser(); const { context, ready } = useAccessContext(); useAccessV3State(); useAccessV4State(); const a = useVersionedActionRecord(actionId);
  if (!ready) return <p role="status" className="p-6">Loading task scope…</p>;
  if (!context || !a || !canReadV4Action(a)) return <p role="alert" className="p-6">This Audit-origin task is unavailable in the selected factory context.</p>;
  return <AuditActionWork key={`${a.id}:${context.selectionId}:${user.id}`} action={a}/>;
}
function AuditActionWork({ action: a }: { action: MyAction }) {
  const user = useCurrentUser();
  const [formRevision, setFormRevision] = useState(a.v4!.revision); const [observation, setObservation] = useState(a.resolutionObservation ?? ""); const [category, setCategory] = useState(a.correctiveActionCategory ?? ""); const [saving, setSaving] = useState(String(a.costSaving ?? 0)); const [type, setType] = useState<MyActionType | "">(""); const [verifier, setVerifier] = useState(""); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const expected = () => ({ selectionId: getActiveAccessContext()?.selectionId ?? "", revision: formRevision });
  const owner = canWorkV4Action(a, user.id); const review = canVerifyV4Action(a, user.id);
  const candidates = v4VerifierCandidates(a);
  const coordinator = candidates.some(p => eligibleV4Coordinator(a, user.id, p.id));
  const source = requireV4ActionBase(a).source;
  const stale = formRevision !== a.v4!.revision;
  const recovery = pendingV4Recovery();
  const blocked = pending || stale || recovery;
  const selectionValid = validV4Selection(a);
  async function run(fn: () => Promise<MyAction | undefined>) { setPending(true); setError(""); try { const result = await fn(); if (!result) throw new Error("Transition unavailable; check owner, type, evidence, submission and current reviewer eligibility."); setFormRevision(result.v4!.revision); } catch(e) { setError(e instanceof Error ? e.message : "Unable to save task."); } finally { setPending(false); } }
  return <section className="mx-auto grid w-full max-w-5xl min-w-0 gap-5 p-4 sm:p-6"><div><p className="text-sm text-muted-foreground">Audit-origin corrective Action · {a.id}</p><h1 className="text-xl font-semibold">{a.title}</h1><p className="mt-2 text-sm">{a.status} · Owner {a.responsiblePersonName} · Work capacity {a.v4!.workCapacity.capacity}</p><p className="break-words text-sm text-muted-foreground">Assignment {a.v4!.workCapacity.roleAssignmentId} · {a.area} · {a.department}</p></div>
  <p>{a.description}</p>{canReadScopedAudit(source) && <Link className="text-sm text-primary underline" href={getActionSourceHref(a)!}>Open originating Audit</Link>}
  <p className="text-sm">Selected verifier: {a.reviewerName ?? "Not selected"}. Selection coordinator must be independently authorized and distinct from creator, owner/completers and verifier.</p>
  <p className="text-sm">Selected coordinator: {a.v4!.verifierSelection?.coordinatorPersonId ?? "Not selected"}.</p>
  {recovery && <p role="alert" className="text-sm text-destructive">A storage recovery journal is pending. Preserve saved work; an authorized platform administrator must review recovery before changes can continue.</p>}
  {a.reviewerId && !selectionValid && <p role="alert" className="text-sm text-destructive">The recorded verifier or coordinator is no longer eligible. An independent authorized coordinator must explicitly replace the selection before submission or review.</p>}
  {!candidates.length && <p role="status" className="text-sm text-muted-foreground">No eligible independent verifier is available in the originating scope. Review stays blocked; ask the authorized Factory Admin to review approved assignments.</p>}
  {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  {formRevision !== a.v4!.revision && <div><p className="text-sm">This task changed. Reload its recorded values before editing.</p><Button variant="outline" onClick={() => { setFormRevision(a.v4!.revision); setObservation(a.resolutionObservation ?? ""); setCategory(a.correctiveActionCategory ?? ""); setSaving(String(a.costSaving ?? 0)); }}>Reload task values</Button></div>}
  {owner && <div className="grid gap-4 border-t pt-4">
    {["Assigned", "Open", "Rework Required"].includes(a.status) && <div className="flex flex-wrap gap-2"><Button variant={type === "immediate" ? "default" : "outline"} onClick={() => setType("immediate")}>Immediate Action</Button><Button variant={type === "corrective" ? "default" : "outline"} onClick={() => setType("corrective")}>Corrective Action</Button><Button disabled={blocked || !type} onClick={() => { if (type) void run(() => executeV4ActionTransition(a.id, expected(), { operation: "start", actionType: type })); }}>Start work</Button></div>}
    <label className="grid gap-2 text-sm">Resolution notes<Textarea value={observation} onChange={e => setObservation(e.target.value)}/></label><label className="grid gap-2 text-sm">Corrective action category<Input value={category} onChange={e => setCategory(e.target.value)}/></label><label className="grid gap-2 text-sm">Cost saving<Input type="number" min={0} value={saving} onChange={e => setSaving(e.target.value)}/></label>
    {canUndoActionStart(a, user) && <Button variant="outline" disabled={blocked} onClick={() => run(() => executeV4ActionTransition(a.id, expected(), { operation: "undo", observation, correctiveActionCategory: category, costSaving: Number(saving) }))}>Undo Start Work</Button>}
    <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={blocked} onClick={() => run(() => executeV4ActionTransition(a.id, expected(), { operation: "save", observation, correctiveActionCategory: category, costSaving: Number(saving) }))}>Save work</Button><Button disabled={blocked || a.status !== "In Progress" || !selectionValid} onClick={() => run(() => executeV4ActionTransition(a.id, expected(), { operation: "submit", observation, correctiveActionCategory: category, costSaving: Number(saving) }))}>Submit for independent review</Button></div>
    {a.status === "In Progress" && (["progress", "resolution"] as const).map(kind => <label key={kind} className="grid gap-2 text-sm">Upload {kind} evidence<Input type="file" disabled={blocked} onChange={e => { const file = e.target.files?.[0]; if (file) void run(() => uploadAuditActionEvidence(a.id, file, kind, expected())); e.target.value = ""; }}/></label>)}
  </div>}
  {coordinator && a.status !== "Completed" && <div className="grid gap-3 border-t pt-4"><h2 className="font-semibold">Independent verifier selection</h2><OpsPersonSelect label="Eligible verifier" entityLabel="Verifier" entityPlural="Verifiers" value={verifier} people={candidates.filter(p => eligibleV4Coordinator(a, user.id, p.id))} onValueChange={setVerifier}/><label className="grid gap-2 text-sm">Replacement reason (required when changing selection)<Input value={reason} onChange={e => setReason(e.target.value)}/></label><Button disabled={blocked || !verifier} onClick={() => run(() => selectAuditActionVerifier(a.id, verifier, reason, expected()))}>Confirm explicit verifier</Button></div>}
  {!a.reviewerId && <p className="text-sm text-muted-foreground">Draft work is allowed. Review submission requires an eligible independent coordinator and verifier. ZL work needs two distinct eligible Factory Admins; FA-work qualification is currently unsupported.</p>}
  {review && ["Pending Review", "Pending Auditor Review", "Awaiting Review"].includes(a.status) && <div className="grid gap-3 border-t pt-4"><label className="grid gap-2 text-sm">Review / rework reason<Textarea value={reason} onChange={e => setReason(e.target.value)}/></label><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={blocked || !reason.trim()} onClick={() => run(() => executeV4ActionTransition(a.id, expected(), { operation: "rework", reason }))}>Send back for rework</Button><Button disabled={blocked} onClick={() => run(() => executeV4ActionTransition(a.id, expected(), { operation: "close", reason }))}>Verify and close</Button></div></div>}
  <h2 className="font-semibold">Finding and work evidence</h2>{[...(a.issueEvidence ?? []), ...(a.progressEvidence ?? []), ...a.evidence].map(e => <ScopedEvidence key={e.id} action={a} evidence={e}/>)}
  <details><summary className="cursor-pointer font-medium">Retained task history</summary>{a.activityHistory?.map(e => <p key={e.id} className="py-2 text-sm">{e.type} · {e.actorName} · {e.createdAt} {e.remark}</p>)}{a.v4!.verifierHistory.map(e => <p className="py-2 text-sm" key={e.id}>Verifier replaced by {e.changedBy} · {e.changedAt} · {e.reason}</p>)}</details>
  </section>;
}
function ScopedEvidence({ action, evidence }: { action: MyAction; evidence: MyActionEvidence }) {
  const [url, setUrl] = useState(""); const [error, setError] = useState("");
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return <div className="grid gap-1"><Button variant="outline" onClick={async () => { try { const selection = getActiveAccessContext()?.selectionId; if (!canReadV4Action(action)) throw new Error("Evidence scope changed."); assertV4EvidenceReferences([evidence], evidence.evidenceType === "finding" ? action.auditId! : action.id, action.organizationId!, action.plantId!); const blob = await getGembaPhoto(evidence.storageKey!); const current = readCanonicalActions().find(a => a.id === action.id); if (!blob || !current || !canReadV4Action(current) || selection !== getActiveAccessContext()?.selectionId) throw new Error("Evidence unavailable or access changed."); if (url) URL.revokeObjectURL(url); setUrl(URL.createObjectURL(blob)); } catch(e) { setError(e instanceof Error ? e.message : "Evidence unavailable"); } }}>{evidence.name} · {evidence.evidenceType}</Button>{url && <a className="text-sm text-primary underline" href={url} target="_blank" rel="noreferrer">View authorized evidence</a>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</div>;
}
