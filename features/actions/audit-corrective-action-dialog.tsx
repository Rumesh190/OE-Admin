"use client";
import { useState } from "react";
import type { FiveSAudit } from "@/features/five-s/types/five-s";
import type { MyAction } from "@/features/five-s/types/my-actions";
import { getAccessV4State } from "@/features/five-s/administration/access-v4-state";
import { getActiveAccessContext } from "@/features/five-s/administration/access-v4-context";
import { correctiveActionOwnerCandidates, createAuditQuestionCorrectiveAction } from "@/lib/actions/audit-corrective-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpsPersonSelect } from "@/components/ops/ops-person-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
export function AuditCorrectiveActionDialog({ audit, questionId, onClose, onCreated }: { audit: FiveSAudit; questionId: string; onClose: () => void; onCreated: (a: MyAction) => void }) {
  const [expected] = useState(() => ({ selectionId: getActiveAccessContext()?.selectionId ?? "", auditRevision: audit.revision!, administrationRevision: getAccessV4State().revision }));
  const q = audit.sections.flatMap(s => s.questions).find(q => q.id === questionId);
  const [title, setTitle] = useState(q?.observation ?? ""); const [description, setDescription] = useState(q?.observation ?? ""); const [assignmentId, setAssignmentId] = useState(""); const [dueDate, setDueDate] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  const candidates = correctiveActionOwnerCandidates(audit.id, questionId);
  return <Dialog open onOpenChange={open => { if (!open && !pending) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Add corrective Action</DialogTitle><DialogDescription>Save the finding and required evidence first. The Action and question link are published together. Work capacity is explicitly selected; a verifier may be selected later.</DialogDescription></DialogHeader><form className="grid gap-4" onSubmit={async e => { e.preventDefault(); setPending(true); setError(""); try { const a = await createAuditQuestionCorrectiveAction(audit.id, questionId, { title, description, assignmentId, dueDate, priority: "Medium" }, expected); onCreated(a); } catch(e) { setError(e instanceof Error ? e.message : "Unable to create corrective Action."); } finally { setPending(false); } }}>
  {!q?.departmentId && <p role="status" className="text-sm">Canonical Department is missing. Zone/factory-level owner eligibility is unsupported; no Department is fabricated.</p>}
  <label className="grid gap-2 text-sm">Title<Input required value={title} onChange={e => setTitle(e.target.value)}/></label><label className="grid gap-2 text-sm">Description<Input required value={description} onChange={e => setDescription(e.target.value)}/></label><OpsPersonSelect label="Owner and recorded work assignment" entityLabel="Assignment" entityPlural="Assignments" value={assignmentId} people={candidates} onValueChange={setAssignmentId}/><label className="grid gap-2 text-sm">Due date<Input required type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}/></label>{!candidates.length && <p className="text-sm text-muted-foreground">No eligible active same-Zone/Department owner assignment. Factory Admin must configure approved memberships and roles.</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button><Button type="submit" disabled={pending || !assignmentId || !q?.departmentId}>{pending ? "Creating…" : "Create corrective Action"}</Button></DialogFooter></form></DialogContent></Dialog>;
}
