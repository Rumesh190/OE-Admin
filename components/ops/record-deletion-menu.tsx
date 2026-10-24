"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/current-user";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { useModuleEntitlements } from "@/lib/module-entitlements";
import { canDeleteOperationalRecord, deleteOperationalRecord, getDeletionLinkedActionIds } from "@/lib/records/record-deletion";
import { getDeletionRecord, useRecordDeletions, type DeletionModule } from "@/lib/records/record-tombstones";

export const DELETION_LABELS: Record<DeletionModule, string> = { audit: "Audit", redTag: "Red Tag", gemba: "Gemba Walk", gembaObservation: "Gemba Observation", continuousImprovement: "Continuous Improvement", visualImprovement: "Visual Improvement", vmBoard: "Visual Management Board", vmMeeting: "Visual Management Meeting", action: "Action" };
export function RecordDeletionMenu({ module, recordId, returnTo }: { module: DeletionModule; recordId: string; returnTo?: string }) {
  useCurrentUser(); useAdminUsers(); useModuleEntitlements(); useRecordDeletions();
  if (!canDeleteOperationalRecord(module, recordId)) return null;
  return <AuthorizedRecordDeletionMenu module={module} recordId={recordId} returnTo={returnTo} />;
}
function AuthorizedRecordDeletionMenu({ module, recordId, returnTo }: { module: DeletionModule; recordId: string; returnTo?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const record = getDeletionRecord(module, recordId)!;
  const linked = open ? getDeletionLinkedActionIds(module, record) : [];
  function confirm() {
    setPending(true); setError("");
    try { deleteOperationalRecord(module, recordId, true); setOpen(false); if (returnTo) router.replace(returnTo); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to delete this record."); }
    finally { setPending(false); }
  }
  return <span onKeyDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} className="inline-flex shrink-0">
    <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Record actions ${recordId}`} />}><MoreHorizontal className="size-4" /></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => { setError(""); setOpen(true); }}><Trash2 className="size-4" />Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <Dialog open={open} onOpenChange={value => { if (!pending) setOpen(value); }}><DialogContent><DialogHeader><DialogTitle>Delete {DELETION_LABELS[module]}?</DialogTitle><DialogDescription>{module === "action" ? "Only this Action will be deleted. Its source record will be retained and will not be automatically completed or closed." : "This record will be removed from active views. Linked Actions will be retained with their ownership, evidence and history."}</DialogDescription></DialogHeader><dl className="grid gap-3 text-sm"><div><dt className="text-muted-foreground">Record type</dt><dd>{DELETION_LABELS[module]}</dd></div><div><dt className="text-muted-foreground">Record ID</dt><dd className="break-all font-mono">{recordId}</dd></div><div><dt className="text-muted-foreground">Title</dt><dd className="break-words">{record.title}</dd></div><div><dt className="text-muted-foreground">Linked Actions</dt><dd>{linked.length} — linked Actions will be retained.</dd></div></dl>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<DialogFooter><Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button><Button variant="destructive" disabled={pending} onClick={confirm}>{pending ? "Deleting…" : "Delete Record"}</Button></DialogFooter></DialogContent></Dialog>
  </span>;
}
