"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";
import { CanonicalLinkedRecords } from "@/components/ops/ops-linked-records";

import { compareNewestMeetings } from "@/lib/records/record-order";

import { useUrlState } from "@/lib/navigation/use-url-state";
import { ActionLink } from "@/components/ops/ops-return-link";

import { useMemo, useState } from "react";
import Link from "@/components/ops/ops-record-link";
import { ArrowLeft, ArrowRight, CalendarPlus, CirclePlay, ClipboardCheck, History, ListTodo, Printer } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useActionStore } from "@/lib/actions/action-store";
import { useCurrentUser } from "@/lib/current-user";
import { formatVmDate, MeetingStatusBadge, StartMeetingDialog, VisualManagementNav } from "./visual-management-components";
import { canManageVisualManagementSchedule, canViewVisualManagementBoard } from "./visual-management-access";
import { ScheduleMeetingDialog } from "./schedule-meeting-dialog";
import { meetingDurationMinutes, useVisualManagementStore } from "./visual-management-store";
import { ConfiguredKpiBoard } from "./configured-kpi-board";

export default function BoardDetailPage({ boardId }: { boardId: string }) {
  const url = useUrlState();
  const state = useVisualManagementStore();
  const allActions = useActionStore();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const [startOpen, setStartOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const candidate = state.boards.find((item) => item.id === boardId);
  const board = candidate && canViewVisualManagementBoard(candidate, currentUser, adminUser?.roles) ? candidate : undefined;
  const meetings = useMemo(() => state.meetings.filter((item) => item.boardId === boardId).sort(compareNewestMeetings), [boardId, state.meetings]);
  if (!board) return <Missing />;
  const actionIds = new Set(meetings.flatMap((meeting) => meeting.actionIds));
  const actions = allActions.filter((action) => actionIds.has(action.id) || (action.sourceModule === "visualManagement" && action.sourceLocation?.includes(board.zone ?? board.plant)));
  return <PageContainer className="max-w-none"><FiveSPageHeader eyebrow={`${board.tier} · ${board.plant}${board.zone ? ` / ${board.zone}` : ""}`} title={board.name} description={`${board.meetingFrequency} · Owner: ${board.owner.name} · ${board.members.length} expected members`} leading={<Button variant="ghost" size="icon-sm" nativeButton={false} render={<Link href="/visual-management/boards" />} aria-label="Back to boards"><ArrowLeft className="size-4" /></Button>} actions={<div className="flex flex-wrap gap-2"><RecordDeletionMenu module="vmBoard" recordId={board.id} returnTo="/visual-management/boards" /><Button onClick={() => setStartOpen(true)}><CirclePlay className="size-4" />Start Meeting</Button><Button variant="outline" nativeButton={false} render={<Link href={`/visual-management/boards/${encodeURIComponent(board.id)}/print`} />}><Printer className="size-4" />Print Board</Button>{canManageVisualManagementSchedule(board, currentUser, adminUser?.roles) ? <Button variant="outline" onClick={() => setScheduleOpen(true)}><CalendarPlus className="size-4" />Schedule Meeting</Button> : null}</div>} /><VisualManagementNav />
    <CanonicalLinkedRecords currentRecord={{module:"visualManagement",recordId:board.id}} />
    <Tabs value={["board","actions","meetings"].includes(url.params.get("tab") ?? "") ? url.params.get("tab")! : "board"} onValueChange={tab => url.update({tab})}><TabsList variant="line" className="max-w-full overflow-x-auto"><TabsTrigger value="board"><ClipboardCheck />Board</TabsTrigger><TabsTrigger value="actions"><ListTodo />Actions <Badge size="sm" variant="secondary">{actions.length}</Badge></TabsTrigger><TabsTrigger value="meetings"><History />Meetings <Badge size="sm" variant="secondary">{meetings.length}</Badge></TabsTrigger></TabsList>
      <TabsContent value="board" className="mt-4"><ConfiguredKpiBoard board={board} /></TabsContent>
      <TabsContent value="actions" className="mt-4"><Card className="gap-0"><CardContent className="divide-y p-0">{actions.map((action) => <ActionLink href={`/actions/${action.id}`} key={action.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{action.title}</span><span className="mt-1 block text-xs text-muted-foreground">{action.responsiblePersonName ?? action.assignedTo} · Due {action.dueDate}</span></span><Badge variant={action.status === "Completed" ? "success" : action.status === "Overdue" ? "danger" : "warning"}>{action.status}</Badge><ArrowRight className="size-4 text-muted-foreground" /></ActionLink>)}{!actions.length && <Empty text="Actions created during meetings will appear here." />}</CardContent></Card></TabsContent>
      <TabsContent value="meetings" className="mt-4"><Card className="gap-0"><CardContent className="divide-y p-0">{meetings.map((meeting) => <Link href={`/visual-management/meetings/${meeting.id}`} key={meeting.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30"><span className="min-w-0 flex-1"><span className="block font-mono text-xs font-semibold text-primary">{meeting.id}</span><span className="mt-1 block text-xs text-muted-foreground">{formatVmDate(meeting.startedAt, true)} · {meeting.lead.name} · {meetingDurationMinutes(meeting)} min</span></span><MeetingStatusBadge status={meeting.status} /><ArrowRight className="size-4 text-muted-foreground" /></Link>)}{!meetings.length && <Empty text="No meetings have been recorded for this board." />}</CardContent></Card></TabsContent>
    </Tabs><StartMeetingDialog open={startOpen} onOpenChange={setStartOpen} initialBoardId={board.id} />{scheduleOpen ? <ScheduleMeetingDialog open onOpenChange={setScheduleOpen} board={board} actorId={currentUser.id} /> : null}</PageContainer>;
}

function Empty({ text }: { text: string }) { return <div className="grid min-h-32 place-items-center p-6 text-center text-sm text-muted-foreground">{text}</div>; }
function Missing() { return <PageContainer><FiveSPageHeader eyebrow="Visual Management" title="Board not found" description="This board is unavailable." /><Button variant="outline" nativeButton={false} render={<Link href="/visual-management/boards" />}>Back to Boards</Button></PageContainer>; }
