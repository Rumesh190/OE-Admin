"use client";
import { OpsPersonSelect } from "@/components/ops/ops-person-select";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, CalendarClock, CirclePlay, LayoutPanelTop } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { OpsTabBar } from "@/components/ops/ops-tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAdminUsers } from "@/features/five-s/administration/store";
import { cn } from "@/lib/utils";
import { formatOpsDate, formatOpsDateTime } from "@/lib/ops-formatters";
import { useCurrentUser } from "@/lib/current-user";
import { visibleVisualManagementBoards, visibleVisualManagementMeetings } from "./visual-management-access";
import { useVisualManagementStore } from "./visual-management-store";
import type { VisualManagementBoard, VisualManagementEscalationStatus, VisualManagementKpiStatus, VisualManagementMeetingStatus } from "./types";

export function VisualManagementNav({ active: selected }: { active?: string } = {}) {
  const pathname = usePathname();
  const state = useVisualManagementStore();
  const user = useCurrentUser();
  const admin = useAdminUsers().find(item => item.id === user.id);
  const boardCount = visibleVisualManagementBoards(state.boards, user, admin?.roles).length;
  const meetingCount = visibleVisualManagementMeetings(state.meetings, state.boards, user, admin?.roles).length;
  const items = [
    { id: "overview", label: "Overview", href: "/visual-management?tab=overview" },
    { id: "boards", label: "All Boards", count: boardCount, href: "/visual-management/boards" },
    { id: "meetings", label: "All Meetings", count: meetingCount, href: "/visual-management/meetings" },
    { id: "settings", label: "Settings", href: "/visual-management/settings" },
  ];
  const active = selected ?? items.find((item) => item.id !== "overview" && pathname.startsWith(item.href))?.id ?? "boards";
  return <OpsTabBar label="Visual Management sections" tabs={items} active={active} />;
}

export function KpiStatusBadge({ status }: { status: VisualManagementKpiStatus }) {
  return <Badge variant={status === "Green" ? "success" : status === "Amber" ? "warning" : "danger"}>{status}</Badge>;
}

export function MeetingStatusBadge({ status }: { status: VisualManagementMeetingStatus }) {
  return <StatusBadge status={status} />;
}

/** Compatibility-only presentation for historical records; active VM routes do not render it. */
export function EscalationStatusBadge({ status }: { status: VisualManagementEscalationStatus }) {
  return <StatusBadge status={status} />;
}

export function VmMetric({ label, value, detail, tone = "neutral" }: { label: string; value: string | number; detail?: string; tone?: "neutral" | "success" | "warning" | "danger" | "info" }) {
  const colors = { neutral: "text-foreground", success: "text-emerald-700 dark:text-emerald-400", warning: "text-amber-700 dark:text-amber-400", danger: "text-red-700 dark:text-red-400", info: "text-sky-700 dark:text-sky-400" };
  return <Card className="gap-0 shadow-none"><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">{label}</p><p className={cn("mt-2 text-2xl font-semibold tracking-tight", colors[tone])}>{value}</p>{detail && <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>}</CardContent></Card>;
}

export function BoardHealthCard({ board }: { board: VisualManagementBoard }) {
  const red = board.sections.filter((section) => section.status === "Red").length;
  const amber = board.sections.filter((section) => section.status === "Amber").length;
  return <Link href={`/visual-management/boards/${board.id}`} className="group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring">
    <Card className="h-full gap-0 shadow-none transition-colors group-hover:bg-muted/25"><CardContent className="p-4">
      <div className="flex items-start justify-between gap-3"><span className="grid size-9 place-items-center rounded-lg bg-primary/[0.08] text-primary"><LayoutPanelTop className="size-4" /></span><Badge variant="outline">{board.tier}</Badge></div>
      <h3 className="mt-3 text-sm font-semibold">{board.name}</h3><p className="mt-1 text-xs text-muted-foreground">{board.plant}{board.zone ? ` · ${board.zone}` : ""}</p>
      <div className="mt-4 flex items-center gap-3 border-t pt-3 text-xs"><span className={red ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}>{red} red</span><span className={amber ? "font-semibold text-amber-600 dark:text-amber-400" : "text-muted-foreground"}>{amber} amber</span><ArrowRight className="ml-auto size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
    </CardContent></Card>
  </Link>;
}

export function StartMeetingDialog({ open, onOpenChange, initialBoardId }: { open: boolean; onOpenChange: (open: boolean) => void; initialBoardId?: string }) {
  const state = useVisualManagementStore();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const boards = visibleVisualManagementBoards(state.boards, currentUser, adminUser?.roles);
  const meetings = state.meetings;
  const router = useRouter();
  const [boardId, setBoardId] = useState(initialBoardId ?? "");
  const selected = useMemo(() => boards.find((board) => board.id === boardId && board.status === "Active"), [boardId, boards]);
  const active = meetings.find((meeting) => meeting.boardId === boardId && meeting.status === "In Progress");
  function start() {
    if (!selected) return;
    onOpenChange(false);
    router.push(`/visual-management/boards/${selected.id}/meeting`);
  }
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Start Visual Management Meeting</DialogTitle><DialogDescription>Select a board. Plant, zone, tier, members, lead, and KPI sections are carried into the confirmation automatically.</DialogDescription></DialogHeader><div className="grid gap-4"><label className="grid gap-2 text-sm font-medium">Board<OpsPersonSelect label="Board" clearable={false} entityLabel="board" entityPlural="boards" people={boards.filter(board => board.status === "Active").map(board => ({ ...board, description: board.tier }))} value={boardId} onValueChange={setBoardId} /></label>{selected && <div className="rounded-lg border bg-muted/25 p-4"><div className="flex items-center gap-2"><Badge variant="outline">{selected.tier}</Badge>{active && <Badge variant="info">Meeting in progress</Badge>}</div><p className="mt-2 text-sm font-semibold">{selected.name}</p><p className="mt-1 text-xs text-muted-foreground">{selected.plant}{selected.zone ? ` · ${selected.zone}` : ""} · Default lead: {selected.owner.name}</p><p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />{selected.meetingFrequency} · {selected.members.length} expected members</p></div>}</div><DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={start} disabled={!selected}><CirclePlay className="size-4" />{active ? "Resume Meeting" : "Review & Start"}</Button></DialogFooter></DialogContent></Dialog>;
}

export function formatVmDate(value: string, includeTime = false) {
  return includeTime ? formatOpsDateTime(value) : formatOpsDate(value);
}
