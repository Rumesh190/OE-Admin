"use client";
import { RecordDeletionMenu } from "@/components/ops/record-deletion-menu";

import { compareNewestMeetings } from "@/lib/records/record-order";


import { withBusinessRecordCreation } from "@/lib/records/module-records";
import { getCurrentDemoUser } from "@/lib/current-user";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CirclePlay } from "lucide-react";
import { OpsListingLayout as PageContainer, OpsListingToolbar } from "@/components/ops/ops-listing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAdminUsers } from "@/features/five-s/administration/store";
import FiveSPageHeader from "@/features/five-s/components/FiveSPageHeader";
import { useCurrentUser } from "@/lib/current-user";
import { canManageVisualManagementSchedule, visibleVisualManagementBoards, visibleVisualManagementMeetings } from "./visual-management-access";
import { formatVmDate, MeetingStatusBadge, StartMeetingDialog, VisualManagementNav } from "./visual-management-components";
import { changeMeetingSchedule, listMeetingOccurrences, useMeetingSchedules, type MeetingOccurrence } from "./meeting-schedule-store";
import { ScheduleMeetingDialog } from "./schedule-meeting-dialog";
import { meetingDurationMinutes, startVisualManagementMeeting, useVisualManagementStore } from "./visual-management-store";

import { OpsTabBar } from "@/components/ops/ops-tabs";
import { Input } from "@/components/ui/input";
import { useUrlState } from "@/lib/navigation/use-url-state";

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const displayDate = (key: string) => new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(`${key}T12:00:00`));

export default function MeetingsPage() {
  const router = useRouter();
  const url = useUrlState();
  const requestedView = url.params.get("view");
  const meetingView = ["all", "upcoming", "calendar", "history"].includes(requestedView ?? "") ? requestedView! : "all";
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const state = useVisualManagementStore();
  const schedules = useMeetingSchedules();
  const currentUser = useCurrentUser();
  const adminUser = useAdminUsers().find((user) => user.id === currentUser.id);
  const boards = visibleVisualManagementBoards(state.boards, currentUser, adminUser?.roles);
  const boardMap = new Map(boards.map((board) => [board.id, board]));
  const meetings = visibleVisualManagementMeetings(state.meetings, state.boards, currentUser, adminUser?.roles);
  const filteredMeetings = meetings.filter(meeting => (status === "All" || meeting.status === status) && [meeting.id, meeting.boardName, boardMap.get(meeting.boardId)?.name, meeting.lead.name].join(" ").toLowerCase().includes(search.toLowerCase()));
  const scheduleMap = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  const [today] = useState(() => new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState(() => dateKey(new Date()));
  const [startOpen, setStartOpen] = useState(false);
  const [editing, setEditing] = useState<MeetingOccurrence | null>(null);
  const [cancelling, setCancelling] = useState<MeetingOccurrence | null>(null);
  const [scope, setScope] = useState<"single" | "future" | "series">("single");
  const [error, setError] = useState("");
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = addDays(monthStart, -((monthStart.getDay() + 6) % 7));
  const calendar = listMeetingOccurrences(dateKey(gridStart), dateKey(addDays(gridStart, 41))).filter((item) => boardMap.has(item.boardId));
  const upcoming = listMeetingOccurrences(dateKey(today), dateKey(addDays(today, 45))).filter((item) => boardMap.has(item.boardId) && item.status === "Scheduled");
  const meetingFor = (item: MeetingOccurrence) => meetings.find((meeting) => meeting.scheduleId === item.scheduleId && meeting.occurrenceDate === item.occurrenceDate);
  async function start(item: MeetingOccurrence) {
    try {
    const board = boardMap.get(item.boardId);
    if (!board || board.status !== "Active") return;
    const active = meetings.find((meeting) => meeting.boardId === board.id && meeting.status === "In Progress");
    if (!active) await withBusinessRecordCreation(() => startVisualManagementMeeting(board.id, getCurrentDemoUser(), { scheduleId: item.scheduleId, occurrenceDate: item.occurrenceDate, scheduledTime: item.time, durationMinutes: item.durationMinutes, attendees: item.attendees }, board.owner));
    router.push(`/visual-management/boards/${board.id}/meeting`);

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save this record. Please retry.";
      setError(message);
    }
  }
  async function cancel() {
    try {
    if (!cancelling) return;
    if (!await withBusinessRecordCreation(() => changeMeetingSchedule(cancelling.scheduleId, cancelling.occurrenceDate, scope, {}, true, getCurrentDemoUser()))) return setError("This meeting could not be cancelled. It may have already started.");
    setCancelling(null);

    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save this record. Please retry.";
      setError(message);
    }
  }
  function occurrenceRow(item: MeetingOccurrence) {
    const board = boardMap.get(item.boardId);
    if (!board) return null;
    const existing = meetingFor(item);
    const active = meetings.find((meeting) => meeting.boardId === board.id && meeting.status === "In Progress");
    const canManage = canManageVisualManagementSchedule(board, currentUser, adminUser?.roles);
    return <div key={item.key} className="flex flex-wrap items-center justify-between gap-3 border-b py-4 last:border-b-0"><div><p className="font-medium">{board.name}</p><p className="text-sm text-muted-foreground">{displayDate(item.date)} · {item.time} · {item.durationMinutes} min · {item.attendees.length} expected</p><p className="text-xs text-muted-foreground">{board.zone ?? board.plant}{scheduleMap.get(item.scheduleId)?.recurrence.type !== "none" ? " · Recurring" : ""}</p></div><div className="flex flex-wrap gap-2">{item.status === "Cancelled" ? <span className="text-sm text-muted-foreground">Cancelled</span> : existing?.status === "Completed" ? <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/visual-management/meetings/${existing.id}`} />}>View history</Button> : <><Button size="sm" onClick={() => start(item)}>{active ? "Resume Meeting" : "Start Meeting"}</Button>{canManage && !existing ? <><Button size="sm" variant="outline" onClick={() => setEditing(item)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => { setCancelling(item); setScope("single"); setError(""); }}>Cancel</Button></> : null}</>}</div></div>;
  }
  return <PageContainer className="max-w-none">{error && !cancelling && <p role="alert" className="text-sm text-destructive">{error}</p>}<FiveSPageHeader eyebrow="Visual Management" title="Meetings" description="Plan upcoming meetings and review completed meetings." actions={<Button onClick={() => setStartOpen(true)}><CirclePlay className="size-4" />Start Meeting</Button>} /><VisualManagementNav /><Tabs value={meetingView} onValueChange={value => url.update({ view: value }, "push")} className="min-w-0"><OpsTabBar label="Meeting views" active={meetingView} onChange={value => url.update({ view: value }, "push")} tabs={[{ id: "all", label: "All", count: meetings.length }, { id: "upcoming", label: "Upcoming", count: upcoming.length }, { id: "calendar", label: "Calendar" }, { id: "history", label: "History", count: meetings.length }]} />
    {["all", "history"].includes(meetingView) && <OpsListingToolbar active={Boolean(search || status !== "All")} onClear={() => { setSearch(""); setStatus("All"); }}><label className="grid gap-1 text-sm">Search<Input aria-label="Search meetings" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search meetings, boards, or leads..." /></label><Select value={status} onValueChange={value => setStatus(value ?? "All")}><SelectTrigger aria-label="Meeting status"><SelectValue /></SelectTrigger><SelectContent>{["All", "In Progress", "Completed"].map(value => <SelectItem key={value} value={value}>{value === "All" ? "All statuses" : value}</SelectItem>)}</SelectContent></Select></OpsListingToolbar>}

    <TabsContent value="upcoming" className="mt-4"><Card className="gap-0"><CardContent className="p-4 sm:px-6">{upcoming.length ? upcoming.map(occurrenceRow) : <p className="py-8 text-center text-sm text-muted-foreground">No meetings scheduled in the next 45 days.</p>}</CardContent></Card></TabsContent>
    <TabsContent value="calendar" className="mt-4"><Card className="gap-0"><CardContent className="p-4 sm:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="font-semibold">{new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" }).format(month)}</h2><div className="flex gap-1"><Button size="icon-sm" variant="outline" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft className="size-4" /></Button><Button size="icon-sm" variant="outline" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight className="size-4" /></Button></div></div><div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div><div className="mt-2 grid grid-cols-7 gap-1">{Array.from({ length: 42 }, (_, index) => { const day = addDays(gridStart, index); const key = dateKey(day); const count = calendar.filter((item) => item.date === key && item.status === "Scheduled").length; return <Button key={key} variant={selectedDay === key ? "default" : "ghost"} className={`h-14 flex-col gap-0.5 p-1 ${day.getMonth() !== month.getMonth() ? "opacity-45" : ""}`} onClick={() => setSelectedDay(key)} aria-label={`${displayDate(key)}, ${count} meetings`}><span>{day.getDate()}</span>{count ? <span className="text-[10px]">{count} meeting{count > 1 ? "s" : ""}</span> : null}</Button>; })}</div><h3 className="mt-6 border-t pt-4 text-sm font-semibold">{displayDate(selectedDay)}</h3>{calendar.filter((item) => item.date === selectedDay).length ? calendar.filter((item) => item.date === selectedDay).map(occurrenceRow) : <p className="py-4 text-sm text-muted-foreground">No meetings on this day.</p>}</CardContent></Card></TabsContent>
    <TabsContent value={meetingView === "all" ? "all" : "history"} className="mt-4"><Card className="gap-0"><CardContent className="p-4 sm:px-6">{filteredMeetings.length ? [...filteredMeetings].sort(compareNewestMeetings).map((meeting) => <div key={meeting.id} className="flex items-center gap-2 border-b last:border-b-0"><Link href={`/visual-management/meetings/${meeting.id}`} className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 py-4 hover:text-primary"><div><p className="font-medium">{meeting.boardName ?? boardMap.get(meeting.boardId)?.name ?? "Board"}</p><p className="text-sm text-muted-foreground">{formatVmDate(meeting.startedAt, true)} · {meeting.lead.name} · {meetingDurationMinutes(meeting)} min</p><p className="text-xs text-muted-foreground">{meeting.participants.filter((person) => person.attendance === "Present").length} present · {meeting.topicIds.length} topics · {meeting.actionIds.length} actions</p></div><MeetingStatusBadge status={meeting.status} /></Link><RecordDeletionMenu module="vmMeeting" recordId={meeting.id} /></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No meetings match the selected filters.</p>}</CardContent></Card></TabsContent></Tabs>
    <StartMeetingDialog open={startOpen} onOpenChange={setStartOpen} />
    {editing && boardMap.get(editing.boardId) && scheduleMap.get(editing.scheduleId) ? <ScheduleMeetingDialog open onOpenChange={(open) => { if (!open) setEditing(null); }} board={boardMap.get(editing.boardId)!} actorId={currentUser.id} schedule={scheduleMap.get(editing.scheduleId)} occurrence={editing} /> : null}
    <Dialog open={Boolean(cancelling)} onOpenChange={(open) => { if (!open) setCancelling(null); }}><DialogContent><DialogHeader><DialogTitle>Cancel Meeting</DialogTitle><DialogDescription>Completed meeting history will remain available.</DialogDescription></DialogHeader>{cancelling && scheduleMap.get(cancelling.scheduleId)?.recurrence.type !== "none" ? <Select value={scope} onValueChange={(value) => setScope(value as typeof scope)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="single">This meeting</SelectItem><SelectItem value="future">This and future meetings</SelectItem><SelectItem value="series">Entire series</SelectItem></SelectContent></Select> : null}{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<DialogFooter><Button variant="outline" onClick={() => setCancelling(null)}>Keep Meeting</Button><Button variant="destructive" onClick={cancel}>Cancel Meeting</Button></DialogFooter></DialogContent></Dialog>
  </PageContainer>;
}
